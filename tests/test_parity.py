"""The Python validator and the standalone Desktop fragment must agree.

Compare decoded JSON with ordered object pairs: this checks insertion order too,
while treating equivalent JSON numbers (e.g. 3 and 3.0) as the same value.
"""
from __future__ import annotations

import copy
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from hui_cards.schema import CARD_TYPES, validate_card

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = sorted(
    path
    for category in ("valid", "invalid")
    for path in (ROOT / "tests" / "fixtures" / category).glob("*.json")
)
NODE = shutil.which("node")
pytestmark = pytest.mark.skipif(NODE is None, reason="Node.js is required for Python/JavaScript validator parity")


@pytest.fixture(scope="module")
def js_results():
    proc = subprocess.run(
        [NODE, str(ROOT / "scripts" / "validate_js.mjs"), *map(str, FIXTURES)],
        cwd=ROOT, text=True, capture_output=True, check=True,
    )
    results = [json.loads(line) for line in proc.stdout.splitlines()]
    assert len(results) == len(FIXTURES), proc.stderr
    assert [row["file"] for row in results] == list(map(str, FIXTURES))
    return {row.pop("file"): row for row in results}


def ordered_json(value):
    return json.loads(json.dumps(value, ensure_ascii=False), object_pairs_hook=list)


@pytest.mark.parametrize("path", FIXTURES, ids=lambda p: f"{p.parent.name}/{p.name}")
def test_validator_parity(path, js_results):
    raw = json.loads(path.read_text(encoding="utf-8"))
    original = copy.deepcopy(raw)
    card, errors, warnings = validate_card(raw)
    expected = {"card": card, "errors": errors, "warnings": warnings}
    assert raw == original, "Python validator mutated its input"
    assert ordered_json(js_results[str(path)]) == ordered_json(expected)
    if path.parent.name == "valid":
        assert not errors
        assert card is not None
    else:
        assert errors or warnings
        assert card is None, "Warning-only accepted cards belong in valid/"


def test_fixture_coverage():
    assert len(FIXTURES) >= 45
    for ctype in CARD_TYPES:
        for variant in ("minimal", "full"):
            assert ROOT / "tests" / "fixtures" / "valid" / f"{ctype}-{variant}.json" in FIXTURES


def test_js_validator_is_pure():
    # Freeze recursively so any attempt to normalize in place fails. Run twice
    # and compare to detect state leaking between calls (especially assigned ids).
    script = r"""
const fs = require('node:fs'), vm = require('node:vm');
const schema = JSON.parse(fs.readFileSync('hui_cards/cards.schema.json', 'utf8'));
const context = vm.createContext({SCHEMA: schema});
vm.runInContext(fs.readFileSync('desktop/src/10-validate.js', 'utf8'), context);
const validate = vm.runInContext('validateCard', context);
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
for (const file of process.argv.slice(1)) {
  const raw = freeze(JSON.parse(fs.readFileSync(file, 'utf8')));
  const before = JSON.stringify(raw), first = JSON.stringify(validate(raw));
  if (JSON.stringify(validate(raw)) !== first || JSON.stringify(raw) !== before)
    throw new Error('Validator is impure: ' + file);
}
"""
    subprocess.run([NODE, "-e", script, *map(str, FIXTURES)], cwd=ROOT, text=True, capture_output=True, check=True)


@pytest.mark.parametrize("timezone", ["UTC", "Europe/Vienna", "America/New_York"])
def test_slot_local_timezone_parity(timezone):
    # _iso intentionally compares wall times after converting aware timestamps
    # to the process's zone; naive timestamps remain unchanged. Include DST
    # overlaps, historical offsets with seconds, and microsecond precision.
    pairs = [
        ("2026-11-12T14:00+01:00", "2026-11-12T13:30"),
        ("2026-11-12T14:00", "2026-11-12T14:30Z"),
        ("2026-10-25T02:45+02:00", "2026-10-25T02:15+01:00"),
        ("2026-11-01T01:45-04:00", "2026-11-01T01:15-05:00"),
        ("1800-01-01T14:00Z", "1800-01-01T14:00:00.000001Z"),
        ("2026-11-12T14:00:00.123456Z", "2026-11-12T14:00:00.123457Z"),
    ]
    raws = [{"type": "schedule", "slots": [{"start": start, "end": end}]} for start, end in pairs]
    env = {**os.environ, "TZ": timezone}
    python_script = """
import json, sys
from hui_cards.schema import validate_card
out = []
for raw in json.load(sys.stdin):
    card, errors, warnings = validate_card(raw)
    out.append(dict(card=card, errors=errors, warnings=warnings))
print(json.dumps(out))
"""
    js_script = """
const fs = require('node:fs'), vm = require('node:vm');
const context = vm.createContext({SCHEMA: JSON.parse(fs.readFileSync('hui_cards/cards.schema.json', 'utf8'))});
vm.runInContext(fs.readFileSync('desktop/src/10-validate.js', 'utf8'), context);
const validate = vm.runInContext('validateCard', context);
console.log(JSON.stringify(JSON.parse(fs.readFileSync(0, 'utf8')).map(validate)));
"""
    payload = json.dumps(raws)
    expected = subprocess.run([sys.executable, "-c", python_script], input=payload, cwd=ROOT, env=env, text=True, capture_output=True, check=True)
    actual = subprocess.run([NODE, "-e", js_script], input=payload, cwd=ROOT, env=env, text=True, capture_output=True, check=True)
    assert json.loads(actual.stdout, object_pairs_hook=list) == json.loads(expected.stdout, object_pairs_hook=list)
