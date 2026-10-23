/* ============================================================
   CARGA RÁPIDA DE FOTOS (v178)
   ------------------------------------------------------------
   Pedido del dueño, 23-10-2026: va a cargar muchas fundas de celular, una
   foto = un producto, y no quiere escribir "iPhone 15 Pro Max" 22 veces.

   Flujo: elige varias fotos de una vez y pone la categoría. Después va una
   foto a la vez: modelo, tipo, color y precio/costo/stock — "Guardar y
   seguir" crea el producto con esa foto y pasa a la próxima. El precio,
   costo, stock y modelo quedan puestos para la siguiente (se repiten en una
   tanda de fundas parecidas); el color se limpia siempre.

   Reusa lo que ya existe en vez de duplicarlo: cargarBitmapDeArchivo y
   dibujarYComprimirFoto (productos.js, fondo blanco cuadrado + compresión a
   webp), API.productos.crear/subirImagen, cargarEsquemaCaracteristicas y
   gruposFiltroDeCategoria (caracteristicas-producto.js) para los "Tipo" que
   el servidor ya tiene definidos en CARACTERISTICAS_TIENDA.

   Va después de productos.js y caracteristicas-producto.js (index.html).
   ============================================================ */

let crfCola = [];   // [File, File, ...], en el orden en que se van a crear
let crfIndice = 0;
let crfCreados = 0;
let crfCategoriaId = null;
// Lo que se recuerda de una foto a la siguiente (no el color, que es propio de cada una).
let crfUltimo = { modelo: '', precio: 0, costo: 0, stock: 1 };

const elCrfModal = document.getElementById('modalCargaRapidaFotos');
const elCrfPasoConfig = document.getElementById('crfPasoConfig');
const elCrfPasoFoto = document.getElementById('crfPasoFoto');
const elCrfArchivos = document.getElementById('crfArchivos');
const elCrfCategoriaSelect = document.getElementById('crfCategoriaWeb');
const elCrfContador = document.getElementById('crfContador');
const elCrfImg = document.getElementById('crfFotoPreview');
const elCrfTipo = document.getElementById('crfTipo');
const elCrfColor = document.getElementById('crfColor');
const elCrfModelo = document.getElementById('crfModelo');
const elCrfPrecio = document.getElementById('crfPrecio');
const elCrfCosto = document.getElementById('crfCosto');
const elCrfStock = document.getElementById('crfStock');
const elCrfNombrePreview = document.getElementById('crfNombrePreview');

function abrirCargaRapidaFotos() {
  if (!elCrfModal) return;
  if (!esAdmin()) { showToast('Solo el administrador puede cargar productos', 'err'); return; }
  crfCola = [];
  crfIndice = 0;
  crfCreados = 0;
  crfUltimo = { modelo: '', precio: 0, costo: 0, stock: 1 };
  if (elCrfArchivos) elCrfArchivos.value = '';
  if (elCrfPasoConfig) elCrfPasoConfig.style.display = '';
  if (elCrfPasoFoto) elCrfPasoFoto.style.display = 'none';
  poblarCategoriaCrf();
  if (typeof cargarEsquemaCaracteristicas === 'function') cargarEsquemaCaracteristicas();
  elCrfModal.classList.add('show');
}

async function poblarCategoriaCrf() {
  if (!elCrfCategoriaSelect) return;
  try {
    const categorias = (typeof categoriasWebCache !== 'undefined' && categoriasWebCache?.length)
      ? categoriasWebCache : await API.productosCategorias.listar();
    categoriasWebCache = categorias;
    const raiz = categorias.filter(c => !c.parent_id);
    const opcion = (c, indentado) => `<option value="${c.id}">${indentado ? '— ' : ''}${escHtml(c.nombre)}</option>`;
    elCrfCategoriaSelect.innerHTML = raiz.map(c => {
      const hijos = categorias.filter(h => String(h.parent_id) === String(c.id));
      return opcion(c, false) + hijos.map(h => opcion(h, true)).join('');
    }).join('');
    // El caso de uso de hoy: deja "Fundas" preseleccionada si existe.
    const fundas = categorias.find(c => c.nombre === 'Fundas'
      && categorias.find(p => String(p.id) === String(c.parent_id))?.nombre === 'Accesorios Móviles');
    if (fundas) elCrfCategoriaSelect.value = String(fundas.id);
  } catch (err) {
    console.error('No se pudieron cargar las categorías:', err.message || err);
    showToast('No se pudieron cargar las categorías', 'err');
  }
}

