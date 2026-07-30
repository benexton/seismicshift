#!/usr/bin/env python3
"""
VERT Kumamoto 2026 - ingestion & AI triage pipeline (v2).

Pulls real observations from open, legitimate sources - Bluesky (open AT
Protocol API, no key) and news/RSS feeds - plus honours whatever search terms
and feeds are configured in the Supabase `scraper_sources` table (edited from
the Scraper Keywords tab). Manual/human entries come in through the web form,
not here.

Pipeline order (keeps LLM spend low - dedup BEFORE the model):
    1. Load sources   - read enabled bluesky terms + rss feeds from Supabase.
    2. Collect        - fetch posts/articles with images (source_type tagged).
    3. pHash dedup    - drop near-duplicate images (Hamming 0-5).
    4. AI triage      - GPT-4o / Gemini reads image + text, returns damage,
                        observation_type, and a best-guess location string.
    5. Geocode        - turn the location string into lat/lng via OpenStreetMap
                        Nominatim; items with no locatable place are skipped.
    6. Push           - upsert into Supabase via ingest_triage() (service role).

Env vars (GitHub Actions secrets/vars):
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
    LLM_PROVIDER = 'openai' | 'gemini' | 'mock'   (default 'mock')
    LLM_API_KEY
    NOMINATIM_UA = contact string for OSM usage policy (recommended)
"""

from __future__ import annotations

import hashlib
import io
import json
import os
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

# --- Config ------------------------------------------------------------------
PHASH_DUPLICATE_MAX = 5
REQUEST_TIMEOUT = 30

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "mock").lower()
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
NOMINATIM_UA = os.environ.get("NOMINATIM_UA", "vert-kumamoto-recon/1.0 (contact: set NOMINATIM_UA)")

# Fallback sources if the Supabase config table can't be read.
DEFAULT_BLUESKY = ["熊本地震", "Kumamoto earthquake"]
DEFAULT_RSS: list[str] = []


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


