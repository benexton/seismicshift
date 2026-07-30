#!/usr/bin/env python3
"""
VERT Kumamoto 2026 — ingestion & AI triage pipeline.

Strict execution order (designed to minimise LLM token spend):

    1. Mock ingestion        — simulate scraping social/news feeds.
    2. Spatial clustering    — group media within a 50 m radius.
    3. Visual deduplication  — perceptual hash (pHash); Hamming distance 0–5
                               within a cluster => duplicate, discard.
    4. AI processing         — send ONLY the unique images to a multimodal LLM
                               (GPT-4o or Gemini 1.5 Pro) for structural triage.
    5. Database push         — upsert unique, triaged records into Supabase via
                               the ingest_triage() RPC (service-role key).

Environment variables (set as GitHub Actions secrets):
    SUPABASE_URL                e.g. https://xxxx.supabase.co
    SUPABASE_SERVICE_ROLE_KEY   service role key (bypasses RLS — keep secret)
    LLM_PROVIDER                'openai' | 'gemini' | 'mock'   (default: 'mock')
    LLM_API_KEY                 API key for the chosen provider
"""

from __future__ import annotations

import hashlib
import io
import json
import math
import os
import sys
from dataclasses import dataclass, field
from typing import Any

import requests

try:
    from PIL import Image
    import imagehash
except ImportError:  # pragma: no cover
    print("Install deps: pip install -r scripts/requirements.txt", file=sys.stderr)
    raise

# --- Config ------------------------------------------------------------------
CLUSTER_RADIUS_M = 50.0
PHASH_DUPLICATE_MAX = 5           # Hamming distance in [0, 5] => duplicate
REQUEST_TIMEOUT = 30

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "mock").lower()
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")


@dataclass
class MediaItem:
    source_url: str
    media_url: str
    lat: float
    lng: float
    region: str | None = None
    phash: str | None = None
    triage: dict[str, Any] = field(default_factory=dict)


# --- 1. Mock ingestion -------------------------------------------------------
def mock_ingest() -> list[MediaItem]:
    """Placeholder for the real scraper. Returns crowdsourced media items.

    Replace this with feed/social scraping that yields (source_url, media_url,
    lat, lng). Two of the items below are deliberately near-duplicates at the
    same location to exercise the clustering + pHash dedup path.
    """
    return [
        MediaItem("https://example.org/post/a1", "https://placehold.co/600x400?text=RC1",
                  32.7898, 130.8190, "Mashiki, Kumamoto"),
        MediaItem("https://example.org/post/a2", "https://placehold.co/600x400?text=RC1",
                  32.78982, 130.81903, "Mashiki, Kumamoto"),  # ~3 m away, same image
        MediaItem("https://example.org/post/b1", "https://placehold.co/600x400?text=URM",
                  32.8032, 130.7417, "Kumamoto City (Chuo)"),
        MediaItem("https://example.org/post/c1", "https://placehold.co/600x400?text=Timber",
                  32.8890, 130.7700, "Kikuchi, Kumamoto"),
    ]


# --- 2. Spatial clustering ---------------------------------------------------
def _haversine_m(a: MediaItem, b: MediaItem) -> float:
    R = 6_371_000.0
    p1, p2 = math.radians(a.lat), math.radians(b.lat)
    dphi = math.radians(b.lat - a.lat)
    dlmb = math.radians(b.lng - a.lng)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def spatial_clusters(items: list[MediaItem], radius_m: float = CLUSTER_RADIUS_M) -> list[list[MediaItem]]:
    """Greedy single-link clustering by proximity (<= radius_m)."""
    clusters: list[list[MediaItem]] = []
    for item in items:
        placed = False
        for cluster in clusters:
            if any(_haversine_m(item, other) <= radius_m for other in cluster):
                cluster.append(item)
                placed = True
                break
        if not placed:
            clusters.append([item])
    return clusters


# --- 3. Perceptual-hash deduplication ---------------------------------------
def _download_image(url: str) -> Image.Image | None:
    try:
        resp = requests.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return Image.open(io.BytesIO(resp.content)).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        print(f"  ! image fetch failed ({url}): {exc}", file=sys.stderr)
        return None


def dedupe_cluster(cluster: list[MediaItem]) -> list[MediaItem]:
    """Compute pHash for each item; drop near-duplicates (Hamming 0–5)."""
    kept: list[MediaItem] = []
    for item in cluster:
        img = _download_image(item.media_url)
        if img is None:
            # Keep undecodable items (can't compare), but flag missing hash.
            kept.append(item)
            continue
        ph = imagehash.phash(img)
        item.phash = str(ph)
        is_dup = False
        for existing in kept:
            if existing.phash is None:
                continue
            if (ph - imagehash.hex_to_hash(existing.phash)) <= PHASH_DUPLICATE_MAX:
                is_dup = True
                break
        if is_dup:
            print(f"  - discarding duplicate {item.source_url} (phash {item.phash})")
        else:
            kept.append(item)
    return kept


# --- 4. AI processing (multimodal LLM structural triage) --------------------
TRIAGE_SYSTEM_PROMPT = (
    "You are a senior structural engineer assessing post-earthquake building "
    "damage from a single photograph. Respond with STRICT JSON only, no prose, "
    "with exactly these keys: "
    '{"damage_score": int 0-4 (0 none,1 slight,2 moderate,3 heavy,4 collapse), '
    '"code_era": one of "pre-1981"|"1981-2000"|"post-2000"|"unknown", '
    '"failure_mechanism": short phrase, '
    '"observed_retrofits": "none" or a short phrase such as '
    '"tension-only bracing" or "supplementary friction dampers", '
    '"confidence": float 0-1}.'
)


