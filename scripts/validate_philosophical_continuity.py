#!/usr/bin/env python3
"""Validate YUGATNeoTIME philosophical-continuity data using only Python stdlib."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

def load(name):
    with (DATA / name).open(encoding="utf-8") as stream:
        return json.load(stream)

def require(condition, message):
    if not condition:
        raise SystemExit("FAIL: " + message)

timeline = load("philosophical-continuity.json")
registry = load("philosophical-sources.json")
nodes = timeline.get("nodes", [])
edges = timeline.get("edges", [])
sources = registry.get("sources", [])

node_ids = [node.get("id") for node in nodes]
source_ids = [source.get("id") for source in sources]
require(all(node_ids), "every node must have an id")
require(len(node_ids) == len(set(node_ids)), "node ids must be unique")
require(len(source_ids) == len(set(source_ids)), "source ids must be unique")
node_set = set(node_ids)
require(timeline.get("startPoint") in node_set, "startPoint must reference a node")

edge_ids = [edge.get("id") for edge in edges]
require(all(edge_ids), "every edge must have an id")
require(len(edge_ids) == len(set(edge_ids)), "edge ids must be unique")
for edge in edges:
    require(edge.get("from") in node_set, f"edge {edge.get('id')} has unknown from node")
    require(edge.get("to") in node_set, f"edge {edge.get('id')} has unknown to node")
    for field in ("type", "status", "label", "description", "evidence", "sourceUrl", "sourceTitle"):
        require(bool(edge.get(field)), f"edge {edge.get('id')} missing {field}")

lenin = next((node for node in nodes if node.get("id") == "lenin-reading-hypothesis"), None)
require(lenin is not None, "Lenin reading question must remain represented")
require(lenin.get("kind") == "unverified-hypothesis", "Lenin reading question must not be presented as fact")
atlantis = next((node for node in nodes if node.get("id") == "atlantis-dialogue"), None)
require(atlantis is not None, "Atlantis dialogue node is required")
require("не доказательство" in atlantis.get("description", "").lower(), "Atlantis description must distinguish narrative from proof")

for source in sources:
    for field in ("title", "publisher", "url", "sourceType", "supports", "doesNotProve", "recommendedUse"):
        require(field in source and source[field], f"source {source.get('id')} missing {field}")

print(f"PASS: {len(nodes)} nodes, {len(edges)} edges, {len(sources)} registered sources")
