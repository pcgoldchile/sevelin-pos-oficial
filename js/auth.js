// ==========================================
// AUTH.JS - Login por PIN, roles y cierre de sesión
// ------------------------------------------
// El PIN se valida en el servidor (/api/login). Aquí solo guardamos el
// token en sessionStorage: al cerrar la pestaña o el navegador la sesión
// se pierde y vuelve a pedirse el PIN. El botón "Cerrar Sesión" está
// siempre disponible para salir antes.
// ==========================================

const elModalLogin = document.getElementById('modalLogin');
const elFormLogin = document.getElementById('formLogin');
const elPinInput = document.getElementById('pinInput');
const elLoginError = document.getElementById('loginError');
const elBtnLogout = document.getElementById('btnLogout');
const elRoleBadge = document.getElementById('userRoleBadge');
const elBtnIngresar = document.getElementById('btnIngresar');

document.addEventListener('DOMContentLoaded', () => {
  if (elFormLogin) elFormLogin.addEventListener('submit', manejarLogin);
  if (elBtnLogout) elBtnLogout.addEventListener('click', cerrarSesion);
  if (elPinInput) elPinInput.addEventListener('input', () => ocultarErrorLogin());

  restaurarSesion();
});

/* Si quedó un token válido en la pestaña, se reanuda sin pedir el PIN */
async function restaurarSesion() {
  if (!tokenActual()) { mostrarLogin(); return; }

  try {
    const datos = await API.me();
    aplicarRol(datos.rol);
    ocultarLogin();
    document.dispatchEvent(new CustomEvent('pos:sesion-iniciada', { detail: { rol: datos.rol } }));
  } catch (_) {
    borrarSesion();
    mostrarLogin();
  }
}

async function manejarLogin(e) {
  e.preventDefault();
  const pin = (elPinInput?.value || '').trim();
  if (!pin) return;

  if (elBtnIngresar) { elBtnIngresar.disabled = true; elBtnIngresar.textContent = 'Verificando…'; }

  try {
    const datos = await API.login(pin);
    guardarSesion(datos.token, datos.rol);
    if (datos.negocio) window.NEGOCIO_NOMBRE = datos.negocio;

    aplicarRol(datos.rol);
    if (elPinInput) elPinInput.value = '';
    ocultarErrorLogin();
    ocultarLogin();

    showToast(datos.rol === 'admin' ? 'Bienvenido, administrador' : 'Sesión iniciada', 'ok');
    document.dispatchEvent(new CustomEvent('pos:sesion-iniciada', { detail: { rol: datos.rol } }));
  } catch (err) {
    mostrarErrorLogin(err.message || 'PIN incorrecto. Reintenta.');
    if (elPinInput) elPinInput.value = '';
    /* Corta el auto-envío pendiente: sin esto, limpiar el campo podía
       encadenar reintentos y disparar el freno anti-fuerza bruta. */
    document.dispatchEvent(new CustomEvent('pos:login-fallido'));
  } finally {
    if (elBtnIngresar) { elBtnIngresar.disabled = false; elBtnIngresar.textContent = 'Ingresar'; }
  }
}

function cerrarSesion() {
  borrarSesion();
  document.body.classList.remove('role-admin', 'role-trabajador');
  if (elRoleBadge) { elRoleBadge.textContent = 'Invitado'; elRoleBadge.className = 'badge badge-blue'; }
  mostrarLogin();
  showToast('Sesión cerrada', '');
}

/* Llamado desde api.js cuando el backend responde 401 */
function manejarSesionExpirada() {
  document.body.classList.remove('role-admin', 'role-trabajador');
  mostrarLogin();
  mostrarErrorLogin('Tu sesión expiró. Ingresa el PIN nuevamente.');
}

function aplicarRol(rol) {
  document.body.classList.remove('role-admin', 'role-trabajador');
  document.body.classList.add('role-' + rol);

  if (elRoleBadge) {
    elRoleBadge.textContent = rol === 'admin' ? 'ADMIN' : 'TRABAJADOR';
    elRoleBadge.className = 'badge ' + (rol === 'admin' ? 'badge-gold' : 'badge-blue');
  }

  // Si el trabajador estaba parado en una pestaña de solo-admin, se devuelve al POS
  const vistaActiva = document.querySelector('.view-section.active');
  if (rol !== 'admin' && vistaActiva && vistaActiva.classList.contains('admin-only')) {
    const btnPos = document.querySelector('.nav-btn[data-view="view-pos"]');
    if (btnPos) btnPos.click();
  }
}

function mostrarLogin() {
  if (!elModalLogin) return;
  elModalLogin.classList.add('show');
  setTimeout(() => elPinInput?.focus(), 60);
}

function ocultarLogin() {
  if (elModalLogin) elModalLogin.classList.remove('show');
}

function mostrarErrorLogin(msg) {
  if (!elLoginError) return;
  elLoginError.textContent = msg;
  elLoginError.classList.remove('hidden');
}

function ocultarErrorLogin() {
  if (elLoginError) elLoginError.classList.add('hidden');
}
