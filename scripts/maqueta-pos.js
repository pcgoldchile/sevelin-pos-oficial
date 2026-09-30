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
// Una OT pendiente para probar el Check-Out (v96: tercera verificación con clave de admin).
// La entrega simula al servidor: el PIN "mal" se rechaza; cualquier otro entra.
const ordenes = [
  { id: 7, numero_ot: 'OT-000007', estado: 'PENDIENTE', fecha_ingreso: '2026-09-25T15:00:00Z', cliente_nombre: 'Cliente de Prueba',
    cliente_rut: null, cliente_telefono: '+56900000000', dispositivo_categoria: 'Notebook', dispositivo_modelo: 'Lenovo IdeaPad 3',
    falla_reportada: 'No enciende', token_retiro: 'a'.repeat(32), acepta_responsabilidad: true },
];
app.get('/api/ot', (_req, res) => res.json(ordenes));
// Una fase obligatoria sin tachar, para ver el aviso y el motivo de "entregar igual" (sql/66).
app.get('/api/ot/:id/fases', (_req, res) => res.json({
  fases: [{ id: 1, nombre: 'Prueba de estrés final', obligatoria: true, completada_en: null, orden: 1 }],
  total: 1, completadas: 0, obligatorias_pendientes: 1,
}));
app.post('/api/ot/:id/entrega', (req, res) => {
  const ot = ordenes.find(o => String(o.id) === req.params.id);
  const b = req.body || {};
  if (b.verificacion === 'ADMIN') {
    if (String(b.verificacion_motivo || '').trim().length < 10) return res.status(400).json({ error: 'Escribe el motivo (mínimo 10 letras)' });
    if (b.pin_admin === 'mal') return res.status(403).json({ error: 'PIN de administrador incorrecto' });
  }
  if (!String(b.entrega_forzada_motivo || '').trim()) return res.status(400).json({ error: 'Faltan fases obligatorias: escribe por qué' });
  Object.assign(ot, { estado: 'ENTREGADO', entrega_forzada_motivo: b.entrega_forzada_motivo, fecha_entrega: new Date().toISOString(), retira_nombre: b.retira_nombre, retira_rut: b.retira_rut,
    retiro_verificacion: b.verificacion, retiro_verificacion_motivo: b.verificacion === 'ADMIN' ? b.verificacion_motivo.trim() : null,
    meses_garantia: 6, sellos: (b.sellos || []).map(sn => ({ id: sigSello++, numero_serie: sn })) });
  res.json(ot);
});
// Sellos de garantía (sql/69, v97): el S/N "USADO" simula uno que ya está en otra orden.
let sigSello = 1;
app.post('/api/ot/:id/sellos', (req, res) => {
  const ot = ordenes.find(o => String(o.id) === req.params.id);
  const sn = String(req.body?.numero_serie || '').replace(/\s+/g, '').toUpperCase();
  if (sn === 'USADO') return res.status(409).json({ error: 'El sello USADO ya está en OT-000003' });
  const sello = { id: sigSello++, numero_serie: sn };
  ot.sellos = [...(ot.sellos || []), sello];
  res.status(201).json(sello);
});
app.delete('/api/ot/:id/sellos/:selloId', (req, res) => {
  const ot = ordenes.find(o => String(o.id) === req.params.id);
  ot.sellos = (ot.sellos || []).filter(s => String(s.id) !== req.params.selloId);
  res.json({ ok: true });
});
app.get('/api/garantias/servicios', (_req, res) => res.json(ordenes.filter(o => o.estado === 'ENTREGADO').map(o => ({
  ...o, sellos: (o.sellos || []).map(s => s.numero_serie), vence_el: '2027-03-28', estado_garantia: 'VIGENTE',
}))));

