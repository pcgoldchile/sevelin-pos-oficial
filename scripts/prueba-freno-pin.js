// Prueba del freno escalonado del PIN (auditoría 28-10-2026): node scripts/prueba-freno-pin.js
const path = require('path');
const POS = path.join(__dirname, '..');
const doble = require('./doble-supabase.js');
const { bases } = doble.instalar(POS);
Object.assign(process.env, { NODE_ENV: 'development', JWT_SECRET: 'x', ADMIN_PIN: '4321', WORKER_PIN: '8765', SYNC_SECRET: 's', CORS_ORIGINS: '*' });
delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN;
bases.pos.intentos_pin = []; bases.pos.registro_errores = [];
const api = require(path.join(POS, 'api', 'index.js'));
const express = require('express');
const app = express(); app.use(api);
const srv = app.listen(0, async () => {
  const base = `http://127.0.0.1:${srv.address().port}/api`;
  const login = async (pin) => { const r = await fetch(base + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '9.9.9.9' }, body: JSON.stringify({ pin }) }); return [r.status, (await r.json()).error || 'ok']; };
  const minutosBloqueo = () => { const f = bases.pos.intentos_pin.find(x => x.ip === '9.9.9.9'); return f ? Math.round((Number(f.hasta) - Date.now()) / 60000) : null; };
  const pasarTiempo = () => { const f = bases.pos.intentos_pin.find(x => x.ip === '9.9.9.9'); f.hasta = Date.now() - 1000; };
  try {
    const escalones = [];
    for (let ronda = 1; ronda <= 5; ronda++) {
      for (let i = 0; i < 5; i++) await login('0000');
      const [st, msg] = await login('0000');   // ya bloqueado
      escalones.push(`${minutosBloqueo()}min(${st})`);
      if (ronda === 2) console.log('mensaje bloqueado:', msg);
      pasarTiempo();
    }
    console.log('bloqueos:', escalones.join(' → '));
    console.log('alertas en registro_errores:', bases.pos.registro_errores.length);
    const [stOk] = await login('4321');
    const f = bases.pos.intentos_pin.find(x => x.ip === '9.9.9.9');
    console.log('PIN correcto:', stOk, '→ bloqueos', f.bloqueos, 'n', f.n);
    const [stW] = await login('8765');
    const ok = escalones.join(',') === '1min(429),5min(429),15min(429),60min(429),60min(429)' && bases.pos.registro_errores.length === 3 && stOk === 200 && f.bloqueos === 0 && stW === 200;
    console.log(ok ? 'OK' : 'FALLA');
  } catch (e) { console.error(e); } finally { srv.close(); process.exit(0); }
});
