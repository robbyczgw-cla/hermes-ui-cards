"""Map normalized cards to a HUI+ node (or None for the text fallback).

Card       | HUI+ node | Differences / fallback
-----------|-----------|-------------------------------------------------------
choice     | choice    | Image URLs unsupported; text fallback when present.
checklist  | checklist | HUI+ replies contain item text, not item IDs.
compare    | text      | HUI+ compare has no pick action.
form       | form      | Required constraints, unanswered toggles and unsupported field kinds use text.
confirm    | confirm   | HUI+ has yes/no only; change-enabled cards use text.
steps      | guide     | Commands are included in each step body.
decision   | decision  | Weights and scores retained; reply uses labels.
calc       | calc      | Formula and inputs retained; unsupported variants use text.
rank       | rank      | Reply uses labels rather than item IDs.
schedule   | slots     | Single selection only; unavailable slots omitted.
recipe     | text      | HUI+ recipe cannot return the missing-ingredient selection.
flashcards | text      | HUI+ practice does not send an answer to the model.
rating     | scale     | Comments unsupported; use text when requested.
slider     | scale     | Default and unit unsupported; use text when present.
quiz       | quiz      | HUI+ reports score, not individual answers.
plan       | text      | No editable plan with notes and ordering.
review     | text      | No keep/drop/undecided review with notes.

Limits below follow the strict HUI+ example validator. No data is truncated to fit.
"""
from __future__ import annotations


def _pick(obj, keys):
    return {k: obj[k] for k in keys if k in obj}


def _js_len(value):
    return len(value.encode('utf-16-le')) // 2


