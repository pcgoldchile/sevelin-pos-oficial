/* ============================================================
   CONFIG.JS - Utilidades globales y arranque de la interfaz
   ------------------------------------------------------------
   IMPORTANTE: aquí ya NO hay URL ni llaves de Supabase. Toda la
   comunicación con la base de datos pasa por el backend (api.js →
   /api/...), que es el único que conoce las credenciales.
   ============================================================ */

var NEGOCIO_NOMBRE = 'Sevelin'; // el backend puede sobrescribirlo al iniciar sesión

/* ============================================================
   COMISIÓN DEL POS TUU (HAULMER PRO 2)
   ------------------------------------------------------------
   Fórmula:  monto * 0,0079 + 65,  solo en pagos con tarjeta.

   OJO: esto es un ESPEJO de la fórmula del backend (api/index.js). El
   número que vale es el que guardó el servidor en ventas.comision_pos;
   estas funciones sirven para previsualizar en pantalla y para calcular
   ventas antiguas que se registraron antes de la migración 09 (donde la
   columna viene en 0). Si cambias la tarifa, cámbiala en LOS DOS lados.
   ============================================================ */
const COMISION_POS_TASA = 0.0079;
const COMISION_POS_FIJO = 65;
const METODOS_CON_COMISION = ['Tarjeta Débito', 'Tarjeta Crédito'];

function metodoPagaComision(metodo) {
  return METODOS_CON_COMISION.includes(String(metodo || '').trim());
}

function calcularComisionPos(metodo, total) {
  if (!metodoPagaComision(metodo)) return 0;
  const monto = Number(total) || 0;
  if (monto <= 0) return 0;
  return Math.round(monto * COMISION_POS_TASA + COMISION_POS_FIJO);
}

/* Comisión de una venta ya registrada.
   Prioriza el valor guardado por el servidor; si la venta es anterior a la
   migración 09 (columna ausente o en 0 con método de tarjeta), la calcula
   al vuelo para que los informes históricos no queden incompletos. */
function comisionDeVenta(venta) {
  if (!venta) return 0;
  const guardada = Number(venta.comision_pos);
  if (Number.isFinite(guardada) && guardada > 0) return guardada;

  const metodo = venta.metodo_pago_final || venta.metodo_pago;
  const pendiente = venta.estado === 'PENDIENTE';
  if (pendiente) return 0;
  return calcularComisionPos(metodo, venta.total);
}

function setSyncBadge(type, msg) {
  const el = document.getElementById('syncBadge');
  if (el) {
    el.className = 'sync-badge sync-' + type;
    el.textContent = msg;
  }
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function fmtCLP(v) {
  v = Number(v) || 0;
  return '$' + v.toLocaleString('es-CL', { maximumFractionDigits: 0 });
}

/* ------------------------------------------------------------
   FECHAS Y HORAS EN ZONA HORARIA DE CHILE (America/Santiago)
   ------------------------------------------------------------
   El servidor de Vercel trabaja en UTC y el navegador usa la zona del
   equipo, así que todo lo que se guarda, imprime o reporta se calcula
   explícitamente sobre America/Santiago (UTC-4 / UTC-3 en verano).
   ------------------------------------------------------------ */
const ZONA_CHILE = 'America/Santiago';

const _fmtChile = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_CHILE,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
});

/* Devuelve {anio, mes, dia, hora, minuto, segundo} de una fecha en Chile */
function partesChile(fecha = new Date()) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const partes = {};
  _fmtChile.formatToParts(d).forEach(p => { if (p.type !== 'literal') partes[p.type] = p.value; });
  return {
    anio: partes.year,
    mes: partes.month,
    dia: partes.day,
    hora: partes.hour === '24' ? '00' : partes.hour,
    minuto: partes.minute,
    segundo: partes.second
  };
}

/* YYYY-MM-DD a partir de los componentes locales de una fecha ya construida
   (se usa para rangos de período y fechas importadas desde archivos). */
