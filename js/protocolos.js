// ==========================================
// PROTOCOLOS.JS — Fases de servicio en la OT (sql/66)
// ------------------------------------------
// Pedido del dueño: "que cada servicio se armen FASES que el admin o
// trabajador debe ir chequeando", registrando lo que se consume, "cosa de
// ir tachando las OT y que sea visible siempre las FASES y PROTOCOLO".
//
// ⚠️ LA REGLA QUE LO DEFINE (decisión del dueño, 24-09-2026):
// el insumo sale del stock AL TACHAR LA FASE, no al entregar la orden.
// El backend lo guarda en ot_repuestos con stock_descontado = true para
// que la entrega no lo descuente por segunda vez.
//
// El JWT solo lleva el rol (admin / trabajador), no identidad individual.
// Por eso se le pide el nombre a quien tacha y se recuerda en este
// navegador — decisión del dueño: "que pueda llenar con su nombre".
// ==========================================

const CLAVE_NOMBRE_TECNICO = 'pos_nombre_tecnico';
const INTERVALO_SERVICIOS_MS = 5 * 60 * 1000;

let protocolosDisponibles = [];
let checklistOtId = null;
let checklistDatos = null;
let serviciosEnCursoCache = null;
let avanceOtPorId = new Map();     // ot_id → { completadas, total }
let intervaloServicios = null;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnCerrarProtocoloOT')
    ?.addEventListener('click', () => cerrarModal('modalProtocoloOT'));
  document.getElementById('btnAplicarProtocolo')
    ?.addEventListener('click', aplicarProtocoloAOT);
  document.getElementById('btnCambiarNombreTecnico')
    ?.addEventListener('click', pedirNombreTecnico);

  document.getElementById('btnServiciosEnCurso')?.addEventListener('click', abrirModalServicios);
  document.getElementById('btnCerrarServicios')
    ?.addEventListener('click', () => cerrarModal('modalServiciosEnCurso'));

  document.getElementById('servicioslista')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-abrir-checklist]');
    if (btn) {
      cerrarModal('modalServiciosEnCurso');
      abrirModalProtocoloOT(Number(btn.dataset.abrirChecklist));
    }
  });
});

document.addEventListener('pos:sesion-iniciada', () => {
  if (intervaloServicios) { clearInterval(intervaloServicios); intervaloServicios = null; }
  actualizarAvisoServicios();
  intervaloServicios = setInterval(actualizarAvisoServicios, INTERVALO_SERVICIOS_MS);
});

/* ============================================================
   QUIÉN ESTÁ TRABAJANDO
   ------------------------------------------------------------
   Se recuerda en este navegador para no preguntarlo en cada fase. Es una
   comodidad por equipo, no identidad de verdad: el dato duro que guarda el
   backend es el ROL. Si localStorage está bloqueado, simplemente se
   pregunta cada vez.
   ============================================================ */
function nombreTecnicoGuardado() {
  try { return localStorage.getItem(CLAVE_NOMBRE_TECNICO) || ''; } catch (_) { return ''; }
}

function guardarNombreTecnico(nombre) {
  try { localStorage.setItem(CLAVE_NOMBRE_TECNICO, nombre); } catch (_) { /* modo privado */ }
}

function pedirNombreTecnico() {
  const actual = nombreTecnicoGuardado();
  const nombre = prompt('¿Quién está trabajando en el taller?\n\nQueda registrado en cada fase que taches.', actual);
  if (nombre === null) return actual;          // canceló
  const limpio = nombre.trim().slice(0, 80);
  guardarNombreTecnico(limpio);
  pintarNombreTecnico();
  return limpio;
}

function pintarNombreTecnico() {
  const el = document.getElementById('nombreTecnicoActual');
  if (el) {
    const n = nombreTecnicoGuardado();
    el.textContent = n ? `Trabajando: ${n}` : 'Sin nombre — se te va a preguntar al tachar';
  }
}

/* ============================================================
   EL CHECKLIST DE UNA OT
   ============================================================ */
async function abrirModalProtocoloOT(otId) {
  checklistOtId = Number(otId);
  const modal = document.getElementById('modalProtocoloOT');
  if (!modal) return;

  const ot = (typeof ordenesList !== 'undefined' ? ordenesList : []).find(o => Number(o.id) === checklistOtId);
  const titulo = document.getElementById('protocoloOtTitulo');
  if (titulo) {
    titulo.textContent = ot
      ? `${ot.numero_ot} · ${ot.cliente_nombre || 'sin cliente'} · ${[ot.dispositivo_categoria, ot.dispositivo_modelo].filter(Boolean).join(' ')}`
      : `Orden #${checklistOtId}`;
  }

  pintarNombreTecnico();
  modal.classList.add('show');

  try {
    if (!protocolosDisponibles.length) protocolosDisponibles = await API.protocolos.listar() || [];
    pintarSelectorProtocolos();
    await cargarChecklistOT();
  } catch (err) {
    console.error('Error al abrir el checklist:', err.message || err);
    showToast(err.message || 'No se pudo cargar el checklist', 'err');
  }
}

