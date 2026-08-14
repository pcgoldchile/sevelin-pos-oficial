// ==========================================
// MERMAS.JS - Mermas / Pérdidas de Inventario (solo administrador)
// ------------------------------------------
// Da de baja stock dañado, robado o vencido. El backend descuenta el
// inventario y crea automáticamente un gasto con la clasificación
// "Mermas / Pérdidas de Inventario" por (cantidad × costo unitario).
// No genera venta ni afecta las utilidades comerciales.
// ==========================================

let mermaTipo = 'PRODUCTO';
let mermaItem = null;   // ítem elegido del catálogo o del taller

const elModalMerma = document.getElementById('modalMerma');
const elMermaTipoChips = document.getElementById('mermaTipoChips');
const elMermaBuscar = document.getElementById('mermaBuscar');
const elMermaSugerencias = document.getElementById('mermaSugerencias');
const elMermaSeleccion = document.getElementById('mermaSeleccion');
const elMermaCantidad = document.getElementById('mermaCantidad');
const elMermaCostoTotal = document.getElementById('mermaCostoTotal');
const elMermaObservacion = document.getElementById('mermaObservacion');
const elMermaAviso = document.getElementById('mermaAviso');
const elBtnCancelarMerma = document.getElementById('btnCancelarMerma');
const elBtnConfirmarMerma = document.getElementById('btnConfirmarMerma');
const elBtnMermaPOS = document.getElementById('btnMermaPOS');
const elBtnMermaRepuestos = document.getElementById('btnMermaRepuestos');

document.addEventListener('DOMContentLoaded', () => {
  // El botón del POS abre en modo producto; el del taller, en modo repuesto
  if (elBtnMermaPOS) elBtnMermaPOS.addEventListener('click', () => abrirModalMerma('PRODUCTO'));
  if (elBtnMermaRepuestos) elBtnMermaRepuestos.addEventListener('click', () => abrirModalMerma('REPUESTO'));

  if (elBtnCancelarMerma) elBtnCancelarMerma.addEventListener('click', cerrarModalMerma);
  if (elBtnConfirmarMerma) elBtnConfirmarMerma.addEventListener('click', confirmarMerma);

  if (elMermaTipoChips) {
    elMermaTipoChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => cambiarTipoMerma(chip.dataset.tipo));
    });
  }

  if (elMermaBuscar) {
    elMermaBuscar.addEventListener('input', buscarItemMerma);
    document.addEventListener('click', (e) => {
      if (elMermaSugerencias && e.target !== elMermaBuscar && !elMermaSugerencias.contains(e.target)) {
        elMermaSugerencias.classList.remove('show');
      }
    });
  }

  if (elMermaCantidad) elMermaCantidad.addEventListener('input', actualizarCostoMerma);

  if (elModalMerma) {
    elModalMerma.addEventListener('click', (e) => { if (e.target === elModalMerma) cerrarModalMerma(); });
  }
});

async function abrirModalMerma(tipo) {
  if (!elModalMerma) return;
  if (!esAdmin()) { showToast('Solo el administrador puede registrar mermas', 'err'); return; }

  // Se asegura tener los catálogos cargados para poder buscar
  if (tipo === 'PRODUCTO' && (typeof productsList === 'undefined' || productsList.length === 0)) {
    if (typeof cargarProductos === 'function') await cargarProductos();   // solo lectura: la caché sirve
  }
  if (tipo === 'REPUESTO' && (typeof repuestosList === 'undefined' || repuestosList.length === 0)) {
    if (typeof cargarRepuestos === 'function') await cargarRepuestos();
  }

  limpiarFormularioMerma();
  cambiarTipoMerma(tipo || 'PRODUCTO');
  elModalMerma.classList.add('show');
  setTimeout(() => elMermaBuscar?.focus(), 80);
}

function cerrarModalMerma() {
  if (elModalMerma) elModalMerma.classList.remove('show');
  mermaItem = null;
}

function limpiarFormularioMerma() {
  mermaItem = null;
  if (elMermaBuscar) elMermaBuscar.value = '';
  if (elMermaObservacion) elMermaObservacion.value = '';
  if (elMermaCantidad) elMermaCantidad.value = 1;
  if (elMermaSeleccion) elMermaSeleccion.style.display = 'none';
  if (elMermaSugerencias) elMermaSugerencias.classList.remove('show');
  actualizarCostoMerma();
}

function cambiarTipoMerma(tipo) {
  mermaTipo = tipo === 'REPUESTO' ? 'REPUESTO' : 'PRODUCTO';
  mermaItem = null;

  if (elMermaTipoChips) {
    elMermaTipoChips.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.tipo === mermaTipo));
  }
  if (elMermaBuscar) {
    elMermaBuscar.value = '';
    elMermaBuscar.placeholder = mermaTipo === 'PRODUCTO'
      ? 'Nombre, SKU o código de barras...'
      : 'Modelo, categoría o área del repuesto...';
  }
  if (elMermaSeleccion) elMermaSeleccion.style.display = 'none';
  actualizarCostoMerma();
}

/* Solo se ofrecen ítems con inventario real: los de stock ilimitado
   (servicios, mano de obra) no tienen nada físico que dar de baja. */
