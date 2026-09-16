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
     UPSTASH_REDIS_REST_URL        https://xxxx.upstash.io    (freno de login compartido — opcional
     UPSTASH_REDIS_REST_TOKEN      AXXXAAIjcD...              pero recomendado, ver ipReal()/frenoLogin())
   ============================================================ */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { Redis } = require('@upstash/redis');

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
  TIENDA_NOTIFICAR_CANCELACION_URL,
  // Correo de entrega (con el pedido de reseña de Google) — mismo criterio
  // que la cancelación de arriba. Ver PUT /api/pos/pedidos-web/:id.
  TIENDA_NOTIFICAR_ENTREGA_URL,
  // Mismo criterio: reenvío forzado del recordatorio de UN carrito
  // abandonado puntual, desde el panel Métricas (POST /api/pos/reenviar-
  // carrito en la tienda). Ver app.post('/api/pos/carritos/:id/reenviar-correo').
  TIENDA_REENVIAR_CARRITO_URL
} = process.env;

// Dominio público de la tienda — mismo criterio que el resto del proyecto
// (valor real por defecto, la env var solo lo sobreescribe). Se usa para
// armar el link de "Carrito compartido" en el panel Métricas.
const URL_TIENDA_PUBLICA = process.env.URL_TIENDA_PUBLICA || 'https://sevelin.cl';

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

/* Solo se considera "desarrollo" cuando se declara explícito (ver
   .env.example: NODE_ENV=development). Cualquier otro valor —incluido
   NODE_ENV vacío/indefinido, que es justo lo que pasaría en un deploy de
   Vercel mal configurado— se trata como no-dev. */
const ES_DESARROLLO = process.env.NODE_ENV === 'development';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[POS] Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
}

/* PRIORIDAD CRÍTICA — sin fallback de JWT_SECRET fuera de desarrollo.
   ------------------------------------------------------------
   ANTES, si JWT_SECRET faltaba, firmarToken()/auth() caían en el string
   literal 'dev-secret-cambiar' (ver más abajo) y la API seguía funcionando
   igual, solo con un console.warn. Ese string vive en el código fuente: en
   cualquier entorno donde la variable se olvidara (un Preview Deployment
   de Vercel, un proyecto clonado, un entorno nuevo mal configurado),
   cualquiera podía forjar un JWT de admin válido sin ninguna credencial
   (`jwt.sign({rol:'admin'}, 'dev-secret-cambiar')`) — bypass total de
   autenticación. Ahora, fuera de desarrollo, faltar JWT_SECRET hace que el
   módulo lance al cargarse: Vercel sirve 500 en cada invocación en vez de
   aceptar tráfico con un secreto público. En desarrollo local se mantiene
   el aviso y el fallback, para no bloquear a quien todavía no configuró
   nada en su .env. */
