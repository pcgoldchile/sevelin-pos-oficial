// ==========================================
// ESCANER.JS - Lectura de códigos de barras con la cámara
// ------------------------------------------
// Usa html5-qrcode (CDN). Cualquier input puede abrir el escáner con un
// botón que lleve data-scan="idDelInput"; al leer un código se emite un
// bip, se cierra la cámara y el código queda escrito en ese input.
// ==========================================

let lectorEscaner = null;      // instancia de Html5Qrcode
let inputDestinoEscaner = null;
let camarasDisponibles = [];
let indiceCamara = 0;
let escaneando = false;

const elModalEscaner = document.getElementById('modalEscaner');
const elEscanerLector = document.getElementById('escanerLector');
const elEscanerEstado = document.getElementById('escanerEstado');
const elEscanerManual = document.getElementById('escanerManual');
const elBtnCerrarEscaner = document.getElementById('btnCerrarEscaner');
const elBtnCambiarCamara = document.getElementById('btnCambiarCamara');
const elBtnUsarCodigoManual = document.getElementById('btnUsarCodigoManual');

/* Formatos habituales de retail; se dejan fuera los QR por rendimiento */
function formatosSoportados() {
  if (typeof Html5QrcodeSupportedFormats === 'undefined') return undefined;
  return [
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.ITF,
    Html5QrcodeSupportedFormats.CODABAR
  ];
}

document.addEventListener('DOMContentLoaded', () => {
  // Todos los botones con data-scan abren el escáner sobre su input
  document.querySelectorAll('[data-scan]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      abrirEscaner(btn.dataset.scan);
    });
  });

  if (elBtnCerrarEscaner) elBtnCerrarEscaner.addEventListener('click', cerrarEscaner);
  if (elBtnCambiarCamara) elBtnCambiarCamara.addEventListener('click', cambiarCamara);
  if (elBtnUsarCodigoManual) elBtnUsarCodigoManual.addEventListener('click', () => {
    const codigo = (elEscanerManual?.value || '').trim();
    if (!codigo) { showToast('Escribe un código', 'err'); return; }
    entregarCodigo(codigo, false);
  });

  if (elEscanerManual) elEscanerManual.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); elBtnUsarCodigoManual?.click(); }
  });

  if (elModalEscaner) {
    elModalEscaner.addEventListener('click', (e) => { if (e.target === elModalEscaner) cerrarEscaner(); });
  }
});

/* Bip corto generado con WebAudio: no requiere archivo de sonido */
function bip() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gan = ctx.createGain();

    osc.type = 'square';
    osc.frequency.value = 1320;
    gan.gain.value = 0.09;
    osc.connect(gan);
    gan.connect(ctx.destination);

    osc.start();
    setTimeout(() => { osc.stop(); ctx.close().catch(() => {}); }, 140);
  } catch (_) { /* sin sonido disponible: no es crítico */ }
}

async function abrirEscaner(idInput) {
  inputDestinoEscaner = document.getElementById(idInput) || null;
  if (elEscanerManual) elEscanerManual.value = '';
  if (elModalEscaner) elModalEscaner.classList.add('show');

  if (typeof Html5Qrcode === 'undefined') {
    estadoEscaner('No se pudo cargar el lector de cámara. Usa el campo manual de abajo.', true);
    setTimeout(() => elEscanerManual?.focus(), 80);
    return;
  }

  estadoEscaner('Solicitando permiso de cámara…');

  try {
    camarasDisponibles = await Html5Qrcode.getCameras();
    if (!camarasDisponibles || camarasDisponibles.length === 0) throw new Error('Sin cámaras disponibles');

    // En el teléfono conviene partir por la cámara trasera
    const trasera = camarasDisponibles.findIndex(c => /back|rear|trasera|environment/i.test(c.label || ''));
    indiceCamara = trasera >= 0 ? trasera : 0;

    if (elBtnCambiarCamara) elBtnCambiarCamara.style.display = camarasDisponibles.length > 1 ? '' : 'none';
    await iniciarLector();
  } catch (err) {
    console.error('Error al abrir la cámara:', err.message || err);
    estadoEscaner('No se pudo abrir la cámara (revisa los permisos del navegador). Puedes escribir el código a mano.', true);
    setTimeout(() => elEscanerManual?.focus(), 80);
  }
}

async function iniciarLector() {
  if (!elEscanerLector) return;
  await detenerLector();

  lectorEscaner = new Html5Qrcode('escanerLector', { formatsToSupport: formatosSoportados(), verbose: false });

  const config = {
    fps: 12,
    qrbox: { width: 260, height: 150 },
    aspectRatio: 1.4
  };

  await lectorEscaner.start(
    camarasDisponibles[indiceCamara].id,
    config,
    (texto) => entregarCodigo(texto, true),
    () => { /* lecturas fallidas: se ignoran, es el flujo normal */ }
  );

  escaneando = true;
  estadoEscaner('Apunta la cámara al código de barras del producto.');
}

async function detenerLector() {
  if (!lectorEscaner) return;
  try {
    if (escaneando) await lectorEscaner.stop();
    await lectorEscaner.clear();
  } catch (_) { /* ya estaba detenido */ }
  escaneando = false;
  lectorEscaner = null;
}

async function cambiarCamara() {
  if (camarasDisponibles.length < 2) return;
  indiceCamara = (indiceCamara + 1) % camarasDisponibles.length;
  estadoEscaner('Cambiando de cámara…');
  try { await iniciarLector(); }
  catch (err) { estadoEscaner('No se pudo cambiar de cámara.', true); }
}

/* Entrega el código al input de origen y dispara la búsqueda de ese módulo */
function entregarCodigo(codigo, conSonido) {
  const limpio = String(codigo || '').trim();
  if (!limpio) return;

  if (conSonido) bip();
  cerrarEscaner();

  if (!inputDestinoEscaner) { showToast(`Código leído: ${limpio}`, 'ok'); return; }

  inputDestinoEscaner.value = limpio;
  inputDestinoEscaner.dispatchEvent(new Event('input', { bubbles: true }));
  inputDestinoEscaner.focus();

  /* Además del evento 'input' (que alimenta los buscadores por texto), se
     anuncia la lectura con su origen. Así un módulo puede reaccionar de
     forma distinta a un escaneo real que a alguien escribiendo a mano:
     el POS, por ejemplo, agrega el producto al carrito de inmediato.
     detail.manual = true cuando el código se tecleó en el campo de
     respaldo en vez de leerse con la cámara. */
  document.dispatchEvent(new CustomEvent('escaner:codigo', {
    detail: {
      codigo: limpio,
      inputId: inputDestinoEscaner.id || null,
      manual: !conSonido
    }
  }));

  showToast(`Código leído: ${limpio}`, 'ok');
}

function cerrarEscaner() {
  detenerLector();
  if (elModalEscaner) elModalEscaner.classList.remove('show');
}

function estadoEscaner(mensaje, esError = false) {
  if (!elEscanerEstado) return;
  elEscanerEstado.textContent = mensaje;
  elEscanerEstado.style.color = esError ? 'var(--red)' : '';
}
