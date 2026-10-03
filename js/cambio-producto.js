/* ============================================================
   CAMBIAR EL PRODUCTO DE UNA VENTA (v114, sql/82)
   ------------------------------------------------------------
   Pedido del dueño (03-10-2026): la web vendió un producto que en la tienda
   no estaba, y él entregó otro al mismo precio. Desde el Detalle de Venta,
   el admin cambia el producto de una línea:

   · El precio y el total no cambian (con otro precio es devolución + venta).
   · El producto nuevo sale del stock; el original vuelve SOLO si él lo
     marca: puede no haber existido nunca (descuadre de conteo).
   · El servidor recalcula el costo y la utilidad, y deja el registro.

   La ventana se arma al abrirla y se destruye al cerrar (mismo patrón que
   pedirConfirmacionMargen en pos.js): no deja ids fijos en index.html.
   La regla vive en POST /api/ventas/:id/cambiar-producto.
   ============================================================ */

/* Botón de cada línea del Detalle de Venta (lo pide renderDetalleVenta). */
function botonCambiarProducto(venta, item) {
  if (!esAdmin() || !item?.id || !item.producto_id || item.es_servicio) return '';
  if (item.repuesto_id || item.ot_repuesto_id) return '';
  if (venta?.estado === 'ANULADA') return '';
  return ` <button type="button" class="btn btn-sm btn-ghost admin-only" data-cambiar-producto="${item.id}"
    title="Se entregó otro producto en lugar de este (mismo precio)">🔁 Cambiar</button>`;
}

/* Historial de cambios de la venta, bajo la tabla de productos. */
function bloqueCambiosProducto(venta) {
  const cambios = venta?.cambios_producto || [];
  if (!cambios.length) return '';
  const filas = cambios.map(c => {
    const cuando = c.creado_en && typeof tsAChile === 'function' ? tsAChile(c.creado_en) : '';
    const stock = c.original_vuelve_stock ? 'el original volvió al stock' : 'el original no volvió al stock';
    return `<li>🔁 ${cuando ? `<small>${escHtml(cuando)}</small> · ` : ''}Se vendió <strong>${escHtml(c.nombre_anterior)}</strong>
      y se entregó <strong>${escHtml(c.nombre_nuevo)}</strong> (${stock})${c.motivo ? `. ${escHtml(c.motivo)}` : ''}</li>`;
  }).join('');
  return `<ul class="modal-hint" style="list-style:none; padding:0; margin:10px 0 0; display:flex; flex-direction:column; gap:4px;">${filas}</ul>`;
}

/* La llama renderDetalleVenta() después de pintar: engancha los botones. */
function engancharCambioProducto(venta) {
  document.querySelectorAll('#detalleVentaContent [data-cambiar-producto]').forEach(b => {
    b.addEventListener('click', () => {
      const item = (venta.items || []).find(i => Number(i.id) === Number(b.dataset.cambiarProducto));
      if (item) abrirCambioProducto(venta, item);
    });
  });
}

function candidatosCambioProducto(texto, item) {
  const palabras = String(texto || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!palabras.length || palabras.join('').length < 2) return [];
  const cantidad = Number(item.cantidad) || 1;
  return (typeof productsList !== 'undefined' ? productsList : [])
    .filter(p => !p.archivado && !p.es_servicio && Number(p.id) !== Number(item.producto_id))
    .filter(p => {
      const hay = `${p.nombre || ''} ${p.sku || ''} ${p.codigo_barras || ''}`.toLowerCase();
      return palabras.every(w => hay.includes(w));
    })
    // Primero lo que sí alcanza para entregar
    .sort((a, b) => {
      const alcanza = p => (p.stock_ilimitado || Number(p.stock) >= cantidad) ? 1 : 0;
      return (alcanza(b) - alcanza(a)) || String(a.nombre).localeCompare(String(b.nombre));
    })
    .slice(0, 8);
}

