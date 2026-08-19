// ==========================================
// ESCANER.JS - Lectura de códigos de barras (rediseño v12)
// ------------------------------------------
// Antes: lectura automática en vivo (fps 12), que en móviles disparaba
// capturas erróneas antes de enfocar. Ahora:
//   · CÁMARA con captura MANUAL: la cámara es solo un visor; el código se
//     lee al pulsar "Tomar Foto / Escanear", cuando el usuario ya enfocó.
//   · CARGAR FOTO: se elige una imagen de la galería y se decodifica en
//     memoria (NO se sube a ningún bucket ni base de datos).
//   · Linterna (torch) si el dispositivo lo soporta.
//   · Respaldo manual siempre disponible.
//
// Cualquier input abre el escáner con un botón data-scan="idDelInput".
// Al obtener un código se emite el CustomEvent 'escaner:codigo' (lo
// escuchan el POS y otros módulos) y se escribe en el input de origen.
// Usa html5-qrcode (CDN): Html5Qrcode.scanFileV2 decodifica imágenes.
// ==========================================

let lectorEscaner = null;      // instancia de Html5Qrcode (visor de cámara)
let lectorArchivo = null;      // instancia aparte para decodificar imágenes
let inputDestinoEscaner = null;
let camarasDisponibles = [];
let indiceCamara = 0;
let escaneando = false;        // true mientras el visor de cámara está activo
let linternaEncendida = false;

const elModalEscaner = document.getElementById('modalEscaner');
const elEscanerLector = document.getElementById('escanerLector');
const elEscanerEstado = document.getElementById('escanerEstado');
const elEscanerManual = document.getElementById('escanerManual');
const elBtnCerrarEscaner = document.getElementById('btnCerrarEscaner');
const elBtnCambiarCamara = document.getElementById('btnCambiarCamara');
const elBtnUsarCodigoManual = document.getElementById('btnUsarCodigoManual');
const elBtnCapturarFoto = document.getElementById('btnCapturarFoto');
const elBtnLinterna = document.getElementById('btnLinterna');
const elEscanerArchivo = document.getElementById('escanerArchivo');
const elEscanerArchivoEstado = document.getElementById('escanerArchivoEstado');

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
  if (elBtnCapturarFoto) elBtnCapturarFoto.addEventListener('click', capturarYDecodificar);
  if (elBtnLinterna) elBtnLinterna.addEventListener('click', alternarLinterna);

  if (elBtnUsarCodigoManual) elBtnUsarCodigoManual.addEventListener('click', () => {
    const codigo = (elEscanerManual?.value || '').trim();
    if (!codigo) { showToast('Escribe un código', 'err'); return; }
    entregarCodigo(codigo, false);
  });

  if (elEscanerManual) elEscanerManual.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); elBtnUsarCodigoManual?.click(); }
  });

  // Pestañas Cámara / Cargar Foto
  document.querySelectorAll('[data-escaner-tab]').forEach(tab => {
    tab.addEventListener('click', () => mostrarTabEscaner(tab.dataset.escanerTab));
  });

  // Cargar foto de la galería (se procesa en memoria, no se guarda)
  if (elEscanerArchivo) elEscanerArchivo.addEventListener('change', decodificarArchivo);

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
  } catch (_) { /* sin sonido: no es crítico */ }
}

/* Cambia entre la pestaña de cámara y la de cargar foto */
function mostrarTabEscaner(cual) {
  document.querySelectorAll('[data-escaner-tab]').forEach(t =>
    t.classList.toggle('activo', t.dataset.escanerTab === cual));
  document.querySelectorAll('[data-escaner-panel]').forEach(p =>
    p.classList.toggle('hidden', p.dataset.escanerPanel !== cual));

  // La cámara solo corre en su pestaña: al irse a "archivo" se apaga
  if (cual === 'archivo') {
    detenerLector();
  } else {
    if (!escaneando) iniciarVisorCamara();
  }
}