function isoLocal(date) {
  const d = date instanceof Date ? date : new Date(date);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/* Fecha de hoy en Chile (YYYY-MM-DD) */
function todayISO() {
  const p = partesChile();
  return `${p.anio}-${p.mes}-${p.dia}`;
}

/* Objeto Date posicionado en el día de hoy en Chile, al mediodía, para poder
   usar getDay()/getMonth() sin riesgo de saltar de día por la zona horaria. */
function fechaChile() {
  const p = partesChile();
  return new Date(Number(p.anio), Number(p.mes) - 1, Number(p.dia), 12, 0, 0);
}

/* Hora actual en Chile en formato 24 h ("19:14") */
function horaActualCorta() {
  const p = partesChile();
  return `${p.hora}:${p.minuto}`;
}

/* "02-08-2026 19:14" — para el pie del ticket y los comprobantes */
function fechaHoraChile(fecha = new Date()) {
  const p = partesChile(fecha);
  return `${p.dia}-${p.mes}-${p.anio} ${p.hora}:${p.minuto}`;
}

/* "2026-08-02 19:14" — para encabezados de reportes y tablas */
function fechaHoraISOChile(fecha = new Date()) {
  const p = partesChile(fecha);
  return `${p.anio}-${p.mes}-${p.dia} ${p.hora}:${p.minuto}`;
}

/* Convierte un timestamp de la base de datos (UTC) a hora de Chile */
function tsAChile(valor, conHora = true) {
  if (!valor) return '';
  const d = new Date(valor);
  if (isNaN(d.getTime())) return String(valor);
  return conHora ? fechaHoraISOChile(d) : fechaHoraISOChile(d).slice(0, 10);
}

/* ---------- Tema claro / oscuro ---------- */
function aplicarTema(tema) {
  const esClaro = tema === 'light';
  document.body.classList.toggle('theme-light', esClaro);
  const btn = document.getElementById('btnTema');
  if (btn) {
    btn.textContent = esClaro ? '☀️' : '🌙';
    btn.title = esClaro ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro';
  }
  localStorage.setItem('sevelin_tema', esClaro ? 'light' : 'dark');
}

function initTema() {
  aplicarTema(localStorage.getItem('sevelin_tema') || 'dark');
  const btn = document.getElementById('btnTema');
  if (btn) btn.addEventListener('click', () => {
    aplicarTema(document.body.classList.contains('theme-light') ? 'dark' : 'light');
  });
}

/* ---------- Comprobación del backend ---------- */
async function verificarBackend() {
  try {
    const res = await fetch(API.base + '/health');
    if (!res.ok) throw new Error();
    setSyncBadge('ok', '🟢 Servidor conectado');
  } catch (_) {
    setSyncBadge('bad', '🔴 Sin conexión al servidor');
  }
}

/* ---------- Navegación entre vistas ---------- */
function initNavegacion() {
  document.querySelectorAll('.nav-links .nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const viewId = btn.getAttribute('data-view');
      const targetView = document.getElementById(viewId);
      if (!targetView) return;

      // Un trabajador no puede abrir vistas marcadas como admin-only
      if (targetView.classList.contains('admin-only') && !esAdmin()) {
        showToast('Solo el administrador puede ver esta sección', 'err');
        return;
      }

      document.querySelectorAll('.nav-links .nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));

      btn.classList.add('active');
      targetView.classList.add('active');

      if (viewId === 'view-historial' && typeof cargarHistorial === 'function') cargarHistorial();
      if (viewId === 'view-productos' && typeof cargarProductos === 'function') cargarProductos();
      if (viewId === 'view-compras' && typeof cargarCompras === 'function') cargarCompras();
      if (viewId === 'view-taller' && typeof cargarOrdenes === 'function') cargarOrdenes();
      if (viewId === 'view-encargos' && typeof cargarEncargos === 'function') cargarEncargos();
      if (viewId === 'view-repuestos' && typeof cargarRepuestos === 'function') cargarRepuestos();

      // Aviso para los módulos que necesitan reaccionar (p. ej. foco del lector en POS)
      document.dispatchEvent(new CustomEvent('pos:vista-activa', { detail: { vista: viewId } }));
    });
  });
}

/* ------------------------------------------------------------
   BARRA FLOTANTE DE SELECCIÓN
   La comparten el Historial de Ventas y el módulo de Compras: cada uno
   le pasa cuántas filas tiene marcadas y qué hacer con cada botón.
   ------------------------------------------------------------ */
function mostrarBarraSeleccion(cantidad, acciones = {}) {
  const barra = document.getElementById('barraSeleccion');
  if (!barra) return;

  if (!cantidad) { ocultarBarraSeleccion(); return; }

  const texto = document.getElementById('barraSeleccionTexto');
  if (texto) texto.textContent = `${cantidad} ${cantidad === 1 ? 'registro seleccionado' : 'registros seleccionados'}`;

  const btnJSON = document.getElementById('btnDescargarJSON');
  const btnCSV = document.getElementById('btnDescargarCSV');
  const btnEliminar = document.getElementById('btnEliminarSeleccionadas');
  const btnLimpiar = document.getElementById('btnLimpiarSeleccionBarra');

  // El borrado masivo solo se ofrece si el módulo lo soporta y hay permisos
  if (btnEliminar) btnEliminar.style.display = (acciones.onEliminar && esAdmin()) ? '' : 'none';

  // Se reemplazan los botones para no acumular listeners de vistas anteriores
  [[btnJSON, acciones.onJSON], [btnCSV, acciones.onCSV], [btnEliminar, acciones.onEliminar], [btnLimpiar, acciones.onLimpiar]]
    .forEach(([btn, handler]) => {
      if (!btn || !handler) return;
      const nuevo = btn.cloneNode(true);
      btn.parentNode.replaceChild(nuevo, btn);
      nuevo.addEventListener('click', handler);
    });

  barra.classList.add('show');
}

function ocultarBarraSeleccion() {
  const barra = document.getElementById('barraSeleccion');
  if (barra) barra.classList.remove('show');
}

/* ------------------------------------------------------------
   CONFIRMACIÓN POR PIN PARA ACCIONES DESTRUCTIVAS
   Devuelve una promesa con el PIN escrito, o null si se cancela.
   El PIN NO se valida aquí: se envía al backend, que es quien decide.
   Así la protección no depende de la interfaz.
   ------------------------------------------------------------ */
