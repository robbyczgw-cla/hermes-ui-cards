"""Built-in example cards for `hui_present(demo=...)` and `/cards demo`."""
from __future__ import annotations

import copy

DEMOS: dict[str, dict] = {
    "choice": {
        "type": "choice", "id": "demo-choice",
        "question": "Where should the team offsite go?",
        "options": [
            {"label": "Lisbon", "description": "Sun, cheap flights, good food", "icon": "🌞"},
            {"label": "Berlin", "description": "Easy for everyone by train", "icon": "🚆"},
            {"label": "Online", "description": "No travel, half a day", "icon": "💻"},
        ],
        "allowOther": True,
    },
    "checklist": {
        "type": "checklist", "id": "demo-checklist", "title": "Before the release",
        "items": [
            {"text": "Bump the version", "category": "Code"},
            {"text": "Update the changelog", "category": "Code"},
            {"text": "Run the full test suite", "category": "Code", "checked": True},
            {"text": "Write the announcement", "category": "Comms"},
            {"text": "Tell support about the changes", "category": "Comms"},
        ],
    },
    "compare": {
        "type": "compare", "id": "demo-compare", "title": "Which laptop?",
        "columns": [
            {"title": "Model A", "subtitle": "13-inch", "badge": "Lightest"},
            {"title": "Model B", "subtitle": "14-inch", "best": True},
            {"title": "Model C", "subtitle": "16-inch", "badge": "Most power"},
        ],
        "rows": [
            {"label": "Weight", "values": ["1.1 kg", "1.4 kg", "2.1 kg"]},
            {"label": "Battery", "values": ["14 h", "18 h", "11 h"]},
            {"label": "Price", "values": ["€1,099", "€1,299", "€1,899"]},
        ],
    },
    "form": {
        "type": "form", "id": "demo-form", "title": "Book a table",
        "fields": [
            {"name": "name", "label": "Name", "kind": "text", "required": True},
            {"name": "date", "label": "Date", "kind": "date", "required": True},
            {"name": "guests", "label": "Guests", "kind": "number", "min": 1, "max": 12, "default": 2},
            {"name": "area", "label": "Area", "kind": "select", "options": ["Inside", "Terrace", "Bar"]},
            {"name": "kids", "label": "High chair needed", "kind": "toggle", "default": False},
        ],
        "submitLabel": "Book",
    },
    "confirm": {
        "type": "confirm", "id": "demo-confirm", "title": "Delete old log files?",
        "action": "Delete 14 log files older than 30 days in ~/logs",
        "reason": "They use 2.3 GB and nothing reads them",
        "risk": {"level": "medium", "text": "Deleted files can't be restored"},
        "command": "find ~/logs -name '*.log' -mtime +30 -delete",
    },
    "rating": {
        "type": "rating", "id": "demo-rating", "question": "How useful was this summary?",
        "lowLabel": "Not at all", "highLabel": "Very", "comment": True,
    },
    "slider": {
        "type": "slider", "id": "demo-slider", "question": "What's your budget per night?",
        "min": 50, "max": 400, "step": 10, "default": 150, "unit": "€",
    },
    "schedule": {
        "type": "schedule", "id": "demo-schedule", "title": "Pick a time for the call",
        "timezone": "Europe/Vienna",
        "slots": [
            {"start": "2026-11-12T10:00", "end": "2026-11-12T10:30"},
            {"start": "2026-11-12T14:00", "end": "2026-11-12T14:30"},
            {"start": "2026-11-13T09:00", "end": "2026-11-13T09:30", "unavailable": True},
            {"start": "2026-11-13T16:00", "end": "2026-11-13T16:30"},
        ],
        "noneLabel": "None of these",
    },
    "steps": {
        "type": "steps", "id": "demo-steps", "title": "Set up SSH keys",
        "steps": [
            {"title": "Create a key", "body": "Press Enter to accept the default file.",
             "command": "ssh-keygen -t ed25519"},
            {"title": "Copy it to the server", "command": "ssh-copy-id you@server"},
            {"title": "Test the login", "body": "You should get in without a password.",
             "command": "ssh you@server"},
        ],
    },
    "quiz": {
        "type": "quiz", "id": "demo-quiz", "title": "Quick check: HTTP",
        "questions": [
            {"question": "Which status code means Not Found?", "options": ["200", "301", "404", "500"],
             "answer": 2, "explanation": "4xx codes are client errors; 404 means the resource doesn't exist."},
            {"question": "Which method should not change data on the server?",
             "options": ["GET", "POST", "DELETE"], "answer": 0,
             "explanation": "GET is meant to be safe: it only reads."},
        ],
    },
}


DEMOS.update({
    'plan': {'type':'plan','title':'Release plan','steps':[{'title':'Run tests'},{'title':'Publish notes','optional':True}]},
    'review': {'type':'review','title':'Review changes','items':[{'title':'Update guide'},{'title':'Remove draft'}]},
    'decision': {'type':'decision','title':'Choose a laptop','criteria':[{'id':'cost','label':'Cost','weight':5},{'id':'speed','label':'Speed','weight':4}],'options':[{'label':'A','scores':{'cost':8,'speed':6}},{'label':'B','scores':{'cost':6,'speed':8}}]},
    'calc': {'type':'calc','title':'Monthly cost','inputs':[{'name':'price','label':'Price','default':1200},{'name':'months','label':'Months','default':12}],'outputs':[{'label':'Monthly','expr':'price / months','format':'currency'}]},
    'rank': {'type':'rank','title':'Set priorities','items':[{'label':'Speed'},{'label':'Quality'}]},
    'recipe': {'type':'recipe','title':'Pancakes','servings':2,'ingredients':[{'item':'flour','qty':200,'unit':'g'},{'item':'egg','qty':1}],'steps':[{'text':'Mix and cook.'}]},
    'flashcards': {'type':'flashcards','title':'Vocabulary','cards':[{'front':'Haus','back':'house'},{'front':'Baum','back':'tree'}]},
})


def demo_card(card_type: str) -> dict | None:
    card = DEMOS.get(card_type.strip().lower())
    return copy.deepcopy(card) if card else None
