/* ============================================================
   DÓNDE ESTÁ GUARDADO CADA PRODUCTO + MERCADERÍA EN CAMINO
   (sql/59 y sql/60, dueño 21-09-2026)
   ------------------------------------------------------------
   "Agregar la ubicación del hueco/espacio/cajón donde se encuentra ese
   objeto […] en una caja se guarda más de un producto […] si se agota,
   al reingresar que me pregunte si se seguirá guardando en ese espacio."

   Por eso los lugares son una LISTA, no un campo de texto: una caja
   guarda varios productos y un producto puede estar en varios lugares.
   Y por eso al registrar una compra se propone el lugar donde ya estaba
   — que es justo el momento en que uno decide dónde ponerlo.

   La foto es del LUGAR (el estante, la caja), no del producto: sirve para
   todo lo que esté guardado ahí. Se comprime en el navegador antes de
   subirla, porque la foto sale del teléfono y pesa 3 o 4 MB.
   ============================================================ */

const UBI_LADO_MAX_PX = 1200;          // suficiente para reconocer un estante
const UBI_OBJETIVO_BYTES = 160 * 1024;
const UBI_CALIDAD_INICIAL = 0.8;
const UBI_CALIDAD_MINIMA = 0.45;
const INTERVALO_EN_CAMINO_MS = 30 * 60 * 1000;

let ubicacionesCatalogo = [];
let ubicacionesDelProducto = [];
let ubicacionFotoPendiente = null;     // dataURL, se sube al crear el lugar
let intervaloEnCamino = null;
let enCaminoCache = null;
const enCaminoMarcadas = new Set();    // v134: compras con la casilla marcada para confirmarlas juntas
let llegadasPorConfirmar = null;       // v134: { compras, alTerminar } mientras la ventana de llegadas está abierta

const ETIQUETA_TIPO_UBICACION = {
  estante: '🗄️ Estante', caja: '📦 Caja', cajon: '🗃️ Cajón',
  vitrina: '🪟 Vitrina', bodega: '🏬 Bodega', otro: '📍 Otro'
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ubiSelect')?.addEventListener('change', alternarUbicacionNueva);
  document.getElementById('btnGuardarUbicacion')?.addEventListener('click', guardarProductoEnUbicacion);
  document.getElementById('btnUbiFoto')?.addEventListener('click', () => document.getElementById('ubiFotoInput')?.click());
  document.getElementById('ubiFotoInput')?.addEventListener('change', elegirFotoUbicacion);

  document.getElementById('ubicacionesLista')?.addEventListener('click', (e) => {
    const quitar = e.target.closest('[data-quitar-ubicacion]');
    if (quitar) quitarDeUbicacion(Number(quitar.dataset.quitarUbicacion));
  });

  document.getElementById('btnEnCamino')?.addEventListener('click', abrirModalEnCamino);
  document.getElementById('btnCerrarEnCamino')?.addEventListener('click', () => cerrarModal('modalEnCamino'));
  document.getElementById('btnCancelarEditarPorLlegar')?.addEventListener('click', () => cerrarModal('modalEditarPorLlegar'));
  document.getElementById('btnGuardarEditarPorLlegar')?.addEventListener('click', guardarEditarPorLlegar);
  // v134: marcar varias y confirmarlas juntas
  document.getElementById('enCaminoTodas')?.addEventListener('change', (e) => marcarTodasEnCamino(e.target.checked));
  document.getElementById('btnMarcarLlegadas')?.addEventListener('click', recibirMarcadasEnCamino);
  document.getElementById('enCaminoLista')?.addEventListener('change', (e) => {
    const casilla = e.target.closest('[data-marcar-camino]');
    if (casilla) alternarMarcaEnCamino(Number(casilla.dataset.marcarCamino), casilla.checked);
  });
  document.getElementById('btnCancelarLlegadas')?.addEventListener('click', cerrarConfirmarLlegadas);
  document.getElementById('btnConfirmarLlegadas')?.addEventListener('click', confirmarLlegadasEscritas);
  document.getElementById('llegadasLista')?.addEventListener('input', actualizarResumenLlegadas);
  document.getElementById('llegadasLista')?.addEventListener('change', actualizarResumenLlegadas);

  document.getElementById('enCaminoLista')?.addEventListener('click', (e) => {
    const recibir = e.target.closest('[data-recibir-camino]');
    if (recibir) { recibirDesdeAviso(Number(recibir.dataset.recibirCamino)); return; }
    const editar = e.target.closest('[data-editar-camino]');
    if (editar) { abrirEditarPorLlegar(Number(editar.dataset.editarCamino)); return; }
    const eliminar = e.target.closest('[data-eliminar-camino]');
    if (eliminar) { eliminarCompraPorLlegar(Number(eliminar.dataset.eliminarCamino)); return; }
    const ver = e.target.closest('[data-ver-producto-camino]');
    if (ver) {
      cerrarModal('modalEnCamino');
      if (typeof abrirProductoDesdeAviso === 'function') abrirProductoDesdeAviso(Number(ver.dataset.verProductoCamino));
    }
  });
});

