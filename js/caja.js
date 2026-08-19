// ==========================================
// CAJA.JS — Apertura, caja chica y arqueo en el POS (punto 4)
// ------------------------------------------
// Un turno de caja se abre con un fondo inicial. Sin caja abierta, el
// botón de cobrar se bloquea. Durante el turno se registran movimientos
// rápidos (ingresos/egresos). Al cerrar, se arquea: el sistema calcula el
// efectivo esperado y el cajero ingresa el contado real.
//
// El backend es la fuente de verdad: el efectivo esperado se calcula en el
// servidor (endpoint /caja/cerrar). Aquí solo se muestra y se envía lo que
// el cajero cuenta.
// ==========================================

let cajaActivaActual = null;      // objeto de la caja abierta, o null
let cajaMovTipo = 'EGRESO';       // tipo seleccionado en el modal de movimiento

// El POS consulta esto antes de cobrar (definida global para pos.js)
function hayCajaAbierta() { return !!cajaActivaActual; }

document.addEventListener('DOMContentLoaded', () => {
  // Barra
  document.getElementById('btnAbrirCajaPos')?.addEventListener('click', abrirModalApertura);
  document.getElementById('btnMovimientoCaja')?.addEventListener('click', abrirModalMovimiento);
  document.getElementById('btnCerrarCajaPos')?.addEventListener('click', abrirModalCierre);

  // Modal apertura
  document.getElementById('btnConfirmarApertura')?.addEventListener('click', confirmarApertura);
  document.getElementById('btnCancelarApertura')?.addEventListener('click', () => cerrarModal('modalAperturaPos'));

  // Modal movimiento
  document.getElementById('btnConfirmarMovimiento')?.addEventListener('click', confirmarMovimiento);
  document.getElementById('btnCancelarMovimiento')?.addEventListener('click', () => cerrarModal('modalMovimientoCaja'));
  document.querySelectorAll('[data-mov-tipo]').forEach(btn => {
    btn.addEventListener('click', () => {
      cajaMovTipo = btn.dataset.movTipo;
      document.querySelectorAll('[data-mov-tipo]').forEach(b =>
        b.classList.toggle('activo', b === btn));
    });
  });

  // Modal cierre
  document.getElementById('btnConfirmarCierre')?.addEventListener('click', confirmarCierre);
  document.getElementById('btnCancelarCierre')?.addEventListener('click', () => cerrarModal('modalCierrePos'));
  document.getElementById('cierreContado')?.addEventListener('input', recalcularDiferenciaCierre);

  // Al entrar al POS se verifica el estado de la caja
  document.addEventListener('pos:vista-activa', (ev) => {
    if (ev.detail?.vista === 'view-pos') verificarCaja();
  });

  // Cargar el estado al iniciar (el POS es la vista por defecto)
  verificarCaja();
});

/* Consulta al backend si hay un turno abierto y actualiza la barra. */
async function verificarCaja() {
  try {
    const r = await API.balance.cajaActiva();
    cajaActivaActual = r?.activa || null;
    if (cajaActivaActual) cajaActivaActual._movimientos = r.movimientos || [];
    pintarBarraCaja();
  } catch (e) {
    console.warn('No se pudo verificar la caja:', e.message || e);
    // Ante un fallo de red no se bloquea el POS: se asume operable
    pintarBarraCaja();
  }
}

function pintarBarraCaja() {
  const punto = document.getElementById('cajaEstadoPunto');
  const titulo = document.getElementById('cajaBarraTitulo');
  const sub = document.getElementById('cajaBarraSub');
  const btnAbrir = document.getElementById('btnAbrirCajaPos');
  const btnMov = document.getElementById('btnMovimientoCaja');
  const btnCerrar = document.getElementById('btnCerrarCajaPos');

  if (cajaActivaActual) {
    const desde = cajaActivaActual.fecha_apertura
      ? new Date(cajaActivaActual.fecha_apertura).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '';
    if (punto) punto.className = 'caja-estado-punto abierta';
    if (titulo) titulo.textContent = 'Caja abierta';
    if (sub) sub.textContent = `Fondo: ${fmtCLP(num(cajaActivaActual.fondo_inicial))} · desde ${desde}`;
    if (btnAbrir) btnAbrir.style.display = 'none';
    if (btnMov) btnMov.style.display = '';
    if (btnCerrar) btnCerrar.style.display = '';
  } else {
    if (punto) punto.className = 'caja-estado-punto cerrada';
    if (titulo) titulo.textContent = 'Caja cerrada';
    if (sub) sub.textContent = 'Abre la caja para poder registrar cobros.';
    if (btnAbrir) btnAbrir.style.display = '';
    if (btnMov) btnMov.style.display = 'none';
    if (btnCerrar) btnCerrar.style.display = 'none';
  }

  /* Bloqueo visual del botón de cobrar según el estado de la caja. El
     bloqueo funcional (al hacer clic) vive en pos.js; esto es solo para
     que se vea deshabilitado y el cajero entienda por qué. */
  const btnCobrar = document.getElementById('btnFinalizarVenta');
  const btnDiv = document.getElementById('btnDividirVenta');
  const bloquear = !cajaActivaActual;
  [btnCobrar, btnDiv].forEach(b => {
    if (!b) return;
    b.disabled = bloquear;
    b.classList.toggle('bloqueado-sin-caja', bloquear);
    if (bloquear) b.title = 'Abre la caja para poder cobrar';
    else b.removeAttribute('title');
  });
}

/* ---------- Apertura ---------- */
function abrirModalApertura() {
  const input = document.getElementById('aperturaFondo');
  if (input) input.value = '';
  document.getElementById('modalAperturaPos')?.classList.add('show');
  setTimeout(() => input?.focus(), 80);
}