function abrirCambioProducto(venta, item) {
  document.getElementById('modalCambioProducto')?.remove();
  const cantidad = Number(item.cantidad) || 1;
  const numero = String(venta.numero_orden ?? venta.id).padStart(5, '0');
  let elegido = null;

  const cont = document.createElement('div');
  cont.id = 'modalCambioProducto';
  cont.className = 'modal-overlay show';
  cont.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="cambioProductoTitulo" style="max-width:520px;">
      <h2 id="cambioProductoTitulo">🔁 Cambiar producto · Orden #${numero}</h2>
      <p class="modal-hint">
        Se vendió <strong>${cantidad}x ${escHtml(item.nombre)}</strong> a ${fmtCLP(item.precio_unitario)} c/u.
        Elige el producto que se entregó en su lugar. <strong>El precio y el total de la venta no cambian.</strong>
      </p>

      <div class="field">
        <label for="cambioProductoBuscar">Producto que se entregó</label>
        <input type="text" id="cambioProductoBuscar" placeholder="Escribe el nombre, SKU o código de barras…" autocomplete="off">
      </div>
      <div data-cambio-sugerencias class="complementos-sugerencias"></div>
      <div data-cambio-elegido style="display:none; margin-top:8px; padding:10px 12px; border:1px solid var(--border-strong); border-radius:10px; font-size:13.5px; line-height:1.5;"></div>

      <div class="field" data-cambio-serie style="display:none; margin-top:10px;">
        <label for="cambioProductoSerie">N° de serie del producto entregado (opcional)</label>
        <input type="text" id="cambioProductoSerie" maxlength="120" autocomplete="off">
      </div>

      <fieldset style="border:0; padding:0; margin:14px 0 0;">
        <legend style="font-weight:600; font-size:13.5px; margin-bottom:6px;">¿Qué pasa con ${cantidad === 1 ? 'la unidad' : `las ${cantidad} unidades`} de "${escHtml(item.nombre)}"?</legend>
        <label class="check-item"><input type="radio" name="cambioProductoOriginal" value="si">
          <span>Vuelve al stock: lo tengo en la tienda y se puede vender</span></label>
        <label class="check-item" style="margin-top:6px;"><input type="radio" name="cambioProductoOriginal" value="no">
          <span>No vuelve al stock: no lo tenía, se perdió o no sirve</span></label>
      </fieldset>

      <div class="field" style="margin-top:12px;">
        <label for="cambioProductoMotivo">Motivo (opcional)</label>
        <input type="text" id="cambioProductoMotivo" maxlength="300" placeholder="Ej: estaba agotado, conversado con el cliente">
      </div>

      <p class="modal-hint" data-cambio-error role="alert" style="display:none; color:var(--red);"></p>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" data-cerrar-modal>Cancelar</button>
        <button type="button" class="btn btn-primary" data-cambio-confirmar>Cambiar producto</button>
      </div>
    </div>`;
  document.body.appendChild(cont);

  const buscar = cont.querySelector('#cambioProductoBuscar');
  const sugerencias = cont.querySelector('[data-cambio-sugerencias]');
  const cajaElegido = cont.querySelector('[data-cambio-elegido]');
  const filaSerie = cont.querySelector('[data-cambio-serie]');
  const elError = cont.querySelector('[data-cambio-error]');
  const btnConfirmar = cont.querySelector('[data-cambio-confirmar]');
  const mostrarError = (texto) => { elError.textContent = texto; elError.style.display = texto ? '' : 'none'; };
  const cerrar = () => cont.remove();

  const pintarSugerencias = () => {
    const lista = candidatosCambioProducto(buscar.value, item);
    if (!buscar.value.trim() || elegido) { sugerencias.innerHTML = ''; return; }
    sugerencias.innerHTML = lista.length
      ? lista.map(p => {
          const alcanza = p.stock_ilimitado || Number(p.stock) >= cantidad;
          return `<button type="button" class="complemento-sugerencia" data-cambio-elegir="${p.id}" ${alcanza ? '' : 'disabled style="opacity:.55; cursor:not-allowed;"'}>
            ${escHtml(p.nombre)} <small>${fmtCLP(p.precio_unitario)} · ${p.stock_ilimitado ? 'sin control de stock' : `stock ${Number(p.stock) || 0}`}${alcanza ? '' : ' · no alcanza'}</small>
          </button>`;
        }).join('')
      : '<p class="modal-hint">Ningún producto coincide. Si todavía no lo creas, créalo en Productos y vuelve.</p>';
  };

  const pintarElegido = () => {
    cajaElegido.style.display = elegido ? '' : 'none';
    filaSerie.style.display = elegido?.requiere_sn ? '' : 'none';
    if (!elegido) { cajaElegido.innerHTML = ''; return; }
    const precioLista = Number(elegido.precio_unitario) || 0;
    const precioVenta = Number(item.precio_unitario) || 0;
    const distinto = precioLista !== precioVenta
      ? `<br>Su precio de lista es ${fmtCLP(precioLista)}; en esta venta queda a ${fmtCLP(precioVenta)} (el total no cambia).`
      : '';
    // Solo el admin llega acá, y es quien ve costos.
    const costo = Number(elegido.costo_unitario) || 0;
    const utilidad = costo > 0
      ? `<br><span class="admin-only">Costo ${fmtCLP(costo)} c/u: esta línea deja ${fmtCLP((precioVenta - costo) * cantidad)}${elegido.usa_lotes ? ' (el costo final sale de sus lotes)' : ''}.</span>`
      : '<br><span class="admin-only">Este producto no tiene costo cargado: la utilidad de la venta va a quedar inflada.</span>';
    cajaElegido.innerHTML = `Se entrega: <strong>${cantidad}x ${escHtml(elegido.nombre)}</strong>
      <button type="button" class="btn btn-sm btn-ghost" data-cambio-quitar style="margin-left:6px;">cambiar</button>${distinto}${utilidad}`;
  };

  buscar.addEventListener('input', () => { mostrarError(''); pintarSugerencias(); });
  buscar.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    sugerencias.querySelector('[data-cambio-elegir]:not([disabled])')?.click();
  });

  const confirmar = async () => {
    mostrarError('');
    if (!elegido) { mostrarError('Elige el producto que se entregó.'); buscar.focus(); return; }
    const original = cont.querySelector('input[name="cambioProductoOriginal"]:checked')?.value;
    if (!original) { mostrarError('Marca si el producto original vuelve al stock o no.'); return; }
    btnConfirmar.disabled = true;
    try {
      const r = await API.ventas.cambiarProducto(venta.id, {
        venta_item_id: item.id,
        producto_nuevo_id: elegido.id,
        original_vuelve_stock: original === 'si',
        serial_number: cont.querySelector('#cambioProductoSerie')?.value.trim() || null,
        motivo: cont.querySelector('#cambioProductoMotivo')?.value.trim() || null
      });
      cerrar();
      showToast(`Producto cambiado: ahora la venta lleva "${elegido.nombre}"`, 'ok');
      if (r?.aviso) setTimeout(() => showToast(r.aviso, 'err'), 1500);
      // El detalle, el historial y el catálogo (el stock de los dos productos cambió)
      if (typeof verDetalleVenta === 'function') verDetalleVenta(venta.id);
      if (typeof cargarHistorial === 'function') cargarHistorial();
      if (typeof cargarProductos === 'function') cargarProductos(true);
    } catch (err) {
      mostrarError(err.message || 'No se pudo cambiar el producto');
      btnConfirmar.disabled = false;
    }
  };

  // Esc lo resuelve atajos.js pulsando el botón data-cerrar-modal
  cont.addEventListener('click', (e) => {
    if (e.target === cont || e.target.closest('[data-cerrar-modal]')) { cerrar(); return; }
    const elegir = e.target.closest('[data-cambio-elegir]');
    if (elegir && !elegir.disabled) {
      elegido = (typeof productsList !== 'undefined' ? productsList : []).find(p => Number(p.id) === Number(elegir.dataset.cambioElegir)) || null;
      buscar.value = elegido ? elegido.nombre : '';
      sugerencias.innerHTML = '';
      pintarElegido();
      return;
    }
    if (e.target.closest('[data-cambio-quitar]')) {
      elegido = null; buscar.value = ''; pintarElegido(); buscar.focus();
      return;
    }
    if (e.target.closest('[data-cambio-confirmar]')) confirmar();
  });

  setTimeout(() => buscar.focus(), 50);
}
