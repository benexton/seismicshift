#!/usr/bin/env python3
"""
LFE platform - draft "Preliminary Conclusions", event-parameterized.

Adapted from ../generate_report.py (Kumamoto, single-event, untouched): reads
that event's own verified (Approved, non-merged) records, writes conclusions
into that event's own event_meta row (not a hardcoded singleton id=1), and the
prompt no longer assumes a Japanese-language event.

Env: LFE_SUPABASE_URL, LFE_SUPABASE_SERVICE_ROLE_KEY, LLM_API_KEY.
Optional: GEMINI_MODEL.

Usage:
    python generate_report.py --event-slug japan-2026
    python generate_report.py               # every status='active' event
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
from collections import Counter

import requests

from _common import SUPABASE_URL, SUPABASE_KEY, sb_get, sb_patch, resolve_events, require_env

GEMINI_KEY = os.environ.get("LLM_API_KEY", "")
PREFERRED_MODEL = os.environ.get("GEMINI_MODEL", "")
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"

DAMAGE_LABEL = {0: "D0 none", 1: "D1 slight", 2: "D2 moderate", 3: "D3 heavy", 4: "D4 collapse", 5: "Great performance"}


def candidate_models():
    if PREFERRED_MODEL:
        return [PREFERRED_MODEL]
    models = []
    try:
        data = requests.get(f"{GEMINI_BASE}/models", params={"key": GEMINI_KEY}, timeout=60).json()
        names = [m["name"].split("/")[-1] for m in data.get("models", [])
                 if "generateContent" in m.get("supportedGenerationMethods", [])]
        flash = sorted([n for n in names if "flash" in n], reverse=True)
        models = flash + [n for n in names if n not in flash]
    except Exception as e:
        print("Could not list models:", e)
    for fb in ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"]:
        if fb not in models:
            models.append(fb)
    return models


def gemini(prompt):
    last = ""
    for model in candidate_models():
        r = requests.post(
            f"{GEMINI_BASE}/models/{model}:generateContent",
            params={"key": GEMINI_KEY},
            data=json.dumps({"contents": [{"parts": [{"text": prompt}]}]}),
            headers={"Content-Type": "application/json"}, timeout=120,
        )
        if not r.ok:
            last = f"{model} -> [{r.status_code}] {r.text[:200]}"
            print("Model failed:", last)
            continue
        out = r.json()
        try:
            cands = out.get("candidates") or []
            parts = cands[0]["content"]["parts"]
            text = "".join(p.get("text", "") for p in parts).strip()
            if text:
                print("Used model:", model)
                return text
            last = f"{model} -> empty text; finishReason={cands[0].get('finishReason')}"
            print("Model returned no text:", last)
        except Exception as e:
            last = f"{model} -> unexpected response shape: {e}; body={json.dumps(out)[:200]}"
            print(last)
    raise SystemExit(f"Gemini produced no usable text. Last: {last}")


def summarise(records):
    buildings = [r for r in records if "building" in (r.get("observation_types") or [])]
    lines = [f"Verified observations: {len(records)} (buildings: {len(buildings)})."]
    dmg = Counter(r.get("damage_score") for r in buildings)
    lines.append("Damage (buildings): " + ", ".join(f"{DAMAGE_LABEL.get(k, k)}={v}" for k, v in sorted(dmg.items(), key=lambda x: (x[0] is None, x[0]))))
    lines.append(f"Non-structural damage flagged on {sum(1 for r in records if r.get('nonstructural_damage'))} record(s).")
    by_region = Counter(r.get("region") for r in records if r.get("region"))
    lines.append("By region: " + ", ".join(f"{k}={v}" for k, v in by_region.most_common()))
    by_type = Counter()
    for r in records:
        for t in (r.get("observation_types") or []):
            by_type[t] += 1
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


def region_detail(records):
    out = []
    regions = sorted({r.get("region") for r in records if r.get("region")})
    for reg in regions:
        rr = [r for r in records if r.get("region") == reg]
        heavy = sum(1 for r in rr if r.get("damage_score") in (3, 4))
        dmg = Counter(r.get("damage_score") for r in rr)
        mats = Counter(r.get("primary_material") for r in rr if r.get("primary_material"))
        mechs = [r.get("failure_mechanism") for r in rr if r.get("failure_mechanism")][:5]
        parts = [f"{len(rr)} obs, {heavy} heavy (D3-D4)"]
        parts.append("damage " + ", ".join(f"{DAMAGE_LABEL.get(k, k)}={v}" for k, v in sorted(dmg.items(), key=lambda x: (x[0] is None, x[0]))))
        if mats:
            parts.append("materials " + ", ".join(f"{k}={v}" for k, v in mats.most_common()))
        if mechs:
            parts.append("mechanisms/notes: " + "; ".join(mechs))
        out.append(f"- {reg}: " + "; ".join(parts))
    return "\n".join(out), regions


def process_event(event: dict) -> None:
    event_id = event["id"]
    cols = "site_id,region,observation_types,damage_score,nonstructural_damage,code_era,primary_material,failure_mechanism"
    records = sb_get("triage_records", {"select": cols, "event_id": f"eq.{event_id}", "status": "eq.Approved", "merged_into": "is.null"})
    if not records:
        print(f"No verified sites yet for {event['slug']}; nothing to conclude.")
        return

    regions_txt, region_names = region_detail(records)
    prompt = (
        "You are assisting a NZSEE Learning from Earthquakes virtual reconnaissance team. "
        "Return ONLY a JSON object (no markdown code fences, nothing outside the JSON). Each field is "
        "concise Markdown prose for an engineering event report, written using ONLY the verified data "
        "provided. Draw out patterns and likely links (relationships between damage and region, code era, "
        "material, or mechanisms such as soft-storey or masonry infill). Do not invent specifics beyond the "
        "data. Write ALL prose in clear English regardless of the language of the underlying observations, "
        "region names, or notes; place names may be kept as-is. Fields:\n"
        '  "introduction": 1-2 short paragraphs introducing the virtual reconnaissance and overall picture.\n'
        '  "overview": commentary on the damage distribution and what stands out.\n'
        '  "mechanisms": discussion of the observed failure mechanisms and notes.\n'
        '  "nonstructural": brief note on non-structural damage patterns (empty string if not relevant).\n'
        '  "goodPerformance": brief note on notable good performance (empty string if none).\n'
        '  "regions": an object whose keys are EXACTLY these region names: '
        f'{json.dumps(region_names)}, each value a short commentary paragraph for that region.\n'
        '  "conclusions": preliminary conclusions and clear caveats about the remote, preliminary nature.\n\n'
        f"VERIFIED OBSERVATION SUMMARY:\n{summarise(records)}\n\nPER-REGION DETAIL:\n{regions_txt}"
    )
    print(f"=== {event.get('name') or event['slug']} === Calling Gemini...")
    raw = gemini(prompt).strip()

    import re
    fence = re.match(r"^```(?:json)?\s*([\s\S]*?)\s*```$", raw)
    text = fence.group(1).strip() if fence else raw
    brace = re.search(r"\{[\s\S]*\}", text)
    if brace:
        text = brace.group(0)
    try:
        obj = json.loads(text)
        stored = json.dumps(obj)
        print("Parsed structured sections:", ", ".join(obj.keys()))
    except Exception as e:
        print("Model output was not valid JSON, storing as plain text:", e)
        stored = raw

    print("Writing report content to event_meta...")
    sb_patch("event_meta", {"event_id": f"eq.{event_id}"}, {
        "conclusions_md": stored,
        "report_generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "report_generated_by": "AI (LFE report job)",
    })
    print("Done. Content length:", len(stored))


def main() -> int:
    require_env(LFE_SUPABASE_URL=SUPABASE_URL, LFE_SUPABASE_SERVICE_ROLE_KEY=SUPABASE_KEY, LLM_API_KEY=GEMINI_KEY)

    ap = argparse.ArgumentParser()
    ap.add_argument("--event-slug", default=os.environ.get("EVENT_SLUG") or None)
    args = ap.parse_args()

    for event in resolve_events(args.event_slug):
        process_event(event)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
