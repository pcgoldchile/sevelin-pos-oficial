// Prueba: la misma compra mandada dos veces seguidas no se suma dos veces (27-10-2026).
// node scripts/prueba-compra-doble.js
const path = require('path');
const POS = path.join(__dirname, '..');
const doble = require('./doble-supabase.js');
const { bases } = doble.instalar(POS);
Object.assign(process.env, { NODE_ENV: 'development', JWT_SECRET: 'x', ADMIN_PIN: 'a', WORKER_PIN: 'b', SYNC_SECRET: 's', CORS_ORIGINS: '*' });
bases.pos.productos = [{ id: 1, nombre: 'Adaptador', precio_unitario: 2990, costo_unitario: 549, stock: 0, stock_ilimitado: false, usa_lotes: false, archivado: false, es_servicio: false, imagen_urls: [] }];
bases.pos.ingresos_mercaderia = []; bases.pos.producto_lotes = []; bases.pos.gastos_fijos = [];
const api = require(path.join(POS, 'api', 'index.js'));
const jwt = require('jsonwebtoken');
const express = require('express');
const app = express(); app.use(api);
const srv = app.listen(0, async () => {
  const base = `http://127.0.0.1:${srv.address().port}/api`;
  const tok = jwt.sign({ rol: 'admin', nombre: 'Prueba' }, 'x');
  const pedir = async (cuerpo) => { const r = await fetch(base + '/productos/1/compras', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(cuerpo) }); return [r.status, await r.json()]; };
  const compra = { fecha_compra: '2026-07-23', cantidad: 30, costo_unitario: 549, sumar_stock: true };
  try {
    const [s1, r1] = await pedir(compra);
    const [s2, r2] = await pedir(compra);
    const [s3] = await pedir({ ...compra, cantidad: 5 });
    console.log('1ra', s1, r1.stock_nuevo, '| 2da igual', s2, r2.codigo, '| otra distinta', s3);
    console.log('stock final', bases.pos.productos[0].stock, '· compras', bases.pos.ingresos_mercaderia.length);
    const ok = s1 === 201 && s2 === 409 && s3 === 201 && Number(bases.pos.productos[0].stock) === 35 && bases.pos.ingresos_mercaderia.length === 2;
    console.log(ok ? 'OK' : 'FALLA');
  } catch (e) { console.error(e); } finally { srv.close(); process.exit(0); }
});
