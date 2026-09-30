/* ============================================================
   PENDIENTES DEL DUEÑO Y DE CLAUDE (v101, sql/72)
   ------------------------------------------------------------
   Pedido del dueño (30-09-2026): "necesito una interfaz o revisar algún
   lugar donde se pueda ir marcando checklist o tú mismo los marques, para
   ver qué está pendiente y qué cosas ya fueron chequeadas y hechas ...
   siempre digo postergo, postergo, deja pendiente eso".

   · Chip "Pendientes" en el encabezado, siempre visible para admin (aunque
     no haya nada, para poder anotar). Cuenta SOLO lo del dueño que toca
     hoy: los pendientes y los postergados cuya fecha de revisión ya llegó.
     Rojo si alguno pasó su fecha límite.
   · Postergar pide para cuándo volver a verlo, y el contador de veces
     postergado se muestra a propósito.
   · Claude escribe en la misma tabla con la CLI (ver CLAUDE.md): lo que
     marca aparece como "hecho por Claude".

   Si la tabla todavía no existe (migración sin aplicar), el chip se oculta.
   Solo admin. Se consulta al iniciar sesión y cada 30 minutos.
   ============================================================ */

const INTERVALO_PENDIENTES_MS = 30 * 60 * 1000;
let intervaloPendientes = null;
let datosPendientes = null;          // { hoy, abiertos, cerrados }
let filtroPendientes = 'dueno';
let pendientePorPostergar = null;
let descartePendienteArmado = null;  // id con el "¿Seguro?" a la vista

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnPendientes')?.addEventListener('click', abrirPendientes);
  document.getElementById('btnCerrarPendientes')?.addEventListener('click', () => cerrarModal('modalPendientes'));
  document.querySelectorAll('[data-filtro-pend]').forEach(b => b.addEventListener('click', () => {
    filtroPendientes = b.dataset.filtroPend;
    pintarPendientes();
  }));
  document.getElementById('btnGuardarPendiente')?.addEventListener('click', guardarNuevoPendiente);
  document.getElementById('pendientesLista')?.addEventListener('click', clickEnListaPendientes);
  document.getElementById('pendientesLista')?.addEventListener('change', e => {
    const chk = e.target.closest('.pend-check');
    if (chk) accionSobrePendiente(Number(chk.dataset.id), { accion: 'hecho' }, '✔ Marcado como hecho');
  });

  document.querySelectorAll('[data-posterga-dias]').forEach(b => b.addEventListener('click', () => {
    const input = document.getElementById('postergarPendFecha');
    if (input && datosPendientes) input.value = sumarDiasPendiente(datosPendientes.hoy, Number(b.dataset.postergaDias));
  }));
  document.getElementById('btnCancelarPostergar')?.addEventListener('click', () => cerrarModal('modalPostergarPendiente'));
  document.getElementById('btnConfirmarPostergar')?.addEventListener('click', confirmarPostergarPendiente);
});

document.addEventListener('pos:sesion-iniciada', () => {
  if (intervaloPendientes) { clearInterval(intervaloPendientes); intervaloPendientes = null; }
  const btn = document.getElementById('btnPendientes');
  if (!esAdmin()) { if (btn) btn.hidden = true; return; }
  actualizarAvisoPendientes();
  intervaloPendientes = setInterval(actualizarAvisoPendientes, INTERVALO_PENDIENTES_MS);
});

/* ---------- fechas 'YYYY-MM-DD' sin corrimiento de zona ---------- */
function sumarDiasPendiente(iso, dias) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
function diasHastaPendiente(desde, hasta) {
  return Math.round((Date.parse(hasta + 'T12:00:00Z') - Date.parse(desde + 'T12:00:00Z')) / 86400000);
}

/* Toca hoy: pendiente, o postergado cuya fecha de revisión ya llegó. */
function pendienteTocaHoy(p, hoy) {
  return p.estado === 'pendiente' || (p.estado === 'postergado' && (!p.revisar_el || p.revisar_el <= hoy));
}
function pendienteVencido(p, hoy) {
  return !!p.fecha_limite && p.fecha_limite < hoy;
}

