/* ============================================================
   SEVELIN POS — BACKEND (Express sobre funciones serverless de Vercel)
   ------------------------------------------------------------
   Las llaves de Supabase viven SOLO aquí (variables de entorno).
   El navegador nunca las ve: habla con estos endpoints usando un JWT.

   Variables de entorno necesarias (Vercel → Settings → Environment Variables):
     SUPABASE_URL              https://xxxx.supabase.co
     SUPABASE_SERVICE_ROLE_KEY eyJhbGciOi...   (¡secreta! nunca al frontend)
     JWT_SECRET                cadena larga y aleatoria
     ADMIN_PIN                 9067
     WORKER_PIN                0495
     CORS_ORIGINS              https://tu-pos.vercel.app,http://localhost:5500
     NEGOCIO_NOMBRE            Sevelin            (opcional)
   ============================================================ */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();

/* ---------- Configuración ---------- */
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  JWT_SECRET,
  ADMIN_PIN = '9067',
  WORKER_PIN = '0495',
  CORS_ORIGINS = '*',
  NEGOCIO_NOMBRE = 'Sevelin'
} = process.env;

const TOKEN_TTL = '12h';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[POS] Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
}
if (!JWT_SECRET) {
  console.warn('[POS] Falta JWT_SECRET: define uno largo y aleatorio en producción.');
}

// El cliente service_role omite RLS, por eso solo puede existir en el servidor.
const db = createClient(SUPABASE_URL || 'http://localhost', SUPABASE_SERVICE_ROLE_KEY || 'sin-key', {
  auth: { persistSession: false, autoRefreshToken: false }
});

/* ---------- Middlewares base ---------- */
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// 6 MB: los documentos de compras viajan en base64 dentro del JSON.
// (Vercel corta las peticiones sobre ~4.5 MB, por eso el front limita a 4 MB.)
app.use(express.json({ limit: '6mb' }));

const origenesPermitidos = CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    // Permite herramientas sin Origin (curl, Postman) y el mismo dominio de Vercel
    if (!origin || origenesPermitidos.includes('*') || origenesPermitidos.includes(origin)) return cb(null, true);
    return cb(new Error('Origen no permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}));

/* ---------- Utilidades ---------- */
const num = v => Number(v) || 0;
const enviarError = (res, code, msg) => res.status(code).json({ error: msg });

const TIPOS_DTE = ['BOLETA', 'FACTURA', 'SIN DTE'];

/* El DTE es tributario: si llega algo no reconocido, se guarda 'SIN DTE'
   en vez de fallar, para no bloquear una venta en caja. */
function tipoDteValido(valor) {
  const v = String(valor || '').trim().toUpperCase();
  return TIPOS_DTE.includes(v) ? v : 'SIN DTE';
}

/* Acepta "HH:MM" o "HH:MM:SS"; devuelve null si no es una hora válida */
function horaValida(valor) {
  const v = String(valor || '').trim();
  const m = v.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Number(m[1]), mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/* Hora actual en Chile, en formato HH:MM (el servidor de Vercel corre en UTC) */
function horaChileActual() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date());
}

/* Construye el TIMESTAMP real a partir de la fecha y hora elegidas por el
   usuario, interpretadas como hora de Chile. Se calcula el desfase real de
   ese día (Chile cambia entre UTC-4 y UTC-3 según el horario de verano). */
function marcaDeTiempoChile(fecha, hora) {
  const h = horaValida(hora) || '12:00';
  const tentativa = new Date(`${fecha}T${h}:00Z`);   // punto de partida en UTC
  if (isNaN(tentativa.getTime())) return null;

  const comoChile = new Date(tentativa.toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  const comoUTC = new Date(tentativa.toLocaleString('en-US', { timeZone: 'UTC' }));
  const desfase = comoUTC.getTime() - comoChile.getTime();

  return new Date(tentativa.getTime() + desfase).toISOString();
}

function firmarToken(rol) {
  return jwt.sign({ rol }, JWT_SECRET || 'dev-secret-cambiar', { expiresIn: TOKEN_TTL });
}

// Autenticación por JWT. requiereAdmin = true bloquea a los trabajadores.
function auth(requiereAdmin = false) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return enviarError(res, 401, 'Falta el token de sesión');

    try {
      req.usuario = jwt.verify(token, JWT_SECRET || 'dev-secret-cambiar');
    } catch (_) {
      return enviarError(res, 401, 'Sesión inválida o expirada');
    }
    if (requiereAdmin && req.usuario.rol !== 'admin') {
      return enviarError(res, 403, 'Esta acción es solo para el administrador');
    }
    next();
  };
}

// Los trabajadores nunca reciben costos ni utilidades: se limpian en el servidor.
function limpiarParaRol(fila, rol) {
  if (!fila || rol === 'admin') return fila;
  const { costo_total, utilidad, costo_unitario, ...visible } = fila;
  return visible;
}
const limpiarLista = (filas, rol) => (filas || []).map(f => limpiarParaRol(f, rol));

/* Intentos de PIN fallidos por IP (memoria del proceso; en serverless es por
   instancia, suficiente como freno básico ante fuerza bruta). */
const intentos = new Map();
function frenoLogin(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.ip || 'anon';
  const ahora = Date.now();
  const reg = intentos.get(ip) || { n: 0, hasta: 0 };

  if (reg.hasta > ahora) {
    return enviarError(res, 429, 'Demasiados intentos. Espera un minuto.');
  }
  if (ahora - (reg.ts || 0) > 10 * 60 * 1000) reg.n = 0;

  reg.ts = ahora;
  req._registroIntento = { ip, reg };
  intentos.set(ip, reg);
  next();
}

/* Reconfirmación del PIN de administrador para operaciones destructivas
   masivas (borrar todo el catálogo, todo el historial, lotes completos).
   Se valida SIEMPRE en el servidor: aunque alguien manipule el frontend o
   llame la API directamente, sin el PIN correcto la operación se rechaza.
   Reutiliza el mismo freno por IP que el login para evitar fuerza bruta. */
function exigirPinAdmin(req, res, next) {
  /* Se responde 403 (no 401) a propósito: un 401 hace que el frontend
     asuma "sesión expirada" y cierre la sesión del administrador. Aquí la
     sesión es válida; lo que falta es autorizar esta operación puntual. */
  const ip = req.headers['x-forwarded-for'] || req.ip || 'anon';
  const ahora = Date.now();
  const reg = intentos.get(ip) || { n: 0, hasta: 0 };

  if (reg.hasta > ahora) {
    return enviarError(res, 429, 'Demasiados intentos fallidos. Espera un minuto antes de reintentar.');
  }

  const pin = String(req.body?.pin || req.headers['x-admin-pin'] || '').trim();
  if (!pin) return enviarError(res, 403, 'Esta acción requiere confirmar el PIN de administrador');

  if (pin !== String(ADMIN_PIN)) {
    reg.n = (reg.n || 0) + 1;
    reg.ts = ahora;
    if (reg.n >= 5) { reg.hasta = ahora + 60 * 1000; reg.n = 0; }
    intentos.set(ip, reg);
    return enviarError(res, 403, 'PIN de administrador incorrecto');
  }

  reg.n = 0;
  intentos.set(ip, reg);
  next();
}

/* ============================================================
   SESIÓN
   ============================================================ */
app.post('/api/login', frenoLogin, (req, res) => {
  const pin = String(req.body?.pin || '').trim();
  const { ip, reg } = req._registroIntento || {};

  let rol = null;
  if (pin && pin === String(ADMIN_PIN)) rol = 'admin';
  else if (pin && pin === String(WORKER_PIN)) rol = 'trabajador';

  if (!rol) {
    if (reg) {
      reg.n += 1;
      if (reg.n >= 5) { reg.hasta = Date.now() + 60 * 1000; reg.n = 0; }
      intentos.set(ip, reg);
    }
    return enviarError(res, 401, 'PIN incorrecto');
  }

  if (reg) { reg.n = 0; intentos.set(ip, reg); }
  res.json({ token: firmarToken(rol), rol, negocio: NEGOCIO_NOMBRE, expiraEn: TOKEN_TTL });
});

// Permite al frontend saber si el token guardado sigue siendo válido
app.get('/api/me', auth(), (req, res) => {
  res.json({ rol: req.usuario.rol, negocio: NEGOCIO_NOMBRE });
});

/* Ping simple + lista de módulos activos: si algún día vuelve a salir
   "Endpoint no encontrado" en un módulo, este endpoint sirve para
   confirmar rápido si el despliegue en Vercel quedó desactualizado. */
app.get('/api/health', (_req, res) => res.json({
  ok: true,
  servicio: 'sevelin-pos-api',
  version: '2026-08-04',
  modulos: ['productos', 'ventas', 'gastos', 'ot', 'repuestos', 'encargos', 'mermas', 'clasificaciones']
}));

/* ============================================================
   PRODUCTOS
   Lectura: admin y trabajador · Escritura: solo admin
   ============================================================ */
