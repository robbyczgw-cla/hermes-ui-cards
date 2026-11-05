import json
import os
import subprocess
import sys
import types
from pathlib import Path

import pytest

from hui_cards import tool
from hui_cards.demos import DEMOS
from hui_cards.hui_blocks import to_hui_node
from hui_cards.schema import validate_card

# A checkout of the Hermes UI+ app (its validator checks every mapped block). Point HUI_PLUS_DIR at it;
# without it these tests are skipped.
HUI = Path(os.environ.get('HUI_PLUS_DIR', 'hermes-ui-plus-not-set'))
VALIDATOR = HUI / 'hermes-skill/examples/validate.mjs'


@pytest.mark.parametrize('kind', sorted(DEMOS))
def test_demo_against_hui_validator(kind, tmp_path):
    card, errors, _ = validate_card(DEMOS[kind])
    assert card is not None, errors
    card['cardId'] = 'demo-' + kind + '-1234567890'
    node = to_hui_node(card)
    if node is None:
        return
    assert node['id'] == card['cardId']
    if not VALIDATOR.exists():
        pytest.skip('HUI+ checkout/validator is missing at ' + str(VALIDATOR))
    path = tmp_path / (kind + '.md')
    path.write_text('````markdown\nHere is the interactive card for your answer.\n\n```hui\n' + json.dumps(node, ensure_ascii=False) + '\n```\n````\n')
    result = subprocess.run(['node', str(VALIDATOR), str(path)], text=True, capture_output=True)
    assert result.returncode == 0, result.stdout + result.stderr


def test_api_formats_and_fallback(monkeypatch):
    settings = {'api_server_format': 'hui'}
    monkeypatch.setattr(tool, '_settings_reader', lambda k, d: settings.get(k, d))
    result = json.loads(tool.present({'demo': 'choice'}, surface='api_server'))
    assert result['hui'].startswith('```hui\n') and result['hui'].endswith('\n```')
    node = json.loads(result['hui'][7:-4])
    assert node['id'] == result['cardId'] and node['options'][0]['id']
    assert result['text'] and '[type:id]' in result['next']
    assert 'hui' not in json.loads(tool.present({'demo': 'plan'}, surface='api_server'))
    settings['api_server_format'] = 'text'
    assert 'hui' not in json.loads(tool.present({'demo': 'choice'}, surface='api_server'))
    settings['api_server_format'] = 'hui'
    assert 'hui' not in json.loads(tool.present({'demo': 'choice'}, surface='cli'))


def test_long_id_and_unsafe_calculation(monkeypatch):
    monkeypatch.setattr(tool, '_settings_reader', lambda k, d: 'hui' if k == 'api_server_format' else d)
    choice = dict(DEMOS['choice'], id='a' * 40)
    result = json.loads(tool.present({'card': choice}, surface='api_server'))
    assert len(result['cardId']) <= 40
    assert json.loads(result['hui'][7:-4])['id'] == result['cardId']
    calc = dict(DEMOS['calc'], outputs=[{'label': 'bad', 'expr': '1 / 0'}])
    assert 'hui' not in json.loads(tool.present({'card': calc}, surface='api_server'))


@pytest.mark.parametrize('card', [
    {'type': 'form', 'title': 'Details', 'fields': [{'name': 'name', 'label': 'Name', 'kind': 'text'}]},
    {'type': 'confirm', 'title': 'Continue?', 'action': 'Continue', 'allowChange': False},
    {'type': 'rating', 'question': 'How was it?'},
    {'type': 'slider', 'question': 'How many?', 'min': 0, 'max': 10},
])
def test_other_native_nodes_against_hui_validator(card, tmp_path):
    normalized, errors, _ = validate_card(card)
    assert normalized is not None, errors
    normalized['cardId'] = 'test-1234567890'
    node = to_hui_node(normalized)
    assert node is not None
    if not VALIDATOR.exists():
        pytest.skip('HUI+ checkout/validator is missing at ' + str(VALIDATOR))
    path = tmp_path / 'node.md'
    path.write_text('````markdown\nHere is the interactive card for your answer.\n\n```hui\n' + json.dumps(node) + '\n```\n````\n')
    result = subprocess.run(['node', str(VALIDATOR), str(path)], text=True, capture_output=True)
    assert result.returncode == 0, result.stdout + result.stderr


def test_auto_uses_public_config(monkeypatch):
    monkeypatch.setattr(tool, '_settings_reader', lambda k, d: d)
    cli = types.ModuleType('hermes_cli')
    config = types.ModuleType('hermes_cli.config')
    monkeypatch.setitem(sys.modules, 'hermes_cli', cli)
    monkeypatch.setitem(sys.modules, 'hermes_cli.config', config)
    config.load_config_readonly = lambda: {'plugins': {'enabled': ['hermes-ui-plus']}}
    assert tool._api_hui_enabled()
    config.load_config_readonly = lambda: {'plugins': {'enabled': ['hermes-ui-plus'], 'disabled': ['hermes-ui-plus']}}
    assert not tool._api_hui_enabled()
    config.load_config_readonly = lambda: {'plugins': {'enabled': []}}
    assert not tool._api_hui_enabled()
