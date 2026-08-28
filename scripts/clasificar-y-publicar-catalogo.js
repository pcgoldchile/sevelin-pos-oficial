/* Utilidad de una sola vez: clasifica automáticamente el catálogo real por
   palabras clave del nombre (ninguno de los productos tenía categoría
   asignada) y marca publicado_web=true a los que tengan SKU (sin SKU no se
   puede sincronizar — ver POST /api/sync/producto en sevelin-tienda, exige
   sku no vacío).

   v2: taxonomía más fina, inspirada en las categorías reales de
   sevelin.cl (Tiendanube — Monitores/Accesorios/Componentes PC/
   Computadores/Funda/Servicios Técnicos/Almacenamiento/Herramientas/
   Hogar), pero NO copiada 1:1: "Accesorios" en Tiendanube es un cajón de
   sastre igual de amplio que el "Accesorios de PC" de la v1 — acá se
   separa en Periféricos / Audio / Cables y Adaptadores / Energía
   Portátil / Accesorios Móviles, y se agrega "Hogar y Estilo de Vida"
   para productos que NO son de PC (ej. el aro de luz LED de fotografía,
   que la v1 dejó mal metido en "Accesorios de PC").

   Re-ejecutable: reasigna categoria_id/categoria_web de TODOS los
   productos con SKU (no solo los nuevos), y al final borra cualquier
   categoría vieja que quedó sin productos (ej. "Accesorios de PC" de la
   v1, ya reemplazada).

   NO sincroniza a la tienda por sí solo — después de correr esto, correr
   scripts/sincronizar-catalogo-web.js (ya existente, sin cambios) para
   empujar los cambios.

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

const CATEGORIAS = [
  'Monitores',
  'Computadores',
  'Componentes PC',
  'Almacenamiento',
  'Periféricos',
  'Audio',
  'Cables y Adaptadores',
  'Energía Portátil',
  'Accesorios Móviles',
  'Hogar y Estilo de Vida',
  'Herramientas',
  'Servicios Técnicos',
];

// Orden importa: el primer patrón que matchee gana. Deliberadamente sin
// catch-all a "Accesorios de PC" (ese era el problema de la v1) — lo que
// no matchea nada cae en "Hogar y Estilo de Vida", que es el bucket
// correcto para gadgets sueltos que no son ni de PC ni de celular.
const REGLAS = [
  { categoria: 'Monitores', patron: /\bmonitor(es)?\b/i },
  { categoria: 'Computadores', patron: /\b(pc|computador(a)?|notebook|laptop)\b.*\b(core i\d|ryzen|reacondicionado)\b|\boptiplex\b|\bprodesk\b/i },
  { categoria: 'Componentes PC', patron: /\bgabinete\b|\bfuente\s+de\s+poder\b|\b80\s*(\+|plus)\b|\bcooler\b|\bdisipador\b|\bplaca\s+madre\b|\ba520m\b|\bgp-p750bs\b/i },
  { categoria: 'Almacenamiento', patron: /\bssd\b|\bpendrive\b|\bdatatraveler\b|\bhdd\b|\bcofre\b|\bnv3\b|\bhsc408\b|\btarjeta de memoria\b|\bmicrosd\b/i },
  { categoria: 'Periféricos', patron: /\bmouse\b|\bteclado\b|\bjoystick\b|\bcombo\b.*\b(teclado|mouse)\b|\bpresentador\b/i },
  { categoria: 'Audio', patron: /\baudifono(s)?\b|\bparlante(s)?\b/i },
  { categoria: 'Cables y Adaptadores', patron: /\bcable\b|\badaptador\b|\bhub\b|\bantena\b/i },
  { categoria: 'Energía Portátil', patron: /\bpower\s*bank\b|\bbateria\s+(portatil|externa)\b|\bcargador\b/i },
  { categoria: 'Accesorios Móviles', patron: /\bfunda\b|\bsoporte\s+celular\b|\btransmisor\s+fm\b/i },
  { categoria: 'Herramientas', patron: /\bcautin\b|\bdestornillador(es)?\b|\bdados\s+mecanicos\b|\bkit\s+electrico\b/i },
  { categoria: 'Servicios Técnicos', patron: /^servicio\b|\bdiagnostico\b|\bformateo\b|\breprogramaci[oó]n\b|\bclonaci[oó]n\b|\bactualizaci[oó]n de bios\b|\bmantenimiento\b|\blimpieza (interna|basica)\b/i },
];

function clasificar(nombre) {
  for (const regla of REGLAS) {
    if (regla.patron.test(nombre)) return regla.categoria;
  }
  // Catch-all real: gadgets que no son de PC ni de celular (pilas, balanza,
  // aro de luz LED de fotografía, raqueta mata moscas, etc.) — mismo
  // criterio que "Hogar" en sevelin.cl, no se fuerzan a un cajón de PC.
  return 'Hogar y Estilo de Vida';
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
  const idsUsados = new Set();
  let actualizados = 0, errores = 0;

  for (const producto of conSku) {
    const categoria = clasificar(producto.nombre);
    conteo[categoria] = (conteo[categoria] || 0) + 1;
    if (idPorNombre[categoria]) idsUsados.add(idPorNombre[categoria]);

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

  // Limpieza: borra categorías que quedaron sin ningún producto en ESTA
  // corrida (ej. "Accesorios de PC" de la v1, ya reemplazada). Los
  // productos sin SKU (sinSku) no se tocan, así que su categoria_id viejo
  // (si tenían) no cuenta como "en uso" — igual que antes, siguen sin
  // publicar hasta que se les cargue SKU.
  const huerfanas = categoriasDb.filter(c => !idsUsados.has(c.id) && !CATEGORIAS.includes(c.nombre));
  for (const c of huerfanas) {
    const { error: errDel } = await db.from('producto_categorias').delete().eq('id', c.id);
    if (!errDel) console.log(`\n[limpieza] categoría vacía borrada: "${c.nombre}"`);
  }

  console.log('\nAhora corre: node scripts/sincronizar-catalogo-web.js');
}

main().catch(e => { console.error('Fallo general:', e); process.exit(1); });
