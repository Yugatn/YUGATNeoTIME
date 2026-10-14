#!/usr/bin/env python3
"""Structural validation for intellectual-transmission graph datasets."""
import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "schemas" / "intellectual-transmission.schema.json"
DATASETS = [ROOT / "data" / "intellectual-transmission-graph-example.json"]
EVIDENCE = {"observed", "derived", "claimed", "not-tested", "conflicted", "residual"}
STATUS = {"synthetic-example", "research-draft", "source-reviewed"}
ENTITY_TYPES = {"person", "work", "translation", "manuscript", "institution", "language", "event", "concept"}
RELATION_TYPES = {"authored", "translated-into", "translated-from", "copied", "commented-on", "taught", "studied-at", "preserved-by", "quoted", "adapted", "influenced", "institutional-reception", "chronologically-precedes", "disputed-by", "related-to"}
SOURCE_TYPES = {"primary", "scholarly-reference", "archive", "catalogue", "dataset", "other"}
PRECISIONS = {"day", "month", "year", "decade", "century", "approximate", "unknown"}

def require(ok, message):
    if not ok:
        raise SystemExit("FAIL: " + message)

def check_sources(sources, label):
    require(isinstance(sources, list), f"{label}: sources must be a list")
    for source in sources:
        require(source.get("title") and source.get("sourceType") in SOURCE_TYPES, f"{label}: incomplete source metadata")
        parsed = urlparse(source.get("url", ""))
        require(parsed.scheme in {"http", "https"} and parsed.netloc, f"{label}: source URL must be absolute HTTP(S)")
        
def validate(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    require(data.get("schemaVersion") == "1.0", f"{path.name}: schemaVersion must be 1.0")
    require(data.get("graphId") and data.get("title"), f"{path.name}: missing graph identity/title")
    require(data.get("status") in STATUS, f"{path.name}: invalid graph status")
    require(data.get("limitations"), f"{path.name}: limitations must be explicit")
    entities = data.get("entities", [])
    relations = data.get("relations", [])
    entity_ids = [e.get("id") for e in entities]
    relation_ids = [r.get("id") for r in relations]
    require(all(entity_ids) and len(entity_ids) == len(set(entity_ids)), f"{path.name}: missing or duplicate entity IDs")
    require(all(relation_ids) and len(relation_ids) == len(set(relation_ids)), f"{path.name}: missing or duplicate relation IDs")
    ids = set(entity_ids)
    for entity in entities:
        label = f"{path.name}:{entity.get('id')}"
        require(re.fullmatch(r"[a-z0-9][a-z0-9-]*", entity["id"]) is not None, f"{label}: invalid ID format")
        require(entity.get("entityType") in ENTITY_TYPES, f"{label}: invalid entityType")
        require(entity.get("label") and entity.get("description"), f"{label}: label and description are required")
        require(entity.get("evidenceStatus") in EVIDENCE, f"{label}: invalid evidenceStatus")
        check_sources(entity.get("sources", []), label)
        if "date" in entity:
            date = entity["date"]
            require("start" in date and date.get("precision") in PRECISIONS, f"{label}: incomplete date metadata")
    for relation in relations:
        label = f"{path.name}:{relation.get('id')}"
        require(re.fullmatch(r"[a-z0-9][a-z0-9-]*", relation["id"]) is not None, f"{label}: invalid ID format")
        require(relation.get("from") in ids and relation.get("to") in ids, f"{label}: relation endpoint does not exist")
        require(relation.get("relationType") in RELATION_TYPES, f"{label}: invalid relationType")
        require(relation.get("status") in EVIDENCE, f"{label}: invalid status")
        require(relation.get("description"), f"{label}: description is required")
        check_sources(relation.get("sources", []), label)
        if relation["status"] in {"observed", "derived", "claimed"}:
            require(bool(relation.get("sources")), f"{label}: evidentiary relation needs sources")
    if data["status"] == "synthetic-example":
        require(all(e["evidenceStatus"] == "not-tested" for e in entities), f"{path.name}: synthetic entities must be not-tested")
        require(all(r["status"] == "not-tested" for r in relations), f"{path.name}: synthetic relations must be not-tested")
    print(f"PASS: {path.name}: {len(entities)} entities, {len(relations)} relations")

schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
require(schema.get("$schema") == "https://json-schema.org/draft/2020-12/schema", "unsupported JSON Schema draft")
for dataset in DATASETS:
    validate(dataset)
print("PASS: structural checks complete; source truth is not automatically verified")