const CAMPOS_PRODUCTO = [
  'sku', 'codigo_barras', 'nombre', 'costo_unitario', 'precio_unitario', 'stock',
  'requiere_sn', 'peso_kg', 'alto_cm', 'ancho_cm', 'profundidad_cm', 'descripcion',
  'stock_minimo', 'alerta_stock', 'es_repuesto', 'stock_ilimitado'
];

function sanearProducto(body = {}) {
  const p = {};
  CAMPOS_PRODUCTO.forEach(k => { if (body[k] !== undefined) p[k] = body[k]; });

  if (!p.nombre || !String(p.nombre).trim()) return null;
  p.nombre = String(p.nombre).trim();
  ['costo_unitario', 'precio_unitario', 'stock', 'peso_kg', 'alto_cm', 'ancho_cm', 'profundidad_cm', 'stock_minimo']
    .forEach(k => { if (p[k] !== undefined) p[k] = num(p[k]); });
  p.requiere_sn = !!p.requiere_sn;
  if (body.alerta_stock !== undefined) p.alerta_stock = !!body.alerta_stock;
  if (body.es_repuesto !== undefined) p.es_repuesto = !!body.es_repuesto;
  if (body.stock_ilimitado !== undefined) p.stock_ilimitado = !!body.stock_ilimitado;

  // Cada vez que se toca el stock queda registrada la fecha del cambio
  if (p.stock !== undefined) p.stock_actualizado_en = new Date().toISOString();
  ['sku', 'codigo_barras', 'descripcion'].forEach(k => {
    if (p[k] !== undefined) p[k] = String(p[k]).trim() || null;
  });
  return p;
}

app.get('/api/productos', auth(), async (req, res) => {
  const { data, error } = await db.from('productos').select('*').order('nombre', { ascending: true });
  if (error) return enviarError(res, 500, error.message);
  res.json(limpiarLista(data, req.usuario.rol));
});

app.post('/api/productos', auth(true), async (req, res) => {
  const producto = sanearProducto(req.body);
  if (!producto) return enviarError(res, 400, 'El nombre del producto es obligatorio');

  const { data, error } = await db.from('productos').insert([producto]).select().single();
  if (error) return enviarError(res, 500, error.message);
  res.status(201).json(data);
});

// Importación masiva (CSV / Excel de Tiendanube)
app.post('/api/productos/bulk', auth(true), async (req, res) => {
  const lista = Array.isArray(req.body?.productos) ? req.body.productos : [];
  const productos = lista.map(sanearProducto).filter(Boolean);
  if (productos.length === 0) return enviarError(res, 400, 'No hay productos válidos para importar');

  const { error } = await db.from('productos').insert(productos);
  if (error) return enviarError(res, 500, error.message);
  res.status(201).json({ importados: productos.length });
});

app.put('/api/productos/:id', auth(true), async (req, res) => {
  const producto = sanearProducto(req.body);
  if (!producto) return enviarError(res, 400, 'El nombre del producto es obligatorio');

  const { data, error } = await db.from('productos').update(producto).eq('id', req.params.id).select().single();
  if (error) return enviarError(res, 500, error.message);
  res.json(data);
});

// Eliminación masiva desde la barra de selección (lista explícita de ids).
// Se registra ANTES de "/:id" para no chocar con esa ruta.
app.post('/api/productos/eliminar-lote', auth(true), exigirPinAdmin, async (req, res) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Boolean);
  if (ids.length === 0) return enviarError(res, 400, 'No hay productos seleccionados');

  const { error } = await db.from('productos').delete().in('id', ids);
  if (error) return enviarError(res, 500, error.message);
  res.json({ eliminadas: ids.length });
});

/* Borrado total del catálogo: ruta propia para poder exigir el PIN sin
   afectar al borrado de un producto individual. Se registra ANTES de
   "/:id" para que no la capture esa ruta. */
app.delete('/api/productos/todos', auth(true), exigirPinAdmin, async (req, res) => {
  const { error } = await db.from('productos').delete().gt('id', 0);
  if (error) return enviarError(res, 500, error.message);
  res.json({ ok: true, alcance: 'todos' });
});

app.delete('/api/productos/:id', auth(true), async (req, res) => {
  const { error } = await db.from('productos').delete().eq('id', req.params.id);
  if (error) return enviarError(res, 500, error.message);
  res.json({ ok: true });
});

/* ============================================================
   VENTAS
   Ver y registrar: admin y trabajador
   Editar y eliminar: solo admin
   ============================================================ */

// Los totales SIEMPRE se calculan en el servidor a partir de los ítems.
async function normalizarItems(items, rolSolicitante) {
  const lista = Array.isArray(items) ? items : [];
  if (lista.length === 0) throw new Error('La venta no tiene productos');

  // Para trabajadores el costo lo pone el catálogo, no el navegador
  let costosCatalogo = {};
  const ids = [...new Set(lista.map(i => i.producto_id).filter(Boolean))];
  if (ids.length) {
    const { data } = await db.from('productos').select('id, costo_unitario').in('id', ids);
    (data || []).forEach(p => { costosCatalogo[p.id] = num(p.costo_unitario); });
  }

  const idsRepuesto = [...new Set(lista.map(i => i.repuesto_id).filter(Boolean))];
  const costosRepuesto = {};
  if (idsRepuesto.length) {
    const { data } = await db.from('repuestos').select('id, costo_unitario').in('id', idsRepuesto);
    (data || []).forEach(r => { costosRepuesto[r.id] = num(r.costo_unitario); });
  }

  return lista.map(it => {
    const cantidad = Math.max(1, Math.round(num(it.cantidad) || 1));
    const precio = num(it.precio_unitario);
    const costoCliente = num(it.costo_unitario);
    const costoCatalogo = it.producto_id
      ? (costosCatalogo[it.producto_id] || 0)
      : (it.repuesto_id ? (costosRepuesto[it.repuesto_id] || 0) : 0);
    const costo = rolSolicitante === 'admin' ? costoCliente : (costoCatalogo || costoCliente);

    return {
      producto_id: it.producto_id || null,
      repuesto_id: it.repuesto_id || null,
      // Si el ítem viene de un repuesto ya reservado en la OT, su stock
      // se descontó al momento de asociarlo: acá NO se vuelve a tocar.
      ot_repuesto_id: it.ot_repuesto_id || null,
      sku: it.sku || null,
      nombre: String(it.nombre || 'Producto').trim(),
      cantidad,
      costo_unitario: costo,
      precio_unitario: precio,
      subtotal: precio * cantidad,
      serial_number: it.serial_number || null
    };
  });
}

/* Ajusta el stock del catálogo a partir de los ítems de una venta.
   signo = -1 descuenta (venta), signo = +1 repone (anulación).
   El producto se busca por id, luego por SKU y finalmente por código de
   barras, de modo que también funcione con ventas importadas. Los ítems
   marcados como stock_ilimitado (servicios) se omiten por completo. */
async function ajustarStock(items, signo = -1) {
  const ajustados = [];

  for (const item of (items || [])) {
    let producto = null;

    if (item.producto_id) {
      const { data } = await db.from('productos').select('id, stock, stock_ilimitado').eq('id', item.producto_id).maybeSingle();
      producto = data || null;
    }
    if (!producto && item.sku) {
      const { data } = await db.from('productos').select('id, stock, stock_ilimitado').eq('sku', String(item.sku).trim()).limit(1);
      producto = (data && data[0]) || null;
    }
    if (!producto && item.codigo_barras) {
      const { data } = await db.from('productos').select('id, stock, stock_ilimitado').eq('codigo_barras', String(item.codigo_barras).trim()).limit(1);
      producto = (data && data[0]) || null;
    }

    // Repuestos internos del taller: viven en su propia tabla
    if (!producto && item.repuesto_id) {
      const { data } = await db.from('repuestos').select('id, stock, stock_ilimitado').eq('id', item.repuesto_id).maybeSingle();
      if (data && !data.stock_ilimitado) {
        const nuevo = num(data.stock) + signo * num(item.cantidad);
        await db.from('repuestos')
          .update({ stock: nuevo, stock_actualizado_en: new Date().toISOString() })
          .eq('id', data.id);
        ajustados.push({ repuesto_id: data.id, stock: nuevo });
      }
      continue;
    }

    if (!producto || producto.stock_ilimitado) continue; // libre o sin control de stock

    const nuevoStock = num(producto.stock) + signo * num(item.cantidad);
    await db.from('productos')
      .update({ stock: nuevoStock, stock_actualizado_en: new Date().toISOString() })
      .eq('id', producto.id);

    ajustados.push({ producto_id: producto.id, stock: nuevoStock });
  }

  return ajustados;
}

/* Revierte los efectos de una o varias ventas eliminadas:
   - a los ítems que NO vienen de una reserva de OT, les repone el stock
     (como antes).
   - a los ítems que SÍ vienen de una reserva de OT (ot_repuesto_id), NO
     se les repone stock — esa pieza sigue físicamente usada en el
     taller — pero se reabre la reserva (cobrado = false) para que la OT
     vuelva a mostrarla como pendiente de cobro.
   Se usa desde el borrado individual, el borrado masivo y el borrado por
   período/total, que antes no revertían nada de esto de forma pareja. */
