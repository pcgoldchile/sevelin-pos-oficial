/* Genera las imágenes de los Servicios Técnicos: una plantilla única, en
   SVG, rasterizada con sharp a 800x800 WebP — el mismo formato y tamaño que
   ya tienen las fichas del catálogo.
   ------------------------------------------------------------------------
   POR QUÉ ASÍ Y NO CON IMÁGENES DE IA (pedido del dueño, 25-09-2026):
   "ojalá tener una imagen de diseño de referencia, para que todas las demás
    se vean uniformes, y no se vean tan ruidosas con IA".

   Una plantilla programática garantiza lo que una imagen generada no puede:
   el mismo fondo, la misma tipografía, el mismo lugar del precio y el mismo
   pie en las 40 fichas. Cambiar un color acá los cambia todos de una vez.

   Uso:
     node scripts/generar-imagenes-servicios.js --muestra    (3 ejemplos en /tmp)
     node scripts/generar-imagenes-servicios.js              (los que falten, y los sube)

   Requiere en .env: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (los del POS).
   Lee el .env a mano, mismo patrón que scripts/sincronizar-catalogo-web.js. */

const fs = require('fs');
const path = require('path');

function cargarEnvLocal() {
  const ruta = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(ruta)) return;
  fs.readFileSync(ruta, 'utf8').split('\n').forEach(linea => {
    const m = linea.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!m) return;
    const clave = m[1];
    let valor = (m[2] || '').trim();
    if (/^".*"$/.test(valor) || /^'.*'$/.test(valor)) valor = valor.slice(1, -1);
    if (!(clave in process.env)) process.env[clave] = valor;
  });
}
cargarEnvLocal();

const sharp = require('sharp');

// ============================================================
// LA PALETA — un solo lugar donde cambiarlo todo
// ============================================================
const C = {
  fondo:      '#0B1220',   // azul noche, el fondo de todas
  panel:      '#111C2E',   // bloque del precio
  borde:      '#1E3A5F',
  acento:     '#22D3EE',   // cian: la marca
  texto:      '#FFFFFF',
  apagado:    '#94A3B8',   // pie y etiquetas secundarias
  precio:     '#4ADE80'    // verde: el precio, como en las fichas que ya existen
};

const LADO = 800;

// Datos fijos del negocio (ver memoria reference-sevelin-datos-fijos)
const WHATSAPP  = '+56 9 3575 0828';
/* ⚠️ HANDLE ACTUAL, no el definitivo. El dueño todavía no puede tomar
   @sevelin.cl (25-09-2026): está en @sevelin_cl y espera unos días. Cuando
   lo consiga, se cambia esta línea y se regeneran todas las imágenes. */
const INSTAGRAM = '@sevelin_cl';
const SITIO     = 'www.sevelin.cl';

/* ============================================================
   ICONOS — trazos simples, no ilustraciones.
   Cada uno se dibuja en una caja de 100x100 y se escala. Son de línea
   para que pesen poco y se vean iguales entre sí.
   ============================================================ */
const ICONOS = {
  disco: '<rect x="18" y="30" width="64" height="40" rx="6"/><circle cx="50" cy="50" r="12"/><circle cx="50" cy="50" r="2.5" fill="currentColor" stroke="none"/>',
  memoria: '<rect x="14" y="34" width="72" height="32" rx="4"/><path d="M26 66v8M38 66v8M50 66v8M62 66v8M74 66v8"/><rect x="24" y="42" width="12" height="16"/><rect x="44" y="42" width="12" height="16"/><rect x="64" y="42" width="12" height="16"/>',
  gpu: '<rect x="12" y="32" width="76" height="40" rx="4"/><circle cx="34" cy="52" r="11"/><circle cx="64" cy="52" r="11"/><path d="M22 72v8M78 72v8"/>',
  fuente: '<rect x="16" y="28" width="68" height="48" rx="5"/><circle cx="42" cy="52" r="14"/><path d="M66 40h10M66 52h10M66 64h10"/>',
  notebook: '<path d="M24 30h52v34H24z"/><path d="M14 68h72l-6 8H20z"/>',
  soldadura: '<path d="M24 76l14-14M34 56l24-24 12 12-24 24z"/><path d="M62 24l14 14"/><path d="M20 80l8-4-4-4z" fill="currentColor" stroke="none"/>',
  datos: '<ellipse cx="50" cy="30" rx="26" ry="9"/><path d="M24 30v40c0 5 12 9 26 9s26-4 26-9V30"/><path d="M24 50c0 5 12 9 26 9s26-4 26-9"/>',
  casa: '<path d="M20 48L50 24l30 24"/><path d="M28 46v32h44V46"/><path d="M44 78V60h12v18"/>',
  limpieza: '<path d="M38 20h24v26H38z"/><path d="M34 46h32v10H34z"/><path d="M38 56v24h24V56"/><path d="M46 62v12M54 62v12"/>',
  herramientas: '<path d="M30 26l16 16-8 8-16-16a11 11 0 0114-8z"/><path d="M44 56l22 22a8 8 0 0011-11L55 45"/>'
};