async function abrirEscaner(idInput) {
  inputDestinoEscaner = document.getElementById(idInput) || null;
  if (elEscanerManual) elEscanerManual.value = '';
  if (elEscanerArchivoEstado) elEscanerArchivoEstado.style.display = 'none';
  linternaEncendida = false;
  if (elModalEscaner) elModalEscaner.classList.add('show');

  mostrarTabEscaner('camara');   // arranca en cámara e inicia el visor

  if (typeof Html5Qrcode === 'undefined') {
    estadoEscaner('No se pudo cargar el lector. Usa "Cargar Foto" o escribe el código.', true);
  }
}

/* Inicia la cámara SOLO como visor (sin lectura automática). La lectura
   ocurre al pulsar el botón de captura. */
async function iniciarVisorCamara() {
  if (typeof Html5Qrcode === 'undefined' || !elEscanerLector) return;
  estadoEscaner('Solicitando permiso de cámara…');
  try {
    if (!camarasDisponibles.length) {
      camarasDisponibles = await Html5Qrcode.getCameras();
    }
    if (!camarasDisponibles || camarasDisponibles.length === 0) throw new Error('Sin cámaras');

    const trasera = camarasDisponibles.findIndex(c => /back|rear|trasera|environment/i.test(c.label || ''));
    if (indiceCamara === 0 && trasera >= 0) indiceCamara = trasera;

    if (elBtnCambiarCamara) elBtnCambiarCamara.style.display = camarasDisponibles.length > 1 ? '' : 'none';

    await iniciarLector();
    estadoEscaner('Enfoca el código dentro del recuadro y pulsa el botón.');
  } catch (err) {
    console.error('Error al abrir la cámara:', err.message || err);
    estadoEscaner('No se pudo abrir la cámara. Usa "Cargar Foto" o escribe el código.', true);
  }
}

async function iniciarLector() {
  await detenerLector();
  lectorEscaner = new Html5Qrcode('escanerLector', { formatsToSupport: formatosSoportados(), verbose: false });

  const config = { fps: 10, aspectRatio: 1.4 };
  /* Se arranca con un callback vacío: NO se actúa en cada frame. La cámara
     queda como visor en vivo; la decodificación se hace bajo demanda al
     capturar. Así el usuario controla cuándo se "toma la foto". */
  await lectorEscaner.start(
    camarasDisponibles[indiceCamara].id,
    config,
    () => { /* lectura en vivo desactivada a propósito */ },
    () => { /* errores por frame: ignorados */ }
  );
  escaneando = true;
}

async function detenerLector() {
  if (!lectorEscaner) return;
  try {
    if (escaneando) await lectorEscaner.stop();
    await lectorEscaner.clear();
  } catch (_) { /* ya estaba detenido */ }
  escaneando = false;
  linternaEncendida = false;
  lectorEscaner = null;
}

async function cambiarCamara() {
  if (camarasDisponibles.length < 2) return;
  indiceCamara = (indiceCamara + 1) % camarasDisponibles.length;
  estadoEscaner('Cambiando de cámara…');
  try { await iniciarLector(); estadoEscaner('Enfoca el código y pulsa el botón.'); }
  catch (err) { estadoEscaner('No se pudo cambiar de cámara.', true); }
}

/* Enciende/apaga la linterna del dispositivo si la soporta (torch) */
async function alternarLinterna() {
  if (!lectorEscaner || !escaneando) { showToast('Primero abre la cámara', 'err'); return; }
  try {
    const nuevoEstado = !linternaEncendida;
    // html5-qrcode expone las capacidades del track de video
    if (typeof lectorEscaner.applyVideoConstraints === 'function') {
      await lectorEscaner.applyVideoConstraints({ advanced: [{ torch: nuevoEstado }] });
      linternaEncendida = nuevoEstado;
      if (elBtnLinterna) elBtnLinterna.classList.toggle('activo', linternaEncendida);
    } else {
      showToast('Este dispositivo no permite controlar la linterna', 'err');
    }
  } catch (err) {
    showToast('La linterna no está disponible en este dispositivo', 'err');
  }
}

/* CAPTURA MANUAL: toma el frame actual del visor y lo decodifica.
   html5-qrcode no expone el frame directo, así que se lee el <video> que
   monta dentro de #escanerLector, se dibuja en un canvas, y ese canvas se
   pasa como archivo a scanFileV2 (que decodifica imágenes estáticas). */
