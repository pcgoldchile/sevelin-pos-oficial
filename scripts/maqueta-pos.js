// Maqueta local del POS: sirve el frontend real y simula la API con datos de ejemplo.
// No habla con Supabase ni con producción: sirve para revisar el diseño en el navegador.
// Uso: node scripts/maqueta-pos.js  →  http://localhost:4180 (cualquier PIN entra como admin; "trabajador" entra como trabajador).
const path = require('path');
const express = require('express');
const POS = path.join(__dirname, '..');

const IMG = (id, ...f) => f.map(x => `https://wlqzxvcyynvblhyllzmh.supabase.co/storage/v1/object/public/productos-imagenes/${id}/${x}.webp`);
const productos = [
  { id: 294, nombre: 'HP ProDesk 600 G1 SFF – Intel Core i5-4590 + 8GB RAM + 256GB SSD', sku: null, codigo_barras: null, precio_unitario: 120000, costo_unitario: 75400, stock: 0, imagen_urls: IMG(294, '9f66a614-264b-4aa7-ac70-3c09ae156efc', 'c4e3250a-58e6-4158-8212-2b99ce4ba543', 'f3bb075c-ffd1-40b8-9079-6017c0b8bdf8'), requiere_sn: false, categoria_web: 'Computadores' },
  { id: 104, nombre: 'Adaptador HDMI a VGA', sku: 'adaptador-hdmi-a-vga-43wbg', codigo_barras: '7800000000104', precio_unitario: 4000, costo_unitario: 2201, stock: 12, imagen_urls: IMG(104, 'b3b1393a-d14c-44e1-b8ca-076bae50ac70'), requiere_sn: false, categoria_web: 'Cables y Adaptadores' },
  { id: 291, nombre: 'Adaptador USB WiFi 6 + Bluetooth 5.4 AX900', sku: null, codigo_barras: null, precio_unitario: 8000, costo_unitario: 2554, stock: 3, imagen_urls: IMG(291, 'a21656cb-61c5-4649-bd16-ae2ae9f3ea9c', '0e6ac447-4950-47bc-9ec8-74646e7fea45'), requiere_sn: false, categoria_web: 'Cables y Adaptadores' },
  { id: 126, nombre: 'Combo Teclado y Mouse RGB AB-D335', sku: 'combo-teclado-y-mouse-rgb-pel2q', codigo_barras: '5602019704242', precio_unitario: 8000, costo_unitario: 5000, stock: 13, imagen_urls: IMG(126, 'dc4778f5-4512-4583-8146-940561163966', '31f2332d-10dc-4432-bba6-dcedcf43e529'), requiere_sn: false, categoria_web: 'Periféricos' },
  { id: 98, nombre: 'Cable Adaptador HDMI Macho a VGA Macho', sku: 'cable-hdmi-macho-a-vga-macho-vx52a', codigo_barras: null, precio_unitario: 5000, costo_unitario: 3392, stock: 1, imagen_urls: IMG(98, '12c01f42-822a-46b2-83ae-32f52793e712'), requiere_sn: false, categoria_web: 'Cables y Adaptadores' },
  { id: 144, nombre: 'Fuente de Poder 650W (Certificada) 80+ Bronce - MSI MAG A650BN - ATX', sku: 'fuente-de-poder-650w-msi-mag-a650bn', codigo_barras: '4719072849627', precio_unitario: 55000, costo_unitario: 44752, stock: 2, imagen_urls: IMG(144, '5451c876-0b23-40d2-9209-70091a9967db', 'bf45eb46-2774-47f6-b5cf-a30aee9a8cac'), requiere_sn: true, categoria_web: 'Componentes PC' },
  { id: 160, nombre: 'Placa Madre MSI A520M-A PRO AM4', sku: 'msi-a520m-pro', codigo_barras: '4719072749927', precio_unitario: 80000, costo_unitario: 58990, stock: 2, imagen_urls: IMG(160, 'f8427a19-8c61-40a2-9c8f-c16e11b16e93', '185e6a1e-f060-456e-9246-75e045bec9de'), requiere_sn: true, categoria_web: 'Componentes PC' },
  { id: 157, nombre: 'Monitor Gamer MSI MAG 255F E20 24.5" Full HD Rapid IPS 200Hz 0.5ms', sku: 'monitor-gamer-msi-mag-255f', codigo_barras: '4711377285278', precio_unitario: 120000, costo_unitario: 92990, stock: 0, imagen_urls: IMG(157, '78c2f833-2d86-41d4-9ffb-56be495d84b3', 'a323feec-16ab-4633-9c14-1ce8442e1153'), requiere_sn: false, categoria_web: 'Monitores' },
  { id: 100, nombre: 'Balanza Digital Inteligente Bluetooth', sku: 'balanza-digital-inteligente-bluetooth-z8dqs', codigo_barras: null, precio_unitario: 7000, costo_unitario: 4098, stock: 8, imagen_urls: IMG(100, '8fb040f9-d62f-4f7e-a5ce-9700fd781ecb', 'e9f1e3a4-0e18-45a5-a87d-c38a71bb86b0'), requiere_sn: false, categoria_web: 'Hogar y Estilo de Vida' },
  { id: 900, nombre: 'Formateo e instalación de Windows', sku: 'servicio-formateo', codigo_barras: null, precio_unitario: 25000, costo_unitario: 0, stock: 0, stock_ilimitado: true, imagen_urls: [], requiere_sn: false, es_servicio: true, categoria_web: 'Servicios Técnicos' },
].map(p => ({ archivado: false, stock_ilimitado: false, es_servicio: false, publicado_web: true, created_at: '2026-09-01T12:00:00Z', ...p }));

const app = express();
app.use(express.json());
const sinManejar = new Set();

app.post('/api/login', (req, res) => {
  const rol = String(req.body?.pin || '') === 'trabajador' ? 'trabajador' : 'admin';
  res.json({ token: 'token-maqueta', rol, negocio: 'Sevelin', expiraEn: '12h' });
});
app.get('/api/me', (_req, res) => res.json({ rol: 'admin', negocio: 'Sevelin' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, db: true }));
app.get('/api/productos', (_req, res) => res.json(productos));
app.get('/api/productos/buscar', (req, res) => {
  const codigo = String(req.query.codigo || '');
  const p = productos.find(x => x.codigo_barras === codigo || x.sku === codigo);
  return p ? res.json(p) : res.status(404).json({ error: 'No encontrado' });
});
app.get('/api/caja/activa', (_req, res) => res.json({
  activa: { id: 10, estado: 'abierta', fondo_inicial: 10000, fecha_apertura: '2026-09-13T17:26:00Z' }, movimientos: [],
}));
app.use('/api', (req, res) => {
  const clave = `${req.method} ${req.path}`;
  if (!sinManejar.has(clave)) { sinManejar.add(clave); console.log('[maqueta] sin datos:', clave); }
  res.json(req.method === 'GET' ? [] : { ok: true });
});
app.use(express.static(POS, { etag: false, lastModified: false, setHeaders: (r) => r.setHeader('Cache-Control', 'no-store') }));

const puerto = Number(process.env.PORT) || 4180;
app.listen(puerto, () => console.log(`Maqueta POS en http://localhost:${puerto}`));
