/* ============================================================
   ASISTENTE DE PRODUCTOS, PASO A PASO (v119; v122: revisar y saltar)
   ------------------------------------------------------------
   Pedido del dueño (03-10-2026): "me cansa mucho ver todas las opciones a
   la vez ... quiero ese proceso para hacerlo más ligero y sencillo al
   principio, pero igual quiero que se mantenga [la ficha completa] para
   editar productos a futuro o que ya fueron creados".
   Y el 04-10-2026: "un botón también de paso a paso para revisar
   nuevamente lo que ya se creó, y que pueda saltarme los pasos".

   NO es un formulario aparte: es la MISMA ficha del producto mostrando una
   sección a la vez (clase modo-guiado en la vista del editor). Así no hay
   campos duplicados, todo lo que ya funciona (IA, fotos, compras, medidas)
   sigue siendo el mismo código, y al terminar el producto se edita en la
   ficha completa como cualquier otro.

   DOS MODOS
   · CREAR ("Nuevo producto" → "Paso a paso con IA"). Al pasar del primer
     paso el producto se guarda como BORRADOR (nunca publicado): fotos,
     compras, medidas y complementos necesitan que exista. Cada "Siguiente"
     guarda el avance; si se abandona, queda en Borradores.
   · REVISAR (botón "Paso a paso" en la ficha de un producto que ya existe).
     Acá "Siguiente" solo cambia de sección: un producto ya publicado NO se
     convierte en borrador ni se despublica. Nada se guarda hasta "Terminar
     y guardar", igual que en la ficha completa.

   En los dos: "Saltar" y los números de arriba cambian de paso sin guardar,
   "Terminar y guardar" es el guardado normal, y "Ver la ficha completa"
   sale del asistente sin perder nada.
   ============================================================ */

const PASOS_ASISTENTE_PRODUCTO = [
  { clave: 'ficha', titulo: '¿Qué producto es?', secciones: ['basico'],
    ayuda: 'Pega la información del producto (proveedor, caja, lo que sepas) y aprieta "Generar ficha": la IA propone nombre, descripción, marca, categoría y SEO. También puedes escribirlo a mano.' },
  { clave: 'precio', titulo: 'Precio y stock', secciones: ['precio'],
    ayuda: 'Escribe la compra: fecha, unidades, costo y precio de venta. Abajo ves el margen que deja y los precios sugeridos. Marca "costo por lotes" si quieres que cada compra guarde su propio costo.' },
  { clave: 'fotos', titulo: 'Fotos', secciones: ['fotos'],
    ayuda: 'La primera es la foto principal. Se guardan al subirlas.' },
  { clave: 'categoria', titulo: 'Categoría, condición y garantía', secciones: ['categoria', 'garantia'],
    ayuda: 'Revisa lo que propuso la IA, o pídele que proponga la categoría y la subcategoría con su botón.' },
  { clave: 'web', titulo: 'Tienda web y complementos', secciones: ['web', 'complementos'],
    ayuda: 'Publicación, SEO y qué productos se ofrecen junto a este. "Sugerir con IA" elige complementos de tu catálogo.' },
  { clave: 'bodega', titulo: 'Medidas, envío y dónde está guardado', secciones: ['medidas', 'ubicacion'],
    ayuda: 'El peso y las medidas deciden cuánto cuesta el despacho. Se guardan con su propio botón.' }
];

