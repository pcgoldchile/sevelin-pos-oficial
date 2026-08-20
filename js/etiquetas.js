// ==========================================
// ETIQUETAS.JS - Etiquetas de código de barras (58 mm / 80 mm)
// ------------------------------------------
// Pensado para impresoras térmicas tipo Tuu Pro 2 / Haulmer. El contenido
// se escala según los campos marcados: mientras menos datos, más grande
// sale el código de barras.
// ==========================================

let productoEtiqueta = null;

const elModalEtiqueta = document.getElementById('modalEtiqueta');
const elEtiquetaProducto = document.getElementById('etiquetaProducto');
const elEtiquetaPreview = document.getElementById('etiquetaPreview');
const elEtqNombre = document.getElementById('etqNombre');
const elEtqPrecio = document.getElementById('etqPrecio');
const elEtqBarcode = document.getElementById('etqBarcode');
const elEtqCantidad = document.getElementById('etqCantidad');
const elEtqAncho = document.getElementById('etqAncho');
const elBtnCerrarEtiqueta = document.getElementById('btnCerrarEtiqueta');
const elBtnImprimirEtiqueta = document.getElementById('btnImprimirEtiqueta');

document.addEventListener('DOMContentLoaded', () => {
  [elEtqNombre, elEtqPrecio, elEtqBarcode, elEtqAncho].forEach(el => {
    if (el) el.addEventListener('change', renderPreviewEtiqueta);
  });
  if (elBtnCerrarEtiqueta) elBtnCerrarEtiqueta.addEventListener('click', cerrarModalEtiqueta);
  if (elBtnImprimirEtiqueta) elBtnImprimirEtiqueta.addEventListener('click', imprimirEtiquetas);
  if (elModalEtiqueta) {
    elModalEtiqueta.addEventListener('click', (e) => { if (e.target === elModalEtiqueta) cerrarModalEtiqueta(); });
  }
});

function abrirModalEtiqueta(producto) {
  if (!producto || !elModalEtiqueta) return;
  productoEtiqueta = producto;

  if (elEtiquetaProducto) {
    elEtiquetaProducto.textContent = `${producto.nombre} · ${fmtCLP(producto.precio_unitario)}` +
      (producto.codigo_barras ? ` · ${producto.codigo_barras}` : ' · sin código de barras');
  }

  // Si el producto no tiene código de barras, se usa el SKU como respaldo
  if (elEtqBarcode) {
    const hayCodigo = !!(producto.codigo_barras || producto.sku);
    elEtqBarcode.checked = hayCodigo;
    elEtqBarcode.disabled = !hayCodigo;
    document.getElementById('itemEtqBarcode')?.classList.toggle('disabled', !hayCodigo);
  }
  if (elEtqCantidad) elEtqCantidad.value = 1;

  renderPreviewEtiqueta();
  elModalEtiqueta.classList.add('show');
}

function cerrarModalEtiqueta() {
  if (elModalEtiqueta) elModalEtiqueta.classList.remove('show');
  productoEtiqueta = null;
}

function codigoDeEtiqueta(p) {
  return String(p.codigo_barras || p.sku || '').trim();
}

/* Elige el formato del código: EAN-13/EAN-8 cuando el largo calza, y
   CODE128 para SKU alfanuméricos. */
function formatoBarras(codigo) {
  if (/^\d{13}$/.test(codigo)) return 'EAN13';
  if (/^\d{8}$/.test(codigo)) return 'EAN8';
  if (/^\d{12}$/.test(codigo)) return 'UPC';
  return 'CODE128';
}

