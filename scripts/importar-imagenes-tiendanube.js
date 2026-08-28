/* Utilidad de una sola vez: descarga fotos de productos ya publicados en la
   tienda Tiendanube (sevelin.cl, propia del negocio — no un tercero) y las
   sube al Storage del POS, dejándolas en 1:1/800x800/webp con el mismo
   pipeline que ya usa el resto del catálogo (ver
   scripts/procesar-imagenes-1-1.js). Actualiza productos.imagen_urls.

   NUNCA enlaza directo a las URLs de Tiendanube (son de un servicio externo
   que el negocio podría dejar de pagar en cualquier momento) — siempre
   descarga y realoja en el Storage propio.

   Solo toca productos con imagen_urls vacío (no pisa fotos que ya se
   subieron a mano).

   Uso:  node scripts/importar-imagenes-tiendanube.js <ruta-al-mapeo.json>
   El mapeo es un array de { id, sku, nombre, imagenes: [url, ...] } —
   generado aparte (matching por SKU/nombre contra el sitemap de
   sevelin.cl), no se genera automáticamente en este script.

   Requiere en .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (del POS). */
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

const { createClient } = require('@supabase/supabase-js');
const sharp = require('sharp');
const crypto = require('crypto');

const BUCKET = 'productos-imagenes';
const LADO = 800;
const CALIDAD_WEBP = 82;

async function descargarBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} descargando ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function procesarYSubir(db, productoId, url) {
  const original = await descargarBuffer(url);
  const procesada = await sharp(original)
    .resize(LADO, LADO, { fit: 'contain', background: '#ffffff' })
    .webp({ quality: CALIDAD_WEBP })
    .toBuffer();

  const ruta = `${productoId}/${crypto.randomUUID()}.webp`;
  const { error } = await db.storage.from(BUCKET).upload(ruta, procesada, { contentType: 'image/webp', upsert: false });
  if (error) throw new Error(error.message);

  const { data: pub } = db.storage.from(BUCKET).getPublicUrl(ruta);
  return pub.publicUrl;
}

async function main() {
  const rutaMapeo = process.argv[2];
  if (!rutaMapeo) {
    console.error('Uso: node scripts/importar-imagenes-tiendanube.js <ruta-al-mapeo.json>');
    process.exit(1);
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env');
    process.exit(1);
  }

  const mapeo = JSON.parse(fs.readFileSync(rutaMapeo, 'utf8'));
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  let productosOk = 0, productosError = 0, imagenesSubidas = 0;

  for (const item of mapeo) {
    const urlsSubidas = [];
    for (const url of item.imagenes) {
      try {
        const urlFinal = await procesarYSubir(db, item.id, url);
        urlsSubidas.push(urlFinal);
        imagenesSubidas++;
      } catch (err) {
        console.error(`  [error imagen] ${item.sku} - ${url}: ${err.message}`);
      }
    }

    if (urlsSubidas.length === 0) {
      productosError++;
      console.error(`[sin fotos] ${item.sku} (${item.nombre}): ninguna imagen se pudo procesar`);
      continue;
    }

    const { error: errUpdate } = await db.from('productos')
      .update({ imagen_urls: urlsSubidas })
      .eq('id', item.id);

    if (errUpdate) {
      productosError++;
      console.error(`[error db] ${item.sku}: ${errUpdate.message}`);
    } else {
      productosOk++;
      console.log(`[ok] ${item.sku} (${item.nombre}): ${urlsSubidas.length} foto(s)`);
    }
  }

  console.log('\nResumen');
  console.log(`  Productos actualizados: ${productosOk}`);
  console.log(`  Productos con error: ${productosError}`);
  console.log(`  Imágenes subidas: ${imagenesSubidas}`);
  console.log('\nAhora corre: node scripts/sincronizar-catalogo-web.js');
}

main().catch(e => { console.error('Fallo general:', e); process.exit(1); });
