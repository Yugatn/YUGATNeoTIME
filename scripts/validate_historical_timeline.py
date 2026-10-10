#!/usr/bin/env python3
"""Validate historical timeline structure using only the Python standard library."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "historical-timeline-example.json"
ALLOWED = {"observed", "derived", "claimed", "not-tested", "conflicted", "residual"}

def require(condition, message):
    if not condition:
        raise SystemExit("FAIL: " + message)

data = json.loads(DATA.read_text(encoding="utf-8"))
require(data.get("schemaVersion") == "1.0", "unsupported schema version")
require(data.get("datasetStatus") in {"synthetic-example", "research-draft", "source-reviewed"}, "invalid dataset status")
require(data.get("limitations"), "limitations must be explicit")
events = data.get("events", [])
relations = data.get("relations", [])
event_ids = [e.get("id") for e in events]
relation_ids = [r.get("id") for r in relations]
require(len(event_ids) == len(set(event_ids)), "duplicate event IDs")
require(len(relation_ids) == len(set(relation_ids)), "duplicate relation IDs")
ids = set(event_ids)

def check_sources(sources, label):
    for source in sources:
        require(source.get("title") and source.get("sourceType"), f"incomplete source metadata: {label}")
        require(source.get("url", "").startswith(("https://", "http://")), f"source URL must be explicit: {label}")

for event in events:
    require(event.get("evidenceStatus") in ALLOWED, f"invalid evidence status: {event.get('id')}")
    date = event.get("date", {})
    require(date.get("calendar"), f"missing calendar basis: {event.get('id')}")
    require(date.get("precision") in {"day", "month", "year", "decade", "century", "approximate", "unknown"}, f"invalid date precision: {event.get('id')}")
    require(event.get("dateBasis") in {"documented-date", "scholarly-estimate", "traditional-date", "model-assumption", "unknown"}, f"invalid date basis: {event.get('id')}")
    check_sources(event.get("sources", []), event.get("id"))
for relation in relations:
    require(relation.get("from") in ids, f"unknown relation source: {relation.get('from')}")
    require(relation.get("to") in ids, f"unknown relation target: {relation.get('to')}")
    require(relation.get("status") in ALLOWED, f"invalid relation status: {relation.get('id')}")
    if relation["status"] in {"observed", "derived", "claimed"}:
        require(bool(relation.get("sources")), f"evidentiary relation has no source: {relation.get('id')}")
    check_sources(relation.get("sources", []), relation.get("id"))
if data["datasetStatus"] == "synthetic-example":
    require(all(e["evidenceStatus"] == "not-tested" for e in events), "synthetic events must remain not-tested")
    require(all(r["status"] == "not-tested" for r in relations), "synthetic relations must remain not-tested")
print(f"PASS: {len(events)} events, {len(relations)} relations; date bases, IDs, sources and evidence statuses checked")
