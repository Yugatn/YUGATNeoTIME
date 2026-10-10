#!/usr/bin/env python3
"""Validate the scenario-forecast template with Python's standard library."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "scenario-forecast-template.json"

def require(ok, message):
    if not ok:
        raise SystemExit("FAIL: " + message)

data = json.loads(DATA.read_text(encoding="utf-8"))
require(data.get("schemaVersion") == "1.0", "unsupported schema version")
require(data.get("recordType") == "scenario-forecast", "wrong record type")
for key in ("researchQuestion", "idea", "context", "mechanism", "outcomes", "alternatives", "confounders", "forecast", "falsificationCriteria", "limitations", "sources", "overallStatus"):
    require(key in data, f"missing required field: {key}")
require(data.get("datasetStatus") == "template-not-evidence", "template must be clearly marked as non-evidence")
require(data.get("overallStatus") == "not-tested", "template status must remain not-tested")
require(len(data["alternatives"]) >= 2, "include at least two alternative explanations")
require(any("no-effect" in a.get("id", "") for a in data["alternatives"]), "include a no-effect alternative")
require(len(data["falsificationCriteria"]) >= 1, "include criteria that could weaken the hypothesis")
require(len(data["limitations"]) >= 1, "limitations must be explicit")
allowed = {"observed", "derived", "claimed", "not-tested", "conflicted", "residual"}
require(data["idea"].get("evidenceStatus") in allowed, "invalid idea evidence status")
for step in data["mechanism"]:
    require(step.get("evidenceStatus") in allowed, "invalid mechanism evidence status")
for outcome in data["outcomes"]:
    require(outcome.get("evidenceStatus") in allowed, "invalid outcome evidence status")
require(not data["sources"], "blank template should not fabricate sources")
print(f"PASS: scenario template has {len(data['mechanism'])} mechanism steps, {len(data['outcomes'])} outcome(s), {len(data['alternatives'])} alternatives; no fabricated evidence")