function pedirPinAdmin({ titulo, mensaje, resumen, textoBoton } = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modalConfirmarPin');
    const input = document.getElementById('confirmarPinInput');
    const error = document.getElementById('confirmarPinError');
    const form = document.getElementById('formConfirmarPin');
    const elTitulo = document.getElementById('confirmarPinTitulo');
    const elMensaje = document.getElementById('confirmarPinMensaje');
    const elResumen = document.getElementById('confirmarPinResumen');
    const btnOk = document.getElementById('btnAceptarConfirmarPin');
    const btnCancelar = document.getElementById('btnCancelarConfirmarPin');

    // Sin modal en el DOM se cae a la confirmación básica del navegador
    if (!modal || !input) {
      const pin = window.prompt(`${mensaje || 'Confirma esta acción'}\n\nIngresa el PIN de administrador:`);
      resolve(pin ? pin.trim() : null);
      return;
    }

    if (elTitulo) elTitulo.textContent = titulo || 'Confirmar eliminación';
    if (elMensaje) elMensaje.textContent = mensaje || 'Esta acción no se puede deshacer.';
    if (elResumen) {
      elResumen.textContent = resumen || '';
      elResumen.style.display = resumen ? 'block' : 'none';
    }
    if (btnOk) btnOk.textContent = textoBoton || '🗑️ Sí, eliminar';

    input.value = '';
    error?.classList.add('hidden');
    modal.classList.add('show');
    setTimeout(() => input.focus(), 80);

    // Se clonan los controles para no acumular listeners entre llamadas
    const limpiar = () => {
      modal.classList.remove('show');
      input.value = '';
      nuevoOk.replaceWith(nuevoOk.cloneNode(true));
      nuevoCancelar.replaceWith(nuevoCancelar.cloneNode(true));
    };

    const nuevoOk = btnOk.cloneNode(true);
    btnOk.replaceWith(nuevoOk);
    const nuevoCancelar = btnCancelar.cloneNode(true);
    btnCancelar.replaceWith(nuevoCancelar);

    const aceptar = () => {
      const pin = (input.value || '').trim();
      if (!pin) {
        if (error) { error.textContent = 'Escribe el PIN para continuar.'; error.classList.remove('hidden'); }
        input.focus();
        return;
      }
      limpiar();
      resolve(pin);
    };

    const cancelar = () => { limpiar(); resolve(null); };

    nuevoOk.addEventListener('click', aceptar);
    nuevoCancelar.addEventListener('click', cancelar);
    if (form) form.onsubmit = (e) => { e.preventDefault(); aceptar(); };
    modal.onclick = (e) => { if (e.target === modal) cancelar(); };
  });
}

/* Descarga un contenido generado en el navegador (JSON de respaldo, etc.) */
function descargarArchivo(nombre, contenido, tipo = 'application/json') {
  const blob = new Blob([contenido], { type: tipo + ';charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ------------------------------------------------------------
   AUTOCOMPLETADO DE TEXTO CON ESTILO PROPIO
   Sugiere valores existentes mientras se escribe (mismo look que el
   buscador de productos), pero SIEMPRE permite quedarse con lo que el
   usuario haya tecleado — no fuerza a elegir una opción de la lista.
   Reemplaza el <datalist> nativo, que en el celular (sobre todo iOS)
   se ve y filtra de forma inconsistente.
   ------------------------------------------------------------ */
function activarAutocompletoTexto(input, sugerenciasEl, obtenerOpciones) {
  if (!input || !sugerenciasEl) return;

  function render() {
    const q = (input.value || '').trim().toLowerCase();
    const opciones = obtenerOpciones() || [];
    const filtradas = (q ? opciones.filter(v => v.toLowerCase().includes(q)) : opciones).slice(0, 8);

    if (filtradas.length === 0) {
      sugerenciasEl.classList.remove('show');
      sugerenciasEl.innerHTML = '';
      return;
    }

    sugerenciasEl.innerHTML = filtradas.map(v =>
      `<div class="suggestion-item" data-valor="${v.replace(/"/g, '&quot;')}"><span>${v}</span></div>`
    ).join('');
    sugerenciasEl.classList.add('show');

    sugerenciasEl.querySelectorAll('[data-valor]').forEach(item => {
      // mousedown (no click): evita que el input pierda foco antes de leer el valor
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.value = item.dataset.valor;
        sugerenciasEl.classList.remove('show');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      });
    });
  }

  input.addEventListener('focus', render);
  input.addEventListener('input', render);
  document.addEventListener('click', (e) => {
    if (e.target !== input && !sugerenciasEl.contains(e.target)) sugerenciasEl.classList.remove('show');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTema();
  initNavegacion();
  verificarBackend();
});

/* Los datos se cargan recién cuando hay sesión válida (evento de auth.js) */
document.addEventListener('pos:sesion-iniciada', () => {
  if (typeof cargarProductos === 'function') cargarProductos();
  if (typeof cargarHistorial === 'function') cargarHistorial();
  if (typeof cargarCompras === 'function' && esAdmin()) cargarCompras();
});
