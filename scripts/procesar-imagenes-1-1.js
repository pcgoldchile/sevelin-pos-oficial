/* Utilidad de una sola vez: recorre las fotos ya subidas en el bucket
   `productos-imagenes` y deja en 1:1 (800x800, fondo blanco, webp liviano)
   las que no lo estén todavía. Las subidas NUEVAS ya salen así desde el
   Canvas del modal de producto (ver dibujarYComprimirFoto en js/productos.js,
   1000x1000 con fondo blanco) — este script es solo para el catálogo viejo
   que quedó con fotos en su proporción original antes de que existiera esa
   lógica del Canvas.

   Idempotente: una foto que ya sea cuadrada (ancho === alto) se salta sin
   tocarla, incluida una foto que ya haya sido procesada por este mismo
   script en una corrida anterior.

   Uso:  node scripts/procesar-imagenes-1-1.js
   Requiere en .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (los mismos
   del POS — el bucket es del proyecto Supabase del POS, no del de la
   tienda). No depende de "dotenv": lee el .env a mano, mismo patrón que
   scripts/sincronizar-catalogo-web.js. */
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

const BUCKET = 'productos-imagenes';
const LADO = 800;
const CALIDAD_WEBP = 82;

function extraerRutaDesdeUrl(url) {
  const marca = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marca);
  if (idx === -1) return null;
  return url.slice(idx + marca.length);
}

async function procesarImagenUrl(db, url) {
  const ruta = extraerRutaDesdeUrl(url);
  if (!ruta) return { estado: 'error', detalle: 'URL no pertenece al bucket ' + BUCKET, urlFinal: url };

  const { data: archivo, error: errDescarga } = await db.storage.from(BUCKET).download(ruta);
  if (errDescarga) return { estado: 'error', detalle: errDescarga.message, urlFinal: url };

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const metadata = await sharp(buffer).metadata();

  if (metadata.width && metadata.height && metadata.width === metadata.height) {
    return { estado: 'saltada-ya-1-1', urlFinal: url };
  }

  const procesada = await sharp(buffer)
    .resize(LADO, LADO, { fit: 'contain', background: '#ffffff' })
    .webp({ quality: CALIDAD_WEBP })
    .toBuffer();

  const rutaSinExtension = ruta.replace(/\.[^./]+$/, '');
  const nuevaRuta = `${rutaSinExtension}.webp`;
  const cambiaExtension = nuevaRuta !== ruta;

  const { error: errSubida } = await db.storage
    .from(BUCKET)
    .upload(nuevaRuta, procesada, { contentType: 'image/webp', upsert: true });
  if (errSubida) return { estado: 'error', detalle: errSubida.message, urlFinal: url };

  if (cambiaExtension) {
    // Solo se borra el archivo viejo DESPUÉS de confirmar que el nuevo ya
    // subió bien — nunca se deja un producto sin ninguna imagen válida.
    await db.storage.from(BUCKET).remove([ruta]);
    const { data: pub } = db.storage.from(BUCKET).getPublicUrl(nuevaRuta);
    return { estado: 'procesada', urlFinal: pub.publicUrl };
  }

  return { estado: 'procesada', urlFinal: url };
}

async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env');
    process.exit(1);
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: productos, error } = await db.from('productos').select('id, sku, imagen_urls');
  if (error) {
    console.error('No se pudo leer productos:', error.message);
    process.exit(1);
  }

  const conImagenes = (productos || []).filter(p => Array.isArray(p.imagen_urls) && p.imagen_urls.length > 0);
  console.log(`Productos con imágenes: ${conImagenes.length}\n`);

  let procesadas = 0, saltadas = 0, errores = 0;

  for (const producto of conImagenes) {
    const nuevasUrls = [];
    let cambioAlgo = false;

    for (const url of producto.imagen_urls) {
      const resultado = await procesarImagenUrl(db, url);
      if (resultado.estado === 'procesada') { procesadas++; cambioAlgo = true; }
      else if (resultado.estado === 'saltada-ya-1-1') { saltadas++; }
      else { errores++; console.error(`  [error] ${producto.sku} - ${url}: ${resultado.detalle}`); }
      nuevasUrls.push(resultado.urlFinal);
    }

    if (cambioAlgo) {
      const { error: errUpdate } = await db.from('productos')
        .update({ imagen_urls: nuevasUrls })
        .eq('id', producto.id);
      if (errUpdate) {
        errores++;
        console.error(`  [error] no se pudo actualizar imagen_urls de ${producto.sku}: ${errUpdate.message}`);
      } else {
        console.log(`  [ok] ${producto.sku}: imagen_urls actualizado`);
      }
    } else {
      console.log(`  [sin cambios] ${producto.sku}`);
    }
  }

  console.log('\nResumen');
  console.log(`  Procesadas: ${procesadas}`);
  console.log(`  Saltadas (ya 1:1): ${saltadas}`);
  console.log(`  Errores: ${errores}`);
}

main().catch(e => { console.error('Fallo general:', e); process.exit(1); });
