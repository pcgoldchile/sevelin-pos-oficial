// ==========================================
// LOTES.JS - Capas de costo por producto (PEPS / FIFO)
// ------------------------------------------
// Un producto puede tener el mismo artículo comprado a distintos precios.
// Con los lotes activos, cada venta consume primero las unidades más
// antiguas y toma SU costo, en vez de usar un costo único del catálogo.
//
// La opción nace APAGADA para todos los productos, nuevos y existentes.
// La única forma de encenderla es el checkbox del editor de producto.
//
// 21-09-2026: las capas YA NO se cargan con un formulario propio. Se crean
// solas al registrar una compra (POST /api/productos/:id/compras), porque
// eran el mismo hecho pedido dos veces. Acá queda solo mostrarlas y
// poder eliminar una mal cargada.
//
// El descuento por PEPS lo hace la base de datos (función fifo_consumir de
// sql/09-lotes-fifo-comision.sql), no el navegador: así dos cajas vendiendo
// al mismo tiempo no se llevan la misma capa.
// ==========================================

const elProdUsaLotes = document.getElementById('prodUsaLotes');
const elBloqueProdLotes = document.getElementById('bloqueProdLotes');
const elProdLotesLista = document.getElementById('prodLotesLista');
const elProdLotesAviso = document.getElementById('prodLotesAviso');

// Capas por producto para pintar la tabla: { productoId: [lote, ...] }
let lotesPorProducto = {};

document.addEventListener('DOMContentLoaded', () => {
  if (elProdUsaLotes) elProdUsaLotes.addEventListener('change', alternarLotesUI);
});

/* Muestra u oculta el bloque de lotes. Al encenderlo se avisa que el campo
   "Costo Unit." de arriba deja de mandar en las ventas, porque si no queda
   la duda de cuál de los dos costos se está usando. */
function alternarLotesUI() {
  const activo = !!(elProdUsaLotes && elProdUsaLotes.checked);
  if (elBloqueProdLotes) elBloqueProdLotes.style.display = activo ? 'block' : 'none';

  /* (B) Con PEPS activo el "Costo Unit." de arriba NO manda: lo deciden las
     capas. Dejarlo editable daba dos costos a la vista y ninguna forma de
     saber cuál se usaba. Queda de solo lectura y mostrando el promedio real
     de las capas vigentes. */
  const elCosto = document.getElementById('prodCosto');
  if (elCosto) {
    elCosto.classList.toggle('campo-atenuado', activo);
    elCosto.readOnly = activo;
    elCosto.title = activo
      ? 'Con PEPS activo lo deciden las capas: este campo solo sirve de respaldo si se vende más de lo cargado.'
      : '';
  }
  pintarCostoSegunLotes(activo ? (lotesPorProducto[editingProductId] || []) : null);

  if (activo && editingProductId) cargarLotesDelProducto(editingProductId);
  else if (activo && elProdLotesLista) {
    elProdLotesLista.innerHTML = '<p class="modal-hint">Guarda el producto primero: las capas se crean al registrar una compra.</p>';
  }
}

/* Promedio PONDERADO por unidades vivas, no promedio simple de las capas:
   10 unidades a $2.000 y 1 a $9.000 dan $2.636, no $5.500. Es el costo que
   de verdad va a salir de las próximas ventas. */
function costoPromedioDeLotes(lotes) {
  let unidades = 0, total = 0;
  for (const l of (lotes || [])) {
    const c = Math.max(0, Number(l.cantidad) || 0);
    unidades += c;
    total += c * (Number(l.costo_unitario) || 0);
  }
  return unidades > 0 ? Math.round(total / unidades) : null;
}

function pintarCostoSegunLotes(lotes) {
  const nota = document.getElementById('prodCostoLotesNota');
  if (!nota) return;
  if (lotes === null) { nota.textContent = ''; return; }

  const promedio = costoPromedioDeLotes(lotes);
  const unidades = (lotes || []).reduce((a, l) => a + Math.max(0, Number(l.cantidad) || 0), 0);
  nota.textContent = promedio === null
    ? '📚 PEPS activo: el costo lo deciden las capas. Todavía no hay ninguna — se crean al registrar una compra.'
    : `📚 Lo calculan tus capas: ${fmtCLP(promedio)} por unidad (promedio de ${unidades} unidad(es) vivas).`;
}

// ---------- Capas del producto que se está editando ----------
async function cargarLotesDelProducto(productoId) {
  if (!elProdLotesLista) return;
  elProdLotesLista.innerHTML = '<p class="modal-hint">Cargando lotes…</p>';

  try {
    const lotes = await API.productos.listarLotes(productoId);
    lotesPorProducto[productoId] = lotes || [];
    renderLotesModal(productoId, lotes || []);
    pintarCostoSegunLotes(lotes || []);
  } catch (err) {
    console.error('Error al cargar lotes:', err.message || err);
    elProdLotesLista.innerHTML = `<p class="modal-hint" style="color:var(--red);">No se pudieron cargar los lotes: ${err.message || 'error'}</p>`;
  }
}

