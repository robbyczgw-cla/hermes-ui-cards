import json
import subprocess
from pathlib import Path

import pytest
from hui_cards.calc_expr import calc_parse, calc_eval

ROOT = Path(__file__).resolve().parents[1]
CORPUS = [
 '1', '1.25', '.5', '1.', 'x', 'x+y', 'x-y', 'x*y', 'x/y', 'x^y',
 '1+2*3', '(1+2)*3', '2^3^2', '-2^2', '(-2)^2', '2^-2', '--2',
 '1<2', '1<=1', '2>1', '2>=2', '1==1', '1!=2', '1+2<4',
 'min(1,2,3)', 'max(1,2,3)', 'round(1.234,2)', 'round(-1.5)',
 'floor(1.9)', 'ceil(1.1)', 'sqrt(9)', 'abs(-4)', 'pow(2,3)',
 'log(1)', 'exp(0)', 'if(x>1,3,4)', 'if(0,1/0,5)', '1/0',
 'sqrt(-1)', 'log(0)', 'pow(-1,.5)', 'exp(999)', '1/0 > 2',
 '', '(', '1+', '1 2', 'unknown', 'foo(1)', 'min()', 'if(1,2)',
 'sqrt(1,2)', '1=2', '"x"', 'x.y', 'min(1,)', '1**2',
 '('*33+'1'+')'*33, '('*32+'1'+')'*32, '- '*34+'1',
 '  x + y  ', '2^3*4', '4/2/2', '2-3-4', '0.1+0.2',
 'max(x,min(y,4))', 'if(1, 7, sqrt(-1))', '1!=2==1', 'x_1',
]

def test_expression_parity():
    script = r'''const fs=require('fs'),vm=require('vm');
const c=vm.createContext({SCHEMA:JSON.parse(fs.readFileSync('hui_cards/cards.schema.json','utf8'))});
vm.runInContext(fs.readFileSync('desktop/src/10-validate.js','utf8'),c);
const parse=vm.runInContext('calcParse',c), evaluate=vm.runInContext('calcEval',c);
for(const e of JSON.parse(process.argv[1])) { const ast=parse(e,['x','y','x_1']); console.log(JSON.stringify([ast,Array.isArray(ast)?evaluate(ast,{x:2,y:3,x_1:4}):null])); }'''
    proc = subprocess.run(['node','-e',script,json.dumps(CORPUS)],cwd=ROOT,text=True,capture_output=True,check=True)
    for expr, line in zip(CORPUS,proc.stdout.splitlines(),strict=True):
        js_ast, js_value = json.loads(line)
        ast = calc_parse(expr,['x','y','x_1'])
        assert ast == js_ast, expr
        value = calc_eval(ast,{'x':2,'y':3,'x_1':4}) if isinstance(ast,list) else None
        if value is None: assert js_value is None, expr
        else: assert value == pytest.approx(js_value), expr

@pytest.mark.parametrize('expr, expected', [('2^3^2',512),('-2^2',-4),('if(0,1/0,5)',5),('1/0',None),('sqrt(-1)',None)])
def test_expression_results(expr, expected):
    assert calc_eval(calc_parse(expr, []), {}) == expected
