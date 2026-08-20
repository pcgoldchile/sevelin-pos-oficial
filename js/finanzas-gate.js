// ==========================================
// FINANZAS-GATE.JS — PIN + inactividad para Finanzas (vista sensible)
// ------------------------------------------
// Finanzas pide el PIN de admin al entrar, salvo que el usuario haya
// estado ahí (autenticado o activo) hace menos de 60s: esa es la
// "ventana de gracia". Además, mientras está DENTRO de Finanzas, si pasan
// 60s sin ninguna interacción (mousemove/click/keydown/touchstart), se lo
// redirige solo al POS.
//
// Ambas reglas comparten un mismo timestamp, `finanzasUltimaActividad`:
// - Se fija al autenticar con el PIN y en cada interacción mientras la
//   vista está activa.
// - La ventana de gracia para re-entrar sin PIN se mide contra ese mismo
//   timestamp (por eso, si lo sacó el timer de inactividad, ya está
//   vencida: no hay "puerta trasera" para el auto-logout).
//
// CÓMO FUNCIONA EL GATE DE PIN
// El botón "Finanzas" del menú tiene su listener en config.js
// (initNavegacion). Para no reescribir esa navegación, este módulo
// intercepta el clic en FASE DE CAPTURA (antes de que burbujee al
// listener de config.js). Si no hay acceso vigente, detiene el evento,
// muestra el gate y — solo si el PIN es correcto — reenvía el clic para
// que la navegación siga normal.
// ==========================================

const FINANZAS_GRACIA_MS = 60000;        // ventana de gracia para re-entrar sin PIN
const FINANZAS_INACTIVIDAD_MS = 60000;   // tiempo sin interacción antes de expulsar al POS
const FINANZAS_EVENTOS_ACTIVIDAD = ['mousemove', 'click', 'keydown', 'touchstart'];

let finanzasUltimaActividad = 0;   // timestamp del último PIN válido o interacción en Finanzas
let finanzasTimerInactividad = null;

function finanzasAccesoVigente() {
  return (Date.now() - finanzasUltimaActividad) < FINANZAS_GRACIA_MS;
}

function finanzasVistaActiva() {
  return document.getElementById('view-finanzas')?.classList.contains('active') || false;
}

function marcarActividadFinanzas() {
  finanzasUltimaActividad = Date.now();
  clearTimeout(finanzasTimerInactividad);
  finanzasTimerInactividad = setTimeout(finanzasExpulsarPorInactividad, FINANZAS_INACTIVIDAD_MS);
}

function finanzasExpulsarPorInactividad() {
  if (!finanzasVistaActiva()) return;
  if (typeof showToast === 'function') showToast('Finanzas se cerró por inactividad');
  document.querySelector('.nav-links .nav-btn[data-view="view-pos"]')?.click();
}

function activarVigilanciaFinanzas() {
  marcarActividadFinanzas();
  FINANZAS_EVENTOS_ACTIVIDAD.forEach(ev => document.addEventListener(ev, marcarActividadFinanzas));
}

function desactivarVigilanciaFinanzas() {
  FINANZAS_EVENTOS_ACTIVIDAD.forEach(ev => document.removeEventListener(ev, marcarActividadFinanzas));
  clearTimeout(finanzasTimerInactividad);
  finanzasTimerInactividad = null;
}

document.addEventListener('DOMContentLoaded', () => {
  const btnFinanzas = document.querySelector('.nav-links .nav-btn[data-view="view-finanzas"]');
  if (!btnFinanzas) return;

  /* Intercepta en captura (true): corre ANTES del listener de navegación
     de config.js. Si no hay acceso vigente, corta aquí mismo. */
  btnFinanzas.addEventListener('click', (e) => {
    if (finanzasAccesoVigente()) return;             // PIN reciente o dentro de la ventana de gracia
    if (!esAdmin()) return;                          // el trabajador lo bloquea config.js
    e.preventDefault();
    e.stopPropagation();
    abrirGateFinanzas();
  }, true);

  // Al entrar/salir de Finanzas se activa o apaga la vigilancia de inactividad
  document.addEventListener('pos:vista-activa', (ev) => {
    if (ev.detail?.vista === 'view-finanzas') activarVigilanciaFinanzas();
    else desactivarVigilanciaFinanzas();
  });

  // Cerrar sesión revoca el acceso vigente y apaga la vigilancia
  document.getElementById('btnLogout')?.addEventListener('click', () => {
    finanzasUltimaActividad = 0;
    desactivarVigilanciaFinanzas();
  });

  // --- Controles del modal del gate ---
  const input = document.getElementById('gatePin');
  const err = document.getElementById('gateError');

  document.getElementById('btnGateEntrar')?.addEventListener('click', intentarEntrarFinanzas);
  document.getElementById('btnGateCancelar')?.addEventListener('click', cerrarGateFinanzas);

  document.getElementById('gateVerPin')?.addEventListener('click', () => {
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    input.focus();
  });

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); intentarEntrarFinanzas(); }
    if (e.key === 'Escape') { e.preventDefault(); cerrarGateFinanzas(); }
  });
  input?.addEventListener('input', () => { if (err) err.style.display = 'none'; });
});

function abrirGateFinanzas() {
  const modal = document.getElementById('modalGateFinanzas');
  const input = document.getElementById('gatePin');
  const err = document.getElementById('gateError');
  if (!modal) return;
  if (input) { input.value = ''; input.type = 'password'; }
  if (err) err.style.display = 'none';
  modal.classList.add('show');
  setTimeout(() => input?.focus(), 80);
}

function cerrarGateFinanzas() {
  document.getElementById('modalGateFinanzas')?.classList.remove('show');
  const input = document.getElementById('gatePin');
  if (input) input.value = '';
}

async function intentarEntrarFinanzas() {
  const input = document.getElementById('gatePin');
  const err = document.getElementById('gateError');
  const btn = document.getElementById('btnGateEntrar');
  const pin = (input?.value || '').trim();
  if (!pin) { input?.focus(); return; }

  if (btn) btn.disabled = true;
  try {
    await API.balance.verificarPin(pin);          // 200 solo si el PIN es correcto
    finanzasUltimaActividad = Date.now();
    cerrarGateFinanzas();
    /* Se reenvía el clic al botón: ahora hay acceso vigente, así que el
       interceptor lo deja pasar y config.js hace la navegación. */
    document.querySelector('.nav-links .nav-btn[data-view="view-finanzas"]')?.click();
  } catch (e) {
    if (err) {
      err.textContent = e.message && /incorrecto|intentos/i.test(e.message)
        ? e.message : 'PIN incorrecto.';
      err.style.display = 'block';
    }
    if (input) { input.value = ''; input.focus(); }
  } finally {
    if (btn) btn.disabled = false;
  }
}