let asistenteProducto = null;   // { paso, revisando } mientras el modo guiado está activo
let asistenteAvanzando = false;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnAltaGuiada')?.addEventListener('click', () => {
    document.getElementById('modalMetodoAlta')?.classList.remove('show');
    iniciarAsistenteProducto();
  });
  document.getElementById('btnAsistenteRevisar')?.addEventListener('click', revisarProductoConAsistente);
  document.getElementById('btnAsistenteAtras')?.addEventListener('click', () => irAPasoAsistente(asistenteProducto.paso - 1));
  document.getElementById('btnAsistenteSaltar')?.addEventListener('click', () => irAPasoAsistente(asistenteProducto.paso + 1));
  document.getElementById('btnAsistenteSiguiente')?.addEventListener('click', avanzarAsistenteProducto);
  document.getElementById('btnAsistenteSalir')?.addEventListener('click', () => {
    terminarAsistenteProducto();
    showToast('Ficha completa: revisa lo que falte y aprieta "Guardar Producto"', 'ok');
  });
  document.getElementById('asistentePasos')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-paso-asistente]');
    if (!b || !asistenteProducto) return;
    // v122: se puede ir a cualquier paso, hacia atrás o hacia adelante, sin guardar.
    irAPasoAsistente(Number(b.dataset.pasoAsistente));
  });
  document.getElementById('btnCategoriaIA')?.addEventListener('click', proponerCategoriaConIA);
  document.getElementById('prodCategoriaIA')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-usar-categoria-ia]');
    if (b) usarCategoriaPropuesta(b.dataset.usarCategoriaIa, b.dataset.subcategoria || '', b.dataset.texto || '');
  });
});

function encenderModoGuiado(revisando) {
  asistenteProducto = { paso: 0, revisando: !!revisando };
  document.getElementById('view-producto-editor')?.classList.add('modo-guiado');
  ['asistenteBarra', 'asistenteNav'].forEach(id => { const el = document.getElementById(id); if (el) el.hidden = false; });
  mostrarPasoAsistente();
}

function iniciarAsistenteProducto() {
  abrirModalProducto(null);          // deja la ficha en blanco (y apaga un asistente anterior)
  encenderModoGuiado(false);
}

/* v122: el mismo paso a paso sobre el producto que está abierto en la ficha.
   No vuelve a cargar nada: lo que ya esté escrito y sin guardar se conserva. */
function revisarProductoConAsistente() {
  if (!editingProductId) { iniciarAsistenteProducto(); return; }
  encenderModoGuiado(true);
}

/* La llaman abrirModalProducto() y cerrarModalProducto(): cualquier otra
   forma de abrir o cerrar la ficha la deja en su vista completa. */
function terminarAsistenteProducto() {
  if (!asistenteProducto) return;
  asistenteProducto = null;
  const vista = document.getElementById('view-producto-editor');
  vista?.classList.remove('modo-guiado');
  vista?.querySelectorAll('.fuera-de-paso').forEach(c => c.classList.remove('fuera-de-paso'));
  ['asistenteBarra', 'asistenteNav'].forEach(id => { const el = document.getElementById(id); if (el) el.hidden = true; });
}

function irAPasoAsistente(paso) {
  if (!asistenteProducto) return;
  asistenteProducto.paso = Math.max(0, Math.min(PASOS_ASISTENTE_PRODUCTO.length - 1, paso));
  mostrarPasoAsistente();
}