if (!JWT_SECRET) {
  if (ES_DESARROLLO) {
    console.warn('[POS] Falta JWT_SECRET: usando un secreto de desarrollo NO seguro ' +
      '— definir uno real antes de desplegar.');
  } else {
    throw new Error(
      '[POS] Falta JWT_SECRET en un entorno que no es de desarrollo (NODE_ENV=' +
      JSON.stringify(process.env.NODE_ENV || '') + '). La API se detiene a propósito: ' +
      'sin esta variable, cualquiera podría forjar un token de administrador válido. ' +
      'Definí JWT_SECRET en Vercel → Settings → Environment Variables (ver .env.example).'
    );
  }
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
/* Los 5xx quedan en registro_errores (sql/48) para el panel Salud, con el
   detalle técnico real (res.locals.detalleError) y no el mensaje genérico
   que ve el usuario. Se espera el registro antes de responder (con tope de
   1,5 s): en serverless, lo que queda corriendo después de responder puede
   cortarse. Solo los errores pagan esa espera. */
const enviarError = (res, code, msg, extra) => {
  const responder = () => res.status(code).json({ error: msg, ...(extra || {}) });
  if (code < 500) return responder();
  const req = res.req || {};
  registrarErrorSalud({
    ruta: String(req.originalUrl || req.url || '').split('?')[0] || null,
    metodo: req.method || null,
    estado_http: code,
    mensaje: res.locals?.detalleError || msg,
  }).finally(responder);
};

/* ---------- Registro de errores para Salud (sql/48) ---------- */
// Nunca llega a la base una llave, un token ni una contraseña de conexión.
function enmascararSecretos(texto) {
  return String(texto ?? '')
    .replace(/([?&](key|apikey|api_key|token|secret)=)[^&\s"']+/gi, '$1***')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer ***')
    .replace(/eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]+/g, '***jwt***')
    .replace(/(postgres(ql)?:\/\/[^:\s]+:)[^@\s]+@/gi, '$1***@');
}

/* Nunca lanza ni tarda más de 1,5 s: registrar un error no puede provocar
   otro, ni demorar la respuesta. Cada tanto borra lo de más de 30 días. */
async function registrarErrorSalud({ origen = 'POS', ruta = null, metodo = null, estado_http = null, mensaje, detalle = null }) {
  try {
    const fila = {
      origen,
      ruta: ruta ? String(ruta).slice(0, 200) : null,
      metodo: metodo ? String(metodo).slice(0, 10) : null,
      estado_http: Number.isFinite(Number(estado_http)) ? Number(estado_http) : null,
      mensaje: enmascararSecretos(mensaje || 'Error sin mensaje').slice(0, 500),
      detalle: detalle ? enmascararSecretos(typeof detalle === 'string' ? detalle : JSON.stringify(detalle)).slice(0, 2000) : null,
    };
    const insercion = db.from('registro_errores').insert([fila]);
    await Promise.race([insercion, esperar(1500)]);
    if (Math.random() < 0.02) {
      const limite = new Date(Date.now() - 30 * 86400000).toISOString();
      db.from('registro_errores').delete().lt('creado_en', limite).then(() => {}, () => {});
    }
  } catch (_) { /* el registro es un extra: jamás rompe la respuesta */ }
}

/* Responde un 500 genérico al cliente ante un error de Supabase/PostgREST,
   sin reenviar `error.message` crudo — el detalle real (nombres de tabla,
   columna, constraint, tipos) queda solo en el log del servidor (Vercel),
   nunca en la respuesta HTTP. Reporte de Seguridad Consolidado B, hallazgo
   #10: antes se devolvía `error.message` tal cual en ~100 sitios,
   facilitando reconocimiento del esquema a quien sondeara los endpoints
   con payloads inválidos.
   Solo para errores de BASE DE DATOS (los `{ data, error } = await
   db.from(...)` de Supabase) — un `catch(err)` que envuelve un `new
   Error('mensaje en español para el usuario')` lanzado a propósito en la
   lógica de negocio (ej. "Sin stock suficiente") NO pasa por acá, sigue
   yendo directo: ese mensaje SÍ está pensado para mostrarse. */
function enviarErrorBD(res, error, contexto) {
  console.error(`[POS]${contexto ? ' ' + contexto + ':' : ''} error de base de datos —`, error?.message || error);
  // Para Salud: el detalle real queda en el registro, nunca en la respuesta.
  if (res.locals) res.locals.detalleError = `Base de datos${contexto ? ' (' + contexto + ')' : ''}: ${error?.message || error}`;
  return enviarError(res, 500, 'Error interno al consultar la base de datos. Intenta de nuevo en unos segundos.');
}

/* Sanitiza texto libre para usarlo dentro de un filtro `.ilike.` de
   PostgREST (Supabase), devuelto ya envuelto en comodines: `%texto%`.
   ------------------------------------------------------------
   PostgREST usa coma/paréntesis/punto como separadores estructurales
   dentro de un `.or('col.ilike.valor,...')` — si el texto que escribe el
   usuario los trae tal cual, puede romper o alterar el filtro compuesto.
   Ya se escapaba esto en 2 sitios (búsqueda de ventas por producto,
   búsqueda de garantías), cada uno con su propia copia del mismo
   `.replace(...)` — Reporte de Seguridad Consolidado B, hallazgo #9:
   centralizado acá para que cualquier búsqueda nueva lo reutilice en vez
   de repetir (u olvidar) el escape a mano.
   `%`/`_` son los comodines propios de ILIKE (se escapan para que un "%"
   escrito por el usuario busque un "%" literal, no "cualquier cosa"); `,`
   es el separador de condiciones dentro de `.or(...)`. */
function patronIlike(texto) {
  return `%${String(texto).replace(/[%_,]/g, m => '\\' + m)}%`;
}

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
/* Cortes pasajeros de Supabase/red: vale la pena reintentar. Se vio el
   12-09-2026 ("Gateway Timeout" en Pedidos Web, en medio de un incidente
   de Supabase): la misma consulta respondía bien segundos antes y después. */
function esErrorTransitorio(mensaje) {
  return esErrorJwtTransitorio(mensaje) ||
    /gateway time-?out|bad gateway|service unavailable|fetch failed|econnreset|etimedout|socket hang up|upstream/i.test(mensaje || '');
}

async function consultarConReintento(construirQuery, intentos = 3, esperaMs = 400) {
  let ultimoError = null;
  for (let i = 0; i < intentos; i++) {
    const { data, error } = await construirQuery();
    if (!error) return { data, error: null };
    ultimoError = error;
    if (!esErrorTransitorio(error.message) || i === intentos - 1) break;
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

/* Normaliza un teléfono chileno a solo dígitos con código de país
   (ej. "+56 9 1234 5678", "912345678" y "56912345678" → "56912345678").
   ------------------------------------------------------------
   Se guarda normalizado, no como lo escribió el cajero, porque el
   objetivo del campo es poder AGRUPAR las compras de una misma persona
   (recompra, postventa, aviso de garantía). Si el mismo cliente queda
   como "+569 1234 5678" en una venta y "912345678" en otra, son dos
   clientes distintos para el sistema y la métrica de recompra miente.

   Devuelve null cuando lo escrito no puede ser un teléfono (muy corto o
   absurdamente largo): mejor vacío que basura que después nadie limpia.
   NUNCA lanza ni bloquea: una venta jamás se cae porque el teléfono
   venga raro. */
function normalizarTelefonoChile(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');
  if (!digitos) return null;
  // Celular chileno escrito sin país: 9 dígitos que parten en 9.
  if (digitos.length === 9 && digitos.startsWith('9')) return '56' + digitos;
  // Ya viene con el 56 delante (celular 11, fijo 10).
  if ((digitos.length === 11 || digitos.length === 10) && digitos.startsWith('56')) return digitos;
  // Cualquier otro largo plausible (fijo sin país, número extranjero) se
  // guarda tal cual: no se adivina un código de país que no se sabe.
  if (digitos.length >= 8 && digitos.length <= 15) return digitos;
  return null;
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

/* Comparación de tiempo constante para secretos (SYNC_SECRET, PINs).
   ------------------------------------------------------------
   `a !== b` sobre strings compara carácter por carácter y corta apenas
   encuentra el primer distinto — en teoría permite reconstruir el secreto
   midiendo cuánto tarda cada intento (ataque de timing). crypto.timingSafeEqual
   evita esto, pero exige que ambos Buffer tengan el MISMO largo (si no,
   lanza) — por eso, cuando el largo difiere, se hace de todos modos una
   comparación de tiempo constante contra un buffer del mismo largo que el
   recibido (para no delatar la longitud correcta por la rapidez del
   rechazo) y se retorna false. */
function secretosIguales(recibido, esperado) {
  const bufRecibido = Buffer.from(String(recibido ?? ''), 'utf8');
  const bufEsperado = Buffer.from(String(esperado ?? ''), 'utf8');
  if (bufRecibido.length !== bufEsperado.length) {
    crypto.timingSafeEqual(bufRecibido, Buffer.alloc(bufRecibido.length));
    return false;
  }
  return crypto.timingSafeEqual(bufRecibido, bufEsperado);
}

/* Autenticación por secreto compartido (NO JWT): protege rutas llamadas por
   otro backend (sevelin-tienda), no por una persona logueada — mismo
   criterio que /api/sync/producto del lado tienda, que valida el header
   x-sync-secret contra su propia copia de SYNC_SECRET. Sin SYNC_SECRET
   configurado se rechaza todo por defecto, nunca se abre la ruta. */
function authSync(req, res, next) {
  if (!SYNC_SECRET) return enviarError(res, 401, 'Secreto de sincronización no configurado');
  if (!secretosIguales(req.headers['x-sync-secret'], SYNC_SECRET)) {
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

/* IP real del cliente detrás del proxy de Vercel.
   ------------------------------------------------------------
   ANTES se usaba `req.headers['x-forwarded-for']` completo como clave del
   freno de intentos — pero ese header lo puede escribir el cliente, y
   Vercel no lo reemplaza: SOLO le agrega la IP real de la conexión al
   final de la lista (`cliente-dice-lo-que-quiera, ip-real-de-vercel`). Un
   atacante que mandara un valor distinto en cada request (trivial con
   curl) generaba una clave de mapa distinta cada vez, así que el freno de
   5 intentos/minuto nunca se acumulaba: bypass completo de fuerza bruta
   contra ADMIN_PIN/WORKER_PIN (4 dígitos, 10.000 combinaciones).
   Corregido: se toma el ÚLTIMO valor de la lista (el que agrega el propio
   Vercel, no falsificable por quien hace la petición), nunca el primero. */
function ipReal(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    const partes = xff.split(',').map(p => p.trim()).filter(Boolean);
    if (partes.length) return partes[partes.length - 1];
  }
  // Sin X-Forwarded-For (ej. curl directo a localhost en desarrollo):
  // la conexión TCP real, que tampoco se puede falsificar por header.
  return req.socket?.remoteAddress || req.ip || 'anon';
}

/* Intentos de PIN fallidos por IP — respaldado por Upstash Redis cuando está
   configurado.
   ------------------------------------------------------------
   ANTES vivía solo en un Map en memoria del proceso: en Vercel serverless
   cada instancia fría parte de cero, así que un atacante con varias IPs
   reales distintas (no una IP falsificada, ver ipReal() arriba, sino
   varias de verdad) podía terminar repartiendo sus intentos entre
   instancias distintas y nunca acumular el freno de 5/minuto de forma
   confiable. Redis por HTTP (REST, Upstash) es compartido entre todas las
   instancias, así que el conteo es el mismo sin importar cuál atienda la
   petición.

   Sin UPSTASH_REDIS_REST_URL/TOKEN configuradas, degrada al Map en memoria
   de antes — mismo criterio de "degradar, no romper" que el resto del
   proyecto: nunca debe bloquearse el login de un cajero real por un
   servicio externo caído o sin configurar. Mismo motivo si Redis responde
   con error en un momento puntual: se permite el intento en vez de dejar a
   todo el mundo afuera. */
const redisIntentos = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? Redis.fromEnv()
  : null;

if (!redisIntentos) {
  console.warn('[POS] Falta UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN: el freno de intentos ' +
    'de PIN queda en memoria del proceso (más débil en serverless — cada instancia fría parte de ' +
    'cero). Configúralas para un freno compartido de verdad entre instancias.');
}

const intentosMemoria = new Map();
const CLAVE_INTENTOS = ip => `sevelin-pos:intentos-pin:${ip}`;

async function obtenerRegistroIntentos(ip) {
  if (redisIntentos) {
    try {
      const reg = await redisIntentos.get(CLAVE_INTENTOS(ip));
      if (reg && typeof reg === 'object') return reg;
    } catch (err) {
      console.error('[POS] Redis (freno de intentos) no respondió al leer, se permite el intento:', err.message);
    }
    return { n: 0, hasta: 0, ts: 0 };
  }
  return intentosMemoria.get(ip) || { n: 0, hasta: 0, ts: 0 };
}

async function guardarRegistroIntentos(ip, reg) {
  if (redisIntentos) {
    try {
      // 15 min: cubre la ventana de reseteo de 10 min (ver frenoLogin) más
      // margen — evita que la llave quede para siempre en Redis por un
      // intento aislado que nunca se repite.
      await redisIntentos.set(CLAVE_INTENTOS(ip), reg, { ex: 15 * 60 });
      return;
    } catch (err) {
      console.error('[POS] Redis (freno de intentos) no respondió al guardar:', err.message);
    }
  }
  intentosMemoria.set(ip, reg);
}

async function frenoLogin(req, res, next) {
  const ip = ipReal(req);
  const ahora = Date.now();
  const reg = await obtenerRegistroIntentos(ip);

  if (reg.hasta > ahora) {
    return enviarError(res, 429, 'Demasiados intentos. Espera un minuto.');
  }
  if (ahora - (reg.ts || 0) > 10 * 60 * 1000) reg.n = 0;

  reg.ts = ahora;
  req._registroIntento = { ip, reg };
  await guardarRegistroIntentos(ip, reg);
  next();
}

/* Reconfirmación del PIN de administrador para operaciones destructivas
   masivas (borrar todo el catálogo, todo el historial, lotes completos).
   Se valida SIEMPRE en el servidor: aunque alguien manipule el frontend o
   llame la API directamente, sin el PIN correcto la operación se rechaza.
   Reutiliza el mismo freno por IP que el login para evitar fuerza bruta. */
async function exigirPinAdmin(req, res, next) {
  /* Se responde 403 (no 401) a propósito: un 401 hace que el frontend
     asuma "sesión expirada" y cierre la sesión del administrador. Aquí la
     sesión es válida; lo que falta es autorizar esta operación puntual. */
  const ip = ipReal(req);
  const ahora = Date.now();
  const reg = await obtenerRegistroIntentos(ip);

  if (reg.hasta > ahora) {
    return enviarError(res, 429, 'Demasiados intentos fallidos. Espera un minuto antes de reintentar.');
  }

  const pin = String(req.body?.pin || req.headers['x-admin-pin'] || '').trim();
  if (!pin) return enviarError(res, 403, 'Esta acción requiere confirmar el PIN de administrador');

  if (pin !== String(ADMIN_PIN)) {
    reg.n = (reg.n || 0) + 1;
    reg.ts = ahora;
    if (reg.n >= 5) { reg.hasta = ahora + 60 * 1000; reg.n = 0; }
    await guardarRegistroIntentos(ip, reg);
    return enviarError(res, 403, 'PIN de administrador incorrecto');
  }

  reg.n = 0;
  await guardarRegistroIntentos(ip, reg);
  next();
}

/* ============================================================
   SESIÓN
   ============================================================ */
app.post('/api/login', frenoLogin, async (req, res) => {
  const pin = String(req.body?.pin || '').trim();
  const { ip, reg } = req._registroIntento || {};

  let rol = null;
  if (pin && pin === String(ADMIN_PIN)) rol = 'admin';
  else if (pin && pin === String(WORKER_PIN)) rol = 'trabajador';

  if (!rol) {
    if (reg) {
      reg.n += 1;
      if (reg.n >= 5) { reg.hasta = Date.now() + 60 * 1000; reg.n = 0; }
      await guardarRegistroIntentos(ip, reg);
    }
    return enviarError(res, 401, 'PIN incorrecto');
  }

  if (reg) { reg.n = 0; await guardarRegistroIntentos(ip, reg); }
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
  /* peso_kg/alto_cm/ancho_cm/profundidad_cm YA NO van acá: se guardan solo
     por PUT /api/productos/:id/medidas, que exige el nombre de quien midió
     (sql/43). Antes el formulario los mandaba siempre, aunque nadie los
     tocara, y cada corrección de precio marcaba el producto como "medido
     hoy" — el registro decía que alguien lo pesó un día en que solo se
     editó el nombre. */
  'requiere_sn', 'descripcion',
  'stock_minimo', 'alerta_stock', 'es_repuesto', 'stock_ilimitado', 'usa_lotes',
  'es_servicio',   // sql/52: servicio aunque no esté en la tienda
  // Controles de la tienda web (e-commerce Fase 0). imagen_urls NO va acá:
  // se administra aparte con POST /api/productos/:id/imagen (append/quitar
  // una foto a la vez), no reemplazando el arreglo completo en cada guardado.
  //
  // BUG REAL corregido (01-09-2026, sesión de subcategorías): faltaba
  // 'subcategoria_web' acá — el frontend siempre lo mandó (ver
  // resolverCategoriaWebYSubcategoria() en js/productos.js), pero como no
  // estaba en esta lista, sanearProducto() lo descartaba en silencio antes
  // de llegar a la base. Los productos con subcategoría de antes de hoy
  // (ej. "Mandos y Joystick") se cargaron una sola vez por un script SQL
  // directo (v46), no por el flujo normal de "Editar Producto" — cualquier
  // asignación de subcategoría hecha desde el modal nunca se guardó de
  // verdad hasta este fix.
  'publicado_web', 'precio_web', 'descripcion_web', 'categoria_web', 'subcategoria_web',
  // Pedidos por Encargo (dropshipping/retiro en tienda) — ver sql/30-pedidos-por-encargo.sql.
  'es_pedido_encargo',
  // Precio base que depende del equipo: la tienda no lo vende en línea, solo
  // lo cotiza por WhatsApp — ver sql/45-precio-a-consultar.sql.
  'precio_a_consultar',
  // categoria_id (Fase "Página Web → Categorías"): FK interna del POS, no se
  // sincroniza a la tienda (el trigger solo usa categoria_web). stock_umbral_web:
  // NULL = usa el default de la tienda (+5); ver sql/23-categorias-web-y-umbral-stock.sql.
  'categoria_id', 'stock_umbral_web',
  // NOVEDAD/TENDENCIA/OFERTA — ver sql/28-etiqueta-web.sql.
  'etiqueta_web',
  // Interruptor del aviso de pocas unidades en la tienda — ver
  // sql/40-urgencia-stock-web.sql. El texto y el número los calcula la
  // tienda con el stock real; acá solo se permite o se silencia.
  'urgencia_stock_web',
  // "Por llegar" — ver sql/42-por-llegar.sql. Apagar por_llegar es lo que
  // marca "ya llegó" y dispara los avisos a quienes estaban esperando.
  'por_llegar', 'fecha_llegada_estimada', 'stock_por_llegar',
  // Módulo Garantías — ver sql/31-garantias.sql.
  'condicion', 'meses_garantia',
  /* Marca del fabricante (sql/38). Se usa como `brand` en el feed de
     Meta/Google, donde es lo que permite que el producto compita en las
     búsquedas de esa marca. Ojo: es de QUIEN FABRICA, no de "compatible
     con" — un cargador para notebook HP no es marca HP. */
  'marca',
  // Archivar (retirar del POS/venta/tienda sin borrar, ver sql/32-archivar-productos.sql).
  'archivado',
  // SEO — título/meta-descripción para Google, aparte del nombre/Descripción
  // que ve el cliente. NULL = sevelin-tienda arma uno automático (ver
  // generateMetadata en productos/[sku]/page.tsx). Se llenan a mano o con
  // el botón "Generar con IA" (POST /api/productos/generar-seo, ver
  // sql/33-seo-ia.sql).
  'meta_titulo_web', 'meta_descripcion_web',
  // Borrador autocreado al agregar la primera foto de un producto nuevo
  // (ver crearBorradorProducto() en js/productos.js y sql/34-borrador-
  // productos.sql) — false en cualquier guardado real desde el formulario.
  'es_borrador'
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
  if (body.es_servicio !== undefined) p.es_servicio = !!body.es_servicio;
  /* usa_lotes solo cambia si el cliente lo manda explícitamente. Así una
     importación masiva o un PUT parcial jamás encienden los lotes por su
     cuenta: la única forma es el checkbox del modal de producto. */
  if (body.usa_lotes !== undefined) p.usa_lotes = !!body.usa_lotes;
  if (body.es_borrador !== undefined) p.es_borrador = !!body.es_borrador;
  // Archivar: siempre se lleva publicado_web=false consigo, para que un
  // producto archivado nunca pueda quedar visible en la tienda por
  // separado (el frontend ya lo manda así, esto es la garantía del
  // servidor por si algún día se llama a este endpoint desde otro lado).
  if (body.archivado !== undefined) {
    p.archivado = !!body.archivado;
    if (p.archivado) p.publicado_web = false;
  }

  // Cada vez que se toca el stock queda registrada la fecha del cambio
  if (p.stock !== undefined) p.stock_actualizado_en = new Date().toISOString();
  /* El timestamp de medidas ya no se toca acá. Lo pone únicamente
     PUT /api/productos/:id/medidas, junto con el nombre de quien midió —
     ver sql/43-medidas-por-separado.sql. */
  ['sku', 'descripcion', 'marca'].forEach(k => {
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
  if (body.es_pedido_encargo !== undefined) p.es_pedido_encargo = !!body.es_pedido_encargo;
  if (body.precio_a_consultar !== undefined) p.precio_a_consultar = !!body.precio_a_consultar;
  // precio_web vacío/0 = NULL a propósito: "usa el precio normal del POS"
  // (ver sql/21-imagenes-web.sql). Un 0 real congelaría el producto gratis.
  if (p.precio_web !== undefined) {
    const v = num(p.precio_web);
    p.precio_web = v > 0 ? v : null;
  }
  ['descripcion_web', 'categoria_web', 'subcategoria_web'].forEach(k => {
    if (p[k] !== undefined) {
      const t = String(p[k]).trim();
      p[k] = (!t || ['null', 'undefined'].includes(t.toLowerCase())) ? null : t;
    }
  });
  if (p.categoria_id !== undefined) p.categoria_id = p.categoria_id || null;
  // Etiqueta destacada: solo una de las 3 opciones válidas o NULL — cualquier
  // otra cosa (manipulación directa del payload) se descarta en vez de
  // dejar que la base rechace todo el guardado por el check constraint.
  if (p.urgencia_stock_web !== undefined) p.urgencia_stock_web = !!p.urgencia_stock_web;
  if (p.por_llegar !== undefined) p.por_llegar = !!p.por_llegar;
  if (p.stock_por_llegar !== undefined) p.stock_por_llegar = Math.max(0, Math.round(num(p.stock_por_llegar)));
  if (p.fecha_llegada_estimada !== undefined) {
    // Sin fecha no se rechaza el producto: "por llegar" sin fecha es
    // válido (llega cuando llega) y la tienda lo dice así.
    const f = String(p.fecha_llegada_estimada || '').trim();
    p.fecha_llegada_estimada = /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : null;
  }
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

  // --- Módulo Garantías (ver sql/31-garantias.sql) ---
  // Condición: solo una de las 2 opciones válidas, cualquier otra cosa cae
  // a 'nuevo' en vez de dejar que la base rechace todo el guardado.
  if (p.condicion !== undefined) {
    p.condicion = ['nuevo', 'reacondicionado'].includes(p.condicion) ? p.condicion : 'nuevo';
  }
  // Meses de garantía: siempre parte en 6 (pedido explícito del dueño);
  // negativo o inválido también cae a 6 en vez de rechazar el guardado.
  if (p.meses_garantia !== undefined) {
    const v = num(p.meses_garantia);
    p.meses_garantia = v >= 0 ? Math.round(v) : 6;
  }

  return p;
}

/* Limpieza masiva del catálogo. Arregla de una vez los productos que ya
   tienen "null" o caracteres no numéricos en el código de barras, sin
   tener que editarlos uno por uno. */
app.post('/api/productos/limpiar-codigos', auth(true), exigirPinAdmin, async (req, res) => {
  const { data, error } = await db.from('productos').select('id, sku, codigo_barras');
  if (error) return enviarErrorBD(res, error);

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

/* Por defecto solo trae productos NO archivados y NO borradores — este
   endpoint alimenta `productsList`, compartida por TODA la app (venta,
   OT, mermas, lotes, reportes, no solo el módulo Productos), así que un
   producto archivado o un borrador a medio llenar quedan excluidos de
   golpe en todos lados con este único filtro. Con ?archivados=1 se pide
   lo contrario (solo archivados, sin filtrar por borrador — caso raro,
   no hace falta cruzarlos); con ?borradores=1, solo los borradores
   vigentes (nunca archivados). Ver sql/34-borrador-productos.sql — nunca
   se mezclan las tres vistas en la misma respuesta. */
app.get('/api/productos', auth(), async (req, res) => {
  const soloArchivados = req.query.archivados === '1';
  const soloBorradores = req.query.borradores === '1';
  // Más recientes primero por defecto (pedido explícito del dueño) — el
  // frontend ya reordena a gusto (Nombre A-Z, Precio, etc.), pero el
  // orden que trae la API debe coincidir con lo que se ve al abrir
  // Productos sin tocar nada.
  let q = db.from('productos').select('*').order('created_at', { ascending: false });
  q = soloArchivados
    ? q.eq('archivado', true)
    : soloBorradores
      ? q.eq('es_borrador', true).eq('archivado', false)
      : q.eq('archivado', false).eq('es_borrador', false);
  const { data, error } = await q;
  if (error) return enviarErrorBD(res, error);
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
  if (error) return enviarErrorBD(res, error);
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
  if (errLista) return enviarErrorBD(res, errLista);

  const idx = (lista || []).findIndex(c => String(c.id) === String(req.params.id));
  if (idx === -1) return enviarError(res, 404, 'No se encontró esa categoría');

  const idxVecino = direccion === 'arriba' ? idx - 1 : idx + 1;
  if (idxVecino < 0 || idxVecino >= lista.length) return res.json({ ok: true }); // ya está en el extremo

  const actual = lista[idx];
  const vecino = lista[idxVecino];

  const { error: err1 } = await db.from('producto_categorias').update({ orden: vecino.orden }).eq('id', actual.id);
  const { error: err2 } = await db.from('producto_categorias').update({ orden: actual.orden }).eq('id', vecino.id);
  if (err1 || err2) return enviarErrorBD(res, (err1 || err2));

  res.json({ ok: true });
});

app.delete('/api/productos/categorias/:id', auth(true), async (req, res) => {
  const { error } = await db.from('producto_categorias').delete().eq('id', req.params.id);
  if (error) return enviarErrorBD(res, error);
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
  if (error) return enviarErrorBD(res, error);
  res.status(201).json(data);
});

/* Quita las etiquetas HTML del editor (Quill: negrita, listas, links) para
   mandarle a la IA solo el texto real — no necesita ni debe recibir markup,
   y evitamos que confunda un <br> con contenido. No es un sanitizador (no
   se usa para mostrar nada), solo para armar el prompt. */
function textoPlanoParaPrompt(html) {
  return String(html || '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|li|div|h[1-6])>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}
/* ---------- Gemini: una sola puerta para todos los botones de IA ----------
   MODELOS, EN ORDEN (12-09-2026)
   gemini-flash-latest, el modelo estrella de Google, vive saturado: en 9
   pruebas reales respondió 1 vez y el resto "high demand" tras 14–30 s.
   gemini-flash-lite-latest respondió 5 de 5, casi siempre en ~1 s.
   Los dos son ALIAS: Google los mueve al modelo vigente, así no se rompen
   cuando retira una versión fija (ya pasó con 2.0 y 2.5).
   Cada intento tiene tope de tiempo: el botón nunca queda colgado.

   Está extraído acá porque lo usan TRES botones (SEO, ficha web y
   Facebook) — antes vivía adentro de /generar-seo y copiarlo habría
   dejado tres reintentos distintos que se desincronizan solos. */
const MODELOS_GEMINI = [
  { modelo: 'gemini-flash-lite-latest', topeMs: 10000 },
  { modelo: 'gemini-flash-latest', topeMs: 12000 },
];

/* Devuelve { texto, modelo } o lanza un Error con `fallas` adjunto.
   `generationConfig` lo arma quien llama: el SEO pide JSON con esquema,
   los textos de ficha/Facebook piden texto plano. */
async function pedirAGemini(prompt, generationConfig, topeMsExtra = 0) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('Falta GEMINI_API_KEY en las variables de entorno del servidor (Vercel → Settings → Environment Variables).');
    err.sinLlave = true;
    throw err;
  }

  const cuerpo = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig });
  const fallas = [];

  for (const { modelo, topeMs } of MODELOS_GEMINI) {
    const tope = topeMs + topeMsExtra;
    try {
      const respuesta = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo, signal: AbortSignal.timeout(tope) }
      );
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        fallas.push(`${modelo}: HTTP ${respuesta.status} ${datos?.error?.message || ''}`.trim());
        // Llave inválida o pedido mal armado: otro modelo no lo arregla.
        if ([400, 401, 403].includes(respuesta.status)) break;
        continue;
      }
      const texto = datos?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!texto) { fallas.push(`${modelo}: respuesta vacía o ilegible`); continue; }
      /* finishReason distinto de STOP = Gemini se quedó a medias (topó el
         límite de tokens, un filtro de seguridad, etc.) — el texto que
         mandó hasta ahí queda cortado a mitad de una sección, sin avisar
         con ningún error HTTP. Bug real: "Generar ficha" devolvía la
         intro + el título "✨ Características principales" y ninguna
         viñeta después — Gemini paró justo ahí y el código lo daba por
         bueno igual. Se descarta el intento y se prueba el otro modelo,
         en vez de pegar en la Descripción del producto una ficha rota. */
      const finishReason = datos?.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== 'STOP') {
        fallas.push(`${modelo}: respuesta cortada (${finishReason})`);
        continue;
      }
      return { texto, modelo };
    } catch (err) {
      fallas.push(`${modelo}: ${err.name === 'TimeoutError' ? `sin respuesta en ${tope / 1000} s` : err.message}`);
    }
  }

  const err = new Error('Gemini no respondió');
  err.fallas = fallas;
  err.llaveMala = fallas.some(x => /HTTP (400|401|403)/.test(x));
  throw err;
}

/* Mensaje al usuario, igual para los tres botones. `salida` es la salida a
   mano que le queda al dueño cuando Google no responde ("El SEO se puede
   escribir a mano") — cambia según el botón, así que la pone quien llama. */
function responderFalloGemini(res, err, etiqueta, salida = '') {
  if (err.sinLlave) return enviarError(res, 500, err.message);
  console.error(`[${etiqueta}] Gemini falló:`, (err.fallas || []).join(' | '));
  if (res.locals) res.locals.detalleError = `Gemini (${etiqueta}): ${(err.fallas || []).join(' | ')}`;
  const cola = salida ? ` ${salida}` : '';
  return enviarError(res, 502, err.llaveMala
    ? `Google rechazó la llave de Gemini. Revisa GEMINI_API_KEY en Vercel.${cola}`
    : `Google está saturado en este momento y no respondió. Intenta en un minuto.${cola}`);
}


/* SEO con IA: título + meta-descripción para Google, a partir del nombre y
   la Descripción YA escritos (nunca inventa specs — regla del proyecto, ver
   CLAUDE.md). No guarda nada: el admin revisa el resultado en el modal y
   recién queda en la base cuando aprieta "Guardar producto", como
   cualquier otro campo (ver meta_titulo_web/meta_descripcion_web en
   CAMPOS_PRODUCTO y sql/33-seo-ia.sql). */
app.post('/api/productos/generar-seo', auth(true), async (req, res) => {
  const nombre = String(req.body?.nombre || '').trim();
  const textoDescripcion = textoPlanoParaPrompt(req.body?.descripcion_html);
  if (!nombre) return enviarError(res, 400, 'Falta el nombre del producto');
  if (!textoDescripcion) return enviarError(res, 400, 'El producto todavía no tiene Descripción — escríbela primero, la IA no inventa specs nuevas.');

  const prompt = `Eres el redactor SEO de Sevelin, una tienda de electrónica en Arica, Chile (sevelin.cl).
Te doy el nombre y la descripción REAL de un producto ya publicados por el dueño. Tu única tarea es
reescribirlos en un título y una meta-descripción optimizados para que aparezcan bien en los
resultados de Google — NUNCA agregues una característica, medida, marca o dato que no esté
explícitamente en el texto de abajo. Si algo no está mencionado, no lo menciones tú tampoco.

Nombre del producto: ${nombre}

Descripción real (tal cual la escribió el dueño):
"""
${textoDescripcion.slice(0, 4000)}
"""

Reglas:
- Español de Chile, sin emojis, sin comillas, sin markdown.
- "meta_titulo": máximo 60 caracteres, incluye el nombre o su idea central, atractivo para un clic real.
- "meta_descripcion": máximo 155 caracteres, resume el beneficio real del producto usando SOLO lo ya
  descrito arriba, invita a comprar sin exagerar ni inventar.
- No repitas "Sevelin" en el texto (ya aparece aparte en el resultado de Google).`;

  /* El reintento entre modelos y el manejo de errores viven en
     pedirAGemini() / responderFalloGemini() — los comparten los tres
     botones de IA (SEO, ficha web y Facebook). */
  try {
    const { texto, modelo } = await pedirAGemini(prompt, {
      temperature: 0.4,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          meta_titulo: { type: 'STRING' },
          meta_descripcion: { type: 'STRING' }
        },
        required: ['meta_titulo', 'meta_descripcion']
      }
    });

    let resultado = null;
    try { resultado = JSON.parse(texto); } catch { resultado = null; }
    if (!resultado?.meta_titulo) {
      return enviarError(res, 502, 'Google devolvió una respuesta ilegible. Intenta de nuevo, o escribe el SEO a mano.');
    }

    /* El prompt pide no repetir la marca (Google ya la muestra aparte), pero
       el modelo liviano a veces la agrega igual: 'Cambio de Pantalla | Sevelin'. */
    const sinMarca = (t) => String(t || '')
      .replace(/\s*[|\-–—:]\s*Sevelin\b/gi, '')          // "… | Sevelin"
      .replace(/\ben Sevelin(?=\s+\p{L})/giu, 'en')       // "en Sevelin Arica" → "en Arica"
      .replace(/\s*\ben Sevelin\b/gi, '')                 // "Visítanos en Sevelin." → "Visítanos."
      .replace(/\bSevelin\b\s*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/\s+([.,;:!?])/g, '$1')
      .trim();

    return res.json({
      meta_titulo: sinMarca(resultado.meta_titulo).slice(0, 70),
      meta_descripcion: sinMarca(resultado.meta_descripcion).slice(0, 200),
      modelo
    });
  } catch (err) {
    return responderFalloGemini(res, err, 'generar-seo', 'El SEO se puede escribir a mano.');
  }
});


/* ---------- Generar texto con IA: ficha de la tienda y post de Facebook ----------
   Son los prompts oficiales que el dueño venía pegando a mano en Gemini
   (ver docs/, memoria del proyecto). Viven acá, en el servidor, por dos
   razones: el prompt es la regla de negocio (qué se puede decir y qué no),
   y así se corrige en un solo lugar en vez de en cada pestaña abierta.

   LA REGLA QUE MÁS IMPORTA: los tres prompts prohíben inventar specs. Por
   eso el endpoint EXIGE información real (`datos` o la Descripción ya
   escrita) y devuelve 400 si no hay ninguna — un modelo al que solo se le
   da el nombre del producto rellena con características plausibles que
   nadie verificó, y eso termina publicado en sevelin.cl y en Facebook.

   El prompt de la ficha se elige por `es_servicio` (la marca de sql/52):
   un servicio técnico no puede prometer resultados ni plazos, un producto
   sí lista specs. No se deriva de stock_ilimitado (ver CLAUDE.md). */

const PROMPT_FICHA_PRODUCTO = `Crea la ficha de un producto para la tienda online Sevelin (Arica, Chile) a partir de la información real que te voy a entregar.

NO escribir encabezados internos como "🏷️ Título del producto", "Nombre del producto" o similares.

La primera línea debe ser directamente el título comercial del producto, listo para copiar y pegar en el campo "Nombre del producto" de la tienda online. Debe incluir, cuando estén disponibles, marca + modelo + tipo de producto + característica o variante relevante. Claro, profesional, sin palabras innecesarias ni exageraciones. Este mismo título se repite después dentro de la introducción, palabra por palabra.

✨ Introducción breve y atractiva, SIEMPRE empezando con el emoji ✨ y en un solo párrafo seguido (sin saltos de línea internos). Incluye el título completo del producto, qué es, su principal beneficio, y para qué tipo de usuario o situación está pensado.

### ✨ Características principales

✅ [Característica o beneficio relevante]
✅ [Característica o beneficio relevante]
✅ [Característica o beneficio relevante]
(entre 8 y 12 en total, solo las más importantes para el comprador — beneficios reales y especificaciones relevantes, sin tecnicismos innecesarios)

### ⚠️ Importante

[Incluir esta sección SOLO si la información proporcionada trae una advertencia, condición de uso, limitación, requisito de instalación o montaje, compatibilidad especial o incompatibilidad. Explicarlo claro y directo, en un párrafo — nunca inventar una advertencia que no esté respaldada por la información entregada. Si no hay ninguna, omitir la sección completa.]

Reglas estrictas:
- NO agregar ninguna sección de envíos, WhatsApp, Instagram, garantía, métodos de pago, boleta ni "compra online" — esa parte la agrega automáticamente la tienda, no debe repetirse en la ficha.
- No incluir dirección física, referencias de ubicación, horarios de atención ni instrucciones para tocar la puerta.
- No inventar especificaciones técnicas, accesorios incluidos, compatibilidades, autonomía, potencia, dimensiones, capacidad, contenido de la caja, stock, tiempos de despacho ni ninguna característica que no esté confirmada en la información que te doy.
- Si existen contradicciones entre distintas partes de la información proporcionada, usa la más clara y específica — nunca inventes para resolver la contradicción.
- Si el producto es reacondicionado, usado, de segunda mano, abierto o tiene cualquier condición especial, indícalo claramente y de forma profesional — nunca lo presentes como nuevo si no corresponde.
- La respuesta final contiene ÚNICAMENTE la ficha, empezando directo con el título, sin encabezado previo.`;

const PROMPT_FICHA_SERVICIO = `Crea la ficha de un servicio técnico para la tienda online Sevelin (Arica, Chile) a partir de la información real que te voy a entregar a continuación. Debe quedar profesional, clara, atractiva y transmitir confianza para que el cliente se anime a agendar el servicio.

La respuesta debe estar lista para copiar y pegar directamente en el campo de descripción de la tienda. No agregues explicaciones, comentarios ni instrucciones fuera de la ficha.

No escribas encabezados internos como "🏷️ Título del servicio", "Nombre del servicio" o similares.

La primera línea es directamente el título comercial del servicio, listo para copiar en el campo "Nombre del producto" de la tienda online. Ej: "Formateo e instalación de Windows con respaldo de datos", "Cambio de pantalla de notebook", "Limpieza y mantención de PC". Claro y profesional, sin palabras innecesarias ni exageraciones. Este mismo título se repite después, palabra por palabra, dentro de la introducción.

✨ Introducción breve y atractiva, siempre empezando con el emoji ✨, en un solo párrafo seguido (sin saltos de línea internos). Incluye el título completo del servicio, en qué consiste, su principal beneficio, y para qué tipo de problema o necesidad está pensado.

### ⚠️ Importante

Incluye esta sección solo si la información entregada trae una advertencia real, un requisito previo (ej: traer el cargador, respaldar los datos antes), una condición del diagnóstico, una limitación o algo que el servicio NO cubre. Un párrafo claro y directo — nunca inventes una advertencia, requisito, plazo o condición que no esté respaldada por la información entregada. Si no hay ninguna, omite la sección completa.

### ✨ Qué incluye este servicio

✅ [Qué incluye o resuelve el servicio]
✅ [Qué incluye o resuelve el servicio]
✅ [Qué incluye o resuelve el servicio]

Entre 6 y 10 en total — solo lo más relevante para quien está evaluando contratar el servicio: qué se hace, qué problema soluciona, qué queda revisado o entregado al final.

Reglas estrictas:
- No agregues ninguna sección de envíos, WhatsApp, Instagram, garantía, métodos de pago, boleta ni "compra online" — la tienda la agrega automáticamente, no la repitas.
- No incluyas dirección física, referencias de ubicación, horarios de atención ni instrucciones de retiro.
- No inventes plazos de entrega, tiempo que demora el servicio, precio del diagnóstico, garantía del servicio, repuestos incluidos, marcas/modelos compatibles, ni ninguna condición que no esté confirmada en la información que te doy.
- No prometas que el servicio soluciona el problema al 100% ni hagas afirmaciones absolutas sobre resultados — un servicio técnico depende del diagnóstico real de cada equipo.
- Si hay contradicciones entre partes de la información entregada, usa la más clara y específica — nunca inventes para resolver la contradicción.
- La respuesta final contiene ÚNICAMENTE la ficha, empezando directo con el título, sin encabezado previo.`;

const PROMPT_FACEBOOK = `Crea una publicación para Facebook de la tienda Sevelin (Arica, Chile) a partir de la información real que te voy a entregar a continuación. Debe quedar profesional, atractiva y optimizada para vender.

La respuesta debe estar completamente lista para copiar y pegar directamente en Facebook. No agregues explicaciones, comentarios, títulos, instrucciones ni ningún texto fuera de la publicación.

Usa únicamente texto plano y emojis. No uses Markdown, negritas, cursivas, enlaces Markdown, tablas, bloques de código ni encabezados con #.

No conviertas www.sevelin.cl en un enlace Markdown — debe aparecer exactamente como texto plano: www.sevelin.cl

El encabezado de la publicación debe comenzar siempre con ✨ NUEVO o ✨ NUEVA, según el género del producto (ej: NUEVO audífono, NUEVA plancha).

✨ [NUEVO/NUEVA] [nombre completo y comercial del producto — incluye marca, modelo, tipo de producto y característica o variante relevante cuando estén disponibles]

✨ [Introducción breve, atractiva y orientada a ventas. Qué es el producto, sus principales beneficios y para qué tipo de usuario o necesidad está pensado. Sin exageraciones ni afirmaciones que no estén respaldadas por la información entregada.]

Si el producto trae una advertencia real, requisito de instalación, condición de compatibilidad o algún detalle importante (como piezas no incluidas), agrégalo acá mismo, antes de las características — nunca al final de la publicación:

⚠️ IMPORTANTE: [advertencia o condición, en un párrafo claro y directo]

✨ CARACTERÍSTICAS PRINCIPALES

✅ [Característica relevante]
✅ [Característica relevante]
✅ [Característica relevante]

Entre 8 y 12 en total — solo las más importantes y útiles para el comprador. Prioriza beneficios reales y especificaciones relevantes, sin tecnicismos innecesarios.

📌 RETIRO PRESENCIAL SECTOR 11 SEPTIEMBRE O ENVÍO HOY EN ARICA
Escríbenos antes de venir a retirar o solicitar tu despacho. Así te confirmamos disponibilidad del producto, el horario exacto y nos aseguramos de que haya alguien listo para entregártelo.

🕐 Horario de atención: Consulta nuestros horarios actualizados en nuestros canales digitales.

📲 WhatsApp: +56935750828
📸 Instagram: @sevelin.cl

🇨🇱 Envíos a todo Chile.

🛡️ Garantía: 6 meses en todos nuestros productos por fallas de fábrica.

💳 Métodos de pago: Efectivo • Transferencia • Tarjetas de débito • Tarjetas de crédito.

🧾 Se emite boleta por su compra.

🛍️ Compra online: Compra de forma rápida y segura directamente en nuestra tienda online www.sevelin.cl

Si el producto es reacondicionado, usado, de segunda mano, abierto, con detalles estéticos o tiene cualquier condición especial, indícalo claramente y de forma profesional — nunca lo presentes como nuevo si no corresponde.

No incluyas dirección física, referencias de ubicación ni dirección de la tienda.

No inventes especificaciones técnicas, accesorios incluidos, compatibilidades, autonomía, potencia, dimensiones, capacidad, contenido de la caja, stock, tiempos de despacho, condiciones de instalación, garantía adicional ni ninguna otra característica que no esté confirmada en la información que te doy.

Al final de la publicación, genera exactamente 20 hashtags relevantes, en una sola línea, separados únicamente por comas, cada uno empezando con #, sin repetir ninguno y sin ningún título ni texto antes de ellos (nunca escribas "HASHTAGS" ni nada parecido). Combina estratégicamente hashtags de marca, ubicación, categoría, tipo de producto, necesidad, uso e intención de compra — por ejemplo #Sevelin, #Tecnologia, #Computacion, #Informatica, #Arica, #AricaChile, #Chile, #Ofertas, #AccesoriosPC y otros realmente relacionados con el producto. Evita hashtags irrelevantes, genéricos al extremo, inventados o de spam.

La respuesta final contiene ÚNICAMENTE la publicación completa, lista para copiar y pegar.`;

const DESTINOS_TEXTO_IA = ['ficha', 'facebook'];

app.post('/api/productos/generar-texto', auth(true), async (req, res) => {
  const destino = String(req.body?.destino || '').trim().toLowerCase();
  if (!DESTINOS_TEXTO_IA.includes(destino)) {
    return enviarError(res, 400, 'Destino inválido: tiene que ser "ficha" o "facebook".');
  }

  /* El nombre es OPCIONAL (16-09-2026): los dos prompts de ficha ya le
     piden a la IA que proponga un título comercial en la primera línea a
     partir de la info real — exigirlo antes de generar era un candado de
     más, que obligaba a subir hasta el campo Nombre y escribir algo a
     mano solo para poder apretar el botón. El POS ya sabe usar ese título
     propuesto (ver más abajo, y generarTextoConIA() en productos.js). */
  const nombre = String(req.body?.nombre || '').trim();

  const esServicio = req.body?.es_servicio === true || req.body?.es_servicio === 'true';
  const datosPegados = String(req.body?.datos || '').trim();
  const descripcionActual = textoPlanoParaPrompt(req.body?.descripcion_html);

  /* Sin información real, el modelo inventa. Es la regla de oro de los tres
     prompts y la única validación que de verdad protege al negocio acá. */
  if (!datosPegados && !descripcionActual) {
    return enviarError(res, 400, destino === 'facebook'
      ? 'Falta la información real del producto. Escribe la Descripción primero, o pega las specs en el cuadro — la IA no inventa características.'
      : 'Falta la información real del producto. Pega las specs (o lo que sepas de él) en el cuadro de abajo — la IA no inventa características.');
  }

  /* Los datos que el POS ya conoce se mandan como contexto, pero SIEMPRE
     rotulados: el prompt no debe confundirlos con specs verificadas. */
  const contexto = [
    nombre
      ? `Nombre actual en el sistema: ${nombre}`
      : 'Todavía no tiene nombre en el sistema — proponlo tú, basado en la información real de abajo.',
    req.body?.marca ? `Marca: ${String(req.body.marca).trim()}` : null,
    req.body?.condicion ? `Condición: ${String(req.body.condicion).trim()}` : null,
    req.body?.categoria ? `Categoría: ${String(req.body.categoria).trim()}` : null,
    esServicio ? 'Este ítem es un SERVICIO TÉCNICO, no un producto físico.' : null,
    datosPegados ? `\nInformación real entregada por el dueño:\n"""\n${datosPegados.slice(0, 6000)}\n"""` : null,
    descripcionActual ? `\nDescripción que ya tiene hoy (úsala como fuente, no la copies textual):\n"""\n${descripcionActual.slice(0, 4000)}\n"""` : null,
  ].filter(Boolean).join('\n');

  const base = destino === 'facebook'
    ? PROMPT_FACEBOOK
    : (esServicio ? PROMPT_FICHA_SERVICIO : PROMPT_FICHA_PRODUCTO);

  const prompt = `${base}\n\nInformación real del ${esServicio ? 'servicio' : 'producto'}:\n${contexto}`;

  try {
    /* Sin responseMimeType: estos prompts piden texto listo para pegar, no
       JSON. Temperatura un poco más alta que el SEO porque acá sí se
       espera redacción, no un título de 60 caracteres.
       maxOutputTokens explícito y holgado: sin esto, una ficha larga con
       lista de 12 características podía toparse con el límite por
       defecto y Gemini paraba a mitad de la lista (ver el chequeo de
       finishReason en pedirAGemini).
       topeMsExtra: una ficha completa son ~2.000 caracteres contra los ~200
       del SEO, así que necesita más tiempo que el tope de ese botón. */
    const { texto, modelo } = await pedirAGemini(prompt, { temperature: 0.7, maxOutputTokens: 3000 }, 12000);
    const limpio = String(texto).trim();

    if (destino === 'facebook') {
      return res.json({ destino, texto: limpio, modelo });
    }

    /* La ficha viene con el título comercial en la primera línea (así lo
       piden los dos prompts). Se separa acá para que el POS pueda ofrecerlo
       como nombre del producto sin que el dueño tenga que cortarlo a mano.
       Si la primera línea ya es la intro (empieza con ✨ o ###), no hay
       título separado y se devuelve la ficha entera. */
    const lineas = limpio.split('\n');
    const primera = (lineas[0] || '').trim();
    const pareceTitulo = primera && !/^[✨#>\-*✅⚠️]/u.test(primera) && primera.length <= 150;

    return res.json({
      destino,
      titulo: pareceTitulo ? primera : '',
      cuerpo: pareceTitulo ? lineas.slice(1).join('\n').trim() : limpio,
      modelo
    });
  } catch (err) {
    return responderFalloGemini(res, err, `generar-texto:${destino}`,
      'Mientras tanto puedes pegar el prompt en Gemini a mano, como antes.');
  }
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
    if (error) return enviarErrorBD(res, error);
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

  // 1) Código de barras (lo habitual al escanear) — archivado=false: un
  // producto archivado no debe poder agregarse a una venta ni escaneando
  // su código directo (ver sql/32-archivar-productos.sql).
  const { data: porBarra } = await db.from('productos').select('*').eq('codigo_barras', codigo).eq('archivado', false).limit(1);
  if (porBarra && porBarra[0]) return responder(porBarra[0], 'codigo_barras');

  // 2) SKU
  const { data: porSku } = await db.from('productos').select('*').eq('sku', codigo).eq('archivado', false).limit(1);
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

  if (error) return enviarErrorBD(res, error);

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

  if (error) return enviarErrorBD(res, error);
  res.json(data || []);
});

/* Auditoría de envío (Fase 0, punto 0.6 del e-commerce) — SOLO diagnostica,
   no corrige nada. `productos` no tiene columna `activo` (no hay soft-delete:
   se borra la fila con DELETE /api/productos/:id), así que "activo" acá es
   "existe en el catálogo". Se excluyen los productos con stock_ilimitado
   (servicios/mano de obra: nunca se despachan, no necesitan peso ni medidas).
   Es de solo lectura y temporal: no la usa ningún flujo real todavía. */
/* ============================================================
   AGOTADOS: QUÉ HACER CON UN PRODUCTO EN STOCK 0 (sql/55)
   ------------------------------------------------------------
   Un producto que se agota hoy se queda callado: no se repone, no se
   archiva, no pasa a encargo. Los tres caminos ya existen (por_llegar
   sql/42, es_pedido_encargo sql/30, archivado sql/32); lo que faltaba
   era algo que PREGUNTARA cuál corresponde.

   REGLA DEL DUEÑO (16-09-2026): nada se mueve solo. Acá se detecta y se
   ofrece; el cambio sobre `productos` se aplica recién cuando él aprueba
   una de las cuatro salidas.
   ============================================================ */

/* Cuántas unidades se vendieron de cada producto en los últimos `dias`, y
   cuándo fue la última. Se usa para no preguntar a ciegas: no es lo mismo
   agotarse algo que vendía 8 al mes que algo que vendió 1 en todo el año.
   Devuelve un Map(producto_id -> { unidades, ultimaVenta }). */
async function ventasRecientesPorProducto(ids, dias) {
  const resumen = new Map();
  const lista = [...new Set((ids || []).map(Number).filter(Boolean))];
  if (lista.length === 0) return resumen;

  const desde = new Date(Date.now() - (Number(dias) || 90) * 86400000).toISOString().slice(0, 10);
  const { data: ventas, error: errV } = await db.from('ventas').select('id, fecha').gte('fecha', desde);
  if (errV) throw errV;
  const fechaDe = new Map((ventas || []).map(v => [v.id, v.fecha]));
  if (fechaDe.size === 0) return resumen;

  const { data: items, error: errI } = await db.from('venta_items')
    .select('venta_id, producto_id, cantidad').in('producto_id', lista);
  if (errI) throw errI;

  for (const it of items || []) {
    const fecha = fechaDe.get(it.venta_id);
    if (!fecha) continue;                        // venta fuera del período
    const pid = Number(it.producto_id);
    const acum = resumen.get(pid) || { unidades: 0, ultimaVenta: null };
    acum.unidades += num(it.cantidad);
    if (!acum.ultimaVenta || String(fecha) > String(acum.ultimaVenta)) acum.ultimaVenta = fecha;
    resumen.set(pid, acum);
  }
  return resumen;
}

/* Un producto entra a la cola de agotados solo si su stock 0 significa de
   verdad "no hay para vender". Quedan fuera los que por diseño se venden
   sin stock: servicios, stock ilimitado, encargos y los que ya están
   marcados "por llegar". Tampoco los archivados ni los borradores. */
function agotadoDeVerdad(p) {
  return num(p.stock) <= 0
    && !p.stock_ilimitado && !p.es_servicio && !p.es_pedido_encargo
    && !p.por_llegar && !p.archivado && !p.es_borrador;
}

const DIAS_VENTAS_AGOTADOS = 90;

app.get('/api/productos/agotados', auth(true), async (req, res) => {
  try {
    const { data: productos, error } = await db.from('productos')
      .select('id, nombre, sku, stock, costo_unitario, precio_unitario, imagen_urls, categoria_web, ' +
              'stock_ilimitado, es_servicio, es_pedido_encargo, por_llegar, archivado, es_borrador, publicado_web');
    if (error) throw error;

    const agotados = (productos || []).filter(agotadoDeVerdad);
    const idsAgotados = new Set(agotados.map(p => Number(p.id)));

    const { data: filas, error: errF } = await db.from('agotados_decisiones').select('*');
    if (errF) throw errF;

    /* El producto volvió a tener stock: se borra su fila para que, cuando
       se agote de nuevo, vuelva a preguntar. La decisión de septiembre no
       tiene por qué valer para la de diciembre. */
    const revivieron = (filas || []).filter(f => !idsAgotados.has(Number(f.producto_id)));
    for (const f of revivieron) {
      await db.from('agotados_decisiones').delete().eq('producto_id', f.producto_id);
    }

    const yaTiene = new Set((filas || [])
      .filter(f => idsAgotados.has(Number(f.producto_id))).map(f => Number(f.producto_id)));
    const nuevos = agotados.filter(p => !yaTiene.has(Number(p.id)));
    if (nuevos.length) {
      await db.from('agotados_decisiones').insert(nuevos.map(p => ({ producto_id: Number(p.id) })));
    }

    const decididos = new Map((filas || [])
      .filter(f => f.decision).map(f => [Number(f.producto_id), f]));
    const pendientes = agotados.filter(p => !decididos.has(Number(p.id)));

    const ventas = await ventasRecientesPorProducto(pendientes.map(p => p.id), DIAS_VENTAS_AGOTADOS);

    res.json({
      dias: DIAS_VENTAS_AGOTADOS,
      pendientes: pendientes.map(p => {
        const v = ventas.get(Number(p.id)) || { unidades: 0, ultimaVenta: null };
        return {
          id: p.id,
          nombre: p.nombre,
          sku: p.sku || null,
          imagen_url: Array.isArray(p.imagen_urls) ? (p.imagen_urls[0] || null) : null,
          categoria_web: p.categoria_web || null,
          publicado_web: !!p.publicado_web,
          costo_unitario: num(p.costo_unitario),
          precio_unitario: num(p.precio_unitario),
          margen: num(p.precio_unitario) - num(p.costo_unitario),
          unidades_vendidas: v.unidades,
          ultima_venta: v.ultimaVenta
        };
      }).sort((a, b) => b.unidades_vendidas - a.unidades_vendidas)
    });
  } catch (error) {
    return enviarErrorBD(res, error, 'GET /api/productos/agotados');
  }
});

/* Aplica la decisión del dueño. Es el ÚNICO lugar donde un agotado cambia
   de estado: el GET de arriba solo detecta y pregunta. */
const DECISIONES_AGOTADO = ['por_llegar', 'encargo', 'archivar', 'dejar'];

app.post('/api/productos/:id/agotado', auth(true), async (req, res) => {
  const id = Number(req.params.id);
  const decision = String(req.body?.decision || '').trim();
  if (!Number.isFinite(id) || id <= 0) return enviarError(res, 400, 'Producto inválido');
  if (!DECISIONES_AGOTADO.includes(decision)) {
    return enviarError(res, 400, `Decisión inválida. Debe ser una de: ${DECISIONES_AGOTADO.join(', ')}`);
  }

  try {
    const { data: producto, error: errP } = await db.from('productos')
      .select('id, nombre, stock').eq('id', id).maybeSingle();
    if (errP) throw errP;
    if (!producto) return enviarError(res, 404, 'Producto no encontrado');

    const cambios = {};
    if (decision === 'por_llegar') {
      cambios.por_llegar = true;
      // Unidades y fecha son opcionales: el tope de reserva lo define el
      // dueño a mano (sql/44) y la fecha se muestra siempre como estimada.
      const unidades = Math.max(0, Math.round(num(req.body?.stock_por_llegar)));
      if (unidades > 0) cambios.stock_por_llegar = unidades;
      const fecha = String(req.body?.fecha_llegada_estimada || '').trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) cambios.fecha_llegada_estimada = fecha;
    } else if (decision === 'encargo') {
      cambios.es_pedido_encargo = true;
    } else if (decision === 'archivar') {
      cambios.archivado = true;
      // Mismo criterio que PUT /api/productos/:id: un archivado nunca
      // puede quedar visible en la tienda.
      cambios.publicado_web = false;
    }

    if (Object.keys(cambios).length) {
      const { error: errU } = await db.from('productos').update(cambios).eq('id', id);
      if (errU) throw errU;
    }

    const fila = {
      producto_id: id,
      decision,
      decidido_en: new Date().toISOString(),
      decidido_por: req.usuario?.usuario || req.usuario?.rol || null,
      nota: String(req.body?.nota || '').trim().slice(0, 200) || null
    };
    const { data: previo } = await db.from('agotados_decisiones')
      .select('producto_id').eq('producto_id', id).maybeSingle();
    if (previo) await db.from('agotados_decisiones').update(fila).eq('producto_id', id);
    else await db.from('agotados_decisiones').insert([fila]);

    res.json({ ok: true, producto_id: id, decision, cambios });
  } catch (error) {
    return enviarErrorBD(res, error, 'POST /api/productos/:id/agotado');
  }
});

/* ============================================================
   COMPRAS DE MERCADERÍA Y ROTACIÓN (sql/56)
   ------------------------------------------------------------
   Responde las dos preguntas que el dueño hizo el 16-09-2026:
     · "Compré 50 ventiladores, ¿se están vendiendo al ritmo que esperaba
        o me conviene devolverlos y comprarlos en otra fecha?"
     · "Compré 20 monitores para navidad y al 1 de enero me sobran 10."

   TODO EL CÁLCULO VIVE ACÁ, igual que Inteligencia y Utilidades: así el
   panel, el modal del producto y cualquier informe futuro no pueden
   contradecirse entre sí. Y NADA de esto se guarda: un "te sobran 10"
   guardado envejece mal y después se lee como si fuera de hoy.

   CÓMO SE REPARTEN LAS VENTAS ENTRE VARIAS COMPRAS DEL MISMO PRODUCTO
   Por orden de llegada (la más antigua primero). Si compró 50 en agosto y
   20 en noviembre, las ventas de septiembre se descuentan de las de
   agosto. Es una atribución, no un hecho: el POS no sabe de qué caja
   física salió cada unidad. Se eligió así porque es como se vende en
   realidad y es lo mismo que hace el PEPS del costeo (sql/09).

   OJO: el cálculo se topea contra el stock real. Si las cuentas dicen que
   quedan 12 y en la estantería hay 8, manda el 8 — la diferencia es
   merma, robo o un ajuste de stock, y suponer 12 llevaría a ofrecerle al
   proveedor una devolución que no se puede cumplir.
   ============================================================ */

const MOTIVOS_CIERRE_INGRESO = ['devuelto', 'vendido', 'liquidado', 'otro'];

function fechaValidaISO(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/* Para los días entre dos fechas se usa diasEntre(), que ya existe más
   abajo (lo usa el recordatorio del F29): compara en UTC, que es lo que
   hace falta acá — un día de diferencia por zona horaria cambiaría una
   fecha de vencimiento. NO se redefine: dos funciones con el mismo nombre
   en este proyecto se pisan en silencio. */

function sanearIngreso(body) {
  const fecha = String(body?.fecha_compra || '').trim();
  if (!fechaValidaISO(fecha)) return { error: 'La fecha de compra debe venir como YYYY-MM-DD' };
  if (fecha > fechaHoyChile()) return { error: 'La fecha de compra no puede estar en el futuro' };

  const cantidad = num(body?.cantidad);
  if (cantidad <= 0) return { error: 'La cantidad comprada debe ser mayor a 0' };

  const costo = num(body?.costo_unitario);
  if (costo < 0) return { error: 'El costo unitario no puede ser negativo' };

  const devolucion = String(body?.devolucion_hasta || '').trim();
  if (devolucion && !fechaValidaISO(devolucion)) {
    return { error: 'La fecha de devolución debe venir como YYYY-MM-DD' };
  }
  if (devolucion && devolucion < fecha) {
    return { error: 'La fecha de devolución no puede ser anterior a la compra' };
  }

  return {
    datos: {
      fecha_compra: fecha,
      cantidad,
      costo_unitario: Math.round(costo),
      proveedor: String(body?.proveedor || '').trim().slice(0, 80) || null,
      devolucion_hasta: devolucion || null,
      referencia: String(body?.referencia || '').trim().slice(0, 80) || null,
      nota: String(body?.nota || '').trim().slice(0, 300) || null
    }
  };
}

/* El corazón del asunto: qué pasó con cada compra desde que llegó.
   `ingresos` son las entradas ABIERTAS; `ventasPorProducto` es un
   Map(producto_id → [{fecha, cantidad}]) con las ventas del período. */
function analizarIngresos(ingresos, ventasPorProducto, productosPorId, hoyISO) {
  const porProducto = new Map();
  for (const ing of ingresos) {
    const pid = Number(ing.producto_id);
    if (!porProducto.has(pid)) porProducto.set(pid, []);
    porProducto.get(pid).push(ing);
  }

  const filas = [];
  for (const [pid, lista] of porProducto) {
    const producto = productosPorId.get(pid);
    if (!producto) continue;
    lista.sort((a, b) => String(a.fecha_compra).localeCompare(String(b.fecha_compra)));

    /* Reparto por orden de llegada: cada venta posterior a una compra la
       va consumiendo. Una venta anterior a TODAS las compras abiertas no
       se atribuye a ninguna (era stock viejo). */
    const ventas = (ventasPorProducto.get(pid) || [])
      .slice().sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
    const restantes = lista.map(i => num(i.cantidad));
    const vendidas = lista.map(() => 0);

    for (const v of ventas) {
      let porRepartir = num(v.cantidad);
      for (let i = 0; i < lista.length && porRepartir > 0; i++) {
        if (String(v.fecha) < String(lista[i].fecha_compra)) continue;   // llegó después
        const toma = Math.min(restantes[i], porRepartir);
        restantes[i] -= toma;
        vendidas[i] += toma;
        porRepartir -= toma;
      }
    }

    /* Tope contra el stock real: si las cuentas dicen 12 y hay 8, manda el
       8. Se recorta desde la compra más antigua, que es la que ya debería
       haberse ido. */
    const stockReal = producto.stock_ilimitado ? Infinity : Math.max(0, num(producto.stock));
    let sobraSobreStock = restantes.reduce((a, b) => a + b, 0) - stockReal;
    for (let i = 0; i < restantes.length && sobraSobreStock > 0; i++) {
      const recorte = Math.min(restantes[i], sobraSobreStock);
      restantes[i] -= recorte;
      sobraSobreStock -= recorte;
    }

    lista.forEach((ing, i) => {
      const dias = Math.max(1, diasEntre(String(ing.fecha_compra), hoyISO));
      const restante = Math.max(0, restantes[i]);
      const ritmoDiario = vendidas[i] / dias;
      const ritmoMensual = Math.round(ritmoDiario * 30 * 10) / 10;
      const capital = Math.round(restante * num(ing.costo_unitario));

      const diasParaDevolver = ing.devolucion_hasta ? diasEntre(hoyISO, String(ing.devolucion_hasta)) : null;
      // Lo que alcanzaría a venderse antes de que se cierre la ventana
      const proyectado = diasParaDevolver != null && diasParaDevolver > 0
        ? Math.floor(ritmoDiario * diasParaDevolver) : 0;
      const sobranteEstimado = diasParaDevolver != null ? Math.max(0, restante - proyectado) : null;
      const mesesParaAgotar = ritmoMensual > 0 ? Math.round((restante / ritmoMensual) * 10) / 10 : null;

      filas.push({
        id: ing.id,
        producto_id: pid,
        nombre: producto.nombre,
        sku: producto.sku || null,
        imagen_url: Array.isArray(producto.imagen_urls) ? (producto.imagen_urls[0] || null) : null,
        fecha_compra: ing.fecha_compra,
        proveedor: ing.proveedor || null,
        referencia: ing.referencia || null,
        cantidad: num(ing.cantidad),
        costo_unitario: num(ing.costo_unitario),
        precio_unitario: num(producto.precio_unitario),
        margen_unitario: num(producto.precio_unitario) - num(ing.costo_unitario),
        dias_desde_compra: dias,
        vendidas: vendidas[i],
        restante,
        stock_actual: producto.stock_ilimitado ? null : num(producto.stock),
        ritmo_mensual: ritmoMensual,
        meses_para_agotar: mesesParaAgotar,
        capital_atrapado: capital,
        devolucion_hasta: ing.devolucion_hasta || null,
        dias_para_devolver: diasParaDevolver,
        sobrante_estimado: sobranteEstimado,
        ...recomendarSobreIngreso({ restante, diasParaDevolver, sobranteEstimado, ritmoMensual, capital, dias, tieneVentana: !!ing.devolucion_hasta })
      });
    });
  }

  // Lo más urgente primero: ventana por cerrarse, después plata atrapada
  const peso = { urgente: 0, devolver: 1, ventana_cerrada: 2, liquidar: 3, vigilar: 4, ok: 5, agotado: 6 };
  filas.sort((a, b) => (peso[a.recomendacion] ?? 9) - (peso[b.recomendacion] ?? 9)
    || b.capital_atrapado - a.capital_atrapado);
  return filas;
}

/* La recomendación es una SUGERENCIA con su razón a la vista, nunca una
   acción automática: quien decide devolver o liquidar es el dueño. */
function recomendarSobreIngreso({ restante, diasParaDevolver, sobranteEstimado, ritmoMensual, capital, dias, tieneVentana }) {
  if (restante <= 0) {
    return { recomendacion: 'agotado', mensaje: 'Se vendió completa. Si conviene, repón.' };
  }

  if (tieneVentana && diasParaDevolver != null && diasParaDevolver >= 0) {
    const plazo = diasParaDevolver === 0 ? 'HOY' : `en ${diasParaDevolver} día${diasParaDevolver === 1 ? '' : 's'}`;
    if (sobranteEstimado >= 1) {
      const urgente = diasParaDevolver <= 7;
      return {
        recomendacion: urgente ? 'urgente' : 'devolver',
        mensaje: `Al ritmo de ahora (${ritmoMensual}/mes) te van a sobrar ${sobranteEstimado} cuando se cierre el plazo. `
               + `Se pueden devolver hasta ${sobranteEstimado} unidades, y el plazo vence ${plazo}. `
               + `Son ${fmtPesos(Math.round(sobranteEstimado * (capital / Math.max(1, restante))))} que vuelven a tu bolsillo.`
      };
    }
    return {
      recomendacion: 'ok',
      mensaje: `Va bien: al ritmo de ahora (${ritmoMensual}/mes) se venden las ${restante} que quedan antes de que venza el plazo (${plazo}).`
    };
  }

  if (tieneVentana && diasParaDevolver != null && diasParaDevolver < 0) {
    return {
      recomendacion: 'ventana_cerrada',
      mensaje: `El plazo de devolución venció hace ${Math.abs(diasParaDevolver)} día(s). `
             + `Quedan ${restante} unidades con ${fmtPesos(capital)} adentro: ya solo se sale vendiéndolas.`
    };
  }

  // Sin ventana de devolución: la única salida es vender
  if (ritmoMensual <= 0 && dias >= 60) {
    return {
      recomendacion: 'liquidar',
      mensaje: `${dias} días desde que llegó y ni una venta. ${fmtPesos(capital)} parados en ${restante} unidades, `
             + `y el proveedor no las recibe de vuelta. Liquidar es la única salida.`
    };
  }
  if (ritmoMensual > 0 && restante / ritmoMensual > 6) {
    return {
      recomendacion: 'vigilar',
      mensaje: `Al ritmo de ahora (${ritmoMensual}/mes) tardan ${Math.round(restante / ritmoMensual)} meses en venderse. `
             + `Son ${fmtPesos(capital)} inmovilizados mientras tanto.`
    };
  }
  return {
    recomendacion: 'ok',
    mensaje: `Rota bien: ${ritmoMensual}/mes, quedan ${restante}.`
  };
}

/* Formato de pesos del backend — el frontend tiene el suyo (fmtCLP), pero
   estos textos se arman acá para que el panel, el modal y cualquier
   informe digan exactamente lo mismo. */
function fmtPesos(v) {
  const n = Math.round(Number(v) || 0);
  return '$' + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/* ---------- Entradas de un producto (modal del producto) ---------- */

app.get('/api/productos/:id/ingresos', auth(true), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return enviarError(res, 400, 'Producto inválido');
  const { data, error } = await db.from('ingresos_mercaderia')
    .select('*').eq('producto_id', id).order('fecha_compra', { ascending: false });
  if (error) return enviarErrorBD(res, error);
  res.json(data || []);
});

app.post('/api/productos/:id/ingresos', auth(true), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return enviarError(res, 400, 'Producto inválido');

  const { datos, error: errVal } = sanearIngreso(req.body);
  if (errVal) return enviarError(res, 400, errVal);

  try {
    const { data: producto, error: errP } = await db.from('productos')
      .select('id').eq('id', id).maybeSingle();
    if (errP) throw errP;
    if (!producto) return enviarError(res, 404, 'Producto no encontrado');

    const { data, error } = await db.from('ingresos_mercaderia').insert([{
      ...datos, producto_id: id, creado_por: req.usuario?.usuario || req.usuario?.rol || null
    }]).select('*').single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    return enviarErrorBD(res, error, 'POST /api/productos/:id/ingresos');
  }
});

/* Cerrar una entrada: se devolvió, se vendió o se liquidó. No se borra —
   el historial de compras es justamente lo que hace útil la tabla. */
app.put('/api/ingresos/:id', auth(true), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return enviarError(res, 400, 'Entrada inválida');

  const motivo = String(req.body?.cerrado_motivo || '').trim();
  const reabrir = req.body?.reabrir === true;
  if (!reabrir && !MOTIVOS_CIERRE_INGRESO.includes(motivo)) {
    return enviarError(res, 400, `Motivo inválido. Debe ser uno de: ${MOTIVOS_CIERRE_INGRESO.join(', ')}`);
  }

  const cambios = reabrir
    ? { cerrado_en: null, cerrado_motivo: null }
    : { cerrado_en: new Date().toISOString(), cerrado_motivo: motivo };
  if (req.body?.nota !== undefined) cambios.nota = String(req.body.nota || '').trim().slice(0, 300) || null;

  const { data, error } = await db.from('ingresos_mercaderia').update(cambios).eq('id', id).select('*');
  if (error) return enviarErrorBD(res, error);
  if (!data || data.length === 0) return enviarError(res, 404, 'Entrada no encontrada');
  res.json(data[0]);
});

app.delete('/api/ingresos/:id', auth(true), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return enviarError(res, 400, 'Entrada inválida');
  const { error } = await db.from('ingresos_mercaderia').delete().eq('id', id);
  if (error) return enviarErrorBD(res, error);
  res.json({ ok: true });
});

