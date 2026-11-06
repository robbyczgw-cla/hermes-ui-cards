"""A scripted OpenAI-compatible model for the end-to-end test.

It plays the part of a well-behaved model so the test exercises the real Hermes
agent loop, tool dispatch, hooks and persistence with deterministic answers:

- a user message that asks for a packing list → call hui_present with a checklist
- a hui_present tool result → reply in one sentence, deliberately WITHOUT the
  MEDIA line on Desktop (the plugin's hook must add it), with `text` elsewhere
- a user message with a `[hui-card]` line (after its attached-context line) → react to the answer
"""
from __future__ import annotations

import json
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

CARD = {
    "type": "checklist",
    "id": "japan-winter",
    "title": "Japan in winter",
    "items": [
        {"text": "Passport", "category": "Documents"},
        {"text": "JR Pass voucher", "category": "Documents"},
        {"text": "Thermal underwear", "category": "Clothes"},
        {"text": "Power adapter (type A)", "category": "Tech"},
    ],
}


def _text_of(message: dict) -> str:
    content = message.get("content")
    if isinstance(content, list):
        return "".join(part.get("text", "") for part in content if isinstance(part, dict))
    return content or ""


def decide(messages: list) -> dict:
    """Return {"content": str} or {"tool_call": {...}} for the conversation so far."""
    last = messages[-1]
    if last.get("role") == "tool":
        try:
            result = json.loads(_text_of(last))
        except ValueError:
            return {"content": "Done."}
        if "demo" in str(messages[-2].get("tool_calls", "")):
            return {"content": "Here is the example card."}
        if "text" in result:
            return {"content": "Here is a list to work through:\n\n" + result["text"]}
        return {"content": "Here is a list to work through."}
    text = _text_of(last)
    for line in text.splitlines():
        if line.startswith("[hui-card] "):
            answer = json.loads(line[len("[hui-card] "):])
            still = ", ".join(answer.get("open", [])) or "nothing"
            return {"content": f"Got it: {len(answer.get('done', []))} packed. Still to pack: {still}."}
    if "probe-env" in text:  # diagnostics only
        return {"tool_call": {"name": "tool_call", "arguments": json.dumps({"calls": [{"name": "env_probe", "arguments": {}}]})}}
    demo = re.search(r"\bdemo (\w+)", text)
    if demo:
        return {"tool_call": {"name": "tool_call", "arguments": json.dumps(
            {"calls": [{"name": "hui_present", "arguments": {"demo": demo.group(1)}}]})}}
    # Hermes defers plugin tools behind tool_search by default: a model calls them through tool_call.
    return {"tool_call": {"name": "tool_call", "arguments": json.dumps(
        {"calls": [{"name": "hui_present", "arguments": {"card": CARD}}]})}}


class _Handler(BaseHTTPRequestHandler):
    server_version = "mock-llm/1"
    log: list = []

    def log_message(self, *args):  # quiet
        pass

    def do_GET(self):
        if self.path.rstrip("/").endswith("/models"):
            return self._json({"object": "list", "data": [{"id": "mock-model", "object": "model"}]})
        self._json({"error": "not found"}, 404)

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length) or b"{}")
        if not self.path.rstrip("/").endswith("/chat/completions"):
            return self._json({"error": "not found"}, 404)
        messages = body.get("messages", [])
        reply = decide(messages)
        type(self).log.append({"messages": messages, "reply": reply})
        if body.get("stream"):
            return self._stream(reply)
        message = {"role": "assistant", "content": reply.get("content")}
        finish = "stop"
        if "tool_call" in reply:
            message["tool_calls"] = [{"id": f"call_{len(self.log)}", "type": "function",
                                      "function": reply["tool_call"]}]
            message["content"] = None
            finish = "tool_calls"
        self._json({
            "id": "cmpl-mock", "object": "chat.completion", "created": int(time.time()), "model": "mock-model",
            "choices": [{"index": 0, "message": message, "finish_reason": finish}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 10, "total_tokens": 20},
        })

    def _stream(self, reply: dict):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()

        def chunk(delta: dict, finish=None):
            payload = {"id": "cmpl-mock", "object": "chat.completion.chunk", "created": int(time.time()),
                       "model": "mock-model", "choices": [{"index": 0, "delta": delta, "finish_reason": finish}]}
            self.wfile.write(f"data: {json.dumps(payload)}\n\n".encode())
            self.wfile.flush()

        chunk({"role": "assistant"})
        if "tool_call" in reply:
            call = reply["tool_call"]
            chunk({"tool_calls": [{"index": 0, "id": f"call_{len(self.log)}", "type": "function",
                                   "function": {"name": call["name"], "arguments": call["arguments"]}}]})
            chunk({}, "tool_calls")
        else:
            chunk({"content": reply["content"]})
            chunk({}, "stop")
        usage = {"id": "cmpl-mock", "object": "chat.completion.chunk", "created": int(time.time()),
                 "model": "mock-model", "choices": [],
                 "usage": {"prompt_tokens": 10, "completion_tokens": 10, "total_tokens": 20}}
        self.wfile.write(f"data: {json.dumps(usage)}\n\ndata: [DONE]\n\n".encode())
        self.wfile.flush()

    def _json(self, obj: dict, status: int = 200):
        data = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def start(port: int = 0):
    server = ThreadingHTTPServer(("127.0.0.1", port), _Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, _Handler.log
