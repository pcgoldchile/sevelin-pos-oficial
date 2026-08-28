/* Utilidad de una sola vez: clasifica automáticamente el catálogo real por
   palabras clave del nombre (ninguno de los productos tenía categoría
   asignada) y marca publicado_web=true a los que tengan SKU (sin SKU no se
   puede sincronizar — ver POST /api/sync/producto en sevelin-tienda, exige
   sku no vacío).

   NO sincroniza a la tienda por sí solo — después de correr esto, correr
   scripts/sincronizar-catalogo-web.js (ya existente, sin cambios) para
   empujar los productos recién publicados.

   Uso:  node scripts/clasificar-y-publicar-catalogo.js
   Requiere en .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (los del POS).
   No depende de "dotenv": lee el .env a mano, mismo patrón que los demás
   scripts de esta carpeta. */
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

// Taxonomía derivada del catálogo real (ver docs/CHANGELOG del POS) — no
// inventada, cada palabra clave viene de nombres reales de productos.
// "Accesorios de PC" es deliberadamente una categoría paraguas (confirmado
// con el usuario): agrupa periféricos, cables, energía portátil y audio en
// vez de fragmentarlos, porque la tienda hoy filtra por categoría plana sin
// jerarquía visible al cliente.
const CATEGORIAS = [
  'Monitores',
  'Gabinetes',
  'Fuentes de Poder',
  'Refrigeración',
  'Almacenamiento',
  'Placas Madre',
  'Servicios Técnicos',
  'Accesorios de PC',
];

// Orden importa: el primer patrón que matchee gana. Todo lo que no matchee
// nada cae en "Accesorios de PC" (catch-all, última entrada).
const REGLAS = [
  { categoria: 'Monitores', patron: /\bmonitor(es)?\b/i },
  { categoria: 'Gabinetes', patron: /\bgabinete\b/i },
  { categoria: 'Fuentes de Poder', patron: /\bfuente\s+de\s+poder\b|\b(atx|80\s*\+|80\s*plus)\b.*\bfuente\b|\bgp-p750bs\b/i },
  { categoria: 'Refrigeración', patron: /\bcooler\b|\bdisipador\b/i },
  { categoria: 'Almacenamiento', patron: /\bssd\b|\bpendrive\b|\bdatatraveler\b|\bhdd\b|\bcofre\b.*\b(hdd|ssd)\b|\bnv3\b|\bhsc408\b/i },
  { categoria: 'Placas Madre', patron: /\bplaca\s+madre\b|\ba520m\b/i },
  { categoria: 'Servicios Técnicos', patron: /^servicio\b|\bdiagnostico\b|\bformateo\b|\breprogramaci[oó]n\b|\bclonaci[oó]n\b|\bactualizaci[oó]n de bios\b|\bmantenimiento\b|\blimpieza (interna|basica)\b/i },
  // Accesorios de PC: periféricos + cables/adaptadores + energía portátil + audio
  { categoria: 'Accesorios de PC', patron: /\bmouse\b|\bteclado\b|\bjoystick\b|\bcombo\b|\bpresentador\b/i },
  { categoria: 'Accesorios de PC', patron: /\bcable\b|\badaptador\b|\bhub\b|\bantena\b/i },
  { categoria: 'Accesorios de PC', patron: /\bpower\s*bank\b|\bbateria\s+(portatil|externa)\b|\bcargador\b/i },
  { categoria: 'Accesorios de PC', patron: /\baudifono(s)?\b|\bparlante(s)?\b/i },
];

function clasificar(nombre) {
  for (const regla of REGLAS) {
    if (regla.patron.test(nombre)) return regla.categoria;
  }
  return 'Accesorios de PC'; // catch-all final: pilas, funda, soporte celular, raqueta, etc.
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

  console.log('Asegurando categorías...');
  for (const nombre of CATEGORIAS) {
    const { error } = await db.from('producto_categorias').insert([{ nombre }]);
    if (error && !/duplicate|unique/i.test(error.message)) {
      console.error(`  [error] no se pudo crear "${nombre}": ${error.message}`);
    }
  }

  const { data: categoriasDb, error: errCat } = await db.from('producto_categorias').select('id, nombre');
  if (errCat) { console.error('No se pudieron leer las categorías:', errCat.message); process.exit(1); }
  const idPorNombre = Object.fromEntries(categoriasDb.map(c => [c.nombre, c.id]));

  const { data: productos, error } = await db.from('productos').select('id, sku, nombre');
  if (error) { console.error('No se pudo leer productos:', error.message); process.exit(1); }

  const conSku = productos.filter(p => p.sku && String(p.sku).trim());
  const sinSku = productos.filter(p => !p.sku || !String(p.sku).trim());

  console.log(`\nProductos con SKU (se publican): ${conSku.length}`);
  console.log(`Productos sin SKU (quedan sin publicar): ${sinSku.length}\n`);

  const conteo = {};
  let actualizados = 0, errores = 0;

  for (const producto of conSku) {
    const categoria = clasificar(producto.nombre);
    conteo[categoria] = (conteo[categoria] || 0) + 1;

    const { error: errUpdate } = await db.from('productos')
      .update({
        categoria_id: idPorNombre[categoria] || null,
        categoria_web: categoria,
        publicado_web: true,
      })
      .eq('id', producto.id);

    if (errUpdate) {
      errores++;
      console.error(`  [error] ${producto.sku} (${producto.nombre}): ${errUpdate.message}`);
    } else {
      actualizados++;
    }
  }

  console.log('Resumen por categoría:');
  Object.entries(conteo).sort((a, b) => b[1] - a[1]).forEach(([cat, n]) => {
    console.log(`  ${cat}: ${n}`);
  });

  console.log(`\nActualizados: ${actualizados}`);
  console.log(`Errores: ${errores}`);

  if (sinSku.length > 0) {
    console.log(`\nSin SKU (revisar en el POS antes de poder publicarlos):`);
    sinSku.forEach(p => console.log(`  - ${p.nombre}`));
  }

  console.log('\nAhora corre: node scripts/sincronizar-catalogo-web.js');
}

main().catch(e => { console.error('Fallo general:', e); process.exit(1); });