/* ---------- El informe: qué compra conviene devolver ---------- */

app.get('/api/pos/rotacion-compras', auth(true), async (req, res) => {
  try {
    const hoy = fechaHoyChile();
    const { data: ingresos, error: errI } = await db.from('ingresos_mercaderia')
      .select('*').is('cerrado_en', null);
    if (errI) throw errI;

    if (!ingresos || ingresos.length === 0) {
      return res.json({ hoy, filas: [], resumen: { entradas: 0, capital: 0, devolvibles: 0, monto_devolvible: 0 } });
    }

    const ids = [...new Set(ingresos.map(i => Number(i.producto_id)))];
    const { data: productos, error: errP } = await db.from('productos')
      .select('id, nombre, sku, stock, stock_ilimitado, precio_unitario, imagen_urls').in('id', ids);
    if (errP) throw errP;
    const productosPorId = new Map((productos || []).map(p => [Number(p.id), p]));

    /* Ventas desde la compra más antigua que sigue abierta: no hace falta
       traer el histórico completo para repartir lo que se vendió después. */
    const desde = ingresos.reduce((min, i) => (String(i.fecha_compra) < min ? String(i.fecha_compra) : min), hoy);
    const { data: ventas, error: errV } = await db.from('ventas').select('id, fecha').gte('fecha', desde);
    if (errV) throw errV;
    const fechaDe = new Map((ventas || []).map(v => [v.id, v.fecha]));

    const { data: items, error: errIt } = await db.from('venta_items')
      .select('venta_id, producto_id, cantidad').in('producto_id', ids);
    if (errIt) throw errIt;

    const ventasPorProducto = new Map();
    for (const it of items || []) {
      const fecha = fechaDe.get(it.venta_id);
      if (!fecha) continue;
      const pid = Number(it.producto_id);
      if (!ventasPorProducto.has(pid)) ventasPorProducto.set(pid, []);
      ventasPorProducto.get(pid).push({ fecha: String(fecha).slice(0, 10), cantidad: num(it.cantidad) });
    }

    const filas = analizarIngresos(ingresos, ventasPorProducto, productosPorId, hoy);
    const devolvibles = filas.filter(f => f.recomendacion === 'devolver' || f.recomendacion === 'urgente');

    res.json({
      hoy,
      filas,
      resumen: {
        entradas: filas.length,
        capital: filas.reduce((a, f) => a + f.capital_atrapado, 0),
        devolvibles: devolvibles.length,
        // Cuánta plata se recupera si devuelve todo lo que va a sobrar
        monto_devolvible: devolvibles.reduce((a, f) => a + Math.round(f.sobrante_estimado * f.costo_unitario), 0)
      }
    });
  } catch (error) {
    return enviarErrorBD(res, error, 'GET /api/pos/rotacion-compras');
  }
});

app.get('/api/productos/auditoria-envio', auth(true), async (req, res) => {
  const { data, error } = await db.from('productos')
    .select('id, nombre, sku, peso_kg, alto_cm, ancho_cm, profundidad_cm')
    .eq('stock_ilimitado', false);
  if (error) return enviarErrorBD(res, error);

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

  if (error) return enviarErrorBD(res, error);

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
  if (error) return enviarErrorBD(res, error);

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

/* Medidas y peso: ruta propia, separada del guardado del producto.
   ------------------------------------------------------------
   POR QUÉ APARTE (pedido del dueño, 12-09-2026)
   El formulario manda siempre los cuatro campos, aunque nadie los toque.
   Cuando compartían ruta con el resto, corregir un precio marcaba el
   producto como "medido hoy" y el registro dejaba de servir. Y no es un
   dato cosmético: el peso y el volumen deciden cuánto cuesta cada
   despacho, así que una medida mal puesta se paga en todos los envíos.

   POR QUÉ SE PIDE EL NOMBRE ESCRITO Y NO EL USUARIO DE LA SESIÓN
   En el mostrador varias personas trabajan con la misma cuenta de
   administrador. El usuario logueado diría "admin" siempre, que es tanto
   como no decir nada. Escribir el nombre obliga a hacerse cargo. */
app.put('/api/productos/:id/medidas', auth(true), async (req, res) => {
  const quien = String(req.body?.medido_por || '').trim();
  if (quien.length < 2) {
    return enviarError(res, 400, 'Escribe tu nombre para registrar quién tomó las medidas');
  }
  if (quien.length > 60) return enviarError(res, 400, 'El nombre es demasiado largo');

  /* Cada medida es opcional por separado: es normal saber el peso y no
     tener las tres dimensiones, o al revés. Lo que no se manda no se
     toca; mandar vacío la borra a propósito (corregir un dato inventado
     dejándolo en blanco es una acción válida). */
  const cambios = {};
  for (const campo of ['peso_kg', 'alto_cm', 'ancho_cm', 'profundidad_cm']) {
    if (req.body?.[campo] === undefined) continue;
    const crudo = req.body[campo];
    if (crudo === null || String(crudo).trim() === '') {
      cambios[campo] = null;
      continue;
    }
    const valor = num(crudo);
    if (valor < 0) return enviarError(res, 400, `${campo} no puede ser negativo`);
    // Tope de cordura: 300 kg / 300 cm. Un tecleo de más (18 en vez de 1,8)
    // multiplica por diez el costo de envío calculado y nadie lo nota.
    if (valor > 300) return enviarError(res, 400, `${campo} parece un error de tecleo (${valor})`);
    cambios[campo] = valor || null;
  }

  if (Object.keys(cambios).length === 0) {
    return enviarError(res, 400, 'No enviaste ninguna medida');
  }

  cambios.medidas_actualizado_en = new Date().toISOString();
  cambios.medidas_actualizado_por = quien;

  const { data, error } = await db.from('productos')
    .update(cambios).eq('id', req.params.id).select().single();
  if (error) return enviarErrorBD(res, error);
  res.json(data);
});

app.put('/api/productos/:id', auth(true), async (req, res) => {
  const producto = sanearProducto(req.body);
  if (!producto) return enviarError(res, 400, 'El nombre del producto es obligatorio');

  // Al editar se excluye el propio registro: no puede chocar consigo mismo
  const dup = await buscarDuplicado(producto, req.params.id);
  if (dup) return enviarError(res, 409, errorDuplicado(dup), { duplicado: dup });

  const { data, error } = await db.from('productos').update(producto).eq('id', req.params.id).select().single();
  if (error) return enviarErrorBD(res, error);
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
  const { data: producto } = await db.from('productos')
    .select('id, imagen_urls').eq('id', req.params.id).maybeSingle();
  if (!producto) return enviarError(res, 404, 'Producto no encontrado');

  const lista = [...(producto.imagen_urls || [])];

  /* Reordenamiento libre (arrastrar y soltar en el modal): el cliente manda
     el arreglo completo en el orden nuevo. Se valida que sea EXACTAMENTE el
     mismo conjunto de fotos que ya tiene el producto — ni una foto de más
     ni de menos — antes de guardarlo, para que un payload manipulado no
     pueda inventar o borrar fotos por esta vía (esa parte sigue siendo
     POST/DELETE /api/productos/:id/imagen). */
  if (Array.isArray(req.body?.orden)) {
    const ordenNuevo = req.body.orden.map(u => String(u || '').trim()).filter(Boolean);
    const mismoConjunto = ordenNuevo.length === lista.length &&
      [...ordenNuevo].sort().join('\n') === [...lista].sort().join('\n');
    if (!mismoConjunto) return enviarError(res, 400, 'El nuevo orden no coincide con las fotos actuales del producto');

    const { data, error } = await db.from('productos')
      .update({ imagen_urls: ordenNuevo }).eq('id', req.params.id).select('id, imagen_urls').single();
    if (error) return enviarErrorBD(res, error);
    return res.json(data);
  }

  // Un paso (flechas ◀▶): swap con el vecino inmediato.
  const url = String(req.body?.url || '').trim();
  const direccion = req.body?.direccion === 'arriba' ? 'arriba' : 'abajo';
  if (!url) return enviarError(res, 400, 'Falta la url de la imagen a mover');

  const idx = lista.indexOf(url);
  if (idx === -1) return enviarError(res, 404, 'Esa foto ya no está en el producto');

  const idxVecino = direccion === 'arriba' ? idx - 1 : idx + 1;
  if (idxVecino < 0 || idxVecino >= lista.length) return res.json({ id: producto.id, imagen_urls: lista }); // ya está en el extremo

  [lista[idx], lista[idxVecino]] = [lista[idxVecino], lista[idx]];

  const { data, error } = await db.from('productos')
    .update({ imagen_urls: lista }).eq('id', req.params.id).select('id, imagen_urls').single();
  if (error) return enviarErrorBD(res, error);
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
  if (error) return enviarErrorBD(res, error);
  res.json(data);
});

// Eliminación masiva desde la barra de selección (lista explícita de ids).
// Se registra ANTES de "/:id" para no chocar con esa ruta.
app.post('/api/productos/eliminar-lote', auth(true), exigirPinAdmin, async (req, res) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Boolean);
  if (ids.length === 0) return enviarError(res, 400, 'No hay productos seleccionados');

  const { error } = await db.from('productos').delete().in('id', ids);
  if (error) return enviarErrorBD(res, error);
  res.json({ eliminadas: ids.length });
});

/* Borrado total del catálogo: ruta propia para poder exigir el PIN sin
   afectar al borrado de un producto individual. Se registra ANTES de
   "/:id" para que no la capture esa ruta. */
app.delete('/api/productos/todos', auth(true), exigirPinAdmin, async (req, res) => {
  const { error } = await db.from('productos').delete().gt('id', 0);
  if (error) return enviarErrorBD(res, error);
  res.json({ ok: true, alcance: 'todos' });
});

app.delete('/api/productos/:id', auth(true), async (req, res) => {
  const { error } = await db.from('productos').delete().eq('id', req.params.id);
  if (error) return enviarErrorBD(res, error);
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
async function descontarStockNoLotes(items, clave = null) {
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

  /* Ordenado por id: con clave de cobro (sql/50) la base compara este
     arreglo con el del intento anterior, y el orden tiene que ser estable. */
  const p_items = [...pedidoPorProducto.entries()]
    .map(([producto_id, cantidad]) => ({ producto_id: Number(producto_id), cantidad }))
    .sort((a, b) => a.producto_id - b.producto_id);

  /* Con clave, descontar es idempotente: se puede reintentar ante un corte
     de Supabase sin descontar dos veces. Sin clave (llamadas antiguas), no se
     reintenta: un timeout no dice si Postgres alcanzó a descontar. */
  const { data, error } = clave
    ? await consultarConReintento(() => db.rpc('descontar_stock_venta_idem', { p_items, p_clave: clave }))
    : await db.rpc('descontar_stock_venta', { p_items });
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

  // Para trabajadores el costo lo pone el catálogo, no el navegador. De
  // paso se trae condición/meses de garantía para dejarlos como snapshot
  // en cada línea (módulo Garantías, ver sql/31-garantias.sql) — si el
  // producto cambia de condición o de garantía después, las ventas ya
  // hechas no se mueven, mismo criterio que el snapshot de nombre/sku.
  let costosCatalogo = {};
  let garantiaCatalogo = {};
  const ids = [...new Set(lista.map(i => i.producto_id).filter(Boolean))];
  if (ids.length) {
    const { data } = await db.from('productos').select('id, costo_unitario, condicion, meses_garantia').in('id', ids);
    (data || []).forEach(p => {
      costosCatalogo[p.id] = num(p.costo_unitario);
      garantiaCatalogo[p.id] = { condicion: p.condicion || null, meses_garantia: p.meses_garantia ?? 6 };
    });
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
    const garantia = it.producto_id ? garantiaCatalogo[it.producto_id] : null;

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
      serial_number: it.serial_number || null,
      // Módulo Garantías: sin producto de catálogo (ítem escrito a mano)
      // queda sin condición y con el default de 6 meses.
      condicion: garantia?.condicion ?? null,
      meses_garantia: garantia?.meses_garantia ?? 6
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

/* Convierte tipo ('MONTO'|'PORCENTAJE') + valor en el monto real a
   descontar del subtotal de los ítems — SIEMPRE calculado en el servidor
   a partir del subtotal (nunca se confía en un monto que mande el
   navegador, mismo criterio que el resto de las cifras de la venta).
   Nunca deja el descuento negativo ni mayor al subtotal, y un porcentaje
   nunca pasa de 100. */
function calcularDescuentoMonto(items, tipo, valor) {
  const subtotal = items.reduce((a, i) => a + i.subtotal, 0);
  const v = Math.max(0, num(valor));
  let monto = 0;
  if (tipo === 'PORCENTAJE') monto = subtotal * (Math.min(v, 100) / 100);
  else if (tipo === 'MONTO') monto = v;
  return Math.min(Math.max(0, monto), subtotal);
}

/* `descuentoMonto` sale de calcularDescuentoMonto() — se resta del
   subtotal para llegar a `total`, y por lo tanto también de `utilidad`
   (total - costo_total): un descuento sale directo del margen, nunca del
   costo de lo vendido. Ver sql/35-descuento-venta.sql. */
function totalizar(items, descuentoMonto = 0) {
  const subtotal = items.reduce((a, i) => a + i.subtotal, 0);
  const costoTotal = items.reduce((a, i) => a + i.costo_unitario * i.cantidad, 0);
  const descuento = Math.min(Math.max(0, num(descuentoMonto)), subtotal);
  const total = subtotal - descuento;
  return { total, costo_total: costoTotal, utilidad: total - costoTotal, descuento_monto: descuento };
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
    const patron = patronIlike(texto);

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

    if (errItems) return enviarErrorBD(res, errItems);

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
  if (error) return enviarErrorBD(res, error);
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

  if (error) return enviarErrorBD(res, error);
  res.json(data || []);
});

// Detalle: venta + ítems (el ticket lo necesita para reimprimir)
app.get('/api/ventas/:id', auth(), async (req, res) => {
  const { data: venta, error } = await db.from('ventas').select('*').eq('id', req.params.id).single();
  if (error) return enviarError(res, 404, 'Venta no encontrada');

  const { data: items, error: errItems } = await db.from('venta_items').select('*').eq('venta_id', req.params.id).order('id');
  if (errItems) return enviarErrorBD(res, errItems);

  res.json({
    ...limpiarParaRol(venta, req.usuario.rol),
    items: limpiarLista(items, req.usuario.rol)
  });
});

/* Clave de cobro (sql/50): la genera el POS y la repite en los reintentos
   del mismo carrito. Solo letras, números y guiones, hasta 80 caracteres. */
function claveIdempotenciaValida(valor) {
  const t = String(valor || '').trim();
  return /^[A-Za-z0-9-]{8,80}$/.test(t) ? t : null;
}

app.post('/api/ventas', auth(), async (req, res) => {
  const clave = claveIdempotenciaValida(req.body?.clave_idempotencia);
  let stockDescontadoConClave = false;
  let ventaGuardada = false;

  // De paso, devuelve el stock de cobros abandonados tras un corte (sql/50).
  // No bloquea ni falla la venta si no resulta.
  if (clave) db.rpc('limpiar_descuentos_huerfanos').then(() => {}, () => {});

  try {
    /* Reintento de un cobro que ya quedó guardado (el corte fue DESPUÉS de
       guardar): se responde con la venta existente, sin tocar nada más. */
    let ventaExistente = null;
    if (clave) {
      const { data: previa, error: errPrevia } = await consultarConReintento(() =>
        db.from('ventas').select('*').eq('clave_idempotencia', clave).maybeSingle());
      if (errPrevia) throw new Error(errPrevia.message);
      if (previa) {
        const { data: itemsPrevios, error: errIt } = await consultarConReintento(() =>
          db.from('venta_items').select('*').eq('venta_id', previa.id));
        if (errIt) throw new Error(errIt.message);
        if ((itemsPrevios || []).length) {
          const envio = await registrarEnvioDeVenta(previa, req.body);
          return res.status(200).json({ ...previa, items: itemsPrevios, ya_registrada: true, envio_aviso: envio.aviso || null });
        }
        ventaExistente = previa;   // quedó la cabecera sin detalle: se completa abajo
      }
    }

    const items = await normalizarItems(req.body?.items, req.usuario.rol);

    /* BIZ-02: se comprueba el stock Y se descuenta en una sola llamada
       atómica ANTES de escribir la venta. Si algo no alcanza, la función
       SQL lanza una excepción, no descuenta nada y la venta se rechaza
       con 400: la base queda intacta. Los productos con lotes se validan
       y descuentan aparte, dentro de aplicarCostosFifo. */
    const yaDescontados = await descontarStockNoLotes(items, clave);
    if (clave) stockDescontadoConClave = true;
    items.forEach(it => {
      if (it.producto_id && yaDescontados.has(Number(it.producto_id))) it._stockAtomico = true;
    });

    /* PEPS: consume las capas y corrige el costo de cada línea ANTES de
       totalizar, para que la utilidad guardada sea la real. Los productos
       sin lotes pasan de largo sin cambios. Si la cabecera ya existía (se
       está completando un cobro cortado), no se vuelve a consumir. */
    const { consumos } = ventaExistente ? { consumos: [] } : await aplicarCostosFifo(items);

    // Descuento sobre el total (no por ítem) — ver calcularDescuentoMonto().
    // Sin tipo válido, es como si no hubiera descuento (venta de siempre).
    const descuentoTipo = ['MONTO', 'PORCENTAJE'].includes(req.body?.descuento_tipo) ? req.body.descuento_tipo : null;
    const descuentoValor = descuentoTipo ? Math.max(0, num(req.body?.descuento_valor)) : 0;
    const descuentoMonto = descuentoTipo ? calcularDescuentoMonto(items, descuentoTipo, descuentoValor) : 0;

    const totales = totalizar(items, descuentoMonto);

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
      // Contacto del cliente (sql/37). Siempre opcional: si no viene,
      // la venta se registra igual — el POS atiende con el cliente
      // esperando enfrente y nada puede bloquear el cobro.
      cliente_telefono: normalizarTelefonoChile(req.body?.cliente_telefono),
      cliente_correo: (req.body?.cliente_correo || '').trim().toLowerCase() || null,
      metodo_pago: metodoPago,
      estado: esPendiente ? 'PENDIENTE' : 'PAGADA',
      fecha_pago: esPendiente ? null : new Date().toISOString(),
      metodo_pago_final: esPendiente ? null : metodoPago,
      tipo_dte: tipoDteValido(req.body?.tipo_dte),
      // Vínculo opcional con la orden de trabajo que se está cobrando
      ot_id: req.body?.ot_id || null,
      numero_ot: (req.body?.numero_ot || '').trim() || null,
      ...totales,
      // Sin descuento real, se guarda tipo=NULL/valor=0 aunque el cajero
      // haya dejado algo tipeado a medias (ej. "%" sin número) — mismo
      // criterio que descuentoMonto === 0 arriba.
      descuento_tipo: totales.descuento_monto > 0 ? descuentoTipo : null,
      descuento_valor: totales.descuento_monto > 0 ? descuentoValor : 0,
      comision_pos: comisionPos,
      pago_mixto: !!pagosMixtos,
      impreso: false,
      // --- Despacho / logística (migración 17) ---
      ...construirDatosEnvio(req.body),
      // Comisión de pasarela web (para el margen neto cuando llegue el e-commerce)
      origen_pago: (req.body?.origen_pago || 'presencial'),
      comision_pasarela: Math.max(0, num(req.body?.comision_pasarela)),
      // Turno de caja activo, si hay uno abierto (se resuelve abajo)
      caja_id: req.body?.caja_id ? Number(req.body.caja_id) : null,
      clave_idempotencia: clave
    };

    // En una venta mixta el método de cabecera queda como "Mixto"
    if (pagosMixtos) cabecera.metodo_pago = 'Mixto';

    /* Sin clave NO se reintenta el insert: un timeout no dice si la fila
       quedó guardada y reintentar podía duplicar la venta. Con clave, el
       índice único lo impide y un "duplicado" significa "ya se guardó". */
    let venta = ventaExistente;
    if (!venta) {
      const insertar = () => db.from('ventas').insert([cabecera]).select().single();
      let { data, error } = clave ? await consultarConReintento(insertar) : await insertar();
      if (error && clave && /duplicate key|23505|clave_idempotencia/i.test(`${error.code} ${error.message}`)) {
        ({ data, error } = await consultarConReintento(() =>
          db.from('ventas').select('*').eq('clave_idempotencia', clave).single()));
      }
      if (error) {
        if (esErrorJwtTransitorio(error.message)) {
          console.warn('[VENTAS] Supabase rechazó la llave por reloj/JWT tras reintentar:', error.message);
          return enviarError(res, 503, 'La base de datos no respondió a tiempo. Intenta cobrar de nuevo en unos segundos.');
        }
        throw new Error(error.message);
      }
      venta = data;
    }
    ventaGuardada = true;

    /* _fifo y _stockAtomico son marcas internas de este proceso: no
       existen como columna, así que se quitan antes de insertar o
       Postgres rechaza la fila. */
    const itemsParaGuardar = items.map(({ _fifo, _stockAtomico, ...i }) => ({ ...i, venta_id: venta.id }));

    const { data: itemsGuardados, error: errItems } = await db.from('venta_items')
      .insert(itemsParaGuardar)
      .select();

    if (errItems) {
      /* Un corte acá no dice si el detalle quedó guardado. Con clave se deja
         la cabecera tal cual: el reintento la encuentra y completa (o ve que
         ya estaba completa). Sin clave, se mantiene lo de siempre. */
      if (clave && esErrorTransitorio(errItems.message)) throw new Error(errItems.message);
      // Evita dejar una venta huérfana si falla el detalle
      await db.from('ventas').delete().eq('id', venta.id);
      ventaGuardada = false;
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

    // Costo del despacho (sql/50). Nunca anula la venta: si falla, avisa.
    const envio = await registrarEnvioDeVenta(venta, req.body);

    res.status(201).json({ ...venta, items, envio_aviso: envio.aviso || null });
  } catch (err) {
    const mensaje = err.message || 'No se pudo registrar la venta';

    /* Corte de Supabase: con clave, el reintento es seguro — se dice así,
       claro, en vez del "Gateway Timeout" pelado de antes. */
    if (esErrorTransitorio(mensaje)) {
      if (res.locals) res.locals.detalleError = `Venta: ${mensaje}`;
      return enviarError(res, 503, clave
        ? 'Supabase no respondió a tiempo. Vuelve a apretar "Registrar venta": no se va a cobrar ni descontar stock dos veces.'
        : 'Supabase no respondió a tiempo. Revisa el historial antes de volver a cobrar.');
    }

    /* Error definitivo (sin stock, dato inválido…): si se alcanzó a
       descontar con clave y la venta NO quedó, se devuelve el stock. */
    if (clave && stockDescontadoConClave && !ventaGuardada) {
      const { error: errRev } = await db.rpc('revertir_descuento_venta', { p_clave: clave });
      if (errRev) console.error('[VENTAS] no se pudo devolver el stock del cobro fallido:', errRev.message);
    }
    enviarError(res, 400, mensaje);
  }
});

/* ============================================================
   ENVÍO DE UNA VENTA (sql/50)
   ------------------------------------------------------------
   Guarda quién llevó el pedido, cuánto costó, cómo se pagó, km y sector.
   Si hubo costo, lo deja como gasto ("Envíos / Despachos"); si salió del
   cajón con la caja abierta, también como egreso del turno para que el
   cierre cuadre. Una fila por venta: un reintento no la duplica.
   Devuelve { aviso } si algo no se pudo guardar — la venta ya está hecha
   y no se anula por esto.
   ============================================================ */
const REPARTIDORES = { indrive: 'InDrive', padre: 'Padre', otro: 'Otro', sin_costo: 'Sin costo' };

async function registrarEnvioDeVenta(venta, body) {
  const e = body?.envio;
  if (!e || venta?.tipo_entrega !== 'despacho') return {};
  const repartidor = Object.keys(REPARTIDORES).includes(e.repartidor) ? e.repartidor : null;
  if (!repartidor) return {};

  try {
    const { data: previo } = await db.from('envios').select('id').eq('venta_id', venta.id).maybeSingle();
    if (previo) return {};

    const costo = repartidor === 'sin_costo' ? 0 : Math.max(0, Math.round(num(e.costo)));
    const desdeCaja = costo > 0 && e.pago === 'caja';
    const metodo = costo > 0 ? (desdeCaja ? 'Efectivo' : 'Transferencia') : null;
    const detalle = String(e.repartidor_detalle || '').trim().slice(0, 80) || null;
    const km = num(e.km) > 0 ? Math.round(num(e.km) * 10) / 10 : null;
    const sector = String(e.sector || '').trim().replace(/\s+/g, ' ').slice(0, 60) || null;
    const quien = repartidor === 'otro' && detalle ? detalle : REPARTIDORES[repartidor];
    const avisos = [];

    let compraId = null;
    if (costo > 0) {
      const { datos, error: errVal } = await sanearCompra({
        clasificacion: 'Envíos / Despachos',
        costo_total: costo,
        proveedor: quien,
        metodo_pago: metodo,
        descripcion: `Envío venta #${venta.numero_orden || venta.id}${sector ? ' · ' + sector : ''}${km ? ' · ' + km + ' km' : ''}`
      });
      if (errVal) avisos.push(`el gasto no se registró (${errVal})`);
      else {
        const { data: compra, error: errC } = await db.from('compras').insert([datos]).select('id').single();
        if (errC) avisos.push('el gasto no se registró');
        else compraId = compra.id;
      }
    }

    let movId = null;
    if (desdeCaja) {
      const { data: caja } = await db.from('cajas_diarias').select('id').eq('estado', 'abierta').limit(1).maybeSingle();
      if (caja) {
        const { data: mov, error: errM } = await db.from('caja_movimientos').insert([{
          caja_id: caja.id, tipo: 'EGRESO', monto: costo, concepto: `Envío ${quien} · venta #${venta.numero_orden || venta.id}`
        }]).select('id').single();
        if (errM) avisos.push('no se descontó del turno de caja');
        else movId = mov.id;
      } else {
        avisos.push('no hay caja abierta: no se descontó del turno');
      }
    }

    /* sql/54. `cobrado_cliente` vacío se guarda NULL, NO 0: un 0 querría
       decir "envío regalado" e inventaría una pérdida que quizás no hubo.
       La diferencia (costo - cobrado) NO se asienta como gasto ni merma:
       el costo completo ya quedó arriba en `compras`, y anotarla otra vez
       la contaría dos veces. */
    const cobrado = e.cobrado_cliente === null || e.cobrado_cliente === undefined || e.cobrado_cliente === ''
      ? null : Math.max(0, Math.round(num(e.cobrado_cliente)));
    const duracion = num(e.duracion_min) > 0
      ? Math.min(1440, Math.round(num(e.duracion_min))) : null;

    const { error: errE } = await db.from('envios').insert([{
      venta_id: venta.id,
      repartidor,
      repartidor_detalle: detalle,
      costo,
      metodo_pago: metodo,
      desde_caja: desdeCaja,
      km,
      sector,
      direccion: venta.direccion_envio || null,
      compra_id: compraId,
      caja_movimiento_id: movId,
      cobrado_cliente: cobrado,
      duracion_min: duracion
    }]);
    if (errE) avisos.push('el detalle del envío no se guardó');

    return avisos.length ? { aviso: `Venta registrada, pero ${avisos.join(' y ')}. Anótalo a mano en Gastos.` } : {};
  } catch (err) {
    console.error('[ENVÍOS] no se pudo registrar el envío:', err.message);
    return { aviso: 'Venta registrada, pero el envío no se guardó. Anótalo a mano en Gastos.' };
  }
}

/* Para el paso de entrega: sectores ya usados (autocompletar) y el promedio
   de InDrive por km, para saber al tiro si un viaje está caro. */
app.get('/api/envios/resumen', auth(), async (req, res) => {
  const { data, error } = await db.from('envios')
    .select('repartidor, costo, km, sector, cobrado_cliente, duracion_min, creado_en')
    .order('creado_en', { ascending: false }).limit(500);
  if (error) return enviarErrorBD(res, error);
  const filas = data || [];

  const sectores = [...new Set(filas.map(f => f.sector).filter(Boolean))].slice(0, 50);
  const conKm = filas.filter(f => f.repartidor === 'indrive' && num(f.km) > 0 && num(f.costo) > 0);
  const totalKm = conKm.reduce((a, f) => a + num(f.km), 0);
  const totalCosto = conKm.reduce((a, f) => a + num(f.costo), 0);

  /* Cuánto puso el dueño de su bolsillo este mes (sql/54). Solo cuentan los
     envíos donde SÍ se anotó lo cobrado: sin ese dato no se sabe si hubo
     pérdida, y suponer 0 inventaría una. */
  const mesChile = fechaHoyChile().slice(0, 7);   // 'YYYY-MM'
  const delMes = filas.filter(f => String(f.creado_en || '').slice(0, 7) === mesChile
    && f.cobrado_cliente !== null && f.cobrado_cliente !== undefined);
  const perdidas = delMes.filter(f => num(f.costo) > num(f.cobrado_cliente));

  const conDuracion = filas.filter(f => num(f.duracion_min) > 0);

  res.json({
    sectores,
    indrive: {
      viajes: conKm.length,
      costoPorKm: totalKm > 0 ? Math.round(totalCosto / totalKm) : null,
      costoPromedio: conKm.length ? Math.round(totalCosto / conKm.length) : null
    },
    bolsillo: {
      envios: perdidas.length,
      total: perdidas.reduce((a, f) => a + (num(f.costo) - num(f.cobrado_cliente)), 0),
      mes: mesChile
    },
    duracionPromedio: conDuracion.length
      ? Math.round(conDuracion.reduce((a, f) => a + num(f.duracion_min), 0) / conDuracion.length) : null,
    totalEnvios: filas.length
  });
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
    /* Contacto del cliente (sql/37): editable después de la venta a
       propósito. El caso real es que el cliente da su WhatsApp recién al
       coordinar la entrega, cuando la venta ya está registrada. */
    if (req.body?.cliente_telefono !== undefined) cambios.cliente_telefono = normalizarTelefonoChile(req.body.cliente_telefono);
    if (req.body?.cliente_correo !== undefined) cambios.cliente_correo = (req.body.cliente_correo || '').trim().toLowerCase() || null;
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

      /* El descuento no viaja en cada edición de ítems: se conserva el que
         ya tenía la venta (tipo/valor) y se recalcula el monto real contra
         el nuevo subtotal — a menos que el body traiga un descuento_tipo
         explícito, en cuyo caso ese manda (permite quitar o cambiar el
         descuento desde el mismo PUT). */
      const { data: ventaActual } = await db.from('ventas')
        .select('descuento_tipo, descuento_valor').eq('id', id).maybeSingle();
      const descuentoTipo = req.body.descuento_tipo !== undefined
        ? (['MONTO', 'PORCENTAJE'].includes(req.body.descuento_tipo) ? req.body.descuento_tipo : null)
        : (ventaActual?.descuento_tipo || null);
      const descuentoValor = req.body.descuento_valor !== undefined
        ? Math.max(0, num(req.body.descuento_valor))
        : Math.max(0, num(ventaActual?.descuento_valor));
      const descuentoMonto = descuentoTipo ? calcularDescuentoMonto(items, descuentoTipo, descuentoValor) : 0;

      Object.assign(cambios, totalizar(items, descuentoMonto), {
        descuento_tipo: descuentoMonto > 0 ? descuentoTipo : null,
        descuento_valor: descuentoMonto > 0 ? descuentoValor : 0
      });

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
  if (errSel) return enviarErrorBD(res, errSel);

  const ids = (filas || []).map(f => f.id);
  if (ids.length === 0) return res.json({ ok: true, eliminadas: 0 });

  await revertirEfectosDeVentas(ids);

  const { error } = await db.from('ventas').delete().in('id', ids);
  if (error) return enviarErrorBD(res, error);
  res.json({ ok: true, eliminadas: ids.length });
});

app.delete('/api/ventas/:id', auth(true), async (req, res) => {
  await revertirEfectosDeVentas([Number(req.params.id)]);

  const { error } = await db.from('ventas').delete().eq('id', req.params.id);
  if (error) return enviarErrorBD(res, error);
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

  if (error) return enviarErrorBD(res, error);
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
  if (error) return enviarErrorBD(res, error);
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

  if (error) return enviarErrorBD(res, error);

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
      gasto_fijo_id: body.gasto_fijo_id ? Number(body.gasto_fijo_id) : null,
      /* sql/49: FALSE = ya estaba descontado del saldo (pagado antes o
         cubierto por un reajuste). Solo se toca si el cliente lo manda: el
         modal normal de Gastos no lo conoce y un PUT desde ahí no debe
         devolverle el descuento a un gasto que se marcó así. */
      ...(body.afecta_saldo !== undefined
        ? { afecta_saldo: !(body.afecta_saldo === false || body.afecta_saldo === 'false') }
        : {})
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
  if (error) return enviarErrorBD(res, error);
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
    if (error) return enviarErrorBD(res, error);
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
    if (error) return enviarErrorBD(res, error);
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
  if (error) return enviarErrorBD(res, error);
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
    if (errBuscar) return enviarErrorBD(res, errBuscar);
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
        if (errTraspaso) return enviarErrorBD(res, errTraspaso);
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
      if (errAjuste) return enviarErrorBD(res, errAjuste);
    }

    const { error } = await db.from('compras').delete().eq('id', req.params.id);
    if (error) return enviarErrorBD(res, error);
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
  if (error) return enviarErrorBD(res, error);
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
  if (error) return enviarErrorBD(res, error);
  res.status(201).json(data);
});

// Cancela un programado pendiente (no se materializará)
app.delete('/api/gastos-programados/:id', auth(true), async (req, res) => {
  const { data, error } = await db.from('gastos_programados')
    .update({ estado: 'cancelado' }).eq('id', req.params.id).eq('estado', 'pendiente').select().maybeSingle();
  if (error) return enviarErrorBD(res, error);
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
  if (error) return enviarErrorBD(res, error);

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
  if (error) return enviarErrorBD(res, error);
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
  if (error) return enviarErrorBD(res, error);
  res.status(201).json(data);
});

app.put('/api/gastos-fijos/:id', auth(true), async (req, res) => {
  const g = sanearGastoFijo(req.body || {});
  g.actualizado_en = new Date().toISOString();

  const { data, error } = await db.from('gastos_fijos').update(g).eq('id', req.params.id).select().single();
  if (error) return enviarErrorBD(res, error);
  res.json(data);
});

app.delete('/api/gastos-fijos/:id', auth(true), async (req, res) => {
  const { error } = await db.from('gastos_fijos').delete().eq('id', req.params.id);
  if (error) return enviarErrorBD(res, error);
  res.json({ ok: true });
});

/* ---------- Inyecciones de capital ---------- */

app.get('/api/inyecciones', auth(true), async (req, res) => {
  const { desde, hasta } = req.query;
  let q = db.from('inyecciones_capital').select('*').order('fecha', { ascending: false });
  if (desde) q = q.gte('fecha', desde);
  if (hasta) q = q.lte('fecha', hasta);

  const { data, error } = await q;
  if (error) return enviarErrorBD(res, error);
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
  if (error) return enviarErrorBD(res, error);
  res.status(201).json(data);
});

app.delete('/api/inyecciones/:id', auth(true), exigirPinAdmin, async (req, res) => {
  const { error } = await db.from('inyecciones_capital').delete().eq('id', req.params.id);
  if (error) return enviarErrorBD(res, error);
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

  if (error) return enviarErrorBD(res, error);

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
    .select('id, total, metodo_pago, metodo_pago_final, pago_mixto, encargo_id')
    .eq('fecha', fecha).eq('estado', 'PAGADA');

  // La venta de un encargo no trae plata nueva: entró abono por abono (sql/46).
  const ventas = (ventasRaw || []).filter(v => !v.encargo_id);
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
    .select('costo_total, metodo_pago, origen, afecta_saldo')
    .gte('fecha', fecha).lte('fecha', fecha + 'T23:59:59');

  // afecta_saldo=false (sql/49): esa plata no salió del cajón ese día
  const gastosEfectivo = (gastosRaw || [])
    .filter(g => esEfectivo(g.metodo_pago) && g.origen !== 'MERMA' && g.afecta_saldo !== false)
    .reduce((a, g) => a + num(g.costo_total), 0);

  const { data: inyRaw } = await db.from('inyecciones_capital')
    .select('monto, metodo').eq('fecha', fecha);

  const inyEfectivo = (inyRaw || [])
    .filter(i => esEfectivo(i.metodo)).reduce((a, i) => a + num(i.monto), 0);

  // Abonos de encargos recibidos en efectivo ese día (sql/46).
  const abonosEfectivo = (await abonosEntreFechas(fecha, fecha))
    .filter(a => esEfectivo(a.metodo_pago)).reduce((s, a) => s + num(a.monto), 0);

  return num(fondoInicial) + ventasEfectivo + inyEfectivo + abonosEfectivo - gastosEfectivo;
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
  if (error) return enviarErrorBD(res, error);
  res.json(data || []);
});

/* Arqueo de hoy, si existe. Lo usa la interfaz para saber si la caja
   está abierta o todavía no se abrió. */
app.get('/api/arqueos/hoy', auth(true), async (req, res) => {
  const hoy = fechaHoyChile();
  const { data, error } = await db.from('arqueos').select('*').eq('fecha', hoy).maybeSingle();
  if (error) return enviarErrorBD(res, error);
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
    if (error) return enviarErrorBD(res, error);
    return res.json(data);
  }

  const { data, error } = await db.from('arqueos')
    .insert([{ fecha, fondo_inicial: fondo }]).select().single();
  if (error) return enviarErrorBD(res, error);
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

  if (error) return enviarErrorBD(res, error);
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
      .select('id, fecha, total, costo_total, utilidad, comision_pos, tipo_dte, metodo_pago, metodo_pago_final, pago_mixto, estado, encargo_id')
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
      // Venta de encargo: su plata ya entró como abonos, se suman abajo (sql/46).
      if (v.encargo_id) return;
      const desglose = pagosPorVenta[v.id];
      if (v.pago_mixto && desglose?.length) desglose.forEach(p => sumar(p.metodo, p.monto));
      else sumar(v.metodo_pago_final || v.metodo_pago, v.total);
    });

    /* Por medio de pago y caja son vistas de PLATA RECIBIDA: los abonos del
       período entran por su medio el día que llegaron. Ingresos y utilidad
       (arriba) siguen contando la venta del encargo al completarse. */
    const abonosPeriodo = await abonosEntreFechas(desde, hasta);
    abonosPeriodo.forEach(a => sumar(a.metodo_pago || 'Efectivo', a.monto));
    const totalAbonosPeriodo = abonosPeriodo.reduce((s, a) => s + num(a.monto), 0);
    const comisionesAbonosPeriodo = abonosPeriodo.reduce((s, a) => s + num(a.comision_pos), 0);
    const ventasEncargoPeriodo = ventas.filter(v => v.encargo_id);
    const ingresosEncargo = ventasEncargoPeriodo.reduce((s, v) => s + num(v.total), 0);
    const comisionesEncargo = ventasEncargoPeriodo.reduce((s, v) => s + num(v.comision_pos), 0);

    const ventasEfectivo = Object.entries(porMedio)
      .filter(([m]) => esEfectivo(m))
      .reduce((a, [, monto]) => a + monto, 0);

    // --- Gastos del período ---
    const { data: gastosRaw } = await db.from('compras')
      .select('id, fecha, clasificacion, costo_total, origen, metodo_pago, tiene_factura, iva_credito, afecta_saldo')
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
      .filter(g => esEfectivo(g.metodo_pago) && g.origen !== 'MERMA' && g.afecta_saldo !== false)
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
    // Con abonos en vez de la venta del encargo: es plata recibida (sql/46).
    // Los gastos con afecta_saldo=false (sql/49) ya estaban descontados: no vuelven a restar
    const gastosQueMuevenSaldo = gastos
      .filter(g => g.afecta_saldo !== false)
      .reduce((a, g) => a + num(g.costo_total), 0);
    const flujoLiquido = (ingresos - ingresosEncargo + totalAbonosPeriodo) + totalInyecciones - gastosQueMuevenSaldo
                       - (comisiones - comisionesEncargo + comisionesAbonosPeriodo);

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
      abonosEncargos: totalAbonosPeriodo,
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

    if (error) return enviarErrorBD(res, error);
    res.status(201).json(data);
  } catch (e) {
    enviarError(res, 500, e.message || 'No se pudo guardar el ajuste de IVA');
  }
});

