// Prueba de los Puntos Sevelin (v167) contra el servidor real y el doble de Supabase: node scripts/prueba-puntos.js
const path = require('path');
const POS = path.join(__dirname, '..');
const doble = require('./doble-supabase.js');
const { bases, rpc } = doble.instalar(POS);
Object.assign(process.env, { NODE_ENV: 'development', JWT_SECRET: 'x', ADMIN_PIN: 'a', WORKER_PIN: 'b', SYNC_SECRET: 's', CORS_ORIGINS: '*' });
rpc.descontar_stock_venta = () => ({ data: [], error: null });
rpc.descontar_stock_venta_idem = () => ({ data: [], error: null });
rpc.limpiar_descuentos_huerfanos = () => ({ data: null, error: null });
const prod = (id, nombre, precio, costo, extra = {}) => ({ id, nombre, precio_unitario: precio, costo_unitario: costo, stock: 50, stock_ilimitado: false, usa_lotes: false, archivado: false, es_servicio: false, imagen_urls: [], ...extra });
bases.pos.productos = [prod(1, 'Mouse', 20000, 12000), prod(2, 'Mantenimiento', 40000, 0, { es_servicio: true, stock_ilimitado: true }), prod(3, 'Monitor', 85000, 80000)];
bases.pos.ventas = []; bases.pos.venta_items = [];
bases.web.cuentas_puntos = []; bases.web.movimientos_puntos = []; bases.web.codigos_canje = [];
const api = require(path.join(POS, 'api', 'index.js'));
const jwt = require('jsonwebtoken');
const express = require('express');
const app = express(); app.use(api);
const srv = app.listen(0, async () => {
  const base = `http://127.0.0.1:${srv.address().port}/api`;
  const tok = jwt.sign({ rol: 'admin', nombre: 'Prueba' }, 'x');
  const pedir = async (m, ruta, cuerpo) => { const r = await fetch(base + ruta, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: cuerpo ? JSON.stringify(cuerpo) : undefined }); return [r.status, await r.json()]; };
  const linea = (id, cant, precio) => ({ producto_id: id, nombre: 'x', cantidad: cant, precio_unitario: precio });
  try {
    let [st, r] = await pedir('POST', '/puntos/cuentas', { nombre: 'Carlos Silva', telefono: '9 1234 5678', consentimiento: true });
    console.log('1 crear', st, r.cuenta?.codigo, r.cuenta?.nombre, r.cuenta?.telefono);
    const cid = r.cuenta.id;
    console.log('1b repetido', (await pedir('POST', '/puntos/cuentas', { nombre: 'Otro', telefono: '+56912345678', consentimiento: true }))[0]);
    console.log('1c sin consentimiento', (await pedir('POST', '/puntos/cuentas', { nombre: 'Otro', telefono: '987654321' }))[0]);
    [st, r] = await pedir('GET', '/puntos/buscar?q=' + encodeURIComponent('+56 9 1234 5678'));
    console.log('1d buscar por fono', st, r.cuenta?.codigo);
    // 2. Venta que suma: mouse 20.000 (1%) + mantenimiento 40.000 (2%) = 200 + 800 = 1.000 + bono 1.000
    [st, r] = await pedir('POST', '/ventas', { items: [linea(1, 1, 20000), linea(2, 1, 40000)], metodo_pago: 'Efectivo', puntos: { cuenta_id: cid } });
    console.log('2 venta', st, 'total', r.total, 'ganados', r.puntos_ganados, 'bono', r.puntos_bono, r.error || '');
    const ventaId = r.id;
    console.log('2b movimientos', JSON.stringify(bases.web.movimientos_puntos.map(m => [m.tipo, m.puntos])));
    [st, r] = await pedir('GET', '/puntos/buscar?q=' + encodeURIComponent(bases.web.cuentas_puntos[0].codigo));
    console.log('2c saldo recien comprado (pendiente)', JSON.stringify(r.cuenta?.saldo));
    // Hacer disponibles (como si pasaran 10 días) y darle 5.000 más
    bases.web.movimientos_puntos.forEach(m => { m.disponible_desde = new Date(Date.now() - 86400000).toISOString(); });
    bases.web.movimientos_puntos.push({ id: 999, cuenta_id: cid, tipo: 'ajuste', puntos: 5000, anulado: false, disponible_desde: new Date(Date.now() - 86400000).toISOString(), vence_en: new Date(Date.now() + 300 * 86400000).toISOString(), origen: 'sistema', creado_en: new Date(Date.now() - 86400000).toISOString() });
    // 3. Tope: monitor 85.000 con costo 80.000 → utilidad 5.000 → 50% = 2.500; 10% = 8.500 → tope 2.500
    [st, r] = await pedir('POST', '/puntos/tope', { cuenta_id: cid, items: [linea(3, 1, 85000)] });
    console.log('3 tope monitor', st, JSON.stringify(r));
    [st, r] = await pedir('POST', '/puntos/tope', { cuenta_id: cid, items: [linea(1, 1, 8000)] });
    console.log('3b compra chica', st, r.motivo);
    // 4. Código por WhatsApp
    [st, r] = await pedir('POST', '/puntos/codigo', { cuenta_id: cid });
    const codigo = decodeURIComponent(r.whatsapp.split('text=')[1]).match(/es (\d{6})/)[1];
    console.log('4 codigo', st, r.whatsapp.slice(0, 32), '… código de 6:', /^\d{6}$/.test(codigo));
    // 5. Código equivocado
    console.log('5 malo', JSON.stringify(await pedir('POST', '/puntos/verificar-codigo', { cuenta_id: cid, codigo: codigo === '000000' ? '111111' : '000000' })));
    // 6. Canje: pide 7.000 en el monitor → queda en el tope 2.500
    [st, r] = await pedir('POST', '/ventas', { items: [linea(3, 1, 85000)], metodo_pago: 'Efectivo', puntos: { cuenta_id: cid, canjear: 7000, codigo } });
    console.log('6 canje', st, 'total', r.total, 'descuento', r.descuento_monto, 'canjeados', r.puntos_canjeados, 'ganados', r.puntos_ganados, r.error || '');
    // 7. Segundo canje el mismo día
    [st, r] = await pedir('POST', '/puntos/codigo', { cuenta_id: cid });
    const codigo2 = decodeURIComponent(r.whatsapp.split('text=')[1]).match(/es (\d{6})/)[1];
    [st, r] = await pedir('POST', '/ventas', { items: [linea(1, 1, 20000)], metodo_pago: 'Efectivo', puntos: { cuenta_id: cid, canjear: 2000, codigo: codigo2 } });
    console.log('7 segundo canje', st, r.error);
    // Reusar el código ya gastado
    [st, r] = await pedir('POST', '/puntos/buscar?q=x');
    [st, r] = await pedir('GET', '/puntos/buscar?q=' + encodeURIComponent('912345678'));
    console.log('7b saldo', JSON.stringify(r.cuenta.saldo));
    // 8. Devolución total de la primera venta
    [st, r] = await pedir('POST', `/ventas/${ventaId}/devolucion`, { tipo: 'TOTAL', motivo: 'ARREPENTIMIENTO', metodo_devolucion: 'Efectivo', items: bases.pos.venta_items.filter(i => i.venta_id === ventaId).map(i => ({ venta_item_id: i.id, item_id: i.id, cantidad: i.cantidad })) });
    console.log('8 devolucion', st, r.error || r.tipo);
    console.log('8b movimientos', JSON.stringify(bases.web.movimientos_puntos.map(m => [m.tipo, m.puntos, m.anulado ? 'anulado' : '', m.venta_ref])));
    const [, res9] = await pedir('GET', '/puntos/resumen');
    console.log('9 resumen', JSON.stringify(res9));
  } catch (e) { console.log('FALLO', e); }
  srv.close(); process.exit(0);
});