async function revertirEfectosDeVentas(ventaIds) {
  const ids = (ventaIds || []).filter(Boolean);
  if (ids.length === 0) return { stock_repuesto: 0, items_borrados: 0 };

  const { data: items } = await db.from('venta_items').select('*').in('venta_id', ids);
  const lista = items || [];

  // Todo lo vendido en caja devuelve su stock. Los repuestos de una OT no
  // pasan por el carrito, así que aquí no hay nada especial que reabrir.
  const repuestos = await ajustarStock(lista, +1);

  // Se borran los ítems ANTES que la venta. Con el script 07 la relación ya
  // tiene ON DELETE CASCADE, pero si esa migración todavía no se ejecutó,
  // este borrado explícito evita el error "venta_items_venta_id_fkey".
  let itemsBorrados = 0;
  if (lista.length) {
    const { error } = await db.from('venta_items').delete().in('venta_id', ids);
    if (!error) itemsBorrados = lista.length;
  }

  return { stock_repuesto: repuestos.length, items_borrados: itemsBorrados };
}

function totalizar(items) {
  const total = items.reduce((a, i) => a + i.subtotal, 0);
  const costoTotal = items.reduce((a, i) => a + i.costo_unitario * i.cantidad, 0);
  return { total, costo_total: costoTotal, utilidad: total - costoTotal };
}

app.get('/api/ventas', auth(), async (req, res) => {
  const { desde, hasta, estado } = req.query;
  let q = db.from('ventas').select('*').order('id', { ascending: false });
  if (desde) q = q.gte('fecha', desde);
  if (hasta) q = q.lte('fecha', hasta);
  if (estado) q = q.eq('estado', estado);

  const { data, error } = await q;
  if (error) return enviarError(res, 500, error.message);
  res.json(limpiarLista(data, req.usuario.rol));
});

// Detalle: venta + ítems (el ticket lo necesita para reimprimir)
app.get('/api/ventas/:id', auth(), async (req, res) => {
  const { data: venta, error } = await db.from('ventas').select('*').eq('id', req.params.id).single();
  if (error) return enviarError(res, 404, 'Venta no encontrada');

  const { data: items, error: errItems } = await db.from('venta_items').select('*').eq('venta_id', req.params.id).order('id');
  if (errItems) return enviarError(res, 500, errItems.message);

  res.json({
    ...limpiarParaRol(venta, req.usuario.rol),
    items: limpiarLista(items, req.usuario.rol)
  });
});

app.post('/api/ventas', auth(), async (req, res) => {
  try {
    const items = await normalizarItems(req.body?.items, req.usuario.rol);
    const totales = totalizar(items);

    // "Por Pagar" deja la venta PENDIENTE: no suma a totales hasta que se cobre.
    const metodoPago = req.body?.metodo_pago || 'Efectivo';
    const esPendiente = metodoPago === 'Por Pagar';

    const fecha = req.body?.fecha || new Date().toISOString().slice(0, 10);
    const hora = horaValida(req.body?.hora) || horaChileActual();

    const cabecera = {
      fecha,
      hora,
      // Marca de tiempo real (fecha + hora elegida), interpretada en Chile
      vendida_en: marcaDeTiempoChile(fecha, hora),
      cliente: (req.body?.cliente || '').trim() || null,
      metodo_pago: metodoPago,
      estado: esPendiente ? 'PENDIENTE' : 'PAGADA',
      fecha_pago: esPendiente ? null : new Date().toISOString(),
      metodo_pago_final: esPendiente ? null : metodoPago,
      tipo_dte: tipoDteValido(req.body?.tipo_dte),
      // Vínculo opcional con la orden de trabajo que se está cobrando
      ot_id: req.body?.ot_id || null,
      numero_ot: (req.body?.numero_ot || '').trim() || null,
      ...totales,
      impreso: false
    };

    const { data: venta, error } = await db.from('ventas').insert([cabecera]).select().single();
    if (error) throw new Error(error.message);

    const { error: errItems } = await db.from('venta_items')
      .insert(items.map(i => ({ ...i, venta_id: venta.id })));

    if (errItems) {
      // Evita dejar una venta huérfana si falla el detalle
      await db.from('ventas').delete().eq('id', venta.id);
      throw new Error(errItems.message);
    }

    // El stock de lo vendido en caja se descuenta aquí. Los repuestos de una
    // OT NO viajan en el carrito (solo el servicio cobrado): su stock se
    // descuenta cuando la orden pasa a ENTREGADO.
    await ajustarStock(items, -1);

    res.status(201).json({ ...venta, items });
  } catch (err) {
    enviarError(res, 400, err.message || 'No se pudo registrar la venta');
  }
});

/* Importación de ventas externas (respaldo JSON o planilla).
   Respeta fecha, hora, correlativo, estado y montos del archivo, y descuenta
   el stock de los productos que existan en el catálogo por SKU o código de
   barras. Solo el administrador puede importar. */
app.post('/api/ventas/importar', auth(true), async (req, res) => {
  const lista = Array.isArray(req.body?.ventas) ? req.body.ventas : [];
  if (lista.length === 0) return enviarError(res, 400, 'No hay ventas para importar');
  if (lista.length > 500) return enviarError(res, 413, 'Importa como máximo 500 ventas por archivo');

  const resultado = { importadas: 0, omitidas: 0, errores: [] };

  for (const origen of lista) {
    try {
      if (!origen.fecha) throw new Error('Falta la fecha');

      const items = (Array.isArray(origen.items) ? origen.items : []).map(it => {
        const cantidad = Math.max(1, Math.round(num(it.cantidad) || 1));
        const precio = num(it.precio_unitario);
        return {
          producto_id: it.producto_id || null,
          sku: it.sku || null,
          codigo_barras: it.codigo_barras || null,
          nombre: String(it.nombre || 'Producto importado').trim(),
          cantidad,
          costo_unitario: num(it.costo_unitario),
          precio_unitario: precio,
          subtotal: num(it.subtotal) || precio * cantidad,
          serial_number: it.serial_number || null
        };
      });

      // Si el archivo no trae detalle, se crea una línea con el total de la venta
      if (items.length === 0) {
        const total = num(origen.total);
        if (total <= 0) throw new Error('Venta sin ítems ni total');
        items.push({
          producto_id: null, sku: null, codigo_barras: null,
          nombre: 'Venta importada', cantidad: 1,
          costo_unitario: num(origen.costo_total), precio_unitario: total,
          subtotal: total, serial_number: null
        });
      }

      const totales = totalizar(items);
      const estado = origen.estado === 'PENDIENTE' ? 'PENDIENTE' : 'PAGADA';
      const metodoPago = origen.metodo_pago || (estado === 'PENDIENTE' ? 'Por Pagar' : 'Efectivo');

      const cabecera = {
        fecha: String(origen.fecha).slice(0, 10),
        hora: origen.hora || null,
        cliente: (origen.cliente || '').trim() || null,
        metodo_pago: metodoPago,
        estado,
        fecha_pago: estado === 'PAGADA' ? (origen.fecha_pago || null) : null,
        metodo_pago_final: estado === 'PAGADA' ? (origen.metodo_pago_final || metodoPago) : null,
        // Se respetan los montos del archivo si vienen; si no, se recalculan
        total: num(origen.total) || totales.total,
        costo_total: origen.costo_total !== undefined ? num(origen.costo_total) : totales.costo_total,
        utilidad: origen.utilidad !== undefined ? num(origen.utilidad) : totales.utilidad,
        impreso: true
      };

      // Correlativo original: si ese número ya existe, se deja que la base asigne uno nuevo
      if (origen.numero_orden) {
        const { data: existente } = await db.from('ventas')
          .select('id').eq('numero_orden', origen.numero_orden).limit(1);
        if (existente && existente.length) {
          resultado.omitidas++;
          resultado.errores.push(`Orden ${origen.numero_orden} ya existe: se omitió`);
          continue;
        }
        cabecera.numero_orden = origen.numero_orden;
      }

      const { data: venta, error } = await db.from('ventas').insert([cabecera]).select().single();
      if (error) throw new Error(error.message);

      const { error: errItems } = await db.from('venta_items')
        .insert(items.map(({ codigo_barras, ...i }) => ({ ...i, venta_id: venta.id })));
      if (errItems) {
        await db.from('ventas').delete().eq('id', venta.id);
        throw new Error(errItems.message);
      }

      await ajustarStock(items, -1);
      resultado.importadas++;
    } catch (err) {
      resultado.omitidas++;
      resultado.errores.push(err.message || 'Error desconocido');
    }
  }

  res.status(201).json(resultado);
});

/* Editar venta (solo admin).
   Acepta cabecera y, opcionalmente, la lista completa de ítems:
   si viene "items", se reemplaza el detalle y se recalculan
   total, costo_total y utilidad. */
