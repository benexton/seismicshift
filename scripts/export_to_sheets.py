#!/usr/bin/env python3
"""
Backup mirror: export Supabase into a Google Sheet with three tabs:

    "Manual observations"  - every manually-entered record (source_type = human)
    "Verified sites"       - every approved record (status = Approved)
    "Attachments"          - every extra image, file, link, and note, keyed by
                             Site number (so multiple items per record are all
                             captured, one per row)

Full refresh each run (idempotent). Merged-away records and their attachments
are excluded. Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GSHEET_ID,
GOOGLE_SERVICE_ACCOUNT_JSON.
"""

from __future__ import annotations
import json, os, sys
import requests

try:
    import gspread
    from google.oauth2.service_account import Credentials
except ImportError:
    print("Install: pip install -r scripts/requirements-sheets.txt", file=sys.stderr)
    raise

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
GSHEET_ID = os.environ.get("GSHEET_ID", "")
SA_JSON = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")

COLUMNS = [
    "site_id", "id", "created_at", "source_type", "observation_type", "status",
    "region", "latitude", "longitude", "location_precision",
    "damage_score", "nonstructural_damage", "code_era", "failure_mechanism",
    "observed_retrofits", "building_name", "building_type", "primary_material",
    "height_class", "address", "location_confidence",
    "engineer_notes", "submitted_by", "reviewed_by", "reviewed_at",
    "ai_model", "ai_confidence", "streetview_url", "source_url", "media_url",
]

ATT_COLUMNS = ["site_id", "kind", "url", "file_name", "note", "added_by", "created_at"]


def fetch(table: str, select: str, params: dict) -> list[dict]:
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        params={"select": select, **params}, timeout=60,
    )
    r.raise_for_status()
    return r.json()


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
        out.append([("" if rec.get(c) is None else rec.get(c)) for c in COLUMNS])
    return out


def attachment_kind(a: dict) -> tuple[str, str]:
    if a.get("media_url"): return "image", a["media_url"]
    if a.get("file_url"): return "file", a["file_url"]
    if a.get("source_url"): return "link", a["source_url"]
    return "note", ""


def main() -> int:
    missing = [k for k, v in {
        "SUPABASE_URL": SUPABASE_URL, "SUPABASE_SERVICE_ROLE_KEY": SUPABASE_KEY,
        "GSHEET_ID": GSHEET_ID, "GOOGLE_SERVICE_ACCOUNT_JSON": SA_JSON,
    }.items() if not v]
    if missing:
        print(f"Missing env: {', '.join(missing)}", file=sys.stderr)
        return 1

    creds = Credentials.from_service_account_info(json.loads(SA_JSON), scopes=["https://www.googleapis.com/auth/spreadsheets"])
    sh = gspread.authorize(creds).open_by_key(GSHEET_ID)

    print("Exporting manual observations...")
    manual = fetch("triage_records", ",".join(COLUMNS), {"source_type": "eq.human", "merged_into": "is.null", "order": "created_at.desc"})
    write_grid(sh, "Manual observations", records_grid(manual))

    print("Exporting verified sites...")
    verified = fetch("triage_records", ",".join(COLUMNS), {"status": "eq.Approved", "merged_into": "is.null", "order": "created_at.desc"})
    write_grid(sh, "Verified sites", records_grid(verified))

    print("Exporting attachments...")
    live = fetch("triage_records", "id,site_id", {"merged_into": "is.null"})
    id2site = {r["id"]: r["site_id"] for r in live}
    atts = fetch("record_attachments", "record_id,media_url,file_url,file_name,source_url,note,added_by,created_at", {"order": "created_at.asc"})
    grid = [ATT_COLUMNS]
    for a in atts:
        site = id2site.get(a.get("record_id"))
        if site is None:
            continue  # attachment of a merged-away or removed record
        kind, url = attachment_kind(a)
        grid.append([site, kind, url, a.get("file_name") or "", a.get("note") or "", a.get("added_by") or "", a.get("created_at") or ""])
    write_grid(sh, "Attachments", grid)

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
