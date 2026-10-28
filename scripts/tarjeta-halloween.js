/* Tarjeta de Halloween 2026 (31-10): arma la hoja para imprimir en casa (PDF A4, 10 por hoja,
   frente y dorso) y las dos caras sueltas en PNG.
   Uso: node scripts/tarjeta-halloween.js   → docs/marca/halloween-2026/

   Pedido del dueño (28-10-2026): SIN descuentos, sin código y sin nada gratis. Frente para los
   niños (Halloween en estilo pixel/bloques, original: nada de logos ni personajes de Roblox,
   Minecraft o memes, que tienen dueño); dorso para los papás con lo importante del negocio:
   teléfono, sevelin.cl, lo que vendemos y arreglamos, dirección y horario. Logo: la S hexagonal
   (docs/marca/sevelin-s-neon.svg). */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
// qrcode vive en el repo de la tienda (el POS lo carga desde un CDN en el navegador).
const QRCode = require(path.join(__dirname, '..', '..', 'sevelin-tienda', 'node_modules', 'qrcode'));

const WHATSAPP = '56935750828';
const TELEFONO = '+56 9 3575 0828';
const WEB = 'sevelin.cl';
const HORARIO = 'Lun a dom · 10:00–13:00 y 14:00–20:00';
const DIRECCION = 'San Rafael 896, Arica';
const ENTRADA = 'entrada por Av. Robinson Rojas';
const CATEGORIAS = [
  ['🛠️', 'Servicio técnico', 'PC, notebook, consolas y celulares'],
  ['🎮', 'Mundo gamer', 'teclados, mouse, audífonos y controles'],
  ['🔋', 'Carga y energía', 'cargadores, cables y power banks'],
  ['🖥️', 'Monitores y computadores', 'nuevos y reacondicionados'],
];
// Así se sabe en WhatsApp de dónde vino (en la caja: origen "Tarjeta o volante").
const MENSAJE_QR = 'Hola! Vi la tarjeta de Halloween de Sevelin 🎃 ';

const SALIDA = path.join(__dirname, '..', 'docs', 'marca', 'halloween-2026');
const CHROME = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe');

/* La S de Sevelin, sin el fondo cuadrado del archivo original. */
const S_HEX = `<svg class="s-hex" viewBox="230 190 790 860" xmlns="http://www.w3.org/2000/svg" aria-label="Sevelin">
  <defs>
    <linearGradient id="az" gradientUnits="userSpaceOnUse" x1="276.5" y1="415.3" x2="952.1" y2="866.0"><stop offset="0" stop-color="#73FCFD"/><stop offset="0.174" stop-color="#06E7FD"/><stop offset="0.36" stop-color="#019FFD"/><stop offset="0.547" stop-color="#007DFD"/><stop offset="0.733" stop-color="#0055FD"/><stop offset="1" stop-color="#0058FD"/></linearGradient>
    <linearGradient id="fi" gradientUnits="userSpaceOnUse" x1="276.5" y1="415.3" x2="952.1" y2="866.0"><stop offset="0" stop-color="#F4FFFF"/><stop offset="0.45" stop-color="#B4F3FF"/><stop offset="1" stop-color="#6FA6FF"/></linearGradient>
  </defs>
  <path d="M626.0 213.5 L975.5 415.4 L975.5 601.8 L620.7 397.0 L504.6 464.0 L975.5 735.9 L975.5 830.1 L638.1 1024.9 L276.5 816.2 L276.5 622.0 L664.5 846.0 L744.8 799.6 L276.5 529.3 L276.5 415.3 Z" fill="url(#az)"/>
  <path d="M276.5 529.3 L276.5 415.3 L626.0 213.5 L975.5 415.4 L975.5 601.8 M975.5 735.9 L975.5 830.1 L638.1 1024.9 L276.5 816.2 L276.5 622.0" fill="none" stroke="url(#fi)" stroke-width="10"/>
</svg>`;

const marca = (clase = '') => `<div class="marca ${clase}">${S_HEX}<span>SEVELIN</span></div>`;

