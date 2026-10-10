#!/usr/bin/env python3
"""Validate the cultural-transmission example using only Python stdlib."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "schemas" / "cultural-transmission.schema.json"
DATA = ROOT / "data" / "cultural-transmission-example.json"

def require(condition, message):
    if not condition:
        raise SystemExit("FAIL: " + message)

schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
data = json.loads(DATA.read_text(encoding="utf-8"))
require(schema.get("title") == "YUGATNeoTIME Cultural Transmission Record", "unexpected schema title")
require(data.get("schemaVersion") == "1.0", "unsupported schema version")
records, relations = data.get("records", []), data.get("relations", [])
record_ids = [record.get("id") for record in records]
relation_ids = [relation.get("id") for relation in relations]
require(len(record_ids) == len(set(record_ids)), "record ids must be unique")
require(len(relation_ids) == len(set(relation_ids)), "relation ids must be unique")
known = set(record_ids)
allowed_status = {"observed", "derived", "claimed", "not-tested", "conflicted", "residual"}
allowed_relations = {"documented-influence", "translation", "publication", "review", "teaching", "adaptation", "temporal-sequence", "correlation", "proposed-mechanism", "alternative-explanation", "unknown"}
for record in records:
    for field in ("id", "recordType", "title", "period", "region", "evidenceStatus", "sources"):
        require(field in record, f"record missing {field}")
    require(record["evidenceStatus"] in allowed_status, f"invalid evidence status on {record['id']}")
for relation in relations:
    for field in ("id", "from", "to", "relationType", "status", "description", "sources"):
        require(field in relation, f"relation missing {field}")
    require(relation["from"] in known and relation["to"] in known, f"unknown endpoint on {relation['id']}")
    require(relation["status"] in allowed_status, f"invalid evidence status on {relation['id']}")
    require(relation["relationType"] in allowed_relations, f"invalid relation type on {relation['id']}")
require(data.get("limitations"), "limitations must be explicit")
require(data.get("datasetStatus") == "synthetic-example", "example must be marked synthetic")
require(all(not relation["sources"] and relation["status"] == "not-tested" for relation in relations),
        "synthetic relations must not look historically verified")
print(f"PASS: {len(records)} synthetic records, {len(relations)} relations, all evidence states explicit")
