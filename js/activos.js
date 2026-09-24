// ==========================================
// ACTIVOS.JS — Activos de uso interno (solo administrador)
// ------------------------------------------
// Unidades que salen del stock vendible para usarse como herramienta o
// activo del taller. Caso que lo originó: se abrió una fuente de poder
// para usarla en el banco de pruebas, pero el POS y sevelin.cl seguían
// ofreciéndola como si estuviera para vender.
//
// ⚠️ NO MUEVE EL BALANCE (regla aprobada por el dueño el 24-09-2026).
// La compra ya está registrada en `compras`: anotarla de nuevo como gasto
// sería contarla dos veces. NO es una merma — la merma además genera un
// gasto de pérdida, y acá no se perdió nada.
//
// Los archivos de respaldo reutilizan el bucket privado
// "compras-documentos" y sus endpoints, así que heredan la protección
// FILE-01: se guarda la RUTA (estable), no la URL firmada (caduca en 1h).
// ==========================================

let activosLista = [];
let activoFiltroEstado = 'EN_USO';   // '' = todos
let activoItem = null;               // producto elegido para apartar
let activoDocRuta = '';              // ruta del archivo ya subido
let activoCerrandoId = null;         // activo que se está cerrando
let activoDestinoCierre = '';
let activoProductoDestino = null;    // equipo en el que se armó la unidad

const elActivosResumen = document.getElementById('activosResumen');
const elActivosTabla = document.getElementById('activosTablaBody');
const elActivosChips = document.getElementById('activosChips');
const elBtnNuevoActivo = document.getElementById('btnNuevoActivo');

const elModalActivo = document.getElementById('modalActivo');
const elActivoBuscar = document.getElementById('activoBuscar');
const elActivoSugerencias = document.getElementById('activoSugerencias');
const elActivoSeleccion = document.getElementById('activoSeleccion');
const elActivoCantidad = document.getElementById('activoCantidad');
const elActivoCostoTotal = document.getElementById('activoCostoTotal');
const elActivoMotivo = document.getElementById('activoMotivo');
const elActivoDocNumero = document.getElementById('activoDocNumero');
const elActivoArchivo = document.getElementById('activoArchivo');
const elBtnSubirActivoArchivo = document.getElementById('btnSubirActivoArchivo');
const elActivoEstadoArchivo = document.getElementById('activoEstadoArchivo');
const elActivoAviso = document.getElementById('activoAviso');
const elBtnCancelarActivo = document.getElementById('btnCancelarActivo');
const elBtnGuardarActivo = document.getElementById('btnGuardarActivo');

const elModalCerrarActivo = document.getElementById('modalCerrarActivo');
const elCerrarActivoTitulo = document.getElementById('cerrarActivoTitulo');
const elCerrarActivoChips = document.getElementById('cerrarActivoChips');
const elCerrarActivoNota = document.getElementById('cerrarActivoNota');
const elCerrarActivoDestinoBox = document.getElementById('cerrarActivoDestinoBox');
const elCerrarActivoDestinoBuscar = document.getElementById('cerrarActivoDestinoBuscar');
const elCerrarActivoDestinoSug = document.getElementById('cerrarActivoDestinoSug');
const elCerrarActivoAviso = document.getElementById('cerrarActivoAviso');
const elBtnCancelarCierreActivo = document.getElementById('btnCancelarCierreActivo');
const elBtnConfirmarCierreActivo = document.getElementById('btnConfirmarCierreActivo');

const ETIQUETAS_ESTADO_ACTIVO = {
  EN_USO: { texto: 'En uso', clase: 'badge-gold' },
  DEVUELTO_A_VENTA: { texto: 'Volvió a venta', clase: 'badge-green' },
  ARMADO_EN_PC: { texto: 'Armado en equipo', clase: 'badge-blue' },
  DADO_DE_BAJA: { texto: 'Dado de baja', clase: 'badge-red' }
};