# --- 1. Load sources from Supabase ------------------------------------------
def load_sources() -> tuple[list[str], list[str]]:
    if not (SUPABASE_URL and SUPABASE_KEY):
        print("  (no Supabase creds) using default sources")
        return DEFAULT_BLUESKY, DEFAULT_RSS
    try:
        resp = requests.get(
            f"{SUPABASE_URL}/rest/v1/scraper_sources",
            headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
            params={"select": "kind,value,enabled", "enabled": "eq.true"},
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        rows = resp.json()
        bsky = [r["value"] for r in rows if r["kind"] == "bluesky"]
        rss = [r["value"] for r in rows if r["kind"] == "rss"]
        return (bsky or DEFAULT_BLUESKY), (rss or DEFAULT_RSS)
    except Exception as exc:  # noqa: BLE001
        print(f"  ! could not load sources ({exc}); using defaults", file=sys.stderr)
        return DEFAULT_BLUESKY, DEFAULT_RSS


# --- 2. Collectors -----------------------------------------------------------
def _bluesky_login(pds: str, identifier: str, password: str) -> str | None:
    """Create a session with an app password; returns an access JWT or None."""
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


def collect_from_bluesky(terms: list[str], per_term: int = 25) -> list[MediaItem]:
    """
    Bluesky post search. searchPosts now requires an authenticated session, so
    we log in with an app password (BLUESKY_IDENTIFIER / BLUESKY_APP_PASSWORD)
    and call the AppView with a bearer token. Without credentials we skip
    Bluesky (RSS still runs).
    """
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
    # Prefer the PDS host (it proxies app.bsky queries to the AppView), then the
    # AppView directly, so we work across account types.
    hosts = [pds, "https://api.bsky.app"]

    items: list[MediaItem] = []
    for term in terms:
        posts = None
        for host in hosts:
            try:
                resp = requests.get(
                    f"{host}/xrpc/app.bsky.feed.searchPosts",
                    params={"q": term, "limit": per_term},
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
            embed = post.get("embed") or {}
            images = embed.get("images") or []
            if not images:
                continue
            media = images[0].get("fullsize") or images[0].get("thumb")
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
        import re
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
                    continue  # no image = can't triage visually
                text = f"{entry.get('title','')} . {entry.get('summary','')}"
                items.append(MediaItem(entry.get("link", ""), media, text, "rss"))
        except Exception as exc:  # noqa: BLE001
            print(f"  ! rss '{feed}' failed: {exc}", file=sys.stderr)
    return items


# --- 3. pHash dedup ----------------------------------------------------------
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


# --- 4. AI triage (damage + observation type + location string) -------------
TRIAGE_PROMPT = (
    "You are a senior structural/geotechnical engineer assessing post-earthquake "
    "damage from a photo and its caption. Respond with STRICT JSON only, keys: "
    '{"damage_score": int 0-4 (0 none..4 collapse), '
    '"observation_type": one of "building"|"geotechnical"|"landslide"|"lifeline"|"tsunami"|"other", '
    '"code_era": "pre-1981"|"1981-2000"|"post-2000"|"unknown", '
    '"failure_mechanism": short phrase, '
    '"observed_retrofits": "none" or short phrase, '
    '"location_text": best guess of the specific place in Japan (town/ward/landmark) '
    'from the caption, else null, '
    '"confidence": float 0-1}. If the image is not earthquake damage, set '
    'damage_score 0 and observation_type "other".'
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


def _triage_openai(item: MediaItem) -> dict[str, Any]:
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {LLM_API_KEY}", "Content-Type": "application/json"},
        json={
            "model": "gpt-4o", "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": TRIAGE_PROMPT},
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


def _triage_gemini(item: MediaItem) -> dict[str, Any]:
    import base64
    img = requests.get(item.media_url, timeout=REQUEST_TIMEOUT)
    img.raise_for_status()
    b64 = base64.b64encode(img.content).decode()
    endpoint = ("https://generativelanguage.googleapis.com/v1beta/models/"
                f"gemini-1.5-pro:generateContent?key={LLM_API_KEY}")
    resp = requests.post(
        endpoint, headers={"Content-Type": "application/json"},
        json={
            "system_instruction": {"parts": [{"text": TRIAGE_PROMPT}]},
            "contents": [{"parts": [
                {"text": f"Caption: {item.text[:500]}"},
                {"inline_data": {"mime_type": "image/jpeg", "data": b64}},
            ]}],
            "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
        },
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return _parse_json(resp.json()["candidates"][0]["content"]["parts"][0]["text"]) | {"ai_model": "gemini-1.5-pro"}


_MOCK_PLACES = ["Mashiki, Kumamoto", "Kumamoto City", "Minamiaso, Kumamoto", "Aso, Kumamoto"]
_MOCK_OBS = ["building", "building", "geotechnical", "landslide", "lifeline"]


def _triage_mock(item: MediaItem) -> dict[str, Any]:
    seed = int(hashlib.sha1(item.media_url.encode()).hexdigest(), 16)
    return {
        "damage_score": seed % 5,
        "observation_type": _MOCK_OBS[seed % len(_MOCK_OBS)],
        "code_era": ["pre-1981", "1981-2000", "post-2000", "unknown"][seed % 4],
        "failure_mechanism": ["soft-story collapse", "out-of-plane failure", "liquefaction", "slope failure"][seed % 4],
        "observed_retrofits": ["none", "tension-only bracing", "supplementary friction dampers"][seed % 3],
        "location_text": _MOCK_PLACES[seed % len(_MOCK_PLACES)],
        "confidence": round(0.5 + (seed % 40) / 100.0, 3),
        "ai_model": "mock",
    }


def triage(item: MediaItem) -> dict[str, Any]:
    fn = {"openai": _triage_openai, "gemini": _triage_gemini}.get(LLM_PROVIDER, _triage_mock)
    try:
        return fn(item)
    except Exception as exc:  # noqa: BLE001
        print(f"  ! triage failed ({item.media_url}): {exc}; using mock", file=sys.stderr)
        return _triage_mock(item)


# --- 5. Geocoding (OpenStreetMap Nominatim) ---------------------------------
def geocode(place: str | None) -> tuple[float | None, float | None]:
    if not place:
        return None, None
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": place, "format": "json", "limit": 1, "countrycodes": "jp"},
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


# --- 6. Push -----------------------------------------------------------------
def _external_id(item: MediaItem) -> str:
    basis = f"{item.source_url}|{item.phash or item.media_url}"
    return hashlib.sha1(basis.encode()).hexdigest()[:24]


def push(item: MediaItem) -> None:
    t = item.triage
    if not (SUPABASE_URL and SUPABASE_KEY):
        print(f"  (dry-run) {item.source_type} {item.lat:.3f},{item.lng:.3f} "
              f"D{t.get('damage_score')} {t.get('observation_type')} <- {item.source_url}")
        return
    payload = {
        "p_external_id": _external_id(item),
        "p_lng": item.lng, "p_lat": item.lat,
        "p_source_url": item.source_url, "p_media_url": item.media_url,
        "p_phash": item.phash, "p_region": t.get("location_text"),
        "p_damage_score": int(t.get("damage_score", 0)),
        "p_code_era": t.get("code_era"),
        "p_failure_mechanism": t.get("failure_mechanism"),
        "p_observed_retrofits": t.get("observed_retrofits"),
        "p_ai_confidence": t.get("confidence"),
        "p_ai_model": t.get("ai_model"),
        "p_source_type": item.source_type,
        "p_observation_type": t.get("observation_type", "building"),
        "p_location_precision": "approximate",
    }
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/ingest_triage",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
                 "Content-Type": "application/json"},
        json=payload, timeout=REQUEST_TIMEOUT,
    )
    print(("  + pushed " if r.ok else f"  ! push {r.status_code}: {r.text} ") + item.source_url)


# --- Orchestration -----------------------------------------------------------
def main() -> int:
    print(f"[1] Loading sources (provider={LLM_PROVIDER})...")
    bsky, rss = load_sources()
    print(f"    {len(bsky)} bluesky term(s), {len(rss)} rss feed(s)")

    print("[2] Collecting...")
    items = collect_from_bluesky(bsky) + collect_from_rss(rss)
    print(f"    {len(items)} item(s) with images")

    print("[3] Deduplicating...")
    items = dedupe(items)
    print(f"    {len(items)} unique")

    print(f"[4] AI triage...")
    for it in items:
        it.triage = triage(it)

    print("[5] Geocoding...")
    located: list[MediaItem] = []
    for it in items:
        it.lat, it.lng = geocode(it.triage.get("location_text"))
        if it.lat is None and LLM_PROVIDER == "mock":
            it.lat, it.lng = 32.79, 130.74  # keep dry-runs useful offline
        if it.lat is not None:
            located.append(it)
        else:
            print(f"    - skipped (no location): {it.source_url}")
    print(f"    {len(located)} geolocated")

    print("[6] Pushing...")
    for it in located:
        push(it)

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