app.put('/api/ventas/:id', auth(true), async (req, res) => {
  try {
    const id = req.params.id;
    const cambios = {};
    if (req.body?.fecha) cambios.fecha = req.body.fecha;
    if (req.body?.hora !== undefined) cambios.hora = horaValida(req.body.hora) || null;
    if (req.body?.cliente !== undefined) cambios.cliente = (req.body.cliente || '').trim() || null;
    if (req.body?.metodo_pago) cambios.metodo_pago = req.body.metodo_pago;
    if (req.body?.tipo_dte !== undefined) cambios.tipo_dte = tipoDteValido(req.body.tipo_dte);

    // Si cambió la fecha o la hora, se recalcula la marca de tiempo real
    if (cambios.fecha || cambios.hora !== undefined) {
      const { data: actual } = await db.from('ventas').select('fecha, hora').eq('id', id).maybeSingle();
      const fechaFinal = cambios.fecha || actual?.fecha;
      const horaFinal = cambios.hora !== undefined ? cambios.hora : actual?.hora;
      if (fechaFinal) cambios.vendida_en = marcaDeTiempoChile(fechaFinal, horaFinal);
    }

    if (Array.isArray(req.body?.items)) {
      const items = await normalizarItems(req.body.items, 'admin');
      Object.assign(cambios, totalizar(items));

      const { error: errDel } = await db.from('venta_items').delete().eq('venta_id', id);
      if (errDel) throw new Error(errDel.message);

      const { error: errIns } = await db.from('venta_items')
        .insert(items.map(i => ({ ...i, venta_id: Number(id) })));
      if (errIns) throw new Error(errIns.message);
    }

    const { data, error } = await db.from('ventas').update(cambios).eq('id', id).select().single();
    if (error) throw new Error(error.message);

    const { data: items } = await db.from('venta_items').select('*').eq('venta_id', id).order('id');
    res.json({ ...data, items: items || [] });
  } catch (err) {
    enviarError(res, 400, err.message || 'No se pudo actualizar la venta');
  }
});

/* Eliminación masiva de ventas.
   A los ítems normales se les repone el stock; a los que venían de una
   reserva de repuesto en una OT, se les reabre la reserva (esa pieza
   sigue físicamente usada, pero vuelve a quedar "pendiente de cobro"). */
app.post('/api/ventas/eliminar-lote', auth(true), exigirPinAdmin, async (req, res) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Boolean);
  if (ids.length === 0) return enviarError(res, 400, 'No hay ventas seleccionadas');
  if (ids.length > 300) return enviarError(res, 413, 'Elimina como máximo 300 ventas por vez');

  try {
    const resultado = await revertirEfectosDeVentas(ids);

    const { error } = await db.from('ventas').delete().in('id', ids);
    if (error) throw new Error(error.message);

    res.json({ eliminadas: ids.length, ...resultado });
  } catch (err) {
    enviarError(res, 500, err.message || 'No se pudieron eliminar las ventas');
  }
});

// Eliminar por período o todo el historial (solo admin)
app.delete('/api/ventas', auth(true), exigirPinAdmin, async (req, res) => {
  const { desde, hasta, todo } = req.query;

  let qSelect = db.from('ventas').select('id');
  if (todo === 'true') qSelect = qSelect.gt('id', 0);
  else if (desde && hasta) qSelect = qSelect.gte('fecha', desde).lte('fecha', hasta);
  else return enviarError(res, 400, 'Indica un rango de fechas o todo=true');

  const { data: filas, error: errSel } = await qSelect;
  if (errSel) return enviarError(res, 500, errSel.message);

  const ids = (filas || []).map(f => f.id);
  if (ids.length === 0) return res.json({ ok: true, eliminadas: 0 });

  await revertirEfectosDeVentas(ids);

  const { error } = await db.from('ventas').delete().in('id', ids);
  if (error) return enviarError(res, 500, error.message);
  res.json({ ok: true, eliminadas: ids.length });
});

app.delete('/api/ventas/:id', auth(true), async (req, res) => {
  await revertirEfectosDeVentas([Number(req.params.id)]);

  const { error } = await db.from('ventas').delete().eq('id', req.params.id);
  if (error) return enviarError(res, 500, error.message);
  res.json({ ok: true });
});

/* Cobrar una venta pendiente ("Por Pagar" → PAGADA).
   Lo puede hacer cualquier usuario autenticado: es una operación de caja,
   no una edición del historial. */
app.post('/api/ventas/:id/pago', auth(), async (req, res) => {
  const metodo = String(req.body?.metodo_pago_final || '').trim();
  const permitidos = ['Efectivo', 'Transferencia', 'Tarjeta Débito', 'Tarjeta Crédito'];
  if (!permitidos.includes(metodo)) {
    return enviarError(res, 400, 'Selecciona un medio de pago válido');
  }

  const { data: venta, error: errVenta } = await db.from('ventas').select('*').eq('id', req.params.id).single();
  if (errVenta) return enviarError(res, 404, 'Venta no encontrada');
  if (venta.estado === 'PAGADA') return enviarError(res, 400, 'Esta venta ya está pagada');

  const { data, error } = await db.from('ventas')
    .update({
      estado: 'PAGADA',
      metodo_pago_final: metodo,
      fecha_pago: new Date().toISOString()
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return enviarError(res, 500, error.message);
  res.json(limpiarParaRol(data, req.usuario.rol));
});

/* Cambia únicamente el tipo de DTE de una venta ya registrada.
   Se usa desde el selector rápido del Historial (guarda con 1 clic).
   Lo puede hacer cualquier usuario autenticado: es una corrección
   tributaria de caja, no una edición de montos. */
app.post('/api/ventas/:id/dte', auth(), async (req, res) => {
  const tipo = tipoDteValido(req.body?.tipo_dte);

  const { data, error } = await db.from('ventas')
    .update({ tipo_dte: tipo })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return enviarError(res, 500, error.message);
  res.json(limpiarParaRol(data, req.usuario.rol));
});

/* ============================================================
   COMPRAS Y GASTOS  (solo admin: son datos de costos)
   ============================================================ */
const CLASIFICACION_MERMA = 'Mermas / Pérdidas de Inventario';

/* Las clasificaciones ahora viven en su propia tabla y se validan contra
   ella (antes eran una lista fija en el código y un CHECK en la base). */
async function clasificacionValida(nombre) {
  const { data } = await db.from('compra_clasificaciones')
    .select('nombre, activo').eq('nombre', nombre).maybeSingle();
  return !!(data && data.activo);
}

/* Convierte lo que llega del formulario en una marca de tiempo correcta.
   Acepta:
     - "2026-08-04T15:30"      (input datetime-local)
     - "2026-08-04" + hora     (fecha + campo de hora aparte)
   BUG CORREGIDO: antes se hacía new Date('2026-08-04').toISOString(), que
   interpreta la fecha como medianoche UTC; en Chile eso caía el día
   anterior a las 20:00 o 21:00, así que el gasto quedaba con fecha
   equivocada. Ahora se interpreta explícitamente en America/Santiago. */
function fechaHoraDeGasto(valorFecha, valorHora) {
  const texto = String(valorFecha || '').trim();
  if (!texto) return new Date().toISOString();

  // datetime-local: "YYYY-MM-DDTHH:MM"
  const conHora = texto.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}:\d{2})/);
  if (conHora) return marcaDeTiempoChile(conHora[1], conHora[2]);

  // solo fecha: se usa la hora indicada aparte, o la hora actual de Chile
  const soloFecha = texto.match(/^(\d{4}-\d{2}-\d{2})/);
  if (soloFecha) return marcaDeTiempoChile(soloFecha[1], horaValida(valorHora) || horaChileActual());

  // Cualquier otro formato (ISO completo, por ejemplo) se respeta tal cual
  const d = new Date(texto);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

async function sanearCompra(body = {}) {
  const clasificacion = String(body.clasificacion || '').trim();
  if (!clasificacion) return { error: 'Indica la clasificación del gasto' };
  if (!(await clasificacionValida(clasificacion))) {
    return { error: `La clasificación "${clasificacion}" no existe o está desactivada` };
  }

  const costo = num(body.costo_total);
  if (costo <= 0) return { error: 'El costo total debe ser mayor a 0' };

  return {
    datos: {
      fecha: fechaHoraDeGasto(body.fecha, body.hora),
      proveedor: (body.proveedor || '').trim() || null,
      clasificacion,
      costo_total: costo,
      descripcion: (body.descripcion || '').trim() || null,
      url_documento: (body.url_documento || '').trim() || null,
      url_comprobante: (body.url_comprobante || '').trim() || null
    }
  };
}

app.get('/api/compras', auth(true), async (req, res) => {
  const { desde, hasta, clasificacion, sin_documento, sin_comprobante } = req.query;

  let q = db.from('compras').select('*').order('fecha', { ascending: false });
  if (desde) q = q.gte('fecha', desde);
  if (hasta) q = q.lte('fecha', hasta + 'T23:59:59');
  if (clasificacion) q = q.eq('clasificacion', clasificacion);
  if (sin_documento === 'true') q = q.is('url_documento', null);
  if (sin_comprobante === 'true') q = q.is('url_comprobante', null);

  const { data, error } = await q;
  if (error) return enviarError(res, 500, error.message);
  res.json(data || []);
});

