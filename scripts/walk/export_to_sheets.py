#!/usr/bin/env python3
"""
Seismic Walk - Google Sheets backup of the walk_buildings Supabase table.

Single hardcoded sheet (WALK_GSHEET_ID), single "buildings" tab - simpler
than scripts/lfe/export_to_sheets.py's per-event version since there's only
ever one Walk tour. Exists so an accidental bad edit or wipe in /walkadmin/
has a same-day recovery source, independent of the nightly
walk_sync_and_deploy.yml sync (which also refuses to write an empty result -
see scripts/sync-buildings-from-supabase.mjs - but this is a second,
independent line of defence, plus a human-readable audit trail).

The sheet must be created manually: a human creates a blank Google Sheet
under their own real Google account, shares it with the service account's
email (Editor access), and sets its id as the WALK_GSHEET_ID repo secret. A
bare Google Cloud service account has no Drive storage quota of its own, so
it cannot create new spreadsheets - it can only read/write ones a real
account already owns and shared with it.

Env: WALK_SUPABASE_URL, WALK_SUPABASE_SERVICE_ROLE_KEY,
     GOOGLE_SERVICE_ACCOUNT_JSON, WALK_GSHEET_ID.

Usage:
    python scripts/walk/export_to_sheets.py
"""

from __future__ import annotations

import json
import os
import sys

try:
    import gspread
    import requests
    from google.oauth2.service_account import Credentials
except ImportError:
    print("Install: pip install -r scripts/requirements-sheets.txt", file=sys.stderr)
    raise

SUPABASE_URL = os.environ.get("WALK_SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("WALK_SUPABASE_SERVICE_ROLE_KEY", "")
SA_JSON = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "")
GSHEET_ID = os.environ.get("WALK_GSHEET_ID", "")

COLUMNS = [
    "id", "name", "name_mi", "address", "lat", "lng", "access_level", "access_notes",
    "year_built", "year_retrofit", "structural_tags", "summary", "story", "engineer",
    "architect", "storeys", "step_free", "image", "image_credit", "external_url",
    "category", "featured", "sort_order", "updated_at",
]


def require_env(**kv) -> None:
    missing = [k for k, v in kv.items() if not v]
    if missing:
        print(f"Missing env: {', '.join(missing)}", file=sys.stderr)
        raise SystemExit(1)


def fetch_buildings() -> list[dict]:
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/walk_buildings",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        params={"select": "*", "order": "sort_order.asc,name.asc"},
        timeout=60,
    )
    if not r.ok:
        raise SystemExit(f"GET walk_buildings failed [{r.status_code}]: {r.text[:300]}")
    return r.json()


def buildings_grid(rows: list[dict]) -> list[list]:
    out = [COLUMNS]
    for row in rows:
        line = []
        for c in COLUMNS:
            v = row.get(c)
            if c == "structural_tags" and isinstance(v, list):
                v = "; ".join(v)
            line.append("" if v is None else v)
        out.append(line)
    return out


def write_grid(sh, title: str, values: list[list]) -> None:
    try:
        ws = sh.worksheet(title)
        ws.clear()
    except gspread.WorksheetNotFound:
        ws = sh.add_worksheet(title=title, rows=max(len(values) + 10, 20), cols=max(len(values[0]), 5))
    ws.update(range_name="A1", values=values)
    ws.freeze(rows=1)
    print(f"  wrote {len(values) - 1} row(s) to '{title}'")


def main() -> int:
    require_env(
        WALK_SUPABASE_URL=SUPABASE_URL,
        WALK_SUPABASE_SERVICE_ROLE_KEY=SUPABASE_KEY,
        GOOGLE_SERVICE_ACCOUNT_JSON=SA_JSON,
        WALK_GSHEET_ID=GSHEET_ID,
    )

    rows = fetch_buildings()
    if not rows:
        print("walk_buildings returned zero rows - skipping the backup rather than blanking the sheet.")
        return 0

    # spreadsheets only - the sheet always already exists (created manually,
    # see module docstring), so this never needs drive scope.
    creds = Credentials.from_service_account_info(json.loads(SA_JSON), scopes=[
        "https://www.googleapis.com/auth/spreadsheets",
    ])
    gc = gspread.authorize(creds)
    sh = gc.open_by_key(GSHEET_ID)

    print(f"Exporting {len(rows)} building(s)...")
    write_grid(sh, "buildings", buildings_grid(rows))
    print("Done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
