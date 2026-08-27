/* Utilidad de una sola vez: empuja a sevelin-tienda todos los productos que
   YA estaban marcados publicado_web=true en el POS ANTES de configurar el
   Database Webhook. El webhook (ver sevelin-tienda/docs/README-WEBHOOK-POS.md)
   solo dispara con cambios FUTUROS — sin este script, esos productos nunca
   aparecerían en la tienda hasta re-guardarlos uno por uno a mano.

   Reutiliza el mismo contrato que el webhook real: POST a
   /api/sync/producto con el envelope { type, table, record }, protegido
   con el header x-sync-secret. No duplica lógica de sincronización, solo
   la dispara manualmente para el catálogo que ya existía.

   Uso:  node scripts/sincronizar-catalogo-web.js
   Requiere en .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SYNC_SECRET
   (el mismo valor configurado en sevelin-tienda), y TIENDA_SYNC_URL
   (ej. https://sevelin-tienda.vercel.app/api/sync/producto).
   No depende de "dotenv" (no es una dependencia del proyecto): lee el
   .env a mano, solo para esta utilidad de una sola vez. */
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
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SYNC_SECRET, TIENDA_SYNC_URL } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env');
    process.exit(1);
  }
  if (!SYNC_SECRET) {
    console.error('Falta SYNC_SECRET en .env (mismo valor que en sevelin-tienda)');
    process.exit(1);
  }
  if (!TIENDA_SYNC_URL) {
    console.error('Falta TIENDA_SYNC_URL en .env, ej. https://sevelin-tienda.vercel.app/api/sync/producto');
    process.exit(1);
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: productos, error } = await db.from('productos').select('*').eq('publicado_web', true);
  if (error) {
    console.error('No se pudo leer productos:', error.message);
    process.exit(1);
  }

  console.log(`Encontrados ${productos.length} producto(s) marcados publicado_web=true.\n`);

  let ok = 0;
  let fallidos = 0;

  for (const producto of productos) {
    const etiqueta = producto.sku || `id ${producto.id}`;
    try {
      const respuesta = await fetch(TIENDA_SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-sync-secret': SYNC_SECRET },
        body: JSON.stringify({ type: 'UPDATE', table: 'productos', record: producto, old_record: null }),
      });
      const data = await respuesta.json().catch(() => ({}));

      if (!respuesta.ok) {
        console.error(`✗ ${etiqueta}: HTTP ${respuesta.status} — ${data.error || JSON.stringify(data)}`);
        fallidos++;
      } else if (data.ok === false) {
        // Caso no-error (ej. motivo: 'sin_sku'), pero tampoco sincronizó.
        console.warn(`⚠ ${etiqueta}: ${data.mensaje || data.motivo}`);
        fallidos++;
      } else {
        console.log(`✓ ${etiqueta} — ${producto.nombre}`);
        ok++;
      }
    } catch (err) {
      console.error(`✗ ${etiqueta}: ${err.message}`);
      fallidos++;
    }
  }

  console.log(`\nListo: ${ok} sincronizado(s), ${fallidos} fallido(s) de ${productos.length}.`);
  if (fallidos > 0) process.exitCode = 1;
}

main();
