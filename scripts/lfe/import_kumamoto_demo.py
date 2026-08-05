#!/usr/bin/env python3
"""
One-time, READ-ONLY-on-Kumamoto import: copies Kumamoto's existing
triage_records, record_attachments, and event_meta into a brand-new event in
the separate LFE Supabase project. Never writes to Kumamoto - only reads,
using either its service-role key or an existing triager/admin login
(Kumamoto's RLS only allows authenticated reads, so an anon key alone
cannot see this data).

Every photo/file is downloaded from Kumamoto's storage and re-uploaded into
the LFE project's own bucket, so the imported copy does not depend on
Kumamoto's project staying online. Original site numbers ("Site #NNN") are
preserved, since they already match references in the existing published
report.

The new event is created in 'draft' status and not public - review it at
/lfe/admin/ before flipping either of those on.

Env vars:
    Reading from Kumamoto (read-only, never written to):
        KUMAMOTO_SUPABASE_URL, KUMAMOTO_SUPABASE_ANON_KEY - or, if not set,
        falls back to the app's existing PUBLIC_SUPABASE_URL/
        PUBLIC_SUPABASE_ANON_KEY (same values, no need to duplicate them)
        Either KUMAMOTO_SERVICE_ROLE_KEY, or KUMAMOTO_EMAIL + KUMAMOTO_PASSWORD
        (an existing triager/admin login)
    Writing to the new LFE project:
        LFE_SUPABASE_URL, LFE_SUPABASE_SERVICE_ROLE_KEY
        LFE_ADMIN_USER_ID - an existing platform_admin's auth.users id, used
        as the new event's created_by so the usual bootstrap trigger
        (0016_events_bootstrap_trigger.sql) creates its event_meta row and
        gives that admin an event_members row automatically.

Usage:
    python scripts/lfe/import_kumamoto_demo.py --slug kumamoto-2026-demo
    python scripts/lfe/import_kumamoto_demo.py --limit 5   # test with a few records first
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from datetime import datetime

import requests

REQUEST_TIMEOUT = 60
LFE_BUCKET = "lfe-observation-media"

# Falls back to the same PUBLIC_SUPABASE_* vars the Astro app already uses
# for Kumamoto, so there's no need to duplicate them under a new name.
KUMAMOTO_URL = (os.environ.get("KUMAMOTO_SUPABASE_URL") or os.environ.get("PUBLIC_SUPABASE_URL") or "").rstrip("/")
KUMAMOTO_ANON_KEY = os.environ.get("KUMAMOTO_SUPABASE_ANON_KEY") or os.environ.get("PUBLIC_SUPABASE_ANON_KEY") or ""
KUMAMOTO_SERVICE_ROLE_KEY = os.environ.get("KUMAMOTO_SERVICE_ROLE_KEY", "")
KUMAMOTO_EMAIL = os.environ.get("KUMAMOTO_EMAIL", "")
KUMAMOTO_PASSWORD = os.environ.get("KUMAMOTO_PASSWORD", "")

LFE_URL = os.environ.get("LFE_SUPABASE_URL", "").rstrip("/")
LFE_SERVICE_ROLE_KEY = os.environ.get("LFE_SUPABASE_SERVICE_ROLE_KEY", "")
LFE_ADMIN_USER_ID = os.environ.get("LFE_ADMIN_USER_ID", "")


def require_env() -> None:
    missing = []
    if not KUMAMOTO_URL:
        missing.append("KUMAMOTO_SUPABASE_URL (or PUBLIC_SUPABASE_URL)")
    if not KUMAMOTO_ANON_KEY:
        missing.append("KUMAMOTO_SUPABASE_ANON_KEY (or PUBLIC_SUPABASE_ANON_KEY)")
    if not (KUMAMOTO_SERVICE_ROLE_KEY or (KUMAMOTO_EMAIL and KUMAMOTO_PASSWORD)):
        missing.append("KUMAMOTO_SERVICE_ROLE_KEY or KUMAMOTO_EMAIL+KUMAMOTO_PASSWORD")
    if not LFE_URL:
        missing.append("LFE_SUPABASE_URL")
    if not LFE_SERVICE_ROLE_KEY:
        missing.append("LFE_SUPABASE_SERVICE_ROLE_KEY")
    if not LFE_ADMIN_USER_ID:
        missing.append("LFE_ADMIN_USER_ID")
    if missing:
        print(f"Missing env: {', '.join(missing)}", file=sys.stderr)
        raise SystemExit(1)


# --- Kumamoto (read-only) ----------------------------------------------------
_kumamoto_token: str | None = None


def kumamoto_auth_header() -> dict:
    global _kumamoto_token
    if KUMAMOTO_SERVICE_ROLE_KEY:
        return {"apikey": KUMAMOTO_SERVICE_ROLE_KEY, "Authorization": f"Bearer {KUMAMOTO_SERVICE_ROLE_KEY}"}
    if _kumamoto_token is None:
        r = requests.post(
            f"{KUMAMOTO_URL}/auth/v1/token?grant_type=password",
            headers={"apikey": KUMAMOTO_ANON_KEY, "Content-Type": "application/json"},
            json={"email": KUMAMOTO_EMAIL, "password": KUMAMOTO_PASSWORD},
            timeout=REQUEST_TIMEOUT,
        )
        if not r.ok:
            raise SystemExit(f"Kumamoto sign-in failed [{r.status_code}]: {r.text[:300]}")
        _kumamoto_token = r.json()["access_token"]
    return {"apikey": KUMAMOTO_ANON_KEY, "Authorization": f"Bearer {_kumamoto_token}"}


def _extract_number(raw, field: str) -> float | None:
    if raw is None or raw == "":
        return None
    if isinstance(raw, (int, float)):
        return raw
    m = re.search(r"-?\d+(?:\.\d+)?", str(raw))
    if not m:
        print(f"  ! Kumamoto's {field} ('{raw}') has no numeric value - leaving it blank, set it manually in /lfe/admin/ afterward.")
        return None
    if m.group(0) != str(raw).strip():
        print(f"  ! Kumamoto's {field} ('{raw}') isn't purely numeric - using extracted value {m.group(0)}, double check it in /lfe/admin/ afterward.")
    return float(m.group(0))


def _valid_timestamp(raw) -> str | None:
    if not raw:
        return None
    try:
        datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        return raw
    except ValueError:
        return None


def kumamoto_get(path: str, params: dict) -> list[dict]:
    r = requests.get(f"{KUMAMOTO_URL}/rest/v1/{path}", headers=kumamoto_auth_header(), params=params, timeout=REQUEST_TIMEOUT)
    if not r.ok:
        raise SystemExit(f"Kumamoto GET {path} failed [{r.status_code}]: {r.text[:300]}")
    return r.json()


# --- LFE (write) --------------------------------------------------------------
def lfe_headers(extra: dict | None = None) -> dict:
    h = {"apikey": LFE_SERVICE_ROLE_KEY, "Authorization": f"Bearer {LFE_SERVICE_ROLE_KEY}", "Content-Type": "application/json"}
    if extra:
        h.update(extra)
    return h


def lfe_post(path: str, body: dict, return_row: bool = False):
    headers = lfe_headers({"Prefer": "return=representation"} if return_row else None)
    r = requests.post(f"{LFE_URL}/rest/v1/{path}", headers=headers, json=body, timeout=REQUEST_TIMEOUT)
    if not r.ok:
        raise SystemExit(f"LFE POST {path} failed [{r.status_code}]: {r.text[:300]}")
    return r.json() if return_row else None


def lfe_patch(path: str, params: dict, body: dict) -> None:
    r = requests.patch(f"{LFE_URL}/rest/v1/{path}", headers=lfe_headers(), params=params, json=body, timeout=REQUEST_TIMEOUT)
    if not r.ok:
        raise SystemExit(f"LFE PATCH {path} failed [{r.status_code}]: {r.text[:300]}")


def lfe_rpc(name: str, payload: dict):
    r = requests.post(f"{LFE_URL}/rest/v1/rpc/{name}", headers=lfe_headers(), json=payload, timeout=REQUEST_TIMEOUT)
    if not r.ok:
        raise SystemExit(f"LFE RPC {name} failed [{r.status_code}]: {r.text[:300]}")
    return r.json() if r.text else None


def lfe_upload(path: str, content: bytes, content_type: str) -> str:
    r = requests.post(
        f"{LFE_URL}/storage/v1/object/{LFE_BUCKET}/{path}",
        headers={"apikey": LFE_SERVICE_ROLE_KEY, "Authorization": f"Bearer {LFE_SERVICE_ROLE_KEY}",
                 "Content-Type": content_type, "x-upsert": "true"},
        data=content, timeout=120,
    )
    if not r.ok:
        raise SystemExit(f"LFE upload {path} failed [{r.status_code}]: {r.text[:300]}")
    return f"{LFE_URL}/storage/v1/object/public/{LFE_BUCKET}/{path}"


def reupload(url: str | None, prefix: str) -> str | None:
    """Download a Kumamoto media URL and re-upload it into the LFE bucket, so
    the imported copy doesn't depend on Kumamoto's project staying online."""
    if not url:
        return None
    try:
        r = requests.get(url, timeout=REQUEST_TIMEOUT)
        if not r.ok:
            print(f"  ! could not download {url}: [{r.status_code}]")
            return None
    except Exception as exc:  # noqa: BLE001
        print(f"  ! could not download {url}: {exc}")
        return None
    name = url.split("/")[-1].split("?")[0] or "file"
    safe = "".join(c if c.isalnum() or c in "._-" else "_" for c in name)
    path = f"{prefix}{int(time.time() * 1000)}_{safe}"
    content_type = r.headers.get("Content-Type") or "application/octet-stream"
    return lfe_upload(path, r.content, content_type)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", default="kumamoto-2026-demo")
    ap.add_argument("--name", default=None)
    ap.add_argument("--limit", type=int, default=None, help="import only the first N records (for a test run)")
    args = ap.parse_args()

    require_env()

    print("Reading Kumamoto event_meta...")
    meta_rows = kumamoto_get("event_meta", {"select": "*", "id": "eq.1"})
    kmeta = meta_rows[0] if meta_rows else {}

    name = args.name or kmeta.get("event_name") or "Kumamoto 2026 (imported)"
    event_datetime = _valid_timestamp(kmeta.get("event_datetime"))
    if kmeta.get("event_datetime") and not event_datetime:
        print(f"  ! Kumamoto's event_datetime ('{kmeta.get('event_datetime')}') isn't a valid timestamp - leaving it blank, set it manually in /lfe/admin/ afterward.")

    print(f"Creating LFE event '{name}' (slug={args.slug})...")
    basemap = {
        "gsi_photo": {
            "label": "GSI Aerial (Japan)",
            "url": "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
            "attribution": '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">GSI Japan</a>',
        }
    }
    created = lfe_post("events", {
        "slug": args.slug,
        "name": name,
        "country": "Japan",
        "country_code": "JP",
        "event_datetime": event_datetime,
        "epicentre_lat": 32.79,
        "epicentre_lng": 130.74,
        "languages": ["ja", "en"],
        "basemap": basemap,
        "map_center": {"lat": 32.79, "lng": 130.74, "zoom": 11},
        "keyword_sets": {"en": ["earthquake", "collapse", "damage"], "ja": ["地震", "倒壊", "被害"]},
        "status": "draft",
        "is_public": False,
        "created_by": LFE_ADMIN_USER_ID,
    }, return_row=True)
    event_id = created[0]["id"]
    print(f"  created event {event_id}")

    if kmeta:
        print("Updating event_meta with imported characteristics...")
        lfe_patch("event_meta", {"event_id": f"eq.{event_id}"}, {
            "version": kmeta.get("version"),
            "location_name": kmeta.get("location_name"),
            "magnitude": _extract_number(kmeta.get("magnitude"), "magnitude"),
            "depth": _extract_number(kmeta.get("depth"), "depth"),
            "max_mmi": kmeta.get("max_mmi"),
            "faulting": kmeta.get("faulting"),
            "tsunami": kmeta.get("tsunami"),
            "contributors": kmeta.get("contributors"),
            "conclusions_md": kmeta.get("conclusions_md"),
            "report_generated_at": kmeta.get("report_generated_at"),
            "report_generated_by": kmeta.get("report_generated_by"),
        })

    print("Reading Kumamoto triage_records (all statuses)...")
    records = kumamoto_get("triage_records", {"select": "*", "order": "site_id.asc.nullslast"})
    if args.limit:
        records = records[:args.limit]
    print(f"  {len(records)} record(s) to import")

    print("Reading Kumamoto record_attachments...")
    attachments = kumamoto_get("record_attachments", {"select": "*"})
    atts_by_record: dict[str, list[dict]] = {}
    for a in attachments:
        atts_by_record.setdefault(a["record_id"], []).append(a)
    print(f"  {len(attachments)} attachment(s) total")

    id_map: dict[str, str] = {}
    pending_merges: list[tuple[str, str]] = []
    max_site_id = 0

    print("Importing records...")
    for i, rec in enumerate(records, 1):
        if rec.get("latitude") is None or rec.get("longitude") is None:
            print(f"  - skipping {rec.get('id')} (no coordinates)")
            continue

        media_url = reupload(rec.get("media_url"), f"imported/{rec['id']}/")
        streetview_url = reupload(rec.get("streetview_url"), f"imported/{rec['id']}/")

        new_id = lfe_rpc("import_triage_record", {
            "p_event_id": event_id,
            "p_site_id": rec.get("site_id"),
            "p_lng": rec["longitude"],
            "p_lat": rec["latitude"],
            "p_created_at": rec.get("created_at"),
            "p_source_type": rec.get("source_type") or "human",
            "p_submitted_by": rec.get("submitted_by"),
            "p_external_id": rec.get("external_id"),
            "p_source_url": rec.get("source_url"),
            "p_media_url": media_url,
            "p_phash": rec.get("phash"),
            "p_streetview_url": streetview_url,
            "p_location_precision": rec.get("location_precision") or "exact",
            "p_location_confidence": rec.get("location_confidence"),
            "p_region": rec.get("region"),
            "p_address": rec.get("address"),
            "p_observation_types": [rec.get("observation_type") or "building"],
            "p_damage_score": rec.get("damage_score"),
            "p_nonstructural_damage": bool(rec.get("nonstructural_damage")),
            "p_building_name": rec.get("building_name"),
            "p_building_type": rec.get("building_type"),
            "p_primary_material": rec.get("primary_material"),
            "p_height_class": rec.get("height_class"),
            "p_code_era": rec.get("code_era"),
            "p_failure_mechanism": rec.get("failure_mechanism"),
            "p_observed_retrofits": rec.get("observed_retrofits"),
            "p_ai_confidence": rec.get("ai_confidence"),
            "p_ai_model": rec.get("ai_model"),
            "p_status": rec.get("status") or "Approved",
            "p_engineer_notes": rec.get("engineer_notes"),
            "p_reviewed_by": rec.get("reviewed_by"),
            "p_reviewed_at": rec.get("reviewed_at"),
        })

        id_map[rec["id"]] = new_id
        if rec.get("site_id"):
            max_site_id = max(max_site_id, rec["site_id"])
        if rec.get("merged_into"):
            pending_merges.append((new_id, rec["merged_into"]))

        for att in atts_by_record.get(rec["id"], []):
            lfe_post("record_attachments", {
                "record_id": new_id,
                "media_url": reupload(att.get("media_url"), f"imported/{rec['id']}/att/"),
                "source_url": att.get("source_url"),
                "file_url": reupload(att.get("file_url"), f"imported/{rec['id']}/att/"),
                "file_name": att.get("file_name"),
                "note": att.get("note"),
                "added_by": att.get("added_by"),
            })

        if i % 10 == 0 or i == len(records):
            print(f"  {i}/{len(records)} imported")

    print("Fixing up merge references...")
    for new_id, old_merged_into in pending_merges:
        target = id_map.get(old_merged_into)
        if target:
            lfe_rpc("import_set_merged_into", {"p_id": new_id, "p_merged_into": target})
        else:
            print(f"  ! merge target {old_merged_into} was not imported; leaving {new_id} unmerged")

    if max_site_id:
        print(f"Seeding site-number counter to continue after #{max_site_id}...")
        lfe_rpc("import_seed_site_counter", {"p_event_id": event_id, "p_next_number": max_site_id + 1})

    print(f"Done. Imported {len(id_map)} of {len(records)} record(s) into event '{args.slug}' ({event_id}).")
    print("Created in 'draft' status, not public - review at /lfe/admin/ before activating.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
