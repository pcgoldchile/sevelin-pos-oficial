/* Empuja a sevelin-tienda cuántas unidades se ha vendido de cada producto,
   para que la portada de la tienda ordene "Destacados" por lo que de verdad
   se vende en vez de por orden alfabético.

   POR QUÉ ESTE DATO SALE DEL POS
   El grueso de las ventas del negocio pasa por el mostrador. Los pedidos
   web solos darían una foto muy parcial. La tienda nunca consulta el
   Supabase del POS directo (regla dura del proyecto): el POS empuja, la
   tienda solo guarda — mismo criterio que el resto de la sincronización.

   ES IDEMPOTENTE: manda el TOTAL histórico de cada producto, no un
   incremento. Reejecutarlo (o reintentarlo tras un timeout) deja
   exactamente el mismo estado, nunca infla los contadores.

   Uso:  node scripts/sincronizar-mas-vendidos.js
   Conviene correrlo cada cierto tiempo (semanal es más que suficiente:
   el orden de una portada no necesita ser de hoy).

   Requiere en .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SYNC_SECRET
   (el mismo valor configurado en sevelin-tienda) y TIENDA_MAS_VENDIDOS_URL
   (ej. https://sevelin-tienda.vercel.app/api/sync/mas-vendidos).
   No depende de "dotenv" (no es una dependencia del proyecto): lee el .env
   a mano, igual que scripts/sincronizar-catalogo-web.js. */
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

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SYNC_SECRET } = process.env;
const TIENDA_URL =
  process.env.TIENDA_MAS_VENDIDOS_URL || 'https://sevelin-tienda.vercel.app/api/sync/mas-vendidos';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}
if (!SYNC_SECRET) {
  console.error('Falta SYNC_SECRET en .env (debe ser el MISMO valor configurado en sevelin-tienda)');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

(async () => {
  console.log('Leyendo ventas del POS…');

  /* Solo ventas PAGADAS: una venta pendiente de cobro todavía no es una
     venta, y una anulada no debería inflar el ranking de la portada.
     Se pagina porque venta_items crece sin techo y Supabase corta el
     resultado por defecto (1000 filas) — sin esto el ranking saldría
     calculado solo sobre las primeras 1000 líneas, en silencio. */
  const PAGINA = 1000;
  const vendidasPorProducto = new Map();
  let desde = 0;
  let leidas = 0;

  for (;;) {
    const { data, error } = await db
      .from('venta_items')
      .select('producto_id, cantidad, es_servicio, ventas!inner(estado)')
      .eq('ventas.estado', 'PAGADA')
      .range(desde, desde + PAGINA - 1);

    if (error) {
      console.error('Error al leer venta_items:', error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;

    for (const item of data) {
      // Los servicios (mano de obra) no son productos del catálogo web y
      // los ítems escritos a mano no tienen producto_id: ninguno de los
      // dos puede aparecer en la portada de la tienda.
      if (item.es_servicio) continue;
      if (!item.producto_id) continue;

      const previo = vendidasPorProducto.get(item.producto_id) || 0;
      vendidasPorProducto.set(item.producto_id, previo + (Number(item.cantidad) || 0));
    }

    leidas += data.length;
    if (data.length < PAGINA) break;
    desde += PAGINA;
  }

  console.log(`  ${leidas} líneas de venta leídas · ${vendidasPorProducto.size} productos distintos`);

  if (vendidasPorProducto.size === 0) {
    console.log('No hay ventas que sincronizar.');
    return;
  }

  const ventas = [...vendidasPorProducto.entries()]
    .map(([producto_pos_id, unidades]) => ({ producto_pos_id, unidades }))
    .sort((a, b) => b.unidades - a.unidades);

  console.log('\nTop 10 del POS:');
  ventas.slice(0, 10).forEach((v, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. producto ${v.producto_pos_id} → ${v.unidades} unidades`);
  });

  console.log(`\nEnviando a ${TIENDA_URL}…`);
  const res = await fetch(TIENDA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-sync-secret': SYNC_SECRET },
    body: JSON.stringify({ ventas }),
  });

  const cuerpo = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`Falló (${res.status}):`, cuerpo?.error || 'sin detalle');
    process.exit(1);
  }

  console.log(
    `Listo: ${cuerpo.actualizados} productos actualizados en la tienda ` +
      `(${cuerpo.sinCoincidencia} no están publicados en la web, se ignoraron).`
  );
})().catch(err => {
  console.error('Error inesperado:', err.message);
  process.exit(1);
});
