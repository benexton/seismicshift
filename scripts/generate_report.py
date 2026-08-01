#!/usr/bin/env python3
"""
Draft "Preliminary Conclusions" for the report from the VERIFIED sites only,
using Gemini, and store them in event_meta.conclusions_md. Read-only on the
observation data; writes only the conclusions fields. Runs as a GitHub Action so
the Gemini key stays server-side.

Env (GitHub secrets): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LLM_API_KEY.
Optional: GEMINI_MODEL.
"""

from __future__ import annotations
import os, sys, json, datetime
from collections import Counter
import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
GEMINI_KEY = os.environ.get("LLM_API_KEY", "")
PREFERRED_MODEL = os.environ.get("GEMINI_MODEL", "")
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"

DAMAGE_LABEL = {0: "D0 none", 1: "D1 slight", 2: "D2 moderate", 3: "D3 heavy", 4: "D4 collapse", 5: "Great performance"}


def sb(path, params=None, method="GET", body=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"}
    if method == "GET":
        r = requests.get(url, headers=headers, params=params, timeout=60)
    else:
        headers["Prefer"] = "resolution=merge-duplicates,return=minimal"
        r = requests.post(url, headers=headers, params=params, data=json.dumps(body), timeout=60)
    r.raise_for_status()
    return r.json() if (method == "GET" and r.text) else None


def resolve_model():
    if PREFERRED_MODEL:
        return PREFERRED_MODEL
    try:
        data = requests.get(f"{GEMINI_BASE}/models", params={"key": GEMINI_KEY}, timeout=60).json()
        names = [m["name"].split("/")[-1] for m in data.get("models", [])
                 if "generateContent" in m.get("supportedGenerationMethods", [])]
        flash = [n for n in names if "flash" in n and "latest" not in n]
        return sorted(flash)[-1] if flash else (names[0] if names else "gemini-2.5-flash")
    except Exception:
        return "gemini-2.5-flash"


def gemini(prompt):
    model = resolve_model()
    r = requests.post(
        f"{GEMINI_BASE}/models/{model}:generateContent",
        params={"key": GEMINI_KEY},
        data=json.dumps({"contents": [{"parts": [{"text": prompt}]}]}),
        headers={"Content-Type": "application/json"}, timeout=120,
    )
    r.raise_for_status()
    out = r.json()
    return out["candidates"][0]["content"]["parts"][0]["text"]


def summarise(records):
    buildings = [r for r in records if r.get("observation_type") == "building"]
    lines = [f"Verified observations: {len(records)} (buildings: {len(buildings)})."]
    dmg = Counter(r.get("damage_score") for r in buildings)
    lines.append("Damage (buildings): " + ", ".join(f"{DAMAGE_LABEL.get(k, k)}={v}" for k, v in sorted(dmg.items(), key=lambda x: (x[0] is None, x[0]))))
    lines.append(f"Non-structural damage flagged on {sum(1 for r in records if r.get('nonstructural_damage'))} record(s).")
    by_region = Counter(r.get("region") for r in records if r.get("region"))
    lines.append("By region: " + ", ".join(f"{k}={v}" for k, v in by_region.most_common()))
    by_type = Counter(r.get("observation_type") for r in records)
    lines.append("By type: " + ", ".join(f"{k}={v}" for k, v in by_type.most_common()))
    era = Counter(r.get("code_era") for r in buildings if r.get("code_era"))
    if era:
        lines.append("Code era: " + ", ".join(f"{k}={v}" for k, v in era.most_common()))
    mat = Counter(r.get("primary_material") for r in buildings if r.get("primary_material"))
    if mat:
        lines.append("Materials: " + ", ".join(f"{k}={v}" for k, v in mat.most_common()))
    mechs = [r.get("failure_mechanism") for r in records if r.get("failure_mechanism")][:15]
    if mechs:
        lines.append("Reported mechanisms/notes: " + "; ".join(mechs))
    return "\n".join(lines)


def main():
    for k, v in {"SUPABASE_URL": SUPABASE_URL, "SUPABASE_SERVICE_ROLE_KEY": SUPABASE_KEY, "LLM_API_KEY": GEMINI_KEY}.items():
        if not v:
            print(f"Missing env: {k}", file=sys.stderr); return 1

    cols = "site_id,region,observation_type,damage_score,nonstructural_damage,code_era,primary_material,failure_mechanism"
    records = sb("triage_records", {"select": cols, "status": "eq.Approved", "merged_into": "is.null"})
    if not records:
        print("No verified sites yet; nothing to conclude."); return 0

    prompt = (
        "You are assisting a NZSEE Learning from Earthquakes virtual reconnaissance team. "
        "Using ONLY the verified observation summary below, draft a concise 'Preliminary Conclusions' "
        "section in Markdown for an engineering event report. Draw out patterns and likely links "
        "(e.g. relationships between damage level and region, code era, material, or mechanism such as "
        "soft-storey or masonry infill), note notable good performance if present, and end with clear "
        "caveats about the preliminary, remote nature of the data. Use short paragraphs and bullet points. "
        "Do not invent specifics beyond the data. Keep it under ~400 words.\n\n"
        f"VERIFIED OBSERVATION SUMMARY:\n{summarise(records)}"
    )
    print("Calling Gemini...")
    conclusions = gemini(prompt).strip()

    print("Writing conclusions to event_meta...")
    sb("event_meta", method="POST", body={
        "id": 1,
        "conclusions_md": conclusions,
        "report_generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "report_generated_by": "AI (VERT report job)",
    })
    print("Done. Conclusions length:", len(conclusions))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
