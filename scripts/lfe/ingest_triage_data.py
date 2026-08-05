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
                            observation types, and a best-guess location.
    6. Geocode            - location string -> lat/lng via Nominatim.
    7. Push               - upsert into Supabase via ingest_triage() (service role).

Env vars:
    LFE_SUPABASE_URL, LFE_SUPABASE_SERVICE_ROLE_KEY
    LLM_PROVIDER = 'openai' | 'gemini' | 'mock'   (default 'mock')
    LLM_API_KEY
    NOMINATIM_UA = contact string for OSM usage policy (recommended)
    BLUESKY_IDENTIFIER, BLUESKY_APP_PASSWORD, BLUESKY_PDS (optional)

Usage:
    python ingest_triage_data.py --event-slug japan-2026
    python ingest_triage_data.py               # every status='active' event
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
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
        'from the caption, else null, '
        '"confidence": float 0-1}. If the image is not earthquake-related, set '
        'damage_score 0 and observation_types ["other"].'
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
        "p_location_precision": "approximate",
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

    print("[5] Geocoding...")
    located: list[MediaItem] = []
    for it in items:
        it.lat, it.lng = geocode(it.triage.get("location_text"), country_code)
        if it.lat is None and LLM_PROVIDER == "mock":
            it.lat, it.lng = event.get("epicentre_lat"), event.get("epicentre_lng")
        if it.lat is not None:
            located.append(it)
        else:
            print(f"    - skipped (no location): {it.source_url}")
    print(f"    {len(located)} geolocated")

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
