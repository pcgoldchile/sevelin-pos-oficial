/* Tarjeta de Halloween 2026 (31-10): arma la hoja para imprimir (PDF A4, 10 por hoja, frente y
   dorso) y las dos caras sueltas en PNG para la imprenta.
   Uso: node scripts/tarjeta-halloween.js   → docs/marca/halloween-2026/
   La oferta y los precios están arriba, en un solo lugar. Los precios salen del catálogo del POS
   al 28-10-2026; si cambian allá, se cambian aquí. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
// qrcode vive en el repo de la tienda (el POS lo carga desde un CDN en el navegador).
const QRCode = require(path.join(__dirname, '..', '..', 'sevelin-tienda', 'node_modules', 'qrcode'));

const WHATSAPP = '56935750828';
const CODIGO = 'DULCE';
const VALIDA_HASTA = '30-11-2026';
const OFERTA_TITULO = 'Diagnóstico GRATIS';
const OFERTA_SUB = '+ 10% de descuento en tu servicio técnico';
const SERVICIOS = [
  ['Mantención PS4 / PS5', 'desde $30.000'],
  ['Mantención PC o notebook gamer', '$40.000'],
  ['Pantalla de celular', 'desde $25.000'],
  ['Formateo PC / notebook', '$15.000'],
];
const MENSAJE_QR = `Hola! Tengo la tarjeta de Halloween 🎃 (código ${CODIGO}). Quiero cotizar: `;

const SALIDA = path.join(__dirname, '..', 'docs', 'marca', 'halloween-2026');
const CHROME = path.join(process.env.LOCALAPPDATA, 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe');

const LOGO = `<svg class="logo" viewBox="140 250 1320 300" xmlns="http://www.w3.org/2000/svg" aria-label="Sevelin">
  <g transform="translate(148.7 260) scale(1.4)"><rect width="200" height="200" rx="46" fill="#2563EB"/><g transform="translate(100 100) scale(1.2) translate(-100 -100)">
    <path d="M132 66 H88 a17 17 0 0 0 0 34 H112 a17 17 0 0 1 0 34 H68" fill="none" stroke="#fff" stroke-width="19" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="132" cy="66" r="14.5" fill="#fff"/><circle cx="132" cy="66" r="5.5" fill="#2563EB"/>
    <circle cx="68" cy="134" r="14.5" fill="#fff"/><circle cx="68" cy="134" r="5.5" fill="#2563EB"/></g></g>
  <g transform="translate(512.7 270) scale(2.6)"><g fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M38 20 H17 a15 15 0 0 0 0 30 H23 a15 15 0 0 1 0 30 H2"/><path transform="translate(63 0)" d="M34 20 H0 V80 H34 M0 50 H27"/><path transform="translate(120 0)" d="M0 20 L22 80 L44 20"/><path transform="translate(187 0)" d="M34 20 H0 V80 H34 M0 50 H27"/><path transform="translate(244 0)" d="M0 20 V80 H31"/><path transform="translate(298 0)" d="M0 20 V80"/><path transform="translate(321 0)" d="M0 80 V20 L40 80 V20"/></g></g>
</svg>`;

/* Calabaza dibujada (no emoji: así se imprime igual en cualquier equipo). */
const CALABAZA = `<svg class="calabaza" viewBox="0 0 120 110" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M58 22 C56 12 62 6 70 4" stroke="#3f7d2c" stroke-width="7" fill="none" stroke-linecap="round"/>
  <ellipse cx="38" cy="64" rx="30" ry="40" fill="#e8620c"/><ellipse cx="82" cy="64" rx="30" ry="40" fill="#e8620c"/>
  <ellipse cx="60" cy="64" rx="30" ry="42" fill="#ff7a1a"/>
  <path d="M34 50 L46 40 L50 56 Z M86 50 L74 40 L70 56 Z" fill="#1a0f05"/>
  <path d="M30 72 Q60 100 90 72 L82 76 L76 70 L68 80 L60 72 L52 80 L44 70 L38 76 Z" fill="#1a0f05"/>
</svg>`;

function frente() {
  return `<div class="tarjeta frente">
    <div class="murcielagos">🦇</div>
    ${CALABAZA}
    <div class="frente-texto">
      <p class="chico">Feliz Halloween de parte de</p>
      ${LOGO}
      <h1>¿Dulce o truco?</h1>
      <p class="sub">El dulce es para ti.<br>El truco lo ponemos nosotros:<br><b>tu consola, PC o celular como nuevo.</b></p>
    </div>
  </div>`;
}

function dorso(qrSvg) {
  const filas = SERVICIOS.map(([s, p]) => `<li><span>${s}</span><b>${p}</b></li>`).join('');
  return `<div class="tarjeta dorso">
    <div class="dorso-izq">
      <p class="cinta">🎃 Con esta tarjeta</p>
      <p class="oferta">${OFERTA_TITULO}</p>
      <p class="oferta-sub">${OFERTA_SUB}</p>
      <ul>${filas}</ul>
      <p class="datos"><b>San Rafael 896, Arica</b> · entrada por Robinson Rojas<br>Lun a dom 10:00–13:00 y 14:00–21:00</p>
    </div>
    <div class="dorso-der">
      <div class="qr">${qrSvg}</div>
      <p class="escanea">Escanea y escríbenos</p>
      <p class="fono">+56 9 3575 0828</p>
      <p class="codigo">Código <b>${CODIGO}</b><br>hasta el ${VALIDA_HASTA}</p>
    </div>
  </div>`;
}

const CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Segoe UI", Arial, sans-serif; background: #fff; }
.hoja { width: 210mm; height: 297mm; padding: 23.5mm 15mm; display: grid;
  grid-template-columns: repeat(2, 90mm); grid-auto-rows: 50mm; justify-content: center; page-break-after: always; }
.hoja:last-child { page-break-after: auto; }
.tarjeta { width: 90mm; height: 50mm; overflow: hidden; position: relative; outline: 0.2mm dashed #bbb;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.frente { background: radial-gradient(circle at 25% 60%, #3a1d05 0%, #120a1f 55%, #07050d 100%); color: #fff;
  display: flex; align-items: center; gap: 2mm; padding: 3mm 4mm 3mm 2mm; }
.calabaza { width: 30mm; flex: none; filter: drop-shadow(0 0 3mm rgba(255,122,26,.55)); }
.murcielagos { position: absolute; top: 1.5mm; right: 3mm; font-size: 4mm; opacity: .7; }
.frente-texto { display: flex; flex-direction: column; gap: 1.2mm; }
.chico { font-size: 2.3mm; color: #ffb27a; letter-spacing: .2mm; text-transform: uppercase; }
.logo { width: 30mm; height: auto; }
.frente h1 { font-family: "Arial Black", "Segoe UI Black", sans-serif; font-size: 6.4mm; line-height: 1; color: #ff7a1a; }
.sub { font-size: 2.55mm; line-height: 1.35; color: #e9e3f5; }
.sub b { color: #fff; }
.dorso { background: #fff7ef; color: #1b1424; display: flex; gap: 2.5mm; padding: 3mm 3.5mm; border-top: 1.6mm solid #ff7a1a; }
.dorso-izq { flex: 1; display: flex; flex-direction: column; gap: .7mm; min-width: 0; }
.cinta { font-size: 2.3mm; text-transform: uppercase; letter-spacing: .2mm; color: #c2410c; font-weight: 700; }
.oferta { font-family: "Arial Black", sans-serif; font-size: 4.6mm; line-height: 1; color: #1b1424; }
.oferta-sub { font-size: 2.45mm; font-weight: 700; color: #c2410c; }
ul { list-style: none; margin-top: .6mm; display: flex; flex-direction: column; gap: .35mm; }
li { display: flex; justify-content: space-between; gap: 1mm; font-size: 2.3mm; border-bottom: .15mm dotted #d6c4b2; }
li b { white-space: nowrap; }
.datos { margin-top: auto; font-size: 2.05mm; line-height: 1.3; color: #3b3346; }
.dorso-der { width: 25mm; flex: none; display: flex; flex-direction: column; align-items: center; text-align: center; gap: .6mm; }
.qr { width: 23mm; height: 23mm; background: #fff; padding: .6mm; border-radius: 1mm; }
.qr svg { width: 100%; height: 100%; display: block; }
.escanea { font-size: 2.1mm; font-weight: 700; color: #15803d; }
.fono { font-size: 2.6mm; font-weight: 800; }
.codigo { font-size: 2.1mm; line-height: 1.25; background: #1b1424; color: #fff; border-radius: 1mm; padding: .6mm 1.4mm; }
.codigo b { color: #ff9a4d; letter-spacing: .3mm; }
/* Para las PNG sueltas */
.suelta { padding: 0; display: block; width: 90mm; height: 50mm; }
.suelta .tarjeta { outline: none; }
`;

function pagina(cuerpo, titulo) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo}</title><style>${CSS}</style></head><body>${cuerpo}</body></html>`;
}

function chrome(args) {
  execFileSync(CHROME, ['--headless', '--disable-gpu', '--no-pdf-header-footer', '--hide-scrollbars', ...args], { stdio: 'ignore' });
}

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const enlace = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(MENSAJE_QR)}`;
  const qr = await QRCode.toString(enlace, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1b1424', light: '#ffffff' } });

  /* Hoja 1: 10 frentes. Hoja 2: 10 dorsos. En dos columnas, al imprimir doble faz por el borde
     largo cada dorso cae detrás de su frente, porque las dos columnas tienen el mismo diseño. */
  const diez = (html) => Array.from({ length: 10 }, () => html).join('');
  const hojas = `<div class="hoja">${diez(frente())}</div><div class="hoja">${diez(dorso(qr))}</div>`;
  const htmlHoja = path.join(SALIDA, 'tarjeta-halloween-hoja-A4.html');
  fs.writeFileSync(htmlHoja, pagina(hojas, 'Tarjeta Halloween Sevelin — hoja A4'));
  chrome([`--print-to-pdf=${path.join(SALIDA, 'tarjeta-halloween-hoja-A4.pdf')}`, 'file:///' + htmlHoja.replace(/\\/g, '/')]);

  /* Caras sueltas a 300 ppp (90 x 50 mm = 1063 x 591 px) para la imprenta. */
  for (const [nombre, html] of [['frente', frente()], ['dorso', dorso(qr)]]) {
    const f = path.join(SALIDA, `tarjeta-halloween-${nombre}.html`);
    fs.writeFileSync(f, pagina(`<div class="suelta">${html}</div>`, `Tarjeta Halloween — ${nombre}`));
    chrome(['--force-device-scale-factor=3.125', '--window-size=341,190',
      `--screenshot=${path.join(SALIDA, `tarjeta-halloween-${nombre}.png`)}`, 'file:///' + f.replace(/\\/g, '/')]);
  }
  console.log('Listo:', SALIDA);
  console.log('QR →', enlace);
})();