function mostrarPasoAsistente() {
  if (!asistenteProducto) return;
  const vista = document.getElementById('view-producto-editor');
  const actual = PASOS_ASISTENTE_PRODUCTO[asistenteProducto.paso];
  const total = PASOS_ASISTENTE_PRODUCTO.length;
  const ultimo = asistenteProducto.paso === total - 1;

  vista?.querySelectorAll('.card-plegable').forEach(card => {
    const enPaso = actual.secciones.includes(card.dataset.seccion);
    card.classList.toggle('fuera-de-paso', !enPaso);
    if (enPaso) card.classList.remove('plegada');
  });

  const pasos = document.getElementById('asistentePasos');
  if (pasos) {
    pasos.innerHTML = PASOS_ASISTENTE_PRODUCTO.map((p, i) => `
      <button type="button" class="asistente-paso saltable ${i === asistenteProducto.paso ? 'actual' : i < asistenteProducto.paso ? 'hecho' : ''}"
              data-paso-asistente="${i}" title="Ir a: ${escHtml(p.titulo)}">
        <span>${i < asistenteProducto.paso ? '✔' : i + 1}</span>${escHtml(p.titulo)}
      </button>`).join('');
  }
  const titulo = document.getElementById('asistenteTitulo');
  if (titulo) titulo.textContent = `Paso ${asistenteProducto.paso + 1} de ${total} · ${actual.titulo}`;
  const ayuda = document.getElementById('asistenteAyuda');
  if (ayuda) {
    ayuda.textContent = actual.ayuda + (asistenteProducto.revisando
      ? ' Estás revisando un producto que ya existe: nada se guarda hasta "Terminar y guardar".'
      : '');
  }

  const atras = document.getElementById('btnAsistenteAtras');
  if (atras) atras.disabled = asistenteProducto.paso === 0;
  const siguiente = document.getElementById('btnAsistenteSiguiente');
  if (siguiente) siguiente.textContent = ultimo ? '✔ Terminar y guardar' : 'Siguiente →';
  // Al revisar, "Siguiente" ya no guarda: "Saltar" sería lo mismo. En el último paso no hay a dónde saltar.
  const saltar = document.getElementById('btnAsistenteSaltar');
  if (saltar) saltar.hidden = ultimo || asistenteProducto.revisando;

  /* Lo que cada sección necesita para funcionar sobre el borrador recién
     creado: al abrir la ficha en blanco todavía no había producto. */
  if (editingProductId) {
    if (actual.clave === 'web' && typeof pintarComplementosProducto === 'function'
        && typeof complementosDeProducto !== 'undefined' && complementosDeProducto !== editingProductId) {
      const local = productsList.find(p => Number(p.id) === Number(editingProductId));
      pintarComplementosProducto(local || { id: editingProductId, relacionados_ids: [] });
    }
    if (actual.clave === 'bodega' && !asistenteProducto.revisando && typeof cargarUbicacionesProducto === 'function') cargarUbicacionesProducto();
  }

  vista?.scrollIntoView({ block: 'start' });
  window.scrollTo({ top: 0 });
  if (actual.clave === 'ficha' && !asistenteProducto.revisando) setTimeout(() => document.getElementById('prodDatosReales')?.focus(), 120);
  if (actual.clave === 'precio' && !asistenteProducto.revisando) setTimeout(() => document.getElementById('ingCantidad')?.focus(), 120);
}

/* Guarda lo avanzado sin cerrar la ficha: crea el borrador la primera vez y
   después lo actualiza. Siempre borrador y sin publicar hasta "Terminar".
   SOLO al crear: al revisar un producto que ya existe no se llama (lo
   dejaría como borrador y lo sacaría de la tienda). */
async function guardarAvanceAsistente() {
  if (!editingProductId) {
    await crearBorradorProducto({ silencioso: true });
    return;
  }
  const payload = construirPayloadProducto();
  if (!payload) throw new Error('El nombre del producto es obligatorio');
  await API.productos.actualizar(editingProductId, { ...payload, es_borrador: true, publicado_web: false });
}

/* El catálogo en memoria se pone al día sin esperar: los complementos
   sugeridos por categoría buscan ahí el producto recién creado. */
function refrescarCatalogoTrasAvance() {
  if (typeof cargarProductos === 'function') cargarProductos(true);
}

async function avanzarAsistenteProducto() {
  if (!asistenteProducto || asistenteAvanzando) return;
  const actual = PASOS_ASISTENTE_PRODUCTO[asistenteProducto.paso];
  const ultimo = asistenteProducto.paso === PASOS_ASISTENTE_PRODUCTO.length - 1;

  // Revisando un producto que ya existe: solo se cambia de sección.
  if (asistenteProducto.revisando && !ultimo) { irAPasoAsistente(asistenteProducto.paso + 1); return; }

  const nombre = (document.getElementById('prodNombre')?.value || '').trim();
  if (!nombre || nombreProvisorioDeProducto(nombre)) {
    irAPasoAsistente(0);
    showToast('Ponle nombre al producto, o genera la ficha con la IA', 'err');
    document.getElementById('prodNombre')?.focus();
    return;
  }
  // La compra a medio escribir se detecta antes de guardar nada.
  const compra = actual.clave === 'precio' ? compraDelFormulario() : null;
  if (compra?.error) { showToast(compra.error, 'err'); return; }

  // Último paso: el guardado normal (deja de ser borrador, publica si corresponde y cierra).
  if (ultimo) { guardarProducto(); return; }

  const boton = document.getElementById('btnAsistenteSiguiente');
  asistenteAvanzando = true;
  if (boton) { boton.disabled = true; boton.textContent = 'Guardando…'; }
  try {
    await guardarAvanceAsistente();
    if (compra) {
      const r = await API.productos.crearCompra(editingProductId, compra.datos);
      await reflejarCompraRegistrada(r, compra.datos);
    }
    refrescarCatalogoTrasAvance();
    irAPasoAsistente(asistenteProducto.paso + 1);
  } catch (err) {
    // Mismo aviso que el guardado normal cuando choca un SKU, código o nombre.
    showToast(err.message || 'No se pudo guardar el avance', 'err');
  } finally {
    asistenteAvanzando = false;
    if (boton) boton.disabled = false;
    if (asistenteProducto) mostrarPasoAsistente();
  }
}