async function actualizarAvisoPendientes() {
  const btn = document.getElementById('btnPendientes');
  const texto = document.getElementById('textoPendientes');
  if (!btn || !texto || !tokenActual() || !esAdmin()) return;
  try {
    datosPendientes = await API.balance.pendientes();
  } catch (err) {
    // Silencioso: sondeo de fondo. Si la tabla no existe aún, el chip no aparece.
    console.error('Error al revisar los pendientes:', err.message || err);
    btn.hidden = true;
    return;
  }
  const { hoy, abiertos } = datosPendientes;
  const mios = abiertos.filter(p => p.responsable === 'dueno' && pendienteTocaHoy(p, hoy));
  const vencidos = mios.filter(p => pendienteVencido(p, hoy)).length;
  const deClaude = abiertos.filter(p => p.responsable === 'claude' && pendienteTocaHoy(p, hoy)).length;

  texto.textContent = !mios.length ? 'Pendientes al día'
    : vencidos ? `${mios.length} pendiente(s) · ${vencidos} vencido(s)`
    : `${mios.length} pendiente(s)`;
  btn.classList.toggle('factura-atrasada', vencidos > 0);
  btn.classList.toggle('pend-al-dia', !mios.length);
  btn.title = `${mios.length} tuyo(s) para hoy · ${deClaude} de Claude`;
  btn.hidden = false;
  if (document.getElementById('modalPendientes')?.classList.contains('show')) pintarPendientes();
}

async function abrirPendientes() {
  document.getElementById('modalPendientes')?.classList.add('show');
  pintarPendientes();
  await actualizarAvisoPendientes();
}

function listaSegunFiltroPendientes() {
  if (!datosPendientes) return [];
  const { hoy, abiertos, cerrados } = datosPendientes;
  const orden = (a, b) =>
    (pendienteVencido(b, hoy) - pendienteVencido(a, hoy)) ||
    ((b.prioridad === 'alta') - (a.prioridad === 'alta')) ||
    String(a.fecha_limite || '9999').localeCompare(String(b.fecha_limite || '9999')) ||
    String(a.creado_en).localeCompare(String(b.creado_en));
  if (filtroPendientes === 'cerrados') return cerrados;
  if (filtroPendientes === 'postergados') {
    return abiertos.filter(p => !pendienteTocaHoy(p, hoy))
      .sort((a, b) => String(a.revisar_el).localeCompare(String(b.revisar_el)));
  }
  return abiertos.filter(p => p.responsable === filtroPendientes && pendienteTocaHoy(p, hoy)).sort(orden);
}

function pintarPendientes() {
  const cont = document.getElementById('pendientesLista');
  const resumen = document.getElementById('pendientesResumen');
  if (!cont) return;
  if (!datosPendientes) { cont.innerHTML = '<p class="modal-hint">Cargando…</p>'; return; }
  const { hoy, abiertos, cerrados } = datosPendientes;

  const cuenta = {
    dueno: abiertos.filter(p => p.responsable === 'dueno' && pendienteTocaHoy(p, hoy)).length,
    claude: abiertos.filter(p => p.responsable === 'claude' && pendienteTocaHoy(p, hoy)).length,
    postergados: abiertos.filter(p => !pendienteTocaHoy(p, hoy)).length,
    cerrados: cerrados.length
  };
  const nombres = { dueno: 'Míos', claude: 'De Claude', postergados: 'Postergados', cerrados: 'Hechos' };
  document.querySelectorAll('[data-filtro-pend]').forEach(b => {
    const f = b.dataset.filtroPend;
    b.textContent = `${nombres[f]} (${cuenta[f]})`;
    b.classList.toggle('btn-primary', f === filtroPendientes);
    b.classList.toggle('btn-outline', f !== filtroPendientes);
    b.setAttribute('aria-selected', String(f === filtroPendientes));
  });
  if (resumen) {
    resumen.textContent = cuenta.dueno
      ? `Tienes ${cuenta.dueno} para hoy. Marca la casilla cuando esté hecho, o postérgalo con fecha para no perderlo de vista.`
      : 'No tienes nada para hoy. 🎉';
  }

  const lista = listaSegunFiltroPendientes();
  const vacio = {
    dueno: 'Nada tuyo para hoy.', claude: 'Claude no tiene nada abierto.',
    postergados: 'Nada postergado.', cerrados: 'Todavía no hay nada cerrado.'
  };
  cont.innerHTML = lista.length ? lista.map(p => filaPendienteHtml(p, hoy)).join('')
    : `<p class="modal-hint">${vacio[filtroPendientes]}</p>`;
}