app.delete('/api/finanzas/iva-ajuste/:id', auth(true), exigirPinAdmin, async (req, res) => {
  const { error } = await db.from('iva_ajustes').delete().eq('id', req.params.id);
  if (error) return enviarErrorBD(res, error);
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
      db.from('ventas').select('fecha, total, comision_pos, encargo_id')
        .gte('fecha', desde).lte('fecha', hasta).eq('estado', 'PAGADA'),
      db.from('compras').select('fecha, costo_total, metodo_pago, origen')
        .gte('fecha', desde).lte('fecha', hasta + 'T23:59:59')
    ]);

    /* Proyección de caja: ingresan los abonos el día que llegan, no la
       venta del encargo al completarse (sql/46). */
    const abonosHistorico = (await abonosEntreFechas(desde, hasta)).map(a => ({ fecha: a.dia, total: num(a.monto) }));
    const ventas = (ventasRaw || []).filter(v => !v.encargo_id).concat(abonosHistorico);
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
    return enviarErrorBD(res, error);
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
    return enviarErrorBD(res, error);
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
  if (error) return enviarErrorBD(res, error);
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
    .select('total, metodo_pago, metodo_pago_final, estado, encargo_id')
    .eq('caja_id', caja.id).eq('estado', 'PAGADA');

  let ventasEfectivo = 0;
  (ventasCaja || []).forEach(v => {
    if (v.encargo_id) return; // su plata entró como abonos (sql/46)
    const m = v.metodo_pago_final || v.metodo_pago;
    if (esEfectivo(m)) ventasEfectivo += num(v.total);
  });

  const { data: movs } = await db.from('caja_movimientos').select('tipo, monto').eq('caja_id', caja.id);
  let ingresos = 0, egresos = 0;
  (movs || []).forEach(m => { if (m.tipo === 'INGRESO') ingresos += num(m.monto); else egresos += num(m.monto); });

  // Abonos de encargos recibidos en efectivo durante este turno (sql/46).
  const { data: abonosTurno } = await db.from('encargo_abonos').select('monto, metodo_pago').eq('caja_id', caja.id);
  const abonosEfectivo = (abonosTurno || [])
    .filter(a => esEfectivo(a.metodo_pago)).reduce((s, a) => s + num(a.monto), 0);

  const esperado = num(caja.fondo_inicial) + ventasEfectivo + abonosEfectivo + ingresos - egresos;
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
    return enviarErrorBD(res, error);
  }

  res.json({ ...data, detalle: { fondo_inicial: num(caja.fondo_inicial), ventasEfectivo, abonosEfectivo, ingresos, egresos, esperado, contado, diferencia } });
});

app.get('/api/finanzas/saldos', auth(true), async (req, res) => {
  try {
    // Solo ventas efectivamente cobradas (PAGADA) cuentan como dinero real
    const { data: ventasRaw } = await db.from('ventas')
      .select('id, total, comision_pos, metodo_pago, metodo_pago_final, pago_mixto, estado, encargo_id')
      .eq('estado', 'PAGADA');
    // Las ventas de encargos se excluyen: su plata entra por los abonos,
    // más abajo (sql/46). Contarlas acá la sumaría dos veces.
    const ventas = (ventasRaw || []).filter(v => !v.encargo_id);
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
      .select('costo_total, origen, metodo_pago, afecta_saldo').limit(100000);
    const gastos = gastosRaw || [];
    let gastosEfectivo = 0, gastosBanco = 0;
    gastos.forEach(g => {
      if (g.origen === 'MERMA') return;
      // sql/49: gasto que ya estaba descontado (pago previo o reajuste)
      if (g.afecta_saldo === false) return;
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

    /* Abonos de encargos (sql/46): plata que entró el día que se recibió,
       por su propio canal. Los de tarjeta pagan su comisión a la máquina. */
    const { data: abonosRaw } = await db.from('encargo_abonos').select('monto, metodo_pago, comision_pos').limit(100000);
    let abonosEfectivo = 0, abonosBanco = 0, comisionesAbonos = 0;
    (abonosRaw || []).forEach(a => {
      if (esEfectivo(a.metodo_pago)) abonosEfectivo += num(a.monto);
      else abonosBanco += num(a.monto);
      comisionesAbonos += num(a.comision_pos);
    });

    const efectivo = fondoInicial + ventasEfectivo + abonosEfectivo + inyEfectivo + traspAEfectivo + ajusteEfectivo
                   - gastosEfectivo - traspDeEfectivo;
    const banco = ventasBanco + abonosBanco + inyBanco + traspABanco + ajusteBanco
                - gastosBanco - comisiones - comisionesAbonos - traspDeBanco;

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
        abonosEfectivo, abonosBanco,
        inyEfectivo, inyBanco,
        gastosEfectivo, gastosBanco,
        comisiones, comisionesAbonos,
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
   RECORDATORIO DEL F29 (sql/49)
   ------------------------------------------------------------
   El F29 de un mes se declara y paga hasta el día 20 del mes siguiente
   (contribuyente con facturación electrónica). Si el 20 cae sábado o
   domingo, corre al lunes. Los feriados NO se corren acá: la fecha es
   referencial y así se muestra.

   El POS no lee el SII: un período queda pendiente hasta que el dueño lo
   marca como presentado. Se revisan los períodos desde F29_PRIMER_PERIODO
   (el primero sin presentar cuando se construyó esto) para que un mes que
   se pasó sin declarar no desaparezca solo al cambiar de mes.
   ============================================================ */
const F29_PRIMER_PERIODO = '2026-08';
const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function vencimientoF29(periodo) {
  const [a, m] = periodo.split('-').map(Number);
  // Mes siguiente al período, día 20 (en UTC para no depender del huso)
  const d = new Date(Date.UTC(m === 12 ? a + 1 : a, m === 12 ? 0 : m, 20));
  const dow = d.getUTCDay();
  if (dow === 6) d.setUTCDate(22);
  if (dow === 0) d.setUTCDate(21);
  return d.toISOString().slice(0, 10);
}

function periodosF29Hasta(hoyISO) {
  const [a, m] = hoyISO.split('-').map(Number);
  const ultimo = m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
  const lista = [];
  let [pa, pm] = F29_PRIMER_PERIODO.split('-').map(Number);
  let guardia = 0;
  while (guardia++ < 36) {
    const p = `${pa}-${String(pm).padStart(2, '0')}`;
    if (p > ultimo) break;
    lista.push(p);
    pm++; if (pm === 13) { pm = 1; pa++; }
  }
  return lista;
}

function diasEntre(desdeISO, hastaISO) {
  return Math.round((Date.parse(hastaISO + 'T00:00:00Z') - Date.parse(desdeISO + 'T00:00:00Z')) / 86400000);
}

app.get('/api/finanzas/f29-estado', auth(true), async (req, res) => {
  try {
    const hoy = fechaHoyChile();
    const periodos = periodosF29Hasta(hoy);
    const { data: presentadosRaw, error } = await db.from('f29_presentaciones').select('*').in('periodo', periodos.length ? periodos : ['0000-00']);
    if (error) return enviarErrorBD(res, error);
    const presentados = new Set((presentadosRaw || []).map(p => p.periodo));

    const pendientes = periodos.filter(p => !presentados.has(p)).map(p => {
      const [a, m] = p.split('-').map(Number);
      const vence = vencimientoF29(p);
      const dias = diasEntre(hoy, vence);
      return {
        periodo: p,
        nombre: `${MESES_ES[m - 1]} ${a}`,
        vence,
        diasRestantes: dias,
        nivel: dias < 0 ? 'atrasado' : dias <= 2 ? 'urgente' : dias <= 7 ? 'pronto' : 'normal'
      };
    });

    res.json({ hoy, pendientes, presentados: presentadosRaw || [] });
  } catch (e) {
    enviarError(res, 500, e.message || 'No se pudo calcular el estado del F29');
  }
});

/* Marca un período como presentado. Si viene un monto y registrar_gasto,
   deja además el pago en Gastos (clasificación de Impuestos) — el dueño
   paga el F29 y se le olvida registrarlo. Si el período ya tenía un gasto
   vinculado, no crea otro. */
app.post('/api/finanzas/f29-presentado', auth(true), async (req, res) => {
  try {
    const periodo = String(req.body?.periodo || '').trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) return enviarError(res, 400, 'Período inválido (formato AAAA-MM)');
    const monto = Math.round(num(req.body?.monto_pagado));
    if (monto < 0) return enviarError(res, 400, 'El monto pagado no puede ser negativo');
    const notas = String(req.body?.notas || '').trim() || null;
    // Código 77 del F29: el crédito que pasa al mes siguiente (sql/51, semáforo de IVA)
    const remanente = req.body?.remanente_siguiente;
    if (remanente !== undefined && remanente !== null && remanente !== '' && !(num(remanente) >= 0)) {
      return enviarError(res, 400, 'El remanente no puede ser negativo');
    }

    const { data: previo } = await db.from('f29_presentaciones').select('*').eq('periodo', periodo).maybeSingle();
    let compraId = previo?.compra_id || null;

    if (req.body?.registrar_gasto && monto > 0 && !compraId) {
      const { data: clasif } = await db.from('compra_clasificaciones')
        .select('nombre').ilike('nombre', 'Impuestos%').eq('activo', true).limit(1);
      const clasificacion = clasif?.[0]?.nombre;
      if (!clasificacion) return enviarError(res, 400, 'No existe una clasificación de gastos que empiece con "Impuestos"');

      const [a, m] = periodo.split('-');
      const { datos, error: errVal } = await sanearCompra({
        clasificacion,
        costo_total: monto,
        proveedor: 'SII',
        metodo_pago: req.body?.metodo_pago || 'Transferencia',
        descripcion: `F29 período ${m}-${a}`
      });
      if (errVal) return enviarError(res, 400, errVal);
      const { data: compra, error: errCompra } = await db.from('compras').insert([datos]).select('id').single();
      if (errCompra) return enviarErrorBD(res, errCompra);
      compraId = compra.id;
    }

    const { data, error } = await db.from('f29_presentaciones').upsert([{
      periodo,
      presentado_en: new Date().toISOString(),
      monto_pagado: monto,
      compra_id: compraId,
      notas
    }]).select().single();
    if (error) return enviarErrorBD(res, error);
    if (remanente !== undefined && remanente !== null && remanente !== '') {
      const { error: errRem } = await db.from('iva_remanentes').upsert([{
        periodo, monto: Math.round(num(remanente)), fuente: 'F29 presentado', actualizado_en: new Date().toISOString()
      }]);
      if (errRem) console.error('[F29] no se pudo guardar el remanente:', errRem.message);
    }
    res.json(data);
  } catch (e) {
    enviarError(res, 500, e.message || 'No se pudo marcar el F29');
  }
});

// Desmarcar (se marcó por error). El gasto que se haya registrado se queda: se borra en Gastos.
app.delete('/api/finanzas/f29-presentado/:periodo', auth(true), async (req, res) => {
  const { error } = await db.from('f29_presentaciones').delete().eq('periodo', req.params.periodo);
  if (error) return enviarErrorBD(res, error);
  res.json({ ok: true });
});

/* ============================================================
   RCV DEL SII AUTOMÁTICO + SEMÁFORO DE IVA (sql/51)
   ------------------------------------------------------------
   Un robot entra al SII con el certificado digital del dueño y trae el
   Registro de Compras y Ventas del mes. SOLO LECTURA: nunca acepta,
   reclama ni declara nada.

   El certificado vive únicamente en variables de entorno de Vercel, que
   carga el dueño: SII_CERT_PFX_BASE64 (el .pfx en base64),
   SII_CERT_PASSWORD y SII_RUT (con guion). Nunca se escribe en la base,
   en el repo ni en un log.

   Cómo entra (el mismo camino que usa el navegador con certificado):
     1. POST herculesr.sii.cl/cgi_AUT2000/CAutInicio.cgi presentando el
        certificado (TLS mutuo) → cookie TOKEN.
     2. POST www4.sii.cl/consdcvinternetui/services/data/facadeService/<método>
        con el TOKEN: getResumen (totales por tipo de documento) y
        getDetalleCompraExport (las facturas, en el mismo formato del CSV
        que se descarga a mano).
   Es la API interna del portal, no una API pública documentada: si el SII
   la cambia, la sincronización falla, queda en sii_sync y en Salud, y el
   respaldo es subir el CSV del RCV a mano (usa el mismo lector).
   ============================================================ */
const https = require('https');
let forge = null;
try { forge = require('node-forge'); } catch (_) { /* sin forge se intenta con el .pfx directo */ }

const SII_NOMBRES_DOC = {
  29: 'Factura de inicio', 30: 'Factura', 32: 'Factura exenta', 33: 'Factura electrónica',
  34: 'Factura exenta electrónica', 35: 'Boleta', 38: 'Boleta exenta', 39: 'Boleta electrónica',
  41: 'Boleta exenta electrónica', 43: 'Liquidación factura', 45: 'Factura de compra',
  46: 'Factura de compra electrónica', 48: 'Comprobante de pago electrónico', 55: 'Nota de débito',
  56: 'Nota de débito electrónica', 60: 'Nota de crédito', 61: 'Nota de crédito electrónica',
  110: 'Factura de exportación', 914: 'Declaración de ingreso (DIN)'
};
// Las notas de crédito restan del débito (venta) o del crédito (compra)
const SII_DOC_RESTA = new Set([60, 61]);

function siiConfigurado() {
  return !!(process.env.SII_CERT_PFX_BASE64 && process.env.SII_CERT_PASSWORD && process.env.SII_RUT);
}

let siiCredencialesCache = null;
function siiCredencialesTls() {
  if (siiCredencialesCache) return siiCredencialesCache;
  const pfx = Buffer.from(String(process.env.SII_CERT_PFX_BASE64 || '').replace(/\s+/g, ''), 'base64');
  const passphrase = String(process.env.SII_CERT_PASSWORD || '');
  if (!pfx.length) throw new Error('Falta el certificado del SII (SII_CERT_PFX_BASE64)');

  /* Los .pfx que emiten las certificadoras chilenas suelen venir con
     cifrado antiguo (RC2/3DES) que OpenSSL 3 —el de Node actual— rechaza
     con "unsupported". node-forge lo abre en JavaScript puro y lo pasa a
     PEM, que TLS sí acepta. */
  if (forge) {
    let p12;
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfx.toString('binary')), false, passphrase);
    } catch (e) {
      throw new Error(/mac|password|invalid/i.test(e.message)
        ? 'La clave del certificado no coincide (SII_CERT_PASSWORD)'
        : 'No se pudo leer el certificado .pfx: ' + e.message);
    }
    const bolsa = (tipo) => (p12.getBags({ bagType: tipo })[tipo] || []);
    const llave = bolsa(forge.pki.oids.pkcs8ShroudedKeyBag)[0] || bolsa(forge.pki.oids.keyBag)[0];
    const certs = bolsa(forge.pki.oids.certBag).filter(b => b.cert);
    if (!llave || !certs.length) throw new Error('El .pfx no trae la llave privada o el certificado');
    // El certificado de la persona es el que NO es de autoridad certificadora
    const propio = certs.find(b => !(b.cert.getExtension('basicConstraints') || {}).cA) || certs[0];
    siiCredencialesCache = {
      tls: { key: forge.pki.privateKeyToPem(llave.key), cert: forge.pki.certificateToPem(propio.cert) },
      vence: propio.cert.validity.notAfter ? propio.cert.validity.notAfter.toISOString().slice(0, 10) : null
    };
  } else {
    siiCredencialesCache = { tls: { pfx, passphrase }, vence: null };
  }
  return siiCredencialesCache;
}

function siiHttp(url, { method = 'GET', headers = {}, body = null, tls = {}, timeoutMs = 25000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const reqSii = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: { 'User-Agent': 'Mozilla/5.0 (SevelinPOS RCV)', ...headers, ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}) },
      ...tls
    }, (resp) => {
      const trozos = [];
      resp.on('data', c => trozos.push(c));
      resp.on('end', () => resolve({ status: resp.statusCode, headers: resp.headers, body: Buffer.concat(trozos).toString('utf8') }));
    });
    reqSii.setTimeout(timeoutMs, () => reqSii.destroy(new Error(`El SII no respondió en ${Math.round(timeoutMs / 1000)} s`)));
    reqSii.on('error', reject);
    if (body) reqSii.write(body);
    reqSii.end();
  });
}

/* Sesión con el SII: el certificado (tls) + TODAS las cookies que va
   entregando. Primera prueba real (15-09-2026): mandando solo TOKEN, el
   login funcionó pero getResumen respondió HTTP 500 — el navegador reenvía
   el juego completo de cookies de la sesión, y eso hace el robot ahora. */
function siiGuardarCookies(sesion, headers) {
  for (const c of [].concat(headers['set-cookie'] || [])) {
    const par = String(c).split(';')[0];
    const i = par.indexOf('=');
    if (i <= 0) continue;
    const nombre = par.slice(0, i).trim();
    const valor = par.slice(i + 1).trim();
    if (!valor || valor === 'DEL') sesion.cookies.delete(nombre);
    else sesion.cookies.set(nombre, valor);
  }
}
function siiCookieHeader(sesion) {
  return [...sesion.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}
// Para el mensaje de error: lo que respondió el SII, sin HTML y corto
function siiResumenCuerpo(body) {
  return String(body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220);
}

async function siiAutenticar(tls) {
  const sesion = { tls, cookies: new Map(), token: null };
  const r = await siiHttp('https://herculesr.sii.cl/cgi_AUT2000/CAutInicio.cgi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'referencia=' + encodeURIComponent('https://palena.sii.cl/cgi_dte/UPL/DTEauth?1'),
    tls
  });
  siiGuardarCookies(sesion, r.headers);
  sesion.token = sesion.cookies.get('TOKEN') || null;
  if (!sesion.token) {
    throw new Error(r.status >= 400
      ? `El SII rechazó la conexión con el certificado (HTTP ${r.status})`
      : 'El SII no aceptó el certificado: revisa que esté vigente y asociado a tu RUT en el SII');
  }

  // Abre la aplicación del RCV como lo haría el navegador: ahí el SII entrega
  // las cookies propias de www4 que las consultas siguientes esperan.
  try {
    const app = await siiHttp('https://www4.sii.cl/consdcvinternetui/', {
      headers: { Cookie: siiCookieHeader(sesion), Accept: 'text/html' }, tls
    });
    siiGuardarCookies(sesion, app.headers);
  } catch (_) { /* si falla, se intenta igual con lo que hay */ }
  return sesion;
}

