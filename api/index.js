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
     SYNC_SECRET               cadena larga y aleatoria (compartida con sevelin-tienda)
     SUPABASE_WEB_URL              https://yyyy.supabase.co   (proyecto Supabase WEB, distinto)
     SUPABASE_WEB_SERVICE_ROLE_KEY eyJhbGciOi...               (panel Pedidos Web, Fase 5)
   ============================================================ */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();

/* ---------- Configuración ---------- */
const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  JWT_SECRET,
  ADMIN_PIN,
  WORKER_PIN,
  CORS_ORIGINS = '',
  NEGOCIO_NOMBRE = 'Sevelin',
  // Secreto compartido con sevelin-tienda (repo aparte, e-commerce Fase 1/3):
  // protege /api/interno/ajustar-stock, llamado por el backend de la tienda
  // tras confirmar un pago, NO por una persona logueada — por eso no usa
  // JWT (ver authSync() más abajo). Mismo valor que SYNC_SECRET en las
  // variables de entorno de sevelin-tienda.
  SYNC_SECRET,
  // Proyecto Supabase WEB (distinto del de arriba) — el de sevelin-tienda.
  // Solo se usa dentro del panel "Pedidos Web" (Fase 5, cliente `dbWeb` más
  // abajo): nunca se mezcla con `db`, que sigue siendo el único cliente del
  // Supabase propio del POS.
  SUPABASE_WEB_URL,
  SUPABASE_WEB_SERVICE_ROLE_KEY,
  // Notificación de cancelación al cliente (correo) — el POS NO tiene la
  // API key de Resend ni el template del correo, así que le pide a la
  // tienda que lo mande ella (POST /api/pos/notificar-cancelacion, mismo
  // SYNC_SECRET de siempre). Ver PUT /api/pos/pedidos-web/:id más abajo.
  TIENDA_NOTIFICAR_CANCELACION_URL
} = process.env;

/* PRIORIDAD 8 — sin defaults de PIN.
   ------------------------------------------------------------
   Antes ADMIN_PIN caía a '9067' y WORKER_PIN a '0495' si no estaban
   definidos: los mismos valores del .env.example versionado en git, o
   sea PINs públicos. Ahora, si faltan, se avisa fuerte y el login queda
   inutilizable (compararán contra undefined y siempre fallará), en vez
   de aceptar silenciosamente una clave conocida. */
if (!ADMIN_PIN || !WORKER_PIN) {
  console.error('[POS] FALTAN ADMIN_PIN o WORKER_PIN. Defínelos en las variables de entorno; ' +
                'el login no funcionará hasta configurarlos con valores propios.');
}
if (ADMIN_PIN === '9067' || WORKER_PIN === '0495') {
  console.error('[POS] ADMIN_PIN/WORKER_PIN son los valores de ejemplo del repositorio. ' +
                'Cámbialos: son públicos y cualquiera con el código los conoce.');
}

const TOKEN_TTL = '12h';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[POS] Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
}
if (!JWT_SECRET) {
  console.warn('[POS] Falta JWT_SECRET: define uno largo y aleatorio en producción.');
}
if (!SYNC_SECRET) {
  console.warn('[POS] Falta SYNC_SECRET: /api/interno/ajustar-stock rechazará todas las ' +
    'llamadas hasta configurarlo (mismo valor que en sevelin-tienda).');
}
if (!SUPABASE_WEB_URL || !SUPABASE_WEB_SERVICE_ROLE_KEY) {
  console.warn('[POS] Faltan SUPABASE_WEB_URL / SUPABASE_WEB_SERVICE_ROLE_KEY: el panel ' +
    'Pedidos Web no podrá consultarse hasta configurarlas.');
}

// El cliente service_role omite RLS, por eso solo puede existir en el servidor.
const db = createClient(SUPABASE_URL || 'http://localhost', SUPABASE_SERVICE_ROLE_KEY || 'sin-key', {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Segundo cliente Supabase — el proyecto Supabase WEB de sevelin-tienda, NO
// el de arriba. Primera vez que el POS habla con un Supabase que no es el
// suyo: se aísla en su propia constante (`dbWeb`) y solo se usa dentro de
// las rutas /api/pos/pedidos-web (más abajo), nunca mezclado con `db`.
const dbWeb = createClient(SUPABASE_WEB_URL || 'http://localhost', SUPABASE_WEB_SERVICE_ROLE_KEY || 'sin-key', {
  auth: { persistSession: false, autoRefreshToken: false }
});

/* ---------- Middlewares base ---------- */
/* PRIORIDAD 6 — CSP también en las respuestas de la API.
   ------------------------------------------------------------
   La CSP de vercel.json cubre los archivos estáticos (el HTML del POS),
   pero /api/* lo sirve Express, y antes helmet iba con la CSP apagada:
   esas respuestas salían sin ninguna política. Aunque la API devuelve
   JSON (no HTML que ejecute scripts), por defensa en profundidad se le
   pone una CSP mínima y estricta: nada de scripts, nada embebible.
   Es deliberadamente más cerrada que la del front porque una respuesta
   de API nunca necesita cargar recursos. */
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"]
    }
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
// 6 MB: los documentos de compras viajan en base64 dentro del JSON.
// (Vercel corta las peticiones sobre ~4.5 MB, por eso el front limita a 4 MB.)
app.use(express.json({ limit: '6mb' }));

const origenesPermitidos = CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);

/* PRIORIDAD 8 — CORS sin fallback a "*".
   ------------------------------------------------------------
   Antes, si CORS_ORIGINS no estaba definida o traía "*", se aceptaba
   cualquier origen. Un deploy sin la variable quedaba abierto de par en
   par. Ahora, si no hay orígenes configurados, en producción se deniega
   por defecto (la protección real sigue siendo el JWT, no CORS).

   Las peticiones sin cabecera Origin (curl, Postman, apps móviles) se
   siguen permitiendo: CORS no las cubre de todos modos, y el token es
   quien las autoriza o rechaza. */
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);                 // sin Origin: lo decide el JWT
    if (origenesPermitidos.includes(origin)) return cb(null, true);
    // "*" explícito sigue siendo válido SOLO si alguien lo pone a propósito
    if (origenesPermitidos.includes('*')) return cb(null, true);
    return cb(new Error('Origen no permitido por CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}));

/* ---------- Utilidades ---------- */
const num = v => Number(v) || 0;
const enviarError = (res, code, msg, extra) =>
  res.status(code).json({ error: msg, ...(extra || {}) });

/* PostgREST (la API REST de Supabase) puede rechazar la llave service_role
   con un error del tipo "JWT issued at future" — se vio justo después de
   rotarla en Supabase → Settings → API → Reset: al nuevo token le toma
   unos segundos propagarse a todos los nodos que lo validan, así que
   durante esa ventana algunos rechazan un token que en realidad es válido.
   Es transitorio y ajeno a nuestro JWT propio (auth() más abajo, que ya
   tiene su propio clockTolerance): reintentar la misma consulta un par de
   veces con una pausa corta alcanza para que se resuelva solo. */
const esperar = (ms) => new Promise(r => setTimeout(r, ms));
function esErrorJwtTransitorio(mensaje) {
  return /jwt/i.test(mensaje || '') && /(future|iat|clock)/i.test(mensaje || '');
}
async function consultarConReintento(construirQuery, intentos = 3, esperaMs = 400) {
  let ultimoError = null;
  for (let i = 0; i < intentos; i++) {
    const { data, error } = await construirQuery();
    if (!error) return { data, error: null };
    ultimoError = error;
    if (!esErrorJwtTransitorio(error.message) || i === intentos - 1) break;
    await esperar(esperaMs);
  }
  return { data: null, error: ultimoError };
}

const TIPOS_DTE = ['BOLETA', 'FACTURA', 'SIN DTE'];

/* Tope de filas por consulta.
   ------------------------------------------------------------
   Sin límite, un año de gastos o mermas llegaba entero al navegador en
   cada carga del módulo. 200 cubre de sobra un mes de trabajo y se puede
   subir con ?limite= cuando de verdad hace falta (una exportación).
   El tope duro de 2000 evita que un ?limite=999999 tumbe la respuesta. */
const LIMITE_POR_DEFECTO = 200;
const LIMITE_MAXIMO = 2000;

function limiteDe(req) {
  const pedido = parseInt(req.query?.limite, 10);
  if (!Number.isFinite(pedido) || pedido <= 0) return LIMITE_POR_DEFECTO;
  return Math.min(pedido, LIMITE_MAXIMO);
}


/* ============================================================
   COMISIÓN DEL POS TUU (HAULMER PRO 2)
   ------------------------------------------------------------
   Fórmula del contrato:  monto * 0,0079 + 65
   Solo aplica a las transacciones que pasan por el POS físico, es decir
   las tarjetas. Efectivo, Transferencia y "Por Pagar" no pagan comisión.

   Se calcula SIEMPRE en el servidor: si viniera del navegador, cualquiera
   podría alterar la utilidad neta editando el formulario.

   Si Tuu cambia la tarifa, se cambia acá y en js/config.js (el frontend la
   usa solo para previsualizar). Las ventas ya registradas conservan la
   comisión con la que se cobraron, porque queda guardada en la venta.
   ============================================================ */
const COMISION_POS_TASA = 0.0079;
const COMISION_POS_FIJO = 65;

// Métodos que pasan por el POS Tuu. Deben coincidir EXACTAMENTE con los
// <option> de index.html.
const METODOS_CON_COMISION = ['Tarjeta Débito', 'Tarjeta Crédito'];

function metodoPagaComision(metodo) {
  return METODOS_CON_COMISION.includes(String(metodo || '').trim());
}

/* Devuelve la comisión en pesos, redondeada (el peso chileno no tiene
   decimales). Una venta en $0 no paga el cargo fijo. */
function calcularComisionPos(metodo, total) {
  if (!metodoPagaComision(metodo)) return 0;
  const monto = num(total);
  if (monto <= 0) return 0;
  return Math.round(monto * COMISION_POS_TASA + COMISION_POS_FIJO);
}

/* Comisión de una venta pagada con VARIOS medios.
   ------------------------------------------------------------
   La comisión se cobra por transacción que pasa por la máquina, así que
   cada parte con tarjeta paga su propio cargo fijo de $65 más el 0,79%
   de SU monto. Si el cliente paga $12.000 en efectivo y $8.000 con
   débito, la comisión es solo sobre los $8.000.

   Cobrarla sobre el total de la venta sería inflar el gasto; ignorarla
   sería perderla. Por eso el desglose se guarda en venta_pagos. */
function comisionDePagos(pagos) {
  return (pagos || []).reduce((a, p) => a + calcularComisionPos(p.metodo, p.monto), 0);
}

/* Valida y normaliza el desglose que manda el POS. Devuelve null si no
   es un pago mixto legítimo, para caer al flujo de un solo medio. */
function normalizarPagos(lista, totalVenta) {
  if (!Array.isArray(lista) || lista.length < 2) return null;

  const pagos = lista
    .map(p => ({ metodo: String(p.metodo || '').trim(), monto: num(p.monto) }))
    .filter(p => p.metodo && p.monto > 0);

  if (pagos.length < 2) return null;

  /* La suma tiene que cuadrar con el total. Se tolera $1 de diferencia
     por redondeo al repartir montos; más que eso es un error de captura
     y la venta se rechaza en vez de guardar una caja descuadrada. */
  const suma = pagos.reduce((a, p) => a + p.monto, 0);
  if (Math.abs(suma - num(totalVenta)) > 1) {
    throw new Error(`El desglose de pagos suma ${suma} y la venta es ${totalVenta}`);
  }

  return pagos.map(p => ({ ...p, comision: calcularComisionPos(p.metodo, p.monto) }));
}

/* La comisión se cobra según cómo se pagó DE VERDAD: una venta que quedó
   "Por Pagar" y después se cobró con tarjeta sí paga comisión, y el método
   final es el que manda. */
function comisionDeVenta(venta) {
  if (!venta) return 0;
  const metodo = venta.metodo_pago_final || venta.metodo_pago;
  return calcularComisionPos(metodo, venta.total);
}

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

/* Fecha de hoy en Chile, en formato YYYY-MM-DD.
   No sirve `new Date().toISOString()`: después de las 20:00 de Chile ya
   es el día siguiente en UTC y el aporte quedaría con fecha equivocada. */
function fechaHoyChile() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

/* Suma n meses a una fecha 'YYYY-MM-DD' y devuelve otra 'YYYY-MM-DD'.
   Si el día no existe en el mes destino (ej. 31 de feb), cae al último día
   del mes. Se usa para repartir las cuotas mes a mes. */
function sumarMeses(fechaISO, n) {
  const [a, m, d] = fechaISO.split('-').map(Number);
  const base = new Date(Date.UTC(a, (m - 1) + n, 1));
  const anio = base.getUTCFullYear();
  const mes = base.getUTCMonth();
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const dia = Math.min(d, ultimoDia);
  return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
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
      /* Tolerancia de reloj (leeway) de 120s. jsonwebtoken compara `exp` y
         `nbf` contra el reloj del propio proceso que verifica; si ese
         reloj y el del proceso que firmó el token (otra instancia
         serverless, no siempre perfectamente sincronizada) difieren unos
         segundos, un token recién emitido puede parecer "ya vencido" y
         rechazarse con 401 aunque siga siendo válido. clockTolerance
         perdona esa diferencia sin dejar de expirar el token cuando
         corresponde: solo corre el margen, no lo desactiva. */
      req.usuario = jwt.verify(token, JWT_SECRET || 'dev-secret-cambiar', { clockTolerance: 120 });
    } catch (err) {
      /* El mensaje al cliente se deja genérico a propósito (no hay que
         revelarle a quien mande un token inválido si fue por vencimiento,
         firma incorrecta, etc.). Este log sí distingue la causa real
         (TokenExpiredError / JsonWebTokenError / NotBeforeError) en la
         consola del servidor, para poder diagnosticar sin adivinar la
         próxima vez que alguien reporte una sesión rechazada "sin motivo". */
      console.warn('[AUTH] token rechazado:', err.name, '-', err.message);
      return enviarError(res, 401, 'Sesión inválida o expirada');
    }
    if (requiereAdmin && req.usuario.rol !== 'admin') {
      return enviarError(res, 403, 'Esta acción es solo para el administrador');
    }
    next();
  };
}

/* Autenticación por secreto compartido (NO JWT): protege rutas llamadas por
   otro backend (sevelin-tienda), no por una persona logueada — mismo
   criterio que /api/sync/producto del lado tienda, que valida el header
   x-sync-secret contra su propia copia de SYNC_SECRET. Sin SYNC_SECRET
   configurado se rechaza todo por defecto, nunca se abre la ruta. */
function authSync(req, res, next) {
  if (!SYNC_SECRET) return enviarError(res, 401, 'Secreto de sincronización no configurado');
  if (req.headers['x-sync-secret'] !== SYNC_SECRET) {
    return enviarError(res, 401, 'Secreto de sincronización inválido');
  }
  next();
}

// Los trabajadores nunca reciben costos ni utilidades: se limpian en el servidor.
function limpiarParaRol(fila, rol) {
  if (!fila || rol === 'admin') return fila;
  // La comisión del POS es información de margen: se oculta igual que los costos
  const { costo_total, utilidad, costo_unitario, comision_pos, ...visible } = fila;
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

/* ============================================================
   VERIFICAR PIN — puerta de entrada a Finanzas (req. 1)
   ------------------------------------------------------------
   Finanzas exige el PIN de admin CADA vez que se entra, aunque la sesión
   ya esté abierta. Este endpoint solo valida el PIN; no emite token ni
   cambia la sesión. Reutiliza exigirPinAdmin, que ya trae el freno
   anti-fuerza-bruta (5 intentos → 1 min de espera).

   Se responde 200 solo si el PIN es correcto. El gate vive en el
   frontend, pero la validación es del servidor: el PIN nunca se compara
   en el navegador. */
app.post('/api/verificar-pin', auth(true), exigirPinAdmin, (req, res) => {
  res.json({ ok: true });
});

/* Ping simple + lista de módulos activos: si algún día vuelve a salir
   "Endpoint no encontrado" en un módulo, este endpoint sirve para
   confirmar rápido si el despliegue en Vercel quedó desactualizado. */
app.get('/api/health', (_req, res) => res.json({
  ok: true,
  servicio: 'sevelin-pos-api',
  version: '2026-08-04',
  modulos: ['productos', 'ventas', 'gastos', 'ot', 'repuestos', 'encargos', 'mermas', 'clasificaciones', 'balance', 'gastos-fijos', 'inyecciones', 'arqueos', 'reportes']
}));

/* ============================================================
   PRODUCTOS
   Lectura: admin y trabajador · Escritura: solo admin
   ============================================================ */
const CAMPOS_PRODUCTO = [
  'sku', 'codigo_barras', 'nombre', 'costo_unitario', 'precio_unitario', 'stock',
  'requiere_sn', 'peso_kg', 'alto_cm', 'ancho_cm', 'profundidad_cm', 'descripcion',
  'stock_minimo', 'alerta_stock', 'es_repuesto', 'stock_ilimitado', 'usa_lotes',
  // Controles de la tienda web (e-commerce Fase 0). imagen_urls NO va acá:
  // se administra aparte con POST /api/productos/:id/imagen (append/quitar
  // una foto a la vez), no reemplazando el arreglo completo en cada guardado.
  'publicado_web', 'precio_web', 'descripcion_web', 'categoria_web',
  // categoria_id (Fase "Página Web → Categorías"): FK interna del POS, no se
  // sincroniza a la tienda (el trigger solo usa categoria_web). stock_umbral_web:
  // NULL = usa el default de la tienda (+5); ver sql/23-categorias-web-y-umbral-stock.sql.
  'categoria_id', 'stock_umbral_web',
  // NOVEDAD/TENDENCIA/OFERTA — ver sql/28-etiqueta-web.sql.
  'etiqueta_web'
];

/* Normaliza el código de barras: SOLO dígitos.
   ------------------------------------------------------------
   Un código de barras es numérico por definición (EAN, UPC, ITF). La
   base tiene la cadena "null" y guiones sueltos por una importación mal
   mapeada, y eso rompía el escáner y la impresión de etiquetas —se llegó
   a imprimir un código que codificaba la palabra "null".

   Todo lo que no sea dígito se descarta; si no queda nada, se guarda
   NULL de verdad, no una cadena vacía. */
function limpiarCodigoBarras(valor) {
  if (valor === null || valor === undefined) return null;

  const texto = String(valor).trim();
  if (!texto) return null;

  const bajo = texto.toLowerCase();
  if (['null', 'undefined', 'nan', '-', 'n/a'].includes(bajo)) return null;

  const soloDigitos = texto.replace(/\D/g, '');
  return soloDigitos || null;
}

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
  /* usa_lotes solo cambia si el cliente lo manda explícitamente. Así una
     importación masiva o un PUT parcial jamás encienden los lotes por su
     cuenta: la única forma es el checkbox del modal de producto. */
  if (body.usa_lotes !== undefined) p.usa_lotes = !!body.usa_lotes;

  // Cada vez que se toca el stock queda registrada la fecha del cambio
  if (p.stock !== undefined) p.stock_actualizado_en = new Date().toISOString();
  ['sku', 'descripcion'].forEach(k => {
    if (p[k] !== undefined) {
      const t = String(p[k]).trim();
      // "null" como texto viene de importaciones mal mapeadas
      p[k] = (!t || ['null', 'undefined'].includes(t.toLowerCase())) ? null : t;
    }
  });

  // El código de barras se normaliza aparte: solo dígitos
  if (p.codigo_barras !== undefined) p.codigo_barras = limpiarCodigoBarras(p.codigo_barras);

  // --- Controles de la tienda web ---
  if (body.publicado_web !== undefined) p.publicado_web = !!body.publicado_web;
  // precio_web vacío/0 = NULL a propósito: "usa el precio normal del POS"
  // (ver sql/21-imagenes-web.sql). Un 0 real congelaría el producto gratis.
  if (p.precio_web !== undefined) {
    const v = num(p.precio_web);
    p.precio_web = v > 0 ? v : null;
  }
  ['descripcion_web', 'categoria_web'].forEach(k => {
    if (p[k] !== undefined) {
      const t = String(p[k]).trim();
      p[k] = (!t || ['null', 'undefined'].includes(t.toLowerCase())) ? null : t;
    }
  });
  if (p.categoria_id !== undefined) p.categoria_id = p.categoria_id || null;
  // Etiqueta destacada: solo una de las 3 opciones válidas o NULL — cualquier
  // otra cosa (manipulación directa del payload) se descarta en vez de
  // dejar que la base rechace todo el guardado por el check constraint.
  if (p.etiqueta_web !== undefined) {
    p.etiqueta_web = ['NOVEDAD', 'TENDENCIA', 'OFERTA'].includes(p.etiqueta_web) ? p.etiqueta_web : null;
  }
  // stock_umbral_web: NULL = usa el default de la tienda (+5). 0 o negativo
  // no tiene sentido como umbral (ver check de la migración 23) — se guarda
  // NULL en vez de dejar que la base rechace todo el guardado del producto.
  if (p.stock_umbral_web !== undefined) {
    const v = num(p.stock_umbral_web);
    p.stock_umbral_web = v >= 1 ? Math.round(v) : null;
  }

  return p;
}

/* Limpieza masiva del catálogo. Arregla de una vez los productos que ya
   tienen "null" o caracteres no numéricos en el código de barras, sin
   tener que editarlos uno por uno. */
app.post('/api/productos/limpiar-codigos', auth(true), exigirPinAdmin, async (req, res) => {
  const { data, error } = await db.from('productos').select('id, sku, codigo_barras');
  if (error) return enviarError(res, 500, error.message);

  const cambios = [];
  (data || []).forEach(p => {
    const barrasLimpio = limpiarCodigoBarras(p.codigo_barras);
    const skuActual = p.sku === null ? null : String(p.sku).trim();
    const skuLimpio = (!skuActual || ['null', 'undefined'].includes(skuActual.toLowerCase()))
      ? null : skuActual;

    if (barrasLimpio !== p.codigo_barras || skuLimpio !== p.sku) {
      cambios.push({ id: p.id, codigo_barras: barrasLimpio, sku: skuLimpio });
    }
  });

  let corregidos = 0;
  for (const c of cambios) {
    const { error: e } = await db.from('productos')
      .update({ codigo_barras: c.codigo_barras, sku: c.sku }).eq('id', c.id);
    if (!e) corregidos++;
  }

  res.json({ revisados: (data || []).length, corregidos });
});

app.get('/api/productos', auth(), async (req, res) => {
  const { data, error } = await db.from('productos').select('*').order('nombre', { ascending: true });
  if (error) return enviarError(res, 500, error.message);
  res.json(limpiarLista(data, req.usuario.rol));
});

