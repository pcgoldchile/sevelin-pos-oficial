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

  // El teclado físico sigue funcionando en paralelo
  document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('modalLogin');
    if (!modal || !modal.classList.contains('show')) return;

    if (/^[0-9]$/.test(e.key)) {
      if (input.value.length < LARGO_PIN) input.value += e.key;
      ocultarError(); refrescar();
    } else if (e.key === 'Backspace') {
      input.value = input.value.slice(0, -1);
      refrescar();
    } else if (e.key === 'Escape') {
      input.value = ''; refrescar();
    }
  });

  input.addEventListener('input', refrescar);
  refrescar();
});

/* El aviso de PIN incorrecto se borra al primer dígito nuevo: si se
   quedara en pantalla, parecería que el intento actual también falló. */
function ocultarError() {
  const err = document.getElementById('loginError');
  if (err) err.classList.add('hidden');
}