// v99: avisos del encabezado. Facturas por aceptar en el SII (inventadas, no las reales) y
// gastos fijos del mes: uno vencido, uno por vencer y uno pagado (este último no debe salir).
app.get('/api/finanzas/sii/por-aceptar', (_req, res) => res.json({
  cantidad: 2, iva: 45600,
  documentos: [
    { periodo: '202609', tipo_doc: 33, rut: '76.000.001-1', razon_social: 'Proveedor de Ejemplo SpA', folio: 1234, fecha_doc: '2026-09-22', total: 190000, iva: 30336 },
    { periodo: '202609', tipo_doc: 33, rut: '76.000.002-2', razon_social: 'Distribuidora Demo Ltda', folio: 88, fecha_doc: '2026-09-25', total: 95600, iva: 15264 },
  ],
  ultimaSync: new Date().toISOString(),
}));
app.get('/api/finanzas/gastos-fijos-mes', (_req, res) => {
  const dia = new Date().getDate();
  res.json({
    items: [
      { id: 1, nombre: 'Arriendo (ejemplo)', monto: 300000, dia_mes: Math.max(1, dia - 2), clasificacion: 'Arriendo', pagado: false },
      { id: 2, nombre: 'Internet (ejemplo)', monto: 25000, dia_mes: Math.min(31, dia + 2), clasificacion: 'Servicios', pagado: false },
      { id: 3, nombre: 'Luz (ejemplo)', monto: 40000, dia_mes: 1, clasificacion: 'Servicios', pagado: true },
    ],
    totalMes: 365000, totalPagado: 40000, totalPendiente: 325000,
  });
});

