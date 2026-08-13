#!/usr/bin/env python3
"""
LFE platform - backfill primary images for already-verified sites.

Finds Approved (verified), non-merged triage_records with no media_url, and
for each one tries its own source_url, then any of its record_attachments'
source_urls, in order, until an image can be extracted from one of them: a
direct image URL, a YouTube thumbnail, or a page's og:image meta tag (same
technique already used at ingest time in ingest_triage_data.py's
_article_image()). The first link that yields a real, loadable image wins.

Nothing here writes to media_url or touches status - the result is inserted
as a NEW record_attachment (added_by='image-backfill-script') for a human to
confirm via the "Image review" tab (or the existing "Make primary" button on
the record itself) before it becomes the record's official verified photo.
An og:image scrape occasionally grabs the wrong picture (a site logo, an
unrelated article header, a different building in a multi-photo post), so
this is deliberately a draft, not a direct write - every site stays Approved
throughout regardless of what this script finds.

Re-running is safe: a record that already has a pending (not yet
approved/rejected) candidate from a previous run is skipped, not duplicated.

Env: LFE_SUPABASE_URL, LFE_SUPABASE_SERVICE_ROLE_KEY.
Optional: NOMINATIM_UA (a contact string sent as User-Agent - politer than
the requests default, and some sites rate-limit generic UAs more readily).

Deps: requests, Pillow (both already in ../requirements.txt).

Usage:
    python backfill_primary_images.py --event-slug CatiaLaMar-2026
    python backfill_primary_images.py --event-slug CatiaLaMar-2026 --event-slug kumamoto-2026
    python backfill_primary_images.py               # every event, any status
"""

from __future__ import annotations

import argparse
import io
import os
import re
import sys
import time
from urllib.parse import parse_qs, urlparse

import requests
from PIL import Image

from _common import SUPABASE_KEY, SUPABASE_URL, require_env, sb_get, sb_post