function pintarSelectorProtocolos() {
  const sel = document.getElementById('protocoloSelector');
  if (!sel) return;
  sel.innerHTML = '<option value="">Elige un protocolo para aplicar…</option>' +
    protocolosDisponibles.map(p => `<option value="${p.id}">${escHtml(p.nombre)} (${(p.fases || []).length} fases)</option>`).join('');
}

async function cargarChecklistOT() {
  if (!checklistOtId) return;
  checklistDatos = await API.protocolos.fasesDeOt(checklistOtId);
  pintarChecklistOT();
}

async function aplicarProtocoloAOT() {
  const sel = document.getElementById('protocoloSelector');
  const protocoloId = Number(sel?.value);
  if (!protocoloId) { showToast('Elige un protocolo', 'err'); return; }

  const btn = document.getElementById('btnAplicarProtocolo');
  if (btn) btn.disabled = true;
  try {
    const r = await API.protocolos.aplicarAOt(checklistOtId, protocoloId);
    showToast(`"${r.protocolo}" aplicado · ${r.fases.length} fases`, 'ok');
    if (sel) sel.value = '';
    await cargarChecklistOT();
    await actualizarAvisoServicios();
    if (typeof cargarOrdenes === 'function') cargarOrdenes();
  } catch (err) {
    showToast(err.message || 'No se pudo aplicar el protocolo', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function pintarChecklistOT() {
  const cont = document.getElementById('protocoloFasesLista');
  const resumen = document.getElementById('protocoloOtResumen');
  if (!cont || !checklistDatos) return;

  const fases = checklistDatos.fases || [];

  if (resumen) {
    resumen.textContent = fases.length
      ? `${checklistDatos.completadas} de ${checklistDatos.total} fases` +
        (checklistDatos.obligatorias_pendientes
          ? ` · faltan ${checklistDatos.obligatorias_pendientes} obligatoria(s) para poder entregar`
          : ' · listo para entregar')
      : 'Esta orden todavía no tiene protocolo aplicado.';
  }

  if (!fases.length) {
    cont.innerHTML = '<p class="modal-hint">Elige un protocolo arriba para armar el checklist de este servicio.</p>';
    return;
  }

  cont.innerHTML = fases.map(f => {
    const hecha = !!f.completada_en;

    /* Lo que la fase VA a consumir (del protocolo) o lo que YA consumió.
       Después de tachar se muestra lo real, que puede diferir si algo no
       tenía stock. */
    const insumos = hecha ? (f.insumos_consumidos || []) : (f.insumos_plan || []);
    const listaInsumos = insumos.length
      ? `<div class="fase-insumos">${insumos.map(i =>
          `<span class="chip-insumo">${hecha ? '✔' : '•'} ${escHtml(i.nombre)} ×${num(i.cantidad)}</span>`).join(' ')}</div>`
      : '';

    const firma = hecha
      ? `<small style="color:var(--text-muted);">${escHtml(f.completada_por_nombre || f.completada_por_rol || '')} · ${tsAChile(f.completada_en).slice(0, 16)}</small>`
      : (f.destachada_en
          ? `<small style="color:var(--gold);">destachada por ${escHtml(f.destachada_por_nombre || f.destachada_por_rol || '')} · ${tsAChile(f.destachada_en).slice(0, 16)}</small>`
          : '');

    return `
      <div class="fase-fila${hecha ? ' fase-hecha' : ''}">
        <label class="fase-check">
          <input type="checkbox" data-fase="${f.id}" ${hecha ? 'checked' : ''}>
          <span class="fase-nombre">
            ${f.orden}. ${escHtml(f.nombre)}
            ${f.obligatoria ? '<span class="obligatorio" title="Sin esta fase no se puede entregar">*</span>' : ''}
          </span>
        </label>
        ${f.pide_nota && !hecha ? `<input type="text" class="fase-nota" data-nota-de="${f.id}" placeholder="Anota el resultado (obligatorio)…">` : ''}
        ${f.nota ? `<div class="fase-nota-hecha">📝 ${escHtml(f.nota)}</div>` : ''}
        ${listaInsumos}
        ${firma}
      </div>`;
  }).join('');

  cont.querySelectorAll('input[data-fase]').forEach(chk => {
    chk.addEventListener('change', () => alternarFaseOT(Number(chk.dataset.fase), chk.checked, chk));
  });
}

/* El punto donde se mueve el stock. */
async function alternarFaseOT(faseId, completada, checkbox) {
  let nombre = nombreTecnicoGuardado();
  if (!nombre) {
    nombre = pedirNombreTecnico();
    if (!nombre) {
      // Sin nombre no se bloquea: el rol igual queda registrado.
      nombre = '';
    }
  }

  const campoNota = document.querySelector(`[data-nota-de="${faseId}"]`);
  const nota = campoNota ? campoNota.value.trim() : '';

  if (checkbox) checkbox.disabled = true;
  try {
    const r = await API.protocolos.marcarFase(faseId, { completada, nombre, nota });

    if (completada) {
      const partes = ['Fase tachada'];
      if (r.insumos_consumidos) partes.push(`${r.insumos_consumidos} insumo(s) descontado(s) del stock`);
      showToast(partes.join(' · '), 'ok');
      (r.avisos || []).forEach((a, i) => setTimeout(() => showToast(a, 'err'), 1200 * (i + 1)));
    } else {
      showToast(r.insumos_devueltos ? `Destachada · ${r.insumos_devueltos} insumo(s) devuelto(s) al stock` : 'Destachada', 'ok');
    }

    await cargarChecklistOT();
    await actualizarAvisoServicios();
    // El stock cambió: el catálogo en memoria quedaría viejo.
    if (typeof cargarProductos === 'function') cargarProductos(true);
  } catch (err) {
    showToast(err.message || 'No se pudo actualizar la fase', 'err');
    if (checkbox) checkbox.checked = !completada;   // se revierte en pantalla
  } finally {
    if (checkbox) checkbox.disabled = false;
  }
}

/* ============================================================
   AVISO DEL HEADER: SERVICIOS EN CURSO
   Pedido del dueño: "me gustaría ver en notificaciones los servicios en
   curso".
   ============================================================ */
async function actualizarAvisoServicios() {
  const btn = document.getElementById('btnServiciosEnCurso');
  const texto = document.getElementById('textoServiciosEnCurso');
  if (!btn || !texto || !tokenActual()) return;

  try {
    serviciosEnCursoCache = await API.protocolos.enCurso();

    // Se guarda el avance por OT para pintarlo en la tabla de órdenes
    avanceOtPorId = new Map((serviciosEnCursoCache?.servicios || [])
      .map(s => [Number(s.id), { completadas: s.completadas, total: s.total_fases }]));

    const total = Number(serviciosEnCursoCache?.total) || 0;
    if (!total) { btn.hidden = true; return; }

    const sinAvanzar = Number(serviciosEnCursoCache?.sin_avanzar) || 0;
    texto.textContent = sinAvanzar ? `${sinAvanzar} sin empezar` : `${total} en curso`;
    btn.classList.toggle('servicio-sin-avanzar', sinAvanzar > 0);
    btn.title = sinAvanzar
      ? `${sinAvanzar} servicio(s) con protocolo aplicado y ninguna fase tachada`
      : `${total} servicio(s) en el taller`;
    btn.hidden = false;

    if (document.getElementById('modalServiciosEnCurso')?.classList.contains('show')) pintarServicios();
  } catch (err) {
    console.error('Error al revisar los servicios en curso:', err.message || err);
  }
}

function abrirModalServicios() {
  if (!serviciosEnCursoCache?.total) return;
  pintarServicios();
  document.getElementById('modalServiciosEnCurso')?.classList.add('show');
}

function pintarServicios() {
  const cont = document.getElementById('servicioslista');
  const resumen = document.getElementById('serviciosResumen');
  if (!cont || !serviciosEnCursoCache) return;

  const lista = serviciosEnCursoCache.servicios || [];
  if (resumen) {
    resumen.textContent = lista.length
      ? `${lista.length} equipo(s) en el taller con protocolo abierto`
        + (serviciosEnCursoCache.sin_avanzar ? ` · ${serviciosEnCursoCache.sin_avanzar} sin empezar.` : '.')
      : 'No hay servicios en curso.';
  }
  if (!lista.length) { cont.innerHTML = '<p class="modal-hint">Nada en curso.</p>'; return; }

  cont.innerHTML = lista.map(s => {
    const pct = s.total_fases ? Math.round(100 * s.completadas / s.total_fases) : 0;
    const dias = s.dias_en_taller === null ? '' : ` · ${num(s.dias_en_taller)} día(s) en el taller`;
    return `
      <div class="agotado-fila">
        <div class="agotado-cabecera">
          <div class="agotado-datos">
            <strong>${escHtml(s.numero_ot)} · ${escHtml(s.cliente || 'sin cliente')}</strong>
            <small>${escHtml(s.equipo || '')}${dias}</small>
            <small>${s.completadas} de ${s.total_fases} fases (${pct}%)${s.siguiente_fase ? ' · sigue: ' + escHtml(s.siguiente_fase) : ' · completo'}</small>
          </div>
        </div>
        <div class="agotado-acciones">
          <button class="btn btn-primary btn-sm" data-abrir-checklist="${s.id}">✅ Ver checklist</button>
        </div>
      </div>`;
  }).join('');
}

/* La insignia que se pinta en la tabla de órdenes, para que el avance sea
   "visible siempre" sin tener que abrir nada. */
function insigniaAvanceOT(otId) {
  const a = avanceOtPorId.get(Number(otId));
  if (!a || !a.total) return '';
  const completo = a.completadas >= a.total;
  return `<span class="badge ${completo ? 'badge-green' : 'badge-gold'}" title="Fases del protocolo">${a.completadas}/${a.total}</span>`;
}
