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

const { bases, rpc } = doble.instalar(POS);
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

// Bodega (v140): unos productos de verdad del catálogo y los lugares A1..I5, como en producción.
const prod = (id, nombre, codigo_barras, categoria_web, subcategoria_web, stock, extra = {}) =>
  ({ id, nombre, sku: null, codigo_barras, categoria_web, subcategoria_web, stock, stock_ilimitado: false, imagen_urls: [], archivado: false, es_servicio: false,
    es_borrador: false, precio_unitario: 9990, costo_unitario: 4000, pide_equipo: false, requiere_sn: false, va_al_pozo: false, propietario: 'MIO', meses_garantia: 6, ...extra });
bases.pos.productos = [
  prod(177, 'Cable USB-C a USB-C 2 metros Carga Rápida', '7801234567890', 'Cables y Adaptadores', 'Cables USB y de Carga', 24, { precio_unitario: 4990, costo_unitario: 1900 }),
  prod(342, 'Cargador de Pared USB Carga Rápida 33W Power Delivery', '6941234500017', 'Cargadores', null, 0, { precio_unitario: 12990, costo_unitario: 6500 }),
  prod(173, 'Tarjeta de Memoria Kingston 128 GB', null, 'Almacenamiento', 'Tarjetas de Memoria', 9, { precio_unitario: 11990, costo_unitario: 7200 }),
  prod(161, 'Memoria RAM Hiksemi 8 GB DDR4', null, 'Componentes PC', 'Memorias RAM', 4, { precio_unitario: 19990, costo_unitario: 13500 }),
  prod(305, 'Chequeo de Salud de Disco Duro o SSD (por unidad)', null, 'Servicios Técnicos', 'Formateo y Respaldo de Datos', 0, { es_servicio: true, stock_ilimitado: true, precio_unitario: 10000, costo_unitario: 0 }),
  // v177: la caja del celular — un servicio "por equipo" (sql/111) y uno que hace C. Patricio (va al pozo)
  prod(275, 'Cambio de Pantalla para Celulares (Todas las Marcas)', null, 'Servicios Técnicos', 'Celulares', 0, { es_servicio: true, stock_ilimitado: true, precio_unitario: 25000, costo_unitario: 0, pide_equipo: true }),
  prod(274, 'Cambio de Puerto de Carga USB-C / Micro USB', null, 'Servicios Técnicos', 'Celulares', 0, { es_servicio: true, stock_ilimitado: true, precio_unitario: 18000, costo_unitario: 0, pide_equipo: true, va_al_pozo: true }),
  prod(900, 'Producto archivado de prueba', '1111111111111', 'Audio', null, 1, { archivado: true })
];
// v177: lo que el registro de venta (POST /api/ventas) le pide a la base. En producción son funciones de Postgres.
rpc.costos_referencia_productos = (_a, base) => ({ data: base.productos.map(p => ({ producto_id: p.id, costo_referencia: Number(p.costo_unitario) || 0 })), error: null });
rpc.descontar_stock_venta = rpc.descontar_stock_venta_idem = (args, base) => {
  const hechos = [];
  for (const it of args.p_items || []) {
    const p = base.productos.find(x => x.id === Number(it.producto_id));
    if (!p || p.stock_ilimitado || p.usa_lotes) continue;
    if (p.stock < it.cantidad) return { data: null, error: { message: `Sin stock suficiente de ${p.nombre}` } };
    p.stock -= it.cantidad;
    hechos.push({ producto_id: p.id });
  }
  return { data: hechos, error: null };
};
rpc.limpiar_descuentos_huerfanos = () => ({ data: null, error: null });
bases.pos.ubicaciones = 'ABCDEFGHI'.split('').flatMap((letra, i) => [1, 2, 3, 4, 5].map(n =>
  ({ id: i * 5 + n, nombre: letra + n, tipo: 'estante', descripcion: null, foto_url: null, activo: true, creado_en: new Date().toISOString() })));
bases.pos.producto_ubicaciones = [];

// Cotizador (v157): los precios estimados reales, del mismo CSV que se cargó en producción.
bases.pos.reparaciones_precios = fs.readFileSync(path.join(POS, 'docs', 'estudios-precios', '2026-10-16-servicios-celulares-multiphone.csv'), 'utf8')
  .trim().split(/\r?\n/).slice(1).map((linea, i) => {
    const c = linea.split(',');
    return { id: i + 1, marca: c[0], equipo: c[1], trabajo: c[2], calidad: c[3], costo_repuesto: Number(c[4]), mano_obra: Number(c[5]), precio: Number(c[6]),
      proveedor: 'Multiphone', lista_fecha: '2026-09-21', activo: true };
  });

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
