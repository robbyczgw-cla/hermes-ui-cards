#!/usr/bin/env python3
"""End-to-end: real Hermes + this plugin + a scripted model (tests/e2e/mock_llm.py).

1. Desktop turn: starts the same backend Hermes Desktop talks to (tui_gateway, JSON-RPC over
   stdio, HERMES_DESKTOP=1, session source "desktop") and asks for a packing list. Checks that
   hui_present ran (through tool_call, as plugin tools are deferred by default), that the reply
   carries the card's MEDIA line (added by the plugin's hook, the mock "forgets" it) and that the
   card file exists.
2. Click: renders the real tool result with the Desktop half (jsdom), ticks two items, presses
   Done and takes the message the card sends.
3. Follow-up turn: sends that message into the same session and checks that the model got the
   [hui-card] line and Hermes delivered its reaction.
4. Answer memory: the plugin recorded the card as shown, then as answered, under the session id
   Hermes Desktop uses for the chat (`stored_session_id`), and Hermes' real web server serves it at
   /api/plugins/hermes-ui-cards/answers (plus /settings), mounted from dashboard/manifest.json.
5. CLI turn: `hermes chat -q` gets the plain-text version and no MEDIA line.

    HERMES_BIN=/path/to/venv/bin/hermes python3 tests/e2e/run_e2e.py

HERMES_BIN must point at a Hermes >= 0.22.6 install; its interpreter runs the backend.
"""
from __future__ import annotations

import json
import os
import queue
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import mock_llm  # noqa: E402


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    sys.exit(1)


def ok(message: str) -> None:
    print(f"ok   {message}")


def make_home(port: int) -> Path:
    home = Path(tempfile.mkdtemp(prefix="hui-cards-e2e-"))
    (home / "plugins").mkdir()
    (home / "plugins" / "hermes-ui-cards").symlink_to(ROOT)
    (home / "config.yaml").write_text(
        "model:\n  default: mock-model\n  provider: custom\n"
        f"  base_url: http://127.0.0.1:{port}/v1\n  api_key: e2e\n"
        "plugins:\n  enabled:\n    - hermes-ui-cards\n",
        encoding="utf-8",
    )
    return home


class Backend:
    """The Desktop backend over JSON-RPC (stdio)."""

    def __init__(self, python: str, home: Path):
        env = dict(os.environ, HERMES_HOME=str(home), HERMES_DESKTOP="1")
        self.proc = subprocess.Popen([python, "-m", "tui_gateway.entry"], env=env, cwd=str(home), text=True,
                                     stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=open(home / "backend.err", "w"))
        self.frames: queue.Queue = queue.Queue()
        self.plugin_events: list = []  # every plugin.* gateway event, whoever waits for frames
        threading.Thread(target=self._read, daemon=True).start()
        self.next_id = 0

    def _read(self):
        for line in self.proc.stdout:
            try:
                frame = json.loads(line)
            except ValueError:
                continue
            if frame.get("method") == "event" and str(frame.get("params", {}).get("type", "")).startswith("plugin."):
                self.plugin_events.append(frame["params"])
            self.frames.put(frame)

    def call(self, method: str, params: dict, timeout: float = 120) -> dict:
        self.next_id += 1
        rid = self.next_id
        self.proc.stdin.write(json.dumps({"jsonrpc": "2.0", "id": rid, "method": method, "params": params}) + "\n")
        self.proc.stdin.flush()
        frame = self.wait(lambda f: f.get("id") == rid, timeout)
        if "error" in frame:
            fail(f"{method}: {frame['error']}")
        return frame["result"]

    def wait(self, pred, timeout: float = 120) -> dict:
        end = time.time() + timeout
        while time.time() < end:
            try:
                frame = self.frames.get(timeout=1)
            except queue.Empty:
                if self.proc.poll() is not None:
                    fail("backend exited early")
                continue
            if pred(frame):
                return frame
        fail("timed out waiting for the backend")

    def turn(self, sid: str, text: str) -> tuple[dict | None, str]:
        """Submit a prompt; return (hui_present result or None, final text)."""
        self.call("prompt.submit", {"session_id": sid, "text": text})
        result = None
        while True:
            frame = self.wait(lambda f: f.get("method") == "event"
                              and f["params"].get("session_id") == sid
                              and f["params"].get("type") in ("tool.complete", "message.complete"), 180)
            params = frame["params"]
            if params["type"] == "tool.complete" and params["payload"].get("name") == "hui_present":
                result = params["payload"].get("result")
            if params["type"] == "message.complete":
                return result, params["payload"].get("text") or ""

    def close(self):
        self.proc.kill()


def sent_ids(sent: dict) -> list:
    return json.loads(sent["text"].split("\n")[1][len("[hui-card] "):])["done_ids"]


