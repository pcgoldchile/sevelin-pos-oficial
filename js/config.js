/* ============================================================
   CONFIG.JS - Utilidades globales y arranque de la interfaz
   ------------------------------------------------------------
   IMPORTANTE: aquí ya NO hay URL ni llaves de Supabase. Toda la
   comunicación con la base de datos pasa por el backend (api.js →
   /api/...), que es el único que conoce las credenciales.
   ============================================================ */

var NEGOCIO_NOMBRE = 'Sevelin'; // el backend puede sobrescribirlo al iniciar sesión

/* ============================================================
   XSS-01 · ESCAPE DE HTML — helper global canónico
   ------------------------------------------------------------
   Todo dato de usuario (nombre de producto, cliente, falla, SKU, S/N…)
   que se interpole en innerHTML DEBE pasar por aquí. Sin esto, un
   nombre como <img src=x onerror=...> se ejecuta al pintar la lista, y
   como el token vive en sessionStorage, un trabajador podría robar la
   sesión del admin (escalada de privilegios vía XSS persistente).

   (v20) Existían cuatro helpers duplicados (escaparHTML en print,
   escaparTexto en balance, escaparHtmlHist en historial, escaparRep en
   reportes). Se unificaron en este: todos los archivos usan ahora
   escHtml directamente.

   Se escapa también la comilla simple: importa cuando el valor va dentro
   de un atributo delimitado por comillas simples. */