function crfCategoriaYSubcategoria() {
  const categoria = categoriasWebCache?.find(c => String(c.id) === String(crfCategoriaId));
  if (!categoria) return { categoria: null, subcategoria: null, categoriaWeb: null, subcategoriaWeb: null };
  const esSubcategoria = !!categoria.parent_id;
  const padre = esSubcategoria ? categoriasWebCache.find(p => String(p.id) === String(categoria.parent_id)) : null;
  return {
    categoriaWeb: esSubcategoria ? (padre?.nombre || categoria.nombre) : categoria.nombre,
    subcategoriaWeb: esSubcategoria ? categoria.nombre : null
  };
}

function crfEmpezar() {
  const archivos = [...(elCrfArchivos?.files || [])].filter(f => f.type.startsWith('image/'));
  if (!archivos.length) { showToast('Elige al menos una foto', 'err'); return; }
  if (!elCrfCategoriaSelect?.value) { showToast('Elige la categoría', 'err'); return; }
  // Mismo orden en que se ven en la carpeta de Windows.
  archivos.sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
  crfCola = archivos;
  crfIndice = 0;
  crfCreados = 0;
  crfCategoriaId = elCrfCategoriaSelect.value;
  if (elCrfPasoConfig) elCrfPasoConfig.style.display = 'none';
  if (elCrfPasoFoto) elCrfPasoFoto.style.display = '';
  crfMostrarFotoActual();
}

async function crfMostrarFotoActual() {
  if (crfIndice >= crfCola.length) { crfTerminar(); return; }
  const archivo = crfCola[crfIndice];
  if (elCrfContador) {
    elCrfContador.textContent = `Foto ${crfIndice + 1} de ${crfCola.length}`
      + (crfCreados ? ` — ${crfCreados} creada${crfCreados === 1 ? '' : 's'} hasta ahora` : '');
  }
  if (elCrfImg) elCrfImg.src = URL.createObjectURL(archivo);
  if (elCrfModelo) elCrfModelo.value = crfUltimo.modelo;
  if (elCrfPrecio) elCrfPrecio.value = crfUltimo.precio || '';
  if (elCrfCosto) elCrfCosto.value = crfUltimo.costo || '';
  if (elCrfStock) elCrfStock.value = crfUltimo.stock;
  if (elCrfColor) elCrfColor.value = '';
  await crfPoblarTipos();
  crfActualizarNombrePreview();
  setTimeout(() => elCrfColor?.focus(), 50);
}

async function crfPoblarTipos() {
  if (!elCrfTipo) return;
  if (typeof cargarEsquemaCaracteristicas === 'function') await cargarEsquemaCaracteristicas();
  const { categoriaWeb, subcategoriaWeb } = crfCategoriaYSubcategoria();
  const grupos = typeof gruposFiltroDeCategoria === 'function' ? gruposFiltroDeCategoria(categoriaWeb, subcategoriaWeb) : [];
  const tipo = grupos.find(g => g.id === 'tipo_funda');
  const valorPrevio = elCrfTipo.value;
  elCrfTipo.innerHTML = tipo
    ? tipo.valores.map(v => `<option value="${escHtml(v)}">${escHtml(v)}</option>`).join('')
    : '<option value="">(esta categoría no tiene tipos)</option>';
  if (tipo && [...elCrfTipo.options].some(o => o.value === valorPrevio)) elCrfTipo.value = valorPrevio;
}