function construirEtiquetaHTML(p, opciones) {
  const conNombre = opciones.nombre;
  const conPrecio = opciones.precio;
  const conCodigo = opciones.barcode && codigoDeEtiqueta(p);

  // Menos datos ⇒ más espacio para el código de barras
  const campos = [conNombre, conPrecio, conCodigo].filter(Boolean).length;
  const alturaBarras = campos <= 1 ? 58 : (campos === 2 ? 46 : 36);
  const tamNombre = conPrecio && conCodigo ? 11 : 13;
  const tamPrecio = campos === 1 ? 26 : 18;

  return `
    <div class="etiqueta" data-altura="${alturaBarras}">
      ${conNombre ? `<div class="etq-nombre" style="font-size:${tamNombre}px;">${escHtml(p.nombre)}</div>` : ''}
      ${conPrecio ? `<div class="etq-precio" style="font-size:${tamPrecio}px;">${fmtCLP(p.precio_unitario)}</div>` : ''}
      ${conCodigo ? `<svg class="etq-barcode" data-codigo="${escHtml(codigoDeEtiqueta(p))}"></svg>` : ''}
      ${!conNombre && !conPrecio && !conCodigo ? '<div class="etq-nombre">Marca al menos un dato</div>' : ''}
    </div>
  `;
}

/* Dibuja los códigos de barras de un contenedor ya insertado en el DOM */
function pintarBarras(contenedor, alturaPorDefecto) {
  if (typeof JsBarcode === 'undefined') return;

  contenedor.querySelectorAll('.etq-barcode').forEach(svg => {
    const codigo = svg.dataset.codigo || '';
    const altura = Number(svg.closest('.etiqueta')?.dataset.altura) || alturaPorDefecto || 40;
    try {
      JsBarcode(svg, codigo, {
        format: formatoBarras(codigo),
        width: 1.6,
        height: altura,
        fontSize: 12,
        margin: 2,
        displayValue: true
      });
    } catch (_) {
      // Si el código no calza con el formato estricto, se cae a CODE128
      try {
        JsBarcode(svg, codigo, { format: 'CODE128', width: 1.6, height: altura, fontSize: 12, margin: 2 });
      } catch (__) {
        svg.outerHTML = `<div class="etq-nombre">${escHtml(codigo)}</div>`;
      }
    }
  });
}

function opcionesEtiqueta() {
  return {
    nombre: !!(elEtqNombre && elEtqNombre.checked),
    precio: !!(elEtqPrecio && elEtqPrecio.checked),
    barcode: !!(elEtqBarcode && elEtqBarcode.checked)
  };
}

function renderPreviewEtiqueta() {
  if (!elEtiquetaPreview || !productoEtiqueta) return;

  const ancho = elEtqAncho?.value || '58mm';
  elEtiquetaPreview.style.setProperty('--etq-ancho', ancho);
  elEtiquetaPreview.innerHTML = construirEtiquetaHTML(productoEtiqueta, opcionesEtiqueta());
  pintarBarras(elEtiquetaPreview);
}

function imprimirEtiquetas() {
  if (!productoEtiqueta) return;

  const opciones = opcionesEtiqueta();
  if (!opciones.nombre && !opciones.precio && !opciones.barcode) {
    showToast('Marca al menos un dato para la etiqueta', 'err');
    return;
  }

  const area = document.getElementById('etiquetaPrintArea');
  if (!area) return;

  const cantidad = Math.min(Math.max(Number(elEtqCantidad?.value) || 1, 1), 60);
  const ancho = elEtqAncho?.value || '58mm';

  document.documentElement.style.setProperty('--etq-ancho', ancho);
  area.innerHTML = Array.from({ length: cantidad },
    () => construirEtiquetaHTML(productoEtiqueta, opciones)).join('');
  pintarBarras(area);

  document.body.classList.remove('print-ticket', 'print-ot', 'print-ficha');
  document.body.classList.add('print-etiqueta');

  const nombreArchivo = `Etiqueta ${productoEtiqueta.sku || productoEtiqueta.nombre} - SEVELIN`;
  if (typeof ponerTituloImpresion === 'function') ponerTituloImpresion(nombreArchivo);

  setTimeout(() => {
    window.print();
    if (typeof restaurarTitulo === 'function') setTimeout(restaurarTitulo, 1500);
  }, 200);
}
