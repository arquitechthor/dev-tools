/**
 * Interfaz de json-formatter.html. El análisis y la escritura están en assets/json.js (window.DevJson).
 * Todo ocurre en el navegador: el JSON no se envía a ningún sitio. Solo se recuerdan en localStorage
 * las preferencias (sangría y ordenar claves), nunca el contenido.
 */
(function () {
  'use strict';
  const { parsear, escribir } = window.DevJson;
  const $ = (id) => document.getElementById(id);
  const entrada = $('entrada');
  const salida = $('salida');
  const caja = salida.parentElement;
  const estado = $('estado');
  const cajaError = $('error');
  const cajaAvisos = $('avisos');
  const tamEntrada = $('tam-entrada');
  const sangriaSel = $('sangria');
  const ordenarChk = $('ordenar');
  const archivo = $('archivo');
  const botones = Object.fromEntries([...document.querySelectorAll('[data-accion]')].map((b) => [b.dataset.accion, b]));

  const SANGRIAS = { 2: '  ', 4: '    ', tab: '\t' };
  const LIMITE_VIVO = 1_000_000; // por encima, solo se procesa al pulsar un botón
  const LIMITE_COLOR = 2_000_000; // por encima, el resultado sale sin colores ni números de línea
  const PREFS = 'devtools.json-formatter';
  const EJEMPLO = '{"id":9007199254740993,"usuario":{"nombre":"Ada","idiomas":["es","en","it"],"activo":true},' +
    '"pedidos":[{"ref":"A-001","total":49.90,"lineas":[{"sku":"KOPI-1","cantidad":2}]},{"ref":"A-002","total":0.10,"lineas":[]}],' +
    '"nota":"Comillas \\"escapadas\\", tildes y emoji: ñ 😀","borrado":null}';

  let modo = 'formatear';
  let resultado = '';
  let temporizador;

  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || '{}');
    if (p.sangria in SANGRIAS) sangriaSel.value = p.sangria;
    ordenarChk.checked = !!p.ordenar;
  } catch { /* sin almacenamiento: valores por defecto */ }
  const guardarPrefs = () => {
    try { localStorage.setItem(PREFS, JSON.stringify({ sangria: sangriaSel.value, ordenar: ordenarChk.checked })); } catch { /* nada */ }
  };

  const bytes = (s) => new Blob([s]).size;
  const tam = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`);
  const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function hayResultado(si) {
    botones.copiar.disabled = !si;
    botones.descargar.disabled = !si;
  }

  function vaciar(mensaje) {
    resultado = '';
    salida.textContent = '';
    caja.classList.add('vacia');
    caja.dataset.vacia = mensaje;
    hayResultado(false);
  }

  function procesar() {
    clearTimeout(temporizador);
    const texto = entrada.value;
    tamEntrada.textContent = texto ? tam(bytes(texto)) : '';
    cajaError.hidden = true;
    cajaAvisos.hidden = true;
    if (!texto.trim()) {
      vaciar('Aquí aparecerá el JSON formateado.');
      estado.textContent = 'Pega un JSON, arrastra un archivo o prueba con el ejemplo.';
      estado.className = 'estado';
      return;
    }
    const t0 = performance.now();
    let r;
    try {
      r = parsear(texto);
    } catch (e) {
      if (e.name !== 'ErrorJson') throw e;
      mostrarError(e, texto);
      return;
    }
    const minificar = modo === 'minificar';
    const colorear = texto.length <= LIMITE_COLOR;
    const out = escribir(r.arbol, { sangria: minificar ? '' : SANGRIAS[sangriaSel.value], ordenar: ordenarChk.checked, html: colorear });
    resultado = out.texto;
    caja.classList.remove('vacia');
    caja.classList.toggle('minificado', minificar);
    caja.classList.toggle('sin-color', !colorear);
    if (colorear) salida.innerHTML = out.html.split('\n').map((l) => `<span class="ln">${l}</span>`).join('\n');
    else salida.textContent = out.texto;
    hayResultado(true);
    const ms = Math.max(1, Math.round(performance.now() - t0));
    estado.className = 'estado ok';
    estado.textContent = `JSON válido · ${r.valores.toLocaleString('es')} valores · ${r.profundidad} niveles · ` +
      `${tam(bytes(texto))} → ${tam(bytes(resultado))} · ${ms} ms` + (colorear ? '' : ' · sin colores por el tamaño');
    if (r.avisos.length) {
      const lista = r.avisos.slice(0, 8).map((a) =>
        `<li><button type="button" class="enlace" data-pos="${a.pos}">Línea ${a.linea}, col. ${a.columna}</button> ${escapar(a.mensaje)}</li>`).join('');
      const mas = r.avisos.length > 8 ? `<li>… y ${r.avisos.length - 8} más.</li>` : '';
      cajaAvisos.innerHTML = `<strong>Avisos</strong><ul>${lista}${mas}</ul>`;
      cajaAvisos.hidden = false;
    }
  }

  function mostrarError(e, texto) {
    vaciar('Corrige el error de la entrada para ver el resultado.');
    estado.className = 'estado mal';
    estado.textContent = `No es JSON válido (línea ${e.linea}, columna ${e.columna}).`;
    // La línea del error, recortada alrededor de la columna, con una marca debajo.
    const ini = texto.lastIndexOf('\n', e.pos - 1) + 1;
    let fin = texto.indexOf('\n', e.pos);
    if (fin === -1) fin = texto.length;
    let linea = texto.slice(ini, fin).replace(/\r$/, '').replace(/\t/g, ' ');
    let col = e.columna - 1;
    if (col > 50) { linea = '…' + linea.slice(col - 40); col = 41; }
    if (linea.length > col + 50) linea = linea.slice(0, col + 50) + '…';
    cajaError.innerHTML =
      `<p><strong>Línea ${e.linea}, columna ${e.columna}:</strong> ${escapar(e.message)}</p>` +
      `<pre class="json-error-trozo">${escapar(linea)}\n${' '.repeat(col)}^</pre>` +
      `<button type="button" class="btn btn-secondary btn-sm" data-pos="${e.pos}">Ir al error</button>`;
    cajaError.hidden = false;
  }

  function irA(pos) {
    entrada.focus();
    entrada.setSelectionRange(pos, Math.min(pos + 1, entrada.value.length));
    // Desplaza el área de texto hasta la línea, aproximando por la altura de línea.
    const linea = entrada.value.slice(0, pos).split('\n').length;
    const alto = parseFloat(getComputedStyle(entrada).lineHeight) || 20;
    entrada.scrollTop = Math.max(0, (linea - 3) * alto);
  }

  function elegirModo(m) {
    modo = m;
    botones.formatear.setAttribute('aria-pressed', String(m === 'formatear'));
    botones.minificar.setAttribute('aria-pressed', String(m === 'minificar'));
    procesar();
  }

  function aviso(boton, texto) {
    const antes = boton.textContent;
    boton.textContent = texto;
    setTimeout(() => { boton.textContent = antes; }, 1400);
  }

  function cargar(texto) {
    entrada.value = texto;
    procesar();
  }

  function leerArchivo(f) {
    if (!f) return;
    const lector = new FileReader();
    lector.onload = () => cargar(String(lector.result));
    lector.onerror = () => { estado.className = 'estado mal'; estado.textContent = `No se pudo leer «${f.name}».`; };
    lector.readAsText(f);
  }

  botones.formatear.addEventListener('click', () => elegirModo('formatear'));
  botones.minificar.addEventListener('click', () => elegirModo('minificar'));
  botones.ejemplo.addEventListener('click', () => cargar(EJEMPLO));
  botones.abrir.addEventListener('click', () => archivo.click());
  botones.limpiar.addEventListener('click', () => { cargar(''); entrada.focus(); });
  botones.copiar.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(resultado);
      aviso(botones.copiar, 'Copiado');
    } catch {
      aviso(botones.copiar, 'No se pudo copiar');
    }
  });
  botones.descargar.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([resultado], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: modo === 'minificar' ? 'minificado.json' : 'formateado.json' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  archivo.addEventListener('change', () => { leerArchivo(archivo.files[0]); archivo.value = ''; });

  entrada.addEventListener('input', () => {
    clearTimeout(temporizador);
    if (entrada.value.length <= LIMITE_VIVO) temporizador = setTimeout(procesar, 250);
    else {
      tamEntrada.textContent = tam(bytes(entrada.value));
      estado.className = 'estado';
      estado.textContent = 'Texto grande: pulsa Formatear o Minificar para procesarlo.';
    }
  });
  entrada.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); procesar(); }
  });
  entrada.addEventListener('dragover', (ev) => { ev.preventDefault(); entrada.classList.add('soltando'); });
  entrada.addEventListener('dragleave', () => entrada.classList.remove('soltando'));
  entrada.addEventListener('drop', (ev) => {
    const f = ev.dataTransfer.files[0];
    entrada.classList.remove('soltando');
    if (!f) return;
    ev.preventDefault();
    leerArchivo(f);
  });
  sangriaSel.addEventListener('change', () => { guardarPrefs(); if (modo === 'minificar') elegirModo('formatear'); else procesar(); });
  ordenarChk.addEventListener('change', () => { guardarPrefs(); procesar(); });
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-pos]');
    if (b) irA(Number(b.dataset.pos));
  });

  procesar();
})();
