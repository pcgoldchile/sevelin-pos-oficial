// ==========================================
// PINPAD.JS - Teclado numérico de acceso
// ------------------------------------------
// Escribe en el mismo #pinInput de siempre, así auth.js no cambia: sigue
// leyendo el valor del input y enviándolo al backend igual que antes.
//
// Existe porque el POS se usa con pantalla táctil y en un mostrador: con
// el teclado físico lejos, escribir el PIN era incómodo. El input real
// queda oculto (sr-only) pero funcional, para que el teclado físico
// también siga sirviendo.
// ==========================================

const LARGO_PIN = 6;

document.addEventListener('DOMContentLoaded', () => {
  const pad = document.getElementById('pinPad');
  const input = document.getElementById('pinInput');
  const puntos = document.getElementById('pinPuntos');
  if (!pad || !input) return;

  /* Auto-validación.
     ------------------------------------------------------------
     El sistema NO conoce el largo del PIN: vive en las variables de
     entorno del servidor y puede ser distinto para admin y trabajador.
     Por eso no se puede enviar "al llegar a N dígitos" sin adivinar.

     La solución: esperar a que la persona deje de teclear. Con 4 dígitos
     o más y 450 ms sin pulsar nada, se envía solo. Al escribir de
     corrido, un PIN de 6 nunca se manda al llegar a 4, porque no hay
     pausa; y al terminar, entra sin tocar el botón.

     El envío se cancela con cada tecla nueva, así que borrar y corregir
     tampoco dispara un intento en falso —importante, porque el backend
     lleva un contador anti-fuerza bruta. */
  const MINIMO_AUTO = 4;
  const PAUSA_AUTO_MS = 450;
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
      form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true }));
    }, PAUSA_AUTO_MS);
  };

  const refrescar = () => {
    const n = (input.value || '').length;
    if (puntos) {
      /* Se muestran los dígitos ya escritos más uno vacío como guía,
         sin revelar el PIN ni delatar su largo real. */
      const visibles = Math.max(4, Math.min(LARGO_PIN, n + 1));
      puntos.innerHTML = Array.from({ length: visibles }, (_, i) =>
        `<span class="pin-punto${i < n ? ' lleno' : ''}"></span>`).join('');
    }
    const btn = document.getElementById('btnIngresar');
    if (btn) btn.disabled = n === 0;

    programarAuto();
  };

  pad.addEventListener('click', (e) => {
    const boton = e.target.closest('button');
    if (!boton) return;

    const accion = boton.dataset.pinAccion;
    if (accion === 'limpiar') input.value = '';
    else if (accion === 'borrar') input.value = input.value.slice(0, -1);
    else if (boton.dataset.pin) {
      if (input.value.length >= LARGO_PIN) return;
      input.value += boton.dataset.pin;
    }

    ocultarError();
    refrescar();

    // Vibración corta en táctil: confirma el toque sin mirar la pantalla
    if (navigator.vibrate) navigator.vibrate(8);
  });

  /* Teclado físico.
     ------------------------------------------------------------
     BUG QUE ARREGLA ESTE `if`: el input está oculto con sr-only, pero
     sigue siendo un <input> real y enfocable. Cuando tenía el foco y se
     tecleaba un 9, pasaban DOS cosas: el navegador lo escribía por su
     cuenta (comportamiento nativo) y además este listener lo agregaba a
     mano. Resultado: "99" por cada tecla.

     Ahora, si el evento nació dentro del propio input, se deja que el
     navegador haga su trabajo y aquí no se toca nada. Solo se escribe a
     mano cuando el foco está en otra parte (que es el caso normal,
     porque el input no se enfoca solo). */
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('modalLogin');
    if (!modal || !modal.classList.contains('show')) return;

    // El input ya se encarga: no duplicar
    if (e.target === input) {
      if (/^[0-9]$/.test(e.key)) ocultarError();
      return;
    }

    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      if (input.value.length < LARGO_PIN) input.value += e.key;
      ocultarError(); refrescar();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      input.value = input.value.slice(0, -1);
      refrescar();
    } else if (e.key === 'Escape') {
      input.value = ''; refrescar();
    }
  });

  /* Un único punto de refresco: escriba quien escriba (el teclado en
     pantalla, el físico o un pegado), todo pasa por aquí. */
  window.__cancelarAutoPin = cancelarAuto;
  input.addEventListener('input', () => { ocultarError(); refrescar(); });
  refrescar();
});

/* El aviso de PIN incorrecto se borra al primer dígito nuevo: si se
   quedara en pantalla, parecería que el intento actual también falló. */
/* auth.js avisa cuando el PIN falló, para cortar el auto-envío y que
   no se reintente solo en bucle. */
document.addEventListener('pos:login-fallido', () => {
  if (window.__cancelarAutoPin) window.__cancelarAutoPin();
});

function ocultarError() {
  const err = document.getElementById('loginError');
  if (err) err.classList.add('hidden');
}
