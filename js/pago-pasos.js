/* ============================================================
   EL COBRO POR PASOS (v175, dueño 22-10-2026)
   ------------------------------------------------------------
   "Que se trate que no haya que deslizar las cosas… que primero me indique
   de dónde vino el cliente, luego otro pop up, puntos Sevelin, luego otro
   pop up y así sucesivamente."

   La ventana de pago (js/pago.js) mostraba todo apilado: origen del cliente,
   Puntos, máquina de tarjetas y medios de pago, y había que bajar con la
   rueda. Ahora va de a una pregunta por pantalla:
     1. ¿De dónde vino el cliente?   (tocar una opción avanza sola)
     2. ⭐ ¿Suma Puntos Sevelin?      (buscar la cuenta, o "Seguir sin puntos")
     3. ¿Cómo paga?                   (máquina + medios, en dos columnas)
   y después siguen los pasos que ya existían (efectivo/vuelto y boleta).

   Los pasos 1 y 2 solo existen en una venta nueva (pago.js los muestra con
   configPago.pedirOrigen). En cualquier otro cobro (una OT, un abono) la
   ventana queda como siempre. Este archivo solo muestra y oculta: no cambia
   qué se guarda. Va después de pago.js, puntos-caja.js y atajos.js.
   ============================================================ */

const PAGO_PASOS_TITULOS = {
  vino: '¿De dónde vino el cliente?',
  puntos: '⭐ ¿Suma Puntos Sevelin?',
  pago: '¿Cómo paga?'
};
let pagoPasosLista = ['pago'];
let pagoPasoIndice = 0;

document.addEventListener('pos:pago-abierto', () => setTimeout(pagoPasosIniciar, 0));

function pagoPasosIniciar() {
  const modal = document.getElementById('modalPago');
  if (!modal) return;
  const vino = document.getElementById('pagoVinoBox');
  const puntos = document.getElementById('pagoPuntosBox');
  pagoPasosLista = [];
  if (vino && vino.style.display !== 'none') pagoPasosLista.push('vino');
  if (puntos && !puntos.hidden) pagoPasosLista.push('puntos');
  pagoPasosLista.push('pago');
  pagoPasoIr(0);
}

function pagoPasoActual() {
  return pagoPasosLista[pagoPasoIndice] || 'pago';
}

function pagoPasoIr(indice) {
  const modal = document.getElementById('modalPago');
  if (!modal) return;
  pagoPasoIndice = Math.max(0, Math.min(indice, pagoPasosLista.length - 1));
  const paso = pagoPasoActual();
  const porPasos = pagoPasosLista.length > 1;
  modal.classList.toggle('pago-por-pasos', porPasos);
  modal.dataset.paso = porPasos ? paso : '';

  const barra = document.getElementById('pagoPasosBarra');
  if (barra) barra.hidden = !porPasos;
  const numero = document.getElementById('pagoPasoNumero');
  if (numero) numero.textContent = `Paso ${pagoPasoIndice + 1} de ${pagoPasosLista.length}`;
  const titulo = document.getElementById('pagoPasoTitulo');
  if (titulo) titulo.textContent = PAGO_PASOS_TITULOS[paso] || '';
  const puntos = document.getElementById('pagoPasosPuntos');
  if (puntos) {
    puntos.innerHTML = pagoPasosLista.map((p, i) =>
      `<span class="${i === pagoPasoIndice ? 'actual' : i < pagoPasoIndice ? 'hecho' : ''}"></span>`).join('');
  }
  const atras = document.getElementById('btnPagoPasoAtras');
  if (atras) atras.disabled = pagoPasoIndice === 0;

  const ultimo = paso === 'pago';
  const siguiente = document.getElementById('btnPagoPasoSiguiente');
  if (siguiente) siguiente.hidden = !porPasos || ultimo;
  const confirmar = document.getElementById('btnConfirmarPago');
  if (confirmar) confirmar.style.display = porPasos && !ultimo ? 'none' : '';
  pagoPasosPintarSiguiente();

  // El foco parte en lo que se contesta en este paso
  setTimeout(() => {
    if (paso === 'puntos') document.getElementById('pagoPuntosBuscar')?.focus();
    else if (paso === 'vino') document.querySelector('#pagoVinoBotones button')?.focus();
  }, 30);
}

/* "Saltar" cuando no se contestó nada; "Siguiente" cuando sí. */
function pagoPasosPintarSiguiente() {
  const boton = document.getElementById('btnPagoPasoSiguiente');
  if (!boton) return;
  const paso = pagoPasoActual();
  if (paso === 'vino') {
    boton.textContent = document.getElementById('posOrigenCliente')?.value ? 'Siguiente →' : 'Saltar →';
  } else if (paso === 'puntos') {
    const conCuenta = typeof puntosCajaParaVenta === 'function' && !!puntosCajaParaVenta();
    boton.textContent = conCuenta ? 'Siguiente →' : 'Seguir sin puntos →';
  } else {
    boton.textContent = 'Siguiente →';
  }
}

function pagoPasoSiguiente() {
  if (pagoPasoIndice < pagoPasosLista.length - 1) pagoPasoIr(pagoPasoIndice + 1);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnPagoPasoSiguiente')?.addEventListener('click', pagoPasoSiguiente);
  document.getElementById('btnPagoPasoAtras')?.addEventListener('click', () => pagoPasoIr(pagoPasoIndice - 1));

  // Tocar de dónde vino avanza solo (tocar el mismo otra vez lo borra y se queda)
  document.getElementById('pagoVinoBotones')?.addEventListener('click', (e) => {
    if (!e.target.closest('[data-origen]') || pagoPasoActual() !== 'vino') return;
    setTimeout(() => {
      pagoPasosPintarSiguiente();
      if (document.getElementById('posOrigenCliente')?.value) setTimeout(pagoPasoSiguiente, 160);
    }, 0);
  });

  // Cualquier cosa que cambie dentro del paso de Puntos puede cambiar el texto del botón
  document.getElementById('pagoPuntosBox')?.addEventListener('click', () => setTimeout(pagoPasosPintarSiguiente, 400));

  /* Enter en los pasos 1 y 2 = siguiente (en el campo de Puntos, Enter busca: eso lo maneja
     puntos-caja.js). Las flechas y Enter de los medios de pago son del paso 3 (atajos.js). */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const modal = document.getElementById('modalPago');
    if (!modal?.classList.contains('show') || !modal.classList.contains('pago-por-pasos')) return;
    const paso = pagoPasoActual();
    if (paso === 'pago') return;
    if (e.target.closest?.('input, textarea, select')) return;
    if (e.target.closest?.('#pagoVinoBotones button, #pagoPuntosBox button, #pagoPasosBarra button')) return;
    e.preventDefault();
    pagoPasoSiguiente();
  });
});