/* ============================================================
   CATEGORÍAS DEL CATÁLOGO WEB (módulo "Página Web → Categorías")
   ------------------------------------------------------------
   Distinto de repuesto_categorias (taller): esta tabla agrupa productos
   de la tienda online, con orden manual (los repuestos se ordenan
   alfabético, sin ese concepto). El nombre elegido se sigue guardando en
   productos.categoria_web (texto, ver CAMPOS_PRODUCTO) — categoria_id es
   solo la fuente en el modal, no viaja a la tienda.
   Ver: admin y trabajador (autocompletado del filtro) · Escribir: solo admin
   ============================================================ */
app.get('/api/productos/categorias', auth(), async (req, res) => {
  const { data, error } = await db.from('producto_categorias')
    .select('*').order('orden', { ascending: true }).order('nombre', { ascending: true });
  if (error) return enviarError(res, 500, error.message);
  res.json(data || []);
});

app.post('/api/productos/categorias', auth(true), async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  if (!nombre) return enviarError(res, 400, 'Escribe un nombre');
  const parentId = req.body?.parent_id || null;

  // Se limita a 2 niveles a propósito (categoría → subcategoría, sin
  // nietos): más profundidad no aporta y complica el select del modal.
  if (parentId) {
    const { data: padre, error: errPadre } = await db.from('producto_categorias')
      .select('id, parent_id').eq('id', parentId).maybeSingle();
    if (errPadre || !padre) return enviarError(res, 404, 'No se encontró la categoría padre');
    if (padre.parent_id) return enviarError(res, 400, 'No se pueden crear subcategorías de una subcategoría');
  }

  // El orden es por grupo de hermanos (mismo padre, o todos los de nivel
  // superior si parentId es null) — no un contador global.
  let query = db.from('producto_categorias').select('orden').order('orden', { ascending: false }).limit(1);
  query = parentId ? query.eq('parent_id', parentId) : query.is('parent_id', null);
  const { data: maxOrden } = await query.maybeSingle();
  const siguienteOrden = (maxOrden?.orden ?? -1) + 1;

  const { data, error } = await db.from('producto_categorias')
    .insert([{ nombre, orden: siguienteOrden, parent_id: parentId }]).select().single();
  if (error) {
    const duplicado = /duplicate|unique/i.test(error.message);
    return enviarError(res, duplicado ? 409 : 500, duplicado ? 'Esa categoría ya existe' : error.message);
  }
  res.status(201).json(data);
});

app.put('/api/productos/categorias/:id', auth(true), async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  if (!nombre) return enviarError(res, 400, 'Escribe un nombre');

  const { data, error } = await db.from('producto_categorias')
    .update({ nombre }).eq('id', req.params.id).select().single();
  if (error) {
    const duplicado = /duplicate|unique/i.test(error.message);
    if (/no rows/i.test(error.message)) return enviarError(res, 404, 'No se encontró esa categoría');
    return enviarError(res, duplicado ? 409 : 500, duplicado ? 'Ya existe otra categoría con ese nombre' : error.message);
  }
  res.json(data);
});

// Sube/baja una categoría intercambiando su `orden` con la vecina —
// más simple que un batch de reordenamiento para dos botones ▲▼. Solo
// compite con sus HERMANOS (mismo parent_id): una subcategoría nunca se
// reordena contra una categoría de nivel superior.
app.put('/api/productos/categorias/:id/mover', auth(true), async (req, res) => {
  const direccion = req.body?.direccion === 'arriba' ? 'arriba' : 'abajo';

  const { data: actualFila, error: errActual } = await db.from('producto_categorias')
    .select('id, parent_id').eq('id', req.params.id).maybeSingle();
  if (errActual || !actualFila) return enviarError(res, 404, 'No se encontró esa categoría');

  let queryHermanos = db.from('producto_categorias')
    .select('id, orden').order('orden', { ascending: true }).order('nombre', { ascending: true });
  queryHermanos = actualFila.parent_id
    ? queryHermanos.eq('parent_id', actualFila.parent_id)
    : queryHermanos.is('parent_id', null);
  const { data: lista, error: errLista } = await queryHermanos;
  if (errLista) return enviarError(res, 500, errLista.message);

  const idx = (lista || []).findIndex(c => String(c.id) === String(req.params.id));
  if (idx === -1) return enviarError(res, 404, 'No se encontró esa categoría');

  const idxVecino = direccion === 'arriba' ? idx - 1 : idx + 1;
  if (idxVecino < 0 || idxVecino >= lista.length) return res.json({ ok: true }); // ya está en el extremo

  const actual = lista[idx];
  const vecino = lista[idxVecino];

  const { error: err1 } = await db.from('producto_categorias').update({ orden: vecino.orden }).eq('id', actual.id);
  const { error: err2 } = await db.from('producto_categorias').update({ orden: actual.orden }).eq('id', vecino.id);
  if (err1 || err2) return enviarError(res, 500, (err1 || err2).message);

  res.json({ ok: true });
});

app.delete('/api/productos/categorias/:id', auth(true), async (req, res) => {
  const { error } = await db.from('producto_categorias').delete().eq('id', req.params.id);
  if (error) return enviarError(res, 500, error.message);
  res.json({ ok: true });
});

/* ============================================================
   VALIDACIÓN DE DUPLICADOS
   ------------------------------------------------------------
   Se hace en el SERVIDOR y no solo en la interfaz: el aviso del
   navegador solo mira `productsList`, que puede estar desactualizado si
   otra caja creó el producto hace un minuto. Acá se consulta la base.

   La comparación de NOMBRE es case-insensitive y sin espacios de sobra:
   "Cable HDMI " y "cable hdmi" son el mismo producto para cualquiera que
   mire el catálogo, aunque para Postgres sean distintos.

   SKU y código de barras se comparan exactos, porque distinguen
   mayúsculas por diseño (un SKU "AB-1" y "ab-1" pueden ser dos cosas).

   `idExcluir` permite editar un producto sin que choque consigo mismo.
   ============================================================ */
async function buscarDuplicado(datos, idExcluir = null) {
  const sku = codigoUtil(datos.sku);
  const barras = codigoUtil(datos.codigo_barras);
  const nombre = String(datos.nombre || '').trim();

  const distinto = (fila) => !idExcluir || String(fila.id) !== String(idExcluir);

  if (sku) {
    const { data } = await db.from('productos').select('id, nombre, sku').eq('sku', sku).limit(5);
    const choque = (data || []).find(distinto);
    if (choque) return { campo: 'SKU', valor: sku, existente: choque };
  }

  if (barras) {
    const { data } = await db.from('productos').select('id, nombre, codigo_barras')
      .eq('codigo_barras', barras).limit(5);
    const choque = (data || []).find(distinto);
    if (choque) return { campo: 'Código de barras', valor: barras, existente: choque };
  }

  if (nombre) {
    // ilike sin comodines = igualdad sin distinguir mayúsculas
    const { data } = await db.from('productos').select('id, nombre').ilike('nombre', nombre).limit(5);
    const choque = (data || []).find(distinto);
    if (choque) return { campo: 'Nombre', valor: nombre, existente: choque };
  }

  return null;
}

/* Descarta valores que no son códigos reales. La base tiene productos con
   la CADENA "null" por una importación mal mapeada, y sin este filtro
   todos ellos chocarían entre sí. */
function codigoUtil(valor) {
  if (valor === null || valor === undefined) return null;
  const t = String(valor).trim();
  if (!t) return null;
  const bajo = t.toLowerCase();
  if (['null', 'undefined', 'nan', '-'].includes(bajo)) return null;
  return t;
}

function errorDuplicado(dup) {
  return `Ya existe un producto con ese ${dup.campo}: "${dup.existente.nombre}". ` +
         `El ${dup.campo} "${dup.valor}" no se puede repetir.`;
}

app.post('/api/productos', auth(true), async (req, res) => {
  const producto = sanearProducto(req.body);
  if (!producto) return enviarError(res, 400, 'El nombre del producto es obligatorio');

  // Se cancela el guardado si choca con algo existente
  const dup = await buscarDuplicado(producto);
  if (dup) return enviarError(res, 409, errorDuplicado(dup), { duplicado: dup });

  const { data, error } = await db.from('productos').insert([producto]).select().single();
  if (error) return enviarError(res, 500, error.message);
  res.status(201).json(data);
});

/* Importación masiva (CSV / Excel de Tiendanube)
   ------------------------------------------------------------
   Exige reconfirmar el PIN de administrador: es una operación que puede
   reescribir el catálogo entero, así que se trata igual que un borrado
   masivo. El PIN se valida en el servidor, no en el navegador.

   Dos modos, elegidos por el usuario ANTES de procesar el archivo:
     · 'omitir'     → si el SKU o el código de barras ya existe, la fila se
                      ignora por completo. No se toca ni un dato ni el stock.
     · 'actualizar' → si ya existe, se sobrescriben todos los datos y el
                      stock con lo que trae el archivo.
   En ambos modos, las filas que no coinciden con nada se insertan nuevas.

   usa_lotes NUNCA se toca aquí: sanearProducto solo lo escribe si viene en
   el body, y el importador no lo manda. Un producto con lotes activos
   sigue con lotes activos después de importar. */
const MODOS_IMPORTACION = ['omitir', 'actualizar'];

app.post('/api/productos/bulk', auth(true), exigirPinAdmin, async (req, res) => {
  const modo = String(req.body?.modo || 'omitir').trim().toLowerCase();
  if (!MODOS_IMPORTACION.includes(modo)) {
    return enviarError(res, 400, 'Modo de importación no válido (usa "omitir" o "actualizar")');
  }

  const lista = Array.isArray(req.body?.productos) ? req.body.productos : [];
  const productos = lista.map(sanearProducto).filter(Boolean);
  if (productos.length === 0) return enviarError(res, 400, 'No hay productos válidos para importar');

  // Claves del archivo, para buscar coincidencias en una sola consulta
  const skus = [...new Set(productos.map(p => p.sku).filter(Boolean))];
  const barras = [...new Set(productos.map(p => p.codigo_barras).filter(Boolean))];

  const existentesPorSku = new Map();
  const existentesPorBarra = new Map();

  if (skus.length) {
    const { data } = await db.from('productos').select('id, sku').in('sku', skus);
    (data || []).forEach(p => { if (p.sku) existentesPorSku.set(String(p.sku).trim(), p.id); });
  }
  if (barras.length) {
    const { data } = await db.from('productos').select('id, codigo_barras').in('codigo_barras', barras);
    (data || []).forEach(p => { if (p.codigo_barras) existentesPorBarra.set(String(p.codigo_barras).trim(), p.id); });
  }

  // El SKU manda sobre el código de barras cuando ambos coinciden con
  // productos distintos: es la clave que el usuario controla a mano.
  const idExistente = (p) =>
    (p.sku && existentesPorSku.get(String(p.sku).trim())) ||
    (p.codigo_barras && existentesPorBarra.get(String(p.codigo_barras).trim())) ||
    null;

  /* El nombre también cuenta como duplicado en la importación: un CSV
     puede traer el mismo producto con SKU nuevo, y sin este chequeo
     entraría repetido al catálogo. */
  const nombres = [...new Set(productos.map(p => (p.nombre || '').trim().toLowerCase()).filter(Boolean))];
  const existentesPorNombre = new Map();
  if (nombres.length) {
    const { data } = await db.from('productos').select('id, nombre');
    (data || []).forEach(p => {
      const k = (p.nombre || '').trim().toLowerCase();
      if (k) existentesPorNombre.set(k, p.id);
    });
  }

  const nuevos = [];
  const aActualizar = [];
  let omitidos = 0;

  for (const p of productos) {
    const id = idExistente(p) || existentesPorNombre.get((p.nombre || '').trim().toLowerCase());
    if (!id) { nuevos.push(p); continue; }
    if (modo === 'omitir') { omitidos++; continue; }
    aActualizar.push({ id, datos: p });
  }

  const resultado = { creados: 0, actualizados: 0, omitidos, errores: [] };

  if (nuevos.length) {
    const { error } = await db.from('productos').insert(nuevos);
    if (error) return enviarError(res, 500, error.message);
    resultado.creados = nuevos.length;
  }

  /* Los updates van uno a uno a propósito: un upsert masivo necesitaría un
     índice único sobre sku/codigo_barras que hoy no existe, y crearlo
     rompería los catálogos que tienen SKU repetidos o vacíos. */
  for (const { id, datos } of aActualizar) {
    const { error } = await db.from('productos').update(datos).eq('id', id);
    if (error) resultado.errores.push(`${datos.nombre}: ${error.message}`);
    else resultado.actualizados++;
  }

  // Se mantiene "importados" por compatibilidad con la versión anterior
  resultado.importados = resultado.creados + resultado.actualizados;
  res.status(201).json(resultado);
});

/* Búsqueda por código para el escáner de cámara.
   Se consulta indistintamente por código de barras, SKU y número de serie.
   El S/N no vive en el catálogo sino en venta_items (es de la unidad, no
   del modelo), así que se busca allí y se devuelve el producto asociado.
   Orden de prioridad: código de barras → SKU → S/N. */
app.get('/api/productos/buscar', auth(), async (req, res) => {
  const codigo = String(req.query?.codigo || '').trim();
  if (!codigo) return enviarError(res, 400, 'Falta el código a buscar');

  const responder = (producto, origen) => {
    if (!producto) return null;
    return res.json({ ...limpiarParaRol(producto, req.usuario.rol), _origen: origen });
  };

  // 1) Código de barras (lo habitual al escanear)
  const { data: porBarra } = await db.from('productos').select('*').eq('codigo_barras', codigo).limit(1);
  if (porBarra && porBarra[0]) return responder(porBarra[0], 'codigo_barras');

  // 2) SKU
  const { data: porSku } = await db.from('productos').select('*').eq('sku', codigo).limit(1);
  if (porSku && porSku[0]) return responder(porSku[0], 'sku');

  // 3) Número de serie de una unidad ya vendida
  const { data: porSerie } = await db.from('venta_items')
    .select('producto_id, nombre, serial_number')
    .eq('serial_number', codigo)
    .not('producto_id', 'is', null)
    .order('id', { ascending: false })
    .limit(1);

  if (porSerie && porSerie[0]?.producto_id) {
    const { data: prod } = await db.from('productos').select('*').eq('id', porSerie[0].producto_id).maybeSingle();
    if (prod) return responder(prod, 'serial_number');
  }

  return enviarError(res, 404, 'No se encontró ningún producto con ese código');
});

/* ============================================================
   LOTES DE COSTO (PEPS / FIFO)
   Solo administrador: los costos no se exponen a trabajadores.
   ============================================================ */

// Capas vigentes de un producto, en el mismo orden en que las consume el FIFO
/* ============================================================
   RESUMEN DE CAPAS FIFO — UNA SOLA CONSULTA
   ------------------------------------------------------------
   RENDIMIENTO. La tabla de productos llamaba a /productos/:id/lotes una
   vez por cada producto con `usa_lotes = true`. Con 30 productos así
   eran 30 peticiones HTTP (en paralelo, pero 30 conexiones y 30
   consultas) cada vez que se entraba al módulo Productos.

   Acá se traen todas de golpe y se agrupan por producto. Se descartan
   las capas agotadas: la tabla solo muestra las vigentes, y las
   agotadas no se borran nunca (para poder devolver stock al anular una
   venta), así que con el tiempo son la mayoría de las filas.
   ============================================================ */
app.get('/api/productos/lotes-resumen', auth(true), async (req, res) => {
  const { data, error } = await db.from('producto_lotes')
    .select('id, producto_id, cantidad, cantidad_inicial, costo_unitario, referencia, creado_en')
    .is('agotado_en', null)
    .gt('cantidad', 0)
    .order('creado_en', { ascending: true })   // orden FIFO: la más antigua primero
    .limit(5000);

  if (error) return enviarError(res, 500, error.message);

  const porProducto = {};
  (data || []).forEach(l => {
    (porProducto[l.producto_id] = porProducto[l.producto_id] || []).push(l);
  });
  res.json(porProducto);
});

app.get('/api/productos/:id/lotes', auth(true), async (req, res) => {
  const { data, error } = await db.from('producto_lotes')
    .select('*')
    .eq('producto_id', req.params.id)
    .is('agotado_en', null)
    .gt('cantidad', 0)
    .order('creado_en', { ascending: true })
    .order('id', { ascending: true });

  if (error) return enviarError(res, 500, error.message);
  res.json(data || []);
});

/* Auditoría de envío (Fase 0, punto 0.6 del e-commerce) — SOLO diagnostica,
   no corrige nada. `productos` no tiene columna `activo` (no hay soft-delete:
   se borra la fila con DELETE /api/productos/:id), así que "activo" acá es
   "existe en el catálogo". Se excluyen los productos con stock_ilimitado
   (servicios/mano de obra: nunca se despachan, no necesitan peso ni medidas).
   Es de solo lectura y temporal: no la usa ningún flujo real todavía. */
app.get('/api/productos/auditoria-envio', auth(true), async (req, res) => {
  const { data, error } = await db.from('productos')
    .select('id, nombre, sku, peso_kg, alto_cm, ancho_cm, profundidad_cm')
    .eq('stock_ilimitado', false);
  if (error) return enviarError(res, 500, error.message);

  const productos = data || [];
  const sinDatos = productos.filter(p =>
    !(num(p.peso_kg) > 0) || !(num(p.alto_cm) > 0) ||
    !(num(p.ancho_cm) > 0) || !(num(p.profundidad_cm) > 0));

  res.json({
    totalProductos: productos.length,
    totalSinDatosDeEnvio: sinDatos.length,
    porcentaje: productos.length ? Math.round((sinDatos.length / productos.length) * 1000) / 10 : 0,
    productos: sinDatos.map(p => ({
      id: p.id, nombre: p.nombre, sku: p.sku,
      peso_kg: num(p.peso_kg), alto_cm: num(p.alto_cm),
      ancho_cm: num(p.ancho_cm), profundidad_cm: num(p.profundidad_cm)
    }))
  });
});

/* Carga una capa nueva. El stock del producto sube en la misma operación:
   productos.stock sigue siendo el número que se muestra en pantalla y el
   que usan las alertas de bajo stock; los lotes solo explican su costo. */
app.post('/api/productos/:id/lotes', auth(true), async (req, res) => {
  const productoId = Number(req.params.id);
  const cantidad = num(req.body?.cantidad);
  const costo = num(req.body?.costo_unitario);

  if (cantidad <= 0) return enviarError(res, 400, 'La cantidad del lote debe ser mayor a 0');

  const { data: producto } = await db.from('productos').select('id, stock, usa_lotes').eq('id', productoId).maybeSingle();
  if (!producto) return enviarError(res, 404, 'Producto no encontrado');
  if (!producto.usa_lotes) {
    return enviarError(res, 400, 'Este producto no tiene los lotes habilitados. Actívalos primero en el modal de producto.');
  }

  const { data: lote, error } = await db.from('producto_lotes').insert([{
    producto_id: productoId,
    cantidad,
    cantidad_inicial: cantidad,
    costo_unitario: costo,
    referencia: (req.body?.referencia || '').trim() || null
  }]).select().single();

  if (error) return enviarError(res, 500, error.message);

  await db.from('productos')
    .update({ stock: num(producto.stock) + cantidad, stock_actualizado_en: new Date().toISOString() })
    .eq('id', productoId);

  res.status(201).json(lote);
});

/* Elimina una capa completa (corrección de una carga mal hecha) y le resta
   al producto el stock que esa capa tenía vivo. */
app.delete('/api/productos/:id/lotes/:loteId', auth(true), async (req, res) => {
  const { data: lote } = await db.from('producto_lotes')
    .select('*').eq('id', req.params.loteId).eq('producto_id', req.params.id).maybeSingle();

  if (!lote) return enviarError(res, 404, 'Lote no encontrado');

  const { error } = await db.from('producto_lotes').delete().eq('id', lote.id);
  if (error) return enviarError(res, 500, error.message);

  const { data: producto } = await db.from('productos').select('stock').eq('id', req.params.id).maybeSingle();
  if (producto) {
    await db.from('productos')
      .update({
        stock: Math.max(0, num(producto.stock) - num(lote.cantidad)),
        stock_actualizado_en: new Date().toISOString()
      })
      .eq('id', req.params.id);
  }

  res.json({ ok: true, unidades_retiradas: num(lote.cantidad) });
});

app.put('/api/productos/:id', auth(true), async (req, res) => {
  const producto = sanearProducto(req.body);
  if (!producto) return enviarError(res, 400, 'El nombre del producto es obligatorio');

  // Al editar se excluye el propio registro: no puede chocar consigo mismo
  const dup = await buscarDuplicado(producto, req.params.id);
  if (dup) return enviarError(res, 409, errorDuplicado(dup), { duplicado: dup });

  const { data, error } = await db.from('productos').update(producto).eq('id', req.params.id).select().single();
  if (error) return enviarError(res, 500, error.message);
  res.json(data);
});

const BUCKET_IMAGENES_PRODUCTO = 'productos-imagenes';
const MAX_BYTES_IMAGEN_PRODUCTO = 1 * 1024 * 1024; // el Canvas del front apunta a ~100-150KB; 1MB es margen generoso

/* Sube una foto ya procesada por el Canvas del front (1000x1000, webp) al
   bucket público `productos-imagenes` (ver docs/README-BUCKET-IMAGENES.md)
   y la agrega a productos.imagen_urls. El navegador nunca ve la llave de
   Supabase: solo manda el webp en base64 y el backend sube con
   service_role, igual que /api/compras/archivo con compras-documentos. */
app.post('/api/productos/:id/imagen', auth(true), async (req, res) => {
  try {
    const base64 = req.body?.imagen_base64;
    if (!base64) return enviarError(res, 400, 'Falta la imagen');

    const { data: producto } = await db.from('productos')
      .select('id, imagen_urls').eq('id', req.params.id).maybeSingle();
    if (!producto) return enviarError(res, 404, 'Producto no encontrado');

    const contenido = String(base64).includes(',') ? String(base64).split(',')[1] : String(base64);
    const buffer = Buffer.from(contenido, 'base64');
    if (buffer.length > MAX_BYTES_IMAGEN_PRODUCTO) {
      return enviarError(res, 413, 'La imagen supera 1 MB. El navegador debería haberla comprimido antes de subirla.');
    }

    // Ruta no enumerable (mismo criterio FILE-01 que compras-documentos):
    // un UUID aleatorio en vez del id de producto + timestamp.
    const ruta = `${req.params.id}/${crypto.randomUUID()}.webp`;

    const { error: errSubida } = await db.storage.from(BUCKET_IMAGENES_PRODUCTO)
      .upload(ruta, buffer, { contentType: 'image/webp', upsert: false });
    if (errSubida) throw new Error(errSubida.message);

    // Bucket público a propósito (ver README-ECOMMERCE-SEVELIN.md sección
    // 4.1): la tienda sirve la foto directo al navegador del cliente, sin
    // pasar por ningún backend.
    const { data: pub } = db.storage.from(BUCKET_IMAGENES_PRODUCTO).getPublicUrl(ruta);
    const url = pub.publicUrl;

    const imagenUrls = [...(producto.imagen_urls || []), url];
    const { data, error } = await db.from('productos')
      .update({ imagen_urls: imagenUrls }).eq('id', req.params.id).select('id, imagen_urls').single();
    if (error) throw new Error(error.message);

    res.status(201).json(data);
  } catch (err) {
    enviarError(res, 500, err.message || 'No se pudo subir la imagen');
  }
});

