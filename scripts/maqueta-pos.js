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
  { id: 910, nombre: 'Tarjeta de Video RTX 5060 8GB (por encargo)', sku: 'rtx-5060-encargo', codigo_barras: null, precio_unitario: 389990, costo_unitario: 330000, stock: 0, imagen_urls: [], requiere_sn: false, es_pedido_encargo: true, categoria_web: 'Componentes PC' },
].map(p => ({ archivado: false, stock_ilimitado: false, es_servicio: false, publicado_web: true, created_at: '2026-09-01T12:00:00Z', ...p }));

const app = express();
app.use(express.json({ limit: '6mb' }));   // mismo tope que el servidor real (las fotos viajan en base64)
const sinManejar = new Set();

app.post('/api/login', (req, res) => {
  const rol = String(req.body?.pin || '') === 'trabajador' ? 'trabajador' : 'admin';
  app.locals.rolMaqueta = rol;
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

// Botones de IA del editor de producto: respuestas fijas, sin llamar a Gemini. El corte del
// título es el mismo del servidor real (separarTituloDeFicha); el SEO tarda 1,5 s a propósito,
// para probar qué pasa si se cierra el editor antes de que llegue.
const FICHA_IA_MAQUETA = [
  'Memoria RAM ADATA Premier 8GB DDR4 3200 SO-DIMM',
  '',
  '✨ Memoria RAM ADATA Premier 8GB DDR4 3200 SO-DIMM es un módulo de memoria para portátiles compatibles, pensado para quien quiere mejorar la multitarea de su equipo.',
  '',
  '### ✨ Características principales',
  '',
  '✅ Capacidad de 8 GB en un solo módulo SO-DIMM',
  '✅ Velocidad de 3200 MT/s',
  '✅ Tipo de memoria DDR4',
].join('\n');
function separarTituloMaqueta(texto) {
  const limpio = String(texto || '').trim();
  const lineas = limpio.split('\n');
  const primera = (lineas[0] || '').trim();
  const pareceTitulo = primera && !/^[✨#>\-*✅⚠️]/u.test(primera) && primera.length <= 150;
  return { titulo: pareceTitulo ? primera : '', cuerpo: pareceTitulo ? lineas.slice(1).join('\n').trim() : limpio };
}
app.post('/api/productos/generar-texto', (req, res) => {
  if (!String(req.body?.datos || '').trim() && !String(req.body?.descripcion_html || '').trim()) {
    return res.status(400).json({ error: 'Falta la información real del producto.' });
  }
  if (req.body.destino === 'facebook') return res.json({ destino: 'facebook', texto: '✨ NUEVA memoria de prueba (maqueta)', modelo: 'maqueta' });
  res.json({ destino: 'ficha', ...separarTituloMaqueta(FICHA_IA_MAQUETA), modelo: 'maqueta', nombre_recibido: req.body.nombre || '' });
});
app.post('/api/productos/prompt-texto', (req, res) => res.json({ destino: req.body.destino, prompt: `PROMPT DE MAQUETA\nNombre actual: ${req.body.nombre || '(sin nombre)'}` }));
app.post('/api/productos/separar-ficha', (req, res) => res.json(separarTituloMaqueta(req.body?.texto)));
app.post('/api/productos/generar-seo', (req, res) => setTimeout(() => res.json({
  meta_titulo: `${String(req.body?.nombre || '').slice(0, 45)} | SEO maqueta`,
  meta_descripcion: 'Descripción SEO de prueba generada por la maqueta, a partir de la ficha del producto.',
  modelo: 'maqueta',
}), 1500));

// Subir una foto de producto. Mismo tope de 1 MB que el servidor real; la foto queda en
// memoria como data URL (no hay bucket) para poder ver el tamaño con que salió del lienzo.
app.post('/api/productos/:id/imagen', (req, res) => {
  const p = productos.find(x => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
  const base64 = String(req.body?.imagen_base64 || '');
  if (!base64) return res.status(400).json({ error: 'Falta la imagen' });
  const bytes = Buffer.from(base64.includes(',') ? base64.split(',')[1] : base64, 'base64').length;
  if (bytes > 1024 * 1024) return res.status(413).json({ error: 'La imagen supera 1 MB. El navegador debería haberla comprimido antes de subirla.' });
  p.imagen_urls = [...p.imagen_urls, base64];
  res.status(201).json({ id: p.id, imagen_urls: p.imagen_urls });
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

// v102: Activos de uso interno (sql/64) con edición. Uno en uso sin respaldo y uno cerrado.
const activos = [
  { id: 1, producto_id: 144, nombre: 'Fuente de Poder 650W (Certificada) 80+ Bronce - MSI MAG A650BN - ATX', sku: 'fuente-de-poder-650w-msi-mag-a650bn',
    cantidad: 1, costo_unitario: 44752, motivo: 'Pruebas del taller.', estado: 'EN_USO', documento_numero: null, documento_ruta: null },
  { id: 2, producto_id: 104, nombre: 'Adaptador HDMI a VGA', sku: 'adaptador-hdmi-a-vga-43wbg', cantidad: 1, costo_unitario: 2201,
    motivo: 'Banco de pruebas', estado: 'DEVUELTO_A_VENTA', documento_numero: '8812', documento_ruta: null, cierre_nota: 'Se devolvió' },
];
app.get('/api/activos', (_req, res) => {
  const enUso = activos.filter(a => a.estado === 'EN_USO');
  res.json({ activos, resumen: { en_uso: enUso.length, unidades_en_uso: enUso.reduce((s, a) => s + a.cantidad, 0),
    valor_en_uso: enUso.reduce((s, a) => s + a.costo_unitario * a.cantidad, 0) } });
});
app.patch('/api/activos/:id', (req, res) => {
  const a = activos.find(x => x.id === Number(req.params.id));
  if (!a) return res.status(404).json({ error: 'No se encontró ese activo' });
  if (req.body.motivo !== undefined && !String(req.body.motivo).trim()) return res.status(400).json({ error: 'El motivo no puede quedar vacío' });
  ['motivo', 'documento_numero', 'documento_ruta'].forEach(k => { if (req.body[k] !== undefined) a[k] = String(req.body[k] || '').trim() || null; });
  res.json(a);
});

// Preguntas de diagnóstico editables (sql/70, v98). Parte con 2 preguntas para notar que viene de la "base".
let textoPreguntas = { encabezado: 'Respóndenos con el número de cada pregunta:', preguntas: ['¿Qué equipo es?', '¿Qué problema tiene?'], cierre: '¡Gracias!' };
app.get('/api/textos/preguntas_diagnostico', (_req, res) => res.json({ contenido: textoPreguntas, actualizado_en: new Date().toISOString() }));
app.put('/api/textos/preguntas_diagnostico', (req, res) => {
  textoPreguntas = req.body.contenido;
  res.json({ contenido: textoPreguntas, actualizado_en: new Date().toISOString() });
});

// v103: venta mayorista (sql/76 + supabase/39). Dos productos con precio mayorista, uno
// desactivado solo por la base (subió el costo), y cuentas en los cuatro estados.
// El 104 lleva además el segundo escalón (sql/81, v111): $3.200 desde 10 u.
Object.assign(productos.find(p => p.id === 104), { precio_mayorista: 3500, mayorista_desde: 5, precio_mayorista_2: 3200, mayorista_desde_2: 10 });
Object.assign(productos.find(p => p.id === 126), { precio_mayorista: 7000, mayorista_desde: 3 });
Object.assign(productos.find(p => p.id === 100), { mayorista_aviso: 'Se desactivó el mayorista de $5.200 (5 u.): Con el costo de $4.228, el mayorista mínimo es $5.285 (piso de 20% de margen)', mayorista_aviso_en: '2026-09-30T18:00:00Z' });
const PISO_MAQUETA = 0.2;
const costoRefMaqueta = p => (p.id === 100 ? 4228 : Number(p.costo_unitario) || 0);
const minimoMaqueta = p => Math.ceil(costoRefMaqueta(p) / (1 - PISO_MAQUETA));
let pedidoMinimoMaqueta = 100000;
const cuentasMayoristas = [
  { user_id: '11111111-1111-4111-8111-111111111111', estado: 'PENDIENTE', nombre: 'Juan Pérez Técnico', rut: '12345678-5', telefono: '+56912345678',
    email: 'juan@example.com', ciudad: 'Arica', actividad: 'Reparo computadores en mi casa y compro cables, pendrives y pasta térmica.', declara_reventa: true,
    solicitado_en: '2026-10-01T13:10:00Z' },
  { user_id: '22222222-2222-4222-8222-222222222222', estado: 'PENDIENTE', nombre: 'Comercial Los Andes SpA', rut: '76543210-3', telefono: '+56987654321',
    email: 'compras@example.com', ciudad: 'Putre', actividad: 'Minimarket, queremos vender power banks y cargadores.', declara_reventa: true,
    solicitado_en: '2026-10-01T15:40:00Z' },
  { user_id: '33333333-3333-4333-8333-333333333333', estado: 'APROBADA', nombre: 'María Soto', rut: '15678901-2', telefono: '+56911112222',
    email: 'maria@example.com', ciudad: 'Arica', actividad: 'Cyber y servicio técnico.', declara_reventa: true, solicitado_en: '2026-09-29T12:00:00Z',
    revisado_en: '2026-09-29T16:00:00Z', revisado_por: 'admin', nota_verificacion: 'Hablé por WhatsApp, es clienta del local hace meses.' },
];
app.get('/api/pos/mayoristas', (_req, res) => res.json({
  cuentas: cuentasMayoristas, pedido_minimo: pedidoMinimoMaqueta, pedido_minimo_actualizado_en: null, piso_margen: PISO_MAQUETA,
  productos: productos.filter(p => p.precio_mayorista || p.mayorista_aviso).map(p => ({
    ...p, imagen: p.imagen_urls[0] || null, costo_referencia: costoRefMaqueta(p), precio_minimo: minimoMaqueta(p) })),
}));
app.get('/api/pos/mayoristas/avisos', (_req, res) => res.json({
  por_aprobar: cuentasMayoristas.filter(c => c.estado === 'PENDIENTE').length,
  desactivados: productos.filter(p => p.mayorista_aviso && !p.precio_mayorista).length,
}));
// Informe de ventas a precio mayorista (Fase 2). Con 30 días responde vacío, para ver ese estado.
app.get('/api/pos/mayoristas/informe', (req, res) => {
  const dias = [30, 90, 180, 365].includes(Number(req.query.dias)) ? Number(req.query.dias) : 90;
  const base = { dias, desde: '2026-07-04', hasta: '2026-10-02' };
  if (dias === 30) {
    return res.json({ ...base, desde: '2026-09-02', total: { ventas: 0, unidades: 0, vendido: 0, costo: 0, utilidad: 0, margen: null, rebaja: 0 },
      por_canal: { web: 0, caja: 0 }, productos: [], ventas: [] });
  }
  res.json({
    ...base,
    total: { ventas: 2, unidades: 18, vendido: 141000, costo: 104400, utilidad: 36600, margen: 26, rebaja: 23820 },
    por_canal: { web: 1, caja: 1 },
    productos: [
      { producto_id: 162, nombre: 'Batería Externa Power Bank Master-G 30.000 mAh 22.5W', ventas: 1, unidades: 4, vendido: 104000, costo: 69936, utilidad: 34064, margen: 32.8, precio_promedio: 26000, precio_normal_hoy: 29990, rebaja: 15960 },
      { producto_id: 104, nombre: 'Adaptador HDMI a VGA', ventas: 2, unidades: 10, vendido: 34000, costo: 31264, utilidad: 2736, margen: 8, precio_promedio: 3400, precio_normal_hoy: 3990, rebaja: 5900 },
      { producto_id: null, nombre: 'Cable <b>escrito a mano</b>', ventas: 1, unidades: 4, vendido: 3000, costo: 3200, utilidad: -200, margen: -6.7, precio_promedio: 750, precio_normal_hoy: null, rebaja: 1960 },
    ],
    ventas: [
      { id: 251, fecha: '2026-09-30', numero_orden: 'WEB-000014', cliente: 'María <Taller>', canal: 'web', unidades: 9, vendido: 121000 },
      { id: 248, fecha: '2026-09-21', numero_orden: null, cliente: null, canal: 'caja', unidades: 9, vendido: 20000 },
    ],
  });
});
app.post('/api/pos/mayoristas/:userId/estado', (req, res) => {
  const c = cuentasMayoristas.find(x => x.user_id === req.params.userId);
  if (!c) return res.status(404).json({ error: 'Cuenta no encontrada' });
  const nota = String(req.body.nota || '').trim();
  const estado = req.body.estado;
  if (estado === 'APROBADA' && nota.length < 10) return res.status(400).json({ error: 'Escribe cómo verificaste a este cliente: entre 10 y 300 letras' });
  if (estado !== 'APROBADA' && nota.length < 5) return res.status(400).json({ error: 'Escribe el motivo: entre 5 y 300 letras' });
  Object.assign(c, { estado, revisado_en: new Date().toISOString(), revisado_por: 'admin' },
    estado === 'APROBADA' ? { nota_verificacion: nota, motivo: null } : { motivo: nota });
  res.json({ cuenta: c, correo: estado === 'APROBADA' ? { enviado: true } : null });
});
app.put('/api/pos/mayoristas/ajustes', (req, res) => {
  const v = Number(req.body.pedido_minimo);
  if (!Number.isInteger(v) || v < 0) return res.status(400).json({ error: 'Monto inválido' });
  pedidoMinimoMaqueta = v;
  res.json({ pedido_minimo: v, actualizado_en: new Date().toISOString() });
});
app.get('/api/productos/:id/mayorista-minimo', (req, res) => {
  const p = productos.find(x => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json({ precio_minimo: minimoMaqueta(p), costo_referencia: costoRefMaqueta(p), piso_margen: PISO_MAQUETA });
});
// v105 (sql/78): mayor costo conocido de cada producto, para la columna Margen de Productos.
app.get('/api/productos/costos-referencia', (_req, res) => res.json(Object.fromEntries(productos.map(p => [p.id, costoRefMaqueta(p)]))));

// v104 (sql/77): una venta web con despacho cobrado, como la #245 real, para ver el Detalle de Venta.
const ventaWebMaqueta = {
  id: 245, numero_orden: 245, fecha: '2026-10-01', hora: '14:18', cliente: 'Cliente de Prueba', cliente_telefono: '56900000000',
  metodo_pago: 'Transferencia', metodo_pago_final: 'Transferencia', estado: 'PAGADA', total: 37000, costo_total: 27011, utilidad: 9989,
  tipo_entrega: 'despacho', direccion_envio: 'Codpa 2114 Arica', estado_envio: 'pendiente', origen_pago: 'web',
  pedido_web_numero: 'WEB-000012', envio_cobrado: 4500, descuento_monto: 0, comision_pasarela: 494,
};
const itemsVentaWebMaqueta = [
  { id: 1, venta_id: 245, nombre: 'Hub Adaptador USB Tipo C 8 en 1', cantidad: 1, precio_unitario: 10000, costo_unitario: 3975, subtotal: 10000 },
  { id: 2, venta_id: 245, nombre: 'Cable Adaptador DisplayPort a HDMI 4K', cantidad: 1, precio_unitario: 5000, costo_unitario: 3990, subtotal: 5000 },
  { id: 3, venta_id: 245, nombre: 'Tarjeta de Memoria Kingston Canvas Select Plus 128GB', cantidad: 1, precio_unitario: 22000, costo_unitario: 19046, subtotal: 22000 },
];
let envioVentaWebMaqueta = null;

// v108 (sql/79): ventas en memoria para probar la máquina de tarjetas y el N° de boleta o factura.
// La comisión imita a la del servidor real (TUU: 0,79% + $65; Banco de Chile: débito 0,6% + 0,0015 UF
// y crédito 1,53% + 0,0018 UF, con IVA). La que vale es la de api/index.js.
const conTarjetaMaqueta = (m) => m === 'Tarjeta Débito' || m === 'Tarjeta Crédito';
const comisionMaqueta = (metodo, monto, maquina) => {
  if (!conTarjetaMaqueta(metodo) || !(monto > 0)) return 0;
  if (maquina !== 'BANCHILE') return Math.round(monto * 0.0079 + 65);
  const [tasa, fijoUf] = metodo === 'Tarjeta Crédito' ? [0.0153, 0.0018] : [0.006, 0.0015];
  return Math.round((monto * tasa + fijoUf * 41082) * 1.19);
};
const ventasMaqueta = [
  ventaWebMaqueta,
  { id: 235, numero_orden: 235, fecha: '2026-09-26', hora: '20:47', cliente: null, metodo_pago: 'Tarjeta Débito', metodo_pago_final: 'Tarjeta Débito',
    estado: 'PAGADA', total: 120000, costo_total: 92990, utilidad: 27010, tipo_dte: 'BOLETA', comision_pos: 1013, maquina_tarjeta: null, dte_folio: null,
    tipo_entrega: 'retiro', estado_envio: 'entregado', descuento_monto: 0 },
  { id: 250, numero_orden: 250, fecha: hoyMaqueta(), hora: '11:05', cliente: 'María <b>Pérez</b>', metodo_pago: 'Efectivo', metodo_pago_final: 'Efectivo',
    estado: 'PAGADA', total: 8000, costo_total: 5000, utilidad: 3000, tipo_dte: 'SIN DTE', comision_pos: 0, maquina_tarjeta: null, dte_folio: null,
    tipo_entrega: 'retiro', estado_envio: 'entregado', descuento_monto: 0 },
];
const itemsMaqueta = {
  245: itemsVentaWebMaqueta,
  235: [{ id: 10, venta_id: 235, nombre: 'Monitor Gamer MSI MAG 255F E20 24.5"', cantidad: 1, precio_unitario: 120000, costo_unitario: 92990, subtotal: 120000 }],
  250: [{ id: 11, venta_id: 250, nombre: 'Combo Teclado y Mouse RGB AB-D335', cantidad: 1, precio_unitario: 8000, costo_unitario: 5000, subtotal: 8000 }],
};

app.get('/api/ventas', (_req, res) => res.json([...ventasMaqueta].sort((a, b) => b.id - a.id)));
app.get('/api/ventas/envios-pendientes', (_req, res) => res.json([]));
app.get('/api/ventas/sin-folio', (_req, res) => res.json({
  desde: '2026-10-03',
  ventas: ventasMaqueta.filter(v => v.estado === 'PAGADA' && v.fecha >= '2026-10-03' && !v.dte_folio).sort((a, b) => b.id - a.id),
}));
app.get('/api/ventas/:id', (req, res) => {
  const v = ventasMaqueta.find(x => x.id === Number(req.params.id));
  if (!v) return res.status(404).json({ error: 'Venta no encontrada' });
  res.json({ ...v, items: itemsMaqueta[v.id] || [], envio: v.id === 245 ? envioVentaWebMaqueta : null });
});
app.post('/api/ventas', (req, res) => {
  const b = req.body || {};
  const items = (b.items || []).map((it, i) => ({ id: Date.now() + i, nombre: it.nombre, cantidad: it.cantidad, precio_unitario: it.precio_unitario,
    costo_unitario: it.costo_unitario || 0, subtotal: it.precio_unitario * it.cantidad, serial_number: it.serial_number || null }));
  const total = items.reduce((a, it) => a + it.subtotal, 0);
  const pendiente = b.metodo_pago === 'Por Pagar';
  const partes = !pendiente && Array.isArray(b.pagos) && b.pagos.length >= 2 ? b.pagos : null;
  const maquina = b.maquina_tarjeta === 'BANCHILE' ? 'BANCHILE' : 'TUU';
  const huboTarjeta = !pendiente && (partes ? partes.some(p => conTarjetaMaqueta(p.metodo)) : conTarjetaMaqueta(b.metodo_pago));
  const id = Math.max(...ventasMaqueta.map(v => v.id)) + 1;
  const venta = { id, numero_orden: id, fecha: b.fecha || hoyMaqueta(), hora: b.hora || '12:00', cliente: b.cliente || null,
    metodo_pago: partes ? 'Mixto' : b.metodo_pago, metodo_pago_final: pendiente ? null : (partes ? 'Mixto' : b.metodo_pago), pago_mixto: !!partes,
    estado: pendiente ? 'PENDIENTE' : 'PAGADA', total, costo_total: items.reduce((a, it) => a + it.costo_unitario * it.cantidad, 0), utilidad: 0,
    tipo_dte: ['BOLETA', 'FACTURA'].includes(b.tipo_dte) ? b.tipo_dte : 'SIN DTE', dte_folio: null, maquina_tarjeta: huboTarjeta ? maquina : null,
    comision_pos: pendiente ? 0 : (partes ? partes.reduce((a, p) => a + comisionMaqueta(p.metodo, Number(p.monto), maquina), 0) : comisionMaqueta(b.metodo_pago, total, maquina)),
    tipo_entrega: b.tipo_entrega || 'retiro', estado_envio: 'entregado', descuento_monto: 0 };
  venta.utilidad = total - venta.costo_total;
  ventasMaqueta.push(venta);
  itemsMaqueta[id] = items;
  res.status(201).json({ ...venta, items });
});
app.post('/api/ventas/:id/pago', (req, res) => {
  const v = ventasMaqueta.find(x => x.id === Number(req.params.id));
  if (!v) return res.status(404).json({ error: 'Venta no encontrada' });
  const metodo = req.body.metodo_pago_final;
  const maquina = req.body.maquina_tarjeta === 'BANCHILE' ? 'BANCHILE' : 'TUU';
  Object.assign(v, { estado: 'PAGADA', metodo_pago_final: metodo, maquina_tarjeta: conTarjetaMaqueta(metodo) ? maquina : null, comision_pos: comisionMaqueta(metodo, v.total, maquina) });
  res.json(v);
});
app.post('/api/ventas/:id/folio', (req, res) => {
  const v = ventasMaqueta.find(x => x.id === Number(req.params.id));
  if (!v) return res.status(404).json({ error: 'Venta no encontrada' });
  const folio = String(req.body.dte_folio ?? '').trim().slice(0, 30) || null;
  if (app.locals.rolMaqueta === 'trabajador') {   // el último que entró: imita lo que el servidor le deja hacer a cada rol
    if (!folio) return res.status(400).json({ error: 'Escribe el N° del documento' });
    if (v.dte_folio) return res.status(403).json({ error: 'Esa venta ya tiene N° de documento: lo corrige el administrador' });
    if (v.fecha !== hoyMaqueta()) return res.status(403).json({ error: 'El N° de una venta de otro día lo anota el administrador' });
  }
  const tipo = ['BOLETA', 'FACTURA'].includes(req.body.tipo_dte) ? req.body.tipo_dte : v.tipo_dte;
  if (folio && tipo === 'SIN DTE') return res.status(400).json({ error: 'Indica si el N° es de una boleta o de una factura' });
  const otra = folio && !req.body.repetido && ventasMaqueta.find(x => x.id !== v.id && x.dte_folio === folio && x.tipo_dte === tipo);
  if (otra) return res.status(409).json({ error: `Ese N° ya está anotado en la orden #${String(otra.numero_orden).padStart(5, '0')}. Revisa si lo escribiste bien.`, codigo: 'folio_repetido' });
  Object.assign(v, { dte_folio: folio, tipo_dte: tipo });
  res.json(v);
});
app.post('/api/ventas/:id/maquina', (req, res) => {
  const v = ventasMaqueta.find(x => x.id === Number(req.params.id));
  if (!v) return res.status(404).json({ error: 'Venta no encontrada' });
  if (!['TUU', 'BANCHILE'].includes(req.body.maquina_tarjeta)) return res.status(400).json({ error: 'Indica la máquina: TUU o Banco de Chile' });
  if (!conTarjetaMaqueta(v.metodo_pago_final)) return res.status(409).json({ error: 'Esta venta no se pagó con tarjeta' });
  Object.assign(v, { maquina_tarjeta: req.body.maquina_tarjeta, comision_pos: comisionMaqueta(v.metodo_pago_final, v.total, req.body.maquina_tarjeta) });
  res.json(v);
});
app.put('/api/ventas/:id/despacho', (req, res) => {
  const e = req.body.envio || {};
  envioVentaWebMaqueta = { repartidor: e.repartidor || 'indrive', costo: Number(e.costo) || 0, cobrado_cliente: e.cobrado_cliente ?? null, km: e.km || null, sector: e.sector || null, duracion_min: e.duracion_min || null, metodo_pago: 'Efectivo' };
  res.json({ ok: true });
});

// v110 (sql/80): encargos en memoria, con el proceso con el proveedor. Imita al servidor real:
// el trabajador no recibe costos, solo el admin vuelve atrás o cancela, y lo que vale es api/index.js.
const encargosMaqueta = [
  { id: 1, cliente_nombre: 'Juan <b>Prueba</b>', cliente_telefono: '+56 9 1234 5678', descripcion: 'PC Gamer a pedido', monto_total: 450000, monto_abonado: 150000, saldo: 300000,
    estado: 'PARCIAL', producto_id: null, cantidad: 1, costo_total: 380000, etapa: 'COTIZANDO', etapa_cambiada_en: '2026-09-20T15:00:00Z', origen: null, unidades_pedir: 1,
    proveedor: null, costo_cotizado_unitario: null, fecha_estimada: null, cliente_avisado_en: null, entregado_en: null },
  { id: 2, cliente_nombre: 'Taller Norte', cliente_telefono: null, descripcion: 'Formateo con seña', monto_total: 25000, monto_abonado: 10000, saldo: 15000,
    estado: 'PARCIAL', producto_id: null, cantidad: 1, costo_total: 0, etapa: null, entregado_en: null },
];
const abonosMaqueta = [];
const encargoParaRol = (e) => { if (app.locals.rolMaqueta !== 'trabajador') return e; const { costo_total, costo_cotizado_unitario, ...v } = e; return v; };
const pedidoMaqueta = (b) => {
  const p = productos.find(x => x.id === Number(b.producto_id));
  const cantidad = Math.max(1, Number(b.cantidad) || 1);
  let sugerido = { origen: null, pedir: 0 };
  if (p && p.es_pedido_encargo) sugerido = { origen: 'ENCARGO', pedir: cantidad };
  else if (p && !p.stock_ilimitado && !p.es_servicio) {
    if (Number(p.stock) <= 0) sugerido = { origen: 'AGOTADO', pedir: cantidad };
    else if (Number(p.stock) < cantidad) sugerido = { origen: 'LOTE', pedir: cantidad - Number(p.stock) };
  }
  const requiere = b.requiere_pedido === undefined ? sugerido.pedir > 0 : !!b.requiere_pedido;
  return requiere ? { etapa: 'COTIZANDO', etapa_cambiada_en: new Date().toISOString(), origen: sugerido.origen, unidades_pedir: Number(b.unidades_pedir) || sugerido.pedir || cantidad }
    : { etapa: null, origen: null, unidades_pedir: null };
};
app.get('/api/encargos', (req, res) => res.json(encargosMaqueta.filter(e => !req.query.estado || e.estado === req.query.estado).sort((a, b) => b.id - a.id).map(encargoParaRol)));
app.get('/api/encargos/resumen', (_req, res) => {
  const enCurso = encargosMaqueta.filter(e => ['COTIZANDO', 'CONFIRMADO', 'PEDIDO', 'LLEGO'].includes(e.etapa));
  const porAvisar = enCurso.filter(e => e.etapa === 'LLEGO' && !e.cliente_avisado_en).length;
  const atrasados = enCurso.filter(e => e.etapa === 'COTIZANDO' && Date.parse(e.etapa_cambiada_en) < Date.now() - 2 * 86400000).length;
  const tarde = enCurso.filter(e => e.etapa === 'PEDIDO' && e.fecha_estimada && e.fecha_estimada < hoyMaqueta()).length;
  res.json({ en_curso: enCurso.length, por_avisar: porAvisar, cotizando_atrasados: atrasados, llegada_atrasada: tarde, urgentes: porAvisar + atrasados + tarde });
});
app.get('/api/encargos/:id', (req, res) => {
  const e = encargosMaqueta.find(x => x.id === Number(req.params.id));
  if (!e) return res.status(404).json({ error: 'Encargo no encontrado' });
  const p = productos.find(x => x.id === e.producto_id);
  res.json({ ...encargoParaRol(e), abonos: abonosMaqueta.filter(a => a.encargo_id === e.id), producto: p ? { id: p.id, nombre: p.nombre, stock: p.stock } : null });
});
app.post('/api/encargos', (req, res) => {
  const b = req.body || {};
  if (!String(b.cliente_nombre || '').trim()) return res.status(400).json({ error: 'El nombre del cliente es obligatorio' });
  const abono = Number(b.abono_inicial) || 0;
  const total = Number(b.monto_total) || 0;
  const admin = app.locals.rolMaqueta !== 'trabajador';
  const e = { id: Math.max(0, ...encargosMaqueta.map(x => x.id)) + 1, cliente_nombre: b.cliente_nombre, cliente_telefono: b.cliente_telefono || null, descripcion: b.descripcion,
    monto_total: total, monto_abonado: abono, saldo: total - abono, estado: abono <= 0 ? 'PENDIENTE' : (abono < total ? 'PARCIAL' : 'PAGADO'),
    producto_id: Number(b.producto_id) || null, cantidad: Math.max(1, Number(b.cantidad) || 1), costo_total: admin ? (Number(b.costo_total) || 0) : 0, observaciones: b.observaciones || null,
    proveedor: b.proveedor || null, costo_cotizado_unitario: admin ? (Number(b.costo_cotizado_unitario) || null) : null, fecha_estimada: b.fecha_estimada || null,
    cliente_avisado_en: null, entregado_en: null, ...pedidoMaqueta(b) };
  encargosMaqueta.push(e);
  if (abono > 0) abonosMaqueta.push({ id: abonosMaqueta.length + 1, encargo_id: e.id, monto: abono, metodo_pago: b.metodo_pago, maquina_tarjeta: b.maquina_tarjeta || null, nota: 'Abono inicial', fecha: new Date().toISOString() });
  res.status(201).json({ ...encargoParaRol(e), avisos: [] });
});
app.put('/api/encargos/:id', (req, res) => {
  const e = encargosMaqueta.find(x => x.id === Number(req.params.id));
  if (!e) return res.status(404).json({ error: 'Encargo no encontrado' });
  const b = req.body || {};
  const admin = app.locals.rolMaqueta !== 'trabajador';
  Object.assign(e, { cliente_nombre: b.cliente_nombre, cliente_telefono: b.cliente_telefono || null, descripcion: b.descripcion, monto_total: Number(b.monto_total), saldo: Number(b.monto_total) - e.monto_abonado,
    cantidad: Math.max(1, Number(b.cantidad) || 1), observaciones: b.observaciones || null });
  if (b.proveedor !== undefined) e.proveedor = b.proveedor || null;
  if (b.fecha_estimada !== undefined) e.fecha_estimada = b.fecha_estimada || null;
  if (admin && b.costo_cotizado_unitario !== undefined) e.costo_cotizado_unitario = Number(b.costo_cotizado_unitario) || null;
  if (b.requiere_pedido === true && !e.etapa) Object.assign(e, pedidoMaqueta({ ...b, requiere_pedido: true }));
  else if (b.requiere_pedido === false && ['COTIZANDO', 'CONFIRMADO'].includes(e.etapa)) Object.assign(e, { etapa: null, origen: null, unidades_pedir: null });
  else if (Number(b.unidades_pedir) >= 1 && e.etapa) e.unidades_pedir = Number(b.unidades_pedir);
  res.json({ ...encargoParaRol(e), avisos: [] });
});
app.post('/api/encargos/:id/etapa', (req, res) => {
  const e = encargosMaqueta.find(x => x.id === Number(req.params.id));
  if (!e) return res.status(404).json({ error: 'Encargo no encontrado' });
  const destino = String(req.body.etapa || '').toUpperCase();
  const admin = app.locals.rolMaqueta !== 'trabajador';
  const orden = ['COTIZANDO', 'CONFIRMADO', 'PEDIDO', 'LLEGO'];
  if (!e.etapa) return res.status(409).json({ error: 'Este encargo no tiene nada que pedir al proveedor' });
  if (destino === 'CANCELADO') {
    if (!admin) return res.status(403).json({ error: 'Solo el administrador cancela un encargo' });
    if (String(req.body.motivo || '').trim().length < 5) return res.status(400).json({ error: 'Escribe el motivo de la cancelación (entre 5 y 300 letras)' });
    if (e.monto_abonado > 0) return res.status(409).json({ error: 'Este encargo tiene $' + e.monto_abonado.toLocaleString('es-CL') + ' en abonos, que ya están en Finanzas. No se cancela hasta resolverlo.' });
    Object.assign(e, { etapa: 'CANCELADO', cancelado_motivo: req.body.motivo.trim(), etapa_cambiada_en: new Date().toISOString() });
    return res.json(encargoParaRol(e));
  }
  if (!orden.includes(destino)) return res.status(400).json({ error: 'Etapa inválida' });
  if (orden.indexOf(destino) < orden.indexOf(e.etapa) && !admin) return res.status(403).json({ error: 'Solo el administrador devuelve un encargo a una etapa anterior' });
  Object.assign(e, { etapa: destino, etapa_cambiada_en: new Date().toISOString(), cliente_avisado_en: null, cancelado_motivo: null });
  res.json(encargoParaRol(e));
});
app.post('/api/encargos/:id/avisado', (req, res) => {
  const e = encargosMaqueta.find(x => x.id === Number(req.params.id));
  if (!e || e.etapa !== 'LLEGO') return res.status(409).json({ error: 'El aviso al cliente se anota cuando el encargo ya llegó' });
  e.cliente_avisado_en = new Date().toISOString();
  res.json(encargoParaRol(e));
});
app.post('/api/encargos/:id/entregar', (req, res) => {
  const e = encargosMaqueta.find(x => x.id === Number(req.params.id));
  if (!e) return res.status(404).json({ error: 'Encargo no encontrado' });
  Object.assign(e, { entregado_en: new Date().toISOString(), entregado_nota: req.body.nota || null }, e.etapa ? { etapa: 'ENTREGADO' } : {});
  res.json({ ...encargoParaRol(e), avisos: [] });
});
app.post('/api/encargos/:id/abono', (req, res) => {
  const e = encargosMaqueta.find(x => x.id === Number(req.params.id));
  if (!e) return res.status(404).json({ error: 'Encargo no encontrado' });
  const monto = Number(req.body.monto) || 0;
  e.monto_abonado += monto; e.saldo = e.monto_total - e.monto_abonado; e.estado = e.saldo <= 0 ? 'PAGADO' : 'PARCIAL';
  abonosMaqueta.push({ id: abonosMaqueta.length + 1, encargo_id: e.id, monto, metodo_pago: req.body.metodo_pago, maquina_tarjeta: req.body.maquina_tarjeta || null, nota: req.body.nota || null, fecha: new Date().toISOString() });
  res.json({ ...encargoParaRol(e), abonos: abonosMaqueta.filter(a => a.encargo_id === e.id), ultimo_abono: monto, avisos: [] });
});

// v109: aviso de margen en la caja y precio sugerido. Imitan al servidor real con los productos de
// la maqueta (mínimo 15%; el trabajador recibe solo "bajo"). La regla que vale es la de api/index.js.
app.post('/api/pos/margen-carrito', (req, res) => {
  const items = req.body.items || [];
  const subtotal = items.reduce((a, it) => a + Number(it.precio_unitario) * Number(it.cantidad), 0);
  const valor = Number(req.body.descuento_valor) || 0;
  const descuento = req.body.descuento_tipo === 'PORCENTAJE' ? subtotal * Math.min(valor, 100) / 100 : (req.body.descuento_tipo === 'MONTO' ? Math.min(valor, subtotal) : 0);
  const factor = subtotal > 0 ? (subtotal - descuento) / subtotal : 1;
  const lineas = items.map(it => {
    const p = productos.find(x => x.id === Number(it.producto_id));
    const costo = p ? costoRefMaqueta(p) : 0;
    const real = Number(it.precio_unitario) * factor;
    if (!p || p.es_servicio || p.stock_ilimitado || !(costo > 0) || !(real > 0)) return { bajo: false };
    const precioEscalon = p.precio_mayorista_2 && Number(it.cantidad) >= p.mayorista_desde_2 ? p.precio_mayorista_2 : p.precio_mayorista;
    if (it.precio_tipo === 'MAYORISTA' && p.precio_mayorista && Number(it.precio_unitario) >= precioEscalon) return { bajo: false };
    const margen = (real - costo) / real;
    const bajo = margen < 0.15 - 1e-9;
    return app.locals.rolMaqueta === 'trabajador' ? { bajo }
      : { bajo, margen_pct: Math.round(margen * 1000) / 10, precio_minimo: Math.ceil(costo / 0.85), precio_real: Math.round(real) };
  });
  res.json({ minimo_pct: 15, bajo_minimo: lineas.filter(l => l.bajo).length, requiere_clave: app.locals.rolMaqueta === 'trabajador', lineas });
});
// v112: clave del dueño para que el trabajador cobre bajo el mínimo. En la maqueta, "mala" falla y cualquier otra sirve.
app.post('/api/pos/autorizar-margen', (req, res) => {
  if (String(req.body?.pin || '') === 'mala') return res.status(403).json({ error: 'PIN de administrador incorrecto' });
  res.json({ autorizacion: 'permiso-de-maqueta' });
});
// Categorías de ejemplo, para que el editor de producto pueda elegir una (el precio sugerido depende de ella).
app.get('/api/productos/categorias', (_req, res) => res.json([
  { id: 'c1', nombre: 'Cables y Adaptadores', parent_id: null, orden: 0 },
  { id: 'c1a', nombre: 'Adaptadores y Cables de Video', parent_id: 'c1', orden: 0 },
  { id: 'c2', nombre: 'Componentes PC', parent_id: null, orden: 0 },
  { id: 'c2a', nombre: 'Fuentes de poder', parent_id: 'c2', orden: 0 },
  { id: 'c3', nombre: 'Monitores', parent_id: null, orden: 0 },
  { id: 'c4', nombre: 'Hogar y Estilo de Vida', parent_id: null, orden: 0 },
  { id: 'c5', nombre: 'Periféricos', parent_id: null, orden: 0 },
  { id: 'c6', nombre: 'Computadores', parent_id: null, orden: 0 },
]));
const objetivosMaqueta = { 'Cables y Adaptadores': 0.45, 'Hogar y Estilo de Vida': 0.40, 'Componentes PC': 0.25, 'Monitores': 0.15 };
app.post('/api/productos/precio-sugerido', (req, res) => {
  const b = req.body || {};
  const costo = Number(b.costo) || 0;
  if (!(costo > 0)) return res.json({ precio: null, motivo: 'Escribe el costo para ver el precio sugerido' });
  const objetivo = objetivosMaqueta[b.categoria_web];
  if (!objetivo) return res.json({ precio: null, costo, motivo: b.categoria_web ? `"${b.categoria_web}" no tiene margen objetivo aprobado ni suficientes productos con costo para calcular uno` : 'Elige la categoría para ver el precio sugerido' });
  const en990 = (v) => Math.max(990, Math.ceil((v - 990) / 1000) * 1000 + 990);
  const precio = en990(costo / (1 - objetivo));
  const base = Number(b.precio_actual) > costo ? Number(b.precio_actual) : precio;
  const piso = Math.ceil(costo / 0.8);
  const candidato = Math.max(Math.round((base - Math.min((base - costo) / base / 3, 0.2) * base) / 100) * 100, Math.ceil(piso / 100) * 100);
  const mayorista = candidato <= base * 0.97 ? { precio: candidato, desde: base >= 8000 ? 3 : (base >= 3000 ? 5 : 10),
    margen_pct: Math.round((candidato - costo) / candidato * 1000) / 10, rebaja_pct: Math.round((base - candidato) / base * 1000) / 10, sobre_precio: base } : null;
  res.json({ precio, costo, costo_escrito: costo, familia: b.categoria_web, origen: 'tabla aprobada el 03-10-2026', margen_objetivo_pct: objetivo * 100,
    margen_pct: Math.round((precio - costo) / precio * 1000) / 10, mayorista, piso_mayorista: piso,
    mayorista_motivo: mayorista ? null : `Sobre $${base.toLocaleString('es-CL')} no cabe una rebaja real: el piso mayorista (20% de margen) es $${piso.toLocaleString('es-CL')}` });
});

app.use('/api', (req, res) => {
  const clave = `${req.method} ${req.path}`;
  if (!sinManejar.has(clave)) { sinManejar.add(clave); console.log('[maqueta] sin datos:', clave); }
  res.json(req.method === 'GET' ? [] : { ok: true });
});
app.use(express.static(POS, { etag: false, lastModified: false, setHeaders: (r) => r.setHeader('Cache-Control', 'no-store') }));

const puerto = Number(process.env.PORT) || 4180;
app.listen(puerto, () => console.log(`Maqueta POS en http://localhost:${puerto}`));