async function siiFacade(metodo, data, sesion) {
  const r = await siiHttp(`https://www4.sii.cl/consdcvinternetui/services/data/facadeService/${metodo}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json, text/plain, */*',
      Origin: 'https://www4.sii.cl',
      Referer: 'https://www4.sii.cl/consdcvinternetui/',
      Cookie: siiCookieHeader(sesion)
    },
    body: JSON.stringify({
      metaData: {
        namespace: `cl.sii.sdi.lob.diii.consdcv.data.api.interfaces.FacadeService/${metodo}`,
        conversationId: sesion.token,
        transactionId: crypto.randomUUID(),
        page: null
      },
      data
    }),
    tls: sesion.tls
  });
  siiGuardarCookies(sesion, r.headers);
  if (r.status !== 200) {
    const detalle = siiResumenCuerpo(r.body);
    throw new Error(`El SII respondió HTTP ${r.status} en ${metodo}${detalle ? ` — ${detalle}` : ''}`);
  }
  let json;
  try { json = JSON.parse(r.body); } catch (_) { throw new Error(`El SII no devolvió datos legibles en ${metodo} (¿sesión vencida?)`); }
  const estado = json?.respEstado;
  if (estado && Number(estado.codRespuesta) !== 0 && estado.codRespuesta !== undefined) {
    // "sin información" no es un error: el mes simplemente no tiene documentos
    if (/no\s+(existe|hay|se encontr)|sin\s+(datos|informaci)/i.test(estado.msgeRespuesta || '')) return { ...json, data: [] };
    throw new Error(`SII (${metodo}): ${estado.msgeRespuesta || 'código ' + estado.codRespuesta}`);
  }
  return json;
}

/* El resumen trae nombres de campo internos del SII (rsmnMntIVA, etc.).
   Se buscan por patrón y no por nombre exacto, para aguantar variaciones. */
function siiCampo(obj, patrones) {
  const claves = Object.keys(obj || {});
  for (const p of patrones) {
    const k = claves.find(c => p.test(c));
    if (k !== undefined) return obj[k];
  }
  return undefined;
}
function siiNumero(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const limpio = String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = Number(limpio);
  return Number.isFinite(n) ? n : 0;
}

function siiParsearResumen(json, periodo, operacion, estado) {
  const filas = Array.isArray(json?.data) ? json.data : [];
  return filas.map(f => {
    const tipo = Math.round(siiNumero(siiCampo(f, [/^rsmnTipoDocInteger$/i, /tipo_?doc/i])));
    return {
      periodo, operacion, estado,
      tipo_doc: tipo,
      nombre_doc: String(siiCampo(f, [/nombre.*tipo.*doc/i, /tipo.*doc.*nombre/i]) || SII_NOMBRES_DOC[tipo] || '').slice(0, 80) || null,
      total_docs: Math.round(siiNumero(siiCampo(f, [/tot_?doc/i, /cant/i]))),
      exento: siiNumero(siiCampo(f, [/mnt_?exe/i])),
      neto: siiNumero(siiCampo(f, [/mnt_?neto$/i, /mnt_?neto/i])),
      iva: siiNumero(siiCampo(f, [/^rsmnMntIVA$/i, /mnt_?iva(_?rec)?$/i])),
      iva_no_recuperable: siiNumero(siiCampo(f, [/iva_?no_?rec/i])),
      total: siiNumero(siiCampo(f, [/mnt_?total/i])),
      actualizado_en: new Date().toISOString()
    };
  }).filter(f => f.tipo_doc > 0);
}

/* Lector del CSV del RCV (el que se descarga en el SII, separado por ";").
   Lo usan el robot (getDetalleCompraExport devuelve estas mismas líneas) y
   el botón "Subir CSV". Los encabezados se normalizan (sin tildes, sin
   espacios, minúsculas) para no depender de mayúsculas ni acentos. */
function siiParsearCsvRcv(texto, periodo, operacion, estado, fuente) {
  const lineas = String(texto || '').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (lineas.length < 2) return [];
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cab = lineas[0].split(';').map(norm);
  const col = (pred) => cab.findIndex(pred);
  const iTipo = col(h => h === 'tipodoc');
  const iRut = col(h => h.startsWith('rut'));
  const iRazon = col(h => h.startsWith('razonsocial'));
  const iFolio = col(h => h === 'folio');
  const iFecha = col(h => h === 'fechadocto');
  const iExe = col(h => h === 'montoexento');
  const iNeto = col(h => h === 'montoneto');
  const iIva = col(h => h === 'montoivarecuperable' || h === 'montoiva');
  const iIvaNoRec = col(h => h === 'montoivanorecuperable');
  const iTotal = col(h => h === 'montototal');
  if (iTipo < 0 || iRut < 0 || iFolio < 0) {
    throw new Error('El archivo no tiene el formato del RCV del SII (faltan las columnas Tipo Doc, RUT o Folio)');
  }

  const docs = [];
  for (const linea of lineas.slice(1)) {
    const c = linea.split(';');
    const tipo = Math.round(siiNumero(c[iTipo]));
    const folio = Math.round(siiNumero(c[iFolio]));
    const rut = String(c[iRut] || '').trim().toUpperCase();
    if (!tipo || !folio || !rut) continue;
    let fecha = null;
    const mf = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(c[iFecha] || '').trim());
    if (mf) fecha = `${mf[3]}-${mf[2]}-${mf[1]}`;
    else if (/^\d{4}-\d{2}-\d{2}/.test(String(c[iFecha] || ''))) fecha = String(c[iFecha]).slice(0, 10);
    docs.push({
      periodo, operacion, estado, tipo_doc: tipo, rut,
      razon_social: iRazon >= 0 ? String(c[iRazon] || '').trim().slice(0, 150) || null : null,
      folio, fecha_doc: fecha,
      exento: iExe >= 0 ? siiNumero(c[iExe]) : 0,
      neto: iNeto >= 0 ? siiNumero(c[iNeto]) : 0,
      iva: iIva >= 0 ? siiNumero(c[iIva]) : 0,
      iva_no_recuperable: iIvaNoRec >= 0 ? siiNumero(c[iIvaNoRec]) : 0,
      total: iTotal >= 0 ? siiNumero(c[iTotal]) : 0,
      fuente,
      actualizado_en: new Date().toISOString()
    });
  }
  return docs;
}

async function siiGuardarDocumentos(docs) {
  let guardados = 0;
  for (let i = 0; i < docs.length; i += 200) {
    const trozo = docs.slice(i, i + 200);
    const { error } = await consultarConReintento(() =>
      db.from('sii_rcv_documentos').upsert(trozo, { onConflict: 'operacion,tipo_doc,rut,folio' }));
    if (error) throw new Error('No se pudieron guardar los documentos del RCV: ' + error.message);
    guardados += trozo.length;
  }
  return guardados;
}

// 'AAAAMM' del mes actual y del anterior (hora de Chile)
function periodosRcvActuales() {
  const [a, m] = fechaHoyChile().split('-').map(Number);
  const actual = `${a}${String(m).padStart(2, '0')}`;
  const anterior = m === 1 ? `${a - 1}12` : `${a}${String(m - 1).padStart(2, '0')}`;
  return [anterior, actual];
}

async function sincronizarRcv(origen) {
  const periodos = periodosRcvActuales();
  let documentos = 0;
  try {
    if (!siiConfigurado()) throw new Error('Falta configurar el certificado del SII en Vercel (SII_CERT_PFX_BASE64, SII_CERT_PASSWORD, SII_RUT)');
    const { tls } = siiCredencialesTls();
    const sesion = await siiAutenticar(tls);
    const [rut, dv] = String(process.env.SII_RUT).replace(/\./g, '').trim().split('-');
    if (!rut || !dv) throw new Error('SII_RUT debe venir con guion, por ejemplo 12345678-9');

    /* Una consulta a la vez (con varias en paralelo sobre la misma sesión el
       SII puede responder 500). Solo las de REGISTRO son indispensables: si
       PENDIENTE / NO_INCLUIR / RECLAMADO fallan, se sigue y se avisa. */
    const avisos = [];
    const indispensable = (operacion, estado) => estado === 'REGISTRO';

    for (const periodo of periodos) {
      const base = { rutEmisor: rut, dvEmisor: dv.toUpperCase(), ptributario: periodo };
      const consultas = [
        { operacion: 'COMPRA', estado: 'REGISTRO' },
        { operacion: 'VENTA', estado: 'REGISTRO' },
        { operacion: 'COMPRA', estado: 'PENDIENTE' },
        { operacion: 'COMPRA', estado: 'NO_INCLUIR' },
        { operacion: 'COMPRA', estado: 'RECLAMADO' }
      ];

      // Resumen: se reemplaza completo por período/operación/estado
      for (const q of consultas) {
        let filas;
        try {
          filas = siiParsearResumen(
            await siiFacade('getResumen', { ...base, estadoContab: q.estado, operacion: q.operacion }, sesion),
            periodo, q.operacion, q.estado);
        } catch (e) {
          if (indispensable(q.operacion, q.estado)) throw e;
          avisos.push(`${periodo} ${q.operacion} ${q.estado}: ${e.message}`);
          continue;
        }
        await db.from('sii_rcv_resumen').delete().eq('periodo', periodo).eq('operacion', q.operacion).eq('estado', q.estado);
        if (filas.length) {
          const { error } = await db.from('sii_rcv_resumen').insert(filas);
          if (error) throw new Error('No se pudo guardar el resumen del RCV: ' + error.message);
        }
      }

      // Detalle de compras (las facturas), solo lo que suma o puede sumar crédito
      for (const estado of ['REGISTRO', 'PENDIENTE']) {
        try {
          const json = await siiFacade('getDetalleCompraExport',
            { ...base, operacion: 'COMPRA', estadoContab: estado, codTipoDoc: '0' }, sesion);
          const texto = Array.isArray(json?.data) ? json.data.join('\n') : String(json?.data || '');
          documentos += await siiGuardarDocumentos(siiParsearCsvRcv(texto, periodo, 'COMPRA', estado, 'robot'));
        } catch (e) {
          // El detalle es un extra: el semáforo sale del resumen
          avisos.push(`${periodo} detalle ${estado}: ${e.message}`);
        }
      }
    }

    const mensajeOk = avisos.length ? enmascararSecretos(`Con avisos: ${avisos.join(' | ')}`).slice(0, 500) : null;
    await db.from('sii_sync').insert([{ origen, ok: true, periodos: periodos.join(','), documentos, mensaje: mensajeOk }]);
    return { ok: true, periodos, documentos, avisos };
  } catch (err) {
    const mensaje = enmascararSecretos(err.message || String(err)).slice(0, 500);
    await db.from('sii_sync').insert([{ origen, ok: false, periodos: periodos.join(','), documentos, mensaje }]);
    registrarErrorSalud({ origen: 'POS', ruta: 'SII RCV', metodo: origen, mensaje: `Sincronización del RCV: ${mensaje}` });
    return { ok: false, periodos, documentos, mensaje };
  }
}

// Programado en vercel.json. Vercel manda "Authorization: Bearer <CRON_SECRET>".
app.get('/api/cron/sii-rcv', async (req, res) => {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.authorization !== `Bearer ${secreto}`) return enviarError(res, 401, 'No autorizado');
  if (!siiConfigurado()) return res.json({ ok: false, omitido: 'certificado no configurado' });
  res.json(await sincronizarRcv('robot'));
});

// Botón "Sincronizar ahora". Con 2 minutos de espera entre intentos, para no martillar al SII.
app.post('/api/finanzas/sii/sincronizar', auth(true), async (req, res) => {
  const { data: ultima } = await db.from('sii_sync').select('creado_en').order('creado_en', { ascending: false }).limit(1).maybeSingle();
  if (ultima && Date.now() - Date.parse(ultima.creado_en) < 2 * 60 * 1000) {
    return enviarError(res, 429, 'Se sincronizó hace menos de 2 minutos. Espera un poco antes de volver a intentar.');
  }
  const r = await sincronizarRcv('manual');
  if (!r.ok) return enviarError(res, 502, r.mensaje || 'No se pudo sincronizar con el SII');
  res.json(r);
});

// Respaldo sin certificado: subir el CSV del RCV descargado desde el SII.
app.post('/api/finanzas/sii/rcv-csv', auth(true), async (req, res) => {
  const periodo = String(req.body?.periodo || '').replace('-', '');
  const estado = ['REGISTRO', 'PENDIENTE'].includes(req.body?.estado) ? req.body.estado : 'REGISTRO';
  if (!/^\d{6}$/.test(periodo)) return enviarError(res, 400, 'Indica el período del archivo (AAAA-MM)');
  const texto = String(req.body?.csv || '');
  if (texto.length > 3 * 1024 * 1024) return enviarError(res, 413, 'El archivo es demasiado grande');
  try {
    const docs = siiParsearCsvRcv(texto, periodo, 'COMPRA', estado, 'csv');
    if (!docs.length) return enviarError(res, 400, 'El archivo no trae documentos');
    const n = await siiGuardarDocumentos(docs);
    await db.from('sii_sync').insert([{ origen: 'csv', ok: true, periodos: periodo, documentos: n, mensaje: null }]);
    res.json({ ok: true, documentos: n });
  } catch (err) {
    enviarError(res, 400, err.message || 'No se pudo leer el archivo');
  }
});

// Remanente del mes anterior (código 77 del F29), editable a mano
app.put('/api/finanzas/iva-remanente/:periodo', auth(true), async (req, res) => {
  const periodo = String(req.params.periodo || '');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) return enviarError(res, 400, 'Período inválido (AAAA-MM)');
  const monto = Math.round(num(req.body?.monto));
  if (!(monto >= 0)) return enviarError(res, 400, 'El remanente no puede ser negativo');
  const { data, error } = await db.from('iva_remanentes')
    .upsert([{ periodo, monto, fuente: String(req.body?.fuente || 'editado a mano').slice(0, 40), actualizado_en: new Date().toISOString() }])
    .select().single();
  if (error) return enviarErrorBD(res, error);
  res.json(data);
});

/* El semáforo: ¿cuánto crédito me queda este mes antes de empezar a pagar IVA?
   resultado = crédito del mes + remanente del mes anterior − débito del mes
   Si el SII todavía no tiene las ventas del mes, el débito se estima con las
   boletas registradas en el POS (y se dice). */
async function calcularIvaMes(periodoAAAAMM) {
  const periodo = /^\d{6}$/.test(periodoAAAAMM || '') ? periodoAAAAMM : periodosRcvActuales()[1];
  const a = Number(periodo.slice(0, 4)), m = Number(periodo.slice(4));
  const anterior = m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
  const signo = t => (SII_DOC_RESTA.has(Number(t)) ? -1 : 1);

  const [{ data: resumen }, { data: docs }, { data: rem }, { data: ultimaSync }] = await Promise.all([
    db.from('sii_rcv_resumen').select('*').eq('periodo', periodo),
    db.from('sii_rcv_documentos').select('operacion, estado, tipo_doc, iva, rut, razon_social, folio, fecha_doc, total').eq('periodo', periodo).eq('operacion', 'COMPRA'),
    db.from('iva_remanentes').select('*').eq('periodo', anterior).maybeSingle(),
    db.from('sii_sync').select('*').order('creado_en', { ascending: false }).limit(1).maybeSingle()
  ]);
  const filas = resumen || [];
  const documentos = docs || [];
  const sumaIva = lista => Math.round(lista.reduce((s, f) => s + signo(f.tipo_doc) * num(f.iva), 0));

  // Crédito: resumen del SII; si no hay (solo se subió CSV), desde los documentos
  const compraReg = filas.filter(f => f.operacion === 'COMPRA' && f.estado === 'REGISTRO');
  const docsReg = documentos.filter(d => d.estado === 'REGISTRO');
  const credito = compraReg.length ? sumaIva(compraReg) : sumaIva(docsReg);
  const fuenteCredito = compraReg.length ? 'sii' : (docsReg.length ? 'csv' : 'sin_datos');

  const compraPend = filas.filter(f => f.operacion === 'COMPRA' && f.estado === 'PENDIENTE');
  const docsPend = documentos.filter(d => d.estado === 'PENDIENTE');
  const pendientesIva = compraPend.length ? sumaIva(compraPend) : sumaIva(docsPend);
  const pendientesCantidad = compraPend.length ? compraPend.reduce((s, f) => s + (f.total_docs || 0), 0) : docsPend.length;

  // Débito: resumen de ventas del SII; si no hay, estimado con las boletas del POS
  const ventaReg = filas.filter(f => f.operacion === 'VENTA' && f.estado === 'REGISTRO');
  let debito, fuenteDebito;
  if (ventaReg.length) {
    debito = sumaIva(ventaReg);
    fuenteDebito = 'sii';
  } else {
    const desde = `${a}-${String(m).padStart(2, '0')}-01`;
    const hasta = `${a}-${String(m).padStart(2, '0')}-31`;
    const { data: ventasPos } = await db.from('ventas').select('total, tipo_dte')
      .gte('fecha', desde).lte('fecha', hasta).eq('estado', 'PAGADA').in('tipo_dte', ['BOLETA', 'FACTURA']);
    debito = Math.round((ventasPos || []).reduce((s, v) => s + num(v.total) - num(v.total) / 1.19, 0));
    fuenteDebito = 'pos';
  }

  const remanente = rem ? num(rem.monto) : null;
  const resultado = credito + (remanente || 0) - debito;
  /* Amarillo = al ritmo de boletas de este mes, el crédito se acaba ANTES de
     fin de mes. Es la señal que sirve para decidir (comprar con factura ya),
     no un monto fijo: $50.000 de crédito es mucho un día 28 y nada un día 5. */
  let nivel = 'verde';
  let diasCobertura = null;
  const hoy = fechaHoyChile();
  const esMesActual = periodo === hoy.slice(0, 7).replace('-', '');
  if (resultado < 0) {
    nivel = 'rojo';
  } else if (esMesActual) {
    const diaHoy = Number(hoy.slice(8, 10));
    const diasMes = new Date(a, m, 0).getDate();
    const ritmoDiario = debito / Math.max(1, diaHoy);
    if (ritmoDiario > 0) {
      diasCobertura = Math.floor(resultado / ritmoDiario);
      if (diasCobertura < diasMes - diaHoy) nivel = 'amarillo';
    }
  }

  let vence = null;
  if (siiConfigurado()) { try { vence = siiCredencialesTls().vence; } catch (_) { vence = null; } }

  return {
    periodo,
    credito, fuenteCredito,
    debito, fuenteDebito,
    remanenteAnterior: remanente, remanentePeriodo: anterior, remanenteFuente: rem?.fuente || null,
    resultado,
    nivel,
    diasCobertura,
    ivaAPagarEstimado: resultado < 0 ? -resultado : 0,
    // Cuánto más se puede vender con boleta antes de empezar a pagar IVA (precio con IVA)
    ventasConBoletaHastaPagar: resultado > 0 ? Math.floor((resultado / 0.19) * 1.19) : 0,
    pendientes: { cantidad: pendientesCantidad, iva: pendientesIva },
    porTipo: filas.filter(f => f.estado === 'REGISTRO').map(f => ({ operacion: f.operacion, tipo_doc: f.tipo_doc, nombre: f.nombre_doc || SII_NOMBRES_DOC[f.tipo_doc] || String(f.tipo_doc), total_docs: f.total_docs, iva: num(f.iva) })),
    facturasRecientes: documentos.filter(d => d.estado === 'REGISTRO' || d.estado === 'PENDIENTE')
      .sort((x, y) => String(y.fecha_doc || '').localeCompare(String(x.fecha_doc || ''))).slice(0, 15),
    configurado: siiConfigurado(),
    certificadoVence: vence,
    ultimaSync: ultimaSync || null
  };
}

app.get('/api/finanzas/sii/iva', auth(true), async (req, res) => {
  try {
    res.json(await calcularIvaMes(String(req.query.periodo || '').replace('-', '')));
  } catch (err) {
    enviarError(res, 500, err.message || 'No se pudo calcular el IVA del mes');
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

  if (error) return enviarErrorBD(res, error);
  res.status(201).json(data);
});

/* Historial de ajustes manuales (para el pop-up de consulta) */
app.get('/api/finanzas/ajustes-saldo', auth(true), async (req, res) => {
  let q = db.from('ajustes_saldo').select('*').order('creado_en', { ascending: false });
  const canal = String(req.query?.canal || '').trim().toUpperCase();
  if (canal === 'EFECTIVO' || canal === 'BANCO') q = q.eq('canal', canal);

  const { data, error } = await q.limit(limiteDe(req));
  if (error) return enviarErrorBD(res, error);
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
  if (error) return enviarErrorBD(res, error);
  res.status(201).json(data);
});

/* Historial de traspasos (para poder revisarlos y eliminarlos) */
app.get('/api/finanzas/traspasos', auth(true), async (req, res) => {
  const { data, error } = await db.from('traspasos')
    .select('*').order('fecha', { ascending: false }).order('id', { ascending: false })
    .limit(limiteDe(req));
  if (error) return enviarErrorBD(res, error);
  res.json(data || []);
});

app.delete('/api/finanzas/traspaso/:id', auth(true), exigirPinAdmin, async (req, res) => {
  const { error } = await db.from('traspasos').delete().eq('id', req.params.id);
  if (error) return enviarErrorBD(res, error);
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
  if (error) return enviarErrorBD(res, error);
  res.json(data);
});

app.get('/api/compras/clasificaciones', auth(), async (req, res) => {
  const { incluir_inactivas } = req.query;

  let q = db.from('compra_clasificaciones').select('*').order('nombre');
  if (incluir_inactivas !== 'true') q = q.eq('activo', true);

  const { data, error } = await q;
  if (error) return enviarErrorBD(res, error);

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
    if (errCascada) return enviarErrorBD(res, errCascada);
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
    if (error) return enviarErrorBD(res, error);
    return res.json({
      ok: true, desactivada: true, usos: count,
      mensaje: `Tiene ${count} gasto(s) asociados: se desactivó en vez de eliminarse, para no alterar el historial.`
    });
  }

  const { error } = await db.from('compra_clasificaciones').delete().eq('id', req.params.id);
  if (error) return enviarErrorBD(res, error);
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
    return enviarErrorBD(res, error);
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

/* ---------- QR de retiro seguro (sql/47) ----------
   No siempre quien trae el equipo es quien lo retira. Cada OT tiene un
   código aleatorio; su QR le llega al dueño del equipo y él decide a quién
   reenviárselo. Al entregar se exige el QR vigente o el carnet del titular
   con el RUT registrado. */
function nuevoTokenRetiro() {
  return crypto.randomBytes(16).toString('hex');
}

function urlRetiroOT(token) {
  return `${URL_TIENDA_PUBLICA.replace(/\/+$/, '')}/retiro/${token}`;
}

// El QR trae la URL completa; también se acepta el código suelto tipeado.
function extraerTokenRetiro(texto) {
  const m = String(texto || '').match(/([0-9a-f]{32})/i);
  return m ? m[1].toLowerCase() : null;
}

// "12.345.678-9" y "123456789" son el mismo RUT.
function normalizarRut(rut) {
  return String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase().replace(/^0+/, '');
}

/* Pide a la tienda que mande el correo con el QR (el POS no tiene Resend ni
   la plantilla). La URL se deriva de TIENDA_NOTIFICAR_ENTREGA_URL, mismo
   patrón que pos-interno.ts en la tienda: una variable de entorno nueva que
   alguien olvide configurar fallaría en silencio. Nunca lanza. */
async function enviarCorreoQrRetiro(ot) {
  if (!ot?.cliente_correo) return { enviado: false, motivo: 'La orden no tiene correo del cliente' };
  if (!ot.token_retiro) return { enviado: false, motivo: 'La orden no tiene código de retiro' };
  const url = String(TIENDA_NOTIFICAR_ENTREGA_URL || '').replace(/notificar-entrega\/?$/, 'notificar-qr-retiro');
  if (!url || url === TIENDA_NOTIFICAR_ENTREGA_URL || !SYNC_SECRET) {
    return { enviado: false, motivo: 'El envío de correos desde el POS no está configurado' };
  }
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sync-secret': SYNC_SECRET },
      body: JSON.stringify({
        correo: ot.cliente_correo,
        nombre: ot.cliente_nombre,
        numero_ot: ot.numero_ot,
        dispositivo: [ot.dispositivo_categoria, ot.dispositivo_modelo].filter(Boolean).join(' '),
        token: ot.token_retiro,
      }),
    });
    const cuerpo = await resp.json().catch(() => ({}));
    if (!resp.ok || !cuerpo.enviado) {
      const motivo = !resp.ok ? (cuerpo.error || `La tienda respondió ${resp.status}`) : 'El proveedor de correo no confirmó el envío';
      await registrarErrorSalud({ ruta: 'correo QR de retiro', mensaje: `${ot.numero_ot}: ${motivo}` });
      return { enviado: false, motivo };
    }
    return { enviado: true, motivo: null };
  } catch (err) {
    console.error('[OT] no se pudo pedir el correo del QR:', err.message);
    await registrarErrorSalud({ ruta: 'correo QR de retiro', mensaje: `${ot.numero_ot}: no se pudo contactar a la tienda (${err.message})` });
    return { enviado: false, motivo: 'No se pudo contactar a la tienda para enviar el correo' };
  }
}

app.post('/api/ot', auth(), async (req, res) => {
  const { datos, error: errValidacion } = sanearOT(req.body);
  if (errValidacion) return enviarError(res, 400, errValidacion);

  // numero_ot lo asigna el trigger de la base de datos (OT-000001, OT-000002…)
  const { data, error } = await db.from('ordenes_trabajo')
    .insert([{
      ...datos,
      estado: 'PENDIENTE',
      token_retiro: nuevoTokenRetiro(),
      token_retiro_generado_en: new Date().toISOString()
    }])
    .select()
    .single();

  if (error) return enviarErrorBD(res, error);

  const correoQr = await enviarCorreoQrRetiro(data);
  res.status(201).json({ ...data, url_retiro: urlRetiroOT(data.token_retiro), correo_qr: correoQr });
});

app.put('/api/ot/:id', auth(), async (req, res) => {
  const { datos, error: errValidacion } = sanearOT(req.body);
  if (errValidacion) return enviarError(res, 400, errValidacion);

  const { data, error } = await db.from('ordenes_trabajo').update(datos).eq('id', req.params.id).select().single();
  if (error) return enviarErrorBD(res, error);
  res.json(data);
});

/* Genera un QR nuevo (se perdió, o se reenvió a quien no correspondía). El
   anterior deja de servir en el mismo instante. También sirve para las OT
   creadas antes de que existiera el QR. */
app.post('/api/ot/:id/qr-retiro', auth(), async (req, res) => {
  const { data: ot, error: errOT } = await db.from('ordenes_trabajo').select('*').eq('id', req.params.id).single();
  if (errOT) return enviarError(res, 404, 'Orden de trabajo no encontrada');
  if (ot.estado === 'ENTREGADO') return enviarError(res, 400, 'Esta orden ya fue entregada');

  const { data, error } = await db.from('ordenes_trabajo').update({
    token_retiro: nuevoTokenRetiro(),
    token_retiro_generado_en: new Date().toISOString(),
    token_retiro_usado_en: null
  }).eq('id', ot.id).select().single();
  if (error) return enviarErrorBD(res, error);

  const correoQr = req.body?.enviar_correo === false ? null : await enviarCorreoQrRetiro(data);
  res.json({ ...data, url_retiro: urlRetiroOT(data.token_retiro), correo_qr: correoQr });
});

// Reenvía por correo el QR vigente, sin cambiarlo.
app.post('/api/ot/:id/enviar-qr', auth(), async (req, res) => {
  const { data: ot, error } = await db.from('ordenes_trabajo').select('*').eq('id', req.params.id).single();
  if (error) return enviarError(res, 404, 'Orden de trabajo no encontrada');
  if (ot.estado === 'ENTREGADO') return enviarError(res, 400, 'Esta orden ya fue entregada');
  const correoQr = await enviarCorreoQrRetiro(ot);
  res.json({ ok: true, url_retiro: ot.token_retiro ? urlRetiroOT(ot.token_retiro) : null, correo_qr: correoQr });
});

// El POS escanea un QR: ¿de qué orden es? Solo sirve el código vigente.
app.get('/api/ot/por-qr/:codigo', auth(), async (req, res) => {
  const token = extraerTokenRetiro(req.params.codigo);
  if (!token) return enviarError(res, 400, 'Ese código no es un QR de retiro de Sevelin');
  const { data: ot } = await db.from('ordenes_trabajo').select('*').eq('token_retiro', token).maybeSingle();
  if (!ot) return enviarError(res, 404, 'Este QR no corresponde a ninguna orden vigente (puede haber sido reemplazado por uno nuevo)');
  if (ot.estado === 'ENTREGADO' || ot.token_retiro_usado_en) return enviarError(res, 400, `Este QR ya se usó: ${ot.numero_ot} fue entregada`);
  res.json(ot);
});

/* Para la página pública /retiro/<código> de la tienda. Devuelve lo mínimo
   para que quien tiene el link sepa qué va a retirar: nada de RUT,
   teléfono, correo ni PIN del equipo. */
app.get('/api/interno/retiro/:token', authSync, async (req, res) => {
  const token = extraerTokenRetiro(req.params.token);
  if (!token) return enviarError(res, 404, 'No encontrado');
  const { data: ot } = await db.from('ordenes_trabajo')
    .select('numero_ot, estado, cliente_nombre, dispositivo_categoria, dispositivo_modelo, token_retiro_usado_en')
    .eq('token_retiro', token).maybeSingle();
  if (!ot) return enviarError(res, 404, 'No encontrado');
  res.json({
    numero_ot: ot.numero_ot,
    entregado: ot.estado === 'ENTREGADO' || !!ot.token_retiro_usado_en,
    nombre: String(ot.cliente_nombre || '').trim().split(/\s+/)[0] || null,
    dispositivo: [ot.dispositivo_categoria, ot.dispositivo_modelo].filter(Boolean).join(' ') || null,
  });
});

/* Check-Out: entrega del equipo, SOLO con verificación (sql/47) */
app.post('/api/ot/:id/entrega', auth(), async (req, res) => {
  const { data: ot, error: errOT } = await db.from('ordenes_trabajo').select('*').eq('id', req.params.id).single();
  if (errOT) return enviarError(res, 404, 'Orden de trabajo no encontrada');
  if (ot.estado === 'ENTREGADO') return enviarError(res, 400, 'Esta orden ya fue entregada');

  const retiraNombre = String(req.body?.retira_nombre || '').trim();
  const retiraRut = String(req.body?.retira_rut || '').trim();
  if (!retiraNombre || !normalizarRut(retiraRut)) {
    return enviarError(res, 400, 'Registra el nombre y el RUT de quien retira el equipo');
  }

  /* Dos pruebas posibles, decididas por el dueño: el QR vigente de ESTA
     orden, o el carnet del titular con el mismo RUT registrado. Sin RUT
     registrado no hay contra qué comparar el carnet: solo el QR. */
  const verificacion = String(req.body?.verificacion || '').toUpperCase();
  if (verificacion === 'QR') {
    const token = extraerTokenRetiro(req.body?.codigo_retiro);
    if (!token || !ot.token_retiro || token !== ot.token_retiro) {
      return enviarError(res, 400, 'El QR no corresponde a esta orden, o fue reemplazado por uno nuevo');
    }
    if (ot.token_retiro_usado_en) return enviarError(res, 400, 'Este QR ya se usó');
  } else if (verificacion === 'CARNET') {
    if (!normalizarRut(ot.cliente_rut)) {
      return enviarError(res, 400, 'Esta orden no tiene RUT del titular registrado: solo se puede entregar con el QR. Si se perdió, genera uno nuevo.');
    }
    if (normalizarRut(retiraRut) !== normalizarRut(ot.cliente_rut)) {
      return enviarError(res, 400, 'El RUT del carnet no coincide con el del titular registrado en la orden');
    }
  } else {
    return enviarError(res, 400, 'Verifica a quien retira: escanea su QR o revisa el carnet del titular');
  }

  const firma = String(req.body?.retira_firma_base64 || '');
  if (firma.length > 400000) return enviarError(res, 413, 'La firma es demasiado pesada');

  // Módulo Garantías (ver sql/31-garantias.sql): se fija recién acá, al
  // entregar, porque es el punto de partida real de la garantía del
  // servicio. Default 6 e inválido/negativo también caen a 6.
  const mesesGarantiaCrudo = num(req.body?.meses_garantia);
  const mesesGarantia = mesesGarantiaCrudo >= 0 ? Math.round(mesesGarantiaCrudo) : 6;

  // .eq('estado', 'PENDIENTE'): dos entregas simultáneas de la misma orden
  // no pueden pasar las dos.
  const ahora = new Date().toISOString();
  const { data: filas, error } = await db.from('ordenes_trabajo')
    .update({
      estado: 'ENTREGADO',
      fecha_entrega: ahora,
      retira_nombre: retiraNombre,
      retira_rut: retiraRut,
      retira_firma_base64: firma || null,
      meses_garantia: mesesGarantia,
      retiro_verificacion: verificacion,
      token_retiro_usado_en: ahora
    })
    .eq('id', req.params.id)
    .eq('estado', 'PENDIENTE')
    .select();

  if (error) return enviarErrorBD(res, error);
  const data = (filas || [])[0];
  if (!data) return enviarError(res, 409, 'Esta orden ya fue entregada');

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
  if (error) return enviarErrorBD(res, error);
  res.json({ ok: true });
});

/* ============================================================
   MÓDULO GARANTÍAS
   ------------------------------------------------------------
   Buscar ventas de productos y órdenes de trabajo entregadas para
   revisar el estado de su garantía. meses_garantia queda como snapshot
   en cada venta_item (al vender) o se fija al entregar la OT — ver
   sql/31-garantias.sql — así el cálculo acá nunca depende de si el
   catálogo cambió después. vence_el/estado_garantia se calculan siempre
   en el servidor (nunca en el navegador), con fechaHoyChile()/
   sumarMeses() ya usados en otras partes del sistema.

   PERMISOS — admin Y trabajador (cambio del 07-09-2026, v56)
   ------------------------------------------------------------
   Todo este módulo era `auth(true)` (solo admin), pero el botón del
   sidebar y la sección NUNCA tuvieron `admin-only`: un trabajador veía
   la pantalla y recibía errores en cada consulta. Se abrió a
   `auth()` porque es quien está en el mostrador cuando alguien llega
   con un equipo malo, y quien manda el aviso de garantía por vencer.

   Es seguro: **ninguna respuesta de este módulo trae costo, precio ni
   utilidad.** Solo nombre del producto, SKU, número de serie, fechas,
   meses de garantía y el contacto del cliente. Si alguna vez se le
   agrega una cifra de plata a estos endpoints, hay que volver a
   evaluar el permiso — no darlo por hecho porque "ya estaba abierto".
   ============================================================ */
function calcularEstadoGarantia(fechaInicioISO, mesesGarantia) {
  const fecha = String(fechaInicioISO || '').slice(0, 10);
  if (!fecha) return { vence_el: null, estado_garantia: null };
  const venceEl = sumarMeses(fecha, Number(mesesGarantia) || 0);
  return { vence_el: venceEl, estado_garantia: venceEl >= fechaHoyChile() ? 'VIGENTE' : 'VENCIDA' };
}

app.get('/api/garantias/productos', auth(), async (req, res) => {
  const q = String(req.query.q || '').trim();
  const filtroEstado = String(req.query.estado || '').toUpperCase(); // VIGENTE | VENCIDA | ''

  // Mismo patrón de 2 pasos que ya usa GET /api/ventas?producto= (busca
  // primero los ids que calzan, filtra después) — acá se suma la
  // búsqueda directa por número de orden / cliente de la venta.
  let idsVenta = null;
  if (q) {
    const patron = patronIlike(q);
    // numero_orden es INTEGER (no texto): ilike no aplica sobre ese tipo.
    // Si lo escrito es un número entero se compara exacto; el texto
    // libre solo puede calzar contra `cliente`.
    const filtrosVenta = [`cliente.ilike.${patron}`];
    const numeroBuscado = Number(q);
    if (Number.isInteger(numeroBuscado) && numeroBuscado > 0) {
      filtrosVenta.push(`numero_orden.eq.${numeroBuscado}`);
    }
    const { data: ventasDirectas, error: errVD } = await db.from('ventas')
      .select('id').or(filtrosVenta.join(',')).limit(500);
    if (errVD) return enviarErrorBD(res, errVD);

    const { data: items, error: errItems } = await db.from('venta_items')
      .select('venta_id').eq('es_servicio', false)
      .or(`nombre.ilike.${patron},sku.ilike.${patron},serial_number.ilike.${patron}`).limit(2000);
    if (errItems) return enviarErrorBD(res, errItems);

    idsVenta = [...new Set([...(ventasDirectas || []).map(v => v.id), ...(items || []).map(i => i.venta_id)])];
    if (idsVenta.length === 0) return res.json([]);
  }

  let itemsQuery = db.from('venta_items')
    .select('id, venta_id, nombre, sku, serial_number, cantidad, condicion, meses_garantia')
    .eq('es_servicio', false).order('venta_id', { ascending: false }).limit(500);
  if (idsVenta) itemsQuery = itemsQuery.in('venta_id', idsVenta);

  const { data: itemsData, error: errI } = await itemsQuery;
  if (errI) return enviarErrorBD(res, errI);

  const ventaIds = [...new Set((itemsData || []).map(i => i.venta_id).filter(Boolean))];
  const ventasPorId = {};
  if (ventaIds.length) {
    const { data: ventasData, error: errV } = await db.from('ventas')
      .select('id, fecha, numero_orden, cliente, estado').in('id', ventaIds);
    if (errV) return enviarErrorBD(res, errV);
    (ventasData || []).forEach(v => { ventasPorId[v.id] = v; });
  }

  let filas = (itemsData || [])
    .map(it => {
      const venta = ventasPorId[it.venta_id];
      if (!venta) return null; // venta borrada/inaccesible: no se muestra huérfana
      const { vence_el, estado_garantia } = calcularEstadoGarantia(venta.fecha, it.meses_garantia);
      return {
        venta_item_id: it.id,
        venta_id: it.venta_id,
        numero_orden: venta.numero_orden || null,
        fecha_venta: venta.fecha || null,
        cliente: venta.cliente || null,
        nombre: it.nombre,
        sku: it.sku,
        serial_number: it.serial_number,
        cantidad: it.cantidad,
        condicion: it.condicion,
        meses_garantia: it.meses_garantia,
        vence_el,
        estado_garantia
      };
    })
    .filter(Boolean);

  if (filtroEstado === 'VIGENTE' || filtroEstado === 'VENCIDA') {
    filas = filas.filter(f => f.estado_garantia === filtroEstado);
  }

  filas.sort((a, b) => (b.fecha_venta || '').localeCompare(a.fecha_venta || '') || b.venta_id - a.venta_id);
  res.json(filas.slice(0, 200));
});

app.get('/api/garantias/servicios', auth(), async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const filtroEstado = String(req.query.estado || '').toUpperCase();

  // Solo las OT ENTREGADAS tienen garantía (la fecha de inicio es
  // fecha_entrega) — una orden pendiente no tiene nada que mostrar acá.
  const { data, error } = await db.from('ordenes_trabajo')
    .select('id, numero_ot, cliente_nombre, dispositivo_categoria, dispositivo_modelo, dispositivo_sn, fecha_entrega, meses_garantia')
    .eq('estado', 'ENTREGADO')
    .order('fecha_entrega', { ascending: false })
    .limit(500);
  if (error) return enviarErrorBD(res, error);

  let filas = (data || []).map(o => {
    const { vence_el, estado_garantia } = calcularEstadoGarantia(o.fecha_entrega, o.meses_garantia);
    return { ...o, vence_el, estado_garantia };
  });

  if (q) {
    filas = filas.filter(o =>
      (o.numero_ot || '').toLowerCase().includes(q) ||
      (o.cliente_nombre || '').toLowerCase().includes(q) ||
      (o.dispositivo_modelo || '').toLowerCase().includes(q) ||
      (o.dispositivo_categoria || '').toLowerCase().includes(q) ||
      (o.dispositivo_sn || '').toLowerCase().includes(q)
    );
  }
  if (filtroEstado === 'VIGENTE' || filtroEstado === 'VENCIDA') {
    filas = filas.filter(f => f.estado_garantia === filtroEstado);
  }

  res.json(filas.slice(0, 200));
});

/* ============================================================
   GARANTÍAS POR VENCER — Garantías → ⏰ Por vencer
   ------------------------------------------------------------
   Lo que el módulo Garantías no hacía: avisar ANTES. Hasta ahora el
   vencimiento solo se consultaba cuando alguien ya llegaba con un equipo
   malo. Esto da vuelta la pregunta: ¿a quién le vence pronto y todavía
   no le hemos avisado?

   POR QUÉ SALE POR WHATSAPP Y NO POR CORREO
   El canal real de Sevelin es WhatsApp (así se coordina casi toda la
   venta), y el correo transaccional está bloqueado hasta verificar el
   dominio en Resend. Este panel arma la lista y el mensaje; el envío lo
   hace el dueño con un click en wa.me. Cuando Resend esté listo, el
   mismo endpoint sirve para automatizarlo — la lista ya está calculada.

   EL VENCIMIENTO NO SE RECALCULA ACÁ: reutiliza calcularEstadoGarantia()
   del módulo Garantías (sql/31), que ya usa el snapshot de meses de cada
   venta_item / OT. Dos fórmulas del mismo dato es como se desincronizan
   los sistemas.
   ============================================================ */

/* Días entre hoy (Chile) y una fecha 'YYYY-MM-DD'. Positivo = falta;
   negativo = ya pasó. Se comparan fechas puras a mediodía UTC para que
   el cambio de día en Chile no corra el resultado en 1. */
function diasHastaFecha(fechaISO) {
  const hoy = fechaHoyChile();
  const ms = Date.parse(`${fechaISO}T12:00:00Z`) - Date.parse(`${hoy}T12:00:00Z`);
  return Math.round(ms / 86400000);
}

app.get('/api/garantias/por-vencer', auth(), async (req, res) => {
  /* Ventana de aviso. 30 días es el valor por defecto porque es tiempo
     suficiente para que el cliente pruebe el equipo, lo traiga y se
     alcance a reparar antes de que la garantía se cierre. */
  const dias = Math.min(180, Math.max(1, Number(req.query.dias) || 30));
  const incluirAvisados = req.query.avisados === '1';

  try {
    const hoy = fechaHoyChile();

    /* ---------- Productos ---------- */
    const { data: items, error: errI } = await db.from('venta_items')
      .select('id, venta_id, nombre, sku, serial_number, condicion, meses_garantia, aviso_garantia_en')
      .eq('es_servicio', false)
      .order('id', { ascending: false })
      .limit(5000);
    if (errI) throw errI;

    const idsVenta = [...new Set((items || []).map(i => i.venta_id).filter(Boolean))];
    const ventasPorId = new Map();
    if (idsVenta.length) {
      const { data: ventas, error: errV } = await db.from('ventas')
        .select('id, fecha, numero_orden, cliente, cliente_telefono')
        .in('id', idsVenta);
      if (errV) throw errV;
      (ventas || []).forEach(v => ventasPorId.set(v.id, v));
    }

    /* Vencimiento vigente más cercano, MIRE O NO dentro de la ventana.
       Sirve para el estado vacío: "no hay nada por avisar" no dice nada,
       "el primero vence el 03-02-2027" sí — y evita que alguien crea que
       el panel está roto cuando simplemente todavía no toca. */
    let proximoVencimiento = null;
    const registrarProximo = (fecha) => {
      if (fecha && (!proximoVencimiento || fecha < proximoVencimiento)) proximoVencimiento = fecha;
    };

    const productos = [];
    for (const it of (items || [])) {
      const venta = ventasPorId.get(it.venta_id);
      if (!venta) continue;                                  // venta borrada: no se muestra huérfana
      const { vence_el, estado_garantia } = calcularEstadoGarantia(venta.fecha, it.meses_garantia);
      if (!vence_el || estado_garantia !== 'VIGENTE') continue;
      registrarProximo(vence_el);
      const restan = diasHastaFecha(vence_el);
      if (restan > dias) continue;
      if (it.aviso_garantia_en && !incluirAvisados) continue;
      productos.push({
        tipo: 'producto',
        id: it.id,
        referencia: venta.numero_orden ? `Venta #${String(venta.numero_orden).padStart(5, '0')}` : `Venta ${venta.id}`,
        fecha_inicio: venta.fecha,
        cliente: venta.cliente || null,
        cliente_telefono: venta.cliente_telefono || null,
        detalle: it.nombre,
        sku: it.sku || null,
        serial_number: it.serial_number || null,
        condicion: it.condicion || null,
        meses_garantia: it.meses_garantia,
        vence_el,
        dias_restantes: restan,
        aviso_garantia_en: it.aviso_garantia_en || null
      });
    }

    /* ---------- Servicios (órdenes de trabajo entregadas) ---------- */
    const { data: ots, error: errO } = await db.from('ordenes_trabajo')
      .select('id, numero_ot, cliente_nombre, cliente_telefono, dispositivo_categoria, dispositivo_modelo, dispositivo_sn, fecha_entrega, meses_garantia, aviso_garantia_en')
      .eq('estado', 'ENTREGADO')
      .limit(2000);
    if (errO) throw errO;

    const servicios = [];
    for (const o of (ots || [])) {
      const { vence_el, estado_garantia } = calcularEstadoGarantia(o.fecha_entrega, o.meses_garantia);
      if (!vence_el || estado_garantia !== 'VIGENTE') continue;
      registrarProximo(vence_el);
      const restan = diasHastaFecha(vence_el);
      if (restan > dias) continue;
      if (o.aviso_garantia_en && !incluirAvisados) continue;
      servicios.push({
        tipo: 'servicio',
        id: o.id,
        referencia: o.numero_ot ? `OT ${o.numero_ot}` : `OT ${o.id}`,
        fecha_inicio: o.fecha_entrega,
        cliente: o.cliente_nombre || null,
        cliente_telefono: o.cliente_telefono || null,
        detalle: [o.dispositivo_categoria, o.dispositivo_modelo].filter(Boolean).join(' ') || 'Equipo',
        sku: null,
        serial_number: o.dispositivo_sn || null,
        condicion: null,
        meses_garantia: o.meses_garantia,
        vence_el,
        dias_restantes: restan,
        aviso_garantia_en: o.aviso_garantia_en || null
      });
    }

    /* Lo más urgente primero: es una lista para actuar, no para leer. */
    const filas = [...productos, ...servicios].sort((a, b) => a.dias_restantes - b.dias_restantes);

    /* Contexto honesto para la pantalla: de nada sirve decir "hay 12 por
       avisar" si a 11 no se les puede escribir. El teléfono se empezó a
       registrar recién en v52, así que las ventas viejas no lo tienen. */
    const conTelefono = filas.filter(f => f.cliente_telefono).length;

    res.json({
      hoy,
      dias,
      total: filas.length,
      conTelefono,
      sinTelefono: filas.length - conTelefono,
      proximo_vencimiento: proximoVencimiento,
      dias_al_proximo: proximoVencimiento ? diasHastaFecha(proximoVencimiento) : null,
      filas: filas.slice(0, 300)
    });
  } catch (error) {
    return enviarErrorBD(res, error, 'GET /api/garantias/por-vencer');
  }
});