// Sube/baja una foto intercambiando su posición con la vecina en
// imagen_urls — la primera posición es la que usa la tienda como foto
// principal de catálogo (ver tarjeta-producto.tsx, imagen_urls[0]).
app.put('/api/productos/:id/imagen/orden', auth(true), async (req, res) => {
  const url = String(req.body?.url || '').trim();
  const direccion = req.body?.direccion === 'arriba' ? 'arriba' : 'abajo';
  if (!url) return enviarError(res, 400, 'Falta la url de la imagen a mover');

  const { data: producto } = await db.from('productos')
    .select('id, imagen_urls').eq('id', req.params.id).maybeSingle();
  if (!producto) return enviarError(res, 404, 'Producto no encontrado');

  const lista = [...(producto.imagen_urls || [])];
  const idx = lista.indexOf(url);
  if (idx === -1) return enviarError(res, 404, 'Esa foto ya no está en el producto');

  const idxVecino = direccion === 'arriba' ? idx - 1 : idx + 1;
  if (idxVecino < 0 || idxVecino >= lista.length) return res.json({ id: producto.id, imagen_urls: lista }); // ya está en el extremo

  [lista[idx], lista[idxVecino]] = [lista[idxVecino], lista[idx]];

  const { data, error } = await db.from('productos')
    .update({ imagen_urls: lista }).eq('id', req.params.id).select('id, imagen_urls').single();
  if (error) return enviarError(res, 500, error.message);
  res.json(data);
});

// Quita una foto ya subida: la borra del bucket y del arreglo del producto.
app.delete('/api/productos/:id/imagen', auth(true), async (req, res) => {
  const url = String(req.body?.url || '').trim();
  if (!url) return enviarError(res, 400, 'Falta la url de la imagen a quitar');

  const { data: producto } = await db.from('productos')
    .select('id, imagen_urls').eq('id', req.params.id).maybeSingle();
  if (!producto) return enviarError(res, 404, 'Producto no encontrado');

  const imagenUrls = (producto.imagen_urls || []).filter(u => u !== url);

  // La ruta dentro del bucket es todo lo que sigue después del nombre del
  // bucket en la URL pública; si no matchea (url externa/antigua) igual se
  // quita del arreglo, pero no se intenta borrar nada del storage.
  const marca = `/${BUCKET_IMAGENES_PRODUCTO}/`;
  const idx = url.indexOf(marca);
  if (idx !== -1) {
    const ruta = url.slice(idx + marca.length);
    await db.storage.from(BUCKET_IMAGENES_PRODUCTO).remove([ruta]);
  }

  const { data, error } = await db.from('productos')
    .update({ imagen_urls: imagenUrls }).eq('id', req.params.id).select('id, imagen_urls').single();
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

/* BIZ-02 — CHEQUEO + DESCUENTO DE STOCK ATÓMICOS (productos sin lotes).
   ------------------------------------------------------------
   Antes esto eran dos pasos separados en el tiempo: se leía el stock y
   se comparaba contra lo pedido (verificarStockDisponible), y más abajo,
   ya con la venta insertada, ajustarStock() volvía a leer y a escribir.
   Entre esos dos pasos había una ventana: dos cajas vendiendo el mismo
   producto al mismo tiempo podían pasar AMBAS la validación (cada una ve
   stock=3, pide 2) y las dos descontar — el stock terminaba en -1 aunque
   el chequeo "aprobó" las dos ventas.

   Ahora el chequeo y el descuento pasan en una sola llamada a la base
   (mismo enfoque que ya usa fifo_consumir para productos con lotes, ver
   sql/09-lotes-fifo-comision.sql): la función SQL descontar_stock_venta
   (sql/19-stock-atomico.sql) bloquea cada fila de producto con
   SELECT ... FOR UPDATE, compara el stock real y descuenta dentro de la
   MISMA transacción. Si algún producto no alcanza, lanza una excepción y
   Postgres deshace todo lo que esa llamada ya había descontado: la venta
   se acepta o se rechaza como un bloque, nunca a medias.

   Reglas (las mismas que antes, ahora aplicadas dentro de la función SQL):
     · stock_ilimitado (servicios, mano de obra) → nunca se valida.
     · productos con lotes → los valida fifo_consumir de forma atómica
       más adelante; aquí NO se tocan para no duplicar el chequeo.
     · repuestos ya reservados en una OT (ot_repuesto_id) → su stock se
       descontó al asociarlos a la OT; se omiten.
     · el resto → se suma la cantidad pedida por producto (dos líneas del
       mismo producto cuentan juntas) y se compara con el stock real.

   Devuelve el Set de producto_id que la función SQL ya descontó, para
   que ajustarStock() no los vuelva a tocar más abajo (mismo patrón que
   la marca item._fifo de aplicarCostosFifo). */
async function descontarStockNoLotes(items) {
  const lista = Array.isArray(items) ? items : [];

  // Solo productos por id, no reservados en OT. Se agrupa por producto
  // porque el carrito puede traer el mismo ítem en varias líneas;
  // validarlas por separado dejaría pasar 2+2 contra un stock de 3.
  const pedidoPorProducto = new Map();
  for (const it of lista) {
    if (!it.producto_id || it.ot_repuesto_id) continue;
    const n = num(it.cantidad) || 1;
    pedidoPorProducto.set(it.producto_id, (pedidoPorProducto.get(it.producto_id) || 0) + n);
  }
  if (pedidoPorProducto.size === 0) return new Set();

  const p_items = [...pedidoPorProducto.entries()]
    .map(([producto_id, cantidad]) => ({ producto_id, cantidad }));

  const { data, error } = await db.rpc('descontar_stock_venta', { p_items });
  if (error) throw new Error(error.message);

  // Solo quedan en la respuesta los producto_id que la función realmente
  // descontó (existen, no son ilimitados y no usan lotes).
  return new Set((data || []).map(r => r.producto_id));
}

/* Normaliza los campos de despacho de una venta (migración 17).
   Retiro en tienda → estado_envio 'entregado' (no hay nada que despachar).
   Envío → 'pendiente', con dirección y notas. */
function construirDatosEnvio(body) {
  const tipo = String(body?.tipo_entrega || 'retiro').trim().toLowerCase();
  if (tipo === 'despacho') {
    return {
      tipo_entrega: 'despacho',
      direccion_envio: (body?.direccion_envio || '').trim() || null,
      notas_despacho: (body?.notas_despacho || '').trim() || null,
      estado_envio: 'pendiente'
    };
  }
  return {
    tipo_entrega: 'retiro',
    direccion_envio: null,
    notas_despacho: null,
    estado_envio: 'entregado'
  };
}

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

    /* BIZ-01 — PRECIO Y COSTO NO PUEDEN SER NEGATIVOS.
       ------------------------------------------------------------
       Antes se aceptaba cualquier número. Una línea con precio -9000
       bajaba el total de la venta: se podía cobrar de menos y cuadrar
       un arqueo con un "descuento" falso. Los descuentos, si se
       necesitan, se modelan aparte; una línea de venta jamás resta.
       Se rechaza en el SERVIDOR: el navegador es manipulable. */
    const precioCrudo = num(it.precio_unitario);
    if (precioCrudo < 0) {
      throw new Error(`Precio inválido en "${String(it.nombre || 'ítem').slice(0, 40)}": no puede ser negativo`);
    }
    const costoCrudo = num(it.costo_unitario);
    if (costoCrudo < 0) {
      throw new Error(`Costo inválido en "${String(it.nombre || 'ítem').slice(0, 40)}": no puede ser negativo`);
    }

    const precio = precioCrudo;
    const costoCliente = costoCrudo;
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
      // Marca libre del vendedor, independiente de si el ítem está en el
      // catálogo o se escribió a mano — separa en Finanzas cuánto se
      // vendió en productos vs. en servicios (ver migración 26).
      es_servicio: !!it.es_servicio,
      cantidad,
      costo_unitario: costo,
      precio_unitario: precio,
      subtotal: precio * cantidad,
      serial_number: it.serial_number || null
    };
  });
}

/* ============================================================
   COSTEO POR CAPAS (PEPS / FIFO)
   ------------------------------------------------------------
   Se ejecuta ANTES de totalizar, porque el costo real de la venta depende
   de qué capas se consuman: no se puede calcular la utilidad primero y
   descontar el stock después.

   Para cada ítem de un producto con usa_lotes = true:
     1. Pide a la base que consuma la cantidad por PEPS (función atómica
        fifo_consumir, que bloquea las capas mientras reparte).
     2. Reemplaza costo_unitario por el promedio ponderado de lo consumido.
        Ejemplo: 8 unidades = 5 del lote a $2.000 + 3 del lote a $2.200
                 → costo unitario de la línea = $2.075.
     3. Devuelve el detalle capa por capa para guardarlo en venta_item_lotes.
     4. Descuenta productos.stock (la función SQL solo toca las capas).

   Los ítems que NO usan lotes salen intactos y los sigue manejando
   ajustarStock() como siempre.
   ============================================================ */
async function aplicarCostosFifo(items) {
  const lista = items || [];
  const ids = [...new Set(lista.map(i => i.producto_id).filter(Boolean))];
  if (ids.length === 0) return { items: lista, consumos: [] };

  const { data: productos } = await db
    .from('productos')
    .select('id, stock, usa_lotes, stock_ilimitado')
    .in('id', ids);

  const conLotes = new Map();
  (productos || []).forEach(p => { if (p.usa_lotes && !p.stock_ilimitado) conLotes.set(p.id, p); });
  if (conLotes.size === 0) return { items: lista, consumos: [] };

  const consumos = [];   // { indiceItem, capas: [...] }

  for (let i = 0; i < lista.length; i++) {
    const item = lista[i];
    const producto = item.producto_id ? conLotes.get(item.producto_id) : null;
    if (!producto) continue;

    const { data: capas, error } = await db.rpc('fifo_consumir', {
      p_producto_id: producto.id,
      p_cantidad: num(item.cantidad)
    });

    if (error) {
      // Sin la migración 09 la función no existe: se cae al costo del
      // catálogo en vez de bloquear la venta en caja.
      console.error('[FIFO] fifo_consumir falló:', error.message);
      continue;
    }

    const detalle = capas || [];
    const unidades = detalle.reduce((a, c) => a + num(c.cantidad), 0);
    const costoTotal = detalle.reduce((a, c) => a + num(c.cantidad) * num(c.costo_unitario), 0);

    // Promedio ponderado de las capas realmente consumidas
    if (unidades > 0) item.costo_unitario = costoTotal / unidades;

    // La función SQL toca las capas; el stock visible se ajusta acá
    await db.from('productos')
      .update({
        stock: num(producto.stock) - num(item.cantidad),
        stock_actualizado_en: new Date().toISOString()
      })
      .eq('id', producto.id);

    // Marca para que ajustarStock no vuelva a descontar este ítem
    item._fifo = true;
    consumos.push({ indiceItem: i, producto_id: producto.id, capas: detalle });
  }

  return { items: lista, consumos };
}

/* Guarda el libro de consumo una vez que los venta_items ya tienen id.
   Sin esto no se podría revertir la venta ni auditar de dónde salió el
   costo, así que un fallo se registra pero no tumba la venta. */
async function registrarConsumoLotes(ventaId, itemsGuardados, consumos) {
  const filas = [];

  (consumos || []).forEach(c => {
    const itemGuardado = itemsGuardados[c.indiceItem];
    (c.capas || []).forEach(capa => {
      filas.push({
        venta_id: ventaId,
        venta_item_id: itemGuardado ? itemGuardado.id : null,
        producto_id: c.producto_id,
        lote_id: capa.lote_id || null,
        cantidad: num(capa.cantidad),
        costo_unitario: num(capa.costo_unitario)
      });
    });
  });

  if (filas.length === 0) return 0;

  const { error } = await db.from('venta_item_lotes').insert(filas);
  if (error) { console.error('[FIFO] no se pudo registrar el consumo:', error.message); return 0; }
  return filas.length;
}

/* Devuelve a sus capas el stock de una o varias ventas anuladas y borra el
   libro de consumo. Se usa junto a revertirEfectosDeVentas. */
async function devolverConsumoLotes(ventaIds) {
  const ids = (ventaIds || []).filter(Boolean);
  if (ids.length === 0) return { devueltos: 0, productos: new Set() };

  const { data: consumos } = await db.from('venta_item_lotes').select('*').in('venta_id', ids);
  const lista = consumos || [];
  if (lista.length === 0) return { devueltos: 0, productos: new Set() };

  const porProducto = new Map();   // producto_id → unidades a reponer

  for (const c of lista) {
    if (c.lote_id) {
      const { error } = await db.rpc('fifo_devolver', {
        p_lote_id: c.lote_id,
        p_cantidad: num(c.cantidad)
      });
      if (error) console.error('[FIFO] fifo_devolver falló:', error.message);
    }
    // El faltante sin lote (lote_id NULL) igual devuelve stock al producto
    porProducto.set(c.producto_id, (porProducto.get(c.producto_id) || 0) + num(c.cantidad));
  }

  for (const [productoId, unidades] of porProducto.entries()) {
    if (!productoId) continue;
    const { data: p } = await db.from('productos').select('stock').eq('id', productoId).maybeSingle();
    if (!p) continue;
    await db.from('productos')
      .update({ stock: num(p.stock) + unidades, stock_actualizado_en: new Date().toISOString() })
      .eq('id', productoId);
  }

  await db.from('venta_item_lotes').delete().in('venta_id', ids);
  return { devueltos: lista.length, productos: new Set(porProducto.keys()) };
}

/* Ajusta el stock del catálogo a partir de los ítems de una venta.
   signo = -1 descuenta (venta), signo = +1 repone (anulación).
   El producto se busca por id, luego por SKU y finalmente por código de
   barras, de modo que también funcione con ventas importadas. Los ítems
   marcados como stock_ilimitado (servicios) se omiten por completo. */
async function ajustarStock(items, signo = -1, omitirProductoIds = null) {
  const ajustados = [];
  const omitir = omitirProductoIds instanceof Set ? omitirProductoIds : new Set();

  /* ------------------------------------------------------------
     RENDIMIENTO: antes este bucle hacía 2 consultas por producto EN
     SERIE (buscar + actualizar). Con 5 productos eran 10 viajes de ida
     y vuelta a Supabase, uno esperando al anterior, y finalizar una
     venta tardaba varios segundos.

     Ahora se buscan TODOS los productos de la venta en 3 consultas
     (por id, por sku, por código de barras) y los updates se lanzan en
     paralelo. Una venta de 5 productos pasa de ~10 viajes secuenciales
     a 3 + 1 tanda paralela.
     ------------------------------------------------------------ */
  const pendientes = (items || []).filter(item => {
    /* Los ítems que ya movieron su stock por otro camino no se vuelven a
       tocar acá, o el movimiento quedaría duplicado:
       · al vender con lotes, lo hizo aplicarCostosFifo()      → item._fifo
       · al vender sin lotes, lo hizo descontarStockNoLotes()  → item._stockAtomico
       · al anular, lo hizo devolverConsumoLotes()             → llega en omitir */
    if (item._fifo) return false;
    if (item._stockAtomico) return false;
    if (item.producto_id && omitir.has(item.producto_id)) return false;
    return true;
  });

  if (!pendientes.length) return ajustados;

  const ids = [...new Set(pendientes.map(i => i.producto_id).filter(Boolean))];
  const skus = [...new Set(pendientes.map(i => i.sku && String(i.sku).trim()).filter(Boolean))];
  const barras = [...new Set(pendientes.map(i => i.codigo_barras && String(i.codigo_barras).trim()).filter(Boolean))];
  const repIds = [...new Set(pendientes.map(i => i.repuesto_id).filter(Boolean))];

  const porId = new Map(), porSku = new Map(), porBarra = new Map(), porRep = new Map();

  const consultas = [];
  if (ids.length) consultas.push(db.from('productos').select('id, stock, stock_ilimitado').in('id', ids)
    .then(({ data }) => (data || []).forEach(p => porId.set(p.id, p))));
  if (skus.length) consultas.push(db.from('productos').select('id, stock, stock_ilimitado, sku').in('sku', skus)
    .then(({ data }) => (data || []).forEach(p => { if (p.sku) porSku.set(String(p.sku).trim(), p); })));
  if (barras.length) consultas.push(db.from('productos').select('id, stock, stock_ilimitado, codigo_barras').in('codigo_barras', barras)
    .then(({ data }) => (data || []).forEach(p => { if (p.codigo_barras) porBarra.set(String(p.codigo_barras).trim(), p); })));
  if (repIds.length) consultas.push(db.from('repuestos').select('id, stock, stock_ilimitado').in('id', repIds)
    .then(({ data }) => (data || []).forEach(r => porRep.set(r.id, r))));

  await Promise.all(consultas);

  /* Los updates se acumulan y se lanzan juntos al final. Se agrupa por
     id para que dos líneas del mismo producto no se pisen: sin esto, dos
     updates simultáneos del mismo producto escribirían el mismo stock y
     una de las dos ventas se perdería. */
  const cambiosProducto = new Map();
  const cambiosRepuesto = new Map();

  for (const item of pendientes) {
    let producto = null;

    if (item.producto_id) producto = porId.get(item.producto_id) || null;
    if (!producto && item.sku) producto = porSku.get(String(item.sku).trim()) || null;
    if (!producto && item.codigo_barras) producto = porBarra.get(String(item.codigo_barras).trim()) || null;

    // Repuestos internos del taller: viven en su propia tabla
    if (!producto && item.repuesto_id) {
      const rep = porRep.get(item.repuesto_id);
      if (rep && !rep.stock_ilimitado) {
        const base = cambiosRepuesto.has(rep.id) ? cambiosRepuesto.get(rep.id) : num(rep.stock);
        cambiosRepuesto.set(rep.id, base + signo * num(item.cantidad));
      }
      continue;
    }

    if (!producto || producto.stock_ilimitado) continue; // libre o sin control de stock

    // Se acumula sobre lo ya calculado: dos líneas del mismo producto suman
    const base = cambiosProducto.has(producto.id) ? cambiosProducto.get(producto.id) : num(producto.stock);
    cambiosProducto.set(producto.id, base + signo * num(item.cantidad));
  }

  const marca = new Date().toISOString();
  const updates = [];

  cambiosProducto.forEach((stock, id) => {
    updates.push(db.from('productos').update({ stock, stock_actualizado_en: marca }).eq('id', id));
    ajustados.push({ producto_id: id, stock });
  });
  cambiosRepuesto.forEach((stock, id) => {
    updates.push(db.from('repuestos').update({ stock, stock_actualizado_en: marca }).eq('id', id));
    ajustados.push({ repuesto_id: id, stock });
  });

  await Promise.all(updates);
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

  /* Primero se devuelven las unidades a sus capas de costo (PEPS). Devuelve
     los producto_id que ya quedaron repuestos para que ajustarStock no los
     sume una segunda vez. */
  const lotes = await devolverConsumoLotes(ids);

  // Todo lo vendido en caja devuelve su stock. Los repuestos de una OT no
  // pasan por el carrito, así que aquí no hay nada especial que reabrir.
  const repuestos = await ajustarStock(lista, +1, lotes.productos);

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
  const { desde, hasta, estado, producto } = req.query;

  /* BÚSQUEDA POR PRODUCTO
     ------------------------------------------------------------
     "¿En qué ventas salió este producto?" El dato vive en venta_items,
     no en ventas, así que se resuelve en dos pasos: primero se buscan
     los ítems que coinciden y se sacan sus venta_id, y después se filtra
     la lista de ventas por esos ids.

     Se hace en el SERVIDOR y no filtrando en el navegador porque el
     frontend solo tiene la cabecera de cada venta: los ítems se piden
     uno por uno al abrir el detalle. Filtrar en el cliente habría
     obligado a pedir el detalle de las 200 ventas del período.

     Busca en nombre, SKU y número de serie, que son las tres formas en
     que alguien identifica un producto en el mostrador. */
  let idsPorProducto = null;
  if (producto && String(producto).trim()) {
    const texto = String(producto).trim();
    // Se escapan los comodines de PostgREST para que un "%" escrito por
    // el usuario busque un "%" y no "todo"
    const patron = `%${texto.replace(/[%_,]/g, m => '\\' + m)}%`;

    /* El barcode NO se guarda en venta_items (el POS lo descarta al vender),
       pero sí está en el catálogo. Si lo escrito calza con el código de
       barras de un producto, se traducen a su SKU y nombre para poder
       encontrar sus ventas. Así "buscar por barcode" funciona igual. */
    let extraSku = '', extraNombre = '';
    const { data: prods } = await db.from('productos')
      .select('sku, nombre, codigo_barras')
      .or(`codigo_barras.ilike.${patron},sku.ilike.${patron}`)
      .limit(50);
    if (prods && prods.length) {
      const skus = [...new Set(prods.map(p => p.sku).filter(Boolean))];
      const nombres = [...new Set(prods.map(p => p.nombre).filter(Boolean))];
      if (skus.length) extraSku = ',' + skus.map(s => `sku.eq.${s}`).join(',');
      if (nombres.length) extraNombre = ',' + nombres.map(n => `nombre.eq.${n}`).join(',');
    }

    const { data: items, error: errItems } = await db
      .from('venta_items')
      .select('venta_id')
      .or(`nombre.ilike.${patron},sku.ilike.${patron},serial_number.ilike.${patron}${extraSku}${extraNombre}`)
      .limit(5000);

    if (errItems) return enviarError(res, 500, errItems.message);

    idsPorProducto = [...new Set((items || []).map(i => i.venta_id).filter(Boolean))];
    // Sin coincidencias se corta acá: consultar `ventas` con un IN vacío
    // devolvería la lista entera en algunos clientes
    if (idsPorProducto.length === 0) return res.json([]);
  }

  let q = db.from('ventas').select('*').order('id', { ascending: false });
  if (desde) q = q.gte('fecha', desde);
  if (hasta) q = q.lte('fecha', hasta);
  if (estado) q = q.eq('estado', estado);
  if (idsPorProducto) q = q.in('id', idsPorProducto);

  const { data, error } = await q.limit(limiteDe(req));
  if (error) return enviarError(res, 500, error.message);
  res.json(limpiarLista(data, req.usuario.rol));
});