document.addEventListener('DOMContentLoaded', () => {
  if (elBtnNuevoActivo) elBtnNuevoActivo.addEventListener('click', abrirModalActivo);
  if (elBtnCancelarActivo) elBtnCancelarActivo.addEventListener('click', cerrarModalActivo);
  if (elBtnGuardarActivo) elBtnGuardarActivo.addEventListener('click', guardarActivo);

  if (elActivosChips) {
    elActivosChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        activoFiltroEstado = chip.dataset.estado || '';
        elActivosChips.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
        cargarActivos();
      });
    });
  }

  if (elActivoBuscar) {
    elActivoBuscar.addEventListener('input', buscarProductoActivo);
    document.addEventListener('click', (e) => {
      if (elActivoSugerencias && e.target !== elActivoBuscar && !elActivoSugerencias.contains(e.target)) {
        elActivoSugerencias.classList.remove('show');
      }
    });
  }
  if (elActivoCantidad) elActivoCantidad.addEventListener('input', actualizarCostoActivo);

  if (elBtnSubirActivoArchivo) elBtnSubirActivoArchivo.addEventListener('click', () => elActivoArchivo?.click());
  if (elActivoArchivo) elActivoArchivo.addEventListener('change', subirArchivoActivo);

  if (elModalActivo) {
    elModalActivo.addEventListener('click', (e) => { if (e.target === elModalActivo) cerrarModalActivo(); });
  }

  // ---- Modal de cierre ----
  if (elBtnCancelarCierreActivo) elBtnCancelarCierreActivo.addEventListener('click', cerrarModalCierreActivo);
  if (elBtnConfirmarCierreActivo) elBtnConfirmarCierreActivo.addEventListener('click', confirmarCierreActivo);

  if (elCerrarActivoChips) {
    elCerrarActivoChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => elegirDestinoActivo(chip.dataset.destino));
    });
  }
  if (elCerrarActivoDestinoBuscar) {
    elCerrarActivoDestinoBuscar.addEventListener('input', buscarEquipoDestinoActivo);
  }
  if (elModalCerrarActivo) {
    elModalCerrarActivo.addEventListener('click', (e) => { if (e.target === elModalCerrarActivo) cerrarModalCierreActivo(); });
  }
});

/* ============================================================
   LISTADO
   ============================================================ */
async function cargarActivos() {
  if (!elActivosTabla) return;

  try {
    const filtros = activoFiltroEstado ? { estado: activoFiltroEstado } : {};
    const r = await API.activos.listar(filtros);
    activosLista = r.activos || [];
    renderResumenActivos(r.resumen || {});
    renderTablaActivos(activosLista);
  } catch (err) {
    console.error('Error al cargar los activos de uso interno:', err.message || err);
    showToast(err.message || 'No se pudieron cargar los activos', 'err');
  }
}

