// ==========================================
// FINANZAS-AJUSTES.JS
// Ajuste manual de saldos con historial (req. 3) y
// checklist de gastos fijos del mes (req. 4).
// ------------------------------------------
// Depende de balance.js (saldosActuales, checklistFijosActual,
// cargarSaldosCanales) y de los helpers globales de config.js
// (fmtCLP, escHtml, num). No redefine ninguno.
// ==========================================

let canalAjustando = null;   // 'EFECTIVO' | 'BANCO'

document.addEventListener('DOMContentLoaded', () => {
  // Lápices de las tarjetas Efectivo y Banco
  document.querySelectorAll('[data-ajustar-canal]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalAjuste(btn.dataset.ajustarCanal));
  });

  document.getElementById('btnCancelarAjuste')?.addEventListener('click', () => cerrarModal('modalAjusteSaldo'));
  document.getElementById('btnConfirmarAjuste')?.addEventListener('click', confirmarAjuste);
  document.getElementById('modalAjusteSaldo')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalAjusteSaldo') cerrarModal('modalAjusteSaldo');
  });

  // Pestañas del modal de ajuste (Ajustar / Historial)
  document.querySelectorAll('[data-ajuste-tab]').forEach(tab => {
    tab.addEventListener('click', () => mostrarTabAjuste(tab.dataset.ajusteTab));
  });

  // Diferencia en vivo mientras se escribe el nuevo saldo
  document.getElementById('ajusteNuevoSaldo')?.addEventListener('input', pintarDiferenciaAjuste);

  // Checklist de gastos fijos del mes
  document.getElementById('btnChecklistFijos')?.addEventListener('click', abrirChecklistFijos);
  document.getElementById('btnCerrarChecklist')?.addEventListener('click', () => cerrarModal('modalChecklistFijos'));
  document.getElementById('modalChecklistFijos')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalChecklistFijos') cerrarModal('modalChecklistFijos');
  });
});

/* ---------- Ajuste manual de saldo ---------- */
function abrirModalAjuste(canal) {
  if (!esAdmin()) { showToast('Solo el administrador ajusta saldos', 'err'); return; }
  if (canal !== 'EFECTIVO' && canal !== 'BANCO') return;

  canalAjustando = canal;
  const saldoActual = canal === 'EFECTIVO'
    ? num(saldosActuales?.efectivo)
    : num(saldosActuales?.banco);

  const titulo = document.getElementById('ajusteTitulo');
  if (titulo) titulo.textContent = canal === 'EFECTIVO' ? '✏️ Ajustar Efectivo · Caja chica' : '✏️ Ajustar Banco · Cuentas';

  const actual = document.getElementById('ajusteSaldoActual');
  if (actual) actual.textContent = fmtCLP(saldoActual);

  const nuevo = document.getElementById('ajusteNuevoSaldo');
  if (nuevo) nuevo.value = saldoActual;

  const motivo = document.getElementById('ajusteMotivo');
  if (motivo) motivo.value = '';

  pintarDiferenciaAjuste();
  mostrarTabAjuste('editar');
  document.getElementById('modalAjusteSaldo')?.classList.add('show');
  setTimeout(() => document.getElementById('ajusteNuevoSaldo')?.focus(), 80);
}

function mostrarTabAjuste(cual) {
  document.querySelectorAll('[data-ajuste-tab]').forEach(t =>
    t.classList.toggle('activo', t.dataset.ajusteTab === cual));
  document.querySelectorAll('[data-ajuste-panel]').forEach(p =>
    p.classList.toggle('hidden', p.dataset.ajustePanel !== cual));

  if (cual === 'historial') cargarHistorialAjustes();
}

function pintarDiferenciaAjuste() {
  const nota = document.getElementById('ajusteDiferencia');
  if (!nota) return;
  const actual = canalAjustando === 'EFECTIVO' ? num(saldosActuales?.efectivo) : num(saldosActuales?.banco);
  const nuevo = num(document.getElementById('ajusteNuevoSaldo')?.value);
  const dif = nuevo - actual;

  if (dif === 0) { nota.textContent = 'Sin cambios respecto al saldo actual.'; nota.style.color = 'var(--text-muted)'; return; }
  nota.textContent = dif > 0
    ? `Sumará ${fmtCLP(dif)} al saldo.`
    : `Restará ${fmtCLP(-dif)} del saldo.`;
  nota.style.color = dif > 0 ? 'var(--green)' : 'var(--red)';
}

