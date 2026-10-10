#!/usr/bin/env python3
"""Validate the qualitative art-and-ideas scenario dataset (Python stdlib only)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "data" / "art-idea-scenarios.json"
data = json.loads(path.read_text(encoding="utf-8"))

def require(condition, message):
    if not condition:
        raise SystemExit("FAIL: " + message)

variables = data.get("variables", [])
scenarios = data.get("scenarios", [])
scenario_ids = [item.get("id") for item in scenarios]
require(len(scenario_ids) == len(set(scenario_ids)), "scenario ids must be unique")
require(all(scenario_ids), "each scenario must have an id")
require(len(variables) >= 3, "expected multiple input variables")
for variable in variables:
    require(variable.get("id") and variable.get("options"), "variable requires id and options")
    values = [option.get("value") for option in variable["options"]]
    require(len(values) == len(set(values)), f"duplicate option values in {variable.get('id')}")
for required_id in ("continuation", "institutional", "controversy", "uncertainty"):
    require(required_id in scenario_ids, f"missing scenario {required_id}")
require(data.get("limitations"), "limitations must be explicit")
require(any("не является эмпирическим прогнозом" in data.get("notice", "").lower() for _ in [0]),
        "notice must state that this is not an empirical forecast")
print(f"PASS: {len(variables)} variables, {len(scenarios)} qualitative scenarios; no probabilities asserted")
