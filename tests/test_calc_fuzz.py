"""Seeded grammar parity test; exercises both parsers and evaluators in one Node process."""
import json
import math
import random
import subprocess
from pathlib import Path

from hui_cards.calc_expr import calc_parse, calc_eval

ROOT = Path(__file__).resolve().parents[1]


def test_seeded_calc_fuzz():
    rng = random.Random(20261105)
    atoms = ['0', '1', '2', '3', '-1', '-2', '0.5', '2.5', '-0.5', '10', '1000', '0.0000001', 'x', 'y']
    funcs = {'min': (1, 3), 'max': (1, 3), 'round': (1, 2), 'floor': (1, 1), 'ceil': (1, 1), 'sqrt': (1, 1), 'abs': (1, 1), 'pow': (2, 2), 'log': (1, 1), 'exp': (1, 1), 'if': (3, 3)}
    def gen(depth):
        if not depth or rng.random() < .23: return rng.choice(atoms)
        kind = rng.randrange(4)
        if kind == 0: return '-(' + gen(depth - 1) + ')'
        if kind == 1: return '(' + gen(depth - 1) + rng.choice(['+', '-', '*', '/', '^', '<', '<=', '>', '>=', '==', '!=']) + gen(depth - 1) + ')'
        f = rng.choice(list(funcs)); lo, hi = funcs[f]
        return f + '(' + ','.join(gen(depth - 1) for _ in range(rng.randint(lo, hi))) + ')'
    exprs = [gen(rng.randrange(1, 6)) for _ in range(3000)]
    exprs += ['٢+1', '1\u0085+2', 'min(2)', 'max(2)', 'exp(log(0))', '(10^200*10^200)>0', 'round(1,100000000)', 'round(1,-1)', 'if(0,1/0,5)']
    exprs += ['floor(exp(log(max(-(-1),3))))', 'ceil((pow(0.5,-0.5)^ceil(10)))']
    script = r'''const fs=require('fs'), vm=require('vm'); const s=fs.readFileSync('desktop/src/10-validate.js','utf8'); vm.runInThisContext(s.slice(s.indexOf('function calcParse('))); const exprs=JSON.parse(fs.readFileSync(0,'utf8')); process.stdout.write(JSON.stringify(exprs.map(e=>{const a=calcParse(e,['x','y']); return [a,Array.isArray(a)?calcEval(a,{x:2.5,y:-1}):null]})));'''
    result = subprocess.run(['node', '-e', script], input=json.dumps(exprs), cwd=ROOT, text=True, capture_output=True, check=True)
    for expr, (js_ast, js_value) in zip(exprs, json.loads(result.stdout), strict=True):
        ast = calc_parse(expr, ['x', 'y'])
        assert ast == js_ast, expr
        value = calc_eval(ast, {'x': 2.5, 'y': -1}) if isinstance(ast, list) else None
        assert (value is None and js_value is None) or (value is not None and js_value is not None and math.isclose(value, js_value, rel_tol=1e-12, abs_tol=1e-12)), expr