document.addEventListener('pos:sesion-iniciada', () => {
  if (intervaloEnCamino) { clearInterval(intervaloEnCamino); intervaloEnCamino = null; }
  // v134: también para el trabajador, que ahora marca las llegadas
  actualizarAvisoEnCamino();
  intervaloEnCamino = setInterval(actualizarAvisoEnCamino, INTERVALO_EN_CAMINO_MS);
});

// ============================================================
// Los lugares del producto que se está editando
// ============================================================

async function cargarUbicacionesProducto() {
  const cont = document.getElementById('ubicacionesLista');
  if (!cont) return;

  if (!ubicacionesCatalogo.length) {
    try { ubicacionesCatalogo = await API.ubicaciones.listar() || []; }
    catch (err) { console.error('No se pudo leer el catálogo de lugares:', err.message || err); }
  }
  poblarSelectUbicaciones();
  limpiarFormularioUbicacion();

  if (!editingProductId) {
    ubicacionesDelProducto = [];
    cont.innerHTML = '<p class="modal-hint">Guarda el producto y después anota dónde lo dejaste.</p>';
    return;
  }
  try {
    ubicacionesDelProducto = await API.productos.ubicacionesDe(editingProductId) || [];
    pintarUbicacionesProducto();
  } catch (err) {
    cont.innerHTML = `<p class="modal-hint">No se pudieron cargar los lugares: ${escHtml(err.message || '')}</p>`;
  }
}

function poblarSelectUbicaciones() {
  const sel = document.getElementById('ubiSelect');
  if (!sel) return;
  const actual = sel.value;
  sel.innerHTML = '<option value="">— Elige un lugar guardado —</option>'
    + ubicacionesCatalogo.map(u =>
        `<option value="${u.id}">${escHtml(u.nombre)}${u.tipo ? ' · ' + escHtml(ETIQUETA_TIPO_UBICACION[u.tipo] || u.tipo) : ''}</option>`).join('')
    + '<option value="__nuevo">➕ Crear un lugar nuevo…</option>';
  sel.value = actual && sel.querySelector(`option[value="${actual}"]`) ? actual : '';
}

function alternarUbicacionNueva() {
  const esNuevo = document.getElementById('ubiSelect')?.value === '__nuevo';
  const campo = document.getElementById('campoUbiNueva');
  if (campo) campo.style.display = esNuevo ? '' : 'none';
  if (esNuevo) setTimeout(() => document.getElementById('ubiNombreNuevo')?.focus(), 60);
}

function limpiarFormularioUbicacion() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('ubiSelect', ''); set('ubiNombreNuevo', ''); set('ubiTipoNuevo', ''); set('ubiNota', '');
  const campo = document.getElementById('campoUbiNueva');
  if (campo) campo.style.display = 'none';
  const chk = document.getElementById('ubiPrincipal');
  // El primero que se guarda es el principal; si ya hay uno, no se pisa
  if (chk) chk.checked = ubicacionesDelProducto.length === 0;
  ubicacionFotoPendiente = null;
  const estado = document.getElementById('ubiFotoEstado');
  if (estado) estado.textContent = '';
}

function pintarUbicacionesProducto() {
  const cont = document.getElementById('ubicacionesLista');
  if (!cont) return;
  if (!ubicacionesDelProducto.length) {
    cont.innerHTML = '<p class="modal-hint">Todavía no anotaste dónde se guarda este producto.</p>';
    return;
  }

  cont.innerHTML = ubicacionesDelProducto.map(pu => {
    const u = pu.ubicacion || {};
    return `
      <div class="ubicacion-fila">
        ${u.foto_url
          ? `<img src="${escHtml(u.foto_url)}" alt="" class="ubicacion-foto"
                  data-ampliar="${escHtml(JSON.stringify([u.foto_url]))}"
                  data-ampliar-titulo="${escHtml(u.nombre || '')}" title="Clic para ver la foto en grande">`
          : '<div class="ubicacion-foto ubicacion-foto-vacia">📍</div>'}
        <div style="flex:1; min-width:0;">
          <strong>${pu.principal ? '⭐ ' : ''}${escHtml(u.nombre || 'Lugar')}</strong>
          ${u.tipo ? `<small style="color:var(--text-muted);"> · ${escHtml(ETIQUETA_TIPO_UBICACION[u.tipo] || u.tipo)}</small>` : ''}
          ${pu.nota ? `<br><small>${escHtml(pu.nota)}</small>` : ''}
        </div>
        <button class="btn btn-icon btn-icon-del" data-quitar-ubicacion="${u.id}" title="Ya no se guarda acá">✕</button>
      </div>`;
  }).join('');
}

