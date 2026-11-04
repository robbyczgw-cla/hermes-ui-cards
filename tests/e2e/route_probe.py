"""Calls the plugin's backend routes through Hermes' real web server app (the one Hermes Desktop
and the Webapp talk to): /api/plugins/hermes-ui-cards/answers and /settings, mounted by Hermes
from dashboard/manifest.json + dashboard/plugin_api.py. Run with Hermes' interpreter:

    HERMES_HOME=<e2e home> <hermes venv>/bin/python tests/e2e/route_probe.py <session> <cardId>,...

Prints one JSON line: {"answers": {status, body}, "settings": {status, body}}.
The session header is the dashboard's own test door (what Hermes' tests use); a real Desktop
authenticates with its native grant instead.
"""
import json
import sys

from starlette.testclient import TestClient

from hermes_cli.web_server import _SESSION_HEADER_NAME, _SESSION_TOKEN, app

session, cards = sys.argv[1], sys.argv[2]
client = TestClient(app)
client.headers[_SESSION_HEADER_NAME] = _SESSION_TOKEN
out = {}
for name, path, params in (("answers", "/api/plugins/hermes-ui-cards/answers", {"session": session, "cards": cards}),
                           ("settings", "/api/plugins/hermes-ui-cards/settings", None)):
    response = client.get(path, params=params, follow_redirects=False)
    try:
        body = response.json()
    except ValueError:
        body = response.text[:300]
    out[name] = {"status": response.status_code, "body": body}
print(json.dumps(out, ensure_ascii=False))