function escHtml(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ============================================================
   num() — conversión numérica tolerante (helper global)
   ------------------------------------------------------------
   BUG QUE ARREGLA: el widget de saldos y los modales de Traspaso y
   Resguardo (balance.js) llamaban a num(), pero esa función solo existía
   en el BACKEND (api/index.js). En el navegador lanzaba
   "ReferenceError: num is not defined" apenas se hacía clic en los
   botones, ANTES de que el modal recibiera la clase .show. Resultado: los
   botones "no hacían nada" (en realidad, reventaban en silencio).

   Se define aquí, en config.js (carga primero), espejando la del backend:
   devuelve 0 ante null, undefined, '' o texto no numérico, nunca NaN. */
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

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

/* Separador de miles hecho a mano, a propósito.
   toLocaleString('es-CL') NO sirve: el ICU recortado de Android aplica la
   regla CLDR minimumGroupingDigits=2 del español, según la cual los
   números de 4 dígitos van SIN separador. En un teléfono salía "$1000" y
   "$7000" pero "$20.000" correcto. En Chile se escribe $1.000 siempre. */
function fmtCLP(v) {
  const n = Math.round(Number(v) || 0);
  const negativo = n < 0;
  const s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (negativo ? '-$' : '$') + s;
}

/* ------------------------------------------------------------
   BÚSQUEDA POR PALABRAS SUELTAS
   ------------------------------------------------------------
   Antes se hacía `nombre.includes(consulta)`, así que escribir
   "cable vga" no encontraba "Cable HDMI a VGA": la frase completa no
   aparecía literal en ese orden. Ahora la consulta se parte en palabras
   y TODAS deben aparecer en algún lado, sin importar el orden ni las
   tildes. "vga cable" también funciona.
   ------------------------------------------------------------ */

function normalizarBusqueda(t) {
  return String(t == null ? '' : t)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');   // quita tildes
}

function tokensBusqueda(consulta) {
  return normalizarBusqueda(consulta).split(/\s+/).filter(Boolean);
}

/* ¿Los campos de este registro contienen TODAS las palabras buscadas? */
function coincideBusqueda(campos, tokens) {
  if (!tokens.length) return true;
  const heno = normalizarBusqueda((campos || []).filter(Boolean).join(' '));
  return tokens.every(t => heno.indexOf(t) !== -1);
}

/* Puntaje para ordenar los resultados: lo más parecido, primero.
   Sin esto, buscar "cable" pondría antes un "Adaptador con cable" que el
   propio "Cable VGA". */
function puntajeBusqueda(campos, tokens, consultaCruda) {
  const heno = normalizarBusqueda((campos || []).filter(Boolean).join(' '));
  const principal = normalizarBusqueda((campos || [])[0] || '');
  const frase = normalizarBusqueda(consultaCruda);
  let p = 0;

  if (principal === frase) p += 1000;                    // coincidencia exacta
  if (principal.indexOf(frase) === 0) p += 500;          // empieza con lo buscado
  if (heno.indexOf(frase) !== -1) p += 200;              // la frase completa aparece

  tokens.forEach(t => {
    if (new RegExp('\\b' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(principal)) p += 40;
    else if (principal.indexOf(t) !== -1) p += 20;
    else if (heno.indexOf(t) !== -1) p += 5;
  });

  return p;
}

/* Filtra y ordena en un paso. `campos` es una función que recibe el
   registro y devuelve el arreglo de textos donde buscar. */
function filtrarPorBusqueda(lista, consulta, campos, limite) {
  const tokens = tokensBusqueda(consulta);
  if (!tokens.length) return [];

  return (lista || [])
    .map(item => ({ item, campos: campos(item) }))
    .filter(o => coincideBusqueda(o.campos, tokens))
    .map(o => ({ item: o.item, p: puntajeBusqueda(o.campos, tokens, consulta) }))
    .sort((a, b) => b.p - a.p)
    .slice(0, limite || 20)
    .map(o => o.item);
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

  /* Tailwind activa sus variantes dark: buscando .dark en un ancestro.
     El sistema ya tenía su propio interruptor (body.theme-light), así
     que se sincronizan los dos: un solo botón sigue mandando sobre todo
     y no quedan dos temas peleando. */
  document.documentElement.classList.toggle('dark', !esClaro);
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

/* ---------- Navegación entre vistas ----------
   activarVista(viewId, subtab) es el único lugar que abre una vista del
   menú principal — lo usan tanto los .nav-btn de siempre como los
   .nav-subitem nuevos (atajos directos a una sub-pestaña, siempre
   visibles en el sidebar en vez de un acordeón). `subtab`, si viene,
   sobreescribe la sub-pestaña por defecto de cada vista (antes cada vista
   solo sabía abrir SU primera sub-pestaña). */
function activarVista(viewId, subtab) {
  const targetView = document.getElementById(viewId);
  if (!targetView) return;

  // Un trabajador no puede abrir vistas marcadas como admin-only
  if (targetView.classList.contains('admin-only') && !esAdmin()) {
    showToast('Solo el administrador puede ver esta sección', 'err');
    return;
  }

  document.querySelectorAll('.nav-links .nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.nav-subitem').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));

  document.querySelector(`.nav-links .nav-btn[data-view="${viewId}"]`)?.classList.add('active');
  if (subtab) {
    document.querySelector(`.nav-subitem[data-view="${viewId}"][data-subtab="${subtab}"]`)?.classList.add('active');
  }
  targetView.classList.add('active');

  if (viewId === 'view-productos' && typeof cargarProductos === 'function') cargarProductos();

  /* Historial y Gastos pasaron a ser sub-pestañas de Finanzas. La
     pestaña por defecto ahora es Historial de Ventas (antes Balance):
     es lo que más se consulta día a día. Se abre por su función de
     panel para que cargue sus datos. */
  if (viewId === 'view-finanzas') {
    if (typeof mostrarPanelFinanzas === 'function') mostrarPanelFinanzas(subtab || 'ventas');
    else if (typeof cargarHistorial === 'function') cargarHistorial();
    // El widget de saldos vive arriba y se refresca siempre al entrar
    if (typeof cargarSaldosCanales === 'function') cargarSaldosCanales();
  }
  if (viewId === 'view-taller' && typeof cargarOrdenes === 'function') cargarOrdenes();
  /* Abonos y Repuestos pasaron a ser sub-pestañas de Servicio
     Técnico, así que ya no llegan por aquí como vistas propias. Al
     entrar al taller se cargan los tres módulos: son listados
     livianos y evita que una sub-pestaña se vea vacía al abrirla. */
  if (viewId === 'view-taller') {
    if (typeof cargarEncargos === 'function') cargarEncargos();
    if (typeof cargarRepuestos === 'function') cargarRepuestos();
    if (subtab && typeof mostrarPanelTaller === 'function') mostrarPanelTaller(subtab);
  }
  /* Página Web (Pedidos Web + Categorías, sub-pestañas): mismo criterio
     que Finanzas — se abre en la primera pestaña y esa función es la
     que dispara su propia carga de datos. */
  if (viewId === 'view-pagina-web' && typeof mostrarPanelPaginaWeb === 'function') {
    mostrarPanelPaginaWeb(subtab || 'pedidos');
  }

  // Aviso para los módulos que necesitan reaccionar (p. ej. foco del lector en POS)
  document.dispatchEvent(new CustomEvent('pos:vista-activa', { detail: { vista: viewId, subtab } }));
}

function initNavegacion() {
  document.querySelectorAll('.nav-links .nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      activarVista(btn.getAttribute('data-view'));
    });
  });

  document.querySelectorAll('.nav-subitem').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      activarVista(btn.getAttribute('data-view'), btn.getAttribute('data-subtab'));
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