/* Dibujos en pixeles hechos aquí (originales). Cada letra es un color; '.' es vacío. */
const COLORES = { n: '#ff7a1a', o: '#e8590c', v: '#3f9b2c', k: '#1a0f05', a: '#ffd23f', b: '#8a6ad6', w: '#f4f1ff', p: '#8b5cf6' };
const CALABAZA = [
  '......vv.....',
  '.....vv......',
  '...nnoonnn...',
  '..nnnnoonnnn.',
  '.nnkknoonkknn',
  '.nnkknoonkknn',
  '.nnnnnoonnnnn',
  '.nknnnnnnnknn',
  '.nnkkkkkkknnn',
  '.nnnkknkknnn.',
  '..nnnnoonnnn.',
  '...nnnnnnn...',
];
const MURCIELAGO = [
  'b.........b',
  'bb..b.b..bb',
  'bbb.bbb.bbb',
  'bbbbbabbbbb',
  '.bbbbbbbbb.',
  '..b..b..b..',
];
const FANTASMA = [
  '..wwww..',
  '.wwwwww.',
  'wwkwwkww',
  'wwkwwkww',
  'wwwwwwww',
  'wwwkkwww',
  'wwwwwwww',
  'w.ww.ww.',
];

function pixeles(mapa, celdaMm, clase) {
  const ancho = mapa[0].length;
  const celdas = mapa.join('').split('').map(c => `<i style="background:${COLORES[c] || 'transparent'}"></i>`).join('');
  return `<div class="pix ${clase}" style="grid-template-columns:repeat(${ancho}, ${celdaMm}mm);grid-auto-rows:${celdaMm}mm">${celdas}</div>`;
}

/* Estrellitas fijas (no al azar: así las 10 tarjetas de la hoja salen iguales). */
const ESTRELLAS = [[8, 10], [22, 6], [40, 14], [55, 5], [70, 11], [83, 7], [62, 40], [12, 44], [48, 44], [86, 38]]
  .map(([x, y]) => `<b class="estrella" style="left:${x}mm;top:${y}mm"></b>`).join('');

function frente() {
  return `<div class="tarjeta frente">
    ${ESTRELLAS}
    ${pixeles(MURCIELAGO, 0.55, 'murcielago')}
    ${pixeles(FANTASMA, 0.7, 'fantasma')}
    ${pixeles(CALABAZA, 2.0, 'calabaza')}
    <div class="frente-texto">
      <p class="pixel titulo">¡FELIZ<br>HALLOWEEN!</p>
      <p class="frase">¿Tu consola o tu PC está <b>embrujada</b>? 👻<br>Nosotros la dejamos funcionando.</p>
      <div class="de-parte"><small>de parte de</small>${marca('marca-frente')}</div>
    </div>
  </div>`;
}

