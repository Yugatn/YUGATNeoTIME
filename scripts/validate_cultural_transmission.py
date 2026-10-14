#!/usr/bin/env python3
"""Validate cultural-transmission datasets with Python's standard library."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "schemas" / "cultural-transmission.schema.json"
DATASETS = [
    ROOT / "data" / "cultural-transmission-example.json",
    ROOT / "data" / "translation-network-aristotle.json",
]
STATUSES = {"observed", "derived", "claimed", "not-tested", "conflicted", "residual"}
DATASET_STATUSES = {"synthetic-example", "research-draft", "source-reviewed"}
RECORD_TYPES = {"idea", "artwork", "edition", "translation", "review", "institution", "discussion", "observed-outcome"}
RELATION_TYPES = {"documented-influence", "translation", "publication", "review", "teaching", "adaptation", "temporal-sequence", "correlation", "proposed-mechanism", "alternative-explanation", "unknown"}
PRECISIONS = {"day", "month", "year", "decade", "approximate", "unknown"}

def require(condition, message):
    if not condition:
        raise SystemExit("FAIL: " + message)

schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
require(schema.get("title") == "YUGATNeoTIME Cultural Transmission Record", "unexpected schema title")
require("datasetStatus" in schema.get("properties", {}), "schema must define datasetStatus")

for path in DATASETS:
    data = json.loads(path.read_text(encoding="utf-8"))
    label = path.name
    require(data.get("schemaVersion") == "1.0", f"{label}: unsupported schema version")
    require(data.get("datasetStatus") in DATASET_STATUSES, f"{label}: invalid dataset status")
    require(data.get("limitations"), f"{label}: limitations must be explicit")
    records, relations = data.get("records", []), data.get("relations", [])
    record_ids = [record.get("id") for record in records]
    relation_ids = [relation.get("id") for relation in relations]
    require(all(record_ids), f"{label}: every record needs an ID")
    require(all(relation_ids), f"{label}: every relation needs an ID")
    require(len(record_ids) == len(set(record_ids)), f"{label}: record IDs must be unique")
    require(len(relation_ids) == len(set(relation_ids)), f"{label}: relation IDs must be unique")
    known = set(record_ids)
    for record in records:
        rid = record["id"]
        for field in ("id", "recordType", "title", "period", "region", "evidenceStatus", "sources"):
            require(field in record, f"{label}:{rid}: missing {field}")
        require(record["recordType"] in RECORD_TYPES, f"{label}:{rid}: invalid recordType")
        require(record["evidenceStatus"] in STATUSES, f"{label}:{rid}: invalid evidence status")
        require(record["period"].get("precision") in PRECISIONS, f"{label}:{rid}: invalid date precision")
        require(record["period"].get("start") is not None, f"{label}:{rid}: missing period start")
        if data["datasetStatus"] != "synthetic-example" and record["evidenceStatus"] in {"observed", "derived", "claimed"}:
            require(bool(record["sources"]), f"{label}:{rid}: evidence-bearing record needs sources")
        for source in record.get("sources", []):
            require(source.startswith(("https://", "http://")), f"{label}:{rid}: source must be an explicit URL")
    for relation in relations:
        relid = relation["id"]
        for field in ("id", "from", "to", "relationType", "status", "description", "sources"):
            require(field in relation, f"{label}:{relid}: missing {field}")
        require(relation["from"] in known and relation["to"] in known, f"{label}:{relid}: unknown endpoint")
        require(relation["status"] in STATUSES, f"{label}:{relid}: invalid evidence status")
        require(relation["relationType"] in RELATION_TYPES, f"{label}:{relid}: invalid relation type")
        if data["datasetStatus"] != "synthetic-example" and relation["status"] in {"observed", "derived", "claimed"}:
            require(bool(relation["sources"]), f"{label}:{relid}: evidence-bearing relation needs sources")
        for source in relation.get("sources", []):
            require(source.startswith(("https://", "http://")), f"{label}:{relid}: source must be an explicit URL")
    if data["datasetStatus"] == "synthetic-example":
        require(all(not relation["sources"] and relation["status"] == "not-tested" for relation in relations),
                f"{label}: synthetic relations must remain explicitly unverified")
    print(f"PASS: {label}: {len(records)} records, {len(relations)} relations, evidence states explicit")
print("PASS: structural checks completed; source credibility and historical truth still require human review")
