// Pruebas de assets/json.js, sin dependencias: node scripts/probar-json.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { parsear, escribir } = require('../assets/json.js');

let fallos = 0;
const caso = (nombre, fn) => {
  try { fn(); console.log('ok   ', nombre); } catch (e) { fallos++; console.log('FALLO', nombre, '\n     ', e.message); }
};
const formatear = (s, o) => escribir(parsear(s).arbol, o).texto;
const error = (s) => { try { parsear(s); } catch (e) { return e; } throw new Error('no dio error: ' + s); };

// Válidos: el resultado coincide con JSON.stringify(JSON.parse(x), null, 2).
const validos = [
  '{"a":1,"b":[true,false,null],"c":{"d":"e"}}', '[]', '{}', '"solo una cadena"', '0', '-0.5',
  '[1,[2,[3,[]]],{}]', '{"unicode":"é ñ 😀","escapes":"\\"\\\\\\b\\f\\n\\r\\t"}', ' \n\t{ "a" : [ 1 , 2 ] } \r\n',
];
for (const s of validos) {
  caso('válido ' + s.slice(0, 30), () => assert.equal(formatear(s), JSON.stringify(JSON.parse(s), null, 2)));
  caso('minificado ' + s.slice(0, 30), () => assert.equal(formatear(s, { sangria: '' }), JSON.stringify(JSON.parse(s))));
}

caso('conserva enteros grandes', () => assert.equal(formatear('{"id":9007199254740993}', { sangria: '' }), '{"id":9007199254740993}'));
caso('conserva los números como se escribieron', () => assert.equal(formatear('[1.0,1E5,0.10]', { sangria: '' }), '[1.0,1E5,0.10]'));
caso('conserva los escapes como se escribieron', () => assert.equal(formatear('["\\u00e9"]', { sangria: '' }), '["\\u00e9"]'));
caso('ordena claves', () => assert.equal(formatear('{"b":1,"a":{"d":1,"c":2}}', { sangria: '', ordenar: true }), '{"a":{"c":2,"d":1},"b":1}'));
caso('sangría con tabulador', () => assert.equal(formatear('{"a":[1]}', { sangria: '\t' }), '{\n\t"a": [\n\t\t1\n\t]\n}'));
caso('ignora el BOM', () => assert.equal(formatear('﻿[1]', { sangria: '' }), '[1]'));
caso('html escapado y por líneas', () => {
  const { html } = escribir(parsear('{"<a>":"&"}').arbol);
  assert.equal(html.split('\n').length, 3);
  assert.ok(html.includes('<span class="j-k">"&lt;a&gt;"</span>') && html.includes('"&amp;"'));
});
caso('estadísticas', () => {
  const r = parsear('{"a":[1,{"b":2}]}');
  assert.equal(r.valores, 5);
  assert.equal(r.profundidad, 3);
});
caso('aviso de clave repetida', () => {
  const r = parsear('{\n "a": 1,\n "a": 2\n}');
  assert.equal(r.avisos.length, 1);
  assert.equal(r.avisos[0].linea, 3);
});

// Errores: mensaje esperado (fragmento) y posición.
const errores = [
  ['', /termina antes de tiempo/, 1, 1],
  ['{"a":1,}', /Sobra la coma antes de «}»/, 1, 7],
  ['[1,2,]', /Sobra la coma antes de «]»/, 1, 5],
  ["{'a':1}", /comillas dobles/, 1, 2],
  ['{a:1}', /Las claves van entre comillas dobles/, 1, 2],
  ['{"a":1 "b":2}', /Falta una coma/, 1, 8],
  ['{"a" 1}', /Falta «:»/, 1, 6],
  ['{\n  "a": [1, 2\n}', /Se esperaba «,» o «]» y llega «}»/, 3, 1],
  ['{"a":1', /Falta «}» para cerrar el objeto que se abre en la línea 1, columna 1/, 1, 7],
  ['[1, 2', /Falta «]»/, 1, 6],
  ['{"a": True}', /minúsculas \(true\)/, 1, 7],
  ['{"a": undefined}', /no en JSON/, 1, 7],
  ['{"a": hola}', /"hola"/, 1, 7],
  ['{"a": 01}', /no pueden empezar por 0/, 1, 7],
  ['[1.]', /punto decimal/, 1, 3],
  ['[.5]', /antes del punto/, 1, 2],
  ['[+1]', /signo/, 1, 2],
  ['["a\nb"]', /Salto de línea dentro de una cadena/, 1, 4],
  ['["\\x"]', /Escape no válido/, 1, 3],
  ['["\\u12"]', /cuatro cifras/, 1, 3],
  ['["abc', /Falta cerrar la cadena/, 1, 2],
  ['// hola\n{}', /comentarios/, 1, 1],
  ['{} {}', /Sobra texto/, 1, 4],
  ['[1,,2]', /Sobra una coma/, 1, 4],
];
for (const [s, re, linea, columna] of errores) {
  caso('error ' + JSON.stringify(s), () => {
    const e = error(s);
    assert.match(e.message, re);
    assert.deepEqual([e.linea, e.columna], [linea, columna], 'posición');
  });
}

caso('anidamiento muy profundo no revienta', () => {
  const s = '['.repeat(200000) + ']'.repeat(200000);
  try { parsear(s); } catch (e) { assert.equal(e.name, 'ErrorJson'); }
});

console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