app.post('/api/compras', auth(true), async (req, res) => {
  const { datos, error: errValidacion } = await sanearCompra(req.body);
  if (errValidacion) return enviarError(res, 400, errValidacion);

  const { data, error } = await db.from('compras').insert([datos]).select().single();
  if (error) return enviarError(res, 500, error.message);
  res.status(201).json(data);
});

app.put('/api/compras/:id', auth(true), async (req, res) => {
  const { datos, error: errValidacion } = await sanearCompra(req.body);
  if (errValidacion) return enviarError(res, 400, errValidacion);

  const { data, error } = await db.from('compras').update(datos).eq('id', req.params.id).select().single();
  if (error) return enviarError(res, 500, error.message);
  res.json(data);
});

app.post('/api/compras/eliminar-lote', auth(true), exigirPinAdmin, async (req, res) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Boolean);
  if (ids.length === 0) return enviarError(res, 400, 'No hay compras seleccionadas');

  const { error } = await db.from('compras').delete().in('id', ids);
  if (error) return enviarError(res, 500, error.message);
  res.json({ eliminadas: ids.length });
});

app.delete('/api/compras/:id', auth(true), async (req, res) => {
  const { error } = await db.from('compras').delete().eq('id', req.params.id);
  if (error) return enviarError(res, 500, error.message);
  res.json({ ok: true });
});

/* Subida de factura / comprobante al bucket "compras-documentos".
   El archivo llega en base64 y sube con service_role: la llave nunca
   pasa por el navegador. */
/* ---------- Clasificaciones de gastos (CRUD dinámico) ----------
   No colisionan con "/api/compras/:id" porque tienen un segmento más
   ("/compras/clasificaciones/5" vs "/compras/5"), así que Express las
   distingue sin importar el orden de registro. */
app.get('/api/compras/clasificaciones', auth(), async (req, res) => {
  const { incluir_inactivas } = req.query;

  let q = db.from('compra_clasificaciones').select('*').order('nombre');
  if (incluir_inactivas !== 'true') q = q.eq('activo', true);

  const { data, error } = await q;
  if (error) return enviarError(res, 500, error.message);

  // Cuántos gastos usa cada clasificación (para avisar antes de borrar)
  const { data: compras } = await db.from('compras').select('clasificacion');
  const usos = {};
  (compras || []).forEach(c => { if (c.clasificacion) usos[c.clasificacion] = (usos[c.clasificacion] || 0) + 1; });

  res.json((data || []).map(c => ({ ...c, usos: usos[c.nombre] || 0 })));
});

app.post('/api/compras/clasificaciones', auth(true), async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  if (!nombre) return enviarError(res, 400, 'Escribe el nombre de la clasificación');

  const { data, error } = await db.from('compra_clasificaciones')
    .insert([{ nombre, descripcion: (req.body?.descripcion || '').trim() || null, activo: true }])
    .select().single();

  if (error) {
    const duplicado = /duplicate|unique/i.test(error.message);
    return enviarError(res, duplicado ? 409 : 500, duplicado ? 'Ya existe una clasificación con ese nombre' : error.message);
  }
  res.status(201).json(data);
});

/* Renombrar arrastra el cambio a todos los gastos que la usan, para no
   dejar registros históricos apuntando a un nombre que ya no existe. */
app.put('/api/compras/clasificaciones/:id', auth(true), async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  if (!nombre) return enviarError(res, 400, 'Escribe el nombre de la clasificación');

  const { data: actual, error: errActual } = await db.from('compra_clasificaciones')
    .select('*').eq('id', req.params.id).single();
  if (errActual) return enviarError(res, 404, 'No se encontró esa clasificación');

  // Se guarda el nombre anterior ANTES de actualizar: después de la
  // escritura, "actual" ya refleja el nombre nuevo y la comparación para
  // decidir la cascada nunca se cumpliría.
  const nombreAnterior = actual.nombre;

  const cambios = {
    nombre,
    descripcion: req.body?.descripcion !== undefined ? ((req.body.descripcion || '').trim() || null) : actual.descripcion,
    activo: req.body?.activo !== undefined ? !!req.body.activo : actual.activo
  };

  const { data, error } = await db.from('compra_clasificaciones')
    .update(cambios).eq('id', req.params.id).select().single();

  if (error) {
    const duplicado = /duplicate|unique/i.test(error.message);
    return enviarError(res, duplicado ? 409 : 500, duplicado ? 'Ya existe otra clasificación con ese nombre' : error.message);
  }

  if (nombreAnterior !== nombre) {
    const { error: errCascada } = await db.from('compras')
      .update({ clasificacion: nombre }).eq('clasificacion', nombreAnterior);
    if (errCascada) return enviarError(res, 500, errCascada.message);
  }

  res.json(data);
});

/* Si la clasificación ya tiene gastos asociados NO se borra: se desactiva,
   para no romper el historial contable. Solo se elimina de verdad cuando
   no la usa ningún registro. */
app.delete('/api/compras/clasificaciones/:id', auth(true), async (req, res) => {
  const { data: actual, error: errActual } = await db.from('compra_clasificaciones')
    .select('*').eq('id', req.params.id).single();
  if (errActual) return enviarError(res, 404, 'No se encontró esa clasificación');

  const { count } = await db.from('compras')
    .select('id', { count: 'exact', head: true }).eq('clasificacion', actual.nombre);

  if ((count || 0) > 0) {
    const { error } = await db.from('compra_clasificaciones')
      .update({ activo: false }).eq('id', req.params.id);
    if (error) return enviarError(res, 500, error.message);
    return res.json({
      ok: true, desactivada: true, usos: count,
      mensaje: `Tiene ${count} gasto(s) asociados: se desactivó en vez de eliminarse, para no alterar el historial.`
    });
  }

  const { error } = await db.from('compra_clasificaciones').delete().eq('id', req.params.id);
  if (error) return enviarError(res, 500, error.message);
  res.json({ ok: true, desactivada: false });
});

app.post('/api/compras/archivo', auth(true), async (req, res) => {
  try {
    const { nombre, tipo, base64 } = req.body || {};
    if (!base64 || !nombre) return enviarError(res, 400, 'Falta el archivo');

    const contenido = String(base64).includes(',') ? String(base64).split(',')[1] : String(base64);
    const buffer = Buffer.from(contenido, 'base64');
    if (buffer.length > 4 * 1024 * 1024) return enviarError(res, 413, 'El archivo supera los 4 MB');

    const limpio = String(nombre).replace(/[^\w.\-]/g, '_').slice(-80);
    const ruta = `${new Date().getFullYear()}/${Date.now()}_${limpio}`;

    const { error } = await db.storage.from('compras-documentos')
      .upload(ruta, buffer, { contentType: tipo || 'application/octet-stream', upsert: false });
    if (error) throw new Error(error.message);

    const { data } = db.storage.from('compras-documentos').getPublicUrl(ruta);
    res.status(201).json({ url: data.publicUrl, ruta });
  } catch (err) {
    enviarError(res, 500, err.message || 'No se pudo subir el archivo');
  }
});

/* ============================================================
   ÓRDENES DE TRABAJO (Check-In / Check-Out)
   Ver y crear: admin y trabajador · Eliminar: solo admin
   ============================================================ */
const CAMPOS_OT = [
  'cliente_nombre', 'cliente_rut', 'cliente_telefono', 'cliente_correo', 'cliente_direccion',
  'dispositivo_categoria', 'dispositivo_modelo', 'dispositivo_sn', 'dispositivo_enciende', 'dispositivo_pin',
  'cargador_deja', 'cargador_tipo', 'cargador_voltaje', 'cargador_amperaje', 'cargador_cable',
  'accesorios', 'falla_reportada', 'obs_cliente', 'obs_tecnico', 'obs_internas', 'acepta_responsabilidad'
];

function sanearOT(body = {}) {
  const ot = {};
  CAMPOS_OT.forEach(k => { if (body[k] !== undefined) ot[k] = body[k]; });

  if (!ot.cliente_nombre || !String(ot.cliente_nombre).trim()) return { error: 'El nombre del cliente es obligatorio' };
  if (!ot.dispositivo_modelo || !String(ot.dispositivo_modelo).trim()) return { error: 'Indica el modelo del equipo' };
  if (!ot.falla_reportada || !String(ot.falla_reportada).trim()) return { error: 'Describe la falla reportada' };

  ['cargador_deja', 'cargador_cable', 'acepta_responsabilidad'].forEach(k => { ot[k] = !!ot[k]; });
  ['cargador_voltaje', 'cargador_amperaje'].forEach(k => { ot[k] = ot[k] === undefined || ot[k] === '' ? null : num(ot[k]); });
  Object.keys(ot).forEach(k => { if (typeof ot[k] === 'string') ot[k] = ot[k].trim() || null; });

  return { datos: ot };
}

