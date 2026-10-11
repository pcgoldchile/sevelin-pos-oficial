/* ============================================================
   VENTANAS.JS — confirmar, avisar y preguntar con el diseño del POS
   ------------------------------------------------------------
   Pedido del dueño (11-10-2026): "en todo el POS, todo tiene que tener
   diseño, no quiero ventanas emergentes o cosas del navegador que sean
   confirmaciones o eliminar". Reemplaza a confirm(), alert() y prompt():
   esas ventanas grises son del navegador, no se pueden estilizar, en el
   teléfono tapan la pantalla y muestran la dirección del sitio arriba.

   Las tres devuelven una promesa, así que se usan con await:

     if (!await ventanaConfirmar('¿Eliminar este producto?', { peligro: true })) return;
     await ventanaAviso('Recuerda emitir la nota de crédito.');
     const motivo = await ventanaPreguntar('¿Por qué se cancela?');   // null = canceló

   El primer párrafo del mensaje (hasta la primera línea en blanco) se
   muestra como título; el resto, como texto. Todo pasa por escHtml. Para
   contenido armado (una lista de productos, por ejemplo) está
   `detalleHtml`, que escapa quien llama.

   Carga justo después de config.js: la usan casi todos los módulos.
   ============================================================ */

const VENTANA_TITULO_MAX = 110;   // un primer párrafo más largo que esto no sirve de título

let ventanaActual = null;                   // { resolver, tipo, focoAnterior }
let ventanaCola = Promise.resolve();        // una ventana a la vez; la siguiente espera

function asegurarVentanaDialogo() {
  let caja = document.getElementById('ventanaDialogo');
  if (caja) return caja;

  caja = document.createElement('div');
  caja.id = 'ventanaDialogo';
  caja.className = 'modal-overlay ventana-dialogo';
  caja.setAttribute('role', 'alertdialog');
  caja.setAttribute('aria-modal', 'true');
  caja.setAttribute('aria-labelledby', 'ventanaDialogoTitulo');
  caja.innerHTML = `
    <div class="modal-box modal-sm">
      <div class="ventana-cabeza">
        <span class="ventana-icono" id="ventanaDialogoIcono" aria-hidden="true"></span>
        <h2 id="ventanaDialogoTitulo"></h2>
      </div>
      <div class="ventana-cuerpo" id="ventanaDialogoCuerpo"></div>
      <div class="field ventana-campo" id="ventanaDialogoCampo">
        <input type="text" id="ventanaDialogoEntrada" autocomplete="off">
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" id="ventanaDialogoNo" type="button"></button>
        <button class="btn btn-primary" id="ventanaDialogoSi" type="button"></button>
      </div>
    </div>`;
  document.body.appendChild(caja);

  caja.querySelector('#ventanaDialogoNo').addEventListener('click', () => cerrarVentanaDialogo(false));
  caja.querySelector('#ventanaDialogoSi').addEventListener('click', () => cerrarVentanaDialogo(true));
  return caja;
}

/* Parte un mensaje de texto en título y párrafos. */
function partesDeMensajeVentana(mensaje, tituloDado, tituloPorDefecto) {
  const parrafos = String(mensaje == null ? '' : mensaje).split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  let titulo = tituloDado || '';
  if (!titulo && parrafos.length && parrafos[0].length <= VENTANA_TITULO_MAX && !parrafos[0].includes('\n')) {
    titulo = parrafos.shift();
  }
  return {
    titulo: titulo || tituloPorDefecto,
    cuerpoHtml: parrafos.map(p => `<p>${escHtml(p).replace(/\n/g, '<br>')}</p>`).join('')
  };
}