function filaPendienteHtml(p, hoy) {
  const cerrado = p.estado === 'hecho' || p.estado === 'descartado';
  const et = [];
  if (!cerrado) {
    if (p.prioridad === 'alta') et.push('<span class="pend-etiqueta urgente">Urgente</span>');
    if (p.fecha_limite) {
      const faltan = diasHastaPendiente(hoy, p.fecha_limite);
      if (faltan < 0) et.push(`<span class="pend-etiqueta vencido">Venció hace ${-faltan} día(s)</span>`);
      else if (faltan === 0) et.push('<span class="pend-etiqueta pronto">Vence hoy</span>');
      else et.push(`<span class="pend-etiqueta${faltan <= 3 ? ' pronto' : ''}">Vence el ${fechaCortaAviso(p.fecha_limite)} (en ${faltan} día(s))</span>`);
    }
    if (p.estado === 'postergado' && p.revisar_el > hoy) {
      et.push(`<span class="pend-etiqueta postergado">Vuelve el ${fechaCortaAviso(p.revisar_el)}</span>`);
    }
    if (p.veces_postergado > 0) {
      et.push(`<span class="pend-etiqueta postergado">Postergado ${vecesPendiente(p.veces_postergado)}</span>`);
    }
  } else {
    const quien = p.hecho_por === 'claude' ? 'Claude' : 'ti';
    et.push(p.estado === 'hecho'
      ? `<span class="pend-etiqueta hecho">✔ Hecho por ${quien} · ${fechaCortaAviso(tsAChile(p.cerrado_en, false))}</span>`
      : `<span class="pend-etiqueta">Descartado · ${fechaCortaAviso(tsAChile(p.cerrado_en, false))}</span>`);
  }
  if (filtroPendientes === 'postergados' || filtroPendientes === 'cerrados') {
    et.push(`<span class="pend-etiqueta">${p.responsable === 'claude' ? 'De Claude' : 'Tuyo'}</span>`);
  }
  if (p.categoria) et.push(`<span class="pend-etiqueta">${escHtml(p.categoria)}</span>`);

  const acciones = cerrado
    ? `<button type="button" class="btn btn-sm btn-ghost" data-pend-accion="reabrir" data-id="${p.id}">Reabrir</button>`
    : `<button type="button" class="btn btn-sm btn-outline" data-pend-accion="postergar" data-id="${p.id}">Postergar</button>
       <button type="button" class="btn btn-sm btn-ghost" data-pend-accion="descartar" data-id="${p.id}">${descartePendienteArmado === p.id ? '¿Seguro?' : 'Descartar'}</button>`;

  return `
    <div class="pend-fila${cerrado ? ' cerrado' : ''}">
      ${cerrado ? '' : `<input type="checkbox" class="pend-check" data-id="${p.id}" title="Marcar como hecho" aria-label="Marcar como hecho: ${escHtml(p.titulo)}">`}
      <div class="pend-cuerpo">
        <strong>${escHtml(p.titulo)}</strong>
        ${p.detalle ? `<small class="pend-detalle">${escHtml(p.detalle)}</small>` : ''}
        ${p.nota_cierre ? `<small class="pend-detalle">📝 ${escHtml(p.nota_cierre)}</small>` : ''}
        <div class="pend-etiquetas">${et.join('')}</div>
      </div>
      <div class="pend-acciones">${acciones}</div>
    </div>`;
}