app.get('/api/ot', auth(), async (req, res) => {
  const { estado, buscar } = req.query;
  let q = db.from('ordenes_trabajo').select('*').order('id', { ascending: false });
  if (estado) q = q.eq('estado', estado);

  const { data, error } = await q;
  if (error) return enviarError(res, 500, error.message);

  let filas = data || [];
  if (buscar) {
    const t = String(buscar).toLowerCase();
    filas = filas.filter(o =>
      (o.numero_ot || '').toLowerCase().includes(t) ||
      (o.cliente_nombre || '').toLowerCase().includes(t) ||
      (o.cliente_rut || '').toLowerCase().includes(t) ||
      (o.dispositivo_modelo || '').toLowerCase().includes(t) ||
      (o.dispositivo_sn || '').toLowerCase().includes(t)
    );
  }
  res.json(filas);
});

app.get('/api/ot/:id', auth(), async (req, res) => {
  const { data, error } = await db.from('ordenes_trabajo').select('*').eq('id', req.params.id).single();
  if (error) return enviarError(res, 404, 'Orden de trabajo no encontrada');
  res.json(data);
});

app.post('/api/ot', auth(), async (req, res) => {
  const { datos, error: errValidacion } = sanearOT(req.body);
  if (errValidacion) return enviarError(res, 400, errValidacion);

  // numero_ot lo asigna el trigger de la base de datos (OT-000001, OT-000002…)
  const { data, error } = await db.from('ordenes_trabajo')
    .insert([{ ...datos, estado: 'PENDIENTE' }])
    .select()
    .single();

  if (error) return enviarError(res, 500, error.message);
  res.status(201).json(data);
});

app.put('/api/ot/:id', auth(), async (req, res) => {
  const { datos, error: errValidacion } = sanearOT(req.body);
  if (errValidacion) return enviarError(res, 400, errValidacion);

  const { data, error } = await db.from('ordenes_trabajo').update(datos).eq('id', req.params.id).select().single();
  if (error) return enviarError(res, 500, error.message);
  res.json(data);
});