async function confirmarAjuste() {
  if (!canalAjustando) return;

  const actual = canalAjustando === 'EFECTIVO' ? num(saldosActuales?.efectivo) : num(saldosActuales?.banco);
  const nuevo = num(document.getElementById('ajusteNuevoSaldo')?.value);
  const motivo = (document.getElementById('ajusteMotivo')?.value || '').trim();

  if (motivo.length < 3) { showToast('La justificación es obligatoria', 'err'); document.getElementById('ajusteMotivo')?.focus(); return; }
  if (nuevo === actual) { showToast('El saldo nuevo es igual al actual', 'err'); return; }

  const btn = document.getElementById('btnConfirmarAjuste');
  if (btn) btn.disabled = true;
  try {
    await API.balance.ajustarSaldo({
      canal: canalAjustando,
      saldo_anterior: actual,
      saldo_nuevo: nuevo,
      motivo
    });
    showToast('Saldo ajustado', 'ok');
    cerrarModal('modalAjusteSaldo');
    cargarSaldosCanales();
  } catch (err) {
    showToast(err.message || 'No se pudo ajustar el saldo', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function cargarHistorialAjustes() {
  const caja = document.getElementById('ajusteHistorialLista');
  if (!caja) return;
  caja.innerHTML = '<p class="modal-hint">Cargando…</p>';
  try {
    const lista = await API.balance.historialAjustes(canalAjustando);
    if (!lista.length) { caja.innerHTML = '<p class="modal-hint">Sin ajustes registrados para este canal.</p>'; return; }

    caja.innerHTML = lista.map(a => {
      const signo = num(a.delta) >= 0 ? '+' : '−';
      const color = num(a.delta) >= 0 ? 'var(--green)' : 'var(--red)';
      const fecha = new Date(a.creado_en).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
      return `
        <div class="ajuste-fila">
          <div class="ajuste-fila-top">
            <span class="ajuste-fecha">${escHtml(fecha)}</span>
            <b style="color:${color};">${signo}${fmtCLP(Math.abs(num(a.delta)))}</b>
          </div>
          <div class="ajuste-fila-saldos">${fmtCLP(num(a.saldo_anterior))} → ${fmtCLP(num(a.saldo_nuevo))}</div>
          <div class="ajuste-fila-motivo">${escHtml(a.motivo || '')}</div>
        </div>`;
    }).join('');
  } catch (err) {
    caja.innerHTML = `<p class="modal-hint" style="color:var(--red);">${escHtml(err.message || 'Error al cargar el historial')}</p>`;
  }
}

/* ---------- Checklist de gastos fijos del mes (req. 4) ---------- */
async function abrirChecklistFijos() {
  if (!esAdmin()) return;
  const modal = document.getElementById('modalChecklistFijos');
  const cuadre = document.getElementById('checklistCuadre');
  const lista = document.getElementById('checklistLista');
  if (!modal) return;

  if (cuadre) cuadre.innerHTML = '<p class="modal-hint">Cargando…</p>';
  if (lista) lista.innerHTML = '';
  modal.classList.add('show');

  try {
    // Se re-pide para tener el estado más fresco (pudo pagarse algo)
    const chk = await API.balance.gastosFijosMes();
    checklistFijosActual = chk;
    const total = num(saldosActuales?.total);
    const pendiente = num(chk.totalPendiente);
    const alcanza = total >= pendiente;

    if (cuadre) {
      cuadre.className = 'checklist-cuadre ' + (alcanza ? 'cuadre-ok' : 'cuadre-deficit');
      cuadre.innerHTML = `
        <div class="cuadre-fila"><span>Saldo total disponible</span><b>${fmtCLP(total)}</b></div>
        <div class="cuadre-fila"><span>Gastos fijos pendientes</span><b>${fmtCLP(pendiente)}</b></div>
        <div class="cuadre-fila cuadre-resultado">
          <span>${alcanza ? '✅ Alcanza para cubrir el mes' : '⚠️ Déficit para cubrir el mes'}</span>
          <b>${alcanza ? fmtCLP(total - pendiente) + ' de holgura' : 'Faltan ' + fmtCLP(pendiente - total)}</b>
        </div>`;
    }

    if (lista) {
      lista.innerHTML = chk.items.map(it => `
        <div class="checklist-item ${it.pagado ? 'pagado' : 'pendiente'}">
          <span class="checklist-estado">${it.pagado ? '✅' : '⬜'}</span>
          <div class="checklist-info">
            <b>${escHtml(it.nombre)}</b>
            <small>Día ${it.dia_mes}${it.clasificacion ? ' · ' + escHtml(it.clasificacion) : ''}</small>
          </div>
          <span class="checklist-monto ${it.pagado ? 'tachado' : ''}">${fmtCLP(num(it.monto))}</span>
        </div>`).join('') || '<p class="modal-hint">No hay gastos fijos activos.</p>';
    }
  } catch (err) {
    if (cuadre) cuadre.innerHTML = `<p class="modal-hint" style="color:var(--red);">${escHtml(err.message || 'Error al cargar')}</p>`;
  }
}

/* ============================================================
   APORTES DE CAPITAL (req. 6)
   ------------------------------------------------------------
   Tarjeta interactiva: historial de aportes + agregar + borrar.
   Un aporte suma al saldo del canal según su método (efectivo o banco).
   Al borrarlo, el saldo se recalcula solo y baja: por eso el borrado
   confirma explícitamente que afectará el saldo disponible.

   Todo dato de usuario (descripción) pasa por escHtml (seguridad v7).
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnAportesCapital')?.addEventListener('click', abrirModalAportes);
  document.getElementById('btnCerrarAportes')?.addEventListener('click', () => cerrarModal('modalAportes'));
  document.getElementById('btnAgregarAporte')?.addEventListener('click', agregarAporte);
  document.getElementById('modalAportes')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalAportes') cerrarModal('modalAportes');
  });
});

async function abrirModalAportes() {
  if (!esAdmin()) { showToast('Solo el administrador gestiona los aportes', 'err'); return; }
  const modal = document.getElementById('modalAportes');
  if (!modal) return;

  // Limpia el formulario
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('aporteMonto', '');
  set('aporteMetodo', 'Efectivo');
  set('aporteDescripcion', '');

  modal.classList.add('show');
  cargarHistorialAportes();
}

async function cargarHistorialAportes() {
  const caja = document.getElementById('aportesLista');
  if (!caja) return;
  caja.innerHTML = '<p class="modal-hint">Cargando…</p>';
  try {
    const lista = await API.balance.todosLosAportes();
    if (!lista.length) { caja.innerHTML = '<p class="modal-hint">Aún no hay aportes registrados.</p>'; return; }

    caja.innerHTML = lista.map(a => {
      const canal = esMetodoEfectivo(a.metodo) ? '💵 Efectivo' : '🏦 Banco';
      const fecha = escHtml(a.fecha || '');
      const desc = a.descripcion ? ' · ' + escHtml(a.descripcion) : '';
      return `
        <div class="aporte-fila">
          <div class="aporte-info">
            <b>${fmtCLP(num(a.monto))}</b>
            <small>${fecha} · ${canal}${desc}</small>
          </div>
          <button class="btn btn-icon btn-icon-del" data-borrar-aporte="${a.id}"
                  data-monto="${num(a.monto)}" data-metodo="${escHtml(a.metodo || '')}"
                  title="Borrar este aporte">🗑️</button>
        </div>`;
    }).join('');

    caja.querySelectorAll('[data-borrar-aporte]').forEach(btn => {
      btn.addEventListener('click', () => borrarAporte(btn.dataset.borrarAporte, num(btn.dataset.monto), btn.dataset.metodo));
    });
  } catch (err) {
    caja.innerHTML = `<p class="modal-hint" style="color:var(--red);">${escHtml(err.message || 'Error al cargar')}</p>`;
  }
}

// Espejo simple de esEfectivo del backend, solo para etiquetar el canal
function esMetodoEfectivo(metodo) {
  return String(metodo || '').trim().toLowerCase() === 'efectivo';
}

async function agregarAporte() {
  const monto = num(document.getElementById('aporteMonto')?.value);
  const metodo = document.getElementById('aporteMetodo')?.value || 'Efectivo';
  const descripcion = (document.getElementById('aporteDescripcion')?.value || '').trim();

  if (monto <= 0) { showToast('El monto debe ser mayor a 0', 'err'); return; }

  const btn = document.getElementById('btnAgregarAporte');
  if (btn) btn.disabled = true;
  try {
    await API.balance.crearInyeccion({ monto, metodo, descripcion });
    showToast('Aporte registrado', 'ok');
    document.getElementById('aporteMonto').value = '';
    document.getElementById('aporteDescripcion').value = '';
    cargarHistorialAportes();
    if (typeof cargarSaldosCanales === 'function') cargarSaldosCanales();
  } catch (err) {
    showToast(err.message || 'No se pudo registrar el aporte', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* Borrado con confirmación que explica el efecto en el saldo (req. 6).
   Un aporte ya suma al canal; borrarlo lo resta. Se pide el PIN de admin
   (el endpoint lo exige) y se confirma el descuento. */
async function borrarAporte(id, monto, metodo) {
  const canal = esMetodoEfectivo(metodo) ? 'Efectivo' : 'Banco';
  const ok = window.confirm(
    `¿Borrar este aporte de ${fmtCLP(monto)}?\n\n` +
    `Al borrarlo, ese monto se DESCONTARÁ automáticamente del saldo de ${canal}, ` +
    `porque el aporte dejará de contar.\n\n` +
    `Esta acción no se puede deshacer.`
  );
  if (!ok) return;

  // El endpoint exige PIN de admin
  const pin = window.prompt('Confirma tu PIN de administrador para borrar el aporte:');
  if (!pin) return;

  try {
    await API.balance.eliminarInyeccion(id, pin.trim());
    showToast('Aporte borrado · saldo actualizado', 'ok');
    cargarHistorialAportes();
    if (typeof cargarSaldosCanales === 'function') cargarSaldosCanales();
  } catch (err) {
    showToast(err.message || 'No se pudo borrar el aporte', 'err');
  }
}