/* Marca (o desmarca) que ya se le avisó al cliente.
   `tipo` decide la tabla: los productos viven en venta_items y los
   servicios en ordenes_trabajo — son dos garantías distintas con dos
   fechas de inicio distintas, no una tabla común. */
app.post('/api/garantias/:tipo/:id/aviso', auth(), async (req, res) => {
  const { tipo, id } = req.params;
  if (tipo !== 'producto' && tipo !== 'servicio') {
    return enviarError(res, 400, 'El tipo debe ser "producto" o "servicio".');
  }
  const tabla = tipo === 'producto' ? 'venta_items' : 'ordenes_trabajo';
  // avisado=false permite deshacer un click equivocado sin tocar la base.
  const marcar = req.body?.avisado !== false;

  const { data, error } = await db.from(tabla)
    .update({ aviso_garantia_en: marcar ? new Date().toISOString() : null })
    .eq('id', id)
    .select('id, aviso_garantia_en')
    .maybeSingle();
  if (error) return enviarErrorBD(res, error, 'POST /api/garantias/:tipo/:id/aviso');
  if (!data) return enviarError(res, 404, 'No se encontró esa garantía.');
  res.json({ ok: true, aviso_garantia_en: data.aviso_garantia_en });
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
  if (error) return enviarErrorBD(res, error);
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
  if (error) return enviarErrorBD(res, error);

  await asegurarAreaYCategoria(datos.area, datos.categoria);
  res.json(data);
});

app.delete('/api/repuestos/:id', auth(true), async (req, res) => {
  const { error } = await db.from('repuestos').delete().eq('id', req.params.id);
  if (error) return enviarErrorBD(res, error);
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
    if (error) return enviarErrorBD(res, error);

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
    if (errCascada) return enviarErrorBD(res, errCascada);

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
    if (error) return enviarErrorBD(res, error);
    res.json({ ok: true });
  });
}

fabricarRutasCatalogoRepuesto('areas', 'repuesto_areas', 'area');
fabricarRutasCatalogoRepuesto('categorias', 'repuesto_categorias', 'categoria');

/* ---------- Repuestos y mano de obra asignados a una OT ---------- */
app.get('/api/ot/:id/repuestos', auth(), async (req, res) => {
  const { data, error } = await db.from('ot_repuestos').select('*').eq('ot_id', req.params.id).order('id');
  if (error) return enviarErrorBD(res, error);
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
  if (errFila) return enviarErrorBD(res, errFila);
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
  if (error) return enviarErrorBD(res, error);
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
  if (error) return enviarErrorBD(res, error);
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
      observaciones: (body.observaciones || '').trim() || null,
      // Producto del catálogo (opcional) y costo para la utilidad — sql/46.
      producto_id: Number(body.producto_id) || null,
      cantidad: Math.max(1, Math.round(num(body.cantidad) || 1)),
      costo_total: Math.max(0, num(body.costo_total))
    }
  };
}

/* ---------- Abonos en Finanzas (sql/46) ----------
   Un abono es plata que entró HOY: suma al saldo de su canal y al cierre de
   su turno de caja. La venta que se registra al completar el 100% lleva
   encargo_id, y las vistas de caja la excluyen para no contar dos veces la
   misma plata. Las vistas de utilidad (Balance, Utilidades, informes) sí la
   cuentan: ahí lo que importa es la venta y su costo. */

// Día calendario de Chile de un timestamp (los abonos guardan timestamptz).
function fechaChileDeTs(ts) {
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
}

/* Abonos cuyo día en Chile cae entre `desde` y `hasta` (YYYY-MM-DD). Se
   pide un día de margen a cada lado en UTC y se filtra con la fecha de
   Chile: Chile cambia de -04 a -03 en el año y un rango fijo se equivocaría
   justo en los abonos de la noche. */
async function abonosEntreFechas(desde, hasta) {
  const ini = new Date(desde + 'T00:00:00Z'); ini.setUTCDate(ini.getUTCDate() - 1);
  const fin = new Date(hasta + 'T00:00:00Z'); fin.setUTCDate(fin.getUTCDate() + 2);
  const { data, error } = await db.from('encargo_abonos')
    .select('monto, metodo_pago, comision_pos, fecha, caja_id')
    .gte('fecha', ini.toISOString()).lt('fecha', fin.toISOString())
    .limit(100000);
  if (error) throw new Error(error.message);
  return (data || [])
    .map(a => ({ ...a, dia: fechaChileDeTs(a.fecha) }))
    .filter(a => a.dia >= desde && a.dia <= hasta);
}

// Turno de caja abierto en este momento (o null): el abono queda en ese turno.
async function cajaAbiertaId() {
  const { data } = await db.from('cajas_diarias').select('id').eq('estado', 'abierta').limit(1).maybeSingle();
  return data?.id || null;
}

async function insertarAbono(encargoId, monto, metodoPago, nota) {
  const metodo = metodoPago || 'Efectivo';
  return db.from('encargo_abonos').insert([{
    encargo_id: encargoId,
    monto,
    metodo_pago: metodo,
    nota,
    caja_id: await cajaAbiertaId(),
    // La máquina cobra su comisión por cada pasada de tarjeta, abono incluido.
    comision_pos: calcularComisionPos(metodo, monto)
  }]);
}

/* Descuenta el stock del producto del encargo UNA sola vez: al entregarlo o
   al completar el pago, lo que pase primero. Un producto de stock ilimitado
   o de Pedidos por Encargo no tiene stock que descontar.

   La marca stock_descontado se toma ANTES de descontar, con un update
   condicional: si dos acciones llegan juntas, solo una gana. Si el
   descuento falla (no alcanza el stock), se devuelve la marca y se avisa
   sin frenar la entrega ni el pago: esa plata o ese equipo ya se movieron. */
async function descontarStockDeEncargo(encargo) {
  if (!encargo?.producto_id || encargo.stock_descontado) return null;

  const { data: prod } = await db.from('productos')
    .select('id, nombre, stock_ilimitado, es_pedido_encargo').eq('id', encargo.producto_id).maybeSingle();
  if (!prod) return null;

  const { data: tomado } = await db.from('encargos')
    .update({ stock_descontado: true })
    .eq('id', encargo.id).eq('stock_descontado', false)
    .select('id');
  if (!tomado || tomado.length === 0) return null;

  if (prod.stock_ilimitado || prod.es_pedido_encargo) return null;

  try {
    await descontarStockNoLotes([{ producto_id: prod.id, cantidad: Math.max(1, num(encargo.cantidad)) }]);
    return null;
  } catch (err) {
    await db.from('encargos').update({ stock_descontado: false }).eq('id', encargo.id);
    return `No se pudo descontar el stock de "${prod.nombre}": ${err.message}`;
  }
}

/* Registra la venta de un encargo que llegó al 100%. Idempotente por el
   índice único ventas.encargo_id: si ya existe, devuelve la misma.
   No descuenta stock por su cuenta — eso lo hace descontarStockDeEncargo(). */
async function registrarVentaDeEncargo(encargoId) {
  const { data: e } = await db.from('encargos').select('*').eq('id', encargoId).maybeSingle();
  if (!e || e.estado !== 'PAGADO') return null;

  const { data: ya } = await db.from('ventas').select('id').eq('encargo_id', e.id).maybeSingle();
  if (ya) {
    if (!e.venta_id) await db.from('encargos').update({ venta_id: ya.id }).eq('id', e.id);
    return ya.id;
  }

  let prod = null;
  if (e.producto_id) {
    const { data } = await db.from('productos')
      .select('id, nombre, sku, condicion, meses_garantia, categoria_web').eq('id', e.producto_id).maybeSingle();
    prod = data || null;
  }

  const { data: abonos } = await db.from('encargo_abonos').select('metodo_pago, comision_pos').eq('encargo_id', e.id);
  const metodos = [...new Set((abonos || []).map(a => a.metodo_pago || 'Efectivo'))];
  const comision = (abonos || []).reduce((a, x) => a + num(x.comision_pos), 0);

  const cantidad = Math.max(1, num(e.cantidad));
  const total = num(e.monto_total);
  const linea = {
    producto_id: prod?.id || null,
    nombre: prod?.nombre || String(e.descripcion || 'Encargo').slice(0, 200),
    cantidad,
    costo_unitario: num(e.costo_total) / cantidad,
    precio_unitario: total / cantidad,
    subtotal: total,
    sku: prod?.sku || null,
    es_servicio: prod?.categoria_web === 'Servicios Técnicos',
    condicion: prod?.condicion || null,
    // Un encargo suelto (sin producto) no hereda los 6 meses de un producto
    // nuevo: la garantía de algo fuera del catálogo se pacta aparte.
    meses_garantia: prod ? (prod.meses_garantia ?? 6) : 0,
  };

  const cabecera = {
    fecha: fechaHoyChile(),
    hora: horaChileActual(),
    vendida_en: new Date().toISOString(),
    cliente: e.cliente_nombre,
    cliente_telefono: normalizarTelefonoChile(e.cliente_telefono),
    // Informativo: la plata ya entró por encargo_abonos con su medio real.
    metodo_pago: metodos.length === 1 ? metodos[0] : 'Abonos',
    metodo_pago_final: metodos.length === 1 ? metodos[0] : 'Abonos',
    estado: 'PAGADA',
    fecha_pago: new Date().toISOString(),
    tipo_dte: null,
    ...totalizar([linea], 0),
    descuento_tipo: null,
    descuento_valor: 0,
    // La comisión real ya se descontó abono por abono; se repite acá solo
    // para que la utilidad neta de la venta la considere.
    comision_pos: comision,
    pago_mixto: false,
    impreso: false,
    ...construirDatosEnvio({ tipo_entrega: 'retiro' }),
    origen_pago: 'encargo',
    encargo_id: e.id,
  };

  const { data: venta, error } = await db.from('ventas').insert([cabecera]).select().single();
  if (error) {
    if (/duplicate key|encargo_id/i.test(error.message)) {
      const { data: otra } = await db.from('ventas').select('id').eq('encargo_id', e.id).maybeSingle();
      return otra?.id || null;
    }
    throw new Error(error.message);
  }

  const { error: errItems } = await db.from('venta_items').insert([{ ...linea, venta_id: venta.id }]);
  if (errItems) {
    await db.from('ventas').delete().eq('id', venta.id);
    throw new Error(errItems.message);
  }

  await db.from('encargos').update({ venta_id: venta.id }).eq('id', e.id);
  return venta.id;
}

/* Después de cada abono: si quedó pagado, venta + stock. Nunca lanza: el
   abono ya está guardado y no se puede "deshacer" por un error acá. */
async function cerrarEncargoSiCorresponde(encargo) {
  const avisos = [];
  if (encargo?.estado !== 'PAGADO') return avisos;
  try {
    await registrarVentaDeEncargo(encargo.id);
  } catch (err) {
    console.error('[ENCARGO] no se pudo registrar la venta:', err.message);
    avisos.push('El pago quedó registrado, pero no se pudo crear la venta en el historial. Avísale al administrador.');
  }
  const avisoStock = await descontarStockDeEncargo(encargo);
  if (avisoStock) avisos.push(avisoStock);
  return avisos;
}

app.get('/api/encargos', auth(), async (req, res) => {
  const { estado } = req.query;
  let q = db.from('encargos').select('*').order('id', { ascending: false });
  if (estado) q = q.eq('estado', estado);

  const { data, error } = await q;
  if (error) return enviarErrorBD(res, error);
  res.json(data || []);
});

app.get('/api/encargos/:id', auth(), async (req, res) => {
  const { data: encargo, error } = await db.from('encargos').select('*').eq('id', req.params.id).single();
  if (error) return enviarError(res, 404, 'Encargo no encontrado');

  const { data: abonos } = await db.from('encargo_abonos')
    .select('*').eq('encargo_id', req.params.id).order('id');

  let producto = null;
  if (encargo.producto_id) {
    const { data } = await db.from('productos').select('id, nombre, sku, stock, stock_ilimitado').eq('id', encargo.producto_id).maybeSingle();
    producto = data || null;
  }

  res.json({ ...encargo, abonos: abonos || [], producto });
});

// Costo del encargo: si no lo escribieron y hay producto, el del catálogo.
async function resolverCostoEncargo(datos) {
  if (!datos.producto_id) return datos;
  const { data: prod } = await db.from('productos')
    .select('id, costo_unitario, archivado').eq('id', datos.producto_id).maybeSingle();
  if (!prod) return { ...datos, producto_id: null };
  if (!datos.costo_total) datos.costo_total = num(prod.costo_unitario) * datos.cantidad;
  return datos;
}

app.post('/api/encargos', auth(), async (req, res) => {
  const { datos: crudos, error: errValidacion } = sanearEncargo(req.body);
  if (errValidacion) return enviarError(res, 400, errValidacion);
  const datos = await resolverCostoEncargo(crudos);

  const abonoInicial = num(req.body?.abono_inicial);
  if (abonoInicial < 0) return enviarError(res, 400, 'El abono no puede ser negativo');
  if (abonoInicial > datos.monto_total) return enviarError(res, 400, 'El abono no puede superar el monto total');

  const registro = {
    ...datos,
    monto_abonado: abonoInicial,
    saldo: datos.monto_total - abonoInicial,
    estado: estadoEncargo(datos.monto_total, abonoInicial)
  };

  const { data: encargo, error } = await db.from('encargos').insert([registro]).select().single();
  if (error) return enviarErrorBD(res, error);

  if (abonoInicial > 0) {
    const { error: errAbono } = await insertarAbono(encargo.id, abonoInicial, req.body?.metodo_pago, 'Abono inicial');
    if (errAbono) {
      // Sin el abono guardado, el encargo diría "abonado" con plata que
      // Finanzas no ve. Se deshace entero en vez de quedar a medias.
      await db.from('encargos').delete().eq('id', encargo.id);
      return enviarErrorBD(res, errAbono);
    }
  }

  const avisos = await cerrarEncargoSiCorresponde(encargo);
  res.status(201).json({ ...encargo, avisos });
});

app.put('/api/encargos/:id', auth(), async (req, res) => {
  const { datos: crudos, error: errValidacion } = sanearEncargo(req.body);
  if (errValidacion) return enviarError(res, 400, errValidacion);

  const { data: actual, error: errActual } = await db.from('encargos').select('*').eq('id', req.params.id).single();
  if (errActual) return enviarError(res, 404, 'Encargo no encontrado');

  // Con la venta ya registrada, cambiar el total o el producto dejaría el
  // historial contando otra cosa. Solo se permiten los datos de contacto.
  if (actual.venta_id) {
    const { data, error } = await db.from('encargos').update({
      cliente_nombre: crudos.cliente_nombre,
      cliente_rut: crudos.cliente_rut,
      cliente_telefono: crudos.cliente_telefono,
      observaciones: crudos.observaciones
    }).eq('id', req.params.id).select().single();
    if (error) return enviarErrorBD(res, error);
    return res.json(data);
  }

  // El producto no se cambia después de descontar su stock.
  if (actual.stock_descontado) {
    crudos.producto_id = actual.producto_id;
    crudos.cantidad = actual.cantidad;
  }
  const datos = await resolverCostoEncargo(crudos);

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
  if (error) return enviarErrorBD(res, error);

  // Bajar el total hasta lo ya abonado también completa el encargo.
  const avisos = await cerrarEncargoSiCorresponde(data);
  res.json({ ...data, avisos });
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

  const { error: errAbono } = await insertarAbono(encargo.id, monto, req.body?.metodo_pago, (req.body?.nota || '').trim() || null);
  if (errAbono) return enviarErrorBD(res, errAbono);

  const { data, error } = await db.from('encargos').update({
    monto_abonado: abonado,
    saldo: num(encargo.monto_total) - abonado,
    estado: estadoEncargo(num(encargo.monto_total), abonado)
  }).eq('id', encargo.id).select().single();

  if (error) return enviarErrorBD(res, error);

  const avisos = await cerrarEncargoSiCorresponde(data);
  const { data: abonos } = await db.from('encargo_abonos').select('*').eq('encargo_id', encargo.id).order('id');
  res.json({ ...data, abonos: abonos || [], ultimo_abono: monto, avisos });
});

/* Marcar la entrega. Independiente del pago ("depende del caso", dueño
   12-09-2026): se puede entregar con saldo pendiente. Descuenta el stock
   del producto si todavía no se había descontado. */
app.post('/api/encargos/:id/entregar', auth(), async (req, res) => {
  const { data: encargo, error } = await db.from('encargos').select('*').eq('id', req.params.id).single();
  if (error) return enviarError(res, 404, 'Encargo no encontrado');
  if (encargo.entregado_en) return enviarError(res, 400, 'Este encargo ya figura como entregado');

  const { data, error: errUpd } = await db.from('encargos').update({
    entregado_en: new Date().toISOString(),
    entregado_nota: (req.body?.nota || '').trim() || null
  }).eq('id', encargo.id).select().single();
  if (errUpd) return enviarErrorBD(res, errUpd);

  const avisoStock = await descontarStockDeEncargo(data);
  res.json({ ...data, avisos: avisoStock ? [avisoStock] : [] });
});

