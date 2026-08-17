#!/usr/bin/env python3
"""
LFE platform - public snapshot exporter, event-parameterized.

Adapted from ../export_public.py (Kumamoto, single-event, untouched): writes
one JSON snapshot per public event (public/<slug>.json) instead of a single
hardcoded file, and additionally maintains public/events-index.json - a small
manifest of every is_public event - so the fully static, anonymous
/lfe/public/ page never has to query the database directly, mirroring how
Kumamoto's own public page works (plain fetch() of a static file, zero auth).

An event that is not (or no longer) public has its snapshot removed rather
than left stale - flipping is_public off should actually retract the data,
not just hide it from the manifest.

Env: LFE_SUPABASE_URL, LFE_SUPABASE_SERVICE_ROLE_KEY.

Usage:
    python export_public.py --event-slug japan-2026   # that event only
    python export_public.py                            # rebuild everything
"""

from __future__ import annotations

import argparse
import datetime
import json
import os

import requests

from _common import SUPABASE_URL, SUPABASE_KEY, sb_get, resolve_events, require_env

BUCKET = "lfe-observation-media"

REC_COLS = ("id,site_id,region,latitude,longitude,damage_score,observation_types,"
            "building_name,building_type,primary_material,height_class,code_era,address,location_confidence,"
            "failure_mechanism,nonstructural_damage,engineer_notes,media_url,streetview_url,source_url")


def upload_json(path: str, payload_obj: dict) -> None:
    payload = json.dumps(payload_obj).encode("utf-8")
    up = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
                 "Content-Type": "application/json", "x-upsert": "true"},
        data=payload, timeout=120,
    )
    if not up.ok:
        raise SystemExit(f"Upload failed [{up.status_code}]: {up.text[:300]}")


def delete_object(path: str) -> None:
    d = requests.delete(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        timeout=60,
    )
    if not d.ok and d.status_code != 404:
        print(f"  ! could not delete {path}: [{d.status_code}] {d.text[:200]}")


# Epicentre + characteristics, flattened onto one dict so the frontend's
# epicentreMetaOf() can read them the same way whether they came from this
# static export or live off events/event_meta in the authenticated workspace
# (see src/lib/useEvent.js). Included in both the per-event snapshot and the
# events-index manifest, so "All events" on the public map can plot every
# event's epicentre star, not just the currently-selected one.
def epicentre_fields(event: dict, meta: dict) -> dict:
    return {
        "epicentre_lat": event.get("epicentre_lat"),
        "epicentre_lng": event.get("epicentre_lng"),
        "usgs_event_id": event.get("usgs_event_id"),
        "location_name": meta.get("location_name"),
        "magnitude": meta.get("magnitude"),
        "depth": meta.get("depth"),
        "max_mmi": meta.get("max_mmi"),
        "faulting": meta.get("faulting"),
        "tsunami": meta.get("tsunami"),
    }


def export_event(event: dict) -> dict | None:
    slug = event["slug"]
    if not event.get("is_public"):
        delete_object(f"public/{slug}.json")
        print(f"  {slug}: not public, snapshot removed if present")
        return None

    event_id = event["id"]
    meta_rows = sb_get("event_meta", {"select": "*", "event_id": f"eq.{event_id}"})
    meta = meta_rows[0] if meta_rows else {}
    records = sb_get("triage_records", {"select": REC_COLS, "event_id": f"eq.{event_id}", "status": "eq.Approved", "merged_into": "is.null"})
    ids = [r["id"] for r in records]
    attachments: dict[str, list] = {}
    if ids:
        idlist = "(" + ",".join(ids) + ")"
        atts = sb_get("record_attachments", {"select": "record_id,media_url,source_url,file_url,file_name,note", "record_id": f"in.{idlist}"})
        for a in atts:
            attachments.setdefault(a["record_id"], []).append({
                "media_url": a.get("media_url"), "source_url": a.get("source_url"),
                "file_url": a.get("file_url"), "file_name": a.get("file_name"), "note": a.get("note"),
            })

    sites = []
    for r in records:
        sites.append({
            "site_id": r.get("site_id"), "region": r.get("region"),
            "lat": r.get("latitude"), "lng": r.get("longitude"),
            "damage_score": r.get("damage_score"), "observation_types": r.get("observation_types"),
            "building_name": r.get("building_name"), "building_type": r.get("building_type"),
            "address": r.get("address"), "location_confidence": r.get("location_confidence"),
            "primary_material": r.get("primary_material"), "height_class": r.get("height_class"),
            "code_era": r.get("code_era"), "failure_mechanism": r.get("failure_mechanism"),
            "nonstructural_damage": r.get("nonstructural_damage"), "engineer_notes": r.get("engineer_notes"),
            "media_url": r.get("media_url"), "streetview_url": r.get("streetview_url"),
            "source_url": r.get("source_url"), "attachments": attachments.get(r["id"], []),
        })

    payload = {
        "generatedAt": datetime.datetime.utcnow().isoformat() + "Z",
        "event": {
            "name": event.get("name") or slug,
            "country": event.get("country"),
            "event_datetime": event.get("event_datetime"),
            "mapCenter": event.get("map_center"),
            "basemap": event.get("basemap"),
            **epicentre_fields(event, meta),
        },
        "count": len(sites),
        "sites": sites,
    }
    print(f"  {slug}: uploading {len(sites)} site(s)...")
    upload_json(f"public/{slug}.json", payload)
    return {
        "slug": slug,
        "name": event.get("name") or slug,
        "country": event.get("country"),
        "event_datetime": event.get("event_datetime"),
        **epicentre_fields(event, meta),
    }


def main() -> int:
    require_env(LFE_SUPABASE_URL=SUPABASE_URL, LFE_SUPABASE_SERVICE_ROLE_KEY=SUPABASE_KEY)

    ap = argparse.ArgumentParser()
    ap.add_argument("--event-slug", default=os.environ.get("EVENT_SLUG") or None)
    args = ap.parse_args()

    if args.event_slug:
        events = resolve_events(args.event_slug)
    else:
        # The manifest must reflect every is_public event regardless of
        # draft/active/archived status (an archived-but-public event should
        # stay visible), so a full run looks at every event, not just active
        # ones - resolve_events() with no slug would filter to active only.
        events = sb_get("events", {"select": "*"})

    index_entries = []
    for event in events:
        entry = export_event(event)
        if entry:
            index_entries.append(entry)

    if not args.event_slug:
        print(f"Writing events index ({len(index_entries)} public event(s))...")
        upload_json("public/events-index.json", {
            "generatedAt": datetime.datetime.utcnow().isoformat() + "Z",
            "events": index_entries,
        })

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
