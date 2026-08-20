// ==========================================
// GASTOS-PROGRAMADOS.JS — Gastos pendientes / cuotas (tarjeta de crédito)
// ------------------------------------------
// Registra hoy una compra que se pagará en el futuro (tarjeta de crédito,
// cuotas). Queda PENDIENTE con su fecha; al llegar esa fecha se materializa
// sola como una compra real en Gastos.
//
// La materialización de los vencidos la dispara el backend cuando el
// frontend llama a procesarVencidos() — lo hacemos al abrir Finanzas y al
// abrir este modal, así el negocio ve el gasto justo cuando toca.
//
// Reutiliza clasificacionesList (de compras.js) para el select y escHtml
// (config.js) para escapar todo dato de usuario.
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnGastosPendientes')?.addEventListener('click', abrirGastosPendientes);
  document.getElementById('btnCerrarProgramados')?.addEventListener('click', () => cerrarModal('modalGastosPendientes'));
  document.getElementById('btnAgregarProgramado')?.addEventListener('click', agregarProgramado);

  // Aviso en vivo del reparto de cuotas
  const recalcAviso = () => {
    const monto = num(document.getElementById('progMonto')?.value);
    const cuotas = Math.max(1, parseInt(document.getElementById('progCuotas')?.value, 10) || 1);
    const aviso = document.getElementById('progAvisoCuotas');
    if (!aviso) return;
    if (cuotas > 1 && monto > 0) {
      aviso.style.display = 'block';
      aviso.textContent = `Se crearán ${cuotas} cuotas de ~${fmtCLP(Math.round(monto / cuotas))}, una por mes.`;
    } else {
      aviso.style.display = 'none';
    }
  };
  document.getElementById('progMonto')?.addEventListener('input', recalcAviso);
  document.getElementById('progCuotas')?.addEventListener('input', recalcAviso);

  document.getElementById('modalGastosPendientes')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalGastosPendientes') cerrarModal('modalGastosPendientes');
  });

  // Al abrir Finanzas, materializar lo que haya vencido (sin molestar si no hay nada)
  document.addEventListener('pos:vista-activa', (e) => {
    if (e.detail?.vista === 'view-finanzas') procesarVencidosSilencioso();
  });
});

async function procesarVencidosSilencioso() {
  try {
    const r = await API.compras.procesarVencidos();
    if (r && r.aplicados > 0) {
      showToast(`${r.aplicados} gasto(s) programado(s) se cargaron hoy`, 'ok');
      if (typeof cargarCompras === 'function') cargarCompras();
    }
  } catch (_) { /* silencioso: no molesta si falla */ }
}

async function abrirGastosPendientes() {
  if (!esAdmin()) { showToast('Solo el administrador gestiona los gastos', 'err'); return; }

  // Llenar el select de clasificación reutilizando las de compras.js
  const sel = document.getElementById('progClasificacion');
  if (sel && typeof clasificacionesList !== 'undefined') {
    const activas = clasificacionesList.filter(c => c.activo);
    sel.innerHTML = activas.length
      ? activas.map(c => `<option value="${escHtml(c.nombre)}">${escHtml(c.nombre)}</option>`).join('')
      : '<option value="">(sin clasificaciones)</option>';
  }
  // Limpiar el formulario
  ['progProveedor', 'progMonto'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const cuotas = document.getElementById('progCuotas'); if (cuotas) cuotas.value = '1';
  const fecha = document.getElementById('progFecha'); if (fecha) fecha.value = '';
  const aviso = document.getElementById('progAvisoCuotas'); if (aviso) aviso.style.display = 'none';

  document.getElementById('modalGastosPendientes')?.classList.add('show');

  // Materializar vencidos y luego listar
  await procesarVencidosSilencioso();
  cargarProgramados();
}

async function cargarProgramados() {
  const caja = document.getElementById('progLista');
  if (!caja) return;
  caja.innerHTML = '<p class="modal-hint">Cargando…</p>';
  try {
    const lista = await API.compras.listarProgramados('pendiente');
    if (!lista.length) {
      caja.innerHTML = '<p class="modal-hint">No hay gastos pendientes. Los que programes aparecerán aquí ordenados por fecha.</p>';
      return;
    }

    const hoy = (typeof todayISO === 'function') ? todayISO() : new Date().toISOString().slice(0, 10);
    caja.innerHTML = lista.map(g => {
      const venc = g.fecha_vencimiento || '';
      const proximo = venc <= hoy;
      const cuotaTxt = g.cuota_total ? ` · cuota ${g.cuota_numero}/${g.cuota_total}` : '';
      return `
        <div class="prog-fila${proximo ? ' prog-vence' : ''}">
          <div class="prog-info">
            <b>${fmtCLP(num(g.monto))}</b>
            <span>${escHtml(g.proveedor || 'Gasto')}${cuotaTxt}</span>
            <small>${escHtml(g.clasificacion || '')} · ${escHtml(g.metodo_pago || '')}</small>
          </div>
          <div class="prog-fecha">
            <span class="prog-venc-badge${proximo ? ' vence-ya' : ''}">📅 ${escHtml(venc)}</span>
            <button class="btn btn-icon btn-icon-del" data-cancelar-prog="${g.id}" title="Cancelar este gasto programado">🗑️</button>
          </div>
        </div>`;
    }).join('');

    caja.querySelectorAll('[data-cancelar-prog]').forEach(btn => {
      btn.addEventListener('click', () => cancelarProgramado(btn.dataset.cancelarProg));
    });
  } catch (err) {
    caja.innerHTML = `<p class="modal-hint" style="color:var(--red);">${escHtml(err.message || 'Error al cargar')}</p>`;
  }
}

async function agregarProgramado() {
  const proveedor = (document.getElementById('progProveedor')?.value || '').trim();
  const clasificacion = document.getElementById('progClasificacion')?.value || '';
  const monto = num(document.getElementById('progMonto')?.value);
  const cuotas = Math.max(1, parseInt(document.getElementById('progCuotas')?.value, 10) || 1);
  const fecha_vencimiento = document.getElementById('progFecha')?.value || '';
  const metodo_pago = document.getElementById('progMetodo')?.value || 'Tarjeta Crédito';

  if (!clasificacion) { showToast('Elige una clasificación', 'err'); return; }
  if (monto <= 0) { showToast('El monto debe ser mayor a 0', 'err'); return; }
  if (!fecha_vencimiento) { showToast('Indica la primera fecha de pago', 'err'); return; }

  const btn = document.getElementById('btnAgregarProgramado');
  if (btn) btn.disabled = true;
  try {
    const r = await API.compras.crearProgramado({ proveedor, clasificacion, monto, cuotas, fecha_vencimiento, metodo_pago });
    showToast(cuotas > 1 ? `${cuotas} cuotas programadas` : 'Gasto programado', 'ok');
    ['progProveedor', 'progMonto'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const c = document.getElementById('progCuotas'); if (c) c.value = '1';
    const av = document.getElementById('progAvisoCuotas'); if (av) av.style.display = 'none';
    cargarProgramados();
  } catch (err) {
    showToast(err.message || 'No se pudo programar el gasto', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function cancelarProgramado(id) {
  if (!confirm('¿Cancelar este gasto programado? No se cargará a Gastos cuando llegue su fecha.')) return;
  try {
    await API.compras.cancelarProgramado(id);
    showToast('Gasto programado cancelado', 'ok');
    cargarProgramados();
  } catch (err) {
    showToast(err.message || 'No se pudo cancelar', 'err');
  }
}