function buscarItemMerma() {
  if (!elMermaSugerencias) return;
  const q = (elMermaBuscar.value || '').trim().toLowerCase();

  if (!q) { elMermaSugerencias.classList.remove('show'); return; }

  let encontrados = [];

  if (mermaTipo === 'PRODUCTO') {
    const lista = (typeof productsList !== 'undefined' && Array.isArray(productsList)) ? productsList : [];
    encontrados = lista
      .filter(p => !p.stock_ilimitado)
      .filter(p => (p.nombre || '').toLowerCase().includes(q) ||
                   (p.sku || '').toLowerCase().includes(q) ||
                   (p.codigo_barras || '').toLowerCase().includes(q))
      .slice(0, 8)
      .map(p => ({
        id: p.id,
        etiqueta: p.nombre,
        detalle: `Stock: ${p.stock ?? 0} · Costo: ${fmtCLP(p.costo_unitario)}`,
        stock: Number(p.stock) || 0,
        costo: Number(p.costo_unitario) || 0
      }));
  } else {
    const lista = (typeof repuestosList !== 'undefined' && Array.isArray(repuestosList)) ? repuestosList : [];
    encontrados = lista
      .filter(r => !r.stock_ilimitado)
      .filter(r => [r.modelo, r.categoria, r.area, r.descripcion].some(v => (v || '').toLowerCase().includes(q)))
      .slice(0, 8)
      .map(r => ({
        id: r.id,
        etiqueta: `${r.modelo} · ${r.categoria}`,
        detalle: `${r.area} · Stock: ${r.stock ?? 0} · Costo: ${fmtCLP(r.costo_unitario)}`,
        stock: Number(r.stock) || 0,
        costo: Number(r.costo_unitario) || 0
      }));
  }

  if (encontrados.length === 0) {
    elMermaSugerencias.innerHTML = '<div class="suggestion-item"><span style="color:var(--text-muted);">Sin resultados con inventario físico</span></div>';
    elMermaSugerencias.classList.add('show');
    return;
  }

  elMermaSugerencias.innerHTML = encontrados.map((o, i) => `
    <div class="suggestion-item" data-idx="${i}">
      <span>${o.etiqueta}</span>
      <span>${o.detalle}</span>
    </div>
  `).join('');
  elMermaSugerencias.classList.add('show');

  elMermaSugerencias.querySelectorAll('[data-idx]').forEach(item => {
    item.addEventListener('click', () => seleccionarItemMerma(encontrados[Number(item.dataset.idx)]));
  });
}

function seleccionarItemMerma(item) {
  mermaItem = item;
  if (elMermaBuscar) elMermaBuscar.value = item.etiqueta;
  if (elMermaSugerencias) elMermaSugerencias.classList.remove('show');

  if (elMermaSeleccion) {
    elMermaSeleccion.style.display = 'block';
    elMermaSeleccion.textContent =
      `${item.etiqueta}\nStock disponible: ${item.stock} · Costo unitario: ${fmtCLP(item.costo)}`;
  }

  if (elMermaCantidad) {
    elMermaCantidad.max = item.stock;
    elMermaCantidad.value = Math.min(Number(elMermaCantidad.value) || 1, item.stock || 1);
  }
  actualizarCostoMerma();
  elMermaCantidad?.focus();
}

function actualizarCostoMerma() {
  const cantidad = Number(elMermaCantidad?.value) || 0;
  const costo = mermaItem ? mermaItem.costo : 0;

  if (elMermaCostoTotal) elMermaCostoTotal.value = fmtCLP(cantidad * costo);

  if (elMermaAviso) {
    if (mermaItem && cantidad > mermaItem.stock) {
      elMermaAviso.textContent = `Solo hay ${mermaItem.stock} unidad(es) disponibles.`;
      elMermaAviso.style.color = 'var(--red)';
    } else if (mermaItem && costo <= 0) {
      elMermaAviso.textContent = 'Este ítem no tiene costo unitario cargado: el gasto quedará en $0.';
      elMermaAviso.style.color = 'var(--gold)';
    } else {
      elMermaAviso.textContent = 'Esta operación no genera una venta ni afecta las utilidades comerciales.';
      elMermaAviso.style.color = '';
    }
  }
}

async function confirmarMerma() {
  const cantidad = Number(elMermaCantidad?.value) || 0;
  const observacion = (elMermaObservacion?.value || '').trim();

  if (!mermaItem) { showToast('Selecciona el ítem a dar de baja', 'err'); elMermaBuscar?.focus(); return; }
  if (cantidad <= 0) { showToast('La cantidad debe ser mayor a 0', 'err'); elMermaCantidad?.focus(); return; }
  if (cantidad > mermaItem.stock) { showToast(`Solo hay ${mermaItem.stock} unidad(es) disponibles`, 'err'); return; }
  if (!observacion) { showToast('La observación / motivo es obligatoria', 'err'); elMermaObservacion?.focus(); return; }

  const costoTotal = cantidad * mermaItem.costo;
  if (!confirm(
    `¿Confirmas dar de baja ${cantidad} × ${mermaItem.etiqueta}?\n\n` +
    `Se descontará del inventario y se registrará un gasto de ${fmtCLP(costoTotal)} ` +
    `en la clasificación "Mermas / Pérdidas de Inventario".`
  )) return;

  if (elBtnConfirmarMerma) elBtnConfirmarMerma.disabled = true;

  try {
    const r = await API.mermas.registrar({
      tipo: mermaTipo,
      item_id: mermaItem.id,
      cantidad,
      observacion
    });

    showToast(`Merma registrada · gasto de ${fmtCLP(r.gasto_registrado.costo_total)} generado`, 'ok');
    cerrarModalMerma();

    // Se refrescan los módulos afectados por el descuento de stock
    if (mermaTipo === 'PRODUCTO' && typeof cargarProductos === 'function') cargarProductos(true);   // la merma bajó stock
    if (mermaTipo === 'REPUESTO' && typeof cargarRepuestos === 'function') cargarRepuestos();
    if (typeof cargarCompras === 'function') cargarCompras();
  } catch (err) {
    console.error('Error al registrar la merma:', err.message || err);
    showToast(err.message || 'No se pudo registrar la merma', 'err');
  } finally {
    if (elBtnConfirmarMerma) elBtnConfirmarMerma.disabled = false;
  }
}
