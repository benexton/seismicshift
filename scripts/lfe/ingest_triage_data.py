#!/usr/bin/env python3
"""
LFE platform - ingestion & AI triage pipeline, event-parameterized.

Adapted from ../ingest_triage_data.py (Kumamoto, single-event, untouched) for
the multi-event LFE platform: sources come from that event's own
scraper_sources rows, geocoding is not hardcoded to Japan, and observations
are pushed with an event_id into the new LFE Supabase project.

Pipeline order (keeps LLM spend low - dedup BEFORE the model):
    1. Resolve event(s)  - one event by --event-slug, or every active event.
    2. Load sources      - that event's enabled bluesky terms + rss feeds.
    3. Collect           - fetch posts/articles with images.
    4. pHash dedup        - drop near-duplicate images (Hamming 0-5).
    5. AI triage          - reads image + text, returns damage, one or more
                            observation types, a best-guess place name, an
                            English translation of the caption (auto-
                            translation at ingest - the same call already
                            being made, not a second one, so a triager who
                            doesn't read the event's language can still work
                            the queue), and - when a specific place can be
                            recognised from a landmark, street sign,
                            storefront signage, or address text - a direct
                            coordinate guess.
    6. Geocode            - place name -> lat/lng via Nominatim. If that
                            fails, falls back to the AI's own coordinate
                            guess from step 5, flagged 'ai_estimated' (not
                            'approximate') so a human triager knows to
                            confirm or correct it rather than trust it
                            silently. Either way, a candidate more than
                            EVENT_RADIUS_KM from the event's own epicentre is
                            rejected outright - Bluesky's search has no way
                            to filter by where a post was sent from, so this
                            is the practical substitute: judge the content's
                            own resolved location against the event instead
                            of trusting keyword anchoring alone to keep
                            results on-topic. Only genuinely unlocatable or
                            out-of-range posts are dropped.
    7. Push               - upsert into Supabase via ingest_triage() (service role).

Env vars:
    LFE_SUPABASE_URL, LFE_SUPABASE_SERVICE_ROLE_KEY
    LLM_PROVIDER = 'openai' | 'gemini' | 'mock'   (default 'mock')
    LLM_API_KEY
    NOMINATIM_UA = contact string for OSM usage policy (recommended)
    BLUESKY_IDENTIFIER, BLUESKY_APP_PASSWORD, BLUESKY_PDS (optional)
    EVENT_RADIUS_KM = max distance from the event's epicentre a resolved
        location may be before it's rejected (default 500)

Usage:
    python ingest_triage_data.py --event-slug japan-2026
    python ingest_triage_data.py               # every status='active' event
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import re
import sys
import time
from dataclasses import dataclass, field
from typing import Any

import requests

try:
    from PIL import Image
    import imagehash
except ImportError:  # pragma: no cover
    print("Install deps: pip install -r scripts/requirements.txt", file=sys.stderr)
    raise

try:
    import feedparser
except ImportError:  # pragma: no cover
    feedparser = None

import os

from _common import (
    SUPABASE_URL, SUPABASE_KEY,
    valid_observation_types, sb_get, resolve_events, require_env,
)

PHASH_DUPLICATE_MAX = 5
REQUEST_TIMEOUT = 30

LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "mock").lower()
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
NOMINATIM_UA = os.environ.get("NOMINATIM_UA", "vert-lfe-recon/1.0 (contact: set NOMINATIM_UA)")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "")
GEMINI_MIN_INTERVAL = float(os.environ.get("GEMINI_MIN_INTERVAL", "6"))
# `or "500"` (not a dict default) because an unset GitHub Actions repo
# variable still sets the env var to an empty string, not absent - a plain
# os.environ.get(..., "500") default would never fire and float("") would
# raise.
EVENT_RADIUS_KM = float(os.environ.get("EVENT_RADIUS_KM") or "500")


@dataclass
class MediaItem:
    source_url: str
    media_url: str
    text: str
    source_type: str            # 'bluesky' | 'rss'
    phash: str | None = None
    lat: float | None = None
    lng: float | None = None
    region: str | None = None
    location_precision: str = "approximate"
    location_confidence: str | None = None
    triage: dict[str, Any] = field(default_factory=dict)


# --- Load sources, scoped to one event --------------------------------------
def load_sources(event_id: str) -> tuple[list[str], list[str]]:
    rows = sb_get("scraper_sources", {"select": "kind,value,enabled", "event_id": f"eq.{event_id}", "enabled": "eq.true"})
    bsky = [r["value"] for r in rows if r["kind"] == "bluesky"]
    rss = [r["value"] for r in rows if r["kind"] == "rss"]
    return bsky, rss


# --- Collectors (unchanged from Kumamoto's - source-agnostic) --------------
def _bluesky_login(pds: str, identifier: str, password: str) -> str | None:
    try:
        r = requests.post(
            f"{pds}/xrpc/com.atproto.server.createSession",
            json={"identifier": identifier, "password": password},
            timeout=REQUEST_TIMEOUT,
        )
        r.raise_for_status()
        return r.json().get("accessJwt")
    except Exception as exc:  # noqa: BLE001
        print(f"  ! bluesky login failed: {exc}", file=sys.stderr)
        return None


def _extract_bsky_image(embed: dict) -> str | None:
    if not embed:
        return None
    images = embed.get("images")
    if not images:
        media = embed.get("media") or {}
        images = media.get("images")
    if not images:
        return None
    return images[0].get("fullsize") or images[0].get("thumb")


def collect_from_bluesky(terms: list[str], per_term: int = 100) -> list[MediaItem]:
    identifier = os.environ.get("BLUESKY_IDENTIFIER", "")
    password = os.environ.get("BLUESKY_APP_PASSWORD", "")
    pds = os.environ.get("BLUESKY_PDS", "https://bsky.social").rstrip("/")

    if not (identifier and password):
        print("  (no Bluesky credentials) skipping Bluesky; set "
              "BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD to enable")
        return []

    token = _bluesky_login(pds, identifier, password)
    if not token:
        return []

    headers = {"Authorization": f"Bearer {token}", "User-Agent": NOMINATIM_UA}
    hosts = [pds, "https://api.bsky.app"]

    items: list[MediaItem] = []
    for term in terms:
        posts = None
        last = None
        for host in hosts:
            try:
                resp = requests.get(
                    f"{host}/xrpc/app.bsky.feed.searchPosts",
                    params={"q": term, "limit": per_term, "sort": "latest"},
                    headers=headers,
                    timeout=REQUEST_TIMEOUT,
                )
                resp.raise_for_status()
                posts = resp.json().get("posts", [])
                break
            except Exception as exc:  # noqa: BLE001
                last = exc
        if posts is None:
            print(f"  ! bluesky '{term}' failed: {last}", file=sys.stderr)
            continue
        for post in posts:
            media = _extract_bsky_image(post.get("embed") or {})
            if not media:
                continue
            author = post.get("author", {})
            handle = author.get("handle", "")
            rkey = post.get("uri", "").rsplit("/", 1)[-1]
            web = f"https://bsky.app/profile/{handle}/post/{rkey}" if handle and rkey else post.get("uri", "")
            text = (post.get("record", {}) or {}).get("text", "")
            items.append(MediaItem(web, media, text, "bluesky"))
    return items


def _article_image(url: str) -> str | None:
    try:
        html = requests.get(url, timeout=REQUEST_TIMEOUT, headers={"User-Agent": NOMINATIM_UA}).text
        m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', html)
        return m.group(1) if m else None
    except Exception:  # noqa: BLE001
        return None


def collect_from_rss(feeds: list[str], per_feed: int = 15) -> list[MediaItem]:
    if feedparser is None:
        print("  ! feedparser not installed; skipping RSS", file=sys.stderr)
        return []
    items: list[MediaItem] = []
    for feed in feeds:
        try:
            parsed = feedparser.parse(feed)
            for entry in parsed.entries[:per_feed]:
                media = None
                if entry.get("media_content"):
                    media = entry["media_content"][0].get("url")
                elif entry.get("media_thumbnail"):
                    media = entry["media_thumbnail"][0].get("url")
                elif entry.get("enclosures"):
                    media = entry["enclosures"][0].get("href")
                if not media:
                    media = _article_image(entry.get("link", ""))
                if not media:
                    continue
                text = f"{entry.get('title','')} . {entry.get('summary','')}"
                items.append(MediaItem(entry.get("link", ""), media, text, "rss"))
        except Exception as exc:  # noqa: BLE001
            print(f"  ! rss '{feed}' failed: {exc}", file=sys.stderr)
    return items


# --- pHash dedup (unchanged) -------------------------------------------------
def _download_image(url: str) -> Image.Image | None:
    try:
        r = requests.get(url, timeout=REQUEST_TIMEOUT, headers={"User-Agent": NOMINATIM_UA})
        r.raise_for_status()
        return Image.open(io.BytesIO(r.content)).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        print(f"  ! image fetch failed ({url}): {exc}", file=sys.stderr)
        return None


def dedupe(items: list[MediaItem]) -> list[MediaItem]:
    kept: list[MediaItem] = []
    for item in items:
        img = _download_image(item.media_url)
        if img is None:
            kept.append(item)
            continue
        ph = imagehash.phash(img)
        item.phash = str(ph)
        if any(k.phash and (ph - imagehash.hex_to_hash(k.phash)) <= PHASH_DUPLICATE_MAX for k in kept):
            print(f"  - duplicate dropped: {item.source_url}")
        else:
            kept.append(item)
    return kept


# --- AI triage (event-scoped prompt: no "in Japan" wording, multi-select) ---
def triage_prompt(event_name: str, country: str | None) -> str:
    where = f" in {country}" if country else ""
    return (
        "You are a senior structural/geotechnical engineer assessing post-earthquake "
        f"damage from a photo and its caption, following {event_name}{where}. Respond "
        'with STRICT JSON only, keys: {"damage_score": int 0-4 (0 none..4 collapse), '
        '"observation_types": array of one or more of "building"|"geotechnical"|'
        '"landslide"|"lifeline"|"emergency_management"|"tsunami"|"other" (use '
        '"emergency_management" for evacuation centres, rescue, or emergency-response '
        'activity rather than structural damage), '
        '"code_era": "pre-1981"|"1981-2000"|"post-2000"|"unknown", '
        '"failure_mechanism": short phrase, '
        '"observed_retrofits": "none" or short phrase, '
        '"location_text": best guess of the specific place (town/ward/landmark) '
        'from the caption, in English - romanize or translate it (e.g. "Hikawa '
        'Town", not the local-language original) - else null, '
        '"location_lat": if, and only if, you can recognise the actual specific '
        'place from a visible landmark, street sign, storefront signage, or '
        'address text in the image or caption, your best-guess latitude as a '
        'float, else null - do not guess if you are not reasonably sure, '
        '"location_lng": matching longitude, else null, '
        '"location_confidence": float 0-1, your confidence in location_lat/lng '
        'specifically (0 if you gave neither), '
        '"caption_en": English translation of the caption, or the caption '
        'unchanged if it is already in English - preserve meaning over '
        'literal wording, and keep it reasonably short, '
        '"confidence": float 0-1, overall triage confidence}. If the image is '
        'not earthquake-related, set damage_score 0 and observation_types '
        '["other"].'
    )


def _parse_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text[text.find("{"):]
    s, e = text.find("{"), text.rfind("}")
    if s == -1 or e == -1:
        raise ValueError(f"no JSON: {text[:160]}")
    return json.loads(text[s:e + 1])


def _triage_openai(item: MediaItem, prompt: str) -> dict[str, Any]:
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {LLM_API_KEY}", "Content-Type": "application/json"},
        json={
            "model": "gpt-4o", "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": [
                    {"type": "text", "text": f"Caption: {item.text[:500]}"},
                    {"type": "image_url", "image_url": {"url": item.media_url}},
                ]},
            ],
        },
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return _parse_json(resp.json()["choices"][0]["message"]["content"]) | {"ai_model": "gpt-4o"}


_GEMINI_CANDIDATES = None
_GEMINI_IDX = 0
_GEMINI_LAST_TS = 0.0


def _list_gemini_models() -> list[dict]:
    r = requests.get(
        f"https://generativelanguage.googleapis.com/v1beta/models?key={LLM_API_KEY}",
        timeout=REQUEST_TIMEOUT,
    )
    r.raise_for_status()
    return r.json().get("models", [])


def _gemini_candidates() -> list[str]:
    global _GEMINI_CANDIDATES
    if _GEMINI_CANDIDATES is not None:
        return _GEMINI_CANDIDATES
    try:
        models = _list_gemini_models()
    except Exception as exc:  # noqa: BLE001
        print(f"  ! could not list Gemini models ({exc}); trying '{GEMINI_MODEL}'", file=sys.stderr)
        _GEMINI_CANDIDATES = [GEMINI_MODEL] if GEMINI_MODEL else ["gemini-2.5-flash", "gemini-2.0-flash"]
        return _GEMINI_CANDIDATES

    usable = [
        m["name"].split("/")[-1]
        for m in models
        if "generateContent" in (m.get("supportedGenerationMethods") or [])
        and m.get("name", "").split("/")[-1].startswith("gemini")
    ]
    bad = ("preview", "exp", "tts", "image", "audio", "vision", "lite", "-8b",
           "robotics", "computer-use", "omni", "embedding")

    def ver(n):
        m = re.search(r"gemini-(\d+(?:\.\d+)?)", n)
        return float(m.group(1)) if m else 0.0

    flash = sorted((n for n in usable if "flash" in n and not any(b in n for b in bad)),
                   key=ver, reverse=True)
    others = sorted((n for n in usable if n not in flash and not any(b in n for b in bad)),
                    key=ver, reverse=True)
    ranked = flash + others
    if GEMINI_MODEL in usable:
        ranked = [GEMINI_MODEL] + [n for n in ranked if n != GEMINI_MODEL]

    _GEMINI_CANDIDATES = ranked or ([GEMINI_MODEL] if GEMINI_MODEL else ["gemini-2.5-flash"])
    print(f"  i Gemini model order: {', '.join(_GEMINI_CANDIDATES[:6])}"
          f"{' ...' if len(_GEMINI_CANDIDATES) > 6 else ''}")
    return _GEMINI_CANDIDATES


def _gemini_pace() -> None:
    global _GEMINI_LAST_TS
    wait = GEMINI_MIN_INTERVAL - (time.monotonic() - _GEMINI_LAST_TS)
    if wait > 0:
        time.sleep(wait)
    _GEMINI_LAST_TS = time.monotonic()


def _retry_after(resp, attempt: int) -> float:
    ra = resp.headers.get("Retry-After")
    if ra:
        try:
            return min(float(ra), 60.0)
        except ValueError:
            pass
    return min(2.0 * (2 ** attempt), 30.0)


def _triage_gemini(item: MediaItem, prompt: str) -> dict[str, Any]:
    import base64
    global _GEMINI_IDX
    img = requests.get(item.media_url, timeout=REQUEST_TIMEOUT)
    img.raise_for_status()
    b64 = base64.b64encode(img.content).decode()

    cands = _gemini_candidates()
    payload = {
        "system_instruction": {"parts": [{"text": prompt}]},
        "contents": [{"parts": [
            {"text": f"Caption: {item.text[:500]}"},
            {"inline_data": {"mime_type": "image/jpeg", "data": b64}},
        ]}],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
    }

    last_exc = None
    while _GEMINI_IDX < len(cands):
        model = cands[_GEMINI_IDX]
        endpoint = ("https://generativelanguage.googleapis.com/v1beta/models/"
                    f"{model}:generateContent?key={LLM_API_KEY}")
        for attempt in range(3):
            _gemini_pace()
            resp = requests.post(endpoint, headers={"Content-Type": "application/json"},
                                 json=payload, timeout=REQUEST_TIMEOUT)
            if resp.status_code == 404:
                print(f"  i model '{model}' returned 404; trying next candidate", file=sys.stderr)
                last_exc = requests.HTTPError(f"404 for {model}")
                break
            if resp.status_code == 429:
                wait = _retry_after(resp, attempt)
                print(f"  i rate limited on '{model}'; waiting {wait}s (attempt {attempt + 1})", file=sys.stderr)
                last_exc = requests.HTTPError(f"429 for {model}")
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return _parse_json(resp.json()["candidates"][0]["content"]["parts"][0]["text"]) | {"ai_model": model}
        _GEMINI_IDX += 1

    raise last_exc or RuntimeError("no usable Gemini model")


_MOCK_OBS = [["building"], ["building"], ["geotechnical"], ["landslide"], ["lifeline"], ["emergency_management"]]


def _triage_mock(item: MediaItem, event_name: str) -> dict[str, Any]:
    seed = int(hashlib.sha1(item.media_url.encode()).hexdigest(), 16)
    return {
        "damage_score": seed % 5,
        "observation_types": _MOCK_OBS[seed % len(_MOCK_OBS)],
        "code_era": ["pre-1981", "1981-2000", "post-2000", "unknown"][seed % 4],
        "failure_mechanism": ["soft-story collapse", "out-of-plane failure", "liquefaction", "slope failure"][seed % 4],
        "observed_retrofits": ["none", "tension-only bracing", "supplementary friction dampers"][seed % 3],
        "location_text": event_name,
        "location_lat": None,
        "location_lng": None,
        "location_confidence": 0.0,
        "caption_en": item.text,
        "confidence": round(0.5 + (seed % 40) / 100.0, 3),
        "ai_model": "mock",
    }


def triage(item: MediaItem, event_name: str, country: str | None) -> dict[str, Any]:
    prompt = triage_prompt(event_name, country)
    fn = {"openai": _triage_openai, "gemini": _triage_gemini}.get(LLM_PROVIDER)
    try:
        if fn is None:
            raise RuntimeError("mock provider")
        return fn(item, prompt)
    except Exception as exc:  # noqa: BLE001
        if LLM_PROVIDER not in ("mock",):
            print(f"  ! triage failed ({item.media_url}): {exc}; using mock", file=sys.stderr)
        return _triage_mock(item, event_name)


# --- LLM-assisted geolocation fallback (design doc 2.3) ---------------------
def _valid_latlng(lat, lng) -> bool:
    try:
        return -90 <= float(lat) <= 90 and -180 <= float(lng) <= 180
    except (TypeError, ValueError):
        return False


def _confidence_bucket(raw) -> str | None:
    try:
        v = float(raw)
    except (TypeError, ValueError):
        return None
    if v >= 0.7:
        return "high"
    if v >= 0.4:
        return "medium"
    return "low"


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _within_event_radius(lat: float, lng: float, event: dict) -> bool:
    """Bluesky's searchPosts has no post/author geolocation to filter by -
    the AT Protocol post and profile lexicons simply carry no geo field, so
    keyword anchoring (baking the place name into the search term itself, as
    Kumamoto's scraper does) is the only thing keeping results on-topic, and
    generic terms alone pull in unrelated earthquakes worldwide. This is the
    practical substitute: reject a candidate whose own resolved location
    (Nominatim hit or AI guess) lands implausibly far from the event's
    epicentre, so broad/generic keywords stay usable without flooding the
    queue with off-topic posts. No epicentre on record means nothing to
    judge distance against, so nothing is rejected on that basis."""
    epi_lat, epi_lng = event.get("epicentre_lat"), event.get("epicentre_lng")
    if epi_lat is None or epi_lng is None:
        return True
    return _haversine_km(lat, lng, epi_lat, epi_lng) <= EVENT_RADIUS_KM


# --- Geocoding (event-scoped: no hardcoded country) -------------------------
def geocode(place: str | None, country_code: str | None) -> tuple[float | None, float | None]:
    if not place:
        return None, None
    try:
        params = {"q": place, "format": "json", "limit": 1}
        if country_code:
            params["countrycodes"] = country_code.lower()
        resp = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params=params,
            headers={"User-Agent": NOMINATIM_UA},
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        results = resp.json()
        time.sleep(1)  # Nominatim usage policy: max 1 request/second
        if results:
            return float(results[0]["lat"]), float(results[0]["lon"])
    except Exception as exc:  # noqa: BLE001
        print(f"  ! geocode failed for '{place}': {exc}", file=sys.stderr)
    return None, None


# --- Push --------------------------------------------------------------------
def _external_id(item: MediaItem) -> str:
    basis = f"{item.source_url}|{item.phash or item.media_url}"
    return hashlib.sha1(basis.encode()).hexdigest()[:24]


def _safe_damage_score(raw) -> int:
    """t.get("damage_score", 0) only substitutes the default when the key is
    missing, not when the model explicitly returns null or a non-numeric
    value - and a bare int(None) or int("unsure") would raise, aborting the
    whole run rather than just this one record."""
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 0


_MAX_TEXT_LEN = 4000  # defensive cap - an RSS summary can occasionally run long


def _clip_text(text: str | None) -> str | None:
    if not text:
        return None
    return text[:_MAX_TEXT_LEN]


def push(item: MediaItem, event_id: str) -> None:
    t = item.triage
    payload = {
        "p_event_id": event_id,
        "p_external_id": _external_id(item),
        "p_lng": item.lng, "p_lat": item.lat,
        "p_source_url": item.source_url, "p_media_url": item.media_url,
        "p_phash": item.phash, "p_region": t.get("location_text"),
        "p_damage_score": _safe_damage_score(t.get("damage_score")),
        "p_code_era": t.get("code_era"),
        "p_failure_mechanism": t.get("failure_mechanism"),
        "p_observed_retrofits": t.get("observed_retrofits"),
        "p_ai_confidence": t.get("confidence"),
        "p_ai_model": t.get("ai_model"),
        "p_source_type": item.source_type,
        "p_observation_types": valid_observation_types(t.get("observation_types")),
        "p_location_precision": item.location_precision,
        "p_location_confidence": item.location_confidence,
        "p_source_text": _clip_text(item.text),
        "p_source_text_en": _clip_text(t.get("caption_en")),
    }
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/ingest_triage",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
                 "Content-Type": "application/json"},
        json=payload, timeout=REQUEST_TIMEOUT,
    )
    print(("  + pushed " if r.ok else f"  ! push {r.status_code}: {r.text} ") + item.source_url)


# --- Orchestration, per event -------------------------------------------------
def process_event(event: dict) -> None:
    event_id = event["id"]
    name = event.get("name") or event["slug"]
    country = event.get("country")
    country_code = event.get("country_code")

    print(f"=== {name} ({event['slug']}) ===")
    print(f"[1] Loading sources (provider={LLM_PROVIDER})...")
    bsky, rss = load_sources(event_id)
    print(f"    {len(bsky)} bluesky term(s), {len(rss)} rss feed(s)")
    if not (bsky or rss):
        print("    no sources configured; skipping")
        return

    print("[2] Collecting...")
    items = collect_from_bluesky(bsky) + collect_from_rss(rss)
    print(f"    {len(items)} item(s) with images")

    print("[3] Deduplicating...")
    items = dedupe(items)
    print(f"    {len(items)} unique")

    print("[4] AI triage...")
    for it in items:
        it.triage = triage(it, name, country)

    print(f"[5] Geocoding (event radius {EVENT_RADIUS_KM:.0f}km)...")
    located: list[MediaItem] = []
    ai_estimated = 0
    out_of_range = 0
    for it in items:
        it.lat, it.lng = geocode(it.triage.get("location_text"), country_code)
        if it.lat is not None:
            it.location_precision = "approximate"
        else:
            cand_lat, cand_lng = it.triage.get("location_lat"), it.triage.get("location_lng")
            if _valid_latlng(cand_lat, cand_lng):
                it.lat, it.lng = float(cand_lat), float(cand_lng)
                it.location_precision = "ai_estimated"
                it.location_confidence = _confidence_bucket(it.triage.get("location_confidence"))
            elif LLM_PROVIDER == "mock":
                it.lat, it.lng = event.get("epicentre_lat"), event.get("epicentre_lng")

        if it.lat is not None and not _within_event_radius(it.lat, it.lng, event):
            print(f"    - rejected (outside {EVENT_RADIUS_KM:.0f}km event radius): {it.source_url}")
            it.lat, it.lng = None, None
            out_of_range += 1
        elif it.location_precision == "ai_estimated":
            ai_estimated += 1

        if it.lat is not None:
            located.append(it)
        else:
            print(f"    - skipped (no location, no AI estimate): {it.source_url}")
    print(f"    {len(located)} geolocated ({ai_estimated} AI-estimated - flagged for human confirmation"
          + (f"; {out_of_range} rejected as too far from the event" if out_of_range else "") + ")")

    print("[6] Pushing...")
    for it in located:
        try:
            push(it, event_id)
        except Exception as exc:  # noqa: BLE001
            print(f"  ! push failed, skipping this item ({it.source_url}): {exc}")


def main() -> int:
    require_env(LFE_SUPABASE_URL=SUPABASE_URL, LFE_SUPABASE_SERVICE_ROLE_KEY=SUPABASE_KEY)

    ap = argparse.ArgumentParser()
    ap.add_argument("--event-slug", default=os.environ.get("EVENT_SLUG") or None)
    args = ap.parse_args()

    events = resolve_events(args.event_slug)
    for event in events:
        process_event(event)

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
