// ==========================================
// FINANZAS-GATE.JS — PIN obligatorio al entrar a Finanzas (req. 1)
// ------------------------------------------
// Finanzas pide el PIN de admin CADA vez que se entra, aunque la sesión
// ya esté abierta y aunque se acabe de salir y volver. Si el usuario va a
// otro módulo y regresa, se pide de nuevo.
//
// CÓMO FUNCIONA
// El botón "Finanzas" del menú tiene su listener en config.js
// (initNavegacion). Para no reescribir esa navegación, este módulo
// intercepta el clic en FASE DE CAPTURA (antes de que burbujee al
// listener de config.js). Si el acceso no está concedido para esta
// visita, detiene el evento, muestra el gate y — solo si el PIN es
// correcto — reenvía el clic para que la navegación siga normal.
//
// El "permiso" es de un solo uso: se consume al entrar y se revoca al
// salir de Finanzas, así volver a entrar exige el PIN otra vez.
// ==========================================

let finanzasDesbloqueada = false;   // permiso para ESTA visita, se revoca al salir

document.addEventListener('DOMContentLoaded', () => {
  const btnFinanzas = document.querySelector('.nav-links .nav-btn[data-view="view-finanzas"]');
  if (!btnFinanzas) return;

  /* Intercepta en captura (true): corre ANTES del listener de navegación
     de config.js. Si no hay permiso, corta aquí mismo. */
  btnFinanzas.addEventListener('click', (e) => {
    if (finanzasDesbloqueada) return;              // ya autorizado en esta visita
    if (!esAdmin()) return;                         // el trabajador lo bloquea config.js
    e.preventDefault();
    e.stopPropagation();
    abrirGateFinanzas();
  }, true);

  // Al SALIR de Finanzas (entrar a cualquier otra vista) se revoca el permiso
  document.addEventListener('pos:vista-activa', (ev) => {
    if (ev.detail?.vista && ev.detail.vista !== 'view-finanzas') {
      finanzasDesbloqueada = false;
    }
  });

  // Cerrar sesión también revoca
  document.getElementById('btnLogout')?.addEventListener('click', () => { finanzasDesbloqueada = false; });

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
    finanzasDesbloqueada = true;
    cerrarGateFinanzas();
    /* Se reenvía el clic al botón: ahora finanzasDesbloqueada es true, así
       que el interceptor lo deja pasar y config.js hace la navegación. */
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