REQUEST_TIMEOUT = 30
UA = os.environ.get("NOMINATIM_UA", "vert-lfe-recon/1.0 (contact: set NOMINATIM_UA)")
ADDED_BY_TAG = "image-backfill-script"
IMAGE_EXT_RE = re.compile(r"\.(jpe?g|png|gif|webp)(\?|$)", re.IGNORECASE)
OG_IMAGE_RE = re.compile(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', re.IGNORECASE)
# Seconds between external requests - this hits a lot of different sites in
# one run, but is still polite about hammering any single host repeatedly.
POLITE_DELAY = 1.0


def resolve_events(slugs: list[str]) -> list[dict]:
    """Unlike _common.resolve_events (which defaults to status='active' only),
    this backfill is a one-off pass over specific known events regardless of
    whether they're still active, so an empty slug list means "every event",
    not "every active event"."""
    if slugs:
        out = []
        for slug in slugs:
            rows = sb_get("events", {"select": "id,slug,name", "slug": f"eq.{slug}"})
            if not rows:
                print(f"! No event found with slug '{slug}' - skipping", file=sys.stderr)
                continue
            out.extend(rows)
        return out
    return sb_get("events", {"select": "id,slug,name"})


def youtube_thumbnail(url: str) -> str | None:
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    vid = None
    if "youtu.be" in host:
        vid = parsed.path.strip("/").split("/")[0] or None
    elif "youtube.com" in host:
        if parsed.path == "/watch":
            vid = (parse_qs(parsed.query).get("v") or [None])[0]
        elif parsed.path.startswith("/shorts/"):
            parts = parsed.path.split("/")
            vid = parts[2] if len(parts) > 2 else None
    if not vid:
        return None
    return f"https://img.youtube.com/vi/{vid}/hqdefault.jpg"


def og_image(url: str) -> str | None:
    try:
        html = requests.get(url, timeout=REQUEST_TIMEOUT, headers={"User-Agent": UA}).text
        m = OG_IMAGE_RE.search(html)
        return m.group(1) if m else None
    except Exception:  # noqa: BLE001
        return None


def validate_image(url: str) -> bool:
    """Downloads and confirms this really is a loadable image, not a 404
    page, a consent-wall placeholder, or a 1x1 tracking pixel."""
    try:
        r = requests.get(url, timeout=REQUEST_TIMEOUT, headers={"User-Agent": UA})
        r.raise_for_status()
        img = Image.open(io.BytesIO(r.content))
        img.verify()
        img = Image.open(io.BytesIO(r.content))  # verify() consumes the parser; reopen to read size
        return img.width >= 100 and img.height >= 100
    except Exception:  # noqa: BLE001
        return False


def find_image_for(url: str) -> str | None:
    """Returns a validated, loadable image URL discovered via `url`, trying
    (in order) a direct image link, a YouTube thumbnail, then a page's
    og:image - or None if nothing panned out."""
    if not url:
        return None
    if IMAGE_EXT_RE.search(url) and validate_image(url):
        return url
    yt = youtube_thumbnail(url)
    if yt and validate_image(yt):
        return yt
    og = og_image(url)
    if og and validate_image(og):
        return og
    return None


def candidate_links(record: dict) -> list[str]:
    links = []
    if record.get("source_url"):
        links.append(record["source_url"])
    attachments = sb_get("record_attachments", {
        "select": "source_url", "record_id": f"eq.{record['id']}",
        "source_url": "not.is.null", "order": "created_at.asc",
    })
    for a in attachments:
        if a["source_url"] and a["source_url"] not in links:
            links.append(a["source_url"])
    return links


def already_has_candidate(record_id: str) -> bool:
    rows = sb_get("record_attachments", {
        "select": "id", "record_id": f"eq.{record_id}", "added_by": f"eq.{ADDED_BY_TAG}",
    })
    return len(rows) > 0


def process_event(event: dict) -> None:
    records = sb_get("triage_records", {
        "select": "id,site_id,region,source_url",
        "event_id": f"eq.{event['id']}", "status": "eq.Approved",
        "merged_into": "is.null", "media_url": "is.null",
    })
    if not records:
        print(f"{event['slug']}: no verified sites missing a primary image.")
        return
    print(f"{event['slug']}: {len(records)} verified site(s) missing a primary image.")

    found = skipped = failed = 0
    for r in records:
        label = f"#{r.get('site_id') or r['id'][:8]} ({r.get('region') or 'no region'})"
        if already_has_candidate(r["id"]):
            print(f"  - {label}: already has a pending candidate, skipping")
            skipped += 1
            continue

        links = candidate_links(r)
        if not links:
            print(f"  - {label}: no source links to try")
            failed += 1
            continue

        image_url = winning_link = None
        for link in links:
            image_url = find_image_for(link)
            time.sleep(POLITE_DELAY)
            if image_url:
                winning_link = link
                break

        if not image_url:
            print(f"  - {label}: tried {len(links)} link(s), no image found")
            failed += 1
            continue

        sb_post("record_attachments", {
            "record_id": r["id"], "media_url": image_url, "source_url": winning_link,
            "added_by": ADDED_BY_TAG,
        })
        print(f"  + {label}: found via {winning_link}")
        found += 1

    print(f"{event['slug']}: {found} found, {skipped} already pending, {failed} not found.")


def main() -> int:
    require_env(LFE_SUPABASE_URL=SUPABASE_URL, LFE_SUPABASE_SERVICE_ROLE_KEY=SUPABASE_KEY)

    ap = argparse.ArgumentParser()
    ap.add_argument("--event-slug", action="append", default=[],
                     help="Repeatable, e.g. --event-slug CatiaLaMar-2026 --event-slug kumamoto-2026. Omit for every event.")
    args = ap.parse_args()

    for event in resolve_events(args.event_slug):
        process_event(event)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
