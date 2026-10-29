// Prueba: aceptar una propuesta de bodega v3 agrega el lugar de la bodega y el de la vitrina (29-10-2026).
// node scripts/prueba-bodega-v3.js
const path = require('path');
const POS = path.join(__dirname, '..');
const doble = require('./doble-supabase.js');
const { bases } = doble.instalar(POS);
Object.assign(process.env, { NODE_ENV: 'development', JWT_SECRET: 'x', ADMIN_PIN: 'a', WORKER_PIN: 'b', SYNC_SECRET: 's', CORS_ORIGINS: '*' });
bases.pos.ubicaciones = [{ id: 1, nombre: 'E3', tipo: 'estante', activo: true }];
bases.pos.producto_ubicaciones = [];
bases.pos.bodega_propuestas = [
  { producto_id: 162, lugar: 'E3', caja: null, motivo: 'power banks', estado: 'pendiente', vitrina: 'M1' },
  { producto_id: 330, lugar: 'P1', caja: null, motivo: 'se arma', estado: 'pendiente', vitrina: null },
];
const api = require(path.join(POS, 'api', 'index.js'));
const jwt = require('jsonwebtoken');
const express = require('express');
const app = express(); app.use(api);
const srv = app.listen(0, async () => {
  const base = `http://127.0.0.1:${srv.address().port}/api`;
  const tok = jwt.sign({ rol: 'admin', nombre: 'Prueba' }, 'x');
  const aceptar = async (id) => { const r = await fetch(`${base}/bodega/propuestas/${id}/aceptar`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: '{}' }); return [r.status, await r.json()]; };
  try {
    const [s1, r1] = await aceptar(162);
    const [s2, r2] = await aceptar(330);
    const lugaresDe = (pid) => bases.pos.producto_ubicaciones.filter(x => Number(x.producto_id) === pid)
      .map(x => ({ n: bases.pos.ubicaciones.find(u => Number(u.id) === Number(x.ubicacion_id))?.nombre, principal: x.principal }));
    const pb = lugaresDe(162), pe = lugaresDe(330);
    console.log('power bank', s1, r1, pb, '| perchero', s2, r2, pe);
    const m1 = bases.pos.ubicaciones.find(u => u.nombre === 'M1');
    const ok = s1 === 200 && r1.vitrina === 'M1' && pb.length === 2 && pb.find(x => x.n === 'E3')?.principal === true && pb.find(x => x.n === 'M1')?.principal === false
      && m1?.tipo === 'vitrina' && s2 === 200 && pe.length === 1 && pe[0].n === 'P1'
      && bases.pos.ubicaciones.find(u => u.nombre === 'P1')?.tipo === 'bodega'
      && bases.pos.bodega_propuestas.every(p => p.estado === 'aceptada');
    console.log(ok ? 'OK' : 'FALLA');
  } catch (e) { console.error(e); } finally { srv.close(); process.exit(0); }
});
