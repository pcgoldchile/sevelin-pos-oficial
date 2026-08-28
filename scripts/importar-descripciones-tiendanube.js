/* Utilidad de una sola vez: sube a `productos.descripcion_web` (POS) las
   descripciones ya extraídas de sevelin.cl (Tiendanube, mismo negocio) —
   el mapeo lo genera aparte scripts/_tmp-scrape-descripciones.js (matching
   por SKU=slug de URL) + un segundo pase por nombre para los SKU que no son
   slug. Solo toca productos con descripcion_web vacío (no pisa texto ya
   escrito a mano).

   Uso:  node scripts/importar-descripciones-tiendanube.js <ruta-al-mapeo.json>
   El mapeo es un array de { id, sku, nombre, descripcion }.

   Requiere en .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (del POS).
   Después de correr esto, ejecutar scripts/sincronizar-catalogo-web.js para
   empujar los cambios a sevelin-tienda. */
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

async function main() {
  const rutaMapeo = process.argv[2];
  if (!rutaMapeo) {
    console.error('Uso: node scripts/importar-descripciones-tiendanube.js <ruta-al-mapeo.json>');
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

  let ok = 0, saltados = 0, errores = 0;

  for (const item of mapeo) {
    const { data: actual, error: errLeer } = await db.from('productos')
      .select('descripcion_web').eq('id', item.id).single();

    if (errLeer) {
      errores++;
      console.error(`[error lectura] ${item.sku}: ${errLeer.message}`);
      continue;
    }

    if (actual.descripcion_web && actual.descripcion_web.trim()) {
      saltados++;
      console.log(`[salteado] ${item.sku} ya tiene descripción`);
      continue;
    }

    const { error: errUpdate } = await db.from('productos')
      .update({ descripcion_web: item.descripcion })
      .eq('id', item.id);

    if (errUpdate) {
      errores++;
      console.error(`[error db] ${item.sku}: ${errUpdate.message}`);
    } else {
      ok++;
      console.log(`[ok] ${item.sku} (${item.nombre})`);
    }
  }

  console.log('\nResumen');
  console.log(`  Actualizados: ${ok}`);
  console.log(`  Salteados (ya tenían descripción): ${saltados}`);
  console.log(`  Errores: ${errores}`);
  console.log('\nAhora corre: node scripts/sincronizar-catalogo-web.js');
}

main().catch(e => { console.error('Fallo general:', e); process.exit(1); });
