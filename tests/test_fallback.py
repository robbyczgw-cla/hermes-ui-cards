"""Plain-text version of every card (hui_cards/fallback.py)."""
import pytest

from hui_cards.fallback import render_text
from hui_cards.schema import validate_card


def card(raw: dict) -> dict:
    c, errors, _ = validate_card(raw)
    assert not errors, errors
    return c


def text(raw: dict) -> str:
    return render_text(card(raw))


CHOICE = {"type": "choice", "question": "What are you in the mood for?", "options": [
    {"icon": "🏙️", "label": "City trip", "description": "Museums, cafés, lots of walking"},
    {"icon": "🥾", "label": "Hiking", "description": "Fresh air, little programme"},
    {"icon": "♨️", "label": "Spa", "description": "Thermal baths, sauna"}]}

CONFIRM = {"type": "confirm", "title": "Delete 14 old log files?", "action": "rm ~/logs/*.log.old",
           "reason": "they use 2.3 GB", "risk": {"level": "medium", "text": "the files can't be restored"}}

# One valid card per type, with most optional fields set.
ALL = {
    "choice": CHOICE,
    "checklist": {"type": "checklist", "title": "Packing", "items": [
        {"text": "Passport", "category": "Documents", "checked": True},
        {"text": "Tickets", "note": "printed", "category": "Documents"},
        {"text": "Charger"}, {"text": "Sunscreen", "category": "Beach"}]},
    "compare": {"type": "compare", "title": "Phones", "columns": [
        {"title": "Pixel 10", "subtitle": "Google", "badge": "New", "best": True,
         "pros": ["Great camera"], "cons": ["Pricey"]},
        {"title": "Galaxy S", "pros": ["Bright screen"]}],
        "rows": [{"label": "Price", "values": ["899 €", 749]}, {"label": "5G", "values": [True, None]}]},
    "form": {"type": "form", "title": "Booking", "description": "Who is coming?", "fields": [
        {"name": "name", "label": "Name", "kind": "text", "required": True, "help": "As on your ID"},
        {"name": "size", "label": "Size", "kind": "select", "options": ["S", "M", "L"], "default": "M"},
        {"name": "weight", "label": "Weight", "kind": "number", "min": 0, "max": 200, "unit": "kg"},
        {"name": "vegan", "label": "Vegan", "kind": "toggle", "default": False},
        {"name": "day", "label": "Day", "kind": "date"},
        {"name": "at", "label": "Time", "kind": "time"}]},
    "confirm": CONFIRM,
    "rating": {"type": "rating", "question": "How was it?", "scale": 5, "lowLabel": "bad",
               "highLabel": "great", "comment": True},
    "slider": {"type": "slider", "question": "Budget?", "min": 0, "max": 1000, "step": 50,
               "default": 300, "unit": "€", "minLabel": "tight", "maxLabel": "generous"},
    "schedule": {"type": "schedule", "title": "Meeting", "timezone": "Europe/Vienna", "slots": [
        {"start": "2026-11-12T14:00", "end": "2026-11-12T15:00", "label": "Afternoon"},
        {"start": "2026-11-13T09:00", "unavailable": True}], "noneLabel": "None fits"},
    "steps": {"type": "steps", "title": "Setup", "steps": [
        {"title": "Install", "body": "Download it.\nRun the installer.", "command": "pip install x"},
        {"title": "Start"}]},
    "quiz": {"type": "quiz", "title": "Capitals", "questions": [
        {"question": "Capital of France?", "options": ["Paris", "Rome", "Oslo"], "answer": 0,
         "explanation": "Paris has been the capital since forever."},
        {"question": "Capital of Italy?", "options": ["Bern", "Rome"], "answer": 1}]},
}


def test_protocol_choice_example_exactly():
    assert text(CHOICE) == (
        "What are you in the mood for?\n"
        "1. 🏙️ City trip – Museums, cafés, lots of walking\n"
        "2. 🥾 Hiking – Fresh air, little programme\n"
        "3. ♨️ Spa – Thermal baths, sauna\n"
        "Reply with a number (1–3).")


def test_protocol_confirm_example_exactly():
    assert text(CONFIRM) == (
        "Delete 14 old log files?\n"
        "Action: rm ~/logs/*.log.old\n"
        "Why: they use 2.3 GB\n"
        "Risk (medium): the files can't be restored\n"
        "Reply yes, no, or what to change.")


def test_protocol_examples_match_docs():
    doc = (__import__("pathlib").Path(__file__).resolve().parent.parent / "docs" / "protocol.md").read_text(encoding="utf-8")
    assert text(CHOICE) in doc
    assert text(CONFIRM) in doc