function dorso(qrSvg) {
  const filas = CATEGORIAS.map(([icono, titulo, detalle]) => `<li><span class="ico">${icono}</span><span><b>${titulo}</b> · ${detalle}</span></li>`).join('');
  return `<div class="tarjeta dorso">
    <div class="dorso-izq">
      ${marca('marca-dorso')}
      <p class="lema">Tecnología y servicio técnico en Arica</p>
      <ul>${filas}</ul>
      <p class="datos"><b>${DIRECCION}</b> · ${ENTRADA}<br>${HORARIO}</p>
    </div>
    <div class="dorso-der">
      <div class="qr">${qrSvg}</div>
      <p class="escanea">Escanea y escríbenos</p>
      <p class="fono">${TELEFONO}</p>
      <p class="web">${WEB}</p>
    </div>
  </div>`;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=block');
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Segoe UI", Arial, sans-serif; background: #fff; }
.hoja { width: 210mm; height: 297mm; padding: 23.5mm 15mm; display: grid;
  grid-template-columns: repeat(2, 90mm); grid-auto-rows: 50mm; justify-content: center; page-break-after: always; }
.hoja:last-child { page-break-after: auto; }
.tarjeta { width: 90mm; height: 50mm; overflow: hidden; position: relative; outline: 0.2mm dashed #bbb;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.pixel { font-family: "Press Start 2P", "Courier New", monospace; }
.pix { display: grid; position: absolute; }
.pix i { display: block; }

.frente { background: linear-gradient(160deg, #1d0f3a 0%, #120a26 55%, #07040f 100%); color: #fff; }
.estrella { position: absolute; width: .7mm; height: .7mm; background: #ffe9a8; box-shadow: 0 0 1mm #ffd23f; }
.calabaza { left: 4mm; top: 13mm; filter: drop-shadow(0 0 2.5mm rgba(255,122,26,.6)); }
.murcielago { left: 30mm; top: 3mm; }
.fantasma { left: 6mm; top: 3.5mm; opacity: .95; }
.frente-texto { position: absolute; left: 34mm; top: 9mm; right: 3mm; display: flex; flex-direction: column; gap: 2mm; }
.titulo { font-size: 4.6mm; line-height: 1.25; color: #ff8a2b; text-shadow: .5mm .5mm 0 #6b2c00; }
.frase { font-size: 2.45mm; line-height: 1.35; color: #e9e3f5; }
.frase b { color: #b9f3ff; }
.de-parte { display: flex; align-items: center; gap: 1.5mm; margin-top: .5mm; }
.de-parte small { font-size: 2mm; color: #c4b5fd; }

.marca { display: flex; align-items: center; gap: 1.4mm; }
.marca span { font-family: "Arial Black", "Segoe UI Black", sans-serif; letter-spacing: .5mm; }
.s-hex { height: 100%; width: auto; }
.marca-frente { height: 6.5mm; }
.marca-frente span { font-size: 4mm; color: #fff; }
.marca-dorso { height: 7.5mm; }
.marca-dorso span { font-size: 4.8mm; color: #0b1430; }

.dorso { background: #f6f8ff; color: #0b1430; display: flex; gap: 2.5mm; padding: 3.2mm 3.5mm 3mm; border-top: 1.6mm solid #ff7a1a; }
.dorso-izq { flex: 1; display: flex; flex-direction: column; gap: .9mm; min-width: 0; }
.lema { font-size: 2.3mm; font-weight: 700; color: #1d4ed8; }
ul { list-style: none; display: flex; flex-direction: column; gap: .55mm; margin-top: .3mm; }
li { display: flex; gap: 1mm; font-size: 2.15mm; line-height: 1.2; align-items: baseline; }
li .ico { width: 3mm; flex: none; }
li b { color: #0b1430; }
.datos { margin-top: auto; font-size: 2.05mm; line-height: 1.3; color: #33415c; }
.dorso-der { width: 25mm; flex: none; display: flex; flex-direction: column; align-items: center; text-align: center; gap: .5mm; }
.qr { width: 23mm; height: 23mm; background: #fff; padding: .6mm; border-radius: 1mm; border: .2mm solid #dbe3ff; }
.qr svg { width: 100%; height: 100%; display: block; }
.escanea { font-size: 2mm; font-weight: 700; color: #15803d; }
.fono { font-size: 2.9mm; font-weight: 800; }
.web { font-size: 3mm; font-weight: 800; color: #fff; background: #1d4ed8; border-radius: 1mm; padding: .5mm 2mm; }

.suelta { width: 90mm; height: 50mm; }
.suelta .tarjeta { outline: none; }
`;

function pagina(cuerpo, titulo) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title><style>${CSS}</style></head><body>${cuerpo}</body></html>`;
}

function chrome(args) {
  // virtual-time-budget: espera la fuente pixel de Google Fonts antes de imprimir.
  execFileSync(CHROME, ['--headless', '--disable-gpu', '--no-pdf-header-footer', '--hide-scrollbars', '--virtual-time-budget=8000', ...args], { stdio: 'ignore' });
}

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const enlace = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(MENSAJE_QR)}`;
  const qr = await QRCode.toString(enlace, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0b1430', light: '#ffffff' } });

  /* Hoja 1: 10 frentes. Hoja 2: 10 dorsos. Con 2 columnas iguales, al imprimir a doble cara por
     el borde largo cada dorso cae detrás de su frente. */
  const diez = (html) => Array.from({ length: 10 }, () => html).join('');
  const hojas = `<div class="hoja">${diez(frente())}</div><div class="hoja">${diez(dorso(qr))}</div>`;
  const htmlHoja = path.join(SALIDA, 'tarjeta-halloween-hoja-A4.html');
  fs.writeFileSync(htmlHoja, pagina(hojas, 'Tarjeta Halloween Sevelin — hoja A4'));
  chrome([`--print-to-pdf=${path.join(SALIDA, 'tarjeta-halloween-hoja-A4.pdf')}`, 'file:///' + htmlHoja.replace(/\\/g, '/')]);

  /* Caras sueltas a 300 ppp (90 x 50 mm = 1063 x 591 px). */
  for (const [nombre, html] of [['frente', frente()], ['dorso', dorso(qr)]]) {
    const f = path.join(SALIDA, `tarjeta-halloween-${nombre}.html`);
    fs.writeFileSync(f, pagina(`<div class="suelta">${html}</div>`, `Tarjeta Halloween — ${nombre}`));
    chrome(['--force-device-scale-factor=3.125', '--window-size=341,190',
      `--screenshot=${path.join(SALIDA, `tarjeta-halloween-${nombre}.png`)}`, 'file:///' + f.replace(/\\/g, '/')]);
  }
  console.log('Listo:', SALIDA);
  console.log('QR →', enlace);
})();
