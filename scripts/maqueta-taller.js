// Maqueta de la app del taller (v135): el SERVIDOR REAL (api/index.js) contra una base en memoria.
// No toca Supabase ni producción, no manda correos y no usa ninguna llave real.
// Uso: node scripts/maqueta-taller.js  →  http://localhost:4181/taller/
// Usuarios de prueba (PIN 1234 para todos):
//   11.111.111-1  C. Alejandro Silva  (admin, dueño de Sevelin)
//   22.222.222-2  C. Patricio Silva   (trabajador, el del pozo)
//   33.333.333-3  Alejandro Silva     (admin)
//   44.444.444-4  Alejandra Jiron     (trabajador)
//   55.555.555-5  Benjamin Rojas      (trabajador)
const fs = require('fs');
const path = require('path');
const express = require('express');
const POS = path.join(__dirname, '..');
const doble = require('./doble-supabase.js');

const { bases } = doble.instalar(POS);
Object.assign(process.env, {
  NODE_ENV: 'development', JWT_SECRET: 'secreto-de-la-maqueta', ADMIN_PIN: 'maqueta-admin', WORKER_PIN: 'maqueta-trabajador',
  SYNC_SECRET: 'maqueta', CORS_ORIGINS: '*'
});

// Las listas de la app salen de la misma migración que se aplica en producción.
const sql = fs.readFileSync(path.join(POS, 'sql', '92-usuarios-y-taller.sql'), 'utf8');
bases.pos.taller_catalogo = [...sql.matchAll(/\('(REPUESTO|CALIDAD_PANTALLA|LUGAR)',\s*(null|'[A-Z]+'),\s*'([^']+)',\s*(\d+)\)/g)]
  .map((m, i) => ({ id: i + 1, tipo: m[1], equipo: m[2] === 'null' ? null : m[2].replace(/'/g, ''), nombre: m[3], orden: Number(m[4]), activo: true }));
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
bases.pos.acuerdo_padres = [{ id: 1, tope_mercaderia: 3000000, cuota_semanal: 1000000, pozo_minimo_mensual: 1000000, pozo_desde: hoy }];

const api = require(path.join(POS, 'api', 'index.js'));
const jwt = require('jsonwebtoken');
const vercel = JSON.parse(fs.readFileSync(path.join(POS, 'vercel.json'), 'utf8'));
const cabeceras = vercel.headers[0].headers;   // las mismas que pone Vercel: si la página rompe la política de seguridad, se ve aquí

const app = express();
app.use(express.static(POS, {
  etag: false, lastModified: false,
  setHeaders: (res) => { res.setHeader('Cache-Control', 'no-store'); cabeceras.forEach(c => res.setHeader(c.key, c.value)); }
}));
app.use(api);

const puerto = Number(process.env.PORT) || 4181;
app.listen(puerto, async () => {
  const base = `http://127.0.0.1:${puerto}/api`;
  const pedir = async (ruta, cuerpo, token) => {
    const r = await fetch(base + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(cuerpo) });
    const json = await r.json();
    if (!r.ok) throw new Error(`${ruta}: ${json.error}`);
    return json;
  };
  const admin = jwt.sign({ rol: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const crear = (nombre, rut, rol, papel_taller) => pedir('/usuarios', { nombre, rut, rol, pin: '1234', papel_taller }, admin);
  const ale = await crear('C. Alejandro Silva', '11.111.111-1', 'admin', 'DUENO');
  const pat = await crear('C. Patricio Silva', '22.222.222-2', 'trabajador', 'PAPA');
  await crear('Alejandro Silva', '33.333.333-3', 'admin');
  const mama = await crear('Alejandra Jiron', '44.444.444-4', 'trabajador');
  await crear('Benjamin Rojas', '55.555.555-5', 'trabajador');

  // Dos trabajos de ejemplo, para que las listas no partan vacías
  const como = (u) => jwt.sign({ rol: u.rol, uid: u.id, nombre: u.nombre }, process.env.JWT_SECRET, { expiresIn: '1h' });
  await pedir('/taller/trabajos', {
    equipo_tipo: 'CELULAR', equipo_modelo: 'Samsung A07', es_del_papa: true,
    repuestos: [{ nombre: 'Pantalla', calidad: 'Incell', origen: 'COMPRA', costo: 8000, lugar: 'Casa Royal', pagado_por: ale.id }],
    viaje_monto: 3000, viaje_pagado_por: ale.id, desarmo_id: pat.id, instalo_id: pat.id, probo_id: ale.id,
    cobro: { monto: 25000, medio: 'EFECTIVO', donde: 'APP', recibio: pat.id }
  }, como(pat));
  await pedir('/taller/trabajos', {
    equipo_tipo: 'COMPUTADOR', equipo_modelo: 'HP 240 G8', es_del_papa: false, cliente: 'Sra. Marta',
    repuestos: [{ nombre: 'Teclado', origen: 'COMPRA', costo: 12000, lugar: 'PC Factory', pagado_por: pat.id }],
    viaje_monto: 2000, viaje_pagado_por: pat.id, instalo_id: mama.id, precio_acordado: 35000
  }, como(mama));
  console.log(`Maqueta del taller en http://localhost:${puerto}/taller/  (RUT 11.111.111-1 o 22.222.222-2, PIN 1234)`);
});