async function capturarYDecodificar() {
  if (!escaneando || !elEscanerLector) { showToast('La cámara no está lista', 'err'); return; }
  const video = elEscanerLector.querySelector('video');
  if (!video || !video.videoWidth) { showToast('Espera a que la cámara enfoque', 'err'); return; }

  estadoEscaner('Procesando la imagen…');
  if (elBtnCapturarFoto) elBtnCapturarFoto.disabled = true;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    const archivo = new File([blob], 'captura.png', { type: 'image/png' });

    const codigo = await decodificarImagenEnMemoria(archivo);
    if (codigo) {
      entregarCodigo(codigo, true);
    } else {
      estadoEscaner('No se detectó ningún código. Acerca más o mejora la luz e inténtalo otra vez.', true);
    }
  } catch (err) {
    estadoEscaner('No se pudo leer el código. Prueba de nuevo o carga una foto.', true);
  } finally {
    if (elBtnCapturarFoto) elBtnCapturarFoto.disabled = false;
  }
}

/* CARGAR FOTO: decodifica una imagen de la galería, en memoria.
   IMPORTANTE: la imagen NO se sube a ningún bucket ni base de datos; solo
   se lee para extraer el código y se descarta. */
async function decodificarArchivo(evento) {
  const archivo = evento.target.files && evento.target.files[0];
  if (!archivo) return;

  if (elEscanerArchivoEstado) {
    elEscanerArchivoEstado.style.display = 'block';
    elEscanerArchivoEstado.style.color = '';
    elEscanerArchivoEstado.textContent = 'Procesando la imagen…';
  }

  try {
    const codigo = await decodificarImagenEnMemoria(archivo);
    if (codigo) {
      entregarCodigo(codigo, true);
    } else if (elEscanerArchivoEstado) {
      elEscanerArchivoEstado.style.color = 'var(--red)';
      elEscanerArchivoEstado.textContent = 'No se detectó un código en esa foto. Prueba con otra más nítida.';
    }
  } catch (err) {
    if (elEscanerArchivoEstado) {
      elEscanerArchivoEstado.style.color = 'var(--red)';
      elEscanerArchivoEstado.textContent = 'No se pudo procesar la imagen.';
    }
  } finally {
    // Se limpia el input para poder recargar la misma foto si hace falta
    evento.target.value = '';
  }
}

/* Decodifica una imagen (File) a texto de código, en memoria, con una
   instancia oculta de Html5Qrcode. Devuelve el código o null. */
async function decodificarImagenEnMemoria(archivo) {
  if (typeof Html5Qrcode === 'undefined') throw new Error('Lector no disponible');

  // Contenedor oculto para la instancia de archivo (no interfiere con el visor)
  let cont = document.getElementById('escanerArchivoLector');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'escanerArchivoLector';
    cont.style.display = 'none';
    document.body.appendChild(cont);
  }
  if (!lectorArchivo) {
    lectorArchivo = new Html5Qrcode('escanerArchivoLector', { formatsToSupport: formatosSoportados(), verbose: false });
  }

  try {
    // scanFileV2 devuelve { decodedText }, scanFile devuelve el texto directo
    if (typeof lectorArchivo.scanFileV2 === 'function') {
      const res = await lectorArchivo.scanFileV2(archivo, false);
      return (res && res.decodedText) ? res.decodedText.trim() : null;
    }
    const texto = await lectorArchivo.scanFile(archivo, false);
    return texto ? String(texto).trim() : null;
  } catch (_) {
    return null;   // no se encontró código en la imagen
  }
}

/* Entrega el código al input de origen y dispara la búsqueda de ese módulo.
   Preserva el CustomEvent 'escaner:codigo' que escuchan el POS y otros. */
function entregarCodigo(codigo, conSonido) {
  const limpio = String(codigo || '').trim();
  if (!limpio) return;

  if (conSonido) bip();
  cerrarEscaner();

  if (!inputDestinoEscaner) { showToast(`Código leído: ${limpio}`, 'ok'); return; }

  inputDestinoEscaner.value = limpio;
  inputDestinoEscaner.dispatchEvent(new Event('input', { bubbles: true }));
  inputDestinoEscaner.focus();

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