app.delete('/api/encargos/:id', auth(true), async (req, res) => {
  /* Un encargo con plata recibida no se borra: sus abonos ya están en los
     saldos y en los cierres de caja, y borrarlo (cascada) cambiaría hacia
     atrás cifras que ya se usaron. Se corrige editándolo. */
  const { data: actual } = await db.from('encargos').select('monto_abonado, venta_id').eq('id', req.params.id).maybeSingle();
  if (actual && (num(actual.monto_abonado) > 0 || actual.venta_id)) {
    return enviarError(res, 400, 'Este encargo tiene abonos registrados en Finanzas y no se puede eliminar. Corrígelo editándolo.');
  }
  const { error } = await db.from('encargos').delete().eq('id', req.params.id);
  if (error) return enviarErrorBD(res, error);
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

/* Registra en el POS la venta que nació en sevelin.cl.
   ------------------------------------------------------------
   HALLAZGO DEL 12-09-2026 QUE ESTE ENDPOINT CIERRA
   Un pedido pagado en la tienda llamaba a /api/interno/ajustar-stock y
   nada más: el stock bajaba y la venta no existía en ninguna parte. O sea
   el inventario registraba la salida y el Historial de Ventas, la
   utilidad, el margen, el ticket promedio y el punto de equilibrio se
   quedaban todos cortos. Lo notó el dueño porque la venta de la balanza
   no le aparecía en el historial del día.

   POR QUÉ NO SE REUSA POST /api/ventas
   Esa ruta descuenta stock como parte de su trabajo (BIZ-02 atómico), y
   acá el stock YA se descontó en la llamada anterior del mismo webhook.
   Pasar por ahí lo descontaría dos veces. Este endpoint hace lo mismo
   PERO sin tocar stock, y lo dice en una línea para que nadie "arregle"
   la omisión más adelante.

   IDEMPOTENTE: las pasarelas reintentan sus notificaciones. El candado es
   el índice único de ventas.pedido_web_numero (sql/41) — si la venta ya
   existe se devuelve la misma en vez de crear otra, y el reintento
   termina en 200 como si nada.

   El costo sale del catálogo al momento de registrar. Los productos con
   lotes (PEPS) no consumen capas acá: el flujo web nunca las tocó, porque
   /api/interno/ajustar-stock solo descuenta los productos sin lotes.
   Queda igual que antes de este cambio, no es una regresión nueva. */
app.post('/api/interno/registrar-venta-web', authSync, async (req, res) => {
  const numeroPedido = String(req.body?.numero_pedido || '').trim();
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!numeroPedido) return enviarError(res, 400, 'Falta numero_pedido');
  if (items.length === 0) return enviarError(res, 400, 'Falta items');

  try {
    const { data: yaExiste } = await db.from('ventas')
      .select('id, numero_orden').eq('pedido_web_numero', numeroPedido).maybeSingle();
    if (yaExiste) return res.json({ ok: true, ya_registrada: true, venta_id: yaExiste.id });

    // Costo real desde el catálogo: el pedido trae el precio de venta,
    // nunca el costo (ese dato no sale del POS y no debe salir).
    const ids = items.map(i => Number(i.producto_pos_id)).filter(Boolean);
    const { data: productos } = await db.from('productos')
      .select('id, nombre, sku, costo_unitario, condicion, meses_garantia').in('id', ids);
    const porId = new Map((productos || []).map(p => [p.id, p]));

    const lineas = items.map(i => {
      const prod = porId.get(Number(i.producto_pos_id)) || {};
      const cantidad = Math.max(1, num(i.cantidad));
      const precio = Math.max(0, num(i.precio_web));
      return {
        producto_id: prod.id || null,
        nombre: i.nombre || prod.nombre || 'Producto',
        cantidad,
        costo_unitario: num(prod.costo_unitario),
        precio_unitario: precio,
        subtotal: precio * cantidad,
        sku: i.sku || prod.sku || null,
        // La tienda marca los servicios técnicos desde el carrito mixto
        // (12-09-2026). Sin esto el Balance los contaba como productos.
        es_servicio: !!i.es_servicio,
        condicion: prod.condicion || null,
        meses_garantia: prod.meses_garantia ?? 6,
      };
    });

    const totales = totalizar(lineas, 0);
    const fecha = fechaHoyChile();
    const cabecera = {
      fecha,
      hora: horaChileActual(),
      vendida_en: new Date().toISOString(),
      cliente: (req.body?.cliente || '').trim() || 'Cliente web',
      cliente_telefono: normalizarTelefonoChile(req.body?.cliente_telefono),
      cliente_correo: (req.body?.cliente_correo || '').trim().toLowerCase() || null,
      // Khipu es una transferencia bancaria: el cliente autoriza el pago
      // desde su banco. Se guarda como tal para que cuadre con la cartola.
      metodo_pago: (req.body?.metodo_pago || 'Transferencia'),
      estado: 'PAGADA',
      fecha_pago: new Date().toISOString(),
      metodo_pago_final: (req.body?.metodo_pago || 'Transferencia'),
      tipo_dte: null,
      ...totales,
      descuento_tipo: null,
      descuento_valor: 0,
      comision_pos: 0,
      pago_mixto: false,
      impreso: false,
      // Mismo normalizador que las ventas de caja: retiro deja el envío
      // como 'entregado' (no hay nada que despachar) y despacho lo deja
      // 'pendiente' para que aparezca en la logística del POS.
      ...construirDatosEnvio(req.body),
      origen_pago: 'web',
      // La comisión de la pasarela la calcula la tienda, que es la que
      // sabe con cuál se cobró. Sin esto el margen de las ventas web se
      // vería mejor de lo que es.
      comision_pasarela: Math.max(0, num(req.body?.comision_pasarela)),
      pedido_web_numero: numeroPedido,
    };

    const { data: venta, error } = await db.from('ventas').insert([cabecera]).select().single();
    if (error) {
      // Carrera entre dos reintentos simultáneos del webhook: el índice
      // único hizo su trabajo. No es un fallo que deba reintentarse.
      if (/duplicate key|pedido_web_numero/i.test(error.message)) {
        return res.json({ ok: true, ya_registrada: true });
      }
      throw new Error(error.message);
    }

    const { error: errItems } = await db.from('venta_items')
      .insert(lineas.map(l => ({ ...l, venta_id: venta.id })));
    if (errItems) {
      await db.from('ventas').delete().eq('id', venta.id);
      throw new Error(errItems.message);
    }

    res.status(201).json({ ok: true, venta_id: venta.id, numero_orden: venta.numero_orden });
  } catch (err) {
    console.error('[VENTA WEB] no se pudo registrar:', err.message);
    enviarError(res, 500, err.message || 'No se pudo registrar la venta web');
  }
});

/* Panel "Pedidos Web" (Fase 5, README sección 2.1): lectura + cambio de
   estado de despacho de los pedidos que llegan de sevelin-tienda. Usa
   `dbWeb` (Supabase Web), NUNCA `db` (Supabase del POS) — son proyectos
   distintos. auth(true): el README lo pide explícito, es una vista de
   administración, no logística general como /api/ventas/:id/envio. */
const ESTADOS_DESPACHO_PEDIDO_WEB = ['PREPARANDO', 'ENVIADO', 'ENTREGADO', 'CANCELADO'];

app.get('/api/pos/pedidos-web', auth(true), async (req, res) => {
  // consultarConReintento: un corte pasajero de Supabase Web ya no llega al
  // panel como error rojo (se vio el 12-09-2026, "Gateway Timeout").
  const { data, error } = await consultarConReintento(() => {
    let q = dbWeb.from('pedidos_web').select('*').order('creado_en', { ascending: false });
    // Admite uno o varios estados separados por coma (ej. para el badge de
    // notificaciones del header, que junta PAGADO + ERROR_STOCK_SIN_DESPACHO
    // en una sola consulta) — ver js/notificaciones.js.
    if (req.query.estado) {
      const estados = String(req.query.estado).split(',').map(e => e.trim()).filter(Boolean);
      q = estados.length > 1 ? q.in('estado', estados) : q.eq('estado', estados[0]);
    }
    // Filtro opcional por tipo de pedido — ver sql/30-pedidos-por-encargo.sql
    // (POS) y supabase/18-pedidos-por-encargo.sql (tienda).
    if (req.query.tipo) q = q.eq('tipo_pedido', String(req.query.tipo));
    return q;
  });
  if (error) return enviarErrorBD(res, error, 'Pedidos Web');
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
  // panel. EXPIRADO es el mismo caso: lo puso ahí el cron de limpieza
  // (ver sevelin-tienda GET /api/cron/expirar-pedidos) por 24h sin pago
  // confirmado — tampoco hay nada que despachar.
  const { data: actual, error: errorActual } = await dbWeb
    .from('pedidos_web').select('estado, items').eq('id', req.params.id).single();
  if (errorActual) return enviarError(res, 404, 'Pedido no encontrado');
  if (['CREADO', 'FALLIDO', 'EXPIRADO'].includes(actual.estado)) {
    return enviarError(res, 409, 'Este pedido todavía no tiene el pago confirmado');
  }

  const { data, error } = await dbWeb.from('pedidos_web')
    .update(cambios).eq('id', req.params.id).select().single();
  if (error) return enviarErrorBD(res, error);

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
      // Un correo de pedido que no sale queda en Salud (sql/48).
      if (!resp.ok || (!cuerpo.enviado && cuerpo.motivo !== 'sin_email')) {
        await registrarErrorSalud({ ruta: 'correo de cancelación de pedido', mensaje: data.numero_pedido + ': ' + (cuerpo.error || (resp.ok ? 'el proveedor de correo no confirmó el envío' : 'la tienda respondió ' + resp.status)) });
      }
    } catch (err) {
      console.error('[Pedidos Web] No se pudo notificar la cancelación al cliente:', req.params.id, ':', err.message);
      await registrarErrorSalud({ ruta: 'correo de cancelación de pedido', mensaje: data.numero_pedido + ': no se pudo contactar a la tienda (' + err.message + ')' });
    }
  }

  /* Correo de entrega (con el pedido de reseña de Google) — mismo criterio
     de mejor esfuerzo que la cancelación de arriba: si falla, el pedido
     queda ENTREGADO igual. Ver POST /api/pos/notificar-entrega en
     sevelin-tienda y correoEntregaPedido() ahí mismo. */
  if (cambios.estado === 'ENTREGADO' && TIENDA_NOTIFICAR_ENTREGA_URL && SYNC_SECRET && data?.numero_pedido) {
    try {
      const resp = await fetch(TIENDA_NOTIFICAR_ENTREGA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-sync-secret': SYNC_SECRET },
        body: JSON.stringify({ numero_pedido: data.numero_pedido })
      });
      const cuerpo = await resp.json().catch(() => ({}));
      correoEnviado = !!cuerpo.enviado;
      // Un correo de pedido que no sale queda en Salud (sql/48).
      if (!resp.ok || (!cuerpo.enviado && cuerpo.motivo !== 'sin_email')) {
        await registrarErrorSalud({ ruta: 'correo de entrega de pedido', mensaje: data.numero_pedido + ': ' + (cuerpo.error || (resp.ok ? 'el proveedor de correo no confirmó el envío' : 'la tienda respondió ' + resp.status)) });
      }
    } catch (err) {
      console.error('[Pedidos Web] No se pudo notificar la entrega al cliente:', req.params.id, ':', err.message);
      await registrarErrorSalud({ ruta: 'correo de entrega de pedido', mensaje: data.numero_pedido + ': no se pudo contactar a la tienda (' + err.message + ')' });
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
  if (error) return enviarErrorBD(res, error);

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

/* Panel "Página Web → Salud": integraciones OPCIONALES, con su estado
   (configurada o no) — antes el único aviso de que faltaba alguna era un
   console.warn/error en los logs de Vercel, que nadie del negocio revisa.
   Nunca devuelve el valor real de una env var, solo si existe. Ninguna de
   estas rompe el resto del POS si falta — cada una degrada su propia
   función nada más (ver los console.warn al inicio de este archivo, son
   la misma lista). */
app.get('/api/salud-sistema', auth(true), (req, res) => {
  const configurada = (...vars) => vars.every((v) => !!v);

  const items = [
    {
      nombre: 'Redis (freno de intentos de login)',
      configurada: configurada(process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN),
      impacto: 'El freno sigue funcionando pero solo en memoria del proceso — más débil en serverless (cada instancia fría parte de cero).',
    },
    {
      nombre: 'Gemini (botón "Generar con IA" del SEO)',
      configurada: configurada(process.env.GEMINI_API_KEY),
      impacto: 'El botón queda visible pero falla al usarlo. El SEO se puede seguir escribiendo a mano.',
    },
    {
      nombre: 'Supabase Web (panel Pedidos Web)',
      configurada: configurada(SUPABASE_WEB_URL, SUPABASE_WEB_SERVICE_ROLE_KEY),
      impacto: 'El panel "Pedidos Web" no puede consultar ni actualizar pedidos de la tienda.',
    },
    {
      nombre: 'Sincronización de stock con la tienda',
      configurada: configurada(SYNC_SECRET),
      impacto: 'Vender/comprar no descuenta el stock de sevelin.cl en tiempo real.',
    },
    {
      nombre: 'Sincronización de catálogo a la tienda',
      configurada: configurada(process.env.TIENDA_SYNC_URL),
      impacto: 'El script de carga masiva del catálogo web no tiene a dónde mandar los productos.',
    },
    {
      nombre: 'Correo de cancelación de pedido',
      configurada: configurada(TIENDA_NOTIFICAR_CANCELACION_URL),
      impacto: 'Al cancelar un pedido web, el cliente no recibe el correo de aviso.',
    },
    {
      nombre: 'Correo de entrega + reseña de Google',
      configurada: configurada(TIENDA_NOTIFICAR_ENTREGA_URL),
      impacto: 'Al marcar un pedido como ENTREGADO, el cliente no recibe el correo con el enlace de reseña.',
    },
    {
      nombre: 'Reenvío de carrito abandonado',
      configurada: configurada(TIENDA_REENVIAR_CARRITO_URL),
      impacto: 'El botón "Reenviar" del panel Métricas no puede mandar el correo de carrito abandonado.',
    },
  ];

  res.json(items);
});

/* Errores recientes para Salud: los del POS (su base) y los de la tienda
   (la base web), agrupados por qué falló y dónde. Los números, correos y
   códigos se normalizan para agrupar ("pedido WEB-000011" y "pedido
   WEB-000012" son el mismo problema). */
function claveAgrupacionError(e) {
  const normal = String(e.mensaje || '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '<correo>')
    .replace(/\b[0-9a-f]{16,}\b/gi, '<código>')
    .replace(/\d+/g, '#');
  return [e.origen, e.ruta || '', normal].join('|');
}

app.get('/api/salud-sistema/errores', auth(true), async (req, res) => {
  const dias = Math.min(30, Math.max(1, Math.round(num(req.query.dias) || 7)));
  const desde = new Date(Date.now() - dias * 86400000).toISOString();
  const traer = (cliente) => cliente.from('registro_errores').select('*')
    .gte('creado_en', desde).order('creado_en', { ascending: false }).limit(1000);

  const [pos, web] = await Promise.all([
    traer(db).then(r => r, e => ({ error: e })),
    SUPABASE_WEB_URL ? traer(dbWeb).then(r => r, e => ({ error: e })) : Promise.resolve({ data: [] }),
  ]);

  const grupos = new Map();
  for (const e of [...(pos.data || []), ...(web.data || [])]) {
    const k = claveAgrupacionError(e);
    const g = grupos.get(k);
    if (!g) grupos.set(k, { origen: e.origen, ruta: e.ruta, metodo: e.metodo, estado_http: e.estado_http, mensaje: e.mensaje, detalle: e.detalle, veces: 1, ultima: e.creado_en, primera: e.creado_en });
    else { g.veces++; if (e.creado_en < g.primera) g.primera = e.creado_en; }
  }

  res.json({
    dias,
    grupos: [...grupos.values()].sort((a, b) => (a.ultima < b.ultima ? 1 : -1)),
    // Si una de las dos bases no respondió, se dice: Salud no puede
    // aparentar "sin errores" justo cuando la base está caída.
    avisos: [
      pos.error ? 'No se pudo leer el registro de errores del POS.' : null,
      web.error ? 'No se pudo leer el registro de errores de la tienda.' : null,
    ].filter(Boolean),
  });
});

app.delete('/api/salud-sistema/errores', auth(true), async (req, res) => {
  const limite = new Date(Date.now() + 60000).toISOString();
  const [a, b] = await Promise.all([
    db.from('registro_errores').delete().lt('creado_en', limite),
    SUPABASE_WEB_URL ? dbWeb.from('registro_errores').delete().lt('creado_en', limite) : Promise.resolve({}),
  ]);
  if (a.error) return enviarErrorBD(res, a.error, 'limpiar registro de errores');
  if (b.error) return enviarErrorBD(res, b.error, 'limpiar registro de errores de la tienda');
  res.json({ ok: true });
});

/* Panel "Métricas" (Página Web → Métricas): totales generales del negocio
   online — visitas, carritos compartidos/abandonados/convertidos, cuentas
   de cliente creadas. Todo son `count` con `head:true` (PostgREST cuenta
   sin traer filas) contra `dbWeb`, en paralelo. Números acumulados de
   siempre (no por período) salvo "visitas últimos 30 días", que se agrega
   como contexto — es lo que pidió el dueño ("total de...", no "en el
   último mes").

   `?desde=YYYY-MM-DD&hasta=YYYY-MM-DD` (opcional, ambas fechas interpretadas
   en hora de Chile) agrega el bloque `periodo` con los mismos conteos pero
   acotados a ese rango — permite responder "cuántas visitas/cuentas hubo
   hoy/ayer/esta semana/un rango a elección" sin tocar los acumulados de
   siempre, que otros lugares del panel ya leían de este mismo endpoint. */
app.get('/api/pos/metricas', auth(true), async (req, res) => {
  const hace30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const contar = (tabla, filtro) => {
    let q = dbWeb.from(tabla).select('*', { count: 'exact', head: true });
    if (filtro) q = filtro(q);
    return q;
  };

  // "Activos ahora": sesiones con latido dentro de los últimos 90s (ver
  // visitas_activas / src/components/visit-tracker.tsx en la tienda —
  // manda un latido cada 25s, así que 90s tolera perder hasta 2 seguidos
  // antes de dar a esa persona por desconectada).
  const hace90Segundos = new Date(Date.now() - 90 * 1000).toISOString();

  // Rango de período opcional: se valida acá (no solo con horaValida, que
  // es para HH:MM) y se convierte a los dos límites UTC reales del rango en
  // hora de Chile con marcaDeTiempoChile — mismo helper que ya usa el resto
  // del POS para no reinventar el desfase de horario de verano.
  const { desde, hasta } = req.query;
  const fechaValida = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const hayPeriodo = fechaValida(desde) && fechaValida(hasta);
  if ((desde || hasta) && !hayPeriodo) {
    return enviarError(res, 400, 'desde/hasta deben venir como YYYY-MM-DD, las dos juntas.');
  }
  const desdeUTC = hayPeriodo ? marcaDeTiempoChile(desde, '00:00') : null;
  const hastaUTC = hayPeriodo ? marcaDeTiempoChile(hasta, '23:59:59') : null;
  if (hayPeriodo && (!desdeUTC || !hastaUTC)) {
    return enviarError(res, 400, 'desde/hasta no son fechas válidas.');
  }

  try {
    const [
      totalVisitas,
      visitas30Dias,
      carritosCompartidos,
      carritosAbandonados,
      carritosConvertidos,
      totalUsuarios,
      visitantesActivos,
      ...periodo
    ] = await Promise.all([
      contar('eventos_web', q => q.eq('tipo', 'visita')),
      contar('eventos_web', q => q.eq('tipo', 'visita').gte('creado_en', hace30Dias)),
      contar('carritos_web', q => q.eq('origen', 'compartido')),
      contar('carritos_web', q => q.eq('origen', 'checkout').is('numero_pedido', null)),
      contar('carritos_web', q => q.eq('origen', 'checkout').not('numero_pedido', 'is', null)),
      contar('perfiles_clientes'),
      contar('visitas_activas', q => q.gte('ultima_actividad', hace90Segundos)),
      ...(hayPeriodo ? [
        contar('eventos_web', q => q.eq('tipo', 'visita').gte('creado_en', desdeUTC).lte('creado_en', hastaUTC)),
        contar('perfiles_clientes', q => q.gte('creado_en', desdeUTC).lte('creado_en', hastaUTC)),
        contar('carritos_web', q => q.eq('origen', 'compartido').gte('creado_en', desdeUTC).lte('creado_en', hastaUTC)),
        contar('carritos_web', q => q.eq('origen', 'checkout').is('numero_pedido', null).gte('creado_en', desdeUTC).lte('creado_en', hastaUTC)),
        contar('carritos_web', q => q.eq('origen', 'checkout').not('numero_pedido', 'is', null).gte('creado_en', desdeUTC).lte('creado_en', hastaUTC)),
      ] : []),
    ]);

    const primerError = [totalVisitas, visitas30Dias, carritosCompartidos, carritosAbandonados, carritosConvertidos, totalUsuarios, visitantesActivos, ...periodo]
      .find(r => r.error);
    if (primerError) return enviarErrorBD(res, primerError.error);

    const respuesta = {
      total_visitas: totalVisitas.count || 0,
      visitas_ultimos_30_dias: visitas30Dias.count || 0,
      total_carritos_compartidos: carritosCompartidos.count || 0,
      total_carritos_abandonados: carritosAbandonados.count || 0,
      total_carritos_convertidos: carritosConvertidos.count || 0,
      total_usuarios_registrados: totalUsuarios.count || 0,
      visitantes_activos_ahora: visitantesActivos.count || 0,
    };

    if (hayPeriodo) {
      const [visitasPeriodo, cuentasPeriodo, compartidosPeriodo, abandonadosPeriodo, convertidosPeriodo] = periodo;
      respuesta.periodo = {
        desde,
        hasta,
        visitas: visitasPeriodo.count || 0,
        cuentas_creadas: cuentasPeriodo.count || 0,
        carritos_compartidos: compartidosPeriodo.count || 0,
        carritos_abandonados: abandonadosPeriodo.count || 0,
        carritos_convertidos: convertidosPeriodo.count || 0,
      };
    }

    res.json(respuesta);
  } catch (err) {
    enviarErrorBD(res, err);
  }
});

/* Resuelve los SKUs de un carrito contra el catálogo REAL del POS (mismo
   proceso, `db`, no `dbWeb` — los SKUs son los mismos en ambos lados
   porque la tienda los sincroniza desde acá) para mostrar nombre/precio
   vigente en vez de lo que haya quedado "congelado" en el JSON del
   carrito. Un SKU que ya no existe se omite, no rompe la fila entera. */
async function resolverItemsCarrito(items) {
  const skus = [...new Set((items || []).map(it => it?.sku).filter(Boolean))];
  if (skus.length === 0) return [];
  const { data: productos } = await db.from('productos').select('sku, nombre, precio_web, precio_unitario').in('sku', skus);
  const porSku = new Map((productos || []).map(p => [p.sku, p]));
  return (items || [])
    .map(it => {
      const p = porSku.get(it?.sku);
      if (!p) return null;
      return { sku: it.sku, cantidad: it.cantidad || 1, nombre: p.nombre, precio: p.precio_web ?? p.precio_unitario ?? 0 };
    })
    .filter(Boolean);
}

/* Detalle de "Cuentas de cliente creadas" (ver tarjeta del panel Métricas) —
   quién se registró, con qué contacto y si tiene algo guardado en el
   carrito de su cuenta ahora mismo. */
app.get('/api/pos/metricas/cuentas', auth(true), async (req, res) => {
  const { data, error } = await dbWeb.from('perfiles_clientes')
    .select('id, nombre, apellido, telefono, creado_en, carrito')
    .order('creado_en', { ascending: false });
  if (error) return enviarErrorBD(res, error);

  const conCarrito = await Promise.all((data || []).map(async (c) => ({
    id: c.id,
    nombre: [c.nombre, c.apellido].filter(Boolean).join(' ') || '(sin nombre)',
    telefono: c.telefono || null,
    creado_en: c.creado_en,
    carrito_actual: await resolverItemsCarrito(c.carrito),
  })));
  res.json(conCarrito);
});

/* Detalle de "Carritos compartidos" — el link real (mismo formato que ya
   arma /carrito de la tienda, ver carrito-compartido) para poder
   reenviarlo si el dueño quiere, y qué llevaba adentro. */
app.get('/api/pos/metricas/carritos-compartidos', auth(true), async (req, res) => {
  const { data, error } = await dbWeb.from('carritos_web')
    .select('id, token, items, creado_en')
    .eq('origen', 'compartido')
    .order('creado_en', { ascending: false })
    .limit(200);
  if (error) return enviarErrorBD(res, error);

  const conItems = await Promise.all((data || []).map(async (c) => ({
    id: c.id,
    creado_en: c.creado_en,
    link: c.token ? `${URL_TIENDA_PUBLICA}/carrito-compartido?t=${c.token}` : null,
    items: await resolverItemsCarrito(c.items),
  })));
  res.json(conItems);
});

/* Detalle de "Carritos abandonados" — origen='checkout' sin numero_pedido
   (dejó su correo pero no completó el pago). Trae también si ese correo
   coincide con una cuenta registrada, para ofrecer su teléfono guardado en
   el botón de WhatsApp del frontend (si no hay cuenta, el botón sale
   igual pero con el número vacío para completarlo a mano — pedido
   explícito del dueño). */
app.get('/api/pos/metricas/carritos-abandonados', auth(true), async (req, res) => {
  const { data, error } = await dbWeb.from('carritos_web')
    .select('id, items, correo, creado_en, actualizado_en, recordatorio_enviado_en, expira_en')
    .eq('origen', 'checkout')
    .is('numero_pedido', null)
    .order('actualizado_en', { ascending: false })
    .limit(200);
  if (error) return enviarErrorBD(res, error);

  const conItems = await Promise.all((data || []).map(async (c) => ({
    id: c.id,
    correo: c.correo,
    creado_en: c.creado_en,
    actualizado_en: c.actualizado_en,
    recordatorio_enviado_en: c.recordatorio_enviado_en,
    expirado: c.expira_en ? new Date(c.expira_en) < new Date() : false,
    items: await resolverItemsCarrito(c.items),
  })));
  res.json(conItems);
});

/* Reenvío forzado del correo de recordatorio de UN carrito abandonado
   puntual (botón "Reenviar por correo" de la tabla) — el POS no tiene la
   API key de Resend, así que le pide a la tienda que lo mande ella (mismo
   patrón que la notificación de cancelación). */
app.post('/api/pos/carritos/:id/reenviar-correo', auth(true), async (req, res) => {
  if (!TIENDA_REENVIAR_CARRITO_URL || !SYNC_SECRET) {
    return enviarError(res, 501, 'Falta configurar TIENDA_REENVIAR_CARRITO_URL en el servidor');
  }
  try {
    const resp = await fetch(TIENDA_REENVIAR_CARRITO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sync-secret': SYNC_SECRET },
      body: JSON.stringify({ carrito_id: req.params.id }),
    });
    const cuerpo = await resp.json().catch(() => ({}));
    if (!resp.ok) return enviarError(res, resp.status, cuerpo.error || 'La tienda no pudo reenviar el correo');
    res.json(cuerpo);
  } catch (err) {
    enviarError(res, 502, 'No se pudo contactar a la tienda para reenviar el correo');
  }
});

/* ============================================================
   GET /api/pos/inteligencia — Finanzas → Inteligencia (Fase 1)
   ------------------------------------------------------------
   Responde las preguntas que el dueño no podía contestar mirando el
   POS: cuál es el producto que MÁS MARGEN deja (no el que más vende),
   cuánta plata hay dormida en stock que nunca rotó, y qué datos del
   catálogo están mal cargados y ensucian todos los reportes.

   POR QUÉ SE CALCULA ACÁ Y NO EN SQL
   El volumen real es chico (cientos de ventas, ~150 productos): traer
   las tres tablas y agrupar en JS es más simple de leer y de cambiar
   que una RPC nueva, y sigue el mismo criterio que ya se tomó en
   /api/pos/mas-buscados. Si algún día esto crece a decenas de miles de
   ventas, hay que mover el agrupado a una función SQL.

   DOS TRAMPAS DEL NEGOCIO QUE ESTE ENDPOINT RESPETA
   1. Los SERVICIOS TÉCNICOS tienen costo 0 legítimamente (son mano de
      obra), así que su margen es 100% por definición. Mezclarlos con
      los productos falsea el ranking, por eso van marcados aparte y
      quedan fuera de los "cajones" y de las alertas de costo en $0.
   2. El margen se calcula sobre el costo GUARDADO EN LA VENTA
      (venta_items.costo_unitario), no sobre el costo actual del
      producto: si el costo de reposición subió después, la utilidad
      histórica no cambia.
   ============================================================ */

/* Trae una tabla completa en páginas de 1000 (límite de PostgREST).
   Solo para las tablas chicas de este endpoint. */
async function intelTraerTodo(tabla, columnas) {
  let filas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.from(tabla).select(columnas).range(desde, desde + 999);
    if (error) throw error;
    filas = filas.concat(data);
    if (data.length < 1000) return filas;
    if (filas.length > 50000) return filas;      // freno duro, no colgar el serverless
  }
}

/* Un producto es "servicio" si está en la categoría web de servicios o
   si tiene stock ilimitado (así se cargan los servicios en este POS).
   No existe `es_servicio` en `productos` — solo en `venta_items`, que
   es la venta ya hecha (ver Pendiente del SNAPSHOT). */
const intelEsServicio = (p) =>
  p.categoria_web === 'Servicios Técnicos' || p.stock_ilimitado === true;

const intelMediana = (valores) => {
  if (!valores.length) return 0;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2;
};

/* Los números de un período de ventas, calculados UNA SOLA VEZ para todo
   el sistema.
   ------------------------------------------------------------
   Lo usan el panel Inteligencia y el Informe Semanal. Está extraído a
   propósito: dos copias de la fórmula del margen son dos números que
   tarde o temprano se contradicen en pantalla, y el que mira no tiene
   cómo saber cuál creer. Si hay que cambiar cómo se calcula el ticket o
   el margen, se cambia acá y cambia en los dos lados.

   `esServicioProbado(item)` lo entrega quien llama: es lo único que
   depende del catálogo (ver intelEsServicio). */
function resumenDeVentas(ventas, itemsPeriodo, esServicioProbado) {
  const ingresos = ventas.reduce((s, v) => s + num(v.total), 0);
  const utilidad = ventas.reduce((s, v) => s + num(v.utilidad), 0);

  const tieneNombre = (v) => {
    const n = (v.cliente || '').trim().toLowerCase();
    return !!n && n !== 'cliente';
  };
  const conCliente = ventas.filter(v => tieneNombre(v) || v.cliente_telefono).length;
  const conTelefono = ventas.filter(v => v.cliente_telefono).length;

  const comprasPorTelefono = new Map();
  ventas.forEach(v => {
    if (!v.cliente_telefono) return;
    comprasPorTelefono.set(v.cliente_telefono, (comprasPorTelefono.get(v.cliente_telefono) || 0) + 1);
  });
  const clientesUnicos = comprasPorTelefono.size;
  const clientesQueRepiten = [...comprasPorTelefono.values()].filter(n => n > 1).length;

  /* Utilidad sin costo detrás: se descuentan los servicios que el sistema
     PUEDE probar que lo son (ahí el costo $0 es correcto, es mano de
     obra). Lo que queda son los casos dudosos de verdad. */
  const utilidadSinCosto = itemsPeriodo
    .filter(it => num(it.costo_unitario) === 0 && !esServicioProbado(it))
    .reduce((s, it) => s + num(it.subtotal), 0);

  return {
    ventas: ventas.length,
    ingresos,
    costo: ventas.reduce((s, v) => s + num(v.costo_total), 0),
    utilidad,
    margenPct: ingresos ? (100 * utilidad) / ingresos : 0,
    utilidadSinCosto,
    utilidadSinCostoPct: utilidad ? (100 * utilidadSinCosto) / utilidad : 0,
    /* Piso del margen: qué quedaría si NADA de lo que se vendió sin costo
       hubiera dejado un peso. El margen real está entre este piso y el
       margen de arriba. */
    margenPisoPct: ingresos ? (100 * (utilidad - utilidadSinCosto)) / ingresos : 0,
    ticket: ventas.length ? ingresos / ventas.length : 0,
    itemsPorVenta: ventas.length ? itemsPeriodo.length / ventas.length : 0,
    sinDte: ventas.filter(v => !v.tipo_dte || v.tipo_dte === 'SIN DTE').length,
    conCliente,
    sinCliente: ventas.length - conCliente,
    conTelefono,
    clientesUnicos,
    clientesQueRepiten,
    recompraPct: clientesUnicos ? (100 * clientesQueRepiten) / clientesUnicos : 0,
    primeraVenta: ventas.length ? ventas[0].fecha : null,
    ultimaVenta: ventas.length ? ventas[ventas.length - 1].fecha : null
  };
}

app.get('/api/pos/inteligencia', auth(true), async (req, res) => {
  const { desde, hasta } = req.query;
  const fechaValida = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if ((desde && !fechaValida(desde)) || (hasta && !fechaValida(hasta))) {
    return enviarError(res, 400, 'desde/hasta deben venir como YYYY-MM-DD.');
  }

  try {
    let consultaVentas = db.from('ventas')
      .select('id, fecha, total, costo_total, utilidad, cliente, cliente_telefono, tipo_dte, metodo_pago, descuento_monto')
      .order('fecha', { ascending: true });
    if (desde) consultaVentas = consultaVentas.gte('fecha', desde);
    if (hasta) consultaVentas = consultaVentas.lte('fecha', hasta);

    const [respVentas, items, productos] = await Promise.all([
      consultaVentas,
      intelTraerTodo('venta_items', 'venta_id, producto_id, nombre, cantidad, costo_unitario, subtotal, es_servicio'),
      // created_at: sin él no se puede medir cuánto tarda un producto en
      // vender por primera vez (ver rotación, más abajo).
      intelTraerTodo('productos', 'id, nombre, sku, costo_unitario, precio_unitario, stock, stock_ilimitado, archivado, es_borrador, categoria_web, subcategoria_web, imagen_urls, descripcion_web, publicado_web, peso_kg, condicion, marca, created_at')
    ]);
    if (respVentas.error) throw respVentas.error;

    const ventas = respVentas.data;
    const idsVenta = new Set(ventas.map(v => v.id));
    const itemsPeriodo = items.filter(it => idsVenta.has(it.venta_id));
    const porId = new Map(productos.map(p => [p.id, p]));
    const activos = productos.filter(p => !p.archivado && !p.es_borrador);

    /* ---------- Resumen del período ---------- */
    /* Servicios que el sistema PUEDE probar que lo son: el ítem venía
       marcado es_servicio, o su producto está en la categoría de
       servicios / con stock ilimitado. Ahí el costo $0 está demostrado. */
    const servicioProbado = (it) => {
      if (it.es_servicio === true) return true;
      const p = it.producto_id != null ? porId.get(it.producto_id) : null;
      return p ? intelEsServicio(p) : false;
    };
    const resumen = resumenDeVentas(ventas, itemsPeriodo, servicioProbado);

    /* ---------- Serie por mes ---------- */
    const mapaMeses = new Map();
    ventas.forEach(v => {
      if (!v.fecha) return;
      const clave = String(v.fecha).slice(0, 7);
      const m = mapaMeses.get(clave) || { mes: clave, ventas: 0, ingresos: 0, utilidad: 0 };
      m.ventas++; m.ingresos += num(v.total); m.utilidad += num(v.utilidad);
      mapaMeses.set(clave, m);
    });
    const meses = [...mapaMeses.values()].sort((a, b) => a.mes.localeCompare(b.mes))
      .map(m => ({ ...m, margenPct: m.ingresos ? (100 * m.utilidad) / m.ingresos : 0, ticket: m.ventas ? m.ingresos / m.ventas : 0 }));

    /* ---------- Agrupado por producto ---------- */
    const mapaProd = new Map();
    itemsPeriodo.forEach(it => {
      const clave = it.producto_id != null ? `p${it.producto_id}` : `n:${it.nombre}`;
      const a = mapaProd.get(clave) || {
        id: it.producto_id != null ? it.producto_id : null, nombre: it.nombre, unidades: 0, ingresos: 0, costo: 0, veces: 0,
        esServicio: it.es_servicio === true
      };
      a.unidades += num(it.cantidad);
      a.ingresos += num(it.subtotal);
      a.costo += num(it.costo_unitario) * num(it.cantidad);
      a.veces++;
      mapaProd.set(clave, a);
    });

    const vendidos = [...mapaProd.values()].map(a => {
      const p = a.id != null ? porId.get(a.id) : null;
      const esServicio = a.esServicio || (p ? intelEsServicio(p) : false);
      return {
        id: a.id,
        nombre: a.nombre,
        unidades: a.unidades,
        ingresos: a.ingresos,
        costo: a.costo,
        veces: a.veces,
        esServicio,
        margen: a.ingresos - a.costo,
        margenPct: a.ingresos ? (100 * (a.ingresos - a.costo)) / a.ingresos : 0,
        stock: p ? num(p.stock) : null,
        categoria: p ? (p.categoria_web || null) : null
      };
    }).sort((x, y) => y.margen - x.margen);

    const margenTotal = vendidos.reduce((s, a) => s + a.margen, 0);
    const acumuladoHasta = (n) => {
      const parcial = vendidos.slice(0, n).reduce((s, a) => s + a.margen, 0);
      return margenTotal ? (100 * parcial) / margenTotal : 0;
    };
    const concentracion = { top5: acumuladoHasta(5), top10: acumuladoHasta(10), top20: acumuladoHasta(20) };

    /* ---------- Cajones (solo productos, sin servicios) ----------
       Rotación = unidades vendidas en el período. Margen = % real de
       la venta. Se compara cada uno contra la MEDIANA del propio
       catálogo vendido, no contra un número fijo inventado: así el
       corte se mueve solo cuando cambia la mezcla de productos. */
    const soloProductos = vendidos.filter(a => !a.esServicio && a.id != null);
    const medianaUnidades = intelMediana(soloProductos.map(a => a.unidades));
    const medianaMargen = intelMediana(soloProductos.map(a => a.margenPct));
    const cajonDe = (a) => {
      const rota = a.unidades >= medianaUnidades;
      const rinde = a.margenPct >= medianaMargen;
      if (rota && rinde) return 'ancla';
      if (rota && !rinde) return 'gancho';
      if (!rota && rinde) return 'joya';
      return 'lastre';
    };
    soloProductos.forEach(a => { a.cajon = cajonDe(a); });
    const cajones = { ancla: [], gancho: [], joya: [], lastre: [] };
    soloProductos.forEach(a => cajones[a.cajon].push(a));

    /* ---------- Capital en stock y capital dormido ---------- */
    const idsVendidosAlgunaVez = new Set(items.map(it => it.producto_id).filter(x => x != null));
    const conStock = activos.filter(p => !p.stock_ilimitado && num(p.stock) > 0);
    const valorDe = (p) => num(p.stock) * num(p.costo_unitario);
    const capital = conStock.reduce((s, p) => s + valorDe(p), 0);
    const dormidos = conStock.filter(p => !idsVendidosAlgunaVez.has(p.id))
      .map(p => ({ id: p.id, nombre: p.nombre, stock: num(p.stock), costo: num(p.costo_unitario), precio: num(p.precio_unitario), valor: valorDe(p), categoria: p.categoria_web || null }))
      .sort((a, b) => b.valor - a.valor);
    const capitalDormido = dormidos.reduce((s, p) => s + p.valor, 0);

    /* ---------- Auditoría de datos del catálogo ---------- */
    const resumido = (p) => ({ id: p.id, nombre: p.nombre, sku: p.sku || null, costo: num(p.costo_unitario), precio: num(p.precio_unitario), stock: num(p.stock) });
    const productosNoServicio = activos.filter(p => !intelEsServicio(p));
    const auditoria = {
      totalActivos: activos.length,
      costoCero: productosNoServicio.filter(p => num(p.costo_unitario) === 0).map(resumido),
      margenNegativo: productosNoServicio.filter(p => num(p.precio_unitario) > 0 && num(p.costo_unitario) > 0 && num(p.precio_unitario) <= num(p.costo_unitario)).map(resumido),
      margenFlaco: productosNoServicio
        .filter(p => num(p.precio_unitario) > 0 && num(p.costo_unitario) > 0 && ((num(p.precio_unitario) - num(p.costo_unitario)) / num(p.precio_unitario)) < 0.15)
        .map(p => Object.assign(resumido(p), { margenPct: (100 * (num(p.precio_unitario) - num(p.costo_unitario))) / num(p.precio_unitario) }))
        .sort((a, b) => a.margenPct - b.margenPct),
      sinSku: activos.filter(p => !p.sku).length,
      sinFoto: activos.filter(p => !Array.isArray(p.imagen_urls) || p.imagen_urls.length === 0).length,
      sinFicha: activos.filter(p => !p.descripcion_web).length,
      sinCategoria: activos.filter(p => !p.categoria_web).length,
      sinPublicar: activos.filter(p => !p.publicado_web).length,
      sinMedidas: productosNoServicio.filter(p => !num(p.peso_kg)).length,
      /* Sin marca (sql/38): solo cuenta los PUBLICADOS, que son los
         que viajan al feed de Meta/Google. Un genérico legítimo (un
         cable, unos tornillos) va a estar acá siempre y está bien — el
         número sirve para encontrar los que sí tienen marca conocida y
         están compitiendo peor de lo que podrían en Google Shopping. */
      sinMarca: productosNoServicio.filter(p => p.publicado_web && !p.marca).length
    };

    /* ---------- Alertas accionables ----------
       Cada alerta dice qué hacer, no solo qué pasa. Se ordenan por
       plata en juego, que es el criterio que le sirve al dueño. */
    const alertas = [];
    if (capital > 0 && capitalDormido / capital > 0.25) {
      alertas.push({ nivel: 'alta', titulo: 'Capital dormido', detalle: `${Math.round((100 * capitalDormido) / capital)}% del capital en stock (${dormidos.length} productos) nunca registró una venta.`, monto: capitalDormido });
    }
    /* Costo $0 en la venta: hay que separar DOS casos que se ven igual
       en los números pero significan cosas distintas.
       (a) Un producto del catálogo (producto_id no nulo) vendido con
           costo 0 → error de datos real, infla la utilidad.
       (b) Un ítem escrito a mano en el POS, que nunca existió como
           producto (producto_id nulo) → no hay costo que cargar porque
           no hay ficha; puede ser un servicio o una venta suelta. No es
           un error a corregir en el catálogo, pero igual deja la
           utilidad sin respaldo, así que se informa aparte. */
    const catalogoSinCosto = vendidos.filter(a => !a.esServicio && a.id != null && a.costo === 0 && a.ingresos > 0);
    if (catalogoSinCosto.length) {
      alertas.push({ nivel: 'alta', titulo: 'Utilidad inflada por costos en $0', detalle: `${catalogoSinCosto.length} producto(s) del catálogo se vendieron con costo $0 cargado: esa utilidad no es real.`, monto: catalogoSinCosto.reduce((s, a) => s + a.ingresos, 0) });
    }
    const sueltosSinCosto = vendidos.filter(a => !a.esServicio && a.id == null && a.costo === 0 && a.ingresos > 0);
    if (sueltosSinCosto.length) {
      alertas.push({ nivel: 'media', titulo: 'Ítems vendidos fuera del catálogo', detalle: `${sueltosSinCosto.length} ítem(s) se cobraron escribiéndolos a mano, sin producto asociado: no tienen costo, así que su utilidad figura al 100% y no se puede medir su rotación.`, monto: sueltosSinCosto.reduce((s, a) => s + a.ingresos, 0) });
    }
    const vendidosAPerdida = vendidos.filter(a => !a.esServicio && a.margen < 0);
    if (vendidosAPerdida.length) {
      alertas.push({ nivel: 'alta', titulo: 'Vendido bajo el costo', detalle: `${vendidosAPerdida.length} producto(s) se vendieron a pérdida en el período.`, monto: Math.abs(vendidosAPerdida.reduce((s, a) => s + a.margen, 0)) });
    }
    if (resumen.ventas && resumen.sinCliente / resumen.ventas > 0.5) {
      alertas.push({ nivel: 'alta', titulo: 'Ventas sin cliente identificado', detalle: `${resumen.sinCliente} de ${resumen.ventas} ventas no tienen nombre de cliente: sin eso no hay recompra, ni postventa, ni fidelización posible.`, monto: 0 });
    }
    if (auditoria.costoCero.length) {
      alertas.push({ nivel: 'media', titulo: 'Productos sin costo cargado', detalle: `${auditoria.costoCero.length} producto(s) del catálogo (sin contar servicios) tienen costo $0: su margen es falso.`, monto: 0 });
    }
    if (auditoria.margenFlaco.length) {
      alertas.push({ nivel: 'media', titulo: 'Margen bajo 15%', detalle: `${auditoria.margenFlaco.length} producto(s) publicados dejan menos del 15% — revisar precio antes de anunciarlos.`, monto: 0 });
    }
    /* Quiebre de stock de algo que SÍ rota: es venta que se está
       perdiendo, no un problema de datos. */
    const quiebres = soloProductos
      .filter(a => a.unidades >= Math.max(2, medianaUnidades) && a.stock === 0)
      .map(a => ({ id: a.id, nombre: a.nombre, unidades: a.unidades, margen: a.margen }))
      .sort((x, y) => y.margen - x.margen);
    if (quiebres.length) {
      alertas.push({ nivel: 'alta', titulo: 'Se agotó algo que sí vende', detalle: `${quiebres.length} producto(s) con rotación por sobre la mediana están en stock 0.`, monto: quiebres.reduce((s, q) => s + q.margen, 0) });
    }
    alertas.sort((a, b) => (a.nivel === b.nivel ? b.monto - a.monto : a.nivel === 'alta' ? -1 : 1));

    /* ============================================================
       TRES MEDIDAS QUE NO NECESITAN QUE NADIE ANOTE NADA
       ------------------------------------------------------------
       Salen de cruzar datos que el sistema YA guarda. Se calculan acá
       a propósito: cualquier medición que dependa de que alguien la
       registre en cada venta termina vacía (el campo de WhatsApp del
       cliente lleva 0 de 171 ventas desde v52 — el dato está, el hábito
       no). Lo que se puede deducir, se deduce.
       ============================================================ */

    /* 1. DÍAS HASTA LA PRIMERA VENTA — cuánto tarda en rotar cada cosa.
       Responde "cuánto capital tengo que tener parado para sostener
       esta venta", que es la pregunta de fondo del crecimiento. */
    const primeraVentaDe = new Map();
    const fechaVentaPorId = new Map(ventas.map(v => [v.id, v.fecha]));
    items.forEach(it => {
      if (it.producto_id == null) return;
      const f = fechaVentaPorId.get(it.venta_id);
      if (!f) return;
      const previa = primeraVentaDe.get(it.producto_id);
      if (!previa || String(f) < String(previa)) primeraVentaDe.set(it.producto_id, f);
    });

    const diasEntre = (desdeISO, hastaISO) =>
      Math.round((new Date(hastaISO) - new Date(desdeISO)) / 86400000);

    const rotaciones = [];
    productos.forEach(p => {
      const f = primeraVentaDe.get(p.id);
      if (!f || !p.created_at) return;
      const d = diasEntre(p.created_at, f);
      // Un producto vendido ANTES de su fecha de alta es un dato sucio
      // (se cargó al catálogo después de venderlo), no una rotación de 0.
      if (d < 0) return;
      rotaciones.push({ id: p.id, nombre: p.nombre, categoria: p.categoria_web || null, dias: d });
    });

    const porCategoriaRot = new Map();
    rotaciones.forEach(r => {
      const c = r.categoria || 'Sin categoría';
      if (!porCategoriaRot.has(c)) porCategoriaRot.set(c, []);
      porCategoriaRot.get(c).push(r.dias);
    });

    const rotacion = {
      medianaDias: intelMediana(rotaciones.map(r => r.dias)),
      medidos: rotaciones.length,
      porCategoria: [...porCategoriaRot.entries()]
        .map(([categoria, dias]) => ({ categoria, productos: dias.length, medianaDias: intelMediana(dias) }))
        .filter(c => c.productos >= 2)          // con 1 dato no hay mediana que valga
        .sort((a, b) => b.medianaDias - a.medianaDias),
      masLentos: rotaciones.sort((a, b) => b.dias - a.dias).slice(0, 10)
    };

    /* 2. CONVERSIÓN DE FICHA A VENTA — quién se mira y no se compra.
       Vive en el Supabase de la TIENDA, así que va en su propio
       try/catch: si esa base no responde, el panel sale igual sin esta
       sección (mismo criterio que las visitas del informe semanal). */
    let conversionFicha = null;
    try {
      let vistasRaw = [];
      for (let saltar = 0; ; saltar += 1000) {
        const { data, error } = await dbWeb.from('eventos_web')
          .select('producto_pos_id').eq('tipo', 'vista_producto')
          .range(saltar, saltar + 999);
        if (error) throw error;
        vistasRaw = vistasRaw.concat(data || []);
        if (!data || data.length < 1000 || vistasRaw.length > 50000) break;
      }

      const vistasPorProducto = new Map();
      vistasRaw.forEach(e => {
        if (e.producto_pos_id == null) return;
        vistasPorProducto.set(e.producto_pos_id, (vistasPorProducto.get(e.producto_pos_id) || 0) + 1);
      });

      const unidadesPorProducto = new Map();
      items.forEach(it => {
        if (it.producto_id == null) return;
        unidadesPorProducto.set(it.producto_id, (unidadesPorProducto.get(it.producto_id) || 0) + num(it.cantidad));
      });

      const medianaVistas = intelMediana([...vistasPorProducto.values()]);
      const filas = [...vistasPorProducto.entries()]
        .map(([id, v]) => {
          const p = porId.get(id);
          const u = unidadesPorProducto.get(id) || 0;
          return {
            id, nombre: p ? p.nombre : '(producto eliminado)',
            vistas: v, unidades: u,
            conversionPct: v ? (100 * u) / v : 0,
            precio: p ? num(p.precio_unitario) : null,
            stock: p ? num(p.stock) : null
          };
        })
        .filter(f => f.vistas >= Math.max(5, medianaVistas / 2));

      conversionFicha = {
        vistasTotales: vistasRaw.length,
        productosConVistas: vistasPorProducto.size,
        medianaVistas,
        /* Lo accionable: MUCHO mirado y CERO vendido. No es falta de
           visibilidad —ya lo están viendo—, es precio, competencia
           interna o clientela equivocada. */
        mirados_sin_vender: filas.filter(f => f.unidades === 0)
          .sort((a, b) => b.vistas - a.vistas).slice(0, 15),
        mejor_convierten: filas.filter(f => f.unidades > 0)
          .sort((a, b) => b.conversionPct - a.conversionPct).slice(0, 10)
      };
    } catch (err) {
      console.warn('[inteligencia] sin datos de vistas de la tienda:', err.message || err);
    }

    /* 3. QUÉ SE COMPRA JUNTO CON QUÉ — la base real de los combos.
       Hoy da poca señal (1,28 ítems por venta), pero crece solo con el
       tiempo y evita tener que inventar los packs a mano. */
    /* La clave es el producto del catálogo cuando existe, y el NOMBRE
       cuando el ítem se escribió a mano en el POS. Contar solo por
       producto_id dejaba el resultado en cero: varias ventas de dos
       ítems tienen al menos uno escrito a mano, y esas también son
       ventas reales. */
    const claveItem = (it) => (it.producto_id != null ? `p${it.producto_id}` : `n:${(it.nombre || '').trim().toLowerCase()}`);
    const nombreDeClave = new Map();
    const itemsPorVenta = new Map();
    itemsPeriodo.forEach(it => {
      const k = claveItem(it);
      if (k === 'n:') return;
      if (!nombreDeClave.has(k)) {
        const p = it.producto_id != null ? porId.get(it.producto_id) : null;
        nombreDeClave.set(k, p ? p.nombre : (it.nombre || '(sin nombre)'));
      }
      if (!itemsPorVenta.has(it.venta_id)) itemsPorVenta.set(it.venta_id, new Set());
      itemsPorVenta.get(it.venta_id).add(k);
    });

    const pares = new Map();
    itemsPorVenta.forEach(conjunto => {
      const claves = [...conjunto].sort();
      for (let i = 0; i < claves.length; i++) {
        for (let j = i + 1; j < claves.length; j++) {
          const par = `${claves[i]}||${claves[j]}`;
          pares.set(par, (pares.get(par) || 0) + 1);
        }
      }
    });

    /* Se devuelve el CONTEXTO además de la lista, no la lista sola.
       Hoy la respuesta honesta es "todavía no hay patrón": 31 ventas de
       dos o más ítems producen 46 combinaciones y ninguna se repite. Una
       sección vacía parecería un error; el contexto dice cuánto falta.
       Ojo con el conteo: hay que contar VENTAS distintas, no filas. Si
       una venta trae dos líneas del mismo producto, un cruce ingenuo
       cuenta el par dos veces y fabrica un patrón que no existe. Por eso
       cada venta aporta un conjunto de claves únicas. */
    const compradosJuntos = {
      ventasConDosOMas: [...itemsPorVenta.values()].filter(s => s.size >= 2).length,
      combinacionesDistintas: pares.size,
      repetidos: [...pares.entries()]
        .map(([par, veces]) => {
          const [a, b] = par.split('||');
          return { veces, a: nombreDeClave.get(a) || a, b: nombreDeClave.get(b) || b };
        })
        .filter(p => p.veces >= 2)
        .sort((x, y) => y.veces - x.veces)
        .slice(0, 15)
    };

    res.json({
      periodo: { desde: desde || null, hasta: hasta || null },
      resumen,
      meses,
      productos: vendidos.slice(0, 60),
      concentracion,
      rotacion,
      conversionFicha,
      compradosJuntos,
      cortes: { medianaUnidades, medianaMargen },
      cajones: {
        ancla: cajones.ancla.sort((a, b) => b.margen - a.margen).slice(0, 15),
        gancho: cajones.gancho.sort((a, b) => b.unidades - a.unidades).slice(0, 15),
        joya: cajones.joya.sort((a, b) => b.margenPct - a.margenPct).slice(0, 15),
        lastre: cajones.lastre.sort((a, b) => b.ingresos - a.ingresos).slice(0, 15),
        conteo: { ancla: cajones.ancla.length, gancho: cajones.gancho.length, joya: cajones.joya.length, lastre: cajones.lastre.length }
      },
      stock: { capital, capitalDormido, productosConStock: conStock.length, productosDormidos: dormidos.length, dormidos: dormidos.slice(0, 20) },
      auditoria,
      quiebres: quiebres.slice(0, 10),
      alertas
    });
  } catch (error) {
    return enviarErrorBD(res, error, 'GET /api/pos/inteligencia');
  }
});

/* ============================================================
   GET /api/pos/feed-catalogo — Página Web → Feed de catálogo
   ------------------------------------------------------------
   Genera el archivo que comen Meta Commerce Manager (catálogo de
   Facebook/Instagram) y Google Merchant Center, con los productos que ya
   están publicados en la tienda.

   POR QUÉ EXISTE
   Hoy cada publicación de Facebook Marketplace se escribe a mano, una por
   una, y ese es el canal que produce prácticamente toda la venta de
   Sevelin (ver docs/PLAN-CRECIMIENTO-2026.md, Fase 3). El catálogo real ya
   vive en el POS: este endpoint lo entrega en el formato que las dos
   plataformas aceptan, para dejar de tipear lo mismo dos veces.

   DE DÓNDE SALEN LOS DATOS
   De `productos_web` (Supabase Web, cliente `dbWeb`), no de `productos`,
   porque ahí está el `sku` YA RESUELTO que forma la URL real de la ficha
   —incluido el slug de respaldo que la tienda genera para los productos
   sin SKU—. Recalcular esa URL acá sería una segunda fuente de verdad que
   tarde o temprano se desincroniza. Lo único que se busca en el POS es
   `condicion` (nuevo/reacondicionado), que el trigger de sincronización no
   manda a la tienda.

   QUÉ SE OMITE Y POR QUÉ SE INFORMA
   Meta y Google rechazan filas sin foto, sin precio o sin link, y una
   subida rechazada no dice cuál producto falló de forma útil. Por eso el
   endpoint devuelve, junto al archivo, la lista de lo que dejó fuera con
   el motivo: es la misma auditoría del panel Inteligencia, pero mirada
   desde "qué me falta para poder publicar".
   ============================================================ */

/* Una celda de CSV. Se citan SIEMPRE los textos: los nombres de producto
   traen comas, comillas y saltos de línea, y una sola celda mal escapada
   corre todas las columnas de esa fila. */
function celdaCsv(valor) {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

/* Descripción en texto plano para el feed.
   Las fichas se guardan como HTML (editor Quill), y ni Meta ni Google
   aceptan marcado. No se INVENTA descripción cuando falta: se arma una
   línea mínima con datos que ya existen (nombre y categoría), porque el
   campo es obligatorio y dejarlo vacío hace que la plataforma rechace el
   producto entero. */
function descripcionParaFeed(fila) {
  const plano = String(fila.descripcion_web || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6])>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
  if (plano) return plano.slice(0, 4900);
  const categoria = fila.categoria ? ` — ${fila.categoria}` : '';
  return `${fila.nombre}${categoria}. Disponible en Sevelin, Arica.`;
}

/* La generación del feed vive en UNA función, no en el handler.
   ------------------------------------------------------------
   La usan dos endpoints: el del panel (descarga manual del admin) y el
   público que Google Merchant Center lee solo. Está extraída a propósito,
   mismo criterio que `resumenDeVentas()` en v57: dos copias de las reglas
   de omisión son dos catálogos distintos según por dónde se mire, y quien
   sube el feed no tiene cómo saber cuál de los dos creer.
   Devuelve el CSV SIN BOM — cada endpoint decide si lo necesita (ver la
   nota del BOM en cada uno, no es un detalle cosmético). */
async function construirFeedCatalogo() {
  const sitio = (process.env.TIENDA_URL_PUBLICA || 'https://www.sevelin.cl').replace(/\/+$/, '');

  {
    const [respWeb, respPos] = await Promise.all([
      dbWeb.from('productos_web')
        .select('producto_pos_id, sku, nombre, descripcion_web, precio_web, stock_web, imagen_urls, categoria, subcategoria, publicado_web, es_pedido_encargo')
        .eq('publicado_web', true),
      db.from('productos').select('id, condicion, marca, archivado, es_borrador')
    ]);
    if (respWeb.error) throw respWeb.error;
    if (respPos.error) throw respPos.error;

    const posPorId = new Map(respPos.data.map(p => [p.id, p]));

    const COLUMNAS = [
      'id', 'title', 'description', 'availability', 'condition', 'price',
      'link', 'image_link', 'additional_image_link', 'brand', 'product_type',
      'quantity_to_sell_on_facebook', 'identifier_exists'
    ];

    const filas = [];
    const omitidos = [];

    for (const p of respWeb.data) {
      const posible = posPorId.get(p.producto_pos_id);
      // Un producto archivado o en borrador no debería estar publicado,
      // pero si quedó así, no se manda a anunciar.
      if (posible && (posible.archivado || posible.es_borrador)) {
        omitidos.push({ sku: p.sku, nombre: p.nombre, motivo: 'archivado o en borrador en el POS' });
        continue;
      }
      /* Los SERVICIOS no van a un catálogo de compras.
         Google Merchant Center es para productos FÍSICOS: un formateo o un
         diagnóstico no es elegible para Shopping, y mandarlo igual no lo
         publica —lo desaprueba, y las desaprobaciones acumuladas bajan la
         calidad de toda la cuenta—. El taller se promociona por otras vías
         (publicación normal, ficha del sitio, Google Business), no por acá.
         Se filtra por CATEGORÍA y no por `stock_ilimitado`, porque ese campo
         también lo usan productos físicos sin control de stock exacto
         (rollos térmicos, disipador) que SÍ deben ir al feed — mismo criterio
         que el checkbox "es servicio" del POS. */
      if (p.categoria === 'Servicios Técnicos') {
        omitidos.push({ sku: p.sku, nombre: p.nombre, motivo: 'es un servicio: Google Merchant Center solo acepta productos físicos' });
        continue;
      }
      const imagenes = Array.isArray(p.imagen_urls) ? p.imagen_urls.filter(Boolean) : [];
      if (!imagenes.length) {
        omitidos.push({ sku: p.sku, nombre: p.nombre, motivo: 'sin foto (Meta y Google rechazan productos sin imagen)' });
        continue;
      }
      if (!num(p.precio_web)) {
        omitidos.push({ sku: p.sku, nombre: p.nombre, motivo: 'sin precio' });
        continue;
      }

      /* Disponibilidad. Un pedido por encargo no tiene stock propio y no
         por eso está agotado: se declara como pedido especial, que es lo
         que las dos plataformas entienden por "in stock" con demora. */
      const hayStock = p.es_pedido_encargo || num(p.stock_web) > 0;
      const marcaProducto = posible && posible.marca ? String(posible.marca).trim() : '';

      /* SIN STOCK NO PUEDE IR AL FEED, aunque Meta y Google acepten
         "out of stock" como valor válido.
         Motivo real, verificado el 07-09-2026 contra producción: la
         tienda devuelve **404** en la ficha de un producto con
         `stock_web = 0` que no sea pedido por encargo (ver
         `obtenerProductoPorSku()` en sevelin-tienda/src/lib/catalogo.ts,
         que filtra por `stock_web.gt.0`). Un feed con links rotos no es
         un producto que no se vende: es un catálogo que la plataforma
         rechaza entero y que baja la calidad de la cuenta.
         Si algún día la tienda sirve las fichas agotadas (mejor para SEO,
         pero es una decisión de negocio), acá basta con dejar pasar la
         fila con `availability: out of stock`. */
      if (!hayStock) {
        omitidos.push({ sku: p.sku, nombre: p.nombre, motivo: 'sin stock: su ficha devuelve 404 en la tienda, el link del feed quedaría roto' });
        continue;
      }

      /* EL `id` NO PUEDE PASAR DE 50 CARACTERES.
         Verificado contra Google el 09-09-2026 en la primera lectura real
         del feed: "Valor demasiado largo en el atributo: id — 49 productos
         afectados", o sea la MITAD del catálogo quedaba fuera. Los SKU de
         respaldo que genera la tienda son slugs del nombre completo
         ("fuente-de-poder-650w-certificada-80-bronce-msi-mag-a650bn-atx-1tcuz",
         67 caracteres) y se pasan del límite.
         El `id` del feed no tiene por qué ser el SKU: basta con que sea
         único y ESTABLE. Se cambia solo cuando hace falta —los que ya caben
         conservan el suyo— porque cambiarle el id a un producto que Google
         ya aceptó lo vuelve un producto nuevo y deja el viejo duplicado
         hasta que expira. El respaldo por hash cubre el caso raro de una
         fila de la tienda sin `producto_pos_id`, donde truncar el slug sí
         podría chocar con otro que comparta los primeros 50 caracteres.
         El `link` NO se toca: ahí va el SKU completo, que es la URL real. */
      const skuTexto = String(p.sku || '');
      const idFeed = skuTexto.length <= 50
        ? skuTexto
        : (p.producto_pos_id
          ? `sev-${p.producto_pos_id}`
          : `sku-${crypto.createHash('sha1').update(skuTexto).digest('hex').slice(0, 16)}`);

      filas.push({
        id: idFeed,
        title: String(p.nombre || '').slice(0, 150),
        description: descripcionParaFeed(p),
        availability: hayStock ? 'in stock' : 'out of stock',
        condition: posible && posible.condicion === 'reacondicionado' ? 'refurbished' : 'new',
        price: `${Math.round(num(p.precio_web))} CLP`,
        link: `${sitio}/productos/${encodeURIComponent(p.sku)}`,
        image_link: imagenes[0],
        // Meta acepta hasta 20 adicionales separadas por coma.
        additional_image_link: imagenes.slice(1, 21).join(','),
        /* MARCA (sql/38). Meta y Google exigen `brand`, así que cuando el
           producto no tiene marca cargada se manda el nombre de la tienda
           —lo que hace cualquier retailer con productos genéricos— y no
           una marca inventada, que sí haría que Google penalice la cuenta.
           Un cable sin marca ES genérico: "Sevelin" ahí es honesto.
           `identifier_exists=no` porque no hay GTIN ni MPN en el catálogo;
           sin eso Google rechaza las filas de marca conocida sin código. */
        brand: (marcaProducto || 'Sevelin'),
        product_type: [p.categoria, p.subcategoria].filter(Boolean).join(' > '),
        quantity_to_sell_on_facebook: p.es_pedido_encargo ? '' : Math.max(0, Math.round(num(p.stock_web))),
        identifier_exists: 'no'
      });
    }

    const csv = [COLUMNAS.join(',')]
      .concat(filas.map(f => COLUMNAS.map(c => celdaCsv(f[c])).join(',')))
      .join('\r\n');

    return { csv, total: filas.length, publicados: respWeb.data.length, omitidos };
  }
}

app.get('/api/pos/feed-catalogo', auth(true), async (req, res) => {
  try {
    const feed = await construirFeedCatalogo();
    res.json({
      nombre: `catalogo-sevelin-${fechaHoyChile()}.csv`,
      // BOM incluido: sin él, Excel abre el archivo con los acentos rotos.
      // Acá SÍ va, porque este archivo lo abre una persona en Excel.
      csv: '﻿' + feed.csv,
      total: feed.total,
      publicados: feed.publicados,
      omitidos: feed.omitidos
    });
  } catch (error) {
    return enviarErrorBD(res, error, 'GET /api/pos/feed-catalogo');
  }
});

/* ============================================================
   GET /api/feed/catalogo.csv?token=… — el MISMO feed, para que Google
   Merchant Center (y Meta) lo lean SOLOS, todos los días.
   ------------------------------------------------------------
   POR QUÉ EXISTE, y por qué no bastaba el endpoint de arriba
   El de arriba exige un JWT de admin: sirve para que una persona baje el
   archivo y lo suba a mano. Eso ya se demostró que no se sostiene —
   hallazgo del 09-09-2026: los 19 productos que quedaban en Merchant
   Center venían TODOS de la integración vieja de Tiendanube, y el
   catálogo real de sevelin.cl nunca llegó a Google. Un feed que depende
   de que alguien se acuerde de subirlo es un feed que queda viejo.
   Con esta URL, Merchant Center la busca por su cuenta cada día.

   POR QUÉ ES SEGURO EXPONERLO
   El feed no lleva NADA que no esté ya publicado en la tienda: sku,
   nombre, descripción, precio, stock, fotos, marca y categoría. Ni costo,
   ni margen, ni utilidad, ni datos de clientes (esos ni siquiera se
   consultan acá). Aun así va con token: evita que quede indexable y que
   un competidor se baje el catálogo entero de un solo GET.

   EL BOM NO VA ACÁ, Y ES IMPORTANTE
   Excel necesita el BOM para no romper los acentos, pero un robot que lee
   el CSV lo toma como parte del nombre de la primera columna: leería
   "﻿id" en vez de "id" y rechazaría el feed COMPLETO por no
   encontrar la columna obligatoria. Por eso `construirFeedCatalogo()`
   devuelve el CSV limpio y el BOM se agrega solo en el endpoint del panel.

   `Cache-Control` de 30 minutos: Google pasa una vez al día y el stock no
   cambia al segundo. Además es el freno barato si el token se filtrara —
   el CDN de Vercel responde sin volver a golpear las dos bases.
   ============================================================ */
app.get('/api/feed/catalogo.csv', async (req, res) => {
  const tokenReal = process.env.FEED_TOKEN;
  if (!tokenReal) {
    return enviarError(res, 503, 'El feed público no está configurado (falta FEED_TOKEN en el servidor).');
  }
  if (!secretosIguales(req.query.token, tokenReal)) {
    return enviarError(res, 401, 'Token de feed inválido');
  }

  try {
    const feed = await construirFeedCatalogo();
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=1800');
    res.send(feed.csv);
  } catch (error) {
    return enviarErrorBD(res, error, 'GET /api/feed/catalogo.csv');
  }
});

/* ============================================================
   GET /api/pos/informe-semanal — Finanzas → 📅 Semanal
   ------------------------------------------------------------
   Los 5 números del lunes, ya comparados con la semana anterior, más las
   alertas que hay que mirar. Es la Fase 7 del plan de crecimiento: lo
   que hace que el panel Inteligencia se USE en vez de quedar esperando
   a que alguien se acuerde de abrirlo.

   POR QUÉ EL TEXTO SE ARMA EN EL SERVIDOR
   El informe se lee en pantalla, pero también se copia y se manda por
   WhatsApp. Si el texto se redactara en el navegador, tarde o temprano
   la pantalla y el mensaje dirían cosas distintas. Una sola redacción,
   acá, y el navegador solo la muestra.

   LOS NÚMEROS TAMPOCO SE RECALCULAN: usa resumenDeVentas(), la misma
   función que alimenta el panel Inteligencia. Dos fórmulas del mismo
   margen es como dos pantallas terminan contradiciéndose.
   ============================================================ */

/* Lunes de la semana que contiene `fechaISO` (semana lun–dom, que es
   como se cuenta una semana comercial en Chile). Se opera sobre la
   fecha pura a mediodía UTC para que el cambio de día en Chile no corra
   el resultado. */
function lunesDeLaSemana(fechaISO) {
  const d = new Date(`${fechaISO}T12:00:00Z`);
  const diaSemana = (d.getUTCDay() + 6) % 7;          // 0 = lunes
  d.setUTCDate(d.getUTCDate() - diaSemana);
  return d.toISOString().slice(0, 10);
}

function sumarDias(fechaISO, n) {
  const d = new Date(`${fechaISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

app.get('/api/pos/informe-semanal', auth(true), async (req, res) => {
  const fechaValida = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (req.query.semana && !fechaValida(req.query.semana)) {
    return enviarError(res, 400, 'semana debe venir como YYYY-MM-DD.');
  }

  /* Por defecto, la SEMANA PASADA completa: el informe se lee el lunes y
     una semana a medias no se puede comparar con una entera. Con
     ?semana= se puede pedir cualquier otra (incluida la en curso). */
  const hoy = fechaHoyChile();
  const base = req.query.semana || sumarDias(lunesDeLaSemana(hoy), -1);
  const desde = lunesDeLaSemana(base);
  const hasta = sumarDias(desde, 6);
  const desdePrevia = sumarDias(desde, -7);
  const hastaPrevia = sumarDias(desde, -1);

  try {
    const [respVentas, items, productos] = await Promise.all([
      db.from('ventas')
        .select('id, fecha, total, costo_total, utilidad, cliente, cliente_telefono, tipo_dte')
        .gte('fecha', desdePrevia).lte('fecha', hasta).order('fecha', { ascending: true }),
      intelTraerTodo('venta_items', 'venta_id, producto_id, nombre, cantidad, costo_unitario, subtotal, es_servicio'),
      intelTraerTodo('productos', 'id, nombre, stock, stock_ilimitado, categoria_web, archivado, es_borrador')
    ]);
    if (respVentas.error) throw respVentas.error;

    const porId = new Map(productos.map(p => [p.id, p]));
    const servicioProbado = (it) => {
      if (it.es_servicio === true) return true;
      const p = it.producto_id != null ? porId.get(it.producto_id) : null;
      return p ? intelEsServicio(p) : false;
    };

    const enRango = (d, h) => respVentas.data.filter(v => v.fecha >= d && v.fecha <= h);
    const itemsDe = (ventas) => {
      const ids = new Set(ventas.map(v => v.id));
      return items.filter(it => ids.has(it.venta_id));
    };

    const ventasSemana = enRango(desde, hasta);
    const ventasPrevia = enRango(desdePrevia, hastaPrevia);
    const itemsSemana = itemsDe(ventasSemana);
    const actual = resumenDeVentas(ventasSemana, itemsSemana, servicioProbado);
    const previa = resumenDeVentas(ventasPrevia, itemsDe(ventasPrevia), servicioProbado);

    /* Variación porcentual. Cuando la semana anterior fue 0 no existe
       "cuánto subió": se devuelve null y la pantalla escribe "sin
       comparación" en vez de un ∞ o un 100% inventado. */
    const variacion = (ahora, antes) => (antes ? ((ahora - antes) / antes) * 100 : null);
    const cambios = {
      ingresos: variacion(actual.ingresos, previa.ingresos),
      utilidad: variacion(actual.utilidad, previa.utilidad),
      ventas: variacion(actual.ventas, previa.ventas),
      ticket: variacion(actual.ticket, previa.ticket),
      margenPuntos: actual.margenPct - previa.margenPct     // margen se compara en PUNTOS, no en %
    };

    /* ---------- Top 3 de la semana, por margen generado ---------- */
    const agg = new Map();
    itemsSemana.forEach(it => {
      const clave = it.producto_id != null ? `p${it.producto_id}` : `n:${it.nombre}`;
      const a = agg.get(clave) || { nombre: it.nombre, unidades: 0, ingresos: 0, costo: 0 };
      a.unidades += num(it.cantidad);
      a.ingresos += num(it.subtotal);
      a.costo += num(it.costo_unitario) * num(it.cantidad);
      agg.set(clave, a);
    });
    const top = [...agg.values()]
      .map(a => ({ ...a, margen: a.ingresos - a.costo }))
      .sort((x, y) => y.margen - x.margen)
      .slice(0, 3);

    /* ---------- La tienda web ---------- */
    let web = null;
    try {
      const rangoUTC = (d, h) => [marcaDeTiempoChile(d, '00:00'), marcaDeTiempoChile(h, '23:59:59')];
      const [d1, h1] = rangoUTC(desde, hasta);
      const [d0, h0] = rangoUTC(desdePrevia, hastaPrevia);
      const contar = (tabla, desdeISO, hastaISO, filtro) => {
        let q = dbWeb.from(tabla).select('*', { count: 'exact', head: true })
          .gte('creado_en', desdeISO).lte('creado_en', hastaISO);
        if (filtro) q = filtro(q);
        return q;
      };
      const [visitas, visitasAntes, pedidos, pedidosAntes] = await Promise.all([
        contar('eventos_web', d1, h1, q => q.eq('tipo', 'visita')),
        contar('eventos_web', d0, h0, q => q.eq('tipo', 'visita')),
        contar('pedidos_web', d1, h1),
        contar('pedidos_web', d0, h0)
      ]);
      web = {
        visitas: visitas.count || 0,
        visitasPrevia: visitasAntes.count || 0,
        pedidos: pedidos.count || 0,
        pedidosPrevia: pedidosAntes.count || 0
      };
    } catch (errWeb) {
      /* La tienda es un SEGUNDO Supabase: si no responde, el informe del
         POS igual sale. Perder las visitas no puede dejar sin números al
         negocio principal. */
      console.warn('[POS] informe-semanal: no se pudo leer la tienda —', errWeb?.message || errWeb);
    }

    /* ---------- Alertas de la semana ---------- */
    const alertas = [];
    const vendidosSemana = new Set(itemsSemana.map(it => it.producto_id).filter(x => x != null));
    const quiebres = productos.filter(p =>
      !p.archivado && !p.es_borrador && !p.stock_ilimitado && num(p.stock) <= 0 && vendidosSemana.has(p.id));
    if (quiebres.length) {
      alertas.push({
        nivel: 'alta',
        texto: `${quiebres.length} producto(s) que vendiste esta semana quedaron en stock 0: ${quiebres.slice(0, 3).map(p => p.nombre).join(', ')}${quiebres.length > 3 ? '…' : ''}`
      });
    }
    const sinCostoSemana = itemsSemana.filter(it => num(it.costo_unitario) === 0 && !servicioProbado(it));
    if (sinCostoSemana.length) {
      alertas.push({
        nivel: 'media',
        texto: `${sinCostoSemana.length} ítem(s) se vendieron sin costo cargado: esa utilidad no es real.`
      });
    }
    if (actual.ventas && actual.sinCliente === actual.ventas) {
      alertas.push({ nivel: 'media', texto: 'Ninguna venta de la semana quedó con cliente registrado: sin eso no hay postventa ni recompra.' });
    }

    /* Garantías que vencen en los próximos 30 días: es el aviso que hay
       que mandar ESTA semana, no el mes que viene. */
    try {
      const { data: itemsGar } = await db.from('venta_items')
        .select('venta_id, meses_garantia, aviso_garantia_en').eq('es_servicio', false).limit(5000);
      const idsG = [...new Set((itemsGar || []).map(i => i.venta_id).filter(Boolean))];
      const fechasVenta = new Map();
      if (idsG.length) {
        const { data: vs } = await db.from('ventas').select('id, fecha').in('id', idsG);
        (vs || []).forEach(v => fechasVenta.set(v.id, v.fecha));
      }
      const porVencer = (itemsGar || []).filter(it => {
        if (it.aviso_garantia_en) return false;
        const { vence_el, estado_garantia } = calcularEstadoGarantia(fechasVenta.get(it.venta_id), it.meses_garantia);
        return vence_el && estado_garantia === 'VIGENTE' && diasHastaFecha(vence_el) <= 30;
      }).length;
      if (porVencer) {
        alertas.push({ nivel: 'alta', texto: `${porVencer} garantía(s) vencen en los próximos 30 días y no se ha avisado. Ver Garantías → Por vencer.` });
      }
    } catch (errG) {
      console.warn('[POS] informe-semanal: no se pudieron revisar las garantías —', errG?.message || errG);
    }

    /* ---------- El texto para copiar y mandar ---------- */
    const clp = (n) => '$' + Math.round(n || 0).toLocaleString('es-CL');
    const flecha = (v) => v === null ? '' : v > 0.5 ? ` ▲${v.toFixed(0)}%` : v < -0.5 ? ` ▼${Math.abs(v).toFixed(0)}%` : ' =';
    const lineas = [
      `SEVELIN · semana del ${desde} al ${hasta}`,
      '',
      `Ventas:   ${actual.ventas}${flecha(cambios.ventas)}`,
      `Facturado: ${clp(actual.ingresos)}${flecha(cambios.ingresos)}`,
      `Utilidad:  ${clp(actual.utilidad)}${flecha(cambios.utilidad)}  (margen ${actual.margenPct.toFixed(1)}%${cambios.margenPuntos ? `, ${cambios.margenPuntos > 0 ? '+' : ''}${cambios.margenPuntos.toFixed(1)} pts` : ''})`,
      `Ticket:    ${clp(actual.ticket)}${flecha(cambios.ticket)}`,
      `Productos por venta: ${actual.itemsPorVenta.toFixed(2)}`
    ];
    if (web) lineas.push(`Web: ${web.visitas} visitas · ${web.pedidos} pedido(s)`);
    if (top.length) {
      lineas.push('', 'Lo que más margen dejó:');
      top.forEach((t, i) => lineas.push(`  ${i + 1}. ${t.nombre} — ${clp(t.margen)} (${t.unidades} u.)`));
    }
    if (alertas.length) {
      lineas.push('', 'Ojo con esto:');
      alertas.forEach(a => lineas.push(`  ${a.nivel === 'alta' ? '!' : '-'} ${a.texto}`));
    }

    res.json({
      periodo: { desde, hasta },
      periodoPrevio: { desde: desdePrevia, hasta: hastaPrevia },
      esSemanaEnCurso: hasta >= hoy,
      actual,
      previa,
      cambios,
      top,
      web,
      alertas,
      texto: lineas.join('\n')
    });
  } catch (error) {
    return enviarErrorBD(res, error, 'GET /api/pos/informe-semanal');
  }
});

/* ---------- 404 y errores ---------- */
app.use('/api', (_req, res) => enviarError(res, 404, 'Endpoint no encontrado'));
app.use((err, _req, res, _next) => {
  console.error('[POS] Error no controlado:', err.message, err.stack);
  if (res.locals) res.locals.detalleError = `Error no controlado: ${err.message}`;
  enviarError(res, 500, 'Error interno del servidor');
});

/* Vercel importa el app; en local se levanta con `npm run dev` */
module.exports = app;

if (require.main === module) {
  const puerto = process.env.PORT || 3000;
  app.listen(puerto, () => console.log(`API POS escuchando en http://localhost:${puerto}`));
}