function mostrarVentanaDialogo(tipo, mensaje, opciones = {}) {
  return new Promise((resolver) => {
    // Con la pantalla del PIN encima no se pregunta nada: se da por cancelada
    if (document.getElementById('modalLogin')?.classList.contains('show')) {
      resolver(tipo === 'pregunta' ? null : tipo === 'aviso' ? undefined : false);
      return;
    }
    const caja = asegurarVentanaDialogo();
    const peligro = opciones.peligro === true;
    const porDefecto = tipo === 'aviso' ? 'Aviso' : tipo === 'pregunta' ? 'Escribe el dato' : '¿Confirmas?';
    const { titulo, cuerpoHtml } = partesDeMensajeVentana(mensaje, opciones.titulo, porDefecto);

    const icono = caja.querySelector('#ventanaDialogoIcono');
    icono.textContent = opciones.icono || (peligro ? '!' : tipo === 'aviso' ? 'i' : tipo === 'pregunta' ? '✎' : '?');
    icono.className = 'ventana-icono' + (peligro ? ' ventana-icono-peligro' : tipo === 'aviso' ? ' ventana-icono-aviso' : '');

    caja.querySelector('#ventanaDialogoTitulo').textContent = titulo;
    const cuerpo = caja.querySelector('#ventanaDialogoCuerpo');
    cuerpo.innerHTML = cuerpoHtml + (opciones.detalleHtml || '');
    cuerpo.style.display = cuerpo.innerHTML ? '' : 'none';

    const campo = caja.querySelector('#ventanaDialogoCampo');
    const entrada = caja.querySelector('#ventanaDialogoEntrada');
    campo.style.display = tipo === 'pregunta' ? '' : 'none';
    if (tipo === 'pregunta') {
      entrada.value = opciones.valor == null ? '' : String(opciones.valor);
      entrada.placeholder = opciones.placeholder || '';
      entrada.maxLength = opciones.maximo || 300;
      entrada.inputMode = opciones.numerico ? 'numeric' : 'text';
    }

    const btnNo = caja.querySelector('#ventanaDialogoNo');
    const btnSi = caja.querySelector('#ventanaDialogoSi');
    btnNo.textContent = opciones.textoNo || 'Cancelar';
    btnNo.style.display = tipo === 'aviso' ? 'none' : '';
    btnSi.textContent = opciones.textoSi || (tipo === 'aviso' ? 'Entendido' : tipo === 'pregunta' ? 'Aceptar' : peligro ? 'Sí, eliminar' : 'Confirmar');
    btnSi.className = 'btn ' + (peligro && tipo !== 'aviso' ? 'btn-red' : 'btn-primary');

    ventanaActual = { resolver, tipo, focoAnterior: document.activeElement };
    caja.classList.add('show');
    document.addEventListener('keydown', teclaEnVentanaDialogo, true);

    /* Lo destructivo parte con el foco en Cancelar: un Enter de más (o la
       pistola lectora, que manda Enter al final de cada código) no borra nada. */
    setTimeout(() => {
      if (tipo === 'pregunta') { entrada.focus(); entrada.select(); }
      else if (peligro && tipo !== 'aviso') btnNo.focus();
      else btnSi.focus();
    }, 40);
  });
}

function cerrarVentanaDialogo(acepto) {
  const actual = ventanaActual;
  if (!actual) return;
  ventanaActual = null;
  document.removeEventListener('keydown', teclaEnVentanaDialogo, true);
  const caja = document.getElementById('ventanaDialogo');
  caja?.classList.remove('show');

  let respuesta;
  if (actual.tipo === 'pregunta') respuesta = acepto ? (document.getElementById('ventanaDialogoEntrada')?.value ?? '') : null;
  else if (actual.tipo === 'aviso') respuesta = undefined;
  else respuesta = acepto === true;

  try { if (actual.focoAnterior && document.contains(actual.focoAnterior)) actual.focoAnterior.focus(); } catch (_) { /* el elemento ya no existe */ }
  actual.resolver(respuesta);
}

/* En captura, antes que los atajos del POS: mientras la ventana está
   abierta, Esc y Enter son de ella. Tab no sale de la ventana. */
function teclaEnVentanaDialogo(e) {
  if (!ventanaActual) return;
  const caja = document.getElementById('ventanaDialogo');
  if (e.key === 'Escape') {
    e.preventDefault(); e.stopPropagation();
    cerrarVentanaDialogo(false);
    return;
  }
  if (e.key === 'Enter') {
    e.stopPropagation();
    // Sobre un botón, Enter hace clic en ESE botón (lo resuelve el navegador)
    if (e.target instanceof HTMLButtonElement && caja?.contains(e.target)) return;
    e.preventDefault();
    cerrarVentanaDialogo(true);
    return;
  }
  if (e.key === 'Tab' && caja) {
    const enfocables = Array.from(caja.querySelectorAll('button, input')).filter(el => el.offsetParent !== null);
    if (!enfocables.length) return;
    const i = enfocables.indexOf(document.activeElement);
    const sig = e.shiftKey ? (i <= 0 ? enfocables.length - 1 : i - 1) : (i === enfocables.length - 1 ? 0 : i + 1);
    e.preventDefault(); e.stopPropagation();
    enfocables[sig].focus();
  }
}

function encolarVentanaDialogo(tipo, mensaje, opciones) {
  const turno = ventanaCola.then(() => mostrarVentanaDialogo(tipo, mensaje, opciones));
  ventanaCola = turno.catch(() => {});
  return turno;
}

/* ¿Sí o no? Devuelve true solo si se apretó el botón de confirmar. */
function ventanaConfirmar(mensaje, opciones) { return encolarVentanaDialogo('confirmar', mensaje, opciones); }

/* Un aviso que hay que leer: se cierra con "Entendido", Enter o Esc. */
function ventanaAviso(mensaje, opciones) { return encolarVentanaDialogo('aviso', mensaje, opciones); }

/* Pide un texto. Devuelve lo escrito (puede ser '') o null si se canceló. */
function ventanaPreguntar(mensaje, opciones) { return encolarVentanaDialogo('pregunta', mensaje, opciones); }

/* Al volver a la pantalla del PIN (cierre de sesión o 5 minutos sin uso) no
   puede quedar una pregunta abierta encima: se da por cancelada. */
function descartarVentanaDialogo() {
  if (ventanaActual) cerrarVentanaDialogo(false);
}