function clickEnListaPendientes(e) {
  const btn = e.target.closest('[data-pend-accion]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const accion = btn.dataset.pendAccion;
  if (accion === 'postergar') return abrirPostergarPendiente(id);
  if (accion === 'reabrir') return accionSobrePendiente(id, { accion: 'reabrir' }, 'Reabierto');
  if (accion === 'descartar') {
    // Dos clics en vez de confirm(): el primero arma, el segundo descarta.
    if (descartePendienteArmado !== id) { descartePendienteArmado = id; pintarPendientes(); return; }
    descartePendienteArmado = null;
    accionSobrePendiente(id, { accion: 'descartar' }, 'Descartado');
  }
}

async function accionSobrePendiente(id, cuerpo, mensajeOk) {
  try {
    await API.balance.accionPendiente(id, cuerpo);
    showToast(mensajeOk, 'ok');
  } catch (err) {
    showToast(err.message || 'No se pudo actualizar el pendiente', 'err');
  }
  await actualizarAvisoPendientes();
  pintarPendientes();
}

function abrirPostergarPendiente(id) {
  const p = datosPendientes?.abiertos.find(x => x.id === id);
  if (!p) return;
  pendientePorPostergar = id;
  const hoy = datosPendientes.hoy;
  document.getElementById('postergarPendTitulo').textContent = p.titulo;
  const input = document.getElementById('postergarPendFecha');
  input.min = sumarDiasPendiente(hoy, 1);
  input.value = sumarDiasPendiente(hoy, 1);
  document.getElementById('postergarPendAviso').textContent = p.veces_postergado > 0
    ? `Ya lo postergaste ${vecesPendiente(p.veces_postergado)}. ¿Y si lo haces ahora, o lo descartas?`
    : '';
  document.getElementById('modalPostergarPendiente')?.classList.add('show');
}

async function confirmarPostergarPendiente() {
  const fecha = document.getElementById('postergarPendFecha')?.value;
  if (!pendientePorPostergar || !fecha) return showToast('Elige para cuándo lo postergas', 'err');
  cerrarModal('modalPostergarPendiente');
  await accionSobrePendiente(pendientePorPostergar, { accion: 'postergar', revisar_el: fecha },
    `Postergado hasta el ${fechaCortaAviso(fecha)}`);
  pendientePorPostergar = null;
}

async function guardarNuevoPendiente() {
  const titulo = document.getElementById('pendTitulo').value.trim();
  if (titulo.length < 3) return showToast('Escribe qué hay que hacer (mínimo 3 letras)', 'err');
  const responsable = document.getElementById('pendResponsable').value;
  const datos = {
    titulo,
    detalle: document.getElementById('pendDetalle').value.trim(),
    responsable,
    fecha_limite: document.getElementById('pendFechaLimite').value || null,
    categoria: document.getElementById('pendCategoria').value.trim(),
    prioridad: document.getElementById('pendAlta').checked ? 'alta' : 'normal'
  };
  const btn = document.getElementById('btnGuardarPendiente');
  btn.disabled = true;
  try {
    await API.balance.crearPendiente(datos);
    ['pendTitulo', 'pendDetalle', 'pendFechaLimite', 'pendCategoria'].forEach(id => { document.getElementById(id).value = ''; });
    document.getElementById('pendAlta').checked = false;
    document.getElementById('pendientesNuevo').open = false;
    filtroPendientes = responsable;
    showToast('Anotado', 'ok');
    await actualizarAvisoPendientes();
    pintarPendientes();
  } catch (err) {
    showToast(err.message || 'No se pudo anotar', 'err');
  } finally {
    btn.disabled = false;
  }
}

function vecesPendiente(n) {
  return `${n} ${n === 1 ? 'vez' : 'veces'}`;
}