function crfArmarNombre() {
  const modelo = (elCrfModelo?.value || '').trim();
  if (!modelo) return '';
  const tipo = elCrfTipo?.value || '';
  const color = (elCrfColor?.value || '').trim();
  return `Funda para ${modelo}${tipo ? ' — ' + tipo : ''}${color ? ' ' + color : ''}`;
}

function crfActualizarNombrePreview() {
  if (elCrfNombrePreview) elCrfNombrePreview.textContent = crfArmarNombre() || '(escribe el modelo para ver el nombre)';
}

function crfSaltar() {
  crfIndice++;
  crfMostrarFotoActual();
}

async function crfGuardarYSeguir() {
  const nombre = crfArmarNombre();
  if (!nombre) { showToast('Escribe el modelo de celular', 'err'); elCrfModelo?.focus(); return; }
  const { categoriaWeb, subcategoriaWeb } = crfCategoriaYSubcategoria();
  if (!categoriaWeb) { showToast('Elige la categoría', 'err'); return; }

  const modeloVal = (elCrfModelo?.value || '').trim();
  const caracteristicas = {};
  if (modeloVal) caracteristicas.modelo_celular = [modeloVal];
  if (elCrfTipo?.value) caracteristicas.tipo_funda = [elCrfTipo.value];

  const payload = {
    nombre,
    categoria_web: categoriaWeb,
    categoria_id: Number(crfCategoriaId),
    subcategoria_web: subcategoriaWeb,
    precio_unitario: Number(elCrfPrecio?.value) || 0,
    costo_unitario: Number(elCrfCosto?.value) || 0,
    stock: Number(elCrfStock?.value) || 0,
    publicado_web: true,
    condicion: 'nuevo',
    meses_garantia: 6,
    usa_lotes: true,
    caracteristicas
  };

  const elBtn = document.getElementById('btnCrfGuardarSeguir');
  if (elBtn) elBtn.disabled = true;
  try {
    const archivo = crfCola[crfIndice];
    const bitmap = await cargarBitmapDeArchivo(archivo);
    const dataUrlWebp = await dibujarYComprimirFoto(bitmap);
    const creado = await API.productos.crear(payload);
    if (creado?.id) await API.productos.subirImagen(creado.id, dataUrlWebp);

    crfCreados++;
    crfUltimo = {
      modelo: modeloVal,
      precio: payload.precio_unitario,
      costo: payload.costo_unitario,
      stock: payload.stock
    };
    showToast(`Creado: ${nombre}`, 'ok');
    crfIndice++;
    crfMostrarFotoActual();
  } catch (err) {
    console.error('Error en la carga rápida de fotos:', err.message || err);
    const campo = err?.duplicado?.campo;
    showToast(campo ? `Ya existe un producto con ese ${campo.toLowerCase()}` : (err.message || 'No se pudo crear el producto'), 'err');
  } finally {
    if (elBtn) elBtn.disabled = false;
  }
}

function crfTerminar() {
  cerrarModal('modalCargaRapidaFotos');
  showToast(`Carga rápida terminada: ${crfCreados} producto${crfCreados === 1 ? '' : 's'} creado${crfCreados === 1 ? '' : 's'}`, 'ok');
  cargarProductos(true);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnCargaRapidaFotos')?.addEventListener('click', abrirCargaRapidaFotos);
  document.getElementById('btnCrfCerrar')?.addEventListener('click', () => cerrarModal('modalCargaRapidaFotos'));
  document.getElementById('btnCrfEmpezar')?.addEventListener('click', crfEmpezar);
  document.getElementById('btnCrfSaltar')?.addEventListener('click', crfSaltar);
  document.getElementById('btnCrfGuardarSeguir')?.addEventListener('click', crfGuardarYSeguir);
  elCrfModelo?.addEventListener('input', crfActualizarNombrePreview);
  elCrfColor?.addEventListener('input', crfActualizarNombrePreview);
  elCrfTipo?.addEventListener('change', crfActualizarNombrePreview);
});