/* Qué icono le toca a cada servicio. Se resuelve por palabra en el nombre,
   de arriba hacia abajo: la primera que calza gana. */
const REGLAS_ICONO = [
  [/domicilio/i,                         'casa'],
  [/derrame|líquido|liquido|limpieza/i,  'limpieza'],
  [/pines|socket|microsolda|bios/i,      'soldadura'],
  [/recuperaci|datos|clonaci/i,          'datos'],
  [/disco|ssd|hdd|almacenamiento/i,      'disco'],
  [/ram|memoria/i,                       'memoria'],
  [/gráfica|grafica|video|gpu/i,         'gpu'],
  [/fuente|poder|psu/i,                  'fuente'],
  [/notebook|batería|bateria|pantalla/i, 'notebook'],
  [/mantenimiento|optimizaci|formateo/i, 'herramientas']
];
const iconoPara = (nombre) =>
  (REGLAS_ICONO.find(([re]) => re.test(nombre)) || [null, 'herramientas'])[1];

/* ============================================================
   TEXTO
   ============================================================ */
const escaparXml = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/* El nombre limpio para el afiche: se quitan los paréntesis explicativos,
   que en una imagen no se leen y hacen que el título se achique de más.
   "Chequeo de Salud de Disco Duro o SSD (por unidad)" → sin el paréntesis. */
