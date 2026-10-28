// Prueba de "Metas de hoy" (27-10-2026) contra el servidor real y el doble de Supabase: node scripts/prueba-metas.js
const path = require('path');
const POS = path.join(__dirname, '..');
const doble = require('./doble-supabase.js');
const { bases } = doble.instalar(POS);
Object.assign(process.env, { NODE_ENV: 'development', JWT_SECRET: 'x', ADMIN_PIN: 'a', WORKER_PIN: 'b', SYNC_SECRET: 's', CORS_ORIGINS: '*' });
const api = require(path.join(POS, 'api', 'index.js'));
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
const mes = hoy.slice(0, 7);
bases.pos.ventas = [
  { id: 1, fecha: `${mes}-01`, estado: 'PAGADA', total: 100000, costo_total: 60000, origen_cliente: 'facebook', tipo_dte: 'BOLETA' },
  { id: 2, fecha: hoy, estado: 'PAGADA', total: 50000, costo_total: 20000, origen_cliente: '', tipo_dte: 'SIN DTE' },
  { id: 3, fecha: hoy, estado: 'PENDIENTE', total: 999999, costo_total: 0 },
  { id: 4, fecha: '2020-01-01', estado: 'PAGADA', total: 777777, costo_total: 0 }
];
bases.pos.venta_items = [{ id: 1, venta_id: 2, cantidad: 1, es_servicio: true }, { id: 2, venta_id: 1, cantidad: 2, es_servicio: false }];
bases.pos.pendientes = [
  { id: 1, titulo: 'Subir a Pro', estado: 'pendiente', responsable: 'dueno', prioridad: 'alta' },
  { id: 2, titulo: 'Más tarde', estado: 'postergado', responsable: 'dueno', revisar_el: '2099-01-01' },
  { id: 3, titulo: 'De Claude', estado: 'pendiente', responsable: 'claude' }
];
bases.pos.textos_editables = [];
const jwt = require('jsonwebtoken');
const express = require('express');
const app = express(); app.use(api);
const srv = app.listen(0, async () => {
  const base = `http://127.0.0.1:${srv.address().port}/api`;
  const tok = jwt.sign({ rol: 'admin', nombre: 'Prueba' }, 'x');
  const pedir = async (m, ruta, cuerpo) => { const r = await fetch(base + ruta, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: cuerpo ? JSON.stringify(cuerpo) : undefined }); return [r.status, await r.json()]; };
  try {
    let [st, r] = await pedir('GET', '/metas/hoy');
    console.log('1', st, 'venta', r.mes?.venta, 'margen', Math.round(r.mes?.margen), 'servicios', r.mes?.servicios, 'origen%', r.mes?.origen_pct, 'boleta%', r.mes?.boleta_pct, 'meta', r.metas?.venta_mes, 'pend', r.pendientes?.map(p => p.titulo).join(','), r.error || '');
    const ok1 = st === 200 && r.mes.venta === 150000 && Math.round(r.mes.margen) === 47 && r.mes.servicios === 1 && r.mes.origen_pct === 50 && r.pendientes.length === 1;
    [st, r] = await pedir('PUT', '/metas', { etapa: 'Prueba', venta_mes: 5000000, margen_min: 35, servicios_mes: 40, ticket: 30000, origen_pct: 80 });
    const [st2, r2] = await pedir('GET', '/metas/hoy');
    const [st3] = await pedir('PUT', '/metas', { venta_mes: 'abc', margen_min: 35, servicios_mes: 40, ticket: 30000, origen_pct: 80 });
    console.log('2 guardar', st, '→ meta', r2.metas?.venta_mes, r2.metas?.etapa, '| inválida', st3);
    // Calendario y metas de Automotriz
    bases.pos.calendario_eventos = bases.pos.calendario_eventos || [];
    const [c1, e1] = await pedir('POST', '/calendario', { fecha: hoy, hora_inicio: '20:00', titulo: 'Reunión digital socios', negocio: 'AUTOMOTRIZ', lugar: 'Meet' });
    const [c2] = await pedir('POST', '/calendario', { fecha: hoy, titulo: 'Dentista', negocio: 'PERSONAL' });
    const [c3] = await pedir('POST', '/calendario', { fecha: 'mañana', titulo: 'x' });
    const [a1] = await pedir('PUT', '/metas/automotriz', { etapa: 'Etapa 0', servicios_mes: 20, venta_mes: 600000, objetivos: [{ texto: 'Ir a la Municipalidad', hecho: true }, { texto: 'ok' }] });
    const [, r4] = await pedir('GET', '/metas/hoy');
    console.log('3 calendario', c1, c2, c3, '| auto', a1, r4.automotriz?.objetivos?.length, '| eventos POS', r4.eventos?.length, e1.visible_taller);
    const [d1] = await pedir('DELETE', '/calendario/' + e1.id);
    const [, r5] = await pedir('GET', '/calendario');
    console.log('4 borrar', d1, 'quedan', r5.length);
    const okCal = c1 === 201 && c2 === 201 && c3 === 400 && a1 === 200 && r4.automotriz.objetivos.length === 1 && r4.eventos.length === 2 && d1 === 200 && r5.length === 1;
    console.log(ok1 && st === 200 && r2.metas.venta_mes === 5000000 && st3 === 400 && okCal ? 'OK' : 'FALLA');
  } catch (e) { console.error(e); } finally { srv.close(); process.exit(0); }
});