/* ---------- Categoría y subcategoría con IA (v122) ----------
   La IA elige UNA opción de la lista real de categorías; el servidor
   descarta cualquier cosa que no esté en la lista. Solo propone: se aplica
   con "Usar". Sirve en la ficha completa y en el paso a paso. */
async function proponerCategoriaConIA() {
  const aviso = document.getElementById('prodCategoriaIA');
  const boton = document.getElementById('btnCategoriaIA');
  if (!aviso) return;
  const nombre = (document.getElementById('prodNombre')?.value || '').trim();
  const cuerpo = {
    nombre: nombreProvisorioDeProducto(nombre) ? '' : nombre,
    descripcion_html: document.getElementById('prodDescripcion')?.value || '',
    datos: (document.getElementById('prodDatosReales')?.value || '').trim()
  };
  if (!cuerpo.nombre && !cuerpo.descripcion_html.trim() && !cuerpo.datos) {
    showToast('Escribe el nombre o la descripción primero: sin eso la IA no tiene de dónde elegir', 'err');
    return;
  }
  const sesion = sesionEditorProducto;
  if (boton) { boton.disabled = true; boton.textContent = '✨ Pensando…'; }
  try {
    const r = await API.productos.sugerirCategoria(cuerpo);
    if (sesion !== sesionEditorProducto) return;   // la ficha ya es de otro producto
    const c = r?.categoria;
    const existe = c && [...(elPopFotosCategoria?.options || [])].some(o => String(o.value) === String(c.categoria_id));
    if (!existe) {
      aviso.textContent = r?.motivo || 'La IA no encontró una categoría que calce: elígela a mano o crea una nueva.';
      return;
    }
    const yaEs = String(elPopFotosCategoria.value) === String(c.categoria_id)
      && String(elPopFotosSubcategoria?.value || '') === String(c.subcategoria_id || '');
    aviso.innerHTML = yaEs
      ? `✔ La IA propone <strong>${escHtml(c.texto)}</strong>, que es la que ya tiene.`
      : `✨ La IA propone <strong>${escHtml(c.texto)}</strong>.
         <button type="button" class="btn btn-primary btn-sm" data-usar-categoria-ia="${escHtml(String(c.categoria_id))}"
                 data-subcategoria="${escHtml(String(c.subcategoria_id || ''))}" data-texto="${escHtml(c.texto)}">Usar</button>`;
  } catch (err) {
    if (sesion === sesionEditorProducto) showToast(err.message || 'No se pudo proponer la categoría', 'err');
  } finally {
    if (boton) { boton.disabled = false; boton.textContent = '✨ Proponer categoría y subcategoría con IA'; }
  }
}

function usarCategoriaPropuesta(categoriaId, subcategoriaId, texto) {
  if (!elPopFotosCategoria) return;
  elPopFotosCategoria.value = String(categoriaId);
  poblarSubcategoriasEditor(categoriaId, subcategoriaId || '');
  aplicarSeleccionCategoria();
  /* Lo que escucha la categoría (precio sugerido, aviso de "falta algo") tiene que enterarse.
     El aviso sale del selector de SUBcategoría: el de categoría, al cambiar, vacía la subcategoría. */
  elPopFotosSubcategoria?.dispatchEvent(new Event('change', { bubbles: true }));
  const aviso = document.getElementById('prodCategoriaIA');
  if (aviso) aviso.innerHTML = `✔ Categoría puesta en <strong>${escHtml(texto)}</strong>. Se guarda con el producto.`;
}