/* La foto se comprime ANTES de subirla. Sin esto, una foto del teléfono
   (3-4 MB) chocaría con el tope de 1 MB del servidor. No se fuerza a
   cuadrado ni a fondo blanco como las del catálogo: es la foto de un
   estante, y recortarla perdería justo lo que sirve para ubicarlo. */
function comprimirFotoUbicacion(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer la foto'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('El archivo no es una imagen válida'));
      img.onload = () => {
        const escala = Math.min(1, UBI_LADO_MAX_PX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

        const intentar = (calidad) => {
          canvas.toBlob((blob) => {
            if (!blob) { reject(new Error('No se pudo comprimir la foto')); return; }
            if (blob.size > UBI_OBJETIVO_BYTES && calidad > UBI_CALIDAD_MINIMA) {
              intentar(Math.round((calidad - 0.1) * 100) / 100);
              return;
            }
            const fr = new FileReader();
            fr.onload = () => resolve({ dataUrl: fr.result, bytes: blob.size });
            fr.onerror = () => reject(new Error('No se pudo preparar la foto'));
            fr.readAsDataURL(blob);
          }, 'image/webp', calidad);
        };
        intentar(UBI_CALIDAD_INICIAL);
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

async function elegirFotoUbicacion(evento) {
  const archivo = evento.target.files?.[0];
  evento.target.value = '';
  if (!archivo) return;
  const estado = document.getElementById('ubiFotoEstado');
  if (estado) estado.textContent = 'Comprimiendo…';
  try {
    const { dataUrl, bytes } = await comprimirFotoUbicacion(archivo);
    ubicacionFotoPendiente = dataUrl;
    const antes = Math.round(archivo.size / 1024);
    const despues = Math.round(bytes / 1024);
    if (estado) estado.textContent = `Foto lista (${antes} KB → ${despues} KB)`;
  } catch (err) {
    ubicacionFotoPendiente = null;
    if (estado) estado.textContent = '';
    showToast(err.message || 'No se pudo preparar la foto', 'err');
  }
}

async function guardarProductoEnUbicacion() {
  if (!editingProductId) { showToast('Guarda el producto antes de anotar dónde va', 'err'); return; }

  const sel = document.getElementById('ubiSelect');
  const esNuevo = sel?.value === '__nuevo';
  const nombreNuevo = (document.getElementById('ubiNombreNuevo')?.value || '').trim();
  if (!esNuevo && !sel?.value) { showToast('Elige un lugar o crea uno nuevo', 'err'); return; }
  if (esNuevo && !nombreNuevo) { showToast('Ponle un nombre al lugar nuevo', 'err'); return; }

  const btn = document.getElementById('btnGuardarUbicacion');
  if (btn) btn.disabled = true;
  try {
    const r = await API.productos.guardarEnUbicacion(editingProductId, {
      ubicacion_id: esNuevo ? null : Number(sel.value),
      nombre_nuevo: esNuevo ? nombreNuevo : null,
      tipo: esNuevo ? (document.getElementById('ubiTipoNuevo')?.value || null) : null,
      nota: (document.getElementById('ubiNota')?.value || '').trim() || null,
      principal: !!document.getElementById('ubiPrincipal')?.checked
    });

    if (ubicacionFotoPendiente && r?.ubicacion_id) {
      try { await API.ubicaciones.subirFoto(r.ubicacion_id, ubicacionFotoPendiente); }
      catch (err) { showToast('El lugar se guardó, pero la foto no subió: ' + (err.message || ''), 'err'); }
    }

    showToast('Listo: ya sabes dónde está', 'ok');
    ubicacionesCatalogo = await API.ubicaciones.listar() || [];
    ubicacionesDelProducto = await API.productos.ubicacionesDe(editingProductId) || [];
    poblarSelectUbicaciones();
    pintarUbicacionesProducto();
    limpiarFormularioUbicacion();
    if (typeof revisarCompletitudProducto === 'function') revisarCompletitudProducto();
  } catch (err) {
    showToast(err.message || 'No se pudo guardar el lugar', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function quitarDeUbicacion(ubicacionId) {
  if (!editingProductId) return;
  if (!await ventanaConfirmar('¿Este producto ya no se guarda acá?', { textoSi: 'Sí, quitarlo' })) return;
  try {
    await API.productos.quitarDeUbicacion(editingProductId, ubicacionId);
    ubicacionesDelProducto = await API.productos.ubicacionesDe(editingProductId) || [];
    pintarUbicacionesProducto();
    limpiarFormularioUbicacion();
    if (typeof revisarCompletitudProducto === 'function') revisarCompletitudProducto();
  } catch (err) {
    showToast(err.message || 'No se pudo quitar el lugar', 'err');
  }
}

/* Al registrar una compra se propone el lugar donde ya estaba guardado:
   es el momento en que uno decide dónde poner lo que llegó. Se muestra,
   no se aplica solo — el stock nuevo puede ir a otra parte. */
function proponerLugarDeLaCompra() {
  const aviso = document.getElementById('ingDondeGuardar');
  if (!aviso) return;
  if (!ubicacionesDelProducto.length) {
    aviso.textContent = '';
    return;
  }
  const principal = ubicacionesDelProducto.find(u => u.principal) || ubicacionesDelProducto[0];
  const nombre = principal.ubicacion?.nombre || 'un lugar guardado';
  const extra = ubicacionesDelProducto.length > 1
    ? ` (y en ${ubicacionesDelProducto.length - 1} lugar(es) más)` : '';
  aviso.textContent = `📍 La última vez lo guardaste en "${nombre}"${extra}. Si esta compra va a otro lado, anótalo abajo en "Dónde está guardado".`;
}

// ============================================================
// El aviso del header: mercadería en camino
// ============================================================

/* v134: el trabajador también ve el botón y marca llegadas (pedido del
   dueño, 11-10-2026). El servidor no le manda costos; Editar, Eliminar y
   "Ver producto" siguen siendo del admin. */
async function actualizarAvisoEnCamino() {
  const btn = document.getElementById('btnEnCamino');
  const texto = document.getElementById('textoEnCamino');
  if (!btn || !texto || !tokenActual()) return;
  try {
    enCaminoCache = await API.productos.enCamino();
    const total = Number(enCaminoCache?.total) || 0;
    // Una casilla marcada de una compra que ya no está no puede quedar contando
    const vivas = new Set((enCaminoCache?.compras || []).map(c => Number(c.id)));
    enCaminoMarcadas.forEach(id => { if (!vivas.has(id)) enCaminoMarcadas.delete(id); });
    if (!total) { btn.hidden = true; return; }

    const vencidos = Number(enCaminoCache?.vencidos) || 0;
    texto.textContent = vencidos ? `${vencidos} por confirmar` : `${total} por llegar`;
    btn.classList.toggle('camino-vencido', vencidos > 0);
    btn.title = vencidos
      ? `${vencidos} compra(s) que ya deberían haber llegado: confírmalas o corrige la fecha`
      : `${total} compra(s) por llegar`;
    btn.hidden = false;
    if (document.getElementById('modalEnCamino')?.classList.contains('show')) pintarEnCamino();
  } catch (err) {
    console.error('Error al revisar la mercadería en camino:', err.message || err);
  }
}

function abrirModalEnCamino() {
  if (!enCaminoCache?.total) return;
  enCaminoMarcadas.clear();
  pintarEnCamino();
  document.getElementById('modalEnCamino')?.classList.add('show');
}

function pintarEnCamino() {
  const cont = document.getElementById('enCaminoLista');
  const resumen = document.getElementById('enCaminoResumen');
  if (!cont || !enCaminoCache) return;

  const compras = enCaminoCache.compras || [];
  if (resumen) {
    resumen.textContent = compras.length
      ? `${compras.length} compra(s) esperando llegar`
        + (enCaminoCache.vencidos ? ` · ${enCaminoCache.vencidos} ya deberían estar acá.` : '.')
      : 'No hay nada por llegar.';
  }
  if (!compras.length) {
    cont.innerHTML = '<p class="modal-hint">Nada por llegar.</p>';
    pintarBarraEnCamino();
    return;
  }

  cont.innerHTML = compras.map(c => {
    const d = c.dias_para_llegar;
    /* Sin fecha estimada NO hay atraso: no se sabe cuándo llega, que es
       distinto de que se haya pasado. */
    const cuando = d === null
      ? '<span style="color:var(--text-muted);">sin fecha estimada</span>'
      : d < 0 ? `<span style="color:var(--red);">⚠️ debía llegar hace ${Math.abs(d)} día(s)</span>`
      : d === 0 ? '<span style="color:var(--gold);">llega hoy</span>'
      : d === 1 ? 'llega mañana'
      : `llega en ${d} días`;
    const marcada = enCaminoMarcadas.has(Number(c.id));
    // El costo solo viene para el admin
    const costo = c.costo_unitario === undefined ? '' : ` · ${fmtCLP(c.costo_unitario)} c/u`;

    return `
      <div class="agotado-fila${marcada ? ' camino-marcada' : ''}">
        <div class="agotado-cabecera">
          <input type="checkbox" class="camino-casilla" data-marcar-camino="${c.id}" ${marcada ? 'checked' : ''}
                 aria-label="Marcar que llegó: ${escHtml(c.producto)}">
          <div class="agotado-datos">
            <strong>${escHtml(c.producto)}</strong>
            <small>${num(c.cantidad)} unidad(es)${costo}${c.proveedor ? ' · ' + escHtml(c.proveedor) : ''}</small>
            <small>Comprada hace ${num(c.dias_esperando)} día(s) · ${cuando}</small>
          </div>
        </div>
        <div class="agotado-acciones">
          <button class="btn btn-green btn-sm" data-recibir-camino="${c.id}">📦 Ya llegó</button>
          ${esAdmin() ? `
          <button class="btn btn-ghost btn-sm" data-ver-producto-camino="${c.producto_id}">Ver producto</button>
          <button class="btn btn-ghost btn-sm" data-editar-camino="${c.id}" title="Corregir unidades, costo, vendedor o fechas">✏️ Editar</button>
          <button class="btn btn-ghost btn-sm" data-eliminar-camino="${c.id}" title="Eliminar esta compra: para una cargada por error o repetida" style="color:var(--red);">🗑️ Eliminar</button>` : ''}
        </div>
      </div>`;
  }).join('');
  pintarBarraEnCamino();
}

/* La barra de arriba ("Marcar todas") y el botón verde del pie. */
function pintarBarraEnCamino() {
  const compras = enCaminoCache?.compras || [];
  const marcadas = compras.filter(c => enCaminoMarcadas.has(Number(c.id)));
  const barra = document.getElementById('enCaminoBarra');
  const todas = document.getElementById('enCaminoTodas');
  const texto = document.getElementById('enCaminoMarcadasTexto');
  const btn = document.getElementById('btnMarcarLlegadas');

  // Con una sola compra no hay nada que juntar: basta su botón "Ya llegó"
  if (barra) barra.style.display = compras.length > 1 ? '' : 'none';
  if (todas) {
    todas.checked = compras.length > 0 && marcadas.length === compras.length;
    todas.indeterminate = marcadas.length > 0 && marcadas.length < compras.length;
  }
  const unidades = marcadas.reduce((s, c) => s + num(c.cantidad), 0);
  if (texto) texto.textContent = marcadas.length ? `${marcadas.length} marcada(s) · ${unidades} unidad(es)` : 'Marca las que llegaron y confírmalas juntas.';
  if (btn) {
    btn.style.display = compras.length > 1 ? '' : 'none';
    btn.disabled = marcadas.length === 0;
    btn.textContent = marcadas.length ? `📦 Marcar llegadas (${marcadas.length})` : '📦 Marcar llegadas';
  }
}

function alternarMarcaEnCamino(id, marcada) {
  if (marcada) enCaminoMarcadas.add(Number(id)); else enCaminoMarcadas.delete(Number(id));
  document.querySelector(`[data-marcar-camino="${Number(id)}"]`)?.closest('.agotado-fila')?.classList.toggle('camino-marcada', marcada);
  pintarBarraEnCamino();
}

function marcarTodasEnCamino(marcar) {
  enCaminoMarcadas.clear();
  if (marcar) (enCaminoCache?.compras || []).forEach(c => enCaminoMarcadas.add(Number(c.id)));
  pintarEnCamino();
}

/* EDITAR Y ELIMINAR UNA COMPRA POR LLEGAR (v132, pedido del dueño el
   10-10-2026: una carga masiva repetida dejó dos compras iguales y no había
   cómo sacar una). Solo admin: los botones no se dibujan para el trabajador y
   el servidor lo exige igual (auth de administrador en las dos rutas). */
function abrirEditarPorLlegar(ingresoId) {
  if (!esAdmin()) return;
  const c = (enCaminoCache?.compras || []).find(x => Number(x.id) === Number(ingresoId));
  if (!c) return;
  const poner = (id, valor) => { const el = document.getElementById(id); if (el) el.value = valor ?? ''; };
  poner('eplId', c.id);
  poner('eplCantidad', num(c.cantidad));
  poner('eplCosto', num(c.costo_unitario));
  poner('eplProveedor', c.proveedor || '');
  poner('eplMarketplace', c.marketplace || '');
  poner('eplFechaCompra', String(c.fecha_compra || '').slice(0, 10));
  poner('eplFechaLlegada', String(c.fecha_llegada_estimada || '').slice(0, 10));
  const titulo = document.getElementById('eplProducto');
  if (titulo) titulo.textContent = c.producto;
  document.getElementById('modalEditarPorLlegar')?.classList.add('show');
}

async function guardarEditarPorLlegar() {
  if (!esAdmin()) return;
  const valor = id => document.getElementById(id)?.value.trim() ?? '';
  const id = Number(valor('eplId'));
  const c = (enCaminoCache?.compras || []).find(x => Number(x.id) === id);
  if (!c) return;

  const cantidad = Number(valor('eplCantidad'));
  const costo = Number(valor('eplCosto'));
  if (!Number.isInteger(cantidad) || cantidad < 1) { showToast('Las unidades tienen que ser un número entero, de 1 o más', 'err'); return; }
  if (!(costo >= 0) || valor('eplCosto') === '') { showToast('Escribe el costo por unidad', 'err'); return; }
  if (!valor('eplFechaCompra')) { showToast('Falta la fecha de la compra', 'err'); return; }

  // Solo viaja lo que cambió: el servidor no toca lo que no recibe
  const datos = {};
  if (cantidad !== num(c.cantidad)) datos.cantidad = cantidad;
  if (costo !== num(c.costo_unitario)) datos.costo_unitario = costo;
  if (valor('eplProveedor') !== (c.proveedor || '')) datos.proveedor = valor('eplProveedor');
  if (valor('eplMarketplace') !== (c.marketplace || '')) datos.marketplace = valor('eplMarketplace');
  if (valor('eplFechaCompra') !== String(c.fecha_compra || '').slice(0, 10)) datos.fecha_compra = valor('eplFechaCompra');
  if (valor('eplFechaLlegada') !== String(c.fecha_llegada_estimada || '').slice(0, 10)) datos.fecha_llegada_estimada = valor('eplFechaLlegada');
  if (!Object.keys(datos).length) { cerrarModal('modalEditarPorLlegar'); return; }

  const btn = document.getElementById('btnGuardarEditarPorLlegar');
  if (btn) btn.disabled = true;
  try {
    const r = await API.productos.editarCompraPorLlegar(id, datos);
    cerrarModal('modalEditarPorLlegar');
    showToast('Compra corregida', 'ok');
    if (r?.aviso_gasto) await ventanaAviso(r.aviso_gasto, { titulo: 'Revisa el gasto en Finanzas' });
    await actualizarAvisoEnCamino();
    pintarEnCamino();
    if (typeof cargarProductos === 'function') cargarProductos(true);
  } catch (err) {
    showToast(err.message || 'No se pudo corregir la compra', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function eliminarCompraPorLlegar(ingresoId) {
  if (!esAdmin()) return;
  const c = (enCaminoCache?.compras || []).find(x => Number(x.id) === Number(ingresoId));
  if (!c) return;
  const seguro = await ventanaConfirmar(
    `${c.producto} · ${num(c.cantidad)} unidad(es)\n\n` +
    'Úsalo solo si la cargaste por error o quedó repetida. No cambia el stock.\n\n' +
    'Si no queda otra compra por llegar de ese producto, deja de aparecer en sevelin.cl/por-llegar.' +
    (c.compra_id ? '\n\nOjo: tiene un gasto en Finanzas → Gastos. Ese gasto no se borra solo.' : ''),
    { titulo: '¿Eliminar esta compra por llegar?', peligro: true, textoSi: 'Sí, eliminar' });
  if (!seguro) return;

  try {
    await API.productos.eliminarIngreso(ingresoId);
    showToast('Compra eliminada', 'ok');
    enCaminoMarcadas.delete(Number(ingresoId));
    await actualizarAvisoEnCamino();
    if (!enCaminoCache?.total) {
      cerrarModal('modalEnCamino');
      const btn = document.getElementById('btnEnCamino');
      if (btn) btn.hidden = true;
    } else pintarEnCamino();
    if (typeof cargarProductos === 'function') cargarProductos(true);
  } catch (err) {
    // El servidor explica por qué no se puede (clientes esperando en la web, reservas pagadas)
    await ventanaAviso(err.message || 'No se pudo eliminar la compra', { titulo: 'No se puede eliminar', peligro: true });
  }
}

// ============================================================
// Confirmar llegadas: una o varias, con cuántas unidades llegaron
// ============================================================

/* Confirmar desde el aviso, sin entrar al producto. Esto le avisa por correo
   a quienes lo reservaron, así que se confirma antes — con la ventana propia
   del POS, que además deja decir "llegaron menos". */
function recibirDesdeAviso(ingresoId) {
  const c = (enCaminoCache?.compras || []).find(x => Number(x.id) === Number(ingresoId));
  if (c) abrirConfirmarLlegadas([c]);
}

function recibirMarcadasEnCamino() {
  const marcadas = (enCaminoCache?.compras || []).filter(c => enCaminoMarcadas.has(Number(c.id)));
  if (!marcadas.length) { showToast('Marca al menos una compra', 'err'); return; }
  abrirConfirmarLlegadas(marcadas);
}

/* `compras`: [{ id, producto, cantidad, proveedor? }]. `alTerminar(resultados)`
   corre después de confirmar, para que quien abrió la ventana refresque lo
   suyo (la ficha del producto, por ejemplo). */
function abrirConfirmarLlegadas(compras, alTerminar) {
  const modal = document.getElementById('modalLlegadas');
  const lista = document.getElementById('llegadasLista');
  if (!modal || !lista || !Array.isArray(compras) || !compras.length) return;
  llegadasPorConfirmar = { compras, alTerminar: typeof alTerminar === 'function' ? alTerminar : null };

  const titulo = document.getElementById('llegadasTitulo');
  if (titulo) titulo.textContent = compras.length === 1 ? '¿Llegó esta mercadería?' : `¿Llegaron estas ${compras.length} compras?`;

  lista.innerHTML = compras.map(c => {
    const total = num(c.cantidad);
    return `
      <div class="llegada-fila" data-llegada="${Number(c.id)}" data-total="${total}">
        <div class="llegada-cabecera">
          <div class="llegada-nombre">
            <strong>${escHtml(c.producto)}</strong>
            <small>Vienen ${total} unidad(es)${c.proveedor ? ' · ' + escHtml(c.proveedor) : ''}</small>
          </div>
          <label class="llegada-cuantas">Llegaron
            <input type="number" inputmode="numeric" min="1" max="${total}" step="1" value="${total}" data-llegaron="${Number(c.id)}">
            de ${total}
          </label>
        </div>
        <div class="llegada-resto" data-resto-de="${Number(c.id)}" style="display:none;">
          <p data-resto-texto></p>
          <div class="antes-opciones">
            <label class="antes-opcion"><input type="radio" name="llegadaResto${Number(c.id)}" value="esperar" checked> Siguen por llegar</label>
            <label class="antes-opcion"><input type="radio" name="llegadaResto${Number(c.id)}" value="no_llega"> No van a llegar</label>
          </div>
        </div>
      </div>`;
  }).join('');

  actualizarResumenLlegadas();
  modal.classList.add('show');
  document.addEventListener('keydown', teclaEnLlegadas, true);
  setTimeout(() => document.getElementById('btnConfirmarLlegadas')?.focus(), 40);
}

function cerrarConfirmarLlegadas() {
  document.getElementById('modalLlegadas')?.classList.remove('show');
  document.removeEventListener('keydown', teclaEnLlegadas, true);
  llegadasPorConfirmar = null;
}

/* Esc cierra ESTA ventana aunque haya otra abierta más abajo en la página
   (la ficha del producto): el Esc general cierra la última del documento. */
function teclaEnLlegadas(e) {
  if (e.key !== 'Escape' || !llegadasPorConfirmar) return;
  if (document.getElementById('ventanaDialogo')?.classList.contains('show')) return;
  e.preventDefault(); e.stopPropagation();
  cerrarConfirmarLlegadas();
}

/* Lee lo escrito en cada fila. `error` trae el primer problema, con la fila
   que hay que corregir. */
function leerLlegadasEscritas() {
  const filas = Array.from(document.querySelectorAll('#llegadasLista .llegada-fila'));
  const llegadas = [];
  for (const fila of filas) {
    const id = Number(fila.dataset.llegada);
    const total = num(fila.dataset.total);
    const input = fila.querySelector('[data-llegaron]');
    const escrito = String(input?.value ?? '').trim();
    const llegaron = Number(escrito);
    if (escrito === '' || !Number.isInteger(llegaron) || llegaron < 1 || llegaron > total) {
      return { error: `Escribe cuántas llegaron: un número entre 1 y ${total}. Si no llegó ninguna, sácala de la lista.`, input };
    }
    const resto = llegaron < total ? (fila.querySelector('input[type="radio"]:checked')?.value || 'esperar') : null;
    llegadas.push({ id, total, llegaron, resto });
  }
  return { llegadas };
}

function actualizarResumenLlegadas() {
  const resumen = document.getElementById('llegadasResumen');
  const btn = document.getElementById('btnConfirmarLlegadas');
  let entran = 0, esperan = 0, noLlegan = 0, validas = 0;

  document.querySelectorAll('#llegadasLista .llegada-fila').forEach(fila => {
    const total = num(fila.dataset.total);
    const escrito = String(fila.querySelector('[data-llegaron]')?.value ?? '').trim();
    const llegaron = Number(escrito);
    const ok = escrito !== '' && Number.isInteger(llegaron) && llegaron >= 1 && llegaron <= total;
    const faltan = ok ? total - llegaron : 0;
    const caja = fila.querySelector('.llegada-resto');
    fila.classList.toggle('llegada-parcial', faltan > 0);
    if (caja) {
      caja.style.display = faltan > 0 ? '' : 'none';
      const texto = caja.querySelector('[data-resto-texto]');
      if (texto) texto.textContent = faltan === 1 ? 'Falta 1 unidad. ¿Qué pasa con ella?' : `Faltan ${faltan} unidades. ¿Qué pasa con ellas?`;
    }
    if (!ok) return;
    validas += 1;
    entran += llegaron;
    if (faltan > 0) {
      if (fila.querySelector('input[type="radio"]:checked')?.value === 'no_llega') noLlegan += faltan;
      else esperan += faltan;
    }
  });

  if (resumen) {
    const partes = [`Entran <b>${entran}</b> unidad(es) al stock`];
    if (esperan) partes.push(esperan === 1 ? '1 sigue por llegar' : `${esperan} siguen por llegar`);
    if (noLlegan) partes.push(noLlegan === 1 ? '1 no va a llegar' : `${noLlegan} no van a llegar`);
    resumen.innerHTML = partes.join(' · ') + '.';
  }
  if (btn) btn.textContent = validas > 1 ? `Sí, llegaron las ${validas}` : 'Sí, llegó';
}

async function confirmarLlegadasEscritas() {
  const pendiente = llegadasPorConfirmar;
  if (!pendiente) return;
  const { llegadas, error, input } = leerLlegadasEscritas();
  if (error) { showToast(error, 'err'); input?.focus(); input?.select?.(); return; }

  const btn = document.getElementById('btnConfirmarLlegadas');
  if (btn) btn.disabled = true;
  try {
    const r = await API.productos.marcarLlegadas(llegadas.map(l => ({
      id: l.id,
      ...(l.resto ? { cantidad_recibida: l.llegaron, resto: l.resto } : {})
    })));
    const resultados = r?.resultados || [];
    const nombreDe = id => pendiente.compras.find(c => Number(c.id) === Number(id))?.producto || `Compra #${id}`;
    cerrarConfirmarLlegadas();

    const buenas = resultados.filter(x => x.ok);
    const malas = resultados.filter(x => !x.ok);
    buenas.forEach(x => enCaminoMarcadas.delete(Number(x.id)));
    if (buenas.length) {
      showToast(buenas.length === 1
        ? `${nombreDe(buenas[0].id)}: llegó, stock ${num(buenas[0].stock_nuevo)}`
        : `Llegaron ${num(r.unidades)} unidad(es) de ${buenas.length} compras`, 'ok');
    }

    /* Lo que hay que LEER se muestra en una ventana, no en un aviso que se
       va solo: una compra que no entró, unidades ya vendidas en la web que
       hay que apartar, o plata que no llegó. */
    const hayQueLeer = malas.length || buenas.some(x => num(x.apartadas_web) > 0 || x.aviso_gasto || x.aviso_capas);
    if (hayQueLeer) {
      const filas = resultados.map(x => {
        if (!x.ok) return `<li class="mal"><strong>${escHtml(nombreDe(x.id))}</strong>: no se confirmó. ${escHtml(x.error || '')}</li>`;
        const avisos = [];
        if (num(x.apartadas_web) > 0) avisos.push(`${num(x.apartadas_web)} unidad(es) ya estaban vendidas en sevelin.cl: apártalas, no entraron al stock. Mira Página Web → Pedidos Web.`);
        if (x.aviso_gasto) avisos.push(x.aviso_gasto);
        if (x.aviso_capas) avisos.push(x.aviso_capas);
        return `<li><strong>${escHtml(nombreDe(x.id))}</strong>: entraron ${num(x.llegaron) - num(x.apartadas_web)}, stock ${num(x.stock_nuevo)}`
          + (num(x.faltan) > 0 ? `. Faltaron ${num(x.faltan)}: ${x.resto === 'no_llega' ? 'no van a llegar' : 'siguen por llegar'}` : '')
          + avisos.map(a => `<small>${escHtml(a)}</small>`).join('') + '</li>';
      }).join('');
      await ventanaAviso('', {
        titulo: malas.length ? `${malas.length} compra(s) no se confirmaron` : 'Llegadas confirmadas: lee esto',
        detalleHtml: `<ul class="llegada-resultado">${filas}</ul>`,
        peligro: malas.length > 0
      });
    } else if (buenas.some(x => x.aviso_tienda)) {
      setTimeout(() => showToast('La tienda avisa por correo a quienes esperaban lo que ya no está por llegar', 'ok'), 1800);
    }

    await actualizarAvisoEnCamino();
    if (!enCaminoCache?.total) {
      cerrarModal('modalEnCamino');
      const btnCamino = document.getElementById('btnEnCamino');
      if (btnCamino) btnCamino.hidden = true;
    } else if (document.getElementById('modalEnCamino')?.classList.contains('show')) pintarEnCamino();
    if (esAdmin() && typeof cargarProductos === 'function') cargarProductos(true);
    if (pendiente.alTerminar) await pendiente.alTerminar(resultados);
  } catch (err) {
    showToast(err.message || 'No se pudo confirmar la llegada', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}
