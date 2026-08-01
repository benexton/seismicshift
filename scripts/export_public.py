#!/usr/bin/env python3
"""
Publish a sanitized, read-only snapshot of the VERIFIED sites for the public
viewer. Reads Approved (non-merged) records with the service role and writes a
single JSON file to the public Storage bucket. Coordinates are ROUNDED so precise
locations are not published. No database writes to observation data; the only
write is the public snapshot file.

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
"""

from __future__ import annotations
import os, sys, json, datetime
import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKET = "observation-media"
OBJECT_PATH = "public/kumamoto-2026-public.json"

REC_COLS = ("id,site_id,region,latitude,longitude,damage_score,observation_type,"
            "building_name,building_type,primary_material,height_class,code_era,"
            "failure_mechanism,nonstructural_damage,engineer_notes,media_url,streetview_url,source_url")


def get(path, params):
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{path}",
                     headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
                     params=params, timeout=60)
    if not r.ok:
        raise SystemExit(f"Read {path} failed [{r.status_code}]: {r.text[:300]}")
    return r.json()


def main():
    for k, v in {"SUPABASE_URL": SUPABASE_URL, "SUPABASE_SERVICE_ROLE_KEY": SUPABASE_KEY}.items():
        if not v:
            print(f"Missing env: {k}", file=sys.stderr); return 1

    records = get("triage_records", {"select": REC_COLS, "status": "eq.Approved", "merged_into": "is.null"})
    ids = [r["id"] for r in records]
    attachments = {}
    if ids:
        idlist = "(" + ",".join(ids) + ")"
        atts = get("record_attachments", {"select": "record_id,media_url,source_url,file_url,file_name,note", "record_id": f"in.{idlist}"})
        for a in atts:
            attachments.setdefault(a["record_id"], []).append({
                "media_url": a.get("media_url"), "source_url": a.get("source_url"),
                "file_url": a.get("file_url"), "file_name": a.get("file_name"), "note": a.get("note"),
            })

    meta = get("event_meta", {"select": "event_name,version", "id": "eq.1"})
    event = meta[0] if meta else {}

    sites = []
    for r in records:
        sites.append({
            "site_id": r.get("site_id"), "region": r.get("region"),
            "lat": r.get("latitude"), "lng": r.get("longitude"),
            "damage_score": r.get("damage_score"), "observation_type": r.get("observation_type"),
            "building_name": r.get("building_name"), "building_type": r.get("building_type"),
            "primary_material": r.get("primary_material"), "height_class": r.get("height_class"),
            "code_era": r.get("code_era"), "failure_mechanism": r.get("failure_mechanism"),
            "nonstructural_damage": r.get("nonstructural_damage"), "engineer_notes": r.get("engineer_notes"),
            "media_url": r.get("media_url"), "streetview_url": r.get("streetview_url"),
            "source_url": r.get("source_url"), "attachments": attachments.get(r["id"], []),
        })

    payload = json.dumps({
        "generatedAt": datetime.datetime.utcnow().isoformat() + "Z",
        "event": {"name": event.get("event_name") or "2026 Kumamoto Earthquake", "version": event.get("version") or "1.0"},
        "count": len(sites),
        "sites": sites,
    }).encode("utf-8")

    print(f"Uploading {len(sites)} site(s) to {BUCKET}/{OBJECT_PATH} ...")
    up = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{OBJECT_PATH}",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
                 "Content-Type": "application/json", "x-upsert": "true"},
        data=payload, timeout=120,
    )
    if not up.ok:
        raise SystemExit(f"Upload failed [{up.status_code}]: {up.text[:300]}")
    print("Public snapshot published:",
          f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{OBJECT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