def to_hui_node(card: dict) -> dict | None:
    t = card['type']
    node = {'type': t, 'id': card['cardId']}
    if t == 'choice':
        opts = card['options']
        if any('image' in o or 'badge' in o or _js_len(o['label']) > 60 or _js_len(o.get('icon', '')) > 8 for o in opts) or len({o['label'] for o in opts}) != len(opts):
            return None
        node.update(_pick(card, ('question', 'multiple', 'allowOther', 'submitLabel')))
        if card.get('multiple'):
            node.update(_pick(card, ('min', 'max')))
        node['options'] = [_pick(o, ('id', 'label', 'description', 'icon')) for o in opts]
    elif t == 'checklist':
        if len(card['items']) > 100 or any(_js_len(i['text']) > 80 for i in card['items']):
            return None
        node.update(_pick(card, ('title',)))
        node['items'] = [_pick(i, ('id', 'text', 'category', 'checked')) for i in card['items']]
    elif t == 'form':
        fields = card['fields']
        if card.get('description') or any(f.get('required') or (f['kind'] == 'toggle' and 'default' not in f) or f['kind'] not in ('text', 'number', 'date', 'select', 'toggle') or f.get('maxLength') or f.get('help') or f.get('unit') for f in fields):
            return None
        node.update(_pick(card, ('title',)))
        node['fields'] = [_pick(f, ('name', 'label', 'kind', 'placeholder', 'min', 'max', 'step', 'options', 'default')) for f in fields]
        node['submit'] = {'label': card.get('submitLabel', 'Submit')}
    elif t == 'confirm':
        if card.get('allowChange', True):
            return None
        parts = [card['action'], card.get('reason'), (str(card['risk'].get('level', '')) + ': ' + card['risk']['text']) if card.get('risk') else None, card.get('command'), card.get('details')]
        node.update(_pick(card, ('title', 'confirmLabel', 'cancelLabel')))
        node['text'] = '\n\n'.join(p for p in parts if isinstance(p, str) and p)
    elif t == 'steps':
        node['type'] = 'guide'
        node['title'] = card['title']
        node['steps'] = []
        for s in card['steps']:
            body = '\n\n'.join(x for x in (s.get('body'), s.get('command')) if x) or s['title']
            if _js_len(body) > 2000 or s.get('image'):
                return None
            node['steps'].append({**_pick(s, ('id', 'title')), 'body': body})
    elif t == 'decision':
        if not (2 <= len(card['criteria']) <= 8 and 2 <= len(card['options']) <= 6):
            return None
        node.update(_pick(card, ('title', 'note')))
        node['criteria'] = [_pick(c, ('id', 'label', 'weight')) for c in card['criteria']]
        node['options'] = [_pick(o, ('id', 'label', 'scores', 'note')) for o in card['options']]
        if any(set(o['scores']) != {c['id'] for c in node['criteria']} for o in node['options']):
            return None
    elif t == 'calc':
        from .calc_expr import calc_eval, calc_parse
        if card.get('currency', 'EUR') != 'EUR' or len(card['inputs']) > 8 or len(card['outputs']) > 8:
            return None
        values = {i['name']: i['default'] for i in card['inputs']}
        for i in card['inputs']:
            if i['name'] in ('pi', 'e'):
                return None
            if i.get('kind') == 'slider' and (i.get('min') is None or i.get('max') is None or i['min'] >= i['max'] or not i['min'] <= i['default'] <= i['max'] or i.get('step', 1) <= 0):
                return None
            if i.get('kind') == 'select' and not any(o['value'] == i['default'] for o in i.get('options', [])):
                return None
            if i.get('kind') == 'toggle' and i['default'] not in (0, 1):
                return None
        for o in card['outputs']:
            ast = calc_parse(o['expr'], set(values))
            value = None if isinstance(ast, dict) else calc_eval(ast, values)
            if value is None or (o.get('format') == 'percent' and abs(value) > 5):
                return None
        node.update(_pick(card, ('title', 'note')))
        node['inputs'] = [_pick(i, ('name', 'label', 'kind', 'min', 'max', 'step', 'default', 'unit', 'options')) for i in card['inputs']]
        node['outputs'] = [_pick(o, ('label', 'expr', 'format', 'decimals', 'unit', 'emphasis')) for o in card['outputs']]
    elif t == 'rank':
        if not 2 <= len(card['items']) <= 10 or len({i['label'] for i in card['items']}) != len(card['items']):
            return None
        node.update(_pick(card, ('prompt', 'submitLabel')))
        node.setdefault('prompt', card['title'])
        node['items'] = [{**_pick(i, ('id', 'label')), **({'description': i['detail']} if i.get('detail') else {})} for i in card['items']]
    elif t == 'schedule':
        slots = [s for s in card['slots'] if not s.get('unavailable')]
        if card.get('multiple') or not 1 <= len(slots) <= 8:
            return None
        node['type'] = 'slots'
        node.update(_pick(card, ('title', 'timezone', 'noneLabel')))
        node['slots'] = [_pick(s, ('id', 'start', 'end', 'label', 'note')) for s in slots]
    elif t == 'rating':
        if card.get('comment'):
            return None
        node.update(type='scale', question=card['question'], min=1, max=card.get('scale', 5), style='segments' if card.get('style') == 'numbers' else 'stars')
        node['labels'] = {k: card[v] for k, v in (('min', 'lowLabel'), ('max', 'highLabel')) if card.get(v)}
    elif t == 'slider':
        if card.get('unit') or 'default' in card or card['max'] - card['min'] > 100 or card.get('step', 1) <= 0 or (card['max'] - card['min']) / card.get('step', 1) > 100:
            return None
        node.update(type='scale', **_pick(card, ('question', 'min', 'max', 'step')))
        node['style'] = 'slider'
        node['labels'] = {k: card[v] for k, v in (('min', 'minLabel'), ('max', 'maxLabel')) if card.get(v)}
    elif t == 'quiz':
        if len(card['questions']) > 12 or any(not 2 <= len(q['options']) <= 6 for q in card['questions']):
            return None
        node.update(_pick(card, ('title',)))
        node['questions'] = [{'q': q['question'], **_pick(q, ('options', 'answer', 'explanation'))} for q in card['questions']]
    else:
        return None
    return node