// v101: pendientes (sql/72), en memoria. Uno vencido, uno urgente, uno de Claude, uno postergado a
// futuro (no debe contar en el chip), uno postergado cuya fecha ya llegó (sí cuenta) y uno hecho.
const hoyMaqueta = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());
const masDias = (n) => { const d = new Date(hoyMaqueta() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const basePend = { detalle: null, responsable: 'dueno', estado: 'pendiente', prioridad: 'normal', fecha_limite: null, revisar_el: null,
  veces_postergado: 0, categoria: null, creado_por: 'claude', hecho_por: null, nota_cierre: null, creado_en: '2026-09-30T12:00:00Z', cerrado_en: null };
let pendientes = [
  { id: 1, titulo: 'Apagar la "Coincidencia avanzada automática" del Pixel', detalle: 'Administrador de eventos de Meta → Pixel → Configuración.', categoria: 'Meta', fecha_limite: masDias(-2) },
  { id: 2, titulo: 'Decidir los descuentos del Cyber', prioridad: 'alta', categoria: 'Tienda', fecha_limite: masDias(2) },
  { id: 3, titulo: 'Subir las fotos del POS a 1600 px', responsable: 'claude', categoria: 'POS' },
  { id: 4, titulo: 'Mudanza a San Rafael 896: cambiar la dirección', estado: 'postergado', revisar_el: masDias(10), veces_postergado: 2 },
  { id: 5, titulo: 'Confirmar en Resend que sevelin.cl diga "Verified"', estado: 'postergado', revisar_el: hoyMaqueta(), veces_postergado: 1 },
  { id: 6, titulo: 'Privacidad 1.5: cookies en palabras simples', estado: 'hecho', hecho_por: 'claude', nota_cierre: 'Publicado y verificado en sevelin.cl/privacidad.', cerrado_en: new Date().toISOString() },
].map(p => ({ ...basePend, ...p }));
let sigPend = 7;
app.get('/api/pendientes', (_req, res) => res.json({
  hoy: hoyMaqueta(),
  abiertos: pendientes.filter(p => ['pendiente', 'postergado'].includes(p.estado)),
  cerrados: pendientes.filter(p => ['hecho', 'descartado'].includes(p.estado)),
}));
app.post('/api/pendientes', (req, res) => {
  const p = { ...basePend, ...req.body, id: sigPend++, creado_por: 'dueno', creado_en: new Date().toISOString() };
  pendientes.push(p);
  res.status(201).json(p);
});
app.patch('/api/pendientes/:id', (req, res) => {
  const p = pendientes.find(x => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Ese pendiente no existe' });
  const a = req.body.accion, ahora = new Date().toISOString();
  if (a === 'hecho') Object.assign(p, { estado: 'hecho', hecho_por: 'dueno', cerrado_en: ahora });
  else if (a === 'descartar') Object.assign(p, { estado: 'descartado', cerrado_en: ahora });
  else if (a === 'reabrir') Object.assign(p, { estado: 'pendiente', hecho_por: null, cerrado_en: null, revisar_el: null, nota_cierre: null });
  else if (a === 'postergar') {
    if (!req.body.revisar_el || req.body.revisar_el <= hoyMaqueta()) return res.status(400).json({ error: 'La fecha para volver a verlo tiene que ser después de hoy' });
    Object.assign(p, { estado: 'postergado', revisar_el: req.body.revisar_el, veces_postergado: p.veces_postergado + 1 });
  }
  res.json(p);
});

// v102: "Complementa tu compra" (sql/75), en memoria. Misma validación que el servidor real.
app.put('/api/productos/:id/relacionados', (req, res) => {
  const id = Number(req.params.id);
  const p = productos.find(x => x.id === id);
  if (!p) return res.status(404).json({ error: 'Ese producto no existe' });
  const ids = [...new Set((req.body.ids || []).map(Number))];
  if (ids.includes(id)) return res.status(400).json({ error: 'Un producto no puede ser complemento de sí mismo' });
  if (ids.length > 12) return res.status(400).json({ error: 'Máximo 12 complementos por producto' });
  if (ids.some(n => !productos.find(x => x.id === n))) return res.status(400).json({ error: 'Alguno de los productos no existe o está archivado' });
  p.relacionados_ids = ids;
  res.json({ id, relacionados_ids: ids });
});

// v102: Productos → Agotados. Los productos de la maqueta con stock 0 (294 y 157), uno con
// clientes esperando y otro sin decidir; la decisión se guarda en memoria.
const decisionesAgotados = new Map();
app.get('/api/agotados/panel', (_req, res) => res.json({
  dias: 90, avisosDisponibles: true,
  productos: productos.filter(p => p.stock <= 0 && !p.stock_ilimitado && !p.es_servicio && !p.archivado).map(p => ({
    id: p.id, nombre: p.nombre, sku: p.sku, imagen_url: p.imagen_urls[0] || null, categoria_web: p.categoria_web,
    publicado_web: p.publicado_web, por_llegar: !!p.por_llegar, fecha_llegada_estimada: p.fecha_llegada_estimada || null,
    stock_por_llegar: p.stock_por_llegar || 0, precio_unitario: p.precio_unitario, costo_unitario: p.costo_unitario,
    agotado_desde: '2026-09-20T12:00:00Z', decision: decisionesAgotados.get(p.id)?.decision || null,
    decidido_en: decisionesAgotados.get(p.id)?.en || null,
    unidades_vendidas: p.id === 157 ? 3 : 0, ultima_venta: p.id === 157 ? '2026-09-18' : null,
    avisos_pendientes: p.id === 157 ? 2 : 0, reservas_pendientes: p.id === 157 ? 1 : 0,
  })),
}));
app.post('/api/productos/:id/agotado', (req, res) => {
  const p = productos.find(x => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
  const d = req.body.decision;
  if (d === 'por_llegar') Object.assign(p, { por_llegar: true, fecha_llegada_estimada: req.body.fecha_llegada_estimada || null, stock_por_llegar: req.body.stock_por_llegar || 0 });
  if (d === 'encargo') p.es_pedido_encargo = true;
  if (d === 'archivar') p.archivado = true;
  decisionesAgotados.set(p.id, { decision: d, en: new Date().toISOString() });
  res.json({ ok: true });
});

// Preguntas de diagnóstico editables (sql/70, v98). Parte con 2 preguntas para notar que viene de la "base".
let textoPreguntas = { encabezado: 'Respóndenos con el número de cada pregunta:', preguntas: ['¿Qué equipo es?', '¿Qué problema tiene?'], cierre: '¡Gracias!' };
app.get('/api/textos/preguntas_diagnostico', (_req, res) => res.json({ contenido: textoPreguntas, actualizado_en: new Date().toISOString() }));
app.put('/api/textos/preguntas_diagnostico', (req, res) => {
  textoPreguntas = req.body.contenido;
  res.json({ contenido: textoPreguntas, actualizado_en: new Date().toISOString() });
});

app.use('/api', (req, res) => {
  const clave = `${req.method} ${req.path}`;
  if (!sinManejar.has(clave)) { sinManejar.add(clave); console.log('[maqueta] sin datos:', clave); }
  res.json(req.method === 'GET' ? [] : { ok: true });
});
app.use(express.static(POS, { etag: false, lastModified: false, setHeaders: (r) => r.setHeader('Cache-Control', 'no-store') }));

const puerto = Number(process.env.PORT) || 4180;
app.listen(puerto, () => console.log(`Maqueta POS en http://localhost:${puerto}`));