def german(raw: dict) -> dict:
    return {**raw, "lang": "de"}


@pytest.mark.parametrize("ctype", list(ALL))
@pytest.mark.parametrize("lang", ["en", "de"])
def test_every_type_both_languages(ctype, lang):
    out = text({**ALL[ctype], "lang": lang})
    lines = out.split("\n")
    assert len(lines) >= 3
    hint = lines[-1]
    if lang == "de":
        assert hint.startswith(("Antworte", "Kein Termin")) or "Schreib" in hint
        assert "Reply" not in out
    else:
        assert hint.startswith("Reply")
    assert not any(c in out for c in ("**", "`", "#"))
    assert "|" not in out
    assert "\n\n\n" not in out


@pytest.mark.parametrize("ctype", list(ALL))
def test_every_type_default_card_never_empty(ctype):
    """Minimal cards (only required fields) still give a text with a hint."""
    minimal = {
        "choice": {"type": "choice", "question": "Q?", "options": [{"label": "A"}, {"label": "B"}]},
        "checklist": {"type": "checklist", "items": [{"text": "A"}]},
        "compare": {"type": "compare", "columns": [{"title": "A"}, {"title": "B"}]},
        "form": {"type": "form", "fields": [{"name": "a", "label": "A", "kind": "text"}]},
        "confirm": {"type": "confirm", "title": "T", "action": "A"},
        "rating": {"type": "rating", "question": "Q?"},
        "slider": {"type": "slider", "question": "Q?", "min": 1, "max": 2},
        "schedule": {"type": "schedule", "slots": [{"start": "2026-11-12T14:00"}]},
        "steps": {"type": "steps", "steps": [{"title": "A"}, {"title": "B"}]},
        "quiz": {"type": "quiz", "questions": [{"question": "Q", "options": ["a", "b"], "answer": 1}]},
    }[ctype]
    out = text(minimal)
    assert out.strip()
    assert out.split("\n")[-1].startswith("Reply")


def test_german_umlauts_and_wording():
    out = text(german(ALL["steps"]))
    assert out.endswith('Antworte mit "fertig", wenn du durch bist, oder mit der Nummer des Schritts, bei dem du hängst.')
    assert text(german(CONFIRM)).split("\n")[1:4] == [
        "Aktion: rm ~/logs/*.log.old", "Warum: they use 2.3 GB", "Risiko (mittel): the files can't be restored"]
    assert text(german(CHOICE)).endswith("Antworte mit einer Zahl (1–3).")
    assert "★ Empfehlung" in text(german(ALL["compare"]))
    assert "Zeitzone: Europe/Vienna" in text(german(ALL["schedule"]))


def test_no_markdown_in_any_output():
    for raw in ALL.values():
        for lang in ("en", "de"):
            out = text({**raw, "lang": lang})
            assert "**" not in out and "`" not in out and "#" not in out


def test_choice_multiple_hints():
    base = {"type": "choice", "question": "Q?", "multiple": True,
            "options": [{"label": x} for x in "ABCDE"]}
    assert text(base).endswith("Reply with one or more numbers, e.g. 1, 3.")
    assert text({**base, "min": 2, "max": 3}).endswith("Reply with 2–3 numbers, e.g. 1, 3.")
    assert text({**base, "min": 2}).endswith("Reply with at least 2 numbers, e.g. 1, 3.")
    assert text({**base, "max": 3}).endswith("Reply with up to 3 numbers, e.g. 1, 3.")
    assert text({**base, "min": 3, "max": 3}).endswith("Reply with exactly 3 numbers, e.g. 1, 2, 3.")
    assert text({**base, "max": 1}).endswith("Reply with up to 1 number, e.g. 1.")
    assert text(german({**base, "min": 2, "max": 3})).endswith("Antworte mit 2–3 Zahlen, z. B. 1, 3.")
    assert text(german(base)).endswith("Antworte mit einer oder mehreren Zahlen, z. B. 1, 3.")


def test_choice_multiple_example_fits_two_options():
    two = {"type": "choice", "question": "Q?", "multiple": True, "options": [{"label": "A"}, {"label": "B"}]}
    assert text(two).endswith("e.g. 1, 2.")


def test_choice_allow_other():
    single = {**CHOICE, "allowOther": True}
    assert text(single).endswith("Reply with a number (1–3). Or write your own.")
    assert text(german(single)).endswith("Antworte mit einer Zahl (1–3). Oder schreib etwas Eigenes.")
    multi = {**CHOICE, "allowOther": True, "multiple": True}
    assert text(multi).endswith("e.g. 1, 3. Or write your own.")


