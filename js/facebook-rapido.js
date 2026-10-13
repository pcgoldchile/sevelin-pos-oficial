// ==========================================
// FACEBOOK-RAPIDO.JS — Publicar en Facebook desde la lista (v136, sql/93)
// ------------------------------------------
// Pedido del dueño (13-10-2026): sin entrar producto por producto, bajar las
// fotos, tener el texto para Facebook y marcar cuáles ya publicó.
// Reglas que dio:
//   · El texto NUNCA se genera solo: él escribe la descripción y la IA solo
//     la ordena y la deja profesional.
//   · "Ya publicado" existe solo con el link de la publicación.
// Reutiliza de productos.js: elegirCarpetaDeFotos, guardarFotosEnCarpeta,
// entregarVariasFotos, traerFotoUbicacion, nombreArchivoFoto, slugArchivo.
// ==========================================

let productoFacebookRapido = null;

const ICO_FACEBOOK_PROD = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.5V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21z"/></svg>';

/* Lo que va en la fila de la lista: el botón y, si ya está publicado, la marca. */
function botonFacebookDeFila(p) {
  const publicado = !!p.facebook_url;
  return `<button class="btn btn-icon ${publicado ? 'btn-icon-fb-listo' : 'btn-icon-view'}" data-facebook="${p.id}"
    title="${publicado ? 'Ya publicado en Facebook: ver fotos, texto y link' : 'Facebook: bajar fotos, texto y marcar publicado'}">${ICO_FACEBOOK_PROD}</button>`;
}
function marcaFacebookDeFila(p) {
  return p.facebook_url ? ' · <span class="marca-fb" title="Publicado en Facebook">✓ Facebook</span>' : '';
}

function linkFacebookValido(texto) {
  try {
    const u = new URL(String(texto || '').trim());
    return u.protocol === 'https:' && /(^|\.)(facebook\.com|fb\.com|fb\.me)$/i.test(u.hostname);
  } catch (_) { return false; }
}

