"""Small, bounded calculator expression parser and evaluator."""
import math
import re

_FUNCS = {'min': (1, 99), 'max': (1, 99), 'round': (1, 2), 'floor': (1, 1), 'ceil': (1, 1), 'sqrt': (1, 1), 'abs': (1, 1), 'pow': (2, 2), 'log': (1, 1), 'exp': (1, 1), 'if': (3, 3)}

class _Error(Exception):
    def __init__(self, message, at): self.message, self.at = message, at

def calc_parse(expr, names):
    pos = 0
    def skip():
        nonlocal pos
        while pos < len(expr) and expr[pos] in ' \t\n\r': pos += 1
    def parse(level=0, depth=0):
        nonlocal pos
        if depth > 32: raise _Error('maximum depth exceeded', pos)
        skip()
        if level < 3:
            left = parse(level + 1, depth)
            ops = [['<=','>=','==','!=','<','>'], ['+','-'], ['*','/']][level]
            while True:
                skip(); op = next((x for x in ops if expr.startswith(x, pos)), None)
                if not op: break
                pos += len(op); left = ['binary', op, left, parse(level + 1, depth + 1)]
            return left
        if level == 3:
            if expr.startswith('-', pos):
                pos += 1; return ['unary', parse(3, depth + 1)]
            left = parse(4, depth)
            skip()
            if expr.startswith('^', pos):
                pos += 1; left = ['binary', '^', left, parse(3, depth + 1)]
            return left
        skip(); start = pos
        if pos < len(expr) and expr[pos] == '(':
            pos += 1; node = parse(0, depth + 1); skip()
            if pos >= len(expr) or expr[pos] != ')': raise _Error('expected ")"', pos)
            pos += 1; return node
        m = re.match(r'(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)', expr[pos:])
        if m:
            pos += len(m.group()); value = float(m.group())
            if not math.isfinite(value): raise _Error('invalid number', start)
            return ['number', value]
        m = re.match(r'[A-Za-z_][A-Za-z0-9_]*', expr[pos:])
        if m:
            name = m.group(); pos += len(name); skip()
            if pos < len(expr) and expr[pos] == '(':
                if name not in _FUNCS: raise _Error(f'unknown function "{name}"', start)
                pos += 1; args = []; skip()
                if pos >= len(expr) or expr[pos] != ')':
                    while True:
                        args.append(parse(0, depth + 1)); skip()
                        if pos >= len(expr) or expr[pos] != ',': break
                        pos += 1
                if pos >= len(expr) or expr[pos] != ')': raise _Error('expected ")"', pos)
                pos += 1; lo, hi = _FUNCS[name]
                if not lo <= len(args) <= hi: raise _Error(f'wrong number of arguments for "{name}"', start)
                return ['call', name, args]
            if name not in names: raise _Error(f'unknown name "{name}"', start)
            return ['name', name]
        raise _Error('expected expression', pos)
    try:
        if len(expr) > 300: raise _Error('expression too long', 300)
        result = parse(); skip()
        if pos != len(expr): raise _Error('unexpected character', pos)
        return result
    except _Error as e: return {'message': e.message, 'at': e.at}

def calc_eval(ast, values):
    def ev(n):
        t = n[0]
        if t == 'number': value = float(n[1])
        elif t == 'name': value = float(values[n[1]])
        elif t == 'unary': value = -ev(n[1])
        elif t == 'binary':
            a, b, op = ev(n[2]), ev(n[3]), n[1]
            if op == '+': value = a + b
            elif op == '-': value = a - b
            elif op == '*': value = a * b
            elif op == '/': value = a / b
            elif op == '^': value = math.pow(a, b)
            else: value = float({'<': a < b, '<=': a <= b, '>': a > b, '>=': a >= b, '==': a == b, '!=': a != b}[op])
        else:
            name, args = n[1], n[2]
            if name == 'if': value = ev(args[1] if ev(args[0]) else args[2])
            else:
                a = [ev(x) for x in args]
                if name == 'round':
                    digits = a[1] if len(a) > 1 else 0.0
                    if digits < 0: raise ValueError('negative digits')
                    factor = math.pow(10.0, min(digits, 12.0))
                    scaled = a[0] * factor + 0.5
                    if not math.isfinite(scaled): raise ValueError('invalid result')
                    value = float(math.floor(scaled)) / factor
                elif name in ('min', 'max'): value = (min if name == 'min' else max)(a)
                else: value = {'floor': math.floor, 'ceil': math.ceil, 'sqrt': math.sqrt, 'abs': abs, 'pow': math.pow, 'log': math.log, 'exp': math.exp}[name](*a)
        value = float(value)
        if not math.isfinite(value): raise ValueError('invalid result')
        return value
    try: return ev(ast)
    except (ArithmeticError, ValueError, KeyError, TypeError, IndexError): return None