def _parse_triage_json(text: str) -> dict[str, Any]:
    """Extract the JSON object from an LLM response, tolerating code fences."""
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text[text.find("{"):]
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError(f"no JSON object in response: {text[:200]}")
    return json.loads(text[start : end + 1])


def _triage_openai(media_url: str) -> dict[str, Any]:
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {LLM_API_KEY}", "Content-Type": "application/json"},
        json={
            "model": "gpt-4o",
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": TRIAGE_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Assess this building for seismic damage."},
                        {"type": "image_url", "image_url": {"url": media_url}},
                    ],
                },
            ],
        },
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"]
    return _parse_triage_json(content) | {"ai_model": "gpt-4o"}


def _triage_gemini(media_url: str) -> dict[str, Any]:
    # Gemini needs inline image bytes (base64) rather than a URL.
    import base64

    img = requests.get(media_url, timeout=REQUEST_TIMEOUT)
    img.raise_for_status()
    b64 = base64.b64encode(img.content).decode()
    endpoint = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-1.5-pro:generateContent?key={LLM_API_KEY}"
    )
    resp = requests.post(
        endpoint,
        headers={"Content-Type": "application/json"},
        json={
            "system_instruction": {"parts": [{"text": TRIAGE_SYSTEM_PROMPT}]},
            "contents": [
                {
                    "parts": [
                        {"text": "Assess this building for seismic damage."},
                        {"inline_data": {"mime_type": "image/jpeg", "data": b64}},
                    ]
                }
            ],
            "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
        },
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    content = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    return _parse_triage_json(content) | {"ai_model": "gemini-1.5-pro"}


def _triage_mock(media_url: str) -> dict[str, Any]:
    """Deterministic offline stand-in so the pipeline runs without API keys."""
    seed = int(hashlib.sha1(media_url.encode()).hexdigest(), 16)
    return {
        "damage_score": seed % 5,
        "code_era": ["pre-1981", "1981-2000", "post-2000", "unknown"][seed % 4],
        "failure_mechanism": ["soft-story collapse", "out-of-plane infill failure",
                              "beam-column joint failure", "minor cracking"][seed % 4],
        "observed_retrofits": ["none", "tension-only bracing",
                               "supplementary friction dampers"][seed % 3],
        "confidence": round(0.5 + (seed % 50) / 100.0, 3),
        "ai_model": "mock",
    }


def triage(item: MediaItem) -> dict[str, Any]:
    fn = {"openai": _triage_openai, "gemini": _triage_gemini}.get(LLM_PROVIDER, _triage_mock)
    try:
        return fn(item.media_url)
    except Exception as exc:  # noqa: BLE001
        print(f"  ! triage failed for {item.media_url}: {exc}; falling back to mock", file=sys.stderr)
        return _triage_mock(item.media_url)


# --- 5. Database push --------------------------------------------------------
def _external_id(item: MediaItem) -> str:
    basis = f"{item.source_url}|{item.phash or item.media_url}"
    return hashlib.sha1(basis.encode()).hexdigest()[:24]


def push(item: MediaItem) -> None:
    if not SUPABASE_URL or not SUPABASE_KEY:
        print(f"  (dry-run, no Supabase creds) would push {item.source_url}: {item.triage}")
        return
    payload = {
        "p_external_id": _external_id(item),
        "p_lng": item.lng,
        "p_lat": item.lat,
        "p_source_url": item.source_url,
        "p_media_url": item.media_url,
        "p_phash": item.phash,
        "p_region": item.region,
        "p_damage_score": int(item.triage.get("damage_score", 0)),
        "p_code_era": item.triage.get("code_era"),
        "p_failure_mechanism": item.triage.get("failure_mechanism"),
        "p_observed_retrofits": item.triage.get("observed_retrofits"),
        "p_ai_confidence": item.triage.get("confidence"),
        "p_ai_model": item.triage.get("ai_model"),
    }
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/rpc/ingest_triage",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=REQUEST_TIMEOUT,
    )
    if not resp.ok:
        print(f"  ! push failed ({resp.status_code}): {resp.text}", file=sys.stderr)
    else:
        print(f"  + pushed {item.source_url} -> {resp.text.strip()}")


# --- Orchestration -----------------------------------------------------------
def main() -> int:
    print(f"[1] Ingesting (provider={LLM_PROVIDER})…")
    items = mock_ingest()
    print(f"    {len(items)} raw items")

    print("[2] Spatial clustering (50 m)…")
    clusters = spatial_clusters(items)
    print(f"    {len(clusters)} cluster(s)")

    print("[3] Perceptual-hash deduplication…")
    unique: list[MediaItem] = []
    for i, cluster in enumerate(clusters):
        kept = dedupe_cluster(cluster)
        print(f"    cluster {i}: {len(cluster)} -> {len(kept)} unique")
        unique.extend(kept)

    print(f"[4] AI triage of {len(unique)} unique image(s)…")
    for item in unique:
        item.triage = triage(item)

    print("[5] Pushing to Supabase…")
    for item in unique:
        push(item)

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
