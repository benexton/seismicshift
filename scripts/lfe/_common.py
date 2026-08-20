#!/usr/bin/env python3
"""
Shared helpers for the LFE (multi-event) pipeline scripts. Talks only to the
new, separate LFE Supabase project (LFE_SUPABASE_URL / LFE_SUPABASE_SERVICE_ROLE_KEY)
- never the Kumamoto project the ../ scripts use, and never imported by them.
"""

from __future__ import annotations

import ipaddress
import json
import os
import socket
import sys
from urllib.parse import urlparse

import requests

SUPABASE_URL = os.environ.get("LFE_SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("LFE_SUPABASE_SERVICE_ROLE_KEY", "")
REQUEST_TIMEOUT = 60

# Single source of truth for the observation-type vocabulary, so the scraper's
# LLM prompt and its tag-validation step never drift from the DB's CHECK
# constraint (supabase/lfe/migrations/0005_triage_records.sql).
OBSERVATION_TYPES = [
    "building", "geotechnical", "landslide", "lifeline",
    "emergency_management", "tsunami", "other",
]


def valid_observation_types(tags) -> list[str]:
    """Filter tags down to the known vocabulary. observation_types is an
    array column with a CHECK constraint, so one hallucinated tag would
    otherwise fail the whole row's insert - drop bad tags instead of
    propagating them, degrading gracefully rather than rejecting the
    observation outright."""
    if not tags:
        return ["other"]
    out = [t for t in tags if t in OBSERVATION_TYPES]
    return out or ["other"]


def is_safe_fetch_url(url: str) -> bool:
    """Guards outbound fetches of scraped/user-supplied URLs (source_url,
    og:image links, media URLs pulled from a remote page) against SSRF: a
    hostile or compromised source page could set an og:image (or similar) to
    an internal address - e.g. http://169.254.169.254/... (cloud metadata) or
    http://localhost:.../ - to make this pipeline's server-side fetch probe
    the runner's own network on the attacker's behalf. Rejects non-http(s)
    schemes and any hostname that resolves to a loopback/private/link-local/
    reserved/multicast address."""
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    try:
        infos = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if (ip.is_private or ip.is_loopback or ip.is_link_local
                or ip.is_multicast or ip.is_reserved or ip.is_unspecified):
            return False
    return True


def require_env(**kv) -> None:
    missing = [k for k, v in kv.items() if not v]
    if missing:
        print(f"Missing env: {', '.join(missing)}", file=sys.stderr)
        raise SystemExit(1)


def sb_get(path: str, params: dict) -> list[dict]:
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        params=params, timeout=REQUEST_TIMEOUT,
    )
    if not r.ok:
        raise SystemExit(f"GET {path} failed [{r.status_code}]: {r.text[:300]}")
    return r.json()


def sb_patch(path: str, params: dict, body: dict) -> None:
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
                 "Content-Type": "application/json"},
        params=params, data=json.dumps(body), timeout=REQUEST_TIMEOUT,
    )
    if not r.ok:
        raise SystemExit(f"PATCH {path} failed [{r.status_code}]: {r.text[:300]}")


def sb_post(path: str, body: dict, params: dict | None = None) -> list[dict]:
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
                 "Content-Type": "application/json", "Prefer": "return=representation"},
        params=params, data=json.dumps(body), timeout=REQUEST_TIMEOUT,
    )
    if not r.ok:
        raise SystemExit(f"POST {path} failed [{r.status_code}]: {r.text[:300]}")
    return r.json()


def resolve_events(event_slug: str | None) -> list[dict]:
    """Return the events to process: one specific event by slug, or every
    status='active' event when no slug is given - so the same script works
    from a manual `--event-slug` dispatch today and an unattended schedule
    later without changing behaviour."""
    if event_slug:
        rows = sb_get("events", {"select": "*", "slug": f"eq.{event_slug}"})
        if not rows:
            raise SystemExit(f"No event found with slug '{event_slug}'")
        return rows
    rows = sb_get("events", {"select": "*", "status": "eq.active"})
    if not rows:
        print("No active events to process.")
    return rows
