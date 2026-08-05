#!/usr/bin/env python3
"""
LFE platform - Google Sheets backup, event-parameterized, one sheet per event.

Adapted from ../export_to_sheets.py (Kumamoto, single-event, untouched): that
script points at one hardcoded GSHEET_ID; this one creates a spreadsheet the
first time it runs for a given event (via the Sheets/Drive API) and stores
the resulting id back on events.gsheet_id, reusing it on every later run.
Same three tabs as Kumamoto's, scoped to that event's own records.

The auto-created sheet is shared as "anyone with the link can view" rather
than with a specific person, since there's no single human owner to assign
at creation time - the same "accept it for now" tradeoff already made for
the LFE media bucket this round.

Env: LFE_SUPABASE_URL, LFE_SUPABASE_SERVICE_ROLE_KEY, GOOGLE_SERVICE_ACCOUNT_JSON.

Usage:
    python export_to_sheets.py --event-slug japan-2026
    python export_to_sheets.py               # every status='active' event
"""

from __future__ import annotations

import argparse
import json
import os
import sys

try:
    import gspread
    from google.oauth2.service_account import Credentials
except ImportError:
    print("Install: pip install -r scripts/requirements-sheets.txt", file=sys.stderr)
    raise

from _common import SUPABASE_URL, SUPABASE_KEY, sb_get, sb_patch, resolve_events, require_env

SA_JSON = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")

COLUMNS = [
    "site_id", "id", "created_at", "source_type", "observation_types", "status",
    "region", "latitude", "longitude", "location_precision",
    "damage_score", "nonstructural_damage", "code_era", "failure_mechanism",
    "observed_retrofits", "building_name", "building_type", "primary_material",
    "height_class", "address", "location_confidence",
    "engineer_notes", "submitted_by", "reviewed_by", "reviewed_at",
    "ai_model", "ai_confidence", "streetview_url", "source_url", "media_url",
]

ATT_COLUMNS = ["site_id", "kind", "url", "file_name", "note", "added_by", "created_at"]


def write_grid(sh, title: str, values: list[list]) -> None:
    try:
        ws = sh.worksheet(title); ws.clear()
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet(title=title, rows=max(len(values) + 10, 20), cols=max(len(values[0]), 5))
    ws.update(range_name="A1", values=values)
    ws.freeze(rows=1)
    print(f"  wrote {len(values) - 1} row(s) to '{title}'")


def records_grid(records: list[dict]) -> list[list]:
    out = [COLUMNS]
    for rec in records:
        row = []
        for c in COLUMNS:
            v = rec.get(c)
            if c == "observation_types" and isinstance(v, list):
                v = ", ".join(v)
            row.append("" if v is None else v)
        out.append(row)
    return out


def attachment_kind(a: dict) -> tuple[str, str]:
    if a.get("media_url"): return "image", a["media_url"]
    if a.get("file_url"): return "file", a["file_url"]
    if a.get("source_url"): return "link", a["source_url"]
    return "note", ""


def get_or_create_sheet(gc, event: dict):
    if event.get("gsheet_id"):
        return gc.open_by_key(event["gsheet_id"])
    title = f"LFE - {event.get('name') or event['slug']}"
    sh = gc.create(title)
    sh.share(None, perm_type="anyone", role="reader")
    sb_patch("events", {"id": f"eq.{event['id']}"}, {"gsheet_id": sh.id})
    print(f"  created new sheet '{title}' ({sh.id})")
    return sh


def export_event(gc, event: dict) -> None:
    event_id = event["id"]
    print(f"=== {event.get('name') or event['slug']} ===")
    sh = get_or_create_sheet(gc, event)

    print("Exporting manual observations...")
    manual = sb_get("triage_records", {"select": ",".join(COLUMNS), "event_id": f"eq.{event_id}", "source_type": "eq.human", "merged_into": "is.null", "order": "created_at.desc"})
    write_grid(sh, "Manual observations", records_grid(manual))

    print("Exporting verified sites...")
    verified = sb_get("triage_records", {"select": ",".join(COLUMNS), "event_id": f"eq.{event_id}", "status": "eq.Approved", "merged_into": "is.null", "order": "created_at.desc"})
    write_grid(sh, "Verified sites", records_grid(verified))

    print("Exporting attachments...")
    live = sb_get("triage_records", {"select": "id,site_id", "event_id": f"eq.{event_id}", "merged_into": "is.null"})
    id2site = {r["id"]: r["site_id"] for r in live}
    grid = [ATT_COLUMNS]
    if id2site:
        idlist = "(" + ",".join(id2site.keys()) + ")"
        atts = sb_get("record_attachments", {"select": "record_id,media_url,file_url,file_name,source_url,note,added_by,created_at", "record_id": f"in.{idlist}", "order": "created_at.asc"})
        for a in atts:
            site = id2site.get(a.get("record_id"))
            if site is None:
                continue
            kind, url = attachment_kind(a)
            grid.append([site, kind, url, a.get("file_name") or "", a.get("note") or "", a.get("added_by") or "", a.get("created_at") or ""])
    write_grid(sh, "Attachments", grid)


def main() -> int:
    require_env(LFE_SUPABASE_URL=SUPABASE_URL, LFE_SUPABASE_SERVICE_ROLE_KEY=SUPABASE_KEY, GOOGLE_SERVICE_ACCOUNT_JSON=SA_JSON)

    ap = argparse.ArgumentParser()
    ap.add_argument("--event-slug", default=os.environ.get("EVENT_SLUG") or None)
    args = ap.parse_args()

    creds = Credentials.from_service_account_info(json.loads(SA_JSON), scopes=[
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ])
    gc = gspread.authorize(creds)

    for event in resolve_events(args.event_slug):
        export_event(gc, event)

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