/* Detalle de los ítems de VARIAS ventas en una sola llamada.
   Lo usa el buscador del historial para mostrar, en cada fila, qué
   unidades del producto buscado salieron en esa venta. Pedirlo venta por
   venta serían N viajes al servidor para pintar una tabla. */
app.get('/api/ventas/items/por-ventas', auth(), async (req, res) => {
  const ids = String(req.query.ids || '')
    .split(',').map(n => parseInt(n, 10)).filter(Number.isFinite).slice(0, 300);

  if (!ids.length) return res.json([]);

  const { data, error } = await db.from('venta_items')
    .select('id, venta_id, nombre, sku, serial_number, cantidad, precio_unitario')
    .in('venta_id', ids);

  if (error) return enviarError(res, 500, error.message);
  res.json(data || []);
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

    /* BIZ-02: se comprueba el stock Y se descuenta en una sola llamada
       atómica ANTES de escribir la venta. Si algo no alcanza, la función
       SQL lanza una excepción, no descuenta nada y la venta se rechaza
       con 400: la base queda intacta. Los productos con lotes se validan
       y descuentan aparte, dentro de aplicarCostosFifo. */
    const yaDescontados = await descontarStockNoLotes(items);
    items.forEach(it => {
      if (it.producto_id && yaDescontados.has(it.producto_id)) it._stockAtomico = true;
    });

    /* PEPS: consume las capas y corrige el costo de cada línea ANTES de
       totalizar, para que la utilidad guardada sea la real. Los productos
       sin lotes pasan de largo sin cambios. */
    const { consumos } = await aplicarCostosFifo(items);

    const totales = totalizar(items);

    // "Por Pagar" deja la venta PENDIENTE: no suma a totales hasta que se cobre.
    const metodoPago = req.body?.metodo_pago || 'Efectivo';
    const esPendiente = metodoPago === 'Por Pagar';

    /* Pago mixto: el cliente cubrió la venta con más de un medio.
       Se valida contra el total ANTES de escribir nada. */
    const pagosMixtos = esPendiente ? null : normalizarPagos(req.body?.pagos, totales.total);

    /* Comisión del POS Tuu. Una venta PENDIENTE todavía no pasó por la
       máquina, así que nace en 0: se calcula cuando se registre el pago.
       Si hay desglose, la comisión sale de sumar la de cada parte con
       tarjeta, no del total de la venta. */
    const comisionPos = esPendiente
      ? 0
      : (pagosMixtos ? comisionDePagos(pagosMixtos) : calcularComisionPos(metodoPago, totales.total));

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
      comision_pos: comisionPos,
      pago_mixto: !!pagosMixtos,
      impreso: false,
      // --- Despacho / logística (migración 17) ---
      ...construirDatosEnvio(req.body),
      // Comisión de pasarela web (para el margen neto cuando llegue el e-commerce)
      origen_pago: (req.body?.origen_pago || 'presencial'),
      comision_pasarela: Math.max(0, num(req.body?.comision_pasarela)),
      // Turno de caja activo, si hay uno abierto (se resuelve abajo)
      caja_id: req.body?.caja_id ? Number(req.body.caja_id) : null
    };

    // En una venta mixta el método de cabecera queda como "Mixto"
    if (pagosMixtos) cabecera.metodo_pago = 'Mixto';

    const { data: venta, error } = await consultarConReintento(() => db.from('ventas').insert([cabecera]).select().single());
    if (error) {
      if (esErrorJwtTransitorio(error.message)) {
        console.warn('[VENTAS] Supabase rechazó la llave por reloj/JWT tras reintentar:', error.message);
        return enviarError(res, 503, 'La base de datos no respondió a tiempo. Intenta cobrar de nuevo en unos segundos.');
      }
      throw new Error(error.message);
    }

    /* _fifo y _stockAtomico son marcas internas de este proceso: no
       existen como columna, así que se quitan antes de insertar o
       Postgres rechaza la fila. */
    const itemsParaGuardar = items.map(({ _fifo, _stockAtomico, ...i }) => ({ ...i, venta_id: venta.id }));

    const { data: itemsGuardados, error: errItems } = await db.from('venta_items')
      .insert(itemsParaGuardar)
      .select();

    if (errItems) {
      // Evita dejar una venta huérfana si falla el detalle
      await db.from('ventas').delete().eq('id', venta.id);
      throw new Error(errItems.message);
    }

    // Libro de consumo PEPS (qué capa pagó cada unidad de esta venta)
    if (consumos.length) await registrarConsumoLotes(venta.id, itemsGuardados || [], consumos);

    // Desglose del pago mixto
    if (pagosMixtos) {
      const { error: errPagos } = await db.from('venta_pagos')
        .insert(pagosMixtos.map(p => ({ ...p, venta_id: venta.id })));
      // Un fallo acá no anula la venta: el total y la comisión ya están
      // bien en la cabecera. Solo se pierde el detalle para la cuadratura.
      if (errPagos) console.error('[PAGO MIXTO] no se pudo guardar el desglose:', errPagos.message);
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

      /* Comisión del POS: se respeta la del archivo si viene (un respaldo
         JSON de este mismo sistema la trae), y si no, se recalcula con el
         método de pago final. Así una reimportación no altera cifras
         históricas. */
      cabecera.comision_pos = origen.comision_pos !== undefined
        ? num(origen.comision_pos)
        : (estado === 'PAGADA'
            ? calcularComisionPos(cabecera.metodo_pago_final, cabecera.total)
            : 0);

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

    /* La comisión depende del método y del total: si el administrador
       cambia cualquiera de los dos, hay que recalcularla o el informe de
       utilidad neta quedaría mintiendo. Se parte de la venta actual y se
       le aplican los cambios de esta edición. */
    if (cambios.metodo_pago !== undefined || cambios.total !== undefined) {
      const { data: actual } = await db.from('ventas')
        .select('total, metodo_pago, metodo_pago_final, estado').eq('id', id).maybeSingle();

      const totalFinal = cambios.total !== undefined ? cambios.total : num(actual?.total);
      const metodoFinal = cambios.metodo_pago !== undefined
        ? cambios.metodo_pago
        : (actual?.metodo_pago_final || actual?.metodo_pago);

      // Una venta que sigue PENDIENTE no ha pasado por la máquina todavía
      const sigueePendiente = (actual?.estado === 'PENDIENTE') && cambios.metodo_pago === undefined;
      cambios.comision_pos = sigueePendiente ? 0 : calcularComisionPos(metodoFinal, totalFinal);
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

  /* Recién ahora se sabe cómo se cobró de verdad: si terminó pagándose con
     tarjeta, la venta pasa a tener comisión del POS. Si fue en efectivo o
     transferencia, queda en 0.

     También acepta pago mixto al cobrar: un cliente puede llegar a pagar
     una venta pendiente con efectivo más tarjeta. */
  let pagosMixtos = null;
  try { pagosMixtos = normalizarPagos(req.body?.pagos, venta.total); }
  catch (e) { return enviarError(res, 400, e.message); }

  if (pagosMixtos) {
    await db.from('venta_pagos').delete().eq('venta_id', req.params.id);   // por si se recobra
    const { error: errPagos } = await db.from('venta_pagos')
      .insert(pagosMixtos.map(p => ({ ...p, venta_id: Number(req.params.id) })));
    if (errPagos) console.error('[PAGO MIXTO] desglose no guardado:', errPagos.message);
  }

  const { data, error } = await db.from('ventas')
    .update({
      estado: 'PAGADA',
      metodo_pago_final: pagosMixtos ? 'Mixto' : metodo,
      pago_mixto: !!pagosMixtos,
      fecha_pago: new Date().toISOString(),
      comision_pos: pagosMixtos ? comisionDePagos(pagosMixtos) : calcularComisionPos(metodo, venta.total)
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return enviarError(res, 500, error.message);
  res.json(limpiarParaRol(data, req.usuario.rol));
});

/* Actualiza el estado de envío y el número de seguimiento de una venta
   (punto 5). Cualquier usuario autenticado: es logística, no montos. */
app.put('/api/ventas/:id/envio', auth(), async (req, res) => {
  const estados = ['pendiente', 'preparacion', 'enviado', 'entregado'];
  const cambios = {};

  if (req.body?.estado_envio !== undefined) {
    const e = String(req.body.estado_envio || '').trim().toLowerCase();
    if (!estados.includes(e)) return enviarError(res, 400, 'Estado de envío inválido');
    cambios.estado_envio = e;
  }
  if (req.body?.numero_seguimiento !== undefined) {
    cambios.numero_seguimiento = String(req.body.numero_seguimiento || '').trim() || null;
  }
  if (Object.keys(cambios).length === 0) return enviarError(res, 400, 'Nada que actualizar');

  const { data, error } = await db.from('ventas')
    .update(cambios).eq('id', req.params.id).select().single();
  if (error) return enviarError(res, 500, error.message);
  res.json(limpiarParaRol(data, req.usuario.rol));
});

/* Cambia únicamente el tipo de DTE de una venta ya registrada.
   Se usa desde el selector rápido del Historial (guarda con 1 clic).
   Lo puede hacer cualquier usuario autenticado: es una corrección
   tributaria de caja, no una edición de montos. */
app.post('/api/ventas/:id/dte', auth(true), async (req, res) => {
  const tipo = tipoDteValido(req.body?.tipo_dte);

  /* PRIORIDAD 7 — antes esto era auth() (cualquier trabajador) y sin
     rastro. Cambiar el tipo de documento de una venta ya registrada es
     sensible tributariamente, así que exige admin Y deja traza. */

  // Se lee el valor anterior ANTES de actualizar, para la auditoría
  const { data: previa } = await db.from('ventas')
    .select('tipo_dte').eq('id', req.params.id).maybeSingle();

  const { data, error } = await db.from('ventas')
    .update({ tipo_dte: tipo })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return enviarError(res, 500, error.message);

  /* Registro de auditoría (tabla auditoria_dte, migración 15). Solo-append.
     Si la tabla no existe todavía (backend nuevo, migración sin correr) el
     fallo NO rompe el cambio de DTE: se registra en consola y sigue. */
  if (previa && previa.tipo_dte !== tipo) {
    const { error: errAudit } = await db.from('auditoria_dte').insert([{
      venta_id: Number(req.params.id),
      tipo_anterior: previa.tipo_dte || null,
      tipo_nuevo: tipo,
      rol: req.usuario?.rol || null
    }]);
    if (errAudit) console.error('[AUDITORÍA DTE] no se pudo registrar el cambio:', errAudit.message);
  }

  res.json(limpiarParaRol(data, req.usuario.rol));
});

/* ============================================================
   COMPRAS Y GASTOS  (solo admin: son datos de costos)
   ============================================================ */
const CLASIFICACION_MERMA = 'Mermas / Pérdidas de Inventario';

/* Las clasificaciones ahora viven en su propia tabla y se validan contra
   ella (antes eran una lista fija en el código y un CHECK en la base). */
async function clasificacionValida(nombre) {
  const { data, error } = await db.from('compra_clasificaciones')
    .select('nombre, activo').eq('nombre', nombre).maybeSingle();
  /* Antes se ignoraba `error` y un fallo de conexión a la base se
     confundía con "la clasificación no existe" (400 engañoso). Ahora un
     error real de la base se distingue y sube como excepción, para que
     el endpoint lo reporte como lo que es: un fallo del servidor, no un
     dato inválido del usuario. */
  if (error) throw new Error('No se pudo validar la clasificación: ' + error.message);
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

  /* Crédito fiscal IVA (migración 27).
     Se guarda en pesos y no se deriva del monto: no todo gasto con
     factura trae 19% exacto (hay exentos, notas de crédito y montos ya
     netos). Sin factura marcada, el crédito se fuerza a 0 para que no
     quede un dato imposible ("crédito fiscal sin factura"). El tope
     contra el costo total lo exige además un CHECK en la base, así que
     se valida acá para devolver un mensaje claro en vez de un error
     crudo de Postgres. */
  const tieneFactura = body.tiene_factura === true || body.tiene_factura === 'true';
  const ivaCredito = tieneFactura ? Math.round(num(body.iva_credito)) : 0;

  if (ivaCredito < 0) return { error: 'El IVA de la factura no puede ser negativo' };
  if (ivaCredito > costo) {
    return { error: 'El IVA de la factura no puede ser mayor que el monto total del gasto' };
  }

  return {
    datos: {
      tiene_factura: tieneFactura,
      iva_credito: ivaCredito,
      fecha: fechaHoraDeGasto(body.fecha, body.hora),
      proveedor: (body.proveedor || '').trim() || null,
      clasificacion,
      // Solo los gastos en efectivo descuentan de la caja física
      metodo_pago: (body.metodo_pago || 'Efectivo').trim(),
      /* Banco/cuenta de destino: solo tiene sentido si NO es efectivo.
         Si el método es efectivo se fuerza a null para no dejar datos
         inconsistentes ("Efectivo en Santander"). */
      banco: esEfectivo((body.metodo_pago || 'Efectivo').trim())
        ? null
        : ((body.banco || '').trim() || null),
      costo_total: costo,
      descripcion: (body.descripcion || '').trim() || null,
      url_documento: (body.url_documento || '').trim() || null,
      url_comprobante: (body.url_comprobante || '').trim() || null,
      // Vínculo opcional con un gasto fijo (req. 4). Solo lo trae el pago
      // de un gasto fijo; las compras normales lo dejan en null.
      gasto_fijo_id: body.gasto_fijo_id ? Number(body.gasto_fijo_id) : null
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

  const { data, error } = await q.limit(limiteDe(req));
  if (error) return enviarError(res, 500, error.message);
  res.json(data || []);
});

/* BUG CORREGIDO — "el gasto no se guarda y no avisa nada".
   ------------------------------------------------------------
   Este handler (y el de abajo) no tenían try/catch. En Express 4, si un
   handler async lanza una excepción que nadie captura, Express NO la
   convierte en una respuesta de error: la promesa rechazada queda sin
   manejar y la petición se queda colgada sin que el navegador reciba
   nunca una respuesta (ni éxito ni error). Desde la interfaz eso se ve
   exactamente como "no pasa nada" — el famoso fallo silencioso.
   Con el try/catch, cualquier error inesperado (por ejemplo el nuevo
   throw de clasificacionValida cuando la base no responde) siempre
   termina en una respuesta JSON con un mensaje claro. */
app.post('/api/compras', auth(true), async (req, res) => {
  try {
    const { datos, error: errValidacion } = await sanearCompra(req.body);
    if (errValidacion) return enviarError(res, 400, errValidacion);

    const { data, error } = await db.from('compras').insert([datos]).select().single();
    if (error) return enviarError(res, 500, error.message);
    res.status(201).json(data);
  } catch (err) {
    console.error('[COMPRAS] no se pudo guardar el gasto:', err.message);
    enviarError(res, 500, err.message || 'No se pudo guardar el gasto');
  }
});

app.put('/api/compras/:id', auth(true), async (req, res) => {
  try {
    const { datos, error: errValidacion } = await sanearCompra(req.body);
    if (errValidacion) return enviarError(res, 400, errValidacion);

    const { data, error } = await db.from('compras').update(datos).eq('id', req.params.id).select().single();
    if (error) return enviarError(res, 500, error.message);
    res.json(data);
  } catch (err) {
    console.error('[COMPRAS] no se pudo actualizar el gasto:', err.message);
    enviarError(res, 500, err.message || 'No se pudo actualizar el gasto');
  }
});

app.post('/api/compras/eliminar-lote', auth(true), exigirPinAdmin, async (req, res) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Boolean);
  if (ids.length === 0) return enviarError(res, 400, 'No hay compras seleccionadas');

  const { error } = await db.from('compras').delete().in('id', ids);
  if (error) return enviarError(res, 500, error.message);
  res.json({ eliminadas: ids.length });
});

/* Al eliminar un gasto, el saldo del canal de origen sube solo (se
   recalcula desde `compras`, que ya no lo cuenta). Dos parámetros
   opcionales permiten decidir ese efecto en vez de sufrirlo:
     - revertirDinero (bool, default true): si es false, el registro
       contable se borra pero el dinero NO vuelve — se anula con un
       ajuste manual negativo para que el saldo quede igual que antes.
     - metodoDevolucion ('efectivo'|'banco'): a qué canal vuelve el
       monto cuando SÍ se revierte. Si difiere del canal donde se pagó
       el gasto, se registra un traspaso interno (la eliminación ya
       repuso el monto en el canal de origen).
   Ambos son opcionales y compatibles con llamadas viejas: sin body,
   el comportamiento es el de siempre (revertir al mismo canal). */
app.delete('/api/compras/:id', auth(true), async (req, res) => {
  try {
    const { data: compra, error: errBuscar } = await db.from('compras')
      .select('costo_total, metodo_pago, clasificacion, descripcion')
      .eq('id', req.params.id).maybeSingle();
    if (errBuscar) return enviarError(res, 500, errBuscar.message);
    if (!compra) return enviarError(res, 404, 'El gasto no existe');

    const revertirDinero = req.body?.revertirDinero !== false;
    const metodoDevolucion = String(req.body?.metodoDevolucion || '').trim().toLowerCase();
    const canalOrigen = esEfectivo(compra.metodo_pago) ? 'EFECTIVO' : 'BANCO';
    const descripcionGasto = `${compra.clasificacion}${compra.descripcion ? ' — ' + compra.descripcion : ''}`;

    if (revertirDinero) {
      const canalDestino = metodoDevolucion === 'banco' ? 'BANCO'
        : metodoDevolucion === 'efectivo' ? 'EFECTIVO' : canalOrigen;
      if (canalDestino !== canalOrigen) {
        const { error: errTraspaso } = await db.from('traspasos').insert([{
          origen: canalOrigen, destino: canalDestino, monto: compra.costo_total,
          nota: `Reverso de gasto eliminado: ${descripcionGasto}`
        }]);
        if (errTraspaso) return enviarError(res, 500, errTraspaso.message);
      }
    } else {
      const { error: errAjuste } = await db.from('ajustes_saldo').insert([{
        canal: canalOrigen,
        delta: -Number(compra.costo_total),
        saldo_anterior: Number(compra.costo_total),
        saldo_nuevo: 0,
        motivo: `Eliminación de gasto sin reversar dinero: ${descripcionGasto}`,
        rol: req.usuario?.rol || null
      }]);
      if (errAjuste) return enviarError(res, 500, errAjuste.message);
    }

    const { error } = await db.from('compras').delete().eq('id', req.params.id);
    if (error) return enviarError(res, 500, error.message);
    res.json({ ok: true });
  } catch (err) {
    console.error('[COMPRAS] no se pudo eliminar el gasto:', err.message);
    enviarError(res, 500, err.message || 'No se pudo eliminar el gasto');
  }
});

/* ============================================================
   GASTOS PROGRAMADOS — pendientes / cuotas (migración 18)
   ------------------------------------------------------------
   Compras que se registran hoy pero se pagan (y cargan a gastos) en una
   fecha futura: tarjeta de crédito, o cuotas. Al vencer se materializan
   como compras reales.
   ============================================================ */

// Lista los programados. Por defecto los pendientes, ordenados por fecha.
app.get('/api/gastos-programados', auth(true), async (req, res) => {
  let q = db.from('gastos_programados').select('*').order('fecha_vencimiento', { ascending: true });
  const estado = String(req.query?.estado || 'pendiente').trim().toLowerCase();
  if (estado !== 'todos') q = q.eq('estado', estado);
  const { data, error } = await q.limit(limiteDe(req));
  if (error) return enviarError(res, 500, error.message);
  res.json(data || []);
});

/* Crea uno o varios gastos programados. Si viene cuotas>1, genera N
   hermanos: uno por mes a partir de la primera fecha, cada uno por
   monto/cuotas (el último ajusta el redondeo para cuadrar el total). */
app.post('/api/gastos-programados', auth(true), async (req, res) => {
  const proveedor = (req.body?.proveedor || '').trim() || null;
  const clasificacion = (req.body?.clasificacion || '').trim();
  const descripcion = (req.body?.descripcion || '').trim() || null;
  const metodo_pago = (req.body?.metodo_pago || 'Tarjeta Crédito').trim();
  const montoTotal = num(req.body?.monto);
  const cuotas = Math.max(1, Math.min(48, parseInt(req.body?.cuotas, 10) || 1));
  const primeraFecha = (req.body?.fecha_vencimiento || '').trim();

  if (!clasificacion) return enviarError(res, 400, 'Falta la clasificación');
  if (montoTotal <= 0) return enviarError(res, 400, 'El monto debe ser mayor a 0');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(primeraFecha)) return enviarError(res, 400, 'Fecha de vencimiento inválida');

  const grupo = cuotas > 1 ? `cuotas_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` : null;
  const montoCuota = Math.round(montoTotal / cuotas);
  const filas = [];
  for (let i = 0; i < cuotas; i++) {
    // El último ajusta el redondeo para que la suma dé el total exacto
    const monto = (i === cuotas - 1) ? (montoTotal - montoCuota * (cuotas - 1)) : montoCuota;
    filas.push({
      proveedor, clasificacion, descripcion, metodo_pago,
      monto,
      fecha_vencimiento: sumarMeses(primeraFecha, i),
      estado: 'pendiente',
      grupo_cuotas: grupo,
      cuota_numero: cuotas > 1 ? i + 1 : null,
      cuota_total: cuotas > 1 ? cuotas : null
    });
  }

  const { data, error } = await db.from('gastos_programados').insert(filas).select();
  if (error) return enviarError(res, 500, error.message);
  res.status(201).json(data);
});

// Cancela un programado pendiente (no se materializará)
app.delete('/api/gastos-programados/:id', auth(true), async (req, res) => {
  const { data, error } = await db.from('gastos_programados')
    .update({ estado: 'cancelado' }).eq('id', req.params.id).eq('estado', 'pendiente').select().maybeSingle();
  if (error) return enviarError(res, 500, error.message);
  if (!data) return enviarError(res, 400, 'El gasto no existe o ya no está pendiente');
  res.json({ ok: true });
});

/* Materializa los programados vencidos (fecha <= hoy): crea la compra real
   y marca el programado como 'aplicado'. Lo llama el frontend al abrir
   Finanzas. Devuelve cuántos se aplicaron. */
app.post('/api/gastos-programados/procesar-vencidos', auth(true), async (req, res) => {
  const hoy = fechaHoyChile();
  const { data: vencidos, error } = await db.from('gastos_programados')
    .select('*').eq('estado', 'pendiente').lte('fecha_vencimiento', hoy);
  if (error) return enviarError(res, 500, error.message);

  let aplicados = 0;
  for (const g of (vencidos || [])) {
    // Se crea la compra real con la fecha de vencimiento (cuando corresponde el gasto)
    const desc = g.cuota_total
      ? `${g.descripcion || g.proveedor || 'Gasto'} · cuota ${g.cuota_numero}/${g.cuota_total}`
      : (g.descripcion || null);
    const { data: compra, error: eC } = await db.from('compras').insert([{
      fecha: g.fecha_vencimiento,
      proveedor: g.proveedor,
      clasificacion: g.clasificacion,
      costo_total: num(g.monto),
      descripcion: desc,
      metodo_pago: g.metodo_pago || null
    }]).select().single();
    if (eC) continue;   // si una falla, se sigue con las demás

    await db.from('gastos_programados')
      .update({ estado: 'aplicado', compra_id: compra.id, aplicado_en: new Date().toISOString() })
      .eq('id', g.id);
    aplicados++;
  }
  res.json({ aplicados });
});

/* Subida de factura / comprobante al bucket "compras-documentos".
   El archivo llega en base64 y sube con service_role: la llave nunca
   pasa por el navegador. */
/* ---------- Clasificaciones de gastos (CRUD dinámico) ----------
   No colisionan con "/api/compras/:id" porque tienen un segmento más
   ("/compras/clasificaciones/5" vs "/compras/5"), así que Express las
   distingue sin importar el orden de registro. */
/* ============================================================
   FINANZAS Y BALANCE
   ============================================================ */

const GRUPOS_GASTO = ['OPERATIVO', 'INVENTARIO', 'INVERSION'];

/* Medios que entran físicamente al cajón. Se usa para separar la caja
   física del flujo total: el débito y la transferencia son dinero real,
   pero no billetes que se puedan contar al cerrar. */
const MEDIOS_EFECTIVO = ['Efectivo'];

function esEfectivo(metodo) {
  return MEDIOS_EFECTIVO.includes(String(metodo || '').trim());
}

/* ---------- Gastos fijos ---------- */

app.get('/api/gastos-fijos', auth(true), async (req, res) => {
  const { data, error } = await db.from('gastos_fijos').select('*').order('dia_mes').order('nombre');
  if (error) return enviarError(res, 500, error.message);
  res.json(data || []);
});

function sanearGastoFijo(body) {
  const g = {};
  if (body.nombre !== undefined) g.nombre = String(body.nombre).trim();
  if (body.monto !== undefined) g.monto = num(body.monto);
  if (body.dia_mes !== undefined) g.dia_mes = Math.min(31, Math.max(1, parseInt(body.dia_mes, 10) || 1));
  if (body.clasificacion !== undefined) g.clasificacion = (body.clasificacion || '').trim() || null;
  if (body.grupo !== undefined) g.grupo = GRUPOS_GASTO.includes(body.grupo) ? body.grupo : 'OPERATIVO';
  if (body.activo !== undefined) g.activo = !!body.activo;
  if (body.notas !== undefined) g.notas = (body.notas || '').trim() || null;
  return g;
}

app.post('/api/gastos-fijos', auth(true), async (req, res) => {
  const g = sanearGastoFijo(req.body || {});
  if (!g.nombre) return enviarError(res, 400, 'El nombre del gasto fijo es obligatorio');
  if (!(g.monto > 0)) return enviarError(res, 400, 'El monto debe ser mayor a 0');

  const { data, error } = await db.from('gastos_fijos').insert([g]).select().single();
  if (error) return enviarError(res, 500, error.message);
  res.status(201).json(data);
});

app.put('/api/gastos-fijos/:id', auth(true), async (req, res) => {
  const g = sanearGastoFijo(req.body || {});
  g.actualizado_en = new Date().toISOString();

  const { data, error } = await db.from('gastos_fijos').update(g).eq('id', req.params.id).select().single();
  if (error) return enviarError(res, 500, error.message);
  res.json(data);
});

app.delete('/api/gastos-fijos/:id', auth(true), async (req, res) => {
  const { error } = await db.from('gastos_fijos').delete().eq('id', req.params.id);
  if (error) return enviarError(res, 500, error.message);
  res.json({ ok: true });
});

/* ---------- Inyecciones de capital ---------- */

app.get('/api/inyecciones', auth(true), async (req, res) => {
  const { desde, hasta } = req.query;
  let q = db.from('inyecciones_capital').select('*').order('fecha', { ascending: false });
  if (desde) q = q.gte('fecha', desde);
  if (hasta) q = q.lte('fecha', hasta);

  const { data, error } = await q;
  if (error) return enviarError(res, 500, error.message);
  res.json(data || []);
});

app.post('/api/inyecciones', auth(true), async (req, res) => {
  const metodo = (req.body?.metodo || 'Efectivo').trim();
  const inyeccion = {
    fecha: (req.body?.fecha || '').trim() || fechaHoyChile(),
    monto: num(req.body?.monto),
    metodo,
    // Banco solo cuando el aporte NO entra como efectivo
    banco: esEfectivo(metodo) ? null : ((req.body?.banco || '').trim() || null),
    descripcion: (req.body?.descripcion || '').trim() || null
  };
  if (!(inyeccion.monto > 0)) return enviarError(res, 400, 'El monto del aporte debe ser mayor a 0');

  const { data, error } = await db.from('inyecciones_capital').insert([inyeccion]).select().single();
  if (error) return enviarError(res, 500, error.message);
  res.status(201).json(data);
});

app.delete('/api/inyecciones/:id', auth(true), exigirPinAdmin, async (req, res) => {
  const { error } = await db.from('inyecciones_capital').delete().eq('id', req.params.id);
  if (error) return enviarError(res, 500, error.message);
  res.json({ ok: true });
});

/* ============================================================
   INTELIGENCIA DE NEGOCIO
   ============================================================ */

/* Top 10 y horas pico en una sola llamada: ambos recorren los mismos
   venta_items, así que separarlos duplicaría el trabajo del servidor. */
app.get('/api/reportes/dashboard', auth(true), async (req, res) => {
  const desde = (req.query?.desde || '').trim();
  const hasta = (req.query?.hasta || '').trim();
  if (!desde || !hasta) return enviarError(res, 400, 'Faltan las fechas del período');

  try {
    const { data: ventasRaw } = await db.from('ventas')
      .select('id, fecha, hora, created_at, vendida_en, total, estado')
      .gte('fecha', desde).lte('fecha', hasta).eq('estado', 'PAGADA');

    const ventas = ventasRaw || [];
    const ids = ventas.map(v => v.id);

    let items = [];
    if (ids.length) {
      const { data } = await db.from('venta_items')
        .select('venta_id, producto_id, nombre, cantidad, costo_unitario, precio_unitario, subtotal')
        .in('venta_id', ids);
      items = data || [];
    }

    /* Agrupación por producto. Se agrupa por producto_id cuando existe y
       por nombre cuando no (ítems manuales escritos a mano en el POS). */
    const porProducto = {};
    items.forEach(it => {
      const clave = it.producto_id ? 'id:' + it.producto_id : 'nom:' + (it.nombre || '').trim().toLowerCase();
      if (!porProducto[clave]) {
        porProducto[clave] = { nombre: it.nombre || 'Sin nombre', unidades: 0, ingresos: 0, utilidad: 0 };
      }
      const p = porProducto[clave];
      const cant = num(it.cantidad);
      const sub = num(it.subtotal) || cant * num(it.precio_unitario);

      p.unidades += cant;
      p.ingresos += sub;
      p.utilidad += sub - (cant * num(it.costo_unitario));
    });

    const lista = Object.values(porProducto);

    /* Dos rankings distintos a propósito: el producto que más se vende no
       suele ser el que más deja. Ver ambos es lo que permite decidir qué
       conviene empujar. */
    /* Se devuelven hasta 100 por ranking: suficiente para el PDF completo
       sin mandar el catálogo entero. El panel muestra solo los 5
       primeros; el resto se usa al exportar. */
    const TOPE = 100;
    const porUnidades = [...lista].sort((a, b) => b.unidades - a.unidades);
    const porUtilidad = [...lista].sort((a, b) => b.utilidad - a.utilidad);

    const topVolumen = porUnidades.slice(0, TOPE);
    const topMargen = porUtilidad.slice(0, TOPE);

    /* Los "menos" se calculan invirtiendo la lista COMPLETA, no la ya
       recortada: si se recortara primero, "los que menos rotan" saldría
       del top 100, que son justamente los que más rotan. */
    const menosVolumen = [...porUnidades].reverse().slice(0, TOPE);
    const menosMargen = [...porUtilidad].reverse().slice(0, TOPE);

    /* Horas pico. La hora sale de `hora` (texto HH:MM que el POS guarda) y
       si falta, de vendida_en/created_at convertido a hora de Chile: usar
       la hora UTC correría todo 3 o 4 horas según la estación. */
    const porHora = Array.from({ length: 24 }, () => ({ ventas: 0, monto: 0 }));
    const porDia = Array.from({ length: 7 }, () => ({ ventas: 0, monto: 0 }));

    ventas.forEach(v => {
      let hora = null;
      if (typeof v.hora === 'string' && /^\d{1,2}:/.test(v.hora)) {
        hora = parseInt(v.hora.split(':')[0], 10);
      } else if (v.vendida_en || v.created_at) {
        const iso = v.vendida_en || v.created_at;
        const enChile = new Date(iso).toLocaleString('en-US', { timeZone: 'America/Santiago' });
        hora = new Date(enChile).getHours();
      }
      if (hora !== null && hora >= 0 && hora < 24) {
        porHora[hora].ventas++;
        porHora[hora].monto += num(v.total);
      }

      if (v.fecha) {
        // El mediodía UTC evita que la fecha salte de día al convertir
        const d = new Date(v.fecha + 'T12:00:00');
        if (!isNaN(d.getTime())) {
          const dia = d.getDay();
          porDia[dia].ventas++;
          porDia[dia].monto += num(v.total);
        }
      }
    });

    res.json({
      periodo: { desde, hasta },
      topVolumen, topMargen, menosVolumen, menosMargen,
      totalProductos: lista.length,
      porHora, porDia,
      totalVentas: ventas.length,
      totalItems: items.length
    });
  } catch (e) {
    enviarError(res, 500, e.message || 'No se pudo generar el reporte');
  }
});

/* Lista de reposición: productos bajo su mínimo, con la cantidad
   sugerida a pedir. Se calcula en el servidor porque necesita el costo,
   que no se envía al rol trabajador. */
app.get('/api/reportes/reposicion', auth(true), async (req, res) => {
  const { data, error } = await db.from('productos')
    .select('*').eq('alerta_stock', true).eq('stock_ilimitado', false);

  if (error) return enviarError(res, 500, error.message);

  const enAlerta = (data || [])
    .filter(p => num(p.stock) <= num(p.stock_minimo))
    .map(p => {
      const minimo = num(p.stock_minimo);
      const stock = num(p.stock);
      /* Se sugiere reponer hasta el DOBLE del mínimo, no hasta el mínimo
         exacto: llegar justo al umbral deja el producto en alerta otra
         vez con la primera venta. */
      const sugerido = Math.max(1, Math.ceil(minimo * 2 - stock));
      return {
        id: p.id, nombre: p.nombre, sku: p.sku, codigo_barras: p.codigo_barras,
        stock, stock_minimo: minimo,
        costo_unitario: num(p.costo_unitario),
        sugerido,
        costo_estimado: sugerido * num(p.costo_unitario),
        agotado: stock <= 0
      };
    })
    .sort((a, b) => a.stock - b.stock);   // lo más urgente primero

  res.json({
    productos: enAlerta,
    total: enAlerta.length,
    agotados: enAlerta.filter(p => p.agotado).length,
    costoTotal: enAlerta.reduce((a, p) => a + p.costo_estimado, 0)
  });
});

/* Resumen mensual consolidado para el contador. Devuelve los datos ya
   agrupados; el Excel lo arma el navegador con SheetJS, que ya está
   cargado para los otros informes. */
app.get('/api/reportes/contador', auth(true), async (req, res) => {
  const desde = (req.query?.desde || '').trim();
  const hasta = (req.query?.hasta || '').trim();
  if (!desde || !hasta) return enviarError(res, 400, 'Faltan las fechas del período');

  try {
    const { data: ventasRaw } = await db.from('ventas')
      .select('*').gte('fecha', desde).lte('fecha', hasta).eq('estado', 'PAGADA')
      .order('fecha');

    const ventas = ventasRaw || [];

    /* IVA contenido: los precios del sistema son BRUTOS (IVA incluido),
       así que el neto es total / 1,19 y el IVA la diferencia. Calcularlo
       como total × 0,19 daría de más. */
    const IVA = 0.19;
    const conIva = ventas.filter(v => v.tipo_dte === 'BOLETA' || v.tipo_dte === 'FACTURA');

    const totalConDte = conIva.reduce((a, v) => a + num(v.total), 0);
    const netoConDte = totalConDte / (1 + IVA);
    const ivaDebito = totalConDte - netoConDte;

    const { data: gastosRaw } = await db.from('compras')
      .select('*').gte('fecha', desde).lte('fecha', hasta + 'T23:59:59').order('fecha');

    const gastos = gastosRaw || [];
    const totalGastos = gastos.reduce((a, g) => a + num(g.costo_total), 0);

    const porClasificacion = {};
    gastos.forEach(g => {
      const k = g.clasificacion || 'Sin clasificar';
      porClasificacion[k] = (porClasificacion[k] || 0) + num(g.costo_total);
    });

    const porDte = { BOLETA: 0, FACTURA: 0, 'SIN DTE': 0 };
    ventas.forEach(v => {
      const k = v.tipo_dte || 'SIN DTE';
      porDte[k] = (porDte[k] || 0) + num(v.total);
    });

    res.json({
      periodo: { desde, hasta },
      ventas: ventas.map(v => ({
        fecha: v.fecha, numero_orden: v.numero_orden, cliente: v.cliente,
        tipo_dte: v.tipo_dte || 'SIN DTE',
        metodo_pago: v.metodo_pago_final || v.metodo_pago,
        total: num(v.total),
        neto: num(v.total) / (1 + IVA),
        iva: num(v.total) - num(v.total) / (1 + IVA),
        comision_pos: num(v.comision_pos)
      })),
      gastos: gastos.map(g => ({
        fecha: g.fecha, proveedor: g.proveedor, clasificacion: g.clasificacion,
        descripcion: g.descripcion, metodo_pago: g.metodo_pago,
        costo_total: num(g.costo_total)
      })),
      resumen: {
        cantidadVentas: ventas.length,
        totalVentas: ventas.reduce((a, v) => a + num(v.total), 0),
        totalConDte, netoConDte, ivaDebito,
        ventasSinDte: porDte['SIN DTE'] || 0,
        porDte,
        totalGastos, porClasificacion,
        comisiones: ventas.reduce((a, v) => a + num(v.comision_pos), 0)
      }
    });
  } catch (e) {
    enviarError(res, 500, e.message || 'No se pudo generar el resumen');
  }
});

/* Efectivo que debería haber en el cajón de una fecha.
   Mismo criterio que el balance: solo entra y sale lo que es efectivo,
   y las mermas no descuentan porque no es dinero que salió. */
async function calcularEfectivoEsperado(fecha, fondoInicial) {
  const { data: ventasRaw } = await db.from('ventas')
    .select('id, total, metodo_pago, metodo_pago_final, pago_mixto')
    .eq('fecha', fecha).eq('estado', 'PAGADA');

  const ventas = ventasRaw || [];
  const ids = ventas.map(v => v.id);

  let pagos = [];
  if (ids.length) {
    const { data } = await db.from('venta_pagos').select('*').in('venta_id', ids);
    pagos = data || [];
  }
  const pagosPorVenta = {};
  pagos.forEach(p => { (pagosPorVenta[p.venta_id] = pagosPorVenta[p.venta_id] || []).push(p); });

  let ventasEfectivo = 0;
  ventas.forEach(v => {
    const desglose = pagosPorVenta[v.id];
    if (v.pago_mixto && desglose?.length) {
      desglose.forEach(p => { if (esEfectivo(p.metodo)) ventasEfectivo += num(p.monto); });
    } else if (esEfectivo(v.metodo_pago_final || v.metodo_pago)) {
      ventasEfectivo += num(v.total);
    }
  });

  const { data: gastosRaw } = await db.from('compras')
    .select('costo_total, metodo_pago, origen')
    .gte('fecha', fecha).lte('fecha', fecha + 'T23:59:59');

  const gastosEfectivo = (gastosRaw || [])
    .filter(g => esEfectivo(g.metodo_pago) && g.origen !== 'MERMA')
    .reduce((a, g) => a + num(g.costo_total), 0);

  const { data: inyRaw } = await db.from('inyecciones_capital')
    .select('monto, metodo').eq('fecha', fecha);

  const inyEfectivo = (inyRaw || [])
    .filter(i => esEfectivo(i.metodo)).reduce((a, i) => a + num(i.monto), 0);

  return num(fondoInicial) + ventasEfectivo + inyEfectivo - gastosEfectivo;
}

/* ---------- Arqueo de caja ----------
   Abrir la caja fija el fondo inicial del día; cerrarla guarda el conteo
   real y la diferencia contra lo esperado. */

app.get('/api/arqueos', auth(true), async (req, res) => {
  const { desde, hasta, fecha } = req.query;

  let q = db.from('arqueos').select('*').order('fecha', { ascending: false });
  if (fecha) q = q.eq('fecha', fecha);
  if (desde) q = q.gte('fecha', desde);
  if (hasta) q = q.lte('fecha', hasta);

  const { data, error } = await q.limit(60);
  if (error) return enviarError(res, 500, error.message);
  res.json(data || []);
});

/* Arqueo de hoy, si existe. Lo usa la interfaz para saber si la caja
   está abierta o todavía no se abrió. */
app.get('/api/arqueos/hoy', auth(true), async (req, res) => {
  const hoy = fechaHoyChile();
  const { data, error } = await db.from('arqueos').select('*').eq('fecha', hoy).maybeSingle();
  if (error) return enviarError(res, 500, error.message);
  res.json(data || null);
});

app.post('/api/arqueos/abrir', auth(true), async (req, res) => {
  const fecha = (req.body?.fecha || '').trim() || fechaHoyChile();
  const fondo = num(req.body?.fondo_inicial);

  const { data: existente } = await db.from('arqueos').select('*').eq('fecha', fecha).maybeSingle();

  /* Reabrir un día cerrado borraría la diferencia ya registrada, que es
     justamente el dato que hay que conservar. */
  if (existente?.cerrado) {
    return enviarError(res, 400, `La caja del ${fecha} ya fue cerrada. No se puede reabrir.`);
  }

  // Si ya estaba abierta, se corrige el fondo en vez de duplicar la fila
  if (existente) {
    const { data, error } = await db.from('arqueos')
      .update({ fondo_inicial: fondo }).eq('id', existente.id).select().single();
    if (error) return enviarError(res, 500, error.message);
    return res.json(data);
  }

  const { data, error } = await db.from('arqueos')
    .insert([{ fecha, fondo_inicial: fondo }]).select().single();
  if (error) return enviarError(res, 500, error.message);
  res.status(201).json(data);
});

app.post('/api/arqueos/cerrar', auth(true), async (req, res) => {
  const fecha = (req.body?.fecha || '').trim() || fechaHoyChile();
  const contado = num(req.body?.contado);

  const { data: arqueo } = await db.from('arqueos').select('*').eq('fecha', fecha).maybeSingle();
  if (!arqueo) return enviarError(res, 404, 'No hay una caja abierta para esa fecha');
  if (arqueo.cerrado) return enviarError(res, 400, 'Esa caja ya está cerrada');

  /* ARQUEO CIEGO: el esperado lo calcula el SERVIDOR al cerrar, no llega
     del cliente. Si lo mandara el navegador, el cajero podría leerlo en
     las herramientas del desarrollador antes de contar, y el arqueo
     dejaría de detectar diferencias: es justamente lo que se quiere
     medir. El cliente solo envía el conteo físico. */
  const esperado = await calcularEfectivoEsperado(fecha, num(arqueo.fondo_inicial));

  /* `esperado` se congela con el valor del momento del cierre. Si mañana
     se corrige una venta antigua, este arqueo debe seguir mostrando lo
     que se vio hoy: es una foto, no un cálculo vivo. */
  const { data, error } = await db.from('arqueos')
    .update({
      contado,
      esperado,
      diferencia: contado - esperado,
      observaciones: (req.body?.observaciones || '').trim() || null,
      cerrado: true,
      cerrado_en: new Date().toISOString()
    })
    .eq('id', arqueo.id).select().single();

  if (error) return enviarError(res, 500, error.message);
  res.json(data);
});

/* ---------- Balance consolidado ----------
   Un solo endpoint que devuelve todo el panel ya calculado. Se hace en
   el servidor y no en el navegador por dos razones: los costos y
   utilidades no se envían al rol trabajador, y bajar todas las ventas
   del mes solo para sumarlas sería lento con datos móviles. */
app.get('/api/balance', auth(true), async (req, res) => {
  const desde = (req.query?.desde || '').trim();
  const hasta = (req.query?.hasta || '').trim();
  if (!desde || !hasta) return enviarError(res, 400, 'Faltan las fechas del período (desde / hasta)');

  try {
    // --- Ventas cobradas del período ---
    // consultarConReintento: si Supabase rechaza la llave por reloj/JWT
    // (ver definición del helper), reintenta sola antes de devolver un
    // balance vacío o a medio calcular.
    const { data: ventasRaw } = await consultarConReintento(() => db.from('ventas')
      .select('id, fecha, total, costo_total, utilidad, comision_pos, tipo_dte, metodo_pago, metodo_pago_final, pago_mixto, estado')
      .gte('fecha', desde).lte('fecha', hasta).eq('estado', 'PAGADA'));

    const ventas = ventasRaw || [];
    const ids = ventas.map(v => v.id);

    // Desglose de las mixtas, para repartir por medio de pago
    let pagos = [];
    if (ids.length) {
      const { data } = await db.from('venta_pagos').select('*').in('venta_id', ids);
      pagos = data || [];
    }

    /* Productos vs. servicios: se agrega a nivel de ítem (venta_items),
       no de venta — una misma venta puede mezclar los dos. es_servicio
       lo marca el vendedor en el POS al agregar cada ítem, con o sin
       catálogo de por medio (ver migración 26). */
    let ventasProductos = 0;
    let ventasServicios = 0;
    if (ids.length) {
      const { data: itemsRaw } = await db.from('venta_items')
        .select('subtotal, es_servicio').in('venta_id', ids);
      (itemsRaw || []).forEach(it => {
        if (it.es_servicio) ventasServicios += num(it.subtotal);
        else ventasProductos += num(it.subtotal);
      });
    }

    const ingresos = ventas.reduce((a, v) => a + num(v.total), 0);
    const costoVendido = ventas.reduce((a, v) => a + num(v.costo_total), 0);
    const comisiones = ventas.reduce((a, v) => a + num(v.comision_pos), 0);
    const utilidadBruta = ingresos - costoVendido;

    /* Reparto por medio de pago. Una venta mixta aporta a varios medios
       según su desglose; una simple, todo a su método. */
    const porMedio = {};
    const sumar = (metodo, monto) => {
      const k = String(metodo || 'Sin especificar').trim();
      porMedio[k] = (porMedio[k] || 0) + num(monto);
    };

    const pagosPorVenta = {};
    pagos.forEach(p => { (pagosPorVenta[p.venta_id] = pagosPorVenta[p.venta_id] || []).push(p); });

    ventas.forEach(v => {
      const desglose = pagosPorVenta[v.id];
      if (v.pago_mixto && desglose?.length) desglose.forEach(p => sumar(p.metodo, p.monto));
      else sumar(v.metodo_pago_final || v.metodo_pago, v.total);
    });

    const ventasEfectivo = Object.entries(porMedio)
      .filter(([m]) => esEfectivo(m))
      .reduce((a, [, monto]) => a + monto, 0);

    // --- Gastos del período ---
    const { data: gastosRaw } = await db.from('compras')
      .select('id, fecha, clasificacion, costo_total, origen, metodo_pago, tiene_factura, iva_credito')
      .gte('fecha', desde).lte('fecha', hasta + 'T23:59:59');

    const gastos = gastosRaw || [];
    const totalGastos = gastos.reduce((a, g) => a + num(g.costo_total), 0);

    /* Desglose de IVA del período (misma función que usa el submódulo
       Utilidades, para que las dos vistas no puedan discrepar).
       Se informa, pero NO se descuenta de la utilidad neta de este
       endpoint: el Balance sigue siendo la vista de caja de siempre y
       cambiarle el significado a `utilidadNeta` rompería los KPI ya
       existentes. El descuento del IVA se decide con casillas en
       Finanzas → Utilidades. */
    const ivaBalance = calcularIvaDePeriodo(ventas, gastos);

    /* Solo lo pagado en efectivo sale del cajón. Antes se asumía que
       TODOS los gastos eran en efectivo y la caja física quedaba baja
       cuando el arriendo se pagaba por transferencia.
       Las mermas no salen del cajón: son stock perdido, no dinero. */
    const gastosEfectivo = gastos
      .filter(g => esEfectivo(g.metodo_pago) && g.origen !== 'MERMA')
      .reduce((a, g) => a + num(g.costo_total), 0);

    // Agrupación por familia contable
    const { data: clasifRaw } = await db.from('compra_clasificaciones').select('nombre, grupo');
    const grupoDe = {};
    (clasifRaw || []).forEach(c => { grupoDe[c.nombre] = c.grupo || 'OPERATIVO'; });

    const porGrupo = { OPERATIVO: 0, INVENTARIO: 0, INVERSION: 0 };
    const porClasificacion = {};
    gastos.forEach(g => {
      const grupo = grupoDe[g.clasificacion] || 'OPERATIVO';
      porGrupo[grupo] = (porGrupo[grupo] || 0) + num(g.costo_total);
      const k = g.clasificacion || 'Sin clasificar';
      porClasificacion[k] = (porClasificacion[k] || 0) + num(g.costo_total);
    });

    /* La compra de mercadería (grupo INVENTARIO) no es un gasto de
       utilidad neta: es un activo que ya se descuenta como costoVendido
       cuando el producto se vende (vía FIFO). Contarlo también acá
       duplicaba el costo y hacía ver pérdidas al reponer stock aunque
       el negocio estuviera sano. Sí se mantiene en totalGastos (para
       flujoLiquido, que es caja real, y para el desglose por grupo). */
    const gastosParaUtilidadNeta = gastos
      .filter(g => (grupoDe[g.clasificacion] || 'OPERATIVO') !== 'INVENTARIO')
      .reduce((a, g) => a + num(g.costo_total), 0);

    // --- Aportes de capital ---
    const { data: inyRaw } = await db.from('inyecciones_capital')
      .select('*').gte('fecha', desde).lte('fecha', hasta);

    const inyecciones = inyRaw || [];
    const totalInyecciones = inyecciones.reduce((a, i) => a + num(i.monto), 0);
    const inyeccionesEfectivo = inyecciones.filter(i => esEfectivo(i.metodo))
      .reduce((a, i) => a + num(i.monto), 0);

    // --- Gastos fijos (para el punto de equilibrio) ---
    const { data: fijosRaw } = await db.from('gastos_fijos').select('*').eq('activo', true);
    const fijos = fijosRaw || [];
    const metaGastosFijos = fijos.reduce((a, f) => a + num(f.monto), 0);

    /* Utilidad neta = margen bruto menos los gastos operativos/inversión
       (sin contar INVENTARIO, ver más arriba) menos la comisión del POS.
       La comisión ya está descontada dentro de utilidad_bruta?
       No: utilidad_bruta es ingresos - costo. La comisión es un gasto
       aparte, así que se resta acá para no perderla. */
    const utilidadNeta = utilidadBruta - gastosParaUtilidadNeta - comisiones;

    /* Caja física: solo lo que se puede contar en billetes.
       Los gastos se asumen pagados en efectivo porque `compras` no
       registra el medio de pago. Es una aproximación conservadora y
       queda advertida en la interfaz. */
    /* Arqueo abierto del último día del período: su fondo inicial es la
       base con que arrancó el cajón. Sin esto la caja física partía de 0
       y nunca cuadraba con el conteo real. */
    const { data: arqueoRaw } = await db.from('arqueos')
      .select('*').gte('fecha', desde).lte('fecha', hasta)
      .order('fecha', { ascending: false }).limit(1);

    const arqueo = (arqueoRaw || [])[0] || null;
    const fondoInicial = num(arqueo?.fondo_inicial);

    const cajaFisica = fondoInicial + ventasEfectivo + inyeccionesEfectivo - gastosEfectivo;

    // Flujo líquido: todo el dinero disponible, en cualquier forma
    const flujoLiquido = ingresos + totalInyecciones - totalGastos - comisiones;

    res.json({
      periodo: { desde, hasta },
      ingresos,
      costoVendido,
      utilidadBruta,
      comisiones,
      totalGastos,
      utilidadNeta,
      margenBruto: ingresos > 0 ? (utilidadBruta / ingresos) * 100 : 0,
      margenNeto: ingresos > 0 ? (utilidadNeta / ingresos) * 100 : 0,
      cantidadVentas: ventas.length,
      ticketPromedio: ventas.length ? ingresos / ventas.length : 0,
      ventasProductos,
      ventasServicios,
      /* IVA informativo: `ivaRetenidoSinDte` es el IVA de las ventas sin
         DTE, que en este negocio se queda como utilidad. Va explícito
         para que la cifra esté a la vista y no escondida dentro del
         total. */
      iva: ivaBalance,
      porMedio,
      porGrupo,
      porClasificacion,
      ventasEfectivo,
      gastosEfectivo,
      fondoInicial,
      arqueo,
      totalInyecciones,
      inyeccionesEfectivo,
      cajaFisica,
      flujoLiquido,
      metaGastosFijos,
      gastosFijos: fijos,
      inyecciones,
      // % del margen bruto que ya cubre los gastos fijos del mes
      avanceEquilibrio: metaGastosFijos > 0 ? Math.min(100, (utilidadBruta / metaGastosFijos) * 100) : null
    });
  } catch (e) {
    enviarError(res, 500, e.message || 'No se pudo calcular el balance');
  }
});

/* ============================================================
   SALDO POR CANAL EN TIEMPO REAL  (widget de Finanzas)
   ------------------------------------------------------------
   Calcula, sobre TODA la historia (no un período), cuánto dinero hay
   ahora mismo en cada canal:

     Caja chica (efectivo) = fondos iniciales de arqueo
                           + ventas cobradas en efectivo
                           + inyecciones en efectivo
                           + traspasos que ENTRAN a efectivo
                           - gastos pagados en efectivo (sin mermas)
                           - traspasos que SALEN de efectivo

     Banco = ventas cobradas por débito/crédito/transferencia
           + inyecciones no-efectivo
           + traspasos que ENTRAN a banco
           - gastos no-efectivo
           - comisiones del POS (se descuentan del abono bancario)
           - traspasos que SALEN de banco

   El canal se DERIVA del método de pago: esEfectivo() decide. No hay
   una columna "canal" que pueda quedar desincronizada.

   Se hace en el servidor de un tirón porque son varias tablas; el
   frontend solo pinta el resultado y lo refresca tras cada venta/gasto.
   ============================================================ */
/* ============================================================
   CAJA DIARIA — apertura, arqueo, movimientos (entregable 2)
   ------------------------------------------------------------
   Un turno de caja se abre con un fondo inicial y se cierra con un
   arqueo. Solo puede haber UNA caja abierta a la vez. Las ventas en
   efectivo y los movimientos rápidos (ingresos/egresos) se cruzan al
   cerrar para calcular el efectivo esperado.
   ============================================================ */

// Devuelve el turno de caja abierto (o null). Lo usa el POS al arrancar.
/* Este endpoint lo sondea el frontend cada 12s (js/caja.js) para saber si
   hay caja abierta: un rechazo transitorio del JWT acá se traduciría en la
   barra de caja "parpadeando" a cerrada en cada ciclo de sondeo, así que
   lleva el mismo reintento que /api/ot. */
/* ============================================================
   UTILIDADES · CONTABILIDAD DEL PERÍODO  (submódulo Finanzas → Utilidades)
   ------------------------------------------------------------
   Este bloque responde una sola pregunta: de lo que entró, ¿cuánto es
   de verdad del negocio? Se calcula por capas, y CADA capa viaja al
   frontend por separado para que las casillas (comisiones / IVA /
   gastos) se puedan marcar y desmarcar sin volver a consultar nada.

   LA REGLA DEL IVA EN ESTE NEGOCIO
   Los precios del sistema son BRUTOS (IVA incluido), así que el neto de
   una venta es total / 1,19 y el IVA es la diferencia. Calcularlo como
   total × 0,19 da de más y es el error clásico.

     · Ventas CON DTE (boleta/factura) → su IVA es débito fiscal: se le
       debe al SII, no es utilidad.
     · Ventas SIN DTE                  → su IVA se queda en el negocio y
       se registra COMO UTILIDAD (decisión explícita del dueño). Se
       expone siempre como cifra aparte para que quede a la vista, y el
       informe lleva la advertencia de que es una vista de gestión, no
       una declaración de impuestos.
     · Compras CON FACTURA             → su IVA es crédito fiscal y
       rebaja el débito (migración 27).

   IVA a pagar del período = max(0, débito − crédito). Cuando el crédito
   supera al débito no hay devolución: queda REMANENTE que rebaja el IVA
   de los meses siguientes (ver calcularRemanenteIva).
   ============================================================ */
const IVA_TASA = 0.19;

// IVA contenido en un monto bruto (con IVA incluido)
function ivaContenidoEn(montoBruto) {
  const bruto = num(montoBruto);
  return bruto - bruto / (1 + IVA_TASA);
}

/* Débito, crédito y neto de IVA de un rango de fechas.
   Recibe las ventas y los gastos ya consultados para no repetir viajes
   a la base: lo llaman tanto /utilidades como /iva-remanente. */
function calcularIvaDePeriodo(ventas, gastos) {
  let ventasConDte = 0;
  let ventasSinDte = 0;

  (ventas || []).forEach(v => {
    const conDte = v.tipo_dte === 'BOLETA' || v.tipo_dte === 'FACTURA';
    if (conDte) ventasConDte += num(v.total);
    else ventasSinDte += num(v.total);
  });

  const ivaDebito = ivaContenidoEn(ventasConDte);
  // Retenido: el IVA de las ventas sin DTE, que acá cuenta como utilidad
  const ivaRetenidoSinDte = ivaContenidoEn(ventasSinDte);

  const ivaCredito = (gastos || [])
    .filter(g => g.tiene_factura)
    .reduce((a, g) => a + num(g.iva_credito), 0);

  const ivaNeto = ivaDebito - ivaCredito;

  return {
    ventasConDte,
    ventasSinDte,
    ivaDebito,
    ivaCredito,
    ivaRetenidoSinDte,
    ivaNeto,
    // Lo que efectivamente se entera al SII por este período
    ivaAPagar: Math.max(0, ivaNeto),
    // Si el crédito superó al débito, el sobrante se arrastra
    remanenteGenerado: Math.max(0, -ivaNeto)
  };
}

/* Remanente de crédito fiscal acumulado, mes a mes, al estilo F29.
   Se recorre desde el primer movimiento registrado hasta `hastaFecha`:
     disponible = remanente anterior + crédito del mes + ajustes del mes
     si débito > disponible → se paga la diferencia, remanente queda 0
     si no                  → remanente = disponible − débito
   No se guarda ningún saldo: se recalcula siempre, así que no puede
   quedar desincronizado (mismo criterio que los saldos por canal). */
async function calcularRemanenteIva(hastaFecha) {
  const hasta = hastaFecha || fechaHoyChile();

  const [{ data: ventasRaw }, { data: gastosRaw }, { data: ajustesRaw }] = await Promise.all([
    db.from('ventas').select('fecha, total, tipo_dte').eq('estado', 'PAGADA').lte('fecha', hasta),
    db.from('compras').select('fecha, tiene_factura, iva_credito').lte('fecha', hasta + 'T23:59:59'),
    db.from('iva_ajustes').select('*').lte('fecha', hasta).order('fecha')
  ]);

  const mesDe = (f) => String(f || '').slice(0, 7);          // YYYY-MM
  const meses = {};
  const asegurar = (m) => (meses[m] = meses[m] || { mes: m, debito: 0, credito: 0, ajustes: 0 });

  (ventasRaw || []).forEach(v => {
    if (v.tipo_dte !== 'BOLETA' && v.tipo_dte !== 'FACTURA') return;
    asegurar(mesDe(v.fecha)).debito += ivaContenidoEn(v.total);
  });
  (gastosRaw || []).forEach(g => {
    if (!g.tiene_factura) return;
    asegurar(mesDe(g.fecha)).credito += num(g.iva_credito);
  });
  (ajustesRaw || []).forEach(a => { asegurar(mesDe(a.fecha)).ajustes += num(a.monto); });

  let remanente = 0;
  const detalle = Object.keys(meses).sort().map(m => {
    const f = meses[m];
    const disponible = remanente + f.credito + f.ajustes;
    const aPagar = Math.max(0, f.debito - disponible);
    const remanenteFinal = Math.max(0, disponible - f.debito);
    const fila = {
      mes: m,
      debito: f.debito,
      credito: f.credito,
      ajustes: f.ajustes,
      remanenteInicial: remanente,
      aPagar,
      remanenteFinal
    };
    remanente = remanenteFinal;
    return fila;
  });

  return { remanente, detalle, ajustes: ajustesRaw || [] };
}

/* Serie diaria completa de un rango: los días SIN movimiento entran
   como 0. Es la diferencia entre "vendo $50.000 diarios" y "vendo
   $50.000 los días que abro" — para proyectar caja, los días malos
   pesan tanto como los buenos. */
function construirSerieDiaria(desde, hasta, filas, campoFecha, campoMonto) {
  const acumulado = {};
  (filas || []).forEach(f => {
    const dia = String(f[campoFecha] || '').slice(0, 10);
    if (!dia) return;
    acumulado[dia] = (acumulado[dia] || 0) + num(f[campoMonto]);
  });

  const serie = [];
  const cursor = new Date(desde + 'T00:00:00Z');
  const fin = new Date(hasta + 'T00:00:00Z');
  // Tope de seguridad: 5 años de días, por si llega un rango absurdo
  let guardia = 0;
  while (cursor <= fin && guardia++ < 1830) {
    const dia = cursor.toISOString().slice(0, 10);
    serie.push({ dia, monto: acumulado[dia] || 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return serie;
}

/* Percentil por interpolación lineal sobre una lista YA ordenada.
   Se usa para los escenarios: el percentil resiste los días atípicos
   mucho mejor que el promedio (una sola venta grande no infla la
   proyección completa). */
function percentilDe(ordenados, p) {
  if (!ordenados.length) return 0;
  if (ordenados.length === 1) return ordenados[0];
  const pos = (ordenados.length - 1) * p;
  const bajo = Math.floor(pos);
  const alto = Math.ceil(pos);
  if (bajo === alto) return ordenados[bajo];
  return ordenados[bajo] + (ordenados[alto] - ordenados[bajo]) * (pos - bajo);
}

/* ------------------------------------------------------------
   GET /api/finanzas/utilidades?desde=&hasta=
   El informe completo, por capas. El frontend arma la utilidad final
   según qué casillas estén marcadas — acá viajan TODAS las partidas
   calculadas, más el detalle línea por línea para exportar.
   ------------------------------------------------------------ */
app.get('/api/finanzas/utilidades', auth(true), async (req, res) => {
  const desde = (req.query?.desde || '').trim();
  const hasta = (req.query?.hasta || '').trim();
  if (!desde || !hasta) return enviarError(res, 400, 'Faltan las fechas del período (desde / hasta)');
  if (desde > hasta) return enviarError(res, 400, 'La fecha inicial no puede ser posterior a la final');

  try {
    const { data: ventasRaw } = await consultarConReintento(() => db.from('ventas')
      .select('id, fecha, numero_orden, cliente, total, costo_total, comision_pos, tipo_dte, metodo_pago, metodo_pago_final, estado')
      .gte('fecha', desde).lte('fecha', hasta).eq('estado', 'PAGADA').order('fecha'));

    const ventas = ventasRaw || [];

    const { data: gastosRaw } = await db.from('compras')
      .select('id, fecha, proveedor, clasificacion, descripcion, costo_total, metodo_pago, origen, gasto_fijo_id, tiene_factura, iva_credito')
      .gte('fecha', desde).lte('fecha', hasta + 'T23:59:59').order('fecha');

    const gastos = gastosRaw || [];

    // --- Ventas ---
    const ingresos = ventas.reduce((a, v) => a + num(v.total), 0);
    const costoVendido = ventas.reduce((a, v) => a + num(v.costo_total), 0);
    const comisiones = ventas.reduce((a, v) => a + num(v.comision_pos), 0);

    /* UTILIDAD BRUTA = lo vendido menos lo que costó comprarlo.
       No descuenta comisiones, IVA ni gastos: esas son las capas que el
       usuario decide con las casillas. */
    const utilidadBruta = ingresos - costoVendido;

    // --- IVA ---
    const iva = calcularIvaDePeriodo(ventas, gastos);

    // --- Gastos, separando fijos de variables (sin doble conteo) ---
    /* Un gasto fijo pagado se guarda como una compra normal con
       gasto_fijo_id (ver /api/finanzas/gastos-fijos-mes). Por eso NO se
       suma aparte: se separa en dos partidas EXCLUYENTES del mismo
       total. Sumar la lista de gastos fijos encima del total de gastos
       los contaría dos veces. */
    const { data: clasifRaw } = await db.from('compra_clasificaciones').select('nombre, grupo');
    const grupoDe = {};
    (clasifRaw || []).forEach(c => { grupoDe[c.nombre] = c.grupo || 'OPERATIVO'; });

    const esInventario = (g) => (grupoDe[g.clasificacion] || 'OPERATIVO') === 'INVENTARIO';

    /* La compra de mercadería (INVENTARIO) no es gasto de utilidad: ya
       se descuenta como costo de lo vendido cuando el producto se vende
       (FIFO). Contarla otra vez haría ver pérdidas cada vez que se
       repone stock. Se informa aparte, no se resta. */
    const gastosOperativos = gastos.filter(g => !esInventario(g));
    const comprasInventario = gastos.filter(esInventario)
      .reduce((a, g) => a + num(g.costo_total), 0);

    const gastosFijos = gastosOperativos.filter(g => g.gasto_fijo_id)
      .reduce((a, g) => a + num(g.costo_total), 0);
    const gastosVariables = gastosOperativos.filter(g => !g.gasto_fijo_id)
      .reduce((a, g) => a + num(g.costo_total), 0);
    const totalGastosOperativos = gastosFijos + gastosVariables;
    const totalGastos = gastos.reduce((a, g) => a + num(g.costo_total), 0);

    const porClasificacion = {};
    gastosOperativos.forEach(g => {
      const k = g.clasificacion || 'Sin clasificar';
      porClasificacion[k] = (porClasificacion[k] || 0) + num(g.costo_total);
    });

    // --- Utilidad neta con TODAS las capas descontadas ---
    const utilidadNetaTotal = utilidadBruta - comisiones - iva.ivaAPagar - totalGastosOperativos;

    // Remanente acumulado al cierre del período (contexto para el informe)
    const { remanente: remanenteIva } = await calcularRemanenteIva(hasta);

    res.json({
      periodo: { desde, hasta },
      cantidadVentas: ventas.length,
      ticketPromedio: ventas.length ? ingresos / ventas.length : 0,

      // Capa 0 — bruto
      ingresos,
      costoVendido,
      utilidadBruta,
      margenBruto: ingresos > 0 ? (utilidadBruta / ingresos) * 100 : 0,

      // Capas descontables (el frontend decide cuáles aplicar)
      comisiones,
      iva,
      gastos: {
        fijos: gastosFijos,
        variables: gastosVariables,
        operativos: totalGastosOperativos,
        inventario: comprasInventario,
        total: totalGastos,
        porClasificacion
      },

      // Referencia: todo descontado
      utilidadNetaTotal,
      margenNetoTotal: ingresos > 0 ? (utilidadNetaTotal / ingresos) * 100 : 0,
      remanenteIva,

      // Detalle línea por línea, para las planillas exportadas
      detalleVentas: ventas.map(v => ({
        fecha: v.fecha,
        numero_orden: v.numero_orden,
        cliente: v.cliente,
        tipo_dte: v.tipo_dte || 'SIN DTE',
        metodo_pago: v.metodo_pago_final || v.metodo_pago,
        total: num(v.total),
        costo: num(v.costo_total),
        utilidad: num(v.total) - num(v.costo_total),
        comision: num(v.comision_pos),
        iva: (v.tipo_dte === 'BOLETA' || v.tipo_dte === 'FACTURA') ? ivaContenidoEn(v.total) : 0,
        ivaRetenido: (v.tipo_dte === 'BOLETA' || v.tipo_dte === 'FACTURA') ? 0 : ivaContenidoEn(v.total)
      })),
      detalleGastos: gastos.map(g => ({
        fecha: g.fecha,
        proveedor: g.proveedor,
        clasificacion: g.clasificacion,
        grupo: grupoDe[g.clasificacion] || 'OPERATIVO',
        descripcion: g.descripcion,
        metodo_pago: g.metodo_pago,
        tipo: g.gasto_fijo_id ? 'FIJO' : 'VARIABLE',
        costo_total: num(g.costo_total),
        tiene_factura: !!g.tiene_factura,
        iva_credito: num(g.iva_credito)
      }))
    });
  } catch (e) {
    enviarError(res, 500, e.message || 'No se pudieron calcular las utilidades');
  }
});

/* Remanente de crédito fiscal + su historial de ajustes manuales */
app.get('/api/finanzas/iva-remanente', auth(true), async (req, res) => {
  try {
    const hasta = (req.query?.hasta || '').trim() || fechaHoyChile();
    res.json(await calcularRemanenteIva(hasta));
  } catch (e) {
    enviarError(res, 500, e.message || 'No se pudo calcular el remanente de IVA');
  }
});

/* Ajuste manual del remanente de crédito fiscal.
   Sirve para cargar el remanente que venía de antes del sistema y para
   corregir diferencias contra el F29 real. Delta con motivo obligatorio,
   nunca un saldo absoluto (mismo criterio que los ajustes de saldo). */
app.post('/api/finanzas/iva-ajuste', auth(true), async (req, res) => {
  const monto = num(req.body?.monto);
  const motivo = String(req.body?.motivo || '').trim();

  if (!monto) return enviarError(res, 400, 'El ajuste no puede ser $0');
  if (motivo.length < 5) return enviarError(res, 400, 'Escribe el motivo del ajuste (mínimo 5 caracteres)');

  try {
    const { data, error } = await db.from('iva_ajustes').insert([{
      fecha: (req.body?.fecha || '').trim() || fechaHoyChile(),
      monto,
      motivo,
      usuario: req.usuario?.rol || 'admin'
    }]).select().single();

    if (error) return enviarError(res, 500, error.message);
    res.status(201).json(data);
  } catch (e) {
    enviarError(res, 500, e.message || 'No se pudo guardar el ajuste de IVA');
  }
});

app.delete('/api/finanzas/iva-ajuste/:id', auth(true), exigirPinAdmin, async (req, res) => {
  const { error } = await db.from('iva_ajustes').delete().eq('id', req.params.id);
  if (error) return enviarError(res, 500, error.message);
  res.json({ ok: true });
});

/* ------------------------------------------------------------
   GET /api/finanzas/proyeccion?dias=&historico=
   Calculadora de flujo de caja por escenarios.

   CÓMO SE PROYECTA (y por qué así)
   Se toma la serie DIARIA real de los últimos `historico` días —con los
   días cerrados o sin ventas contando como $0— y se sacan percentiles:

     · Conservador (p25) → 1 de cada 4 días históricos fue peor que esto.
       Es el escenario con el que conviene comprometer plata.
     · Probable (p50, la mediana) → la mitad de los días fue mejor y la
       mitad peor. Es el más realista, y no lo distorsiona una venta
       excepcional como sí lo haría el promedio.
     · Excelente (p75) → solo 1 de cada 4 días fue mejor.

   Se usan percentiles y no el promedio a propósito: en un negocio con
   ventas irregulares, un solo día extraordinario levanta el promedio y
   hace proyectar plata que normalmente no llega.
   ------------------------------------------------------------ */
app.get('/api/finanzas/proyeccion', auth(true), async (req, res) => {
  const dias = Math.min(365, Math.max(1, Math.round(num(req.query?.dias) || 30)));
  const historico = Math.min(730, Math.max(14, Math.round(num(req.query?.historico) || 90)));

  try {
    const hasta = fechaHoyChile();
    const inicio = new Date(hasta + 'T00:00:00Z');
    inicio.setUTCDate(inicio.getUTCDate() - (historico - 1));
    const desde = inicio.toISOString().slice(0, 10);

    const [{ data: ventasRaw }, { data: gastosRaw }] = await Promise.all([
      db.from('ventas').select('fecha, total, comision_pos')
        .gte('fecha', desde).lte('fecha', hasta).eq('estado', 'PAGADA'),
      db.from('compras').select('fecha, costo_total, metodo_pago, origen')
        .gte('fecha', desde).lte('fecha', hasta + 'T23:59:59')
    ]);

    const ventas = ventasRaw || [];
    // Las mermas no son dinero que salió del bolsillo: es stock perdido
    const gastos = (gastosRaw || []).filter(g => g.origen !== 'MERMA');

    const serieIngresos = construirSerieDiaria(desde, hasta, ventas, 'fecha', 'total');
    const serieEgresos = construirSerieDiaria(desde, hasta, gastos, 'fecha', 'costo_total');

    const egresosPorDia = {};
    serieEgresos.forEach(d => { egresosPorDia[d.dia] = d.monto; });

    // Neto diario = lo que entró menos lo que salió, ese mismo día
    const serieNeta = serieIngresos.map(d => ({
      dia: d.dia,
      ingreso: d.monto,
      egreso: egresosPorDia[d.dia] || 0,
      neto: d.monto - (egresosPorDia[d.dia] || 0)
    }));

    const ordIngresos = serieIngresos.map(d => d.monto).sort((a, b) => a - b);
    const ordEgresos = serieEgresos.map(d => d.monto).sort((a, b) => a - b);

    const diasConVenta = serieIngresos.filter(d => d.monto > 0).length;
    const totalIngresos = ordIngresos.reduce((a, b) => a + b, 0);
    const totalEgresos = ordEgresos.reduce((a, b) => a + b, 0);

    /* Un escenario combina DOS percentiles opuestos, no uno solo.
       Ser conservador es esperar poco ingreso Y bastante gasto: usar el
       p25 para los dos lados asumiría que también gastas poco, que es
       justo lo contrario de conservador. Por eso el escenario malo toma
       ingresos bajos (p25) contra gastos altos (p75), y el bueno al
       revés. Así, además, la tarjeta cuadra: neto = ingreso − gasto,
       en vez de venir de una tercera distribución que no suma con las
       otras dos líneas que se muestran. */
    const escenario = (nombre, pIngreso, pEgreso, descripcion) => {
      const ingresoDiario = percentilDe(ordIngresos, pIngreso);
      const egresoDiario = percentilDe(ordEgresos, pEgreso);
      const netoDiario = ingresoDiario - egresoDiario;
      return {
        nombre,
        percentil: Math.round(pIngreso * 100),
        percentilGasto: Math.round(pEgreso * 100),
        descripcion,
        ingresoDiario,
        egresoDiario,
        netoDiario,
        ingresoProyectado: ingresoDiario * dias,
        egresoProyectado: egresoDiario * dias,
        netoProyectado: netoDiario * dias
      };
    };

    /* Resguardo mínimo de caja: el colchón que el dueño definió y que no
       se debería tocar. La calculadora lo resta de lo proyectado para
       responder "¿cuánto puedo gastar sin quedar en riesgo?".
       La columna es `resguardo_caja` (no `resguardo_minimo`) y la fila
       de configuración es siempre la id=1, igual que en /api/finanzas/saldos. */
    let resguardo = 0;
    try {
      const { data: cfg } = await db.from('config_finanzas').select('*').eq('id', 1).maybeSingle();
      resguardo = num(cfg?.resguardo_caja);
    } catch (_) { resguardo = 0; }

    res.json({
      parametros: { dias, historico, desde, hasta },
      historia: {
        diasAnalizados: serieIngresos.length,
        diasConVenta,
        diasSinVenta: serieIngresos.length - diasConVenta,
        totalIngresos,
        totalEgresos,
        promedioIngresoDiario: serieIngresos.length ? totalIngresos / serieIngresos.length : 0,
        promedioEgresoDiario: serieIngresos.length ? totalEgresos / serieIngresos.length : 0,
        mejorDia: ordIngresos.length ? ordIngresos[ordIngresos.length - 1] : 0,
        peorDia: ordIngresos.length ? ordIngresos[0] : 0
      },
      escenarios: [
        escenario('Conservador', 0.25, 0.75,
          'Ingresos bajos y gastos altos a la vez: 1 de cada 4 días vendiste menos que esto y 1 de cada 4 gastaste más. Es el piso con el que conviene comprometer dinero.'),
        escenario('Probable', 0.50, 0.50,
          'La mitad de los días fue mejor y la mitad peor, tanto en ventas como en gastos. El escenario más realista.'),
        escenario('Excelente', 0.75, 0.25,
          'Ingresos altos y gastos bajos: solo 1 de cada 4 días fue mejor. No comprometas gastos contra este número.')
      ],
      resguardo,
      serieNeta
    });
  } catch (e) {
    enviarError(res, 500, e.message || 'No se pudo calcular la proyección');
  }
});

/* ------------------------------------------------------------
   DELETE /api/finanzas/balance?desde=&hasta=&incluir=ventas,gastos,...
   Borrado contable por período. Operación destructiva y sin vuelta
   atrás, por eso: rol admin + PIN + rango de fechas OBLIGATORIO (no
   existe un "borrar todo" sin fechas por accidente) + lista explícita
   de qué se borra.

   Las ventas se borran con revertirEfectosDeVentas(), que devuelve el
   stock igual que el borrado individual: si no, el inventario quedaría
   descuadrado para siempre.
   ------------------------------------------------------------ */
app.delete('/api/finanzas/balance', auth(true), exigirPinAdmin, async (req, res) => {
  const desde = String(req.query?.desde || req.body?.desde || '').trim();
  const hasta = String(req.query?.hasta || req.body?.hasta || '').trim();

  if (!desde || !hasta) return enviarError(res, 400, 'Indica el rango de fechas a borrar');
  if (desde > hasta) return enviarError(res, 400, 'La fecha inicial no puede ser posterior a la final');

  const pedido = String(req.query?.incluir || req.body?.incluir || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

  const VALIDOS = ['ventas', 'gastos', 'aportes', 'arqueos'];
  const incluir = pedido.filter(p => VALIDOS.includes(p));
  if (!incluir.length) {
    return enviarError(res, 400, `Indica qué borrar: ${VALIDOS.join(', ')}`);
  }

  const hastaFin = hasta + 'T23:59:59';
  const borrado = {};

  try {
    if (incluir.includes('ventas')) {
      const { data: filas, error } = await db.from('ventas').select('id')
        .gte('fecha', desde).lte('fecha', hasta);
      if (error) throw new Error(error.message);

      const ids = (filas || []).map(f => f.id);
      if (ids.length) {
        // Devuelve el stock antes de borrar: mismo camino que el borrado individual
        await revertirEfectosDeVentas(ids);
        const { error: errDel } = await db.from('ventas').delete().in('id', ids);
        if (errDel) throw new Error(errDel.message);
      }
      borrado.ventas = ids.length;
    }

    if (incluir.includes('gastos')) {
      const { data: filas, error } = await db.from('compras').select('id')
        .gte('fecha', desde).lte('fecha', hastaFin);
      if (error) throw new Error(error.message);

      const ids = (filas || []).map(f => f.id);
      if (ids.length) {
        const { error: errDel } = await db.from('compras').delete().in('id', ids);
        if (errDel) throw new Error(errDel.message);
      }
      borrado.gastos = ids.length;
    }

    if (incluir.includes('aportes')) {
      const { data: filas, error } = await db.from('inyecciones_capital').select('id')
        .gte('fecha', desde).lte('fecha', hasta);
      if (error) throw new Error(error.message);

      const ids = (filas || []).map(f => f.id);
      if (ids.length) {
        const { error: errDel } = await db.from('inyecciones_capital').delete().in('id', ids);
        if (errDel) throw new Error(errDel.message);
      }
      borrado.aportes = ids.length;
    }

    if (incluir.includes('arqueos')) {
      /* Arqueos, ajustes de saldo y traspasos: los tres afectan el saldo
         por canal, así que se borran juntos o el saldo queda a medias.
         OJO con la columna de fecha: `ajustes_saldo` no tiene `fecha`,
         solo `creado_en` (ver sql/16) — filtrar por `fecha` ahí devuelve
         error, no cero filas. Por eso cada tabla declara la suya. */
      const TABLAS_SALDO = [
        { tabla: 'arqueos', campo: 'fecha' },
        { tabla: 'ajustes_saldo', campo: 'creado_en' },
        { tabla: 'traspasos', campo: 'fecha' }
      ];

      let n = 0;
      for (const { tabla, campo } of TABLAS_SALDO) {
        try {
          const { data: filas, error } = await db.from(tabla).select('id')
            .gte(campo, desde).lte(campo, hastaFin);
          if (error) throw new Error(error.message);

          const ids = (filas || []).map(f => f.id);
          if (ids.length) {
            await db.from(tabla).delete().in('id', ids);
            n += ids.length;
          }
        } catch (err) {
          // Una tabla ausente en una instalación vieja no debe abortar el resto
          console.warn(`[BALANCE] no se pudo borrar ${tabla}:`, err.message);
        }
      }
      borrado.arqueos = n;
    }

    console.warn('[BALANCE] borrado por período', { desde, hasta, incluir, borrado });
    res.json({ ok: true, periodo: { desde, hasta }, borrado });
  } catch (e) {
    enviarError(res, 500, e.message || 'No se pudo completar el borrado del período');
  }
});

app.get('/api/caja/activa', auth(), async (req, res) => {
  const { data, error } = await consultarConReintento(() => db.from('cajas_diarias')
    .select('*').eq('estado', 'abierta')
    .order('fecha_apertura', { ascending: false }).limit(1).maybeSingle());
  if (error) {
    if (esErrorJwtTransitorio(error.message)) {
      console.warn('[CAJA] Supabase rechazó la llave por reloj/JWT tras reintentar:', error.message);
      return enviarError(res, 503, 'La base de datos no respondió a tiempo. Intenta de nuevo en unos segundos.');
    }
    return enviarError(res, 500, error.message);
  }
  if (!data) return res.json({ activa: null });

  // Se adjuntan los movimientos del turno, para el resumen en el POS
  const { data: movs } = await db.from('caja_movimientos')
    .select('*').eq('caja_id', data.id).order('creado_en', { ascending: false });
  res.json({ activa: data, movimientos: movs || [] });
});

// Abre un turno. Rechaza si ya hay uno abierto.
app.post('/api/caja/abrir', auth(), async (req, res) => {
  const fondo = num(req.body?.fondo_inicial);
  if (fondo < 0) return enviarError(res, 400, 'El fondo inicial no puede ser negativo');

  const { data: yaAbierta } = await consultarConReintento(() => db.from('cajas_diarias')
    .select('id').eq('estado', 'abierta').limit(1).maybeSingle());
  if (yaAbierta) return enviarError(res, 400, 'Ya hay una caja abierta. Ciérrala antes de abrir otra.');

  const { data, error } = await consultarConReintento(() => db.from('cajas_diarias').insert([{
    fondo_inicial: fondo,
    estado: 'abierta',
    abierta_por: req.usuario?.rol || null
  }]).select().single());
  if (error) {
    if (esErrorJwtTransitorio(error.message)) {
      console.warn('[CAJA] Supabase rechazó la llave por reloj/JWT tras reintentar:', error.message);
      return enviarError(res, 503, 'La base de datos no respondió a tiempo. Intenta de nuevo en unos segundos.');
    }
    return enviarError(res, 500, error.message);
  }
  res.status(201).json(data);
});

// Registra un ingreso o egreso rápido de caja chica en el turno abierto.
app.post('/api/caja/movimiento', auth(), async (req, res) => {
  const tipo = String(req.body?.tipo || '').trim().toUpperCase();
  const monto = num(req.body?.monto);
  const concepto = String(req.body?.concepto || '').trim();

  if (tipo !== 'INGRESO' && tipo !== 'EGRESO') return enviarError(res, 400, 'Tipo inválido (INGRESO o EGRESO)');
  if (!(monto > 0)) return enviarError(res, 400, 'El monto debe ser mayor a 0');
  if (concepto.length < 2) return enviarError(res, 400, 'Escribe un concepto para el movimiento');

  const { data: caja } = await db.from('cajas_diarias')
    .select('id').eq('estado', 'abierta').limit(1).maybeSingle();
  if (!caja) return enviarError(res, 400, 'No hay una caja abierta');

  const { data, error } = await db.from('caja_movimientos').insert([{
    caja_id: caja.id, tipo, monto, concepto
  }]).select().single();
  if (error) return enviarError(res, 500, error.message);
  res.status(201).json(data);
});

// Cierra el turno con arqueo. Calcula el efectivo esperado en el servidor.
app.post('/api/caja/cerrar', auth(), async (req, res) => {
  const contado = num(req.body?.efectivo_contado);
  const notas = String(req.body?.notas_cierre || '').trim() || null;

  const { data: caja } = await consultarConReintento(() => db.from('cajas_diarias')
    .select('*').eq('estado', 'abierta').limit(1).maybeSingle());
  if (!caja) return enviarError(res, 400, 'No hay una caja abierta que cerrar');

  /* Efectivo esperado = fondo + ventas en efectivo del turno + ingresos
     - egresos. Todo se recalcula en el servidor: el cliente no manda
     cifras que afecten el arqueo, solo el efectivo que contó. */
  const { data: ventasCaja } = await db.from('ventas')
    .select('total, metodo_pago, metodo_pago_final, estado')
    .eq('caja_id', caja.id).eq('estado', 'PAGADA');

  let ventasEfectivo = 0;
  (ventasCaja || []).forEach(v => {
    const m = v.metodo_pago_final || v.metodo_pago;
    if (esEfectivo(m)) ventasEfectivo += num(v.total);
  });

  const { data: movs } = await db.from('caja_movimientos').select('tipo, monto').eq('caja_id', caja.id);
  let ingresos = 0, egresos = 0;
  (movs || []).forEach(m => { if (m.tipo === 'INGRESO') ingresos += num(m.monto); else egresos += num(m.monto); });

  const esperado = num(caja.fondo_inicial) + ventasEfectivo + ingresos - egresos;
  const diferencia = contado - esperado;

  const { data, error } = await consultarConReintento(() => db.from('cajas_diarias').update({
    estado: 'cerrada',
    fecha_cierre: new Date().toISOString(),
    efectivo_esperado: esperado,
    efectivo_contado: contado,
    diferencia,
    notas_cierre: notas,
    cerrada_por: req.usuario?.rol || null
  }).eq('id', caja.id).select().single());
  if (error) {
    if (esErrorJwtTransitorio(error.message)) {
      console.warn('[CAJA] Supabase rechazó la llave por reloj/JWT tras reintentar:', error.message);
      return enviarError(res, 503, 'La base de datos no respondió a tiempo. Intenta de nuevo en unos segundos.');
    }
    return enviarError(res, 500, error.message);
  }

  res.json({ ...data, detalle: { fondo_inicial: num(caja.fondo_inicial), ventasEfectivo, ingresos, egresos, esperado, contado, diferencia } });
});

app.get('/api/finanzas/saldos', auth(true), async (req, res) => {
  try {
    // Solo ventas efectivamente cobradas (PAGADA) cuentan como dinero real
    const { data: ventasRaw } = await db.from('ventas')
      .select('id, total, comision_pos, metodo_pago, metodo_pago_final, pago_mixto, estado')
      .eq('estado', 'PAGADA');
    const ventas = ventasRaw || [];
    const ids = ventas.map(v => v.id);

    let pagos = [];
    if (ids.length) {
      // Se pide en tandas para no exceder límites de URL con muchas ventas
      for (let i = 0; i < ids.length; i += 300) {
        const trozo = ids.slice(i, i + 300);
        const { data } = await db.from('venta_pagos').select('*').in('venta_id', trozo);
        if (data) pagos = pagos.concat(data);
      }
    }
    const pagosPorVenta = {};
    pagos.forEach(p => { (pagosPorVenta[p.venta_id] = pagosPorVenta[p.venta_id] || []).push(p); });

    let ventasEfectivo = 0, ventasBanco = 0;
    ventas.forEach(v => {
      const desglose = pagosPorVenta[v.id];
      if (v.pago_mixto && desglose?.length) {
        desglose.forEach(p => {
          if (esEfectivo(p.metodo)) ventasEfectivo += num(p.monto);
          else ventasBanco += num(p.monto);
        });
      } else {
        const m = v.metodo_pago_final || v.metodo_pago;
        if (esEfectivo(m)) ventasEfectivo += num(v.total);
        else ventasBanco += num(v.total);
      }
    });

    // Comisiones del POS: salen del abono bancario (las cobra la máquina)
    const comisiones = ventas.reduce((a, v) => a + num(v.comision_pos), 0);

    // Gastos (compras). Las mermas no son salida de dinero.
    const { data: gastosRaw } = await db.from('compras')
      .select('costo_total, origen, metodo_pago').limit(100000);
    const gastos = gastosRaw || [];
    let gastosEfectivo = 0, gastosBanco = 0;
    gastos.forEach(g => {
      if (g.origen === 'MERMA') return;
      if (esEfectivo(g.metodo_pago)) gastosEfectivo += num(g.costo_total);
      else gastosBanco += num(g.costo_total);
    });

    // Inyecciones de capital
    const { data: inyRaw } = await db.from('inyecciones_capital').select('monto, metodo').limit(100000);
    const inyecciones = inyRaw || [];
    let inyEfectivo = 0, inyBanco = 0;
    inyecciones.forEach(i => {
      if (esEfectivo(i.metodo)) inyEfectivo += num(i.monto);
      else inyBanco += num(i.monto);
    });

    // Fondo inicial: suma de los fondos de arqueo (base del cajón)
    const { data: arqueosRaw } = await db.from('arqueos').select('fondo_inicial').limit(100000);
    const fondoInicial = (arqueosRaw || []).reduce((a, x) => a + num(x.fondo_inicial), 0);

    // Traspasos internos entre canales
    const { data: traspRaw } = await db.from('traspasos').select('origen, destino, monto').limit(100000);
    let traspAEfectivo = 0, traspDeEfectivo = 0, traspABanco = 0, traspDeBanco = 0;
    (traspRaw || []).forEach(t => {
      if (t.destino === 'EFECTIVO') traspAEfectivo += num(t.monto);
      if (t.origen === 'EFECTIVO') traspDeEfectivo += num(t.monto);
      if (t.destino === 'BANCO') traspABanco += num(t.monto);
      if (t.origen === 'BANCO') traspDeBanco += num(t.monto);
    });

    /* Ajustes manuales de saldo (req. 3). Cada ajuste guarda un DELTA que
       se suma al canal: si contaste el cajón y sobraban $3.000, hay un
       ajuste de +3000 en EFECTIVO. No reescriben el saldo, lo corrigen. */
    const { data: ajustesRaw } = await db.from('ajustes_saldo').select('canal, delta').limit(100000);
    let ajusteEfectivo = 0, ajusteBanco = 0;
    (ajustesRaw || []).forEach(a => {
      if (a.canal === 'EFECTIVO') ajusteEfectivo += num(a.delta);
      if (a.canal === 'BANCO') ajusteBanco += num(a.delta);
    });

    const efectivo = fondoInicial + ventasEfectivo + inyEfectivo + traspAEfectivo + ajusteEfectivo
                   - gastosEfectivo - traspDeEfectivo;
    const banco = ventasBanco + inyBanco + traspABanco + ajusteBanco
                - gastosBanco - comisiones - traspDeBanco;

    // Compromisos fijos activos, para las alertas de cobertura
    const { data: fijosRaw } = await db.from('gastos_fijos').select('*').eq('activo', true);

    // Configuración (resguardo mínimo, ventana de días)
    const { data: cfgRaw } = await db.from('config_finanzas').select('*').eq('id', 1).maybeSingle();
    const config = cfgRaw || { resguardo_caja: 0, dias_alerta: 15 };

    res.json({
      efectivo,
      banco,
      total: efectivo + banco,
      detalle: {
        fondoInicial,
        ventasEfectivo, ventasBanco,
        inyEfectivo, inyBanco,
        gastosEfectivo, gastosBanco,
        comisiones,
        traspAEfectivo, traspDeEfectivo, traspABanco, traspDeBanco,
        ajusteEfectivo, ajusteBanco
      },
      gastosFijos: fijosRaw || [],
      config: {
        resguardo_caja: num(config.resguardo_caja),
        dias_alerta: parseInt(config.dias_alerta, 10) || 15
      }
    });
  } catch (e) {
    enviarError(res, 500, e.message || 'No se pudieron calcular los saldos');
  }
});

/* ============================================================
   CHECKLIST DE GASTOS FIJOS DEL MES (req. 4)
   ------------------------------------------------------------
   Devuelve cada gasto fijo activo con si YA se pagó este mes o no, y el
   total pendiente. "Pagado" = existe una compra de este mes vinculada a
   ese gasto fijo (gasto_fijo_id) o, para compras antiguas sin ese
   vínculo, una compra cuya descripción empieza con "Gasto fijo: <nombre>".

   El resguardo dinámico usa el total pendiente: no tiene sentido
   resguardar plata para algo que ya se pagó.
   ============================================================ */
app.get('/api/finanzas/gastos-fijos-mes', auth(true), async (req, res) => {
  try {
    const hoy = fechaHoyChile();              // YYYY-MM-DD (Chile)
    const [anio, mes] = hoy.split('-');
    const desdeMes = `${anio}-${mes}-01`;
    const hastaMes = `${anio}-${mes}-31T23:59:59`;

    const { data: fijosRaw } = await db.from('gastos_fijos').select('*').eq('activo', true);
    const fijos = fijosRaw || [];

    // Compras del mes: sirven para saber qué gasto fijo ya se pagó
    const { data: comprasRaw } = await db.from('compras')
      .select('gasto_fijo_id, descripcion, costo_total')
      .gte('fecha', desdeMes).lte('fecha', hastaMes);
    const compras = comprasRaw || [];

    const pagadosPorId = new Set(compras.map(c => c.gasto_fijo_id).filter(Boolean));

    const items = fijos.map(f => {
      // Pagado por vínculo directo, o por descripción (compras antiguas)
      const pagadoPorVinculo = pagadosPorId.has(f.id);
      const pagadoPorTexto = compras.some(c =>
        String(c.descripcion || '').toLowerCase().startsWith(`gasto fijo: ${String(f.nombre).toLowerCase()}`));
      const pagado = pagadoPorVinculo || pagadoPorTexto;
      return {
        id: f.id,
        nombre: f.nombre,
        monto: num(f.monto),
        dia_mes: f.dia_mes,
        clasificacion: f.clasificacion || null,
        pagado
      };
    });

    const totalMes = items.reduce((a, i) => a + i.monto, 0);
    const totalPagado = items.filter(i => i.pagado).reduce((a, i) => a + i.monto, 0);
    const totalPendiente = totalMes - totalPagado;

    res.json({
      periodo: { anio: Number(anio), mes: Number(mes) },
      items,
      totalMes,
      totalPagado,
      totalPendiente,
      cantidadPendiente: items.filter(i => !i.pagado).length
    });
  } catch (e) {
    enviarError(res, 500, e.message || 'No se pudo calcular el checklist de gastos fijos');
  }
});

/* ============================================================
   AJUSTES MANUALES DE SALDO (req. 3)
   ------------------------------------------------------------
   Corrige el saldo de un canal cuando la realidad no cuadra con lo
   calculado. Guarda un DELTA con justificación obligatoria. El total no
   se ajusta nunca: se calcula como efectivo + banco.
   ============================================================ */
app.post('/api/finanzas/ajuste-saldo', auth(true), async (req, res) => {
  const canal = String(req.body?.canal || '').trim().toUpperCase();
  const motivo = String(req.body?.motivo || '').trim();
  const saldoNuevo = num(req.body?.saldo_nuevo);
  const saldoAnterior = num(req.body?.saldo_anterior);

  if (canal !== 'EFECTIVO' && canal !== 'BANCO') {
    return enviarError(res, 400, 'El canal debe ser EFECTIVO o BANCO');
  }
  // La justificación es obligatoria: un ajuste sin motivo tapa errores
  if (motivo.length < 3) {
    return enviarError(res, 400, 'La justificación es obligatoria (mínimo 3 caracteres)');
  }

  const delta = saldoNuevo - saldoAnterior;
  if (delta === 0) return enviarError(res, 400, 'El saldo nuevo es igual al actual: no hay nada que ajustar');

  const { data, error } = await db.from('ajustes_saldo').insert([{
    canal, delta,
    saldo_anterior: saldoAnterior,
    saldo_nuevo: saldoNuevo,
    motivo,
    rol: req.usuario?.rol || null
  }]).select().single();

  if (error) return enviarError(res, 500, error.message);
  res.status(201).json(data);
});

/* Historial de ajustes manuales (para el pop-up de consulta) */
app.get('/api/finanzas/ajustes-saldo', auth(true), async (req, res) => {
  let q = db.from('ajustes_saldo').select('*').order('creado_en', { ascending: false });
  const canal = String(req.query?.canal || '').trim().toUpperCase();
  if (canal === 'EFECTIVO' || canal === 'BANCO') q = q.eq('canal', canal);

  const { data, error } = await q.limit(limiteDe(req));
  if (error) return enviarError(res, 500, error.message);
  res.json(data || []);
});

/* Traspaso interno de dinero entre canales (no es ingreso ni gasto) */
app.post('/api/finanzas/traspaso', auth(true), async (req, res) => {
  const origen = String(req.body?.origen || '').trim().toUpperCase();
  const destino = String(req.body?.destino || '').trim().toUpperCase();
  const monto = num(req.body?.monto);

  const CANALES = ['EFECTIVO', 'BANCO'];
  if (!CANALES.includes(origen) || !CANALES.includes(destino)) {
    return enviarError(res, 400, 'Origen y destino deben ser EFECTIVO o BANCO');
  }
  if (origen === destino) return enviarError(res, 400, 'El origen y el destino no pueden ser iguales');
  if (!(monto > 0)) return enviarError(res, 400, 'El monto del traspaso debe ser mayor a 0');

  const fila = {
    origen, destino, monto,
    fecha: (req.body?.fecha || '').trim() || fechaHoyChile(),
    banco: (req.body?.banco || '').trim() || null,
    nota: (req.body?.nota || '').trim() || null
  };
  const { data, error } = await db.from('traspasos').insert([fila]).select().single();
  if (error) return enviarError(res, 500, error.message);
  res.status(201).json(data);
});

/* Historial de traspasos (para poder revisarlos y eliminarlos) */
app.get('/api/finanzas/traspasos', auth(true), async (req, res) => {
  const { data, error } = await db.from('traspasos')
    .select('*').order('fecha', { ascending: false }).order('id', { ascending: false })
    .limit(limiteDe(req));
  if (error) return enviarError(res, 500, error.message);
  res.json(data || []);
});

app.delete('/api/finanzas/traspaso/:id', auth(true), exigirPinAdmin, async (req, res) => {
  const { error } = await db.from('traspasos').delete().eq('id', req.params.id);
  if (error) return enviarError(res, 500, error.message);
  res.json({ ok: true });
});

/* Configuración de Finanzas: resguardo mínimo de caja y ventana de alerta */
app.put('/api/finanzas/config', auth(true), async (req, res) => {
  const fila = {
    id: 1,
    resguardo_caja: Math.max(0, num(req.body?.resguardo_caja)),
    dias_alerta: Math.min(60, Math.max(1, parseInt(req.body?.dias_alerta, 10) || 15)),
    actualizado_en: new Date().toISOString()
  };
  const { data, error } = await db.from('config_finanzas')
    .upsert([fila], { onConflict: 'id' }).select().single();
  if (error) return enviarError(res, 500, error.message);
  res.json(data);
});

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

    /* FILE-01 — RUTA NO ENUMERABLE.
       ------------------------------------------------------------
       Antes la ruta era AÑO/<Date.now()>_nombre. El timestamp es
       predecible: quien supiera cuándo se subió un comprobante podía
       tantear la URL pública y bajar facturas de proveedores sin
       autenticarse. Un UUID aleatorio hace la ruta imposible de adivinar. */
    const ruta = `${new Date().getFullYear()}/${crypto.randomUUID()}_${limpio}`;

    const { error } = await db.storage.from('compras-documentos')
      .upload(ruta, buffer, { contentType: tipo || 'application/octet-stream', upsert: false });
    if (error) throw new Error(error.message);

    /* FILE-01 — URL FIRMADA EN VEZ DE PÚBLICA.
       ------------------------------------------------------------
       getPublicUrl exige un bucket público: cualquiera con el enlace
       (o que lo adivine) entra. createSignedUrl entrega un enlace que
       caduca, y solo se obtiene pasando por este endpoint autenticado.

       REQUISITO DE CONFIGURACIÓN: el bucket 'compras-documentos' debe
       estar en PRIVADO en Supabase → Storage. Si sigue público, esto
       funciona igual pero el archivo también seguiría accesible por su
       URL pública; ponerlo en privado es lo que cierra el hallazgo.

       Se guarda la RUTA (no la URL) en la base: la URL caduca, la ruta
       no, y se vuelve a firmar cuando alguien quiera abrir el documento. */
    const { data, error: errFirma } = await db.storage.from('compras-documentos')
      .createSignedUrl(ruta, 60 * 60);   // 1 hora
    if (errFirma) throw new Error(errFirma.message);

    /* Se devuelven las dos cosas:
         url  → firmada, para ver el archivo ahora mismo (caduca en 1h).
         ruta → estable, es lo que se guarda en la compra para poder
                volver a firmar cuando alguien abra el documento otro día. */
    res.status(201).json({ url: data.signedUrl, ruta });
  } catch (err) {
    enviarError(res, 500, err.message || 'No se pudo subir el archivo');
  }
});

/* FILE-01 — RE-FIRMAR UN DOCUMENTO YA GUARDADO.
   ------------------------------------------------------------
   Como las URLs firmadas caducan, la compra guarda la RUTA del archivo,
   no un enlace. Cuando el admin quiere abrir un comprobante, el front
   pide aquí una URL fresca. Requiere sesión admin: los documentos de
   compra son información de costos.

   Compatibilidad: si en la base quedó guardada una URL pública antigua
   (de antes de este cambio) en vez de una ruta, el front la abre directo
   y no llama aquí. Este endpoint es solo para las rutas nuevas. */
app.post('/api/compras/firmar', auth(true), async (req, res) => {
  const ruta = String(req.body?.ruta || '').trim();
  if (!ruta) return enviarError(res, 400, 'Falta la ruta del archivo');

  // Defensa: la ruta debe quedar dentro del bucket, sin subir de carpeta
  if (ruta.includes('..') || ruta.startsWith('/')) {
    return enviarError(res, 400, 'Ruta de archivo inválida');
  }

  try {
    const { data, error } = await db.storage.from('compras-documentos')
      .createSignedUrl(ruta, 60 * 60);
    if (error) throw new Error(error.message);
    res.json({ url: data.signedUrl });
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

  const { data, error } = await consultarConReintento(() => {
    let q = db.from('ordenes_trabajo').select('*').order('id', { ascending: false });
    if (estado) q = q.eq('estado', estado);
    return q;
  });
  if (error) {
    if (esErrorJwtTransitorio(error.message)) {
      console.warn('[OT] Supabase rechazó la llave por reloj/JWT tras reintentar:', error.message);
      return enviarError(res, 503, 'La base de datos no respondió a tiempo. Intenta de nuevo en unos segundos.');
    }
    return enviarError(res, 500, error.message);
  }

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

  const { data, error } = await q.limit(limiteDe(req));
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

/* ---------- E-commerce (sevelin-tienda, repo aparte) ---------- */
/* Fase 3 del e-commerce (ver README-ECOMMERCE-SEVELIN.md sección 5): el
   backend de la tienda llama acá justo después de confirmar un pago real
   con Flow (getStatus, nunca el body del webhook), para descontar el
   stock vendido por ese canal. Reutiliza descontarStockNoLotes() tal cual
   (línea ~1073): agrupa por producto_id y llama a la RPC atómica
   descontar_stock_venta (sql/19-stock-atomico.sql), la misma que ya usa
   POST /api/ventas — un producto sin stock suficiente lanza y no se
   descuenta nada, en vez de dejar el stock a medias. */
app.post('/api/interno/ajustar-stock', authSync, async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) return enviarError(res, 400, 'Falta items');

  try {
    const descontados = await descontarStockNoLotes(items);
    res.json({ ok: true, producto_ids_descontados: [...descontados] });
  } catch (err) {
    // STOCK_INSUFICIENTE u otro error de la RPC: se informa tal cual,
    // sevelin-tienda decide qué hacer con el pedido ya pagado (queda
    // logueado para revisión manual, no hay reconciliación automática
    // en esta fase).
    enviarError(res, 409, err.message);
  }
});

/* Panel "Pedidos Web" (Fase 5, README sección 2.1): lectura + cambio de
   estado de despacho de los pedidos que llegan de sevelin-tienda. Usa
   `dbWeb` (Supabase Web), NUNCA `db` (Supabase del POS) — son proyectos
   distintos. auth(true): el README lo pide explícito, es una vista de
   administración, no logística general como /api/ventas/:id/envio. */
const ESTADOS_DESPACHO_PEDIDO_WEB = ['PREPARANDO', 'ENVIADO', 'ENTREGADO', 'CANCELADO'];

app.get('/api/pos/pedidos-web', auth(true), async (req, res) => {
  let q = dbWeb.from('pedidos_web').select('*').order('creado_en', { ascending: false });
  if (req.query.estado) q = q.eq('estado', String(req.query.estado));

  const { data, error } = await q;
  if (error) return enviarError(res, 500, error.message);
  res.json(data || []);
});

app.put('/api/pos/pedidos-web/:id', auth(true), async (req, res) => {
  const cambios = {};

  if (req.body?.estado !== undefined) {
    const estado = String(req.body.estado || '').trim().toUpperCase();
    if (!ESTADOS_DESPACHO_PEDIDO_WEB.includes(estado)) {
      return enviarError(res, 400, 'Estado inválido: solo PREPARANDO/ENVIADO/ENTREGADO/CANCELADO');
    }
    cambios.estado = estado;
  }
  if (req.body?.tracking_courier !== undefined) {
    cambios.tracking_courier = String(req.body.tracking_courier || '').trim() || null;
  }
  if (Object.keys(cambios).length === 0) return enviarError(res, 400, 'Nada que actualizar');

  // El pedido tiene que estar pagado (o más avanzado) para tener algo que
  // despachar — CREADO/FALLIDO son estados del ciclo de pago, controlados
  // por el mutex de POST /api/flow-webhook en sevelin-tienda, no por este
  // panel.
  const { data: actual, error: errorActual } = await dbWeb
    .from('pedidos_web').select('estado, items').eq('id', req.params.id).single();
  if (errorActual) return enviarError(res, 404, 'Pedido no encontrado');
  if (['CREADO', 'FALLIDO'].includes(actual.estado)) {
    return enviarError(res, 409, 'Este pedido todavía no tiene el pago confirmado');
  }

  const { data, error } = await dbWeb.from('pedidos_web')
    .update(cambios).eq('id', req.params.id).select().single();
  if (error) return enviarError(res, 500, error.message);

  /* Reponer stock al cancelar es OPCIONAL y explícito (checkbox en el
     modal de cancelación) — un pedido puede cancelarse recién pagado (el
     producto nunca salió de la bodega) o ya despachado (el producto ya
     salió, reponer stock ahí dejaría el inventario mostrando más de lo
     que hay). El servidor nunca lo decide solo. items.producto_pos_id es
     el id en la tabla `productos` de ESTE Supabase (POS) — el mismo dato
     que sevelin-tienda ya manda mapeado como producto_id a
     /api/interno/ajustar-stock cuando se DESCUENTA por una venta real;
     acá se usa la misma función (ajustarStock) con signo +1 para
     reponer. Si algo falla acá, el pedido queda cancelado igual — es la
     acción principal — y se avisa en la respuesta para que el trabajador
     lo ajuste a mano si hace falta. */
  let stockRepuesto = false;
  if (cambios.estado === 'CANCELADO' && req.body?.reponer_stock === true) {
    const itemsPos = (actual.items || [])
      .filter(it => it?.producto_pos_id)
      .map(it => ({ producto_id: it.producto_pos_id, cantidad: it.cantidad }));
    if (itemsPos.length) {
      try {
        await ajustarStock(itemsPos, 1);
        stockRepuesto = true;
      } catch (err) {
        console.error('[Pedidos Web] No se pudo reponer stock al cancelar el pedido', req.params.id, ':', err.message);
      }
    }
  }

  /* Correo de cancelación al cliente — mejor esfuerzo, igual que la
     reposición de stock de arriba: si Resend o la tienda no responden, el
     pedido queda cancelado igual (es la acción principal). El POS no
     tiene la API key de Resend ni el template del correo, así que le pide
     a sevelin-tienda que lo mande ella (ver POST /api/pos/notificar-
     cancelacion, mismo SYNC_SECRET de siempre). */
  let correoEnviado = false;
  if (cambios.estado === 'CANCELADO' && TIENDA_NOTIFICAR_CANCELACION_URL && SYNC_SECRET && data?.numero_pedido) {
    try {
      const resp = await fetch(TIENDA_NOTIFICAR_CANCELACION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-sync-secret': SYNC_SECRET },
        body: JSON.stringify({ numero_pedido: data.numero_pedido })
      });
      const cuerpo = await resp.json().catch(() => ({}));
      correoEnviado = !!cuerpo.enviado;
    } catch (err) {
      console.error('[Pedidos Web] No se pudo notificar la cancelación al cliente:', req.params.id, ':', err.message);
    }
  }

  res.json({ ...data, stock_repuesto: stockRepuesto, correo_enviado: correoEnviado });
});

/* Panel "Más buscados" (Página Web → Más buscados): agrega los eventos que
   la tienda registra en `eventos_web` (sevelin-tienda/src/lib/eventos-web.ts)
   cada vez que alguien busca un término o abre una ficha de producto. Usa
   `dbWeb` igual que Pedidos Web arriba — misma tabla, otro proyecto
   Supabase. La agregación se hace acá en JS (no en SQL) porque el volumen
   de una tienda chica no lo justifica y evita depender de una función RPC
   nueva en Supabase Web. */
app.get('/api/pos/mas-buscados', auth(true), async (req, res) => {
  const dias = Math.min(365, Math.max(1, Number(req.query.dias) || 30));
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

  const { data: eventos, error } = await dbWeb
    .from('eventos_web')
    .select('tipo, termino, producto_pos_id')
    .gte('creado_en', desde)
    .limit(5000);
  if (error) return enviarError(res, 500, error.message);

  const conteoBusquedas = new Map(); // clave: término en minúsculas -> { termino (primera aparición), veces }
  const conteoVistas = new Map(); // clave: producto_pos_id -> veces

  (eventos || []).forEach(e => {
    if (e.tipo === 'busqueda' && e.termino) {
      const clave = e.termino.trim().toLowerCase();
      if (!clave) return;
      const actual = conteoBusquedas.get(clave);
      if (actual) actual.veces++;
      else conteoBusquedas.set(clave, { termino: e.termino.trim(), veces: 1 });
    } else if (e.tipo === 'vista_producto' && e.producto_pos_id) {
      conteoVistas.set(e.producto_pos_id, (conteoVistas.get(e.producto_pos_id) || 0) + 1);
    }
  });

  const terminosTop = [...conteoBusquedas.values()].sort((a, b) => b.veces - a.veces).slice(0, 20);

  const productosTopIds = [...conteoVistas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  let productosTop = [];
  if (productosTopIds.length) {
    const { data: productosData } = await db
      .from('productos')
      .select('id, nombre, sku, precio_unitario, publicado_web')
      .in('id', productosTopIds.map(([id]) => id));
    const porId = new Map((productosData || []).map(p => [p.id, p]));
    productosTop = productosTopIds.map(([id, veces]) => ({
      producto_id: id,
      veces,
      // El producto puede haberse borrado desde que se vio — se avisa en
      // vez de romper la lista.
      nombre: porId.get(id)?.nombre || '(producto eliminado)',
      sku: porId.get(id)?.sku || null,
      precio_unitario: porId.get(id)?.precio_unitario ?? null,
      publicado_web: !!porId.get(id)?.publicado_web,
    }));
  }

  res.json({ dias, terminos_mas_buscados: terminosTop, productos_mas_vistos: productosTop });
});

/* Panel "Métricas" (Página Web → Métricas): totales generales del negocio
   online — visitas, carritos compartidos/abandonados/convertidos, cuentas
   de cliente creadas. Todo son `count` con `head:true` (PostgREST cuenta
   sin traer filas) contra `dbWeb`, en paralelo. Números acumulados de
   siempre (no por período) salvo "visitas últimos 30 días", que se agrega
   como contexto — es lo que pidió el dueño ("total de...", no "en el
   último mes"). */
app.get('/api/pos/metricas', auth(true), async (req, res) => {
  const hace30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const contar = (tabla, filtro) => {
    let q = dbWeb.from(tabla).select('*', { count: 'exact', head: true });
    if (filtro) q = filtro(q);
    return q;
  };

  try {
    const [
      totalVisitas,
      visitas30Dias,
      carritosCompartidos,
      carritosAbandonados,
      carritosConvertidos,
      totalUsuarios,
    ] = await Promise.all([
      contar('eventos_web', q => q.eq('tipo', 'visita')),
      contar('eventos_web', q => q.eq('tipo', 'visita').gte('creado_en', hace30Dias)),
      contar('carritos_web', q => q.eq('origen', 'compartido')),
      contar('carritos_web', q => q.eq('origen', 'checkout').is('numero_pedido', null)),
      contar('carritos_web', q => q.eq('origen', 'checkout').not('numero_pedido', 'is', null)),
      contar('perfiles_clientes'),
    ]);

    const primerError = [totalVisitas, visitas30Dias, carritosCompartidos, carritosAbandonados, carritosConvertidos, totalUsuarios]
      .find(r => r.error);
    if (primerError) return enviarError(res, 500, primerError.error.message);

    res.json({
      total_visitas: totalVisitas.count || 0,
      visitas_ultimos_30_dias: visitas30Dias.count || 0,
      total_carritos_compartidos: carritosCompartidos.count || 0,
      total_carritos_abandonados: carritosAbandonados.count || 0,
      total_carritos_convertidos: carritosConvertidos.count || 0,
      total_usuarios_registrados: totalUsuarios.count || 0,
    });
  } catch (err) {
    enviarError(res, 500, err.message);
  }
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