async function confirmarApertura() {
  const fondo = num(document.getElementById('aperturaFondo')?.value);
  if (fondo < 0) { showToast('El fondo no puede ser negativo', 'err'); return; }

  const btn = document.getElementById('btnConfirmarApertura');
  if (btn) btn.disabled = true;
  try {
    cajaActivaActual = await API.balance.abrirCajaTurno(fondo);
    cerrarModal('modalAperturaPos');
    pintarBarraCaja();
    showToast(`Caja abierta con ${fmtCLP(fondo)}`, 'ok');
  } catch (err) {
    showToast(err.message || 'No se pudo abrir la caja', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ---------- Movimiento rápido ---------- */
function abrirModalMovimiento() {
  if (!cajaActivaActual) { showToast('Primero abre la caja', 'err'); return; }
  cajaMovTipo = 'EGRESO';
  document.querySelectorAll('[data-mov-tipo]').forEach(b =>
    b.classList.toggle('activo', b.dataset.movTipo === 'EGRESO'));
  const m = document.getElementById('movMonto'); if (m) m.value = '';
  const c = document.getElementById('movConcepto'); if (c) c.value = '';
  document.getElementById('modalMovimientoCaja')?.classList.add('show');
  setTimeout(() => m?.focus(), 80);
}

async function confirmarMovimiento() {
  const monto = num(document.getElementById('movMonto')?.value);
  const concepto = (document.getElementById('movConcepto')?.value || '').trim();
  if (!(monto > 0)) { showToast('El monto debe ser mayor a 0', 'err'); return; }
  if (concepto.length < 2) { showToast('Escribe un concepto', 'err'); return; }

  const btn = document.getElementById('btnConfirmarMovimiento');
  if (btn) btn.disabled = true;
  try {
    await API.balance.movimientoCaja({ tipo: cajaMovTipo, monto, concepto });
    cerrarModal('modalMovimientoCaja');
    showToast(cajaMovTipo === 'INGRESO' ? 'Ingreso registrado' : 'Egreso registrado', 'ok');
    verificarCaja();   // refresca los movimientos del turno
  } catch (err) {
    showToast(err.message || 'No se pudo registrar el movimiento', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ---------- Cierre y arqueo ---------- */
async function abrirModalCierre() {
  if (!cajaActivaActual) { showToast('No hay caja abierta', 'err'); return; }

  // Se calcula un estimado local para mostrar; el backend recalcula al cerrar
  const fondo = num(cajaActivaActual.fondo_inicial);
  const movs = cajaActivaActual._movimientos || [];
  let ingresos = 0, egresos = 0;
  movs.forEach(m => { if (m.tipo === 'INGRESO') ingresos += num(m.monto); else egresos += num(m.monto); });

  // Ventas en efectivo del turno: se piden al backend vía saldos no; se
  // estiman en 0 aquí y el backend entrega la cifra real al cerrar. Para
  // que el cajero vea algo útil, se muestran los componentes conocidos.
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = fmtCLP(v); };
  set('cierreFondo', fondo);
  set('cierreVentas', 0);        // se completa con la respuesta del backend
  set('cierreIngresos', ingresos);
  set('cierreEgresos', egresos);
  set('cierreEsperado', fondo + ingresos - egresos);

  const contado = document.getElementById('cierreContado'); if (contado) contado.value = '';
  const notas = document.getElementById('cierreNotas'); if (notas) notas.value = '';
  document.getElementById('cierreDiferenciaCaja')?.classList.add('hidden');

  document.getElementById('modalCierrePos')?.classList.add('show');
}

function recalcularDiferenciaCierre() {
  const esperadoTxt = document.getElementById('cierreEsperado')?.textContent || '0';
  // Se reconstruye el número desde el texto formateado
  const esperado = num(esperadoTxt.replace(/[^\d-]/g, ''));
  const contado = num(document.getElementById('cierreContado')?.value);
  const cont = document.getElementById('cierreDiferenciaCaja');
  const label = document.getElementById('cierreDiferenciaLabel');
  const valor = document.getElementById('cierreDiferenciaValor');
  if (!cont) return;

  if (!document.getElementById('cierreContado')?.value) { cont.classList.add('hidden'); return; }
  const dif = contado - esperado;
  cont.classList.remove('hidden');
  cont.className = 'arqueo-diferencia ' + (dif === 0 ? 'cuadre-ok' : dif > 0 ? 'cuadre-sobra' : 'cuadre-falta');
  if (label) label.textContent = dif === 0 ? 'Cuadra exacto' : dif > 0 ? 'Sobra' : 'Falta';
  if (valor) valor.textContent = fmtCLP(Math.abs(dif));
}

async function confirmarCierre() {
  const contado = num(document.getElementById('cierreContado')?.value);
  const notas = (document.getElementById('cierreNotas')?.value || '').trim();
  if (!document.getElementById('cierreContado')?.value) { showToast('Ingresa el efectivo contado', 'err'); return; }

  const btn = document.getElementById('btnConfirmarCierre');
  if (btn) btn.disabled = true;
  try {
    const r = await API.balance.cerrarCajaTurno({ efectivo_contado: contado, notas_cierre: notas });
    cajaActivaActual = null;
    cerrarModal('modalCierrePos');
    pintarBarraCaja();

    const d = r?.detalle || {};
    const dif = num(d.diferencia);
    const msg = dif === 0 ? 'Caja cerrada · cuadró exacto'
      : dif > 0 ? `Caja cerrada · sobró ${fmtCLP(dif)}`
      : `Caja cerrada · faltó ${fmtCLP(Math.abs(dif))}`;
    showToast(msg, dif === 0 ? 'ok' : 'err');
  } catch (err) {
    showToast(err.message || 'No se pudo cerrar la caja', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}