/* Check-Out: entrega del equipo con firma de quien retira */
app.post('/api/ot/:id/entrega', auth(), async (req, res) => {
  const { data: ot, error: errOT } = await db.from('ordenes_trabajo').select('*').eq('id', req.params.id).single();
  if (errOT) return enviarError(res, 404, 'Orden de trabajo no encontrada');
  if (ot.estado === 'ENTREGADO') return enviarError(res, 400, 'Esta orden ya fue entregada');

  const firma = String(req.body?.retira_firma_base64 || '');
  if (firma.length > 400000) return enviarError(res, 413, 'La firma es demasiado pesada');

  const { data, error } = await db.from('ordenes_trabajo')
    .update({
      estado: 'ENTREGADO',
      fecha_entrega: new Date().toISOString(),
      retira_nombre: (req.body?.retira_nombre || '').trim() || null,
      retira_rut: (req.body?.retira_rut || '').trim() || null,
      retira_firma_base64: firma || null
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return enviarError(res, 500, error.message);

  /* ESTE es el momento en que el stock sale del inventario: al entregar.
     Se descuentan solo los repuestos/productos del catálogo que aún no se
     hayan descontado. Los ítems escritos a mano (sin repuesto_id ni
     producto_id) no afectan inventario, y los marcados como
     stock_ilimitado los ignora ajustarStock(). */
  const { data: asignados } = await db.from('ot_repuestos')
    .select('*').eq('ot_id', req.params.id).eq('stock_descontado', false);

  const conInventario = (asignados || []).filter(r => r.repuesto_id || r.producto_id);
  let descontados = [];

  if (conInventario.length) {
    descontados = await ajustarStock(conInventario.map(r => ({
      producto_id: r.producto_id,
      repuesto_id: r.repuesto_id,
      cantidad: r.cantidad
    })), -1);

    await db.from('ot_repuestos')
      .update({ stock_descontado: true })
      .in('id', conInventario.map(r => r.id));
  }

  res.json({ ...data, stock_descontado_en: descontados.length });
});

app.delete('/api/ot/:id', auth(true), async (req, res) => {
  const { error } = await db.from('ordenes_trabajo').delete().eq('id', req.params.id);
  if (error) return enviarError(res, 500, error.message);
  res.json({ ok: true });
});

/* ============================================================
   REPUESTOS INTERNOS DE TALLER
   Inventario propio, fuera del catálogo comercial.
   Ver: admin y trabajador (el técnico los usa) · Escribir: admin
   ============================================================ */
const CAMPOS_REPUESTO = [
  'area', 'categoria', 'modelo', 'descripcion', 'costo_unitario',
  'precio_venta', 'stock', 'stock_minimo', 'alerta_stock', 'ubicacion', 'stock_ilimitado'
];

function sanearRepuesto(body = {}) {
  const r = {};
  CAMPOS_REPUESTO.forEach(k => { if (body[k] !== undefined) r[k] = body[k]; });

  ['area', 'categoria', 'modelo'].forEach(k => { r[k] = String(r[k] || '').trim(); });
  if (!r.area) return { error: 'Indica el área o tipo (Teléfonos, Laptops, etc.)' };
  if (!r.categoria) return { error: 'Indica la categoría base (Batería, Pantalla, BIOS, etc.)' };
  if (!r.modelo) return { error: 'Indica el modelo exacto del repuesto' };

  ['costo_unitario', 'precio_venta', 'stock', 'stock_minimo'].forEach(k => {
    if (r[k] !== undefined) r[k] = num(r[k]);
  });
  if (!(num(r.precio_venta) > 0)) return { error: 'El precio de venta (con mano de obra) debe ser mayor a 0' };

  if (body.alerta_stock !== undefined) r.alerta_stock = !!body.alerta_stock;
  if (body.stock_ilimitado !== undefined) r.stock_ilimitado = !!body.stock_ilimitado;
  ['descripcion', 'ubicacion'].forEach(k => { if (r[k] !== undefined) r[k] = String(r[k]).trim() || null; });

  if (r.stock !== undefined) r.stock_actualizado_en = new Date().toISOString();
  return { datos: r };
}

/* Si el área o categoría escritas a mano todavía no existen en el
   catálogo administrable, se agregan solas (así el usuario puede seguir
   escribiendo valores nuevos libremente y quedan disponibles después como
   sugerencia y en el panel de "Administrar Categorías"). */
async function asegurarAreaYCategoria(area, categoria) {
  if (area) {
    await db.from('repuesto_areas').upsert([{ nombre: area }], { onConflict: 'nombre', ignoreDuplicates: true });
  }
  if (categoria) {
    await db.from('repuesto_categorias').upsert([{ nombre: categoria }], { onConflict: 'nombre', ignoreDuplicates: true });
  }
}

app.get('/api/repuestos', auth(), async (req, res) => {
  const { area, categoria } = req.query;
  let q = db.from('repuestos').select('*').order('area').order('categoria').order('modelo');
  if (area) q = q.eq('area', area);
  if (categoria) q = q.eq('categoria', categoria);

  const { data, error } = await q;
  if (error) return enviarError(res, 500, error.message);
  res.json(limpiarLista(data, req.usuario.rol));
});

app.post('/api/repuestos', auth(true), async (req, res) => {
  const { datos, error: errValidacion } = sanearRepuesto(req.body);
  if (errValidacion) return enviarError(res, 400, errValidacion);

  const { data, error } = await db.from('repuestos').insert([datos]).select().single();
  if (error) {
    const duplicado = /duplicate|unique/i.test(error.message);
    return enviarError(res, duplicado ? 409 : 500,
      duplicado ? 'Ya existe un repuesto con esa área, categoría y modelo' : error.message);
  }

  await asegurarAreaYCategoria(datos.area, datos.categoria);
  res.status(201).json(data);
});

app.put('/api/repuestos/:id', auth(true), async (req, res) => {
  const { datos, error: errValidacion } = sanearRepuesto(req.body);
  if (errValidacion) return enviarError(res, 400, errValidacion);

  const { data, error } = await db.from('repuestos').update(datos).eq('id', req.params.id).select().single();
  if (error) return enviarError(res, 500, error.message);

  await asegurarAreaYCategoria(datos.area, datos.categoria);
  res.json(data);
});

app.delete('/api/repuestos/:id', auth(true), async (req, res) => {
  const { error } = await db.from('repuestos').delete().eq('id', req.params.id);
  if (error) return enviarError(res, 500, error.message);
  res.json({ ok: true });
});

/* ============================================================
   ADMINISTRACIÓN DE ÁREAS/TIPO Y CATEGORÍAS BASE (repuestos)
   Catálogo aparte para poder renombrar o eliminar estos valores en todos
   los repuestos que los usan, sin tener que editarlos uno por uno.
   Ver: admin y trabajador (para el autocompletado) · Escribir: solo admin
   ============================================================ */
function fabricarRutasCatalogoRepuesto(segmentoUrl, nombreTabla, columnaEnRepuestos) {
  // GET: lista con cuántos repuestos usan cada valor
  app.get(`/api/repuestos/${segmentoUrl}`, auth(), async (req, res) => {
    const { data: valores, error } = await db.from(nombreTabla).select('*').order('nombre');
    if (error) return enviarError(res, 500, error.message);

    const { data: repuestos } = await db.from('repuestos').select(columnaEnRepuestos);
    const conteo = {};
    (repuestos || []).forEach(r => {
      const v = r[columnaEnRepuestos];
      if (v) conteo[v] = (conteo[v] || 0) + 1;
    });

    res.json((valores || []).map(v => ({ ...v, usos: conteo[v.nombre] || 0 })));
  });

  app.post(`/api/repuestos/${segmentoUrl}`, auth(true), async (req, res) => {
    const nombre = String(req.body?.nombre || '').trim();
    if (!nombre) return enviarError(res, 400, 'Escribe un nombre');

    const { data, error } = await db.from(nombreTabla).insert([{ nombre }]).select().single();
    if (error) {
      const duplicado = /duplicate|unique/i.test(error.message);
      return enviarError(res, duplicado ? 409 : 500, duplicado ? 'Ese valor ya existe' : error.message);
    }
    res.status(201).json(data);
  });

  // Renombrar: además de actualizar el catálogo, actualiza en cascada
  // todos los repuestos que tenían el nombre anterior.
  app.put(`/api/repuestos/${segmentoUrl}/:id`, auth(true), async (req, res) => {
    const nuevoNombre = String(req.body?.nombre || '').trim();
    if (!nuevoNombre) return enviarError(res, 400, 'Escribe un nombre');

    const { data: actual, error: errActual } = await db.from(nombreTabla).select('*').eq('id', req.params.id).single();
    if (errActual) return enviarError(res, 404, 'No se encontró ese valor');

    const nombreAnterior = actual.nombre;
    if (nombreAnterior === nuevoNombre) return res.json(actual);

    const { data, error } = await db.from(nombreTabla).update({ nombre: nuevoNombre }).eq('id', req.params.id).select().single();
    if (error) {
      const duplicado = /duplicate|unique/i.test(error.message);
      return enviarError(res, duplicado ? 409 : 500, duplicado ? 'Ya existe otro valor con ese nombre' : error.message);
    }

    const { error: errCascada } = await db.from('repuestos')
      .update({ [columnaEnRepuestos]: nuevoNombre }).eq(columnaEnRepuestos, nombreAnterior);
    if (errCascada) return enviarError(res, 500, errCascada.message);

    res.json(data);
  });

  // Eliminar: solo si ningún repuesto lo está usando actualmente
  app.delete(`/api/repuestos/${segmentoUrl}/:id`, auth(true), async (req, res) => {
    const { data: actual, error: errActual } = await db.from(nombreTabla).select('*').eq('id', req.params.id).single();
    if (errActual) return enviarError(res, 404, 'No se encontró ese valor');

    const { count } = await db.from('repuestos')
      .select('id', { count: 'exact', head: true }).eq(columnaEnRepuestos, actual.nombre);

    if ((count || 0) > 0) {
      return enviarError(res, 400,
        `No se puede eliminar: ${count} repuesto(s) todavía usan "${actual.nombre}". Renómbralos primero o cámbiales el valor.`);
    }

    const { error } = await db.from(nombreTabla).delete().eq('id', req.params.id);
    if (error) return enviarError(res, 500, error.message);
    res.json({ ok: true });
  });
}

fabricarRutasCatalogoRepuesto('areas', 'repuesto_areas', 'area');
fabricarRutasCatalogoRepuesto('categorias', 'repuesto_categorias', 'categoria');

/* ---------- Repuestos y mano de obra asignados a una OT ---------- */
app.get('/api/ot/:id/repuestos', auth(), async (req, res) => {
  const { data, error } = await db.from('ot_repuestos').select('*').eq('ot_id', req.params.id).order('id');
  if (error) return enviarError(res, 500, error.message);
  res.json(limpiarLista(data, req.usuario.rol));
});

app.post('/api/ot/:id/repuestos', auth(), async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  const precio = num(req.body?.precio_unitario);
  const cantidad = Math.max(1, Math.round(num(req.body?.cantidad) || 1));
  if (!nombre) return enviarError(res, 400, 'Indica el repuesto o servicio');
  if (precio <= 0) return enviarError(res, 400, 'El precio debe ser mayor a 0');

  const repuestoId = req.body?.repuesto_id || null;
  const productoId = req.body?.producto_id || null;

  try {
    // Al asociar NO se toca el stock: el descuento ocurre cuando la orden
    // pasa a ENTREGADO. Aquí solo se avisa si el stock disponible no
    // alcanzaría, para que el técnico lo sepa antes de comprometerlo.
    let aviso = null;
    if (repuestoId) {
      const { data: rep } = await db.from('repuestos')
        .select('stock, stock_ilimitado').eq('id', repuestoId).maybeSingle();
      if (rep && !rep.stock_ilimitado && num(rep.stock) < cantidad) {
        aviso = `Atención: solo quedan ${rep.stock} unidad(es) en el taller.`;
      }
    } else if (productoId) {
      const { data: prod } = await db.from('productos')
        .select('stock, stock_ilimitado').eq('id', productoId).maybeSingle();
      if (prod && !prod.stock_ilimitado && num(prod.stock) < cantidad) {
        aviso = `Atención: solo quedan ${prod.stock} unidad(es) en el catálogo.`;
      }
    }

    const registro = {
      ot_id: Number(req.params.id),
      repuesto_id: repuestoId,
      producto_id: productoId,
      nombre,
      cantidad,
      costo_unitario: num(req.body?.costo_unitario),
      precio_unitario: precio,
      cobrado: false,
      stock_descontado: false
    };

    const { data, error } = await db.from('ot_repuestos').insert([registro]).select().single();
    if (error) throw new Error(error.message);
    res.status(201).json({ ...data, aviso });
  } catch (err) {
    enviarError(res, 500, err.message || 'No se pudo agregar el repuesto a la orden');
  }
});

app.delete('/api/ot/:otId/repuestos/:id', auth(), async (req, res) => {
  const { data: fila, error: errFila } = await db.from('ot_repuestos')
    .select('*').eq('id', req.params.id).eq('ot_id', req.params.otId).maybeSingle();
  if (errFila) return enviarError(res, 500, errFila.message);
  if (!fila) return enviarError(res, 404, 'No se encontró ese ítem en la orden');

  // Si la orden ya se entregó, su stock ya salió del inventario: se devuelve
  // al quitar el ítem. Si aún no se entregaba, nunca se descontó nada.
  if (fila.stock_descontado) {
    await ajustarStock([{
      producto_id: fila.producto_id,
      repuesto_id: fila.repuesto_id,
      cantidad: fila.cantidad
    }], +1);
  }

  const { error } = await db.from('ot_repuestos').delete().eq('id', req.params.id).eq('ot_id', req.params.otId);
  if (error) return enviarError(res, 500, error.message);
  res.json({ ok: true, stock_devuelto: !!fila.stock_descontado });
});

/* ============================================================
   MERMAS / PÉRDIDAS DE INVENTARIO  (solo admin)
   Dar de baja stock dañado, robado o vencido. Cada merma:
     1. descuenta el stock del producto o repuesto,
     2. genera automáticamente un gasto en "compras" con la clasificación
        "Mermas / Pérdidas de Inventario" por (cantidad × costo unitario),
     3. queda registrada en la tabla "mermas" para auditoría.
   NO genera venta ni toca utilidades comerciales.
   ============================================================ */
app.get('/api/mermas', auth(true), async (req, res) => {
  const { desde, hasta } = req.query;

  let q = db.from('mermas').select('*').order('id', { ascending: false });
  if (desde) q = q.gte('creado_en', desde);
  if (hasta) q = q.lte('creado_en', hasta + 'T23:59:59');

  const { data, error } = await q;
  if (error) return enviarError(res, 500, error.message);
  res.json(data || []);
});

app.post('/api/mermas', auth(true), async (req, res) => {
  const tipo = String(req.body?.tipo || '').trim().toUpperCase();
  const cantidad = num(req.body?.cantidad);
  const observacion = String(req.body?.observacion || '').trim();
  const itemId = req.body?.item_id;

  if (!['PRODUCTO', 'REPUESTO'].includes(tipo)) return enviarError(res, 400, 'Indica si la merma es de un producto o de un repuesto');
  if (!itemId) return enviarError(res, 400, 'Selecciona el ítem a dar de baja');
  if (cantidad <= 0) return enviarError(res, 400, 'La cantidad debe ser mayor a 0');
  if (!observacion) return enviarError(res, 400, 'La observación / motivo es obligatoria');

  const esProducto = tipo === 'PRODUCTO';
  const tabla = esProducto ? 'productos' : 'repuestos';

  try {
    const { data: item, error: errItem } = await db.from(tabla)
      .select('*').eq('id', itemId).maybeSingle();
    if (errItem) throw new Error(errItem.message);
    if (!item) return enviarError(res, 404, 'No se encontró el ítem indicado');

    const nombre = esProducto ? item.nombre : `${item.area} · ${item.categoria} · ${item.modelo}`;

    // Los ítems de stock ilimitado (servicios) no tienen inventario que dar de baja
    if (item.stock_ilimitado) {
      return enviarError(res, 400, `"${nombre}" está marcado como stock ilimitado: no tiene inventario físico que dar de baja.`);
    }
    if (num(item.stock) < cantidad) {
      return enviarError(res, 400, `No hay stock suficiente: solo quedan ${item.stock} unidad(es) de "${nombre}".`);
    }

    // Ambas tablas guardan el costo en 'costo_unitario'
    const costoUnitario = num(item.costo_unitario);
    const costoTotal = costoUnitario * cantidad;

    // 1) Se descuenta el stock
    const { error: errStock } = await db.from(tabla)
      .update({ stock: num(item.stock) - cantidad, stock_actualizado_en: new Date().toISOString() })
      .eq('id', itemId);
    if (errStock) throw new Error(errStock.message);

    // 2) Gasto automático. Se asegura que la clasificación exista, por si
    //    el script 08 no se ha ejecutado o alguien la desactivó.
    await db.from('compra_clasificaciones')
      .upsert([{ nombre: CLASIFICACION_MERMA, descripcion: 'Stock dado de baja por daño, robo o vencimiento', activo: true }],
              { onConflict: 'nombre', ignoreDuplicates: true });

    const detalle = `Merma de ${cantidad} × ${nombre} — ${observacion}`;
    const { data: gasto, error: errGasto } = await db.from('compras').insert([{
      fecha: new Date().toISOString(),
      proveedor: 'Ajuste interno de inventario',
      clasificacion: CLASIFICACION_MERMA,
      costo_total: costoTotal,
      descripcion: detalle,
      origen: 'MERMA'
    }]).select().single();
    if (errGasto) throw new Error(errGasto.message);

    // 3) Registro de la merma
    const { data: merma, error: errMerma } = await db.from('mermas').insert([{
      tipo,
      producto_id: esProducto ? itemId : null,
      repuesto_id: esProducto ? null : itemId,
      nombre,
      cantidad,
      costo_unitario: costoUnitario,
      costo_total: costoTotal,
      observacion,
      compra_id: gasto.id
    }]).select().single();
    if (errMerma) throw new Error(errMerma.message);

    res.status(201).json({
      ...merma,
      stock_restante: num(item.stock) - cantidad,
      gasto_registrado: { id: gasto.id, clasificacion: gasto.clasificacion, costo_total: gasto.costo_total }
    });
  } catch (err) {
    enviarError(res, 500, err.message || 'No se pudo registrar la merma');
  }
});

/* ============================================================
   ABONOS Y ENCARGOS
   Ver y registrar: admin y trabajador · Eliminar: solo admin
   ============================================================ */
function estadoEncargo(total, abonado) {
  if (abonado <= 0) return 'PENDIENTE';
  if (abonado + 0.001 < total) return 'PARCIAL';
  return 'PAGADO';
}

function sanearEncargo(body = {}) {
  const descripcion = String(body.descripcion || '').trim();
  const cliente = String(body.cliente_nombre || '').trim();
  const total = num(body.monto_total);

  if (!cliente) return { error: 'El nombre del cliente es obligatorio' };
  if (!descripcion) return { error: 'Describe el encargo o servicio' };
  if (total <= 0) return { error: 'El monto total debe ser mayor a 0' };

  return {
    datos: {
      ot_id: body.ot_id || null,
      numero_ot: (body.numero_ot || '').trim() || null,
      cliente_nombre: cliente,
      cliente_rut: (body.cliente_rut || '').trim() || null,
      cliente_telefono: (body.cliente_telefono || '').trim() || null,
      descripcion,
      monto_total: total,
      observaciones: (body.observaciones || '').trim() || null
    }
  };
}

app.get('/api/encargos', auth(), async (req, res) => {
  const { estado } = req.query;
  let q = db.from('encargos').select('*').order('id', { ascending: false });
  if (estado) q = q.eq('estado', estado);

  const { data, error } = await q;
  if (error) return enviarError(res, 500, error.message);
  res.json(data || []);
});

app.get('/api/encargos/:id', auth(), async (req, res) => {
  const { data: encargo, error } = await db.from('encargos').select('*').eq('id', req.params.id).single();
  if (error) return enviarError(res, 404, 'Encargo no encontrado');

  const { data: abonos } = await db.from('encargo_abonos')
    .select('*').eq('encargo_id', req.params.id).order('id');

  res.json({ ...encargo, abonos: abonos || [] });
});

app.post('/api/encargos', auth(), async (req, res) => {
  const { datos, error: errValidacion } = sanearEncargo(req.body);
  if (errValidacion) return enviarError(res, 400, errValidacion);

  const abonoInicial = num(req.body?.abono_inicial);
  if (abonoInicial > datos.monto_total) return enviarError(res, 400, 'El abono no puede superar el monto total');

  const registro = {
    ...datos,
    monto_abonado: abonoInicial,
    saldo: datos.monto_total - abonoInicial,
    estado: estadoEncargo(datos.monto_total, abonoInicial)
  };

  const { data: encargo, error } = await db.from('encargos').insert([registro]).select().single();
  if (error) return enviarError(res, 500, error.message);

  if (abonoInicial > 0) {
    await db.from('encargo_abonos').insert([{
      encargo_id: encargo.id,
      monto: abonoInicial,
      metodo_pago: req.body?.metodo_pago || 'Efectivo',
      nota: 'Abono inicial'
    }]);
  }

  res.status(201).json(encargo);
});

app.put('/api/encargos/:id', auth(), async (req, res) => {
  const { datos, error: errValidacion } = sanearEncargo(req.body);
  if (errValidacion) return enviarError(res, 400, errValidacion);

  const { data: actual, error: errActual } = await db.from('encargos').select('*').eq('id', req.params.id).single();
  if (errActual) return enviarError(res, 404, 'Encargo no encontrado');

  const abonado = num(actual.monto_abonado);
  if (datos.monto_total < abonado) {
    return enviarError(res, 400, `El monto total no puede ser menor a lo ya abonado (${abonado})`);
  }

  const cambios = {
    ...datos,
    saldo: datos.monto_total - abonado,
    estado: estadoEncargo(datos.monto_total, abonado)
  };

  const { data, error } = await db.from('encargos').update(cambios).eq('id', req.params.id).select().single();
  if (error) return enviarError(res, 500, error.message);
  res.json(data);
});

/* Registrar un abono: suma al total abonado y recalcula saldo y estado */
app.post('/api/encargos/:id/abono', auth(), async (req, res) => {
  const monto = num(req.body?.monto);
  if (monto <= 0) return enviarError(res, 400, 'El abono debe ser mayor a 0');

  const { data: encargo, error: errEncargo } = await db.from('encargos').select('*').eq('id', req.params.id).single();
  if (errEncargo) return enviarError(res, 404, 'Encargo no encontrado');
  if (encargo.estado === 'PAGADO') return enviarError(res, 400, 'Este encargo ya está pagado');

  const abonado = num(encargo.monto_abonado) + monto;
  if (abonado > num(encargo.monto_total) + 0.001) {
    return enviarError(res, 400, 'El abono supera el saldo pendiente');
  }

  const { error: errAbono } = await db.from('encargo_abonos').insert([{
    encargo_id: encargo.id,
    monto,
    metodo_pago: req.body?.metodo_pago || 'Efectivo',
    nota: (req.body?.nota || '').trim() || null
  }]);
  if (errAbono) return enviarError(res, 500, errAbono.message);

  const { data, error } = await db.from('encargos').update({
    monto_abonado: abonado,
    saldo: num(encargo.monto_total) - abonado,
    estado: estadoEncargo(num(encargo.monto_total), abonado)
  }).eq('id', encargo.id).select().single();

  if (error) return enviarError(res, 500, error.message);

  const { data: abonos } = await db.from('encargo_abonos').select('*').eq('encargo_id', encargo.id).order('id');
  res.json({ ...data, abonos: abonos || [], ultimo_abono: monto });
});

app.delete('/api/encargos/:id', auth(true), async (req, res) => {
  const { error } = await db.from('encargos').delete().eq('id', req.params.id);
  if (error) return enviarError(res, 500, error.message);
  res.json({ ok: true });
});

/* ---------- 404 y errores ---------- */
app.use('/api', (_req, res) => enviarError(res, 404, 'Endpoint no encontrado'));
app.use((err, _req, res, _next) => {
  console.error('[POS] Error no controlado:', err.message);
  enviarError(res, 500, 'Error interno del servidor');
});

/* Vercel importa el app; en local se levanta con `npm run dev` */
module.exports = app;

if (require.main === module) {
  const puerto = process.env.PORT || 3000;
  app.listen(puerto, () => console.log(`API POS escuchando en http://localhost:${puerto}`));
}
