/**
 * Analizador y formateador de JSON sin dependencias (lo usa json-formatter.html).
 *
 * No lee el documento con JSON.parse, por tres motivos:
 *  - Da errores en español con línea, columna y una pista de qué falta.
 *  - Conserva cada número y cada cadena tal como se escribieron. JSON.parse redondea los enteros
 *    de más de 15-16 cifras (p. ej. 9007199254740993 pasa a ser 9007199254740992), algo grave en IDs.
 *  - Avisa de las claves repetidas, que JSON.parse resuelve en silencio quedándose con la última.
 *
 * Funciona en el navegador (window.DevJson) y en Node (module.exports), donde lo usan las pruebas
 * de scripts/probar-json.mjs.
 */
(function (raiz) {
  'use strict';

  function posicion(texto, pos) {
    const antes = texto.slice(0, pos);
    const salto = antes.lastIndexOf('\n');
    let linea = 1;
    for (let k = antes.indexOf('\n'); k !== -1; k = antes.indexOf('\n', k + 1)) linea++;
    return { linea, columna: pos - salto };
  }

  class ErrorJson extends Error {
    constructor(mensaje, pos, texto) {
      super(mensaje);
      this.name = 'ErrorJson';
      this.pos = pos;
      Object.assign(this, posicion(texto, pos));
    }
  }

  const NUMERO = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
  const PALABRA = /[A-Za-z_$][\w$]*/y;
  const ESCAPES = '"\\/bfnrt';
  const INICIO_VALOR = /["{[\-0-9tfn]/;

  function mostrar(c) {
    if (c === undefined) return 'el final del texto';
    const nombres = { '\n': 'un salto de línea', '\r': 'un salto de línea', '\t': 'un tabulador' };
    return nombres[c] || '«' + c + '»';
  }

  /**
   * Analiza `texto` y devuelve { arbol, avisos, valores, profundidad }, o lanza ErrorJson.
   * Nodos del árbol: { t: 'obj', v: [{ k: claveTalCual, n: claveDecodificada, v: nodo }] },
   * { t: 'lis', v: [nodo] } y { t: 'cad' | 'num' | 'bool' | 'nulo', v: textoTalCual }.
   */
  function parsear(texto) {
    const n = texto.length;
    let i = texto.charCodeAt(0) === 0xfeff ? 1 : 0; // marca BOM
    let valores = 0;
    let profundidad = 0;
    const avisos = [];
    const fallo = (mensaje, pos = i) => { throw new ErrorJson(mensaje, pos, texto); };
    const donde = (pos) => { const p = posicion(texto, pos); return `la línea ${p.linea}, columna ${p.columna}`; };

    function espacios() {
      while (i < n) {
        const c = texto[i];
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r') i++;
        else if (c === '/' && (texto[i + 1] === '/' || texto[i + 1] === '*')) fallo('JSON no admite comentarios (// o /* */): quítalos.');
        else break;
      }
    }

    function cadena() {
      const ini = i++;
      for (;;) {
        if (i >= n) fallo('Falta cerrar la cadena con comillas dobles (").', ini);
        const c = texto[i];
        if (c === '"') { i++; return texto.slice(ini, i); }
        if (c === '\\') {
          const e = texto[i + 1];
          if (e === 'u') {
            if (!/^[0-9a-fA-F]{4}$/.test(texto.substr(i + 2, 4))) fallo('Escape \\u incompleto: necesita cuatro cifras hexadecimales, como en \\u00e9.');
            i += 6;
          } else if (e !== undefined && ESCAPES.includes(e)) i += 2;
          else fallo(`Escape no válido «\\${e || ''}»: los válidos son \\" \\\\ \\/ \\b \\f \\n \\r \\t y \\uXXXX. Para una barra invertida escribe \\\\.`);
        } else if (texto.charCodeAt(i) < 0x20) {
          fallo(c === '\n' || c === '\r'
            ? 'Salto de línea dentro de una cadena: escríbelo como \\n, o cierra antes las comillas.'
            : 'Carácter de control dentro de una cadena: escríbelo con un escape (\\t, \\uXXXX…).');
        } else i++;
      }
    }

    function numero() {
      NUMERO.lastIndex = i;
      const m = NUMERO.exec(texto);
      if (!m) fallo('Número mal escrito: después de «-» tiene que venir una cifra.');
      const fin = i + m[0].length;
      const sig = texto[fin];
      if (sig >= '0' && sig <= '9') fallo('Los números no pueden empezar por 0 (salvo el propio 0, o 0.5). Si es un código con ceros a la izquierda, ponlo entre comillas.');
      if (sig === '.') fallo('Después del punto decimal tiene que venir al menos una cifra.', fin);
      if (sig === 'e' || sig === 'E') fallo('Exponente mal escrito: después de la «e» tiene que venir una cifra (1e5, 2.5E-3).', fin);
      i = fin;
      return m[0];
    }

    function valor(prof) {
      espacios();
      valores++;
      const c = texto[i];
      if (c === '{') return objeto(prof);
      if (c === '[') return lista(prof);
      if (c === '"') return { t: 'cad', v: cadena() };
      if (c === '-' || (c >= '0' && c <= '9')) return { t: 'num', v: numero() };
      for (const lit of ['true', 'false', 'null']) {
        if (texto.startsWith(lit, i)) { i += lit.length; return { t: lit === 'null' ? 'nulo' : 'bool', v: lit }; }
      }
      if (c === undefined) fallo('El JSON termina antes de tiempo: falta un valor.');
      if (c === "'") fallo('Las cadenas van entre comillas dobles ("), no simples.');
      if (c === '+') fallo('Los números no llevan signo «+» delante.');
      if (c === '.') fallo('Los números necesitan una cifra antes del punto: 0.5, no .5.');
      if (c === ',') fallo('Sobra una coma, o falta un valor antes de ella.');
      PALABRA.lastIndex = i;
      const m = PALABRA.exec(texto);
      if (m) {
        const p = m[0];
        if (/^(true|false|null)$/i.test(p)) fallo(`«${p}» no es válido: en JSON se escribe en minúsculas (${p.toLowerCase()}).`);
        if (p === 'undefined' || p === 'NaN' || p === 'Infinity') fallo(`«${p}» existe en JavaScript pero no en JSON: usa null o un número.`);
        fallo(`«${p}» no es un valor JSON. Si es texto, ponlo entre comillas dobles: "${p}".`);
      }
      fallo(`Se esperaba un valor (objeto, lista, cadena, número, true, false o null) y llega ${mostrar(c)}.`);
    }

    function cierre(sig, cerrar, ini, que) {
      if (sig === undefined) fallo(`Falta «${cerrar}» para cerrar ${que} que se abre en ${donde(ini)}.`);
      if (INICIO_VALOR.test(sig)) fallo(`Falta una coma antes de este valor (o «${cerrar}» para cerrar ${que}).`);
      fallo(`Se esperaba «,» o «${cerrar}» y llega ${mostrar(sig)}. ${que[0].toUpperCase() + que.slice(1)} se abre en ${donde(ini)}.`);
    }

    function objeto(prof) {
      const ini = i++;
      if (prof + 1 > profundidad) profundidad = prof + 1;
      const miembros = [];
      const vistas = new Set();
      let coma = -1;
      espacios();
      if (texto[i] === '}') { i++; return { t: 'obj', v: miembros }; }
      for (;;) {
        espacios();
        const c = texto[i];
        if (c !== '"') {
          if (c === '}') fallo('Sobra la coma antes de «}».', coma);
          if (c === undefined) fallo(`Falta «}» para cerrar el objeto que se abre en ${donde(ini)}.`);
          if (c === "'") fallo('Las claves van entre comillas dobles ("), no simples.');
          if (/[A-Za-z_$0-9]/.test(c)) fallo('Las claves van entre comillas dobles: "clave": valor.');
          fallo(`Se esperaba una clave entre comillas dobles y llega ${mostrar(c)}.`);
        }
        const posClave = i;
        const clave = cadena();
        const nombre = JSON.parse(clave); // ya validada: solo decodifica los escapes
        if (vistas.has(nombre)) {
          avisos.push({ mensaje: `Clave repetida ${clave}: la mayoría de programas se queda solo con el último valor.`, pos: posClave, ...posicion(texto, posClave) });
        }
        vistas.add(nombre);
        espacios();
        if (texto[i] !== ':') fallo(`Falta «:» después de la clave ${clave}.`);
        i++;
        const v = valor(prof + 1);
        miembros.push({ k: clave, n: nombre, v });
        espacios();
        const sig = texto[i];
        if (sig === ',') { coma = i++; continue; }
        if (sig === '}') { i++; return { t: 'obj', v: miembros }; }
        cierre(sig, '}', ini, 'el objeto');
      }
    }

    function lista(prof) {
      const ini = i++;
      if (prof + 1 > profundidad) profundidad = prof + 1;
      const elementos = [];
      let coma = -1;
      espacios();
      if (texto[i] === ']') { i++; return { t: 'lis', v: elementos }; }
      for (;;) {
        espacios();
        if (texto[i] === ']' && coma !== -1) fallo('Sobra la coma antes de «]».', coma);
        if (texto[i] === undefined) fallo(`Falta «]» para cerrar la lista que se abre en ${donde(ini)}.`);
        elementos.push(valor(prof + 1));
        espacios();
        const sig = texto[i];
        if (sig === ',') { coma = i++; continue; }
        if (sig === ']') { i++; return { t: 'lis', v: elementos }; }
        cierre(sig, ']', ini, 'la lista');
      }
    }

    let arbol;
    try {
      arbol = valor(0);
    } catch (e) {
      if (e instanceof RangeError) fallo('El JSON tiene demasiados niveles anidados para analizarlo.');
      throw e;
    }
    espacios();
    if (i < n) fallo('Sobra texto después del final del JSON: ¿hay una llave o un corchete de más, o dos documentos seguidos?');
    return { arbol, avisos, valores, profundidad };
  }

  const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /**
   * Escribe el árbol de parsear(). Opciones: sangria (texto de un nivel; '' = minificado),
   * ordenar (claves de los objetos por orden alfabético) y html (si es false, no genera el marcado).
   * Devuelve { texto, html }: el html lleva <span class="j-k|s|n|b|z|p"> por token y ningún
   * token contiene saltos de línea, así que se puede partir por '\n' en líneas.
   */
  function escribir(arbol, opciones = {}) {
    const sangria = opciones.sangria ?? '  ';
    const ordenar = !!opciones.ordenar;
    const html = opciones.html !== false;
    const texto = [];
    const marcado = [];
    const salto = sangria ? '\n' : '';
    const dosPuntos = sangria ? ': ' : ':';
    const t = (s, clase) => {
      texto.push(s);
      if (html) marcado.push(clase ? `<span class="j-${clase}">${escapar(s)}</span>` : escapar(s));
    };
    const CLASES = { cad: 's', num: 'n', bool: 'b', nulo: 'z' };

    function v(nodo, nivel) {
      if (nodo.t !== 'obj' && nodo.t !== 'lis') return t(nodo.v, CLASES[nodo.t]);
      const obj = nodo.t === 'obj';
      let hijos = nodo.v;
      if (!hijos.length) return t(obj ? '{}' : '[]', 'p');
      if (obj && ordenar) hijos = [...hijos].sort((a, b) => (a.n < b.n ? -1 : a.n > b.n ? 1 : 0));
      const dentro = salto + sangria.repeat(nivel + 1);
      t(obj ? '{' : '[', 'p');
      hijos.forEach((h, idx) => {
        if (idx) t(',', 'p');
        t(dentro);
        if (obj) { t(h.k, 'k'); t(dosPuntos, 'p'); v(h.v, nivel + 1); } else v(h, nivel + 1);
      });
      t(salto + sangria.repeat(nivel));
      t(obj ? '}' : ']', 'p');
    }

    v(arbol, 0);
    return { texto: texto.join(''), html: html ? marcado.join('') : null };
  }

  const api = { parsear, escribir, ErrorJson };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.DevJson = api;
})(typeof window !== 'undefined' ? window : globalThis);
