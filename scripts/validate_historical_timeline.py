#!/usr/bin/env python3
"""Validate the historical timeline examples and research datasets."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    ROOT / "data" / "historical-timeline-example.json",
    ROOT / "data" / "socrates-plato-starter.json",
]
ALLOWED = {"observed", "derived", "claimed", "not-tested", "conflicted", "residual"}
DATE_PRECISIONS = {"day", "month", "year", "decade", "century", "approximate", "unknown"}
DATE_BASES = {"documented-date", "scholarly-estimate", "traditional-date", "model-assumption", "unknown"}
DATASET_STATUSES = {"synthetic-example", "research-draft", "source-reviewed"}

def require(condition, message):
    if not condition:
        raise SystemExit("FAIL: " + message)

def check_sources(sources, label):
    for source in sources:
        require(source.get("title") and source.get("sourceType"), f"incomplete source metadata: {label}")
        require(source.get("url", "").startswith(("https://", "http://")), f"source URL must be explicit: {label}")
        require(source.get("sourceType") in {"primary", "scholarly-reference", "archive", "dataset", "other"}, f"invalid source type: {label}")

def validate(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    require(data.get("schemaVersion") == "1.0", f"{path.name}: unsupported schema version")
    require(data.get("datasetId"), f"{path.name}: missing datasetId")
    require(data.get("datasetStatus") in DATASET_STATUSES, f"{path.name}: invalid dataset status")
    require(data.get("limitations"), f"{path.name}: limitations must be explicit")
    events = data.get("events", [])
    relations = data.get("relations", [])
    event_ids = [e.get("id") for e in events]
    relation_ids = [r.get("id") for r in relations]
    require(all(event_ids), f"{path.name}: every event needs an ID")
    require(all(relation_ids), f"{path.name}: every relation needs an ID")
    require(len(event_ids) == len(set(event_ids)), f"{path.name}: duplicate event IDs")
    require(len(relation_ids) == len(set(relation_ids)), f"{path.name}: duplicate relation IDs")
    ids = set(event_ids)
    for event in events:
        label = f"{path.name}:{event.get('id')}"
        require(event.get("title") and event.get("description"), f"missing event title/description: {label}")
        require(event.get("evidenceStatus") in ALLOWED, f"invalid evidence status: {label}")
        date = event.get("date", {})
        require(date.get("start") is not None, f"missing date start: {label}")
        require(date.get("calendar"), f"missing calendar basis: {label}")
        require(date.get("precision") in DATE_PRECISIONS, f"invalid date precision: {label}")
        require(event.get("dateBasis") in DATE_BASES, f"invalid date basis: {label}")
        check_sources(event.get("sources", []), label)
    for relation in relations:
        label = f"{path.name}:{relation.get('id')}"
        require(relation.get("from") in ids, f"unknown relation source: {label}")
        require(relation.get("to") in ids, f"unknown relation target: {label}")
        require(relation.get("status") in ALLOWED, f"invalid relation status: {label}")
        require(relation.get("relationType"), f"missing relation type: {label}")
        if relation["status"] in {"observed", "derived", "claimed"}:
            require(bool(relation.get("sources")), f"evidentiary relation has no source: {label}")
        check_sources(relation.get("sources", []), label)
    if data["datasetStatus"] == "synthetic-example":
        require(all(e["evidenceStatus"] == "not-tested" for e in events), f"{path.name}: synthetic events must remain not-tested")
        require(all(r["status"] == "not-tested" for r in relations), f"{path.name}: synthetic relations must remain not-tested")
    print(f"PASS: {path.name}: {len(events)} events, {len(relations)} relations")

for file_path in FILES:
    validate(file_path)
print("PASS: historical timeline datasets passed structural validation; source truth is not automatically verified")