def test_choice_collapses_newlines_and_keeps_long_text():
    long = "word " * 55
    out = text({"type": "choice", "question": "Line one\nline two", "options": [
        {"label": "A", "description": long.strip()}, {"label": "B\nbee"}]})
    assert out.split("\n")[0] == "Line one line two"
    assert long.strip() in out
    assert "2. B bee" in out


def test_checklist_marks_and_categories():
    out = text(ALL["checklist"]).split("\n")
    # Uncategorized "Charger" forms its own group, in order of first appearance; numbers follow the display.
    assert out == [
        "Packing",
        "",
        "Documents",
        "☑ 1. Passport",
        "☐ 2. Tickets – printed",
        "",
        "☐ 3. Charger",
        "",
        "Beach",
        "☐ 4. Sunscreen",
        "Reply with the numbers you have done, e.g. 1, 4.",
    ]


def test_checklist_without_categories_is_flat():
    out = text({"type": "checklist", "items": [{"text": "A"}, {"text": "B", "checked": True}]})
    assert out == "☐ 1. A\n☑ 2. B\nReply with the numbers you have done, e.g. 1, 2."


def test_compare_blocks():
    out = text(ALL["compare"])
    assert out == "\n".join([
        "Phones",
        "",
        "1. Pixel 10 · New",
        "   ★ Recommended",
        "   Google",
        "   Price: 899 €",
        "   5G: yes",
        "   + Great camera",
        "   – Pricey",
        "",
        "2. Galaxy S",
        "   Price: 749",
        "   5G: –",
        "   + Bright screen",
        "Reply with the number of your pick (1–2).",
    ])


def test_form_fields():
    out = text(ALL["form"]).split("\n")
    assert out[0:2] == ["Booking", "Who is coming?"]
    assert "1. Name (required) – As on your ID" in out
    assert "   Choose one: S, M, L · Default: M" in out
    assert "   Number from 0 to 200 kg" in out
    assert "   yes or no · Default: no" in out
    assert "   Date (YYYY-MM-DD)" in out
    assert "   Time (HH:MM)" in out
    assert out[-1] == 'Reply with your answers, one per line, e.g. "1: …"'


def test_confirm_command_and_details_and_no_change():
    out = text({**CONFIRM, "command": "rm -rf a\n  b", "allowChange": False,
                "details": [{"label": "Files", "value": "14"}]})
    assert out.split("\n") == [
        "Delete 14 old log files?",
        "Action: rm ~/logs/*.log.old",
        "Why: they use 2.3 GB",
        "Risk (medium): the files can't be restored",
        "Command:",
        "  rm -rf a",
        "    b",
        "Files: 14",
        "Reply yes or no.",
    ]
    assert text(german({**CONFIRM, "allowChange": False})).endswith("Antworte mit Ja oder Nein.")


def test_rating_and_slider():
    assert text(ALL["rating"]) == (
        "How was it?\nScale: 1 (bad) – 5 (great)\nReply with a number from 1 to 5, optionally followed by a comment.")
    assert text(ALL["slider"]) == "\n".join([
        "Budget?", "Range: 0 € (tight) – 1000 € (generous), step 50", "Default: 300 €",
        "Reply with a number from 0 € to 1000 €."])
    assert text({"type": "rating", "question": "Q?", "scale": 10}).endswith("Reply with a number from 1 to 10.")


def test_schedule_format_and_unavailable_slots():
    out = text(ALL["schedule"]).split("\n")
    assert out == [
        "Meeting",
        "Time zone: Europe/Vienna",
        "1. Thu 12 Nov 2026, 14:00–15:00 – Afternoon",
        "✗ Fri 13 Nov 2026, 09:00 (not available)",
        "2. None fits",
        "Reply with a number (1–2).",
    ]
    de = text(german(ALL["schedule"])).split("\n")
    assert de[2] == "1. Do. 12. Nov. 2026, 14:00–15:00 – Afternoon"
    assert de[3] == "✗ Fr. 13. Nov. 2026, 09:00 (nicht verfügbar)"