function renderResumenActivos(resumen) {
  if (!elActivosResumen) return;
  const unidades = num(resumen.unidades_en_uso);
  const valor = num(resumen.valor_en_uso);

  elActivosResumen.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">🔧 Unidades en uso interno</div>
        <div class="kpi-value">${unidades}</div>
        <div class="kpi-foot">Fuera del stock vendible ahora mismo</div>
      </div>
      <div class="kpi-card kpi-gold">
        <div class="kpi-label">📦 Inventario apartado (a costo)</div>
        <div class="kpi-value">${fmtCLP(valor)}</div>
        <div class="kpi-foot">No es una pérdida: tu balance no se movió</div>
      </div>
    </div>`;
}

function renderTablaActivos(lista) {
  if (!elActivosTabla) return;

  if (!lista.length) {
    elActivosTabla.innerHTML = `<tr class="empty-row"><td colspan="7">
      No hay unidades en uso interno. Usa "Pasar producto a uso interno" cuando saques algo del stock para el taller.
    </td></tr>`;
    return;
  }

  elActivosTabla.innerHTML = lista.map(a => {
    const estado = ETIQUETAS_ESTADO_ACTIVO[a.estado] || { texto: a.estado, clase: '' };
    const enUso = a.estado === 'EN_USO';
    const costoTotal = num(a.costo_unitario) * num(a.cantidad);

    // El número suelto sirve aunque no haya archivo; por eso se muestran los dos.
    const partesDoc = [];
    if (a.documento_numero) partesDoc.push(escHtml(a.documento_numero));
    if (a.documento_ruta) {
      partesDoc.push(`<span class="doc-check doc-ok" role="button" tabindex="0" data-doc="${a.id}"
            title="Ver el respaldo" style="cursor:pointer;">📎</span>`);
    }
    const doc = partesDoc.length ? partesDoc.join('<br>') : '<span style="color:var(--text-muted);">—</span>';

    return `<tr>
      <td>
        <strong>${escHtml(a.nombre)}</strong>
        ${a.sku ? `<br><span style="color:var(--text-muted);">${escHtml(a.sku)}</span>` : ''}
      </td>
      <td>${num(a.cantidad)}</td>
      <td>${fmtCLP(costoTotal)}</td>
      <td>${escHtml(a.motivo || '')}${a.cierre_nota ? `<br><span style="color:var(--text-muted);">Cierre: ${escHtml(a.cierre_nota)}</span>` : ''}</td>
      <td>${doc}</td>
      <td><span class="badge ${estado.clase}">${estado.texto}</span></td>
      <td>
        ${enUso ? `<button class="btn btn-sm" data-cerrar="${a.id}">Cerrar</button>
                   <button class="btn btn-sm btn-icon-del" data-borrar="${a.id}" title="Deshacer: la unidad vuelve al stock">✖</button>`
                : '<span style="color:var(--text-muted);">—</span>'}
      </td>
    </tr>`;
  }).join('');

  elActivosTabla.querySelectorAll('[data-doc]').forEach(b => {
    b.addEventListener('click', () => abrirDocumentoActivo(Number(b.dataset.doc)));
  });
  elActivosTabla.querySelectorAll('[data-cerrar]').forEach(b => {
    b.addEventListener('click', () => abrirModalCierreActivo(Number(b.dataset.cerrar)));
  });
  elActivosTabla.querySelectorAll('[data-borrar]').forEach(b => {
    b.addEventListener('click', () => eliminarActivo(Number(b.dataset.borrar)));
  });
}

/* Las URLs firmadas caducan, así que se pide una fresca al abrir.
   Igual que en Gastos: si en la base quedó una URL antigua, se abre directo. */
async function abrirDocumentoActivo(id) {
  const activo = activosLista.find(a => a.id === id);
  if (!activo || !activo.documento_ruta) return;

  if (/^https?:\/\//i.test(activo.documento_ruta)) {
    window.open(activo.documento_ruta, '_blank', 'noopener');
    return;
  }

  try {
    const { url } = await API.compras.firmarArchivo(activo.documento_ruta);
    if (url) window.open(url, '_blank', 'noopener');
    else showToast('No se pudo abrir el documento', 'err');
  } catch (err) {
    console.error('Error al firmar el documento del activo:', err.message || err);
    showToast(err.message || 'No se pudo abrir el documento', 'err');
  }
}

/* ============================================================
   ALTA
   ============================================================ */
async function abrirModalActivo() {
  if (!elModalActivo) return;
  if (!esAdmin()) { showToast('Solo el administrador puede apartar inventario', 'err'); return; }

  if (typeof productsList === 'undefined' || productsList.length === 0) {
    if (typeof cargarProductos === 'function') await cargarProductos();
  }

  limpiarFormularioActivo();
  elModalActivo.classList.add('show');
  setTimeout(() => elActivoBuscar?.focus(), 80);
}

function cerrarModalActivo() {
  if (elModalActivo) elModalActivo.classList.remove('show');
  activoItem = null;
  activoDocRuta = '';
}

function limpiarFormularioActivo() {
  activoItem = null;
  activoDocRuta = '';
  if (elActivoBuscar) elActivoBuscar.value = '';
  if (elActivoMotivo) elActivoMotivo.value = '';
  if (elActivoDocNumero) elActivoDocNumero.value = '';
  if (elActivoCantidad) elActivoCantidad.value = 1;
  if (elActivoSeleccion) elActivoSeleccion.style.display = 'none';
  if (elActivoSugerencias) elActivoSugerencias.classList.remove('show');
  if (elActivoEstadoArchivo) {
    elActivoEstadoArchivo.textContent = 'Sin archivo';
    elActivoEstadoArchivo.className = 'doc-estado doc-falta';
  }
  actualizarCostoActivo();
}

/* Solo productos con inventario real: los de stock ilimitado (servicios)
   no tienen una unidad física que apartar. */
function buscarProductoActivo() {
  if (!elActivoSugerencias) return;
  const q = (elActivoBuscar.value || '').trim().toLowerCase();
  if (!q) { elActivoSugerencias.classList.remove('show'); return; }

  const lista = (typeof productsList !== 'undefined' && Array.isArray(productsList)) ? productsList : [];
  const encontrados = lista
    .filter(p => !p.stock_ilimitado && num(p.stock) > 0)
    .filter(p => (p.nombre || '').toLowerCase().includes(q) ||
                 (p.sku || '').toLowerCase().includes(q) ||
                 (p.codigo_barras || '').toLowerCase().includes(q))
    .slice(0, 8)
    .map(p => ({
      id: p.id,
      etiqueta: p.nombre,
      sku: p.sku || '',
      detalle: `Stock: ${num(p.stock)} · Costo: ${fmtCLP(p.costo_unitario)}`,
      stock: num(p.stock),
      costo: num(p.costo_unitario)
    }));

  if (!encontrados.length) {
    elActivoSugerencias.innerHTML =
      '<div class="suggestion-item"><span style="color:var(--text-muted);">Sin productos con stock disponible</span></div>';
    elActivoSugerencias.classList.add('show');
    return;
  }

  elActivoSugerencias.innerHTML = encontrados.map((o, i) => `
    <div class="suggestion-item" data-idx="${i}">
      <span>${escHtml(o.etiqueta)}</span>
      <span>${escHtml(o.detalle)}</span>
    </div>`).join('');
  elActivoSugerencias.classList.add('show');

  elActivoSugerencias.querySelectorAll('[data-idx]').forEach(item => {
    item.addEventListener('click', () => seleccionarProductoActivo(encontrados[Number(item.dataset.idx)]));
  });
}

function seleccionarProductoActivo(item) {
  activoItem = item;
  if (elActivoBuscar) elActivoBuscar.value = item.etiqueta;
  if (elActivoSugerencias) elActivoSugerencias.classList.remove('show');

  if (elActivoSeleccion) {
    elActivoSeleccion.style.display = 'block';
    elActivoSeleccion.textContent =
      `${item.etiqueta}\nStock disponible: ${item.stock} · Costo unitario: ${fmtCLP(item.costo)}`;
  }
  if (elActivoCantidad) {
    elActivoCantidad.max = item.stock;
    elActivoCantidad.value = Math.min(num(elActivoCantidad.value) || 1, item.stock || 1);
  }
  actualizarCostoActivo();
  elActivoCantidad?.focus();
}

function actualizarCostoActivo() {
  const cantidad = num(elActivoCantidad?.value);
  const costo = activoItem ? activoItem.costo : 0;
  if (elActivoCostoTotal) elActivoCostoTotal.value = fmtCLP(cantidad * costo);

  if (elActivoAviso) {
    if (activoItem && cantidad > activoItem.stock) {
      elActivoAviso.textContent = `Solo hay ${activoItem.stock} unidad(es) disponibles.`;
      elActivoAviso.style.color = 'var(--red)';
    } else if (activoItem && costo <= 0) {
      elActivoAviso.textContent = 'Este producto no tiene costo cargado: el activo quedará valorizado en $0.';
      elActivoAviso.style.color = 'var(--gold)';
    } else {
      elActivoAviso.textContent =
        'Esto descuenta el stock para que no se venda por error, pero NO mueve tu balance: la compra ya estaba registrada en Gastos.';
      elActivoAviso.style.color = '';
    }
  }
}

async function subirArchivoActivo(evento) {
  const archivo = evento.target.files[0];
  if (!archivo) return;

  if (archivo.size > 4 * 1024 * 1024) {
    showToast('El archivo supera los 4 MB', 'err');
    evento.target.value = '';
    return;
  }

  if (elActivoEstadoArchivo) {
    elActivoEstadoArchivo.textContent = '⏳ Subiendo…';
    elActivoEstadoArchivo.className = 'doc-estado';
  }

  try {
    const base64 = await new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(String(lector.result).split(',')[1]);
      lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
      lector.readAsDataURL(archivo);
    });

    // Reutiliza el endpoint y el bucket privado de Gastos (FILE-01).
    const { url, ruta } = await API.compras.subirArchivo(archivo.name, archivo.type, base64);
    activoDocRuta = ruta || url;   // la ruta es estable; la URL firmada caduca

    if (elActivoEstadoArchivo) {
      elActivoEstadoArchivo.textContent = '✔ ' + archivo.name;
      elActivoEstadoArchivo.className = 'doc-estado doc-ok';
    }
    showToast('Archivo cargado', 'ok');
  } catch (err) {
    console.error('Error al subir el archivo del activo:', err.message || err);
    if (elActivoEstadoArchivo) {
      elActivoEstadoArchivo.textContent = '✖ No se pudo subir';
      elActivoEstadoArchivo.className = 'doc-estado doc-falta';
    }
    showToast(err.message || 'No se pudo subir el archivo', 'err');
  } finally {
    evento.target.value = '';
  }
}

async function guardarActivo() {
  const cantidad = num(elActivoCantidad?.value);
  const motivo = (elActivoMotivo?.value || '').trim();

  if (!activoItem) { showToast('Selecciona el producto', 'err'); elActivoBuscar?.focus(); return; }
  if (cantidad <= 0) { showToast('La cantidad debe ser mayor a 0', 'err'); elActivoCantidad?.focus(); return; }
  if (cantidad > activoItem.stock) { showToast(`Solo hay ${activoItem.stock} unidad(es)`, 'err'); return; }
  if (!motivo) { showToast('Escribe para qué se va a usar', 'err'); elActivoMotivo?.focus(); return; }

  if (elBtnGuardarActivo) elBtnGuardarActivo.disabled = true;

  try {
    const r = await API.activos.crear({
      producto_id: activoItem.id,
      cantidad,
      motivo,
      documento_numero: (elActivoDocNumero?.value || '').trim(),
      documento_ruta: activoDocRuta
    });

    showToast(`Apartado · quedan ${r.stock_restante} para vender`, 'ok');
    cerrarModalActivo();
    cargarActivos();
    // El stock bajó: el catálogo en memoria quedaría desactualizado.
    if (typeof cargarProductos === 'function') cargarProductos(true);
  } catch (err) {
    console.error('Error al registrar el activo:', err.message || err);
    showToast(err.message || 'No se pudo registrar el activo', 'err');
  } finally {
    if (elBtnGuardarActivo) elBtnGuardarActivo.disabled = false;
  }
}

/* ============================================================
   CIERRE — qué pasó con la unidad
   ============================================================ */
function abrirModalCierreActivo(id) {
  const activo = activosLista.find(a => a.id === id);
  if (!activo || !elModalCerrarActivo) return;

  activoCerrandoId = id;
  activoDestinoCierre = '';
  activoProductoDestino = null;

  if (elCerrarActivoTitulo) {
    elCerrarActivoTitulo.textContent = `${activo.nombre} · ${num(activo.cantidad)} unidad(es)`;
  }
  if (elCerrarActivoNota) elCerrarActivoNota.value = '';
  if (elCerrarActivoDestinoBuscar) elCerrarActivoDestinoBuscar.value = '';
  if (elCerrarActivoDestinoBox) elCerrarActivoDestinoBox.style.display = 'none';
  if (elCerrarActivoChips) {
    elCerrarActivoChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  }
  if (elCerrarActivoAviso) elCerrarActivoAviso.textContent = 'Elige qué pasó con la unidad.';

  elModalCerrarActivo.classList.add('show');
}

function cerrarModalCierreActivo() {
  if (elModalCerrarActivo) elModalCerrarActivo.classList.remove('show');
  activoCerrandoId = null;
  activoDestinoCierre = '';
  activoProductoDestino = null;
}

function elegirDestinoActivo(destino) {
  activoDestinoCierre = destino || '';

  if (elCerrarActivoChips) {
    elCerrarActivoChips.querySelectorAll('.chip').forEach(c =>
      c.classList.toggle('active', c.dataset.destino === activoDestinoCierre));
  }
  if (elCerrarActivoDestinoBox) {
    elCerrarActivoDestinoBox.style.display = activoDestinoCierre === 'ARMADO_EN_PC' ? 'block' : 'none';
  }

  if (elCerrarActivoAviso) {
    if (activoDestinoCierre === 'DEVUELTO_A_VENTA') {
      elCerrarActivoAviso.textContent = 'La unidad vuelve al stock y se puede vender por el POS como cualquier otra.';
      elCerrarActivoAviso.style.color = '';
    } else if (activoDestinoCierre === 'ARMADO_EN_PC') {
      elCerrarActivoAviso.textContent =
        'La unidad se consume dentro del equipo. Acuérdate de sumarle su costo al equipo cuando lo crees en el catálogo.';
      elCerrarActivoAviso.style.color = 'var(--gold)';
    } else if (activoDestinoCierre === 'DADO_DE_BAJA') {
      elCerrarActivoAviso.textContent =
        'Solo cierra la ficha. NO registres además una merma: el stock ya salió al apartarla, y la merma descontaría una segunda unidad.';
      elCerrarActivoAviso.style.color = 'var(--red)';
    } else {
      elCerrarActivoAviso.textContent = 'Elige qué pasó con la unidad.';
      elCerrarActivoAviso.style.color = '';
    }
  }
}

function buscarEquipoDestinoActivo() {
  if (!elCerrarActivoDestinoSug) return;
  const q = (elCerrarActivoDestinoBuscar.value || '').trim().toLowerCase();
  if (!q) { elCerrarActivoDestinoSug.classList.remove('show'); return; }

  const lista = (typeof productsList !== 'undefined' && Array.isArray(productsList)) ? productsList : [];
  const encontrados = lista
    .filter(p => (p.nombre || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))
    .slice(0, 8);

  if (!encontrados.length) {
    elCerrarActivoDestinoSug.innerHTML =
      '<div class="suggestion-item"><span style="color:var(--text-muted);">Sin resultados (puedes dejarlo vacío)</span></div>';
    elCerrarActivoDestinoSug.classList.add('show');
    return;
  }

  elCerrarActivoDestinoSug.innerHTML = encontrados.map((p, i) => `
    <div class="suggestion-item" data-idx="${i}">
      <span>${escHtml(p.nombre)}</span>
      <span>${escHtml(p.sku || '')}</span>
    </div>`).join('');
  elCerrarActivoDestinoSug.classList.add('show');

  elCerrarActivoDestinoSug.querySelectorAll('[data-idx]').forEach(item => {
    item.addEventListener('click', () => {
      const p = encontrados[Number(item.dataset.idx)];
      activoProductoDestino = p;
      if (elCerrarActivoDestinoBuscar) elCerrarActivoDestinoBuscar.value = p.nombre;
      elCerrarActivoDestinoSug.classList.remove('show');
    });
  });
}

async function confirmarCierreActivo() {
  if (!activoCerrandoId) return;
  if (!activoDestinoCierre) { showToast('Elige qué pasó con la unidad', 'err'); return; }

  if (elBtnConfirmarCierreActivo) elBtnConfirmarCierreActivo.disabled = true;

  try {
    const r = await API.activos.cerrar(activoCerrandoId, {
      destino: activoDestinoCierre,
      cierre_nota: (elCerrarActivoNota?.value || '').trim(),
      producto_destino_id: activoDestinoCierre === 'ARMADO_EN_PC' ? (activoProductoDestino?.id || null) : null
    });

    if (num(r.stock_devuelto) > 0) {
      showToast(`Cerrado · ${num(r.stock_devuelto)} unidad(es) volvieron al stock`, 'ok');
      if (typeof cargarProductos === 'function') cargarProductos(true);
    } else if (num(r.costo_dado_de_baja) > 0) {
      showToast(`Cerrado · ${fmtCLP(r.costo_dado_de_baja)} de costo dado por perdido`, 'ok');
    } else {
      showToast('Activo cerrado', 'ok');
    }

    cerrarModalCierreActivo();
    cargarActivos();
  } catch (err) {
    console.error('Error al cerrar el activo:', err.message || err);
    showToast(err.message || 'No se pudo cerrar el activo', 'err');
  } finally {
    if (elBtnConfirmarCierreActivo) elBtnConfirmarCierreActivo.disabled = false;
  }
}

async function eliminarActivo(id) {
  const activo = activosLista.find(a => a.id === id);
  if (!activo) return;

  if (!confirm(
    `¿Deshacer el registro de "${activo.nombre}"?\n\n` +
    `${num(activo.cantidad)} unidad(es) vuelven al stock, como si nunca hubieras apartado nada.`
  )) return;

  try {
    const r = await API.activos.eliminar(id);
    showToast(`Deshecho · ${num(r.stock_devuelto)} unidad(es) volvieron al stock`, 'ok');
    cargarActivos();
    if (typeof cargarProductos === 'function') cargarProductos(true);
  } catch (err) {
    console.error('Error al deshacer el activo:', err.message || err);
    showToast(err.message || 'No se pudo deshacer el registro', 'err');
  }
}