function renderLotesModal(productoId, lotes) {
  if (!elProdLotesLista) return;

  if (!lotes.length) {
    elProdLotesLista.innerHTML = '<p class="modal-hint">Sin capas vigentes. Carga la primera con el formulario de arriba.</p>';
    if (elProdLotesAviso) elProdLotesAviso.style.display = '';
    return;
  }

  const unidades = lotes.reduce((a, l) => a + (Number(l.cantidad) || 0), 0);
  const valor = lotes.reduce((a, l) => a + (Number(l.cantidad) || 0) * (Number(l.costo_unitario) || 0), 0);

  elProdLotesLista.innerHTML = `
    <table class="data-table tabla-lotes">
      <thead>
        <tr>
          <th>#</th><th>Unidades</th><th>Costo unit.</th><th>Valor</th>
          <th>Cargado</th><th>Referencia</th><th style="text-align:right;">Quitar</th>
        </tr>
      </thead>
      <tbody>
        ${lotes.map((l, i) => `
          <tr${i === 0 ? ' class="lote-siguiente"' : ''}>
            <td>Lote ${i + 1}${i === 0 ? ' <span class="badge badge-green">se consume ahora</span>' : ''}</td>
            <td>${Number(l.cantidad) || 0} un.</td>
            <td>${fmtCLP(l.costo_unitario)}</td>
            <td>${fmtCLP((Number(l.cantidad) || 0) * (Number(l.costo_unitario) || 0))}</td>
            <td>${l.creado_en ? tsAChile(l.creado_en) : '—'}</td>
            <td>${l.referencia || '—'}</td>
            <td style="text-align:right;">
              <button class="btn btn-icon btn-icon-del" data-quitar-lote="${l.id}" title="Eliminar esta capa y descontar su stock">✕</button>
            </td>
          </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td><strong>Total</strong></td>
          <td><strong>${unidades} un.</strong></td>
          <td>Promedio: ${fmtCLP(unidades > 0 ? valor / unidades : 0)}</td>
          <td><strong>${fmtCLP(valor)}</strong></td>
          <td colspan="3"></td>
        </tr>
      </tfoot>
    </table>`;

  elProdLotesLista.querySelectorAll('button[data-quitar-lote]').forEach(btn => {
    btn.addEventListener('click', () => quitarLote(productoId, btn.dataset.quitarLote));
  });
}

async function quitarLote(productoId, loteId) {
  if (!confirm('¿Eliminar esta capa? Su stock vivo se descontará del producto.')) return;

  try {
    const r = await API.productos.eliminarLote_capa(productoId, loteId);
    showToast(`Capa eliminada (${r?.unidades_retiradas || 0} un. descontadas)`, 'ok');
    await cargarLotesDelProducto(productoId);
    if (typeof cargarProductos === 'function') await cargarProductos(true);
  } catch (err) {
    console.error('Error al eliminar la capa:', err.message || err);
    showToast(err.message || 'No se pudo eliminar la capa', 'err');
  }
}

// ============================================================
// COLUMNA DE LA TABLA DE PRODUCTOS
// ============================================================

/* Precarga las capas de todos los productos con lotes activos, para poder
   pintarlas en la tabla. Se llama una vez por recarga del catálogo: son
   pocos productos (solo los que el admin encendió a mano). */
async function precargarLotesVisibles(productos) {
  if (!esAdmin()) return;

  const conLotes = (productos || []).filter(p => p.usa_lotes);
  lotesPorProducto = {};
  if (!conLotes.length) return;

  /* RENDIMIENTO — antes esto lanzaba UNA petición por producto con
     lotes (Promise.all sobre N llamadas a listarLotes). Con 30 productos
     así, entrar a Productos disparaba 30 peticiones. Ahora es una sola
     llamada que el servidor agrupa.

     Se conserva el camino viejo como respaldo: si el endpoint nuevo no
     existe todavía (backend sin actualizar), la tabla sigue funcionando
     en vez de quedarse en "…" para siempre. */
  try {
    const resumen = await API.productos.lotesResumen();
    conLotes.forEach(p => { lotesPorProducto[p.id] = resumen[p.id] || resumen[String(p.id)] || []; });
    return;
  } catch (err) {
    console.warn('lotes-resumen no disponible, se usa el modo antiguo:', err.message || err);
  }

  await Promise.all(conLotes.map(async (p) => {
    try {
      lotesPorProducto[p.id] = await API.productos.listarLotes(p.id) || [];
    } catch (_) {
      lotesPorProducto[p.id] = [];   // un fallo puntual no debe romper la tabla
    }
  }));
}

/* Celda con el desglose: "Lote 1: 5 un. a $2.000 / Lote 2: 10 un. a $2.200".
   Se muestran hasta 3 capas para no reventar el ancho de la fila. */
function celdaLotes(producto) {
  if (!producto.usa_lotes) return '<span class="lotes-off">—</span>';

  const lotes = lotesPorProducto[producto.id];
  if (!Array.isArray(lotes)) return '<span class="lotes-off">…</span>';
  if (!lotes.length) return '<span class="badge badge-red">Sin capas cargadas</span>';

  const visibles = lotes.slice(0, 3).map((l, i) =>
    `<span class="capa-lote${i === 0 ? ' capa-actual' : ''}">Lote ${i + 1}: ${Number(l.cantidad) || 0} un. a ${fmtCLP(l.costo_unitario)}</span>`
  ).join(' / ');

  const restantes = lotes.length - 3;
  const unidades = lotes.reduce((a, l) => a + (Number(l.cantidad) || 0), 0);
  const valor = lotes.reduce((a, l) => a + (Number(l.cantidad) || 0) * (Number(l.costo_unitario) || 0), 0);

  return `
    <div class="celda-lotes" title="La capa más antigua es la que se consume en la próxima venta">
      ${visibles}${restantes > 0 ? ` <span class="capa-mas">+${restantes} más</span>` : ''}
      <small>${unidades} un. · promedio ${fmtCLP(unidades > 0 ? valor / unidades : 0)}</small>
    </div>`;
}
