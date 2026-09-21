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
  document.getElementById('enCaminoLista')?.addEventListener('click', (e) => {
    const recibir = e.target.closest('[data-recibir-camino]');
    if (recibir) { recibirDesdeAviso(Number(recibir.dataset.recibirCamino)); return; }
    const ver = e.target.closest('[data-ver-producto-camino]');
    if (ver) {
      cerrarModal('modalEnCamino');
      if (typeof abrirProductoDesdeAviso === 'function') abrirProductoDesdeAviso(Number(ver.dataset.verProductoCamino));
    }
  });
});

document.addEventListener('pos:sesion-iniciada', () => {
  if (intervaloEnCamino) { clearInterval(intervaloEnCamino); intervaloEnCamino = null; }
  if (!esAdmin()) return;
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
  if (!confirm('¿Este producto ya no se guarda acá?')) return;
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

async function actualizarAvisoEnCamino() {
  const btn = document.getElementById('btnEnCamino');
  const texto = document.getElementById('textoEnCamino');
  if (!btn || !texto || !tokenActual() || !esAdmin()) return;
  try {
    enCaminoCache = await API.productos.enCamino();
    const total = Number(enCaminoCache?.total) || 0;
    if (!total) { btn.hidden = true; return; }

    const vencidos = Number(enCaminoCache?.vencidos) || 0;
    texto.textContent = vencidos ? `${vencidos} por confirmar` : `${total} en camino`;
    btn.classList.toggle('camino-vencido', vencidos > 0);
    btn.title = vencidos
      ? `${vencidos} compra(s) que ya deberían haber llegado: confírmalas o corrige la fecha`
      : `${total} compra(s) en camino`;
    btn.hidden = false;
    if (document.getElementById('modalEnCamino')?.classList.contains('show')) pintarEnCamino();
  } catch (err) {
    console.error('Error al revisar la mercadería en camino:', err.message || err);
  }
}

function abrirModalEnCamino() {
  if (!enCaminoCache?.total) return;
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
      : 'No hay nada en camino.';
  }
  if (!compras.length) { cont.innerHTML = '<p class="modal-hint">Nada en camino.</p>'; return; }

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

    return `
      <div class="agotado-fila">
        <div class="agotado-cabecera">
          <div class="agotado-datos">
            <strong>${escHtml(c.producto)}</strong>
            <small>${num(c.cantidad)} unidad(es) · ${fmtCLP(c.costo_unitario)} c/u${c.proveedor ? ' · ' + escHtml(c.proveedor) : ''}</small>
            <small>Comprada hace ${num(c.dias_esperando)} día(s) · ${cuando}</small>
          </div>
        </div>
        <div class="agotado-acciones">
          <button class="btn btn-green btn-sm" data-recibir-camino="${c.id}">📦 Ya llegó</button>
          <button class="btn btn-ghost btn-sm" data-ver-producto-camino="${c.producto_id}">Ver producto</button>
        </div>
      </div>`;
  }).join('');
}

/* Confirmar desde el aviso, sin entrar al producto. Igual que en el
   editor, esto le avisa por correo a quienes lo reservaron, así que se
   confirma antes. */
async function recibirDesdeAviso(ingresoId) {
  const c = (enCaminoCache?.compras || []).find(x => Number(x.id) === Number(ingresoId));
  if (!c) return;
  if (!confirm(`¿Llegaron las ${num(c.cantidad)} unidades de "${c.producto}"?\n\nSe suman al stock y, si no queda nada más en camino de ese producto, la tienda le avisa por correo a quienes lo estaban esperando.`)) return;

  try {
    const r = await API.productos.compraRecibida(ingresoId);
    showToast(`${c.producto}: llegó, stock ${num(r.stock_nuevo)}`, 'ok');
    if (r?.aviso_tienda) setTimeout(() => showToast(r.aviso_tienda, 'ok'), 1800);
    await actualizarAvisoEnCamino();
    if (!enCaminoCache?.total) cerrarModal('modalEnCamino');
    else pintarEnCamino();
    if (typeof cargarProductos === 'function') cargarProductos(true);
  } catch (err) {
    showToast(err.message || 'No se pudo confirmar la llegada', 'err');
  }
}
