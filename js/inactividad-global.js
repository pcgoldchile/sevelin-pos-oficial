// ==========================================
// INACTIVIDAD-GLOBAL.JS — cierre de sesión automático por inactividad
// ------------------------------------------
// Pedido explícito del negocio: sin ninguna interacción en el POS
// durante 1 minuto, la sesión se cierra sola (vuelve a la pantalla del
// PIN de acceso). Corre en TODA la app mientras haya una sesión abierta
// (rol admin o trabajador) — no antes de loguearse, y se apaga solo al
// entrar de nuevo al PIN, porque ahí ya no hay sesión que cerrar.
//
// Mismo idioma de "actividad" que ya usa finanzas-gate.js para su propio
// timer de 60s dentro de Finanzas (mousemove/click/keydown/touchstart) —
// pero este es un módulo aparte a propósito: Finanzas expulsa solo al POS
// (sigue con la sesión abierta), esto cierra la sesión entera.
// ==========================================

const INACTIVIDAD_GLOBAL_MS = 60000;
const INACTIVIDAD_GLOBAL_EVENTOS = ['mousemove', 'click', 'keydown', 'touchstart'];

let inactividadGlobalTimer = null;

function haySesionAbierta() {
  return document.body.classList.contains('role-admin') || document.body.classList.contains('role-trabajador');
}

function reiniciarTimerInactividadGlobal() {
  clearTimeout(inactividadGlobalTimer);
  if (!haySesionAbierta()) return;
  inactividadGlobalTimer = setTimeout(() => {
    // Se revisa de nuevo al disparar (no solo al programar): si cerró
    // sesión por su cuenta en el medio, no hay nada que hacer acá.
    if (!haySesionAbierta()) return;
    if (typeof cerrarSesion === 'function') cerrarSesion();
  }, INACTIVIDAD_GLOBAL_MS);
}

document.addEventListener('DOMContentLoaded', () => {
  INACTIVIDAD_GLOBAL_EVENTOS.forEach(ev => document.addEventListener(ev, reiniciarTimerInactividadGlobal));
  // Al loguearse no hay un evento de "actividad" real (fue un submit), y
  // sin esto el timer no arrancaba hasta el primer mousemove/click.
  document.addEventListener('pos:sesion-iniciada', reiniciarTimerInactividadGlobal);
});
