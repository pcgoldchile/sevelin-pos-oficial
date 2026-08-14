// ==========================================
// PINPAD.JS - Campo de acceso (PIN o contraseña)
// ------------------------------------------
// HISTORIA DE ESTE ARCHIVO (v6)
// ------------------------------------------
// Antes esto era un teclado numérico en pantalla (botones del 0 al 9) que
// escribía en un #pinInput oculto, más una fila de puntos que mostraba el
// avance. Se eliminó por completo y ahora hay UN campo de texto normal.
//
// Tres bugs murieron con ese cambio:
//
//   1. EL CÍRCULO FANTASMA. `refrescar()` pintaba `n + 1` puntos: los
//      dígitos escritos MÁS uno vacío de guía. Al completar un PIN de 4
//      aparecía un quinto círculo por unos instantes, justo antes de que
//      el auto-envío entrara. No era un fallo de la validación: era la
//      guía haciendo su trabajo en el peor momento posible.
//
//   2. LOS PUNTOS QUE SOBREVIVÍAN AL LOGOUT. `cerrarSesion()` borraba el
//      token y volvía a mostrar el modal, pero nadie limpiaba #pinInput
//      ni repintaba los puntos. Volvías a la pantalla de acceso con los
//      4 círculos todavía llenos, como si el PIN anterior siguiera
//      escrito. Ahora el campo se limpia en un solo lugar
//      (`limpiarCampoPin`) al que llaman login, logout y expiración.
//
//   3. DÍGITOS DUPLICADOS. El input viejo estaba oculto con `sr-only`
//      pero seguía siendo enfocable, así que al teclear un 9 el navegador
//      lo escribía Y ADEMÁS el manejador lo agregaba a mano. Con un campo
//      visible y normal el navegador es el único que escribe.
//
// Se conserva el auto-envío por pausa, que sí era útil: el sistema no
// conoce el largo del PIN (vive en las variables de entorno del servidor
// y difiere entre admin y trabajador), así que no puede enviar "al llegar
// a N caracteres" sin adivinar. Espera a que dejes de teclear.
// ==========================================

const LARGO_MAXIMO_PIN = 64;

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('pinInput');
  const btnOjo = document.getElementById('btnVerPin');
  if (!input) return;

  /* Auto-validación por pausa.
     ------------------------------------------------------------
     Con 4 caracteres o más y 600 ms sin teclear, el formulario se envía
     solo. Al escribir de corrido, una clave de 8 nunca se manda al
     llegar a 4 porque no hay pausa; al terminar, entra sin tocar nada.

     La pausa subió de 450 ms a 600 ms: ahora que se admiten letras, la
     clave es más larga y se teclea con más pausas naturales entre
     caracteres. Con 450 ms se disparaban intentos a medio escribir, y
     el backend lleva un contador anti-fuerza bruta.

     El envío se cancela con cada tecla nueva, así que borrar y corregir
     no dispara un intento en falso. */
  const MINIMO_AUTO = 4;
  const PAUSA_AUTO_MS = 600;
  let tempAuto = null;

  const cancelarAuto = () => { if (tempAuto) { clearTimeout(tempAuto); tempAuto = null; } };

  const programarAuto = () => {
    cancelarAuto();
    if ((input.value || '').length < MINIMO_AUTO) return;
    tempAuto = setTimeout(() => {
      const form = document.getElementById('formLogin');
      const btn = document.getElementById('btnIngresar');
      // No reenviar si ya hay una verificación en curso
      if (!form || (btn && btn.disabled)) return;
      form.requestSubmit
        ? form.requestSubmit()
        : form.dispatchEvent(new Event('submit', { cancelable: true }));
    }, PAUSA_AUTO_MS);
  };

  const refrescar = () => {
    const btn = document.getElementById('btnIngresar');
    if (btn) btn.disabled = (input.value || '').length === 0;
    programarAuto();
  };

  input.addEventListener('input', () => { ocultarError(); refrescar(); });

  /* Escape limpia el campo sin cerrar nada: es el gesto natural cuando
     te equivocaste a medio escribir. */
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); input.value = ''; refrescar(); }
  });

  /* Ver / ocultar. Útil en el mostrador cuando la clave lleva letras y
     símbolos: escribirla a ciegas y equivocarse gasta un intento. */
  if (btnOjo) {
    btnOjo.addEventListener('click', () => {
      const oculto = input.type === 'password';
      input.type = oculto ? 'text' : 'password';
      btnOjo.textContent = oculto ? '🙈' : '👁️';
      btnOjo.classList.toggle('activo', oculto);
      input.focus();
    });
  }

  window.__cancelarAutoPin = cancelarAuto;
  refrescar();
});

/* auth.js avisa cuando el PIN falló, para cortar el auto-envío y que no
   se reintente solo en bucle contra el freno anti-fuerza bruta. */
document.addEventListener('pos:login-fallido', () => {
  if (window.__cancelarAutoPin) window.__cancelarAutoPin();
});

/* ÚNICO punto de limpieza del campo.
   ------------------------------------------------------------
   Lo llaman auth.js al entrar, al cerrar sesión y al expirar la sesión.
   Existir en un solo lugar es lo que arregla el bug de "cerré sesión y
   seguía viéndose lo que escribí": antes cada flujo limpiaba por su
   cuenta, y el de logout simplemente se olvidaba. */
function limpiarCampoPin() {
  const input = document.getElementById('pinInput');
  if (!input) return;
  input.value = '';

  // Si quedó en modo visible, se vuelve a ocultar: la próxima persona
  // que entre no tiene por qué heredar esa decisión.
  input.type = 'password';
  const btnOjo = document.getElementById('btnVerPin');
  if (btnOjo) { btnOjo.textContent = '👁️'; btnOjo.classList.remove('activo'); }

  if (window.__cancelarAutoPin) window.__cancelarAutoPin();

  const btn = document.getElementById('btnIngresar');
  if (btn) btn.disabled = true;

  ocultarError();
}

function ocultarError() {
  const err = document.getElementById('loginError');
  if (err) err.classList.add('hidden');
}