def main() -> None:
    hermes = os.environ.get("HERMES_BIN") or "hermes"
    python = str(Path(hermes).with_name("python"))
    server, log = mock_llm.start()
    port = server.server_address[1]
    home = make_home(port)
    print(f"HERMES_HOME {home}")

    backend = Backend(python, home)
    try:
        created = backend.call("session.create", {"source": "desktop"})
        sid = created["session_id"]
        # What Hermes Desktop hands a tool media renderer as `sessionId` (storedId || runtimeId).
        stored = created.get("stored_session_id") or sid
        result, text = backend.turn(sid, "Help me pack for Japan in winter")
        if not isinstance(result, dict):
            result = json.loads(result) if isinstance(result, str) else None
        if not result or result.get("type") != "checklist" or "media" not in result:
            fail(f"desktop turn: no card result ({result!r:.200})")
        ok(f"desktop: hui_present returned card {result['cardId']}")
        if result["media"] not in text:
            fail(f"desktop: reply lacks the MEDIA line: {text!r}")
        ok("desktop: reply carries the MEDIA line (added by the plugin hook)")
        card_file = Path(result["media"].split(":", 1)[1].strip('"'))
        if not card_file.is_file():
            fail(f"card file missing: {card_file}")
        ok("desktop: card file written")
        import sqlite3
        db = home / "plugin-data" / "hermes-ui-cards" / "answers.db"
        if not db.is_file():
            fail(f"answer memory: no store ({db})")
        conn = sqlite3.connect(str(db))
        row = conn.execute("SELECT session FROM cards WHERE card = ?", (result["cardId"],)).fetchone()
        conn.close()
        if not row or row[0] != stored:
            fail(f"answer memory: card shown under {row!r}, Desktop asks with {stored!r}")
        ok(f"answer memory: card recorded as shown in session {stored} (the id Desktop asks with)")

        result_path = home / "result.json"
        result_path.write_text(json.dumps(result), encoding="utf-8")
        click = subprocess.run(["node", "--import", "./tests/desktop/register.mjs", "tests/e2e/click.mjs",
                                str(result_path), sid, "0", "2"], cwd=str(ROOT), capture_output=True, text=True,
                               timeout=120)
        if click.returncode != 0:
            fail(f"click: {click.stderr.strip()}")
        sent = json.loads(click.stdout.strip().splitlines()[-1])
        if sent["sessionId"] != sid:
            fail(f"click went to session {sent['sessionId']}, expected {sid}")
        lines = sent["text"].split("\n")
        expected = "✓ Checklist done: 2 of 4 checked. Still open: JR Pass voucher, Power adapter (type A)"
        if lines[0] != expected:
            fail(f"click: line 1 is {lines[0]!r}")
        ok(f"click: card sent {lines[0]!r}")

        _, reaction = backend.turn(sid, sent["text"])
        seen = [m for entry in log for m in entry["messages"][-1:] if "[hui-card]" in str(m.get("content"))]
        if not seen:
            fail("the model never received the [hui-card] line")
        want = "Got it: 2 packed. Still to pack: JR Pass voucher, Power adapter (type A)."
        if want not in reaction:
            fail(f"follow-up reply: {reaction!r}")
        ok(f"follow-up: Hermes answered {reaction!r}")
        changed = [e for e in backend.plugin_events if e.get("type") == "plugin.hermes-ui-cards.answers.changed"]
        if not changed or changed[-1].get("payload") not in ({}, None):
            fail(f"no empty answers.changed event (plugin events: {backend.plugin_events!r:.400})")
        ok(f"answer memory: connected client got plugin.hermes-ui-cards.answers.changed, payload {changed[-1].get('payload')!r}")

        probe = subprocess.run([python, str(HERE / "route_probe.py"), stored, result["cardId"] + ",nope-0000000000"],
                               env=dict(os.environ, HERMES_HOME=str(home)), cwd=str(home), capture_output=True,
                               text=True, timeout=180)
        if probe.returncode != 0:
            fail(f"route probe: {probe.stderr.strip()[-600:]}")
        routes = json.loads(probe.stdout.strip().splitlines()[-1])
        answers = routes["answers"]
        if answers["status"] != 200:
            fail(f"GET /api/plugins/hermes-ui-cards/answers: HTTP {answers['status']} {answers['body']!r:.300}")
        got = answers["body"]["answers"].get(result["cardId"])
        if not got or got.get("summary") != lines[0][2:] or got.get("data", {}).get("done_ids") != sent_ids(sent):
            fail(f"answers route: {answers['body']!r:.400}")
        if answers["body"]["open"]:
            fail(f"answers route: unexpected open cards {answers['body']['open']}")
        ok(f"answer memory: GET /api/plugins/hermes-ui-cards/answers → answered ({got['summary']!r})")
        settings = routes["settings"]
        if settings["status"] != 200 or settings["body"].get("display") != {"compact": False, "accent": "app", "undo": 4}:
            fail(f"GET /api/plugins/hermes-ui-cards/settings: {settings!r:.300}")
        ok("settings: GET /api/plugins/hermes-ui-cards/settings → defaults")
    finally:
        backend.close()

    env = dict(os.environ, HERMES_HOME=str(home))
    cli = subprocess.run([hermes, "chat", "-q", "Help me pack for Japan in winter", "--format", "stream-json",
                          "--ignore-rules"], env=env, capture_output=True, text=True, timeout=300)
    out = cli.stdout
    if "Reply with the numbers you have done" not in out:
        fail(f"cli: no text version in the output ({out[-400:]!r})")
    if "MEDIA:" in out.split('"name": "hui_present"')[-1].replace("\\n", "\n").split("Here is a list")[-1]:
        fail("cli: a MEDIA line reached the CLI reply")
    ok("cli: plain-text version with numbered items, no MEDIA line")
    # `hermes chat` starts a background gateway for this home; stop it.
    subprocess.run([hermes, "gateway", "stop"], env=env, capture_output=True, text=True, timeout=120)
    server.shutdown()
    print("E2E passed")


if __name__ == "__main__":
    main()