/* Texto plano de la descripción de la ficha (viene en HTML). */
function descripcionPlanaDeProducto(p) {
  const caja = document.createElement('div');
  caja.innerHTML = String(p?.descripcion || '').replace(/<\/(p|li|h[1-6])>|<br\s*\/?>/gi, '\n');
  return (caja.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

function abrirFacebookRapido(p) {
  if (!p) return;
  productoFacebookRapido = p;
  const poner = (id, valor) => { const el = document.getElementById(id); if (el) el.value = valor; };
  const titulo = document.getElementById('fbRapidoNombre');
  if (titulo) titulo.textContent = p.nombre || '';
  poner('fbRapidoDatos', '');
  poner('fbRapidoTexto', p.facebook_texto || '');
  poner('fbRapidoLink', p.facebook_url || '');
  pintarFotosFacebookRapido();
  pintarEstadoFacebookRapido();
  document.getElementById('modalFacebookRapido')?.classList.add('show');
}

function cerrarFacebookRapido() {
  document.getElementById('modalFacebookRapido')?.classList.remove('show');
  productoFacebookRapido = null;
}

function pintarFotosFacebookRapido() {
  const el = document.getElementById('fbRapidoFotos');
  const p = productoFacebookRapido;
  if (!el || !p) return;
  const fotos = p.imagen_urls || [];
  el.innerHTML = fotos.length
    ? fotos.map(u => `<img src="${escHtml(u)}" alt="" loading="lazy">`).join('')
    : '<span class="texto-apagado">Este producto todavía no tiene fotos.</span>';
  const boton = document.getElementById('btnFbRapidoFotos');
  if (boton) { boton.disabled = !fotos.length; boton.textContent = `⬇️ Descargar ${fotos.length === 1 ? 'la foto' : `las ${fotos.length} fotos`}`; }
}

function pintarEstadoFacebookRapido() {
  const p = productoFacebookRapido;
  const el = document.getElementById('fbRapidoEstado');
  if (!el || !p) return;
  el.innerHTML = p.facebook_url
    ? `<span class="badge badge-green">✓ Publicado en Facebook</span> <a href="${escHtml(p.facebook_url)}" target="_blank" rel="noopener noreferrer">Abrir la publicación</a>`
    : '<span class="badge badge-gold">Sin publicar</span> <span class="texto-apagado">Pega el link de la publicación para marcarlo.</span>';
  const quitar = document.getElementById('btnFbRapidoQuitar');
  if (quitar) quitar.style.display = p.facebook_url ? '' : 'none';
}

/* Las fotos de UN producto como archivos { nombre, blob }, con la de
   ubicación al final si el interruptor está encendido. */
async function archivosDeFotosParaFacebook(p) {
  const fotos = p.imagen_urls || [];
  const archivos = await Promise.all(fotos.map(async (url, i) => {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`No se pudo descargar una foto de "${p.nombre}" (${resp.status})`);
    return { nombre: nombreArchivoFoto(p.nombre, i, fotos.length, url), blob: await resp.blob() };
  }));
  if (archivos.length && fotoUbicacionEncendida()) {
    archivos.push({ nombre: `${slugArchivo(p.nombre)}-zz-donde-estamos.webp`, blob: await traerFotoUbicacion() });
  }
  return archivos;
}

async function descargarFotosFacebookRapido(evento) {
  const p = productoFacebookRapido;
  if (!p || !(p.imagen_urls || []).length) return;
  const boton = document.getElementById('btnFbRapidoFotos');
  const textoBoton = boton?.textContent;
  if (boton) { boton.disabled = true; boton.textContent = '⏳ Descargando…'; }
  try {
    let carpeta = null;
    motivoSinCarpetaFotos = '';
    try { carpeta = await elegirCarpetaDeFotos(evento?.shiftKey === true); } catch (err) { if (err.name === 'AbortError') return; motivoSinCarpetaFotos = err.message || err.name; }
    const archivos = await archivosDeFotosParaFacebook(p);
    if (archivos.length === 1 && !carpeta) { dispararDescargaBlob(archivos[0].blob, archivos[0].nombre); return; }
    await entregarVariasFotos(carpeta, slugArchivo(p.nombre), archivos, `${slugArchivo(p.nombre)}-fotos.zip`);
  } catch (err) {
    showToast(err.message || 'No se pudieron descargar las fotos', 'err');
  } finally {
    if (boton) { boton.disabled = false; boton.textContent = textoBoton; }
  }
}

/* Varios productos marcados en la lista: una subcarpeta por producto. Solo
   funciona donde el navegador puede escribir en una carpeta. */
async function descargarFotosDeMarcadosParaFacebook(evento) {
  const marcados = productosMarcados().filter(p => (p.imagen_urls || []).length);
  if (!marcados.length) { showToast('Marca con la casilla los productos con fotos que quieres bajar', 'err'); return; }
  if (typeof window.showDirectoryPicker !== 'function') {
    showToast('Bajar varias carpetas de una vez funciona en Chrome o Edge del computador. Aquí usa el botón de Facebook de cada producto.', 'err');
    return;
  }
  const boton = document.getElementById('btnFotosMarcadosFacebook');
  let carpeta;
  try { carpeta = await elegirCarpetaDeFotos(evento?.shiftKey === true); } catch (err) {
    if (err.name !== 'AbortError') showToast(`No se pudo usar la carpeta (${err.message || err.name})`, 'err');
    return;
  }
  if (boton) boton.disabled = true;
  let listos = 0;
  const fallidos = [];
  for (const p of marcados) {
    if (boton) boton.textContent = `⏳ ${listos + 1} de ${marcados.length}…`;
    try {
      await guardarFotosEnCarpeta(carpeta, slugArchivo(p.nombre), await archivosDeFotosParaFacebook(p));
      listos += 1;
    } catch (err) {
      fallidos.push(p.nombre);
    }
  }
  if (boton) { boton.disabled = false; boton.textContent = '📘 Fotos de los marcados'; }
  showToast(`${listos} carpeta(s) lista(s) en "${carpeta.name}"` + (fallidos.length ? ` · fallaron: ${fallidos.map(n => acortar(n, 24)).join(', ')}` : ''), fallidos.length ? 'err' : 'ok');
}

/* v139: sin IA. Ordena lo que ya dice la descripción de la ficha (js/redes-texto.js).
   Si el producto no tiene descripción, no arma nada. De paso deja guardado el
   pie de foto de Instagram si el producto todavía no tenía uno. */
async function armarTextoFacebookRapido() {
  const p = productoFacebookRapido;
  if (!p || typeof armarTextoFacebook !== 'function') return;
  const texto = armarTextoFacebook(p);
  if (!texto) { showToast('Este producto no tiene descripción en la ficha: sin descripción no se arma nada', 'err'); return; }
  const caja = document.getElementById('fbRapidoTexto');
  const actual = (caja?.value || '').trim();
  if (actual && actual !== texto && !(await ventanaConfirmar('¿Reemplazar el texto que ya está escrito?', { textoSi: 'Sí, reemplazarlo' }))) return;
  if (caja) caja.value = texto;
  const instagram = !p.instagram_texto ? armarTextoInstagram(p) : '';
  await guardarFacebookRapido({ texto, ...(instagram ? { instagram } : {}) }, 'Texto armado desde la ficha y guardado en el producto');
}

/* La IA solo ORDENA lo que el dueño escribió: sin texto suyo, no hay nada que ordenar. */
async function ordenarTextoFacebookRapido() {
  const p = productoFacebookRapido;
  if (!p) return;
  const datos = (document.getElementById('fbRapidoDatos')?.value || '').trim();
  if (datos.length < 15) {
    showToast('Escribe primero tu descripción del producto: la IA solo la ordena, no la inventa', 'err');
    document.getElementById('fbRapidoDatos')?.focus();
    return;
  }
  const boton = document.getElementById('btnFbRapidoOrdenar');
  if (boton) { boton.disabled = true; boton.textContent = '✨ Ordenando…'; }
  try {
    const r = await API.productos.generarTexto({
      destino: 'facebook', nombre: p.nombre || '', marca: p.marca || '', condicion: p.condicion || '',
      es_servicio: !!p.es_servicio, categoria: p.categoria_web || '', datos, descripcion_html: ''
    });
    const caja = document.getElementById('fbRapidoTexto');
    if (caja) caja.value = r.texto || '';
    await guardarFacebookRapido({ texto: r.texto || '' }, 'Texto listo y guardado en el producto');
  } catch (err) {
    showToast(err.message || 'No se pudo ordenar el texto', 'err');
  } finally {
    if (boton) { boton.disabled = false; boton.textContent = '✨ Ordenar con IA'; }
  }
}

async function guardarFacebookRapido(cambios, mensaje) {
  const p = productoFacebookRapido;
  if (!p) return false;
  try {
    const r = await API.productos.guardarFacebook(p.id, cambios);
    Object.assign(p, r);
    pintarEstadoFacebookRapido();
    if (typeof renderProductosTabla === 'function' && typeof productosVisibles !== 'undefined') renderProductosTabla(productosVisibles);
    if (mensaje) showToast(mensaje, 'ok');
    return true;
  } catch (err) {
    showToast(err.message || 'No se pudo guardar', 'err');
    return false;
  }
}

async function copiarTextoFacebookRapido() {
  const texto = document.getElementById('fbRapidoTexto')?.value || '';
  if (!texto.trim()) { showToast('Todavía no hay texto para copiar', 'err'); return; }
  try {
    await navigator.clipboard.writeText(texto);
    showToast('Texto copiado: pégalo en Facebook', 'ok');
  } catch (_) {
    document.getElementById('fbRapidoTexto')?.select();
    showToast('Selecciona el texto y cópialo con Ctrl+C', 'err');
  }
}

async function marcarPublicadoFacebookRapido() {
  const link = (document.getElementById('fbRapidoLink')?.value || '').trim();
  if (!linkFacebookValido(link)) {
    showToast('Pega el link de la publicación en Facebook (empieza con https://www.facebook.com/…)', 'err');
    document.getElementById('fbRapidoLink')?.focus();
    return;
  }
  await guardarFacebookRapido({ url: link }, 'Marcado como publicado en Facebook');
}

async function quitarPublicadoFacebookRapido() {
  if (!(await ventanaConfirmar('¿Quitar la marca de publicado en Facebook?\n\nEl producto vuelve a "Sin publicar" y se borra el link guardado. El texto se conserva.', { textoSi: 'Sí, quitarla', peligro: true }))) return;
  if (await guardarFacebookRapido({ url: '' }, 'Marca quitada')) {
    const caja = document.getElementById('fbRapidoLink');
    if (caja) caja.value = '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const al = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);
  al('btnFbRapidoCerrar', cerrarFacebookRapido);
  al('btnFbRapidoFotos', descargarFotosFacebookRapido);
  al('btnFbRapidoArmar', armarTextoFacebookRapido);
  al('btnFbRapidoOrdenar', ordenarTextoFacebookRapido);
  al('btnFbRapidoCopiar', copiarTextoFacebookRapido);
  al('btnFbRapidoGuardar', () => guardarFacebookRapido({ texto: document.getElementById('fbRapidoTexto')?.value || '' }, 'Texto guardado'));
  al('btnFbRapidoPublicado', marcarPublicadoFacebookRapido);
  al('btnFbRapidoQuitar', quitarPublicadoFacebookRapido);
  al('btnFotosMarcadosFacebook', descargarFotosDeMarcadosParaFacebook);
  al('btnFbRapidoUsarFicha', () => {
    const caja = document.getElementById('fbRapidoDatos');
    const texto = descripcionPlanaDeProducto(productoFacebookRapido);
    if (!texto) { showToast('Este producto no tiene descripción en la ficha', 'err'); return; }
    if (caja) { caja.value = texto; caja.focus(); }
  });
});