def test_schedule_all_unavailable_and_multiday_and_offset():
    out = text({"type": "schedule", "slots": [{"start": "2026-03-01T10:00", "unavailable": True}]})
    assert "1." not in out and out.endswith("Reply with a time that suits you.")
    out = text({"type": "schedule", "multiple": True, "slots": [
        {"start": "2026-12-31T22:00Z", "end": "2027-01-01T02:00Z"}, {"start": "2026-05-03T08:30+02:00"}]})
    assert "1. Thu 31 Dec 2026, 22:00 – Fri 1 Jan 2027, 02:00 UTC" in out
    assert "2. Sun 3 May 2026, 08:30 UTC+02:00" in out
    assert out.endswith("Reply with one or more numbers, e.g. 1, 2.")


def test_steps_numbering_and_indent():
    out = text(ALL["steps"]).split("\n")
    assert out == [
        "Setup",
        "1. Install",
        "   Download it.",
        "   Run the installer.",
        "     pip install x",
        "2. Start",
        'Reply "done" when finished, or the number of the step where you got stuck.',
    ]


def test_quiz_hides_answers_and_explanations():
    out = text(ALL["quiz"])
    assert out == "\n".join([
        "Capitals",
        "1. Capital of France?",
        "   A) Paris",
        "   B) Rome",
        "   C) Oslo",
        "2. Capital of Italy?",
        "   A) Bern",
        "   B) Rome",
        "Reply with your answers, e.g. 1A 2B.",
    ])
    assert "since forever" not in out and "✓" not in out and "correct" not in out.lower()
    assert "Paris has been" not in text(german(ALL["quiz"]))


def test_unknown_type_and_garbage_never_raise():
    assert render_text({"type": "hologram", "title": "T", "question": "Q?"}) == "T\nQ?\nReply with your answer."
    assert render_text({"type": "hologram", "lang": "de"}) == "Schreib deine Antwort."
    for junk in (None, {}, [], "x", 5, {"type": "choice"}, {"type": "schedule", "slots": [{"start": "bad"}]},
                 {"type": "quiz", "questions": None}, {"type": "form", "fields": [{"kind": "number"}]}):
        out = render_text(junk)
        assert isinstance(out, str) and out.strip()


def test_schedule_offsets_are_shown_in_the_card_timezone():
    from hui_cards.schema import validate_card
    from hui_cards.fallback import render_text
    card, errors, _ = validate_card({"type": "schedule", "timezone": "Europe/Vienna",
                                     "slots": [{"start": "2026-11-12T14:00Z", "end": "2026-11-12T15:00Z"},
                                               {"start": "2026-11-12T16:00"}]})
    assert not errors
    text = render_text(card)
    assert "1. Thu 12 Nov 2026, 15:00–16:00" in text  # 14:00 UTC = 15:00 in Vienna, like the Desktop card
    assert "UTC" not in text
    card, _, _ = validate_card({"type": "schedule", "timezone": "Mars/Base", "slots": [{"start": "2026-11-12T14:00Z"}]})
    text = render_text(card)
    assert "14:00 UTC" in text and text.endswith("Reply with 1 to take it.")


def test_compare_sources_and_as_of():
    raw = {"type": "compare", "asOf": "8 Nov 2026", "columns": [
        {"title": "A", "source": {"label": "Retailer", "url": "https://retailer.at/a"}}, {"title": "B"}],
        "rows": [{"label": "Price", "values": ["€100", "€200"], "sources": ["https://shop.at/item", None]}]}
    out = text(raw)
    assert "Retailer [retailer.at]" in out
    assert "Price: €100 [shop.at]" in out
    assert "Prices checked 8 Nov 2026" in out
    assert "Preise geprüft 8 Nov 2026" in text(german(raw))


def test_new_card_fallbacks():
    from hui_cards.demos import DEMOS
    from hui_cards.schema import validate_card
    for name in ('plan', 'review', 'decision', 'calc', 'rank', 'recipe', 'flashcards'):
        card, errors, _ = validate_card(DEMOS[name])
        assert not errors
        for lang in ('en', 'de'):
            rendered = render_text({**card, 'lang': lang})
            assert card['title'] in rendered
            assert rendered.splitlines()[-1].startswith('Antworte' if lang == 'de' else 'Reply')
    assert 'house' not in render_text(validate_card(DEMOS['flashcards'])[0])


def test_calc_fallback_formats_defaults():
    from hui_cards.schema import validate_card
    card, errors, _ = validate_card({'type':'calc', 'title':'Total', 'inputs':[{'name':'x','label':'Amount','default':1234.56}], 'outputs':[{'label':'Total','expr':'x','format':'currency','decimals':2}]})
    assert not errors
    assert '1,234.56 €' in render_text(card)
    assert '1.234,56 €' in render_text({**card, 'lang':'de'})