function nombreParaAfiche(nombre) {
  return String(nombre)
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/^Servicio de\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/* Reparte el título en líneas y baja el tamaño hasta que quepa. Arial Black
   ⚠️ Arial Black mide ~0.72 × el tamaño por carácter, NO 0.62: con 0.62 los
   títulos largos se salían del marco (se vio en la primera muestra). */
function acomodarTitulo(texto, anchoMax, tamMax, tamMin, lineasMax) {
  for (let tam = tamMax; tam >= tamMin; tam -= 2) {
    const porLinea = Math.floor(anchoMax / (tam * 0.72));
    const lineas = [];
    let actual = '';
    for (const palabra of texto.split(' ')) {
      const tentativa = actual ? actual + ' ' + palabra : palabra;
      if (tentativa.length <= porLinea) actual = tentativa;
      else { if (actual) lineas.push(actual); actual = palabra; }
    }
    if (actual) lineas.push(actual);
    if (lineas.length <= lineasMax && lineas.every(l => l.length <= porLinea)) {
      return { lineas, tam };
    }
  }
  return { lineas: [texto.slice(0, 40)], tam: tamMin };
}

const fmtCLP = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL');

/* ============================================================
   LA PLANTILLA
   ============================================================ */
function svgServicio({ nombre, precio, aConsultar }) {
  const titulo = nombreParaAfiche(nombre);
  const ANCHO_TITULO = 620;   // ancho útil dentro del marco, con aire a los lados
  const { lineas, tam } = acomodarTitulo(titulo, ANCHO_TITULO, 58, 28, 4);
  const icono = ICONOS[iconoPara(nombre)];

  const alturaBloque = lineas.length * (tam * 1.14);
  const yInicio = 330 - alturaBloque / 2 + tam * 0.85;

  /* textLength es la red de seguridad: si aun así una línea se pasara del
     ancho, se comprime en vez de salirse del marco. Solo se aplica cuando
     de verdad haría falta — comprimir de más se nota. */
  const lineasSvg = lineas.map((l, i) => {
    const tope = (l.length * tam * 0.72) > ANCHO_TITULO
      ? ` textLength="${ANCHO_TITULO}" lengthAdjust="spacingAndGlyphs"` : '';
    return `<text x="400" y="${(yInicio + i * tam * 1.14).toFixed(1)}" text-anchor="middle"
       font-family="Arial Black, Arial, sans-serif" font-size="${tam}" font-weight="900"
       fill="${C.texto}" letter-spacing="0.5"${tope}>${escaparXml(l)}</text>`;
  }).join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${LADO}" height="${LADO}" viewBox="0 0 ${LADO} ${LADO}">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0E1728"/>
      <stop offset="100%" stop-color="${C.fondo}"/>
    </linearGradient>
    <pattern id="rejilla" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="${C.acento}" stroke-width="1" opacity="0.05"/>
    </pattern>
  </defs>

  <rect width="${LADO}" height="${LADO}" fill="url(#fondo)"/>
  <rect width="${LADO}" height="${LADO}" fill="url(#rejilla)"/>

  <!-- Marco fino: ordena sin agregar ruido -->
  <rect x="24" y="24" width="${LADO - 48}" height="${LADO - 48}" rx="20"
        fill="none" stroke="${C.borde}" stroke-width="2"/>

  <!-- Encabezado -->
  <text x="400" y="86" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="19" font-weight="bold" fill="${C.acento}" letter-spacing="5">SEVELIN</text>
  <text x="400" y="112" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="14" fill="${C.apagado}" letter-spacing="3.5">SERVICIO TÉCNICO</text>

  <!-- Icono -->
  <g transform="translate(350,140) scale(1.0)" fill="none" stroke="${C.acento}"
     stroke-width="4" stroke-linecap="round" stroke-linejoin="round" color="${C.acento}">
    ${icono}
  </g>

  <!-- Título -->
  ${lineasSvg}

  <!-- Línea de acento -->
  <rect x="330" y="${(430).toFixed(0)}" width="140" height="4" rx="2" fill="${C.acento}"/>

  <!-- Precio -->
  <rect x="150" y="470" width="500" height="150" rx="16" fill="${C.panel}" stroke="${C.borde}" stroke-width="2"/>
  ${aConsultar
      ? `<text x="400" y="508" text-anchor="middle" font-family="Arial, sans-serif"
           font-size="18" fill="${C.apagado}" letter-spacing="4">DESDE</text>`
      : ''}
  <text x="400" y="${aConsultar ? 578 : 566}" text-anchor="middle"
        font-family="Arial Black, Arial, sans-serif" font-size="${aConsultar ? 68 : 76}"
        font-weight="900" fill="${C.precio}">${fmtCLP(precio)}</text>
  ${aConsultar
      ? `<text x="400" y="604" text-anchor="middle" font-family="Arial, sans-serif"
           font-size="15" fill="${C.apagado}">el valor final depende del caso</text>`
      : ''}

  <!-- Pie -->
  <rect x="24" y="690" width="${LADO - 48}" height="1" fill="${C.borde}"/>
  <text x="400" y="720" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="20" font-weight="bold" fill="${C.texto}">${WHATSAPP}</text>
  <text x="400" y="748" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="17" fill="${C.acento}">${INSTAGRAM}  ·  ${SITIO}</text>
  <text x="400" y="773" text-anchor="middle" font-family="Arial, sans-serif"
        font-size="13" fill="${C.apagado}">Arica, Chile</text>
</svg>`;
}

async function render(servicio, destino) {
  const svg = svgServicio(servicio);
  await sharp(Buffer.from(svg))
    .resize(LADO, LADO)
    .webp({ quality: 82 })          // mismo perfil que el resto del catálogo
    .toFile(destino);
  return destino;
}

/* ============================================================
   MODO MUESTRA
   ============================================================ */
async function muestras() {
  const dir = process.env.DIR_MUESTRAS || '.';
  const ejemplos = [
    { nombre: 'Chequeo de Memoria RAM (por módulo)', precio: 10000, aConsultar: false },
    { nombre: 'Recuperación de Datos por Falla Lógica (Borrado, Formateo o Partición Perdida)', precio: 25000, aConsultar: true },
    { nombre: 'Visita Técnica a Domicilio en Arica', precio: 10000, aConsultar: true },
    { nombre: 'Instalación de Tarjeta Gráfica (Hardware + Software)', precio: 20000, aConsultar: false }
  ];
  for (let i = 0; i < ejemplos.length; i++) {
    const salida = path.join(dir, `muestra-${i + 1}.webp`);
    await render(ejemplos[i], salida);
    // Copia PNG solo para poder mirarla cómodamente
    await sharp(salida).png().toFile(salida.replace('.webp', '.png'));
    const kb = Math.round(fs.statSync(salida).size / 1024);
    console.log(`✓ ${salida}  (${kb} KB)  ${ejemplos[i].nombre}`);
  }
}

/* ============================================================
   MODO REAL: genera y sube los que no tienen imagen
   ============================================================ */
async function generarYSubir() {
  const { createClient } = require('@supabase/supabase-js');
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } });

  const { data, error } = await db.from('productos')
    .select('id, nombre, precio_unitario, precio_a_consultar, imagen_urls')
    .eq('categoria_web', 'Servicios Técnicos')
    .eq('publicado_web', true);
  if (error) throw new Error(error.message);

  const faltantes = (data || []).filter(p => !(p.imagen_urls && p.imagen_urls.length));
  console.log(`${faltantes.length} servicio(s) sin imagen.`);

  for (const p of faltantes) {
    const tmp = path.join(require('os').tmpdir(), `servicio-${p.id}.webp`);
    await render({ nombre: p.nombre, precio: p.precio_unitario, aConsultar: !!p.precio_a_consultar }, tmp);

    const buffer = fs.readFileSync(tmp);
    const ruta = `${p.id}/${require('crypto').randomUUID()}.webp`;
    const { error: errSubida } = await db.storage.from('productos-imagenes')
      .upload(ruta, buffer, { contentType: 'image/webp', upsert: false });
    if (errSubida) { console.error(`✗ ${p.nombre}: ${errSubida.message}`); continue; }

    const { data: pub } = db.storage.from('productos-imagenes').getPublicUrl(ruta);
    const { error: errUpd } = await db.from('productos')
      .update({ imagen_urls: [pub.publicUrl] }).eq('id', p.id);
    if (errUpd) { console.error(`✗ ${p.nombre}: ${errUpd.message}`); continue; }

    console.log(`✓ ${p.nombre}`);
    fs.unlinkSync(tmp);
  }
  console.log('Listo. El trigger trg_sync_tienda empuja las imágenes a sevelin.cl solo.');
}

(async () => {
  if (process.argv.includes('--muestra')) await muestras();
  else await generarYSubir();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
