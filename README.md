# dev-tools

Herramientas para el día a día en desarrollo de software. Sí, ya existen por allí cosas parecidas, pero no confío en ellas :P

**Web:** https://arquitechthor.github.io/dev-tools/

Todo se ejecuta en el navegador: sin servidor, sin cookies, sin analítica y sin librerías de terceros. Es HTML, CSS y
JavaScript sin compilar, así que lo que hay en este repositorio es exactamente lo que se ejecuta.

## Herramientas

- **[JSON formatter](https://arquitechthor.github.io/dev-tools/json-formatter.html):** formatea, minifica y valida JSON.
  Usa un analizador propio en lugar de `JSON.parse`, así que da errores en español con línea y columna, conserva los
  números tal cual (sin redondear IDs de 64 bits) y avisa de las claves repetidas.

## Desarrollo

No hay paso de compilación ni dependencias. Para probar en local, sirve la carpeta con cualquier servidor estático
(por ejemplo `python -m http.server`) y abre `http://localhost:8000`.

Pruebas del analizador de JSON (Node 18+):

```bash
node scripts/probar-json.mjs
```

## Licencia

[GPL-3.0](LICENSE).
