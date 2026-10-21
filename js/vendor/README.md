# Librerías de terceros (sin cambios)

| Archivo | Qué es | Versión | Licencia | Fuente |
|---|---|---|---|---|
| `qrcode.min.js` | Genera códigos QR | — | MIT | — |
| `mediabunny-1.61.3.min.js` | Arma el MP4 del reel cuadro por cuadro (WebCodecs), para que salga a 60 FPS exactos | 1.61.3 | MPL 2.0 (`mediabunny-LICENSE.txt`) | https://github.com/Vanilagy/mediabunny · npm `mediabunny` |

Mediabunny se copió tal cual desde `node_modules/mediabunny/dist/bundles/mediabunny.min.mjs` (vino con Remotion en
`sevelin-contenido`). Va con extensión `.js` para que Vercel y la maqueta lo sirvan como JavaScript (con
`X-Content-Type-Options: nosniff` un `.mjs` mal tipado no carga). Solo se descarga al grabar un reel
(`import()` en `js/redes-contenido.js`). Si se actualiza, cambiar el número en el nombre y en `CONTENIDO_REDES_MEDIABUNNY`.
