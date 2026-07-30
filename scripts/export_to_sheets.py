#!/usr/bin/env python3
"""
Backup mirror: export Supabase triage_records into a Google Sheet, two tabs:

    "Manual observations"  - every manually-entered record (source_type = human)
    "Verified sites"       - every approved record (status = Approved)

This is a full refresh each run (idempotent): the sheet always mirrors the
current database rather than appending, so edits and corrections stay accurate
and re-runs never create duplicates.

Env vars (GitHub Actions secrets):
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
    GSHEET_ID                     - the target spreadsheet's ID (from its URL)
    GOOGLE_SERVICE_ACCOUNT_JSON   - the full service-account key JSON (as a secret)
"""

from __future__ import annotations

import json
import os
import sys

import requests

try:
    import gspread
    from google.oauth2.service_account import Credentials
except ImportError:  # pragma: no cover
    print("Install: pip install -r scripts/requirements-sheets.txt", file=sys.stderr)
    raise

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
GSHEET_ID = os.environ.get("GSHEET_ID", "")
SA_JSON = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")

# Columns exported, in order. (Never the raw geom; lat/long are the generated cols.)
COLUMNS = [
    "site_id", "id", "created_at", "source_type", "observation_type", "status",
    "region", "latitude", "longitude", "location_precision",
    "damage_score", "code_era", "failure_mechanism", "observed_retrofits",
    "engineer_notes", "submitted_by", "reviewed_by", "reviewed_at",
    "ai_model", "ai_confidence", "source_url", "media_url",
]


def fetch(params: dict) -> list[dict]:
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/triage_records",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        params={"select": ",".join(COLUMNS), **params},
        timeout=60,
    )
    r.raise_for_status()
    return r.json()


def to_rows(records: list[dict]) -> list[list]:
    rows = [COLUMNS]
    for rec in records:
        rows.append([("" if rec.get(c) is None else rec.get(c)) for c in COLUMNS])
    return rows


def write_tab(sh, title: str, records: list[dict]) -> None:
    rows = to_rows(records)
    try:
        ws = sh.worksheet(title)
        ws.clear()
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet(title=title, rows=max(len(rows) + 10, 20), cols=len(COLUMNS))
    ws.update(range_name="A1", values=rows)
    ws.freeze(rows=1)
    print(f"  wrote {len(records)} row(s) to '{title}'")


def main() -> int:
    missing = [k for k, v in {
        "SUPABASE_URL": SUPABASE_URL, "SUPABASE_SERVICE_ROLE_KEY": SUPABASE_KEY,
        "GSHEET_ID": GSHEET_ID, "GOOGLE_SERVICE_ACCOUNT_JSON": SA_JSON,
    }.items() if not v]
    if missing:
        print(f"Missing env: {', '.join(missing)}", file=sys.stderr)
        return 1

    creds = Credentials.from_service_account_info(
        json.loads(SA_JSON),
        scopes=["https://www.googleapis.com/auth/spreadsheets"],
    )
    sh = gspread.authorize(creds).open_by_key(GSHEET_ID)

    print("Exporting manual observations...")
    manual = fetch({"source_type": "eq.human", "order": "created_at.desc"})
    write_tab(sh, "Manual observations", manual)

    print("Exporting verified sites...")
    verified = fetch({"status": "eq.Approved", "order": "created_at.desc"})
    write_tab(sh, "Verified sites", verified)

    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
