// ==========================================
// FOLIOS.JS - N° de boleta o factura y máquina de tarjetas (sql/79, v108)
// ------------------------------------------
// El N° del documento es opcional. Se puede anotar en tres lugares:
//   · ventana "Venta registrada", recién cobrada la venta;
//   · Historial → "Sin N° de documento", la lista de lo que falta;
//   · Detalle de Venta, donde además el admin corrige la máquina de tarjetas.
// El POS no emite nada ni entra al SII: solo guarda el número que ya existe.
// ==========================================

const TIPOS_FOLIO = [
  { valor: 'BOLETA', nombre: 'Boleta' },
  { valor: 'FACTURA', nombre: 'Factura' }
];

const tipoFolioDeVenta = (venta) => (venta?.tipo_dte === 'FACTURA' ? 'FACTURA' : 'BOLETA');

function opcionesTipoFolio(elegido) {
  return TIPOS_FOLIO
    .map(t => `<option value="${t.valor}"${t.valor === elegido ? ' selected' : ''}>${t.nombre}</option>`)
    .join('');
}

/* Guarda el N° de una venta. Si el servidor avisa que ese N° ya está en otra
   orden, pregunta una vez y reintenta. Devuelve la venta guardada. */
async function guardarFolioDeVenta(ventaId, folio, tipo) {
  const datos = { dte_folio: String(folio || '').trim(), tipo_dte: tipo };
  try {
    return await API.ventas.guardarFolio(ventaId, datos);
  } catch (err) {
    if (err.codigo !== 'folio_repetido') throw err;
    if (!confirm(`${err.message}\n\n¿Guardarlo igual en esta venta?`)) throw new Error('No se guardó el N°');
    return API.ventas.guardarFolio(ventaId, { ...datos, repetido: true });
  }
}

/* ------------------------------------------------------------
   1) Ventana "Venta registrada"
   ------------------------------------------------------------ */
let ventaFolioExitosa = null;

function prepararFolioVentaExitosa(venta) {
  const caja = document.getElementById('ventaExitosaFolioBox');
  if (!caja) return;
  // Una venta "Por Pagar" todavía no tiene documento
  ventaFolioExitosa = venta && venta.estado !== 'PENDIENTE' ? venta : null;
  caja.style.display = ventaFolioExitosa ? '' : 'none';
  if (!ventaFolioExitosa) return;

  const input = document.getElementById('ventaExitosaFolio');
  const tipo = document.getElementById('ventaExitosaFolioTipo');
  const aviso = document.getElementById('ventaExitosaFolioAviso');
  if (input) input.value = venta.dte_folio || '';
  if (tipo) tipo.value = tipoFolioDeVenta(venta);
  if (aviso) {
    aviso.textContent = 'Si lo dejas vacío, lo puedes anotar después en Historial.';
    aviso.classList.remove('ok');
  }
}

async function guardarFolioVentaExitosa() {
  if (!ventaFolioExitosa) return;
  const input = document.getElementById('ventaExitosaFolio');
  const tipo = document.getElementById('ventaExitosaFolioTipo')?.value || 'BOLETA';
  const aviso = document.getElementById('ventaExitosaFolioAviso');
  const boton = document.getElementById('btnGuardarFolioVenta');
  const folio = (input?.value || '').trim();
  if (!folio) { showToast('Escribe el N° del documento', 'err'); input?.focus(); return; }

  try {
    if (boton) boton.disabled = true;
    const guardada = await guardarFolioDeVenta(ventaFolioExitosa.id, folio, tipo);
    ventaFolioExitosa = { ...ventaFolioExitosa, dte_folio: guardada?.dte_folio || folio, tipo_dte: guardada?.tipo_dte || tipo };
    if (aviso) {
      aviso.textContent = `✔ Guardado: ${tipo === 'FACTURA' ? 'factura' : 'boleta'} N° ${ventaFolioExitosa.dte_folio}`;
      aviso.classList.add('ok');
    }
    showToast('N° de documento guardado', 'ok');
    if (typeof cargarHistorial === 'function') cargarHistorial();
    actualizarBotonFoliosPendientes(true);
    document.getElementById('btnCloseVentaExitosa')?.focus();
  } catch (err) {
    showToast(err.message || 'No se pudo guardar el N°', 'err');
  } finally {
    if (boton) boton.disabled = false;
  }
}

/* ------------------------------------------------------------
   2) Historial → "Sin N° de documento" (solo admin)
   ------------------------------------------------------------ */
let foliosPendientes = [];
let foliosPendientesDesde = '';
let foliosPendientesLeidoEn = 0;

function textoMedioDePago(venta) {
  const metodo = venta.metodo_pago_final || venta.metodo_pago || 'Sin especificar';
  return venta.maquina_tarjeta
    ? `${metodo} · ${NOMBRE_MAQUINA_TARJETA[venta.maquina_tarjeta] || venta.maquina_tarjeta}`
    : metodo;
}

async function abrirFoliosPendientes() {
  const modal = document.getElementById('modalFoliosPendientes');
  const lista = document.getElementById('foliosPendientesLista');
  if (!modal || !lista) return;
  lista.innerHTML = '<p class="modal-hint">Cargando…</p>';
  modal.classList.add('show');
  try {
    await leerFoliosPendientes();
    renderFoliosPendientes();
  } catch (err) {
    lista.innerHTML = `<p class="modal-hint" style="color:var(--red);">${escHtml(err.message || 'No se pudo cargar la lista')}</p>`;
  }
}

async function leerFoliosPendientes() {
  const r = await API.ventas.sinFolio();
  foliosPendientes = r?.ventas || [];
  foliosPendientesDesde = r?.desde || '';
  foliosPendientesLeidoEn = Date.now();
  pintarBotonFoliosPendientes();
}

function pintarBotonFoliosPendientes() {
  const boton = document.getElementById('btnFoliosPendientes');
  if (boton) boton.textContent = `🧾 Sin N° de documento${foliosPendientes.length ? ` (${foliosPendientes.length})` : ''}`;
}

/* Mantiene al día el número del botón sin pedirlo en cada clic. */
async function actualizarBotonFoliosPendientes(forzar) {
  if (!esAdmin() || !document.getElementById('btnFoliosPendientes')) return;
  if (!forzar && Date.now() - foliosPendientesLeidoEn < 120000) return;
  try { await leerFoliosPendientes(); } catch (_) { /* el botón queda sin número */ }
}

function renderFoliosPendientes() {
  const lista = document.getElementById('foliosPendientesLista');
  const hint = document.getElementById('foliosPendientesHint');
  if (!lista) return;
  if (hint && foliosPendientesDesde) {
    const [a, m, d] = foliosPendientesDesde.split('-');
    hint.textContent = `Ventas pagadas desde el ${d}-${m}-${a} sin N° anotado. Es opcional: lo que no llenes queda acá.`;
  }
  if (!foliosPendientes.length) {
    lista.innerHTML = '<p class="modal-hint">✔ No hay ventas sin N° de documento.</p>';
    return;
  }
  lista.innerHTML = foliosPendientes.map(v => {
    const orden = String(v.numero_orden ?? v.id).padStart(5, '0');
    const [, m, d] = String(v.fecha || '').split('-');
    return `
      <div class="folio-pendiente" data-folio-venta="${Number(v.id)}">
        <div class="folio-pendiente-datos">
          <strong>#${orden} · ${fmtCLP(v.total)}</strong>
          <small>${escHtml(`${d || ''}-${m || ''}${v.hora ? ' ' + v.hora : ''}`)} · ${escHtml(v.cliente || 'Consumidor Final')} · ${escHtml(textoMedioDePago(v))}</small>
        </div>
        <div class="folio-fila">
          <select class="hist-select" data-folio-tipo aria-label="Tipo de documento de la orden ${orden}">${opcionesTipoFolio(tipoFolioDeVenta(v))}</select>
          <input type="text" class="campo-pos" data-folio-numero maxlength="30" autocomplete="off" inputmode="numeric"
                 placeholder="N°" aria-label="N° de documento de la orden ${orden}">
          <button type="button" class="btn btn-outline btn-sm" data-folio-guardar>Guardar</button>
        </div>
      </div>`;
  }).join('');
}

async function guardarFolioPendiente(fila) {
  const id = Number(fila.dataset.folioVenta);
  const input = fila.querySelector('[data-folio-numero]');
  const tipo = fila.querySelector('[data-folio-tipo]')?.value || 'BOLETA';
  const boton = fila.querySelector('[data-folio-guardar]');
  const folio = (input?.value || '').trim();
  if (!folio) { showToast('Escribe el N° del documento', 'err'); input?.focus(); return; }

  try {
    if (boton) boton.disabled = true;
    await guardarFolioDeVenta(id, folio, tipo);
    // El foco pasa a la fila que ocupa su lugar, para llenar varias de corrido
    const posicion = foliosPendientes.findIndex(v => Number(v.id) === id);
    foliosPendientes = foliosPendientes.filter(v => Number(v.id) !== id);
    pintarBotonFoliosPendientes();
    renderFoliosPendientes();
    showToast('N° de documento guardado', 'ok');
    const campos = document.querySelectorAll('#foliosPendientesLista [data-folio-numero]');
    campos[Math.min(Math.max(posicion, 0), campos.length - 1)]?.focus();
    if (typeof cargarHistorial === 'function') cargarHistorial();
  } catch (err) {
    showToast(err.message || 'No se pudo guardar el N°', 'err');
    if (boton) boton.disabled = false;
  }
}

/* ------------------------------------------------------------
   3) Detalle de Venta: N° de documento y máquina de tarjetas
   ------------------------------------------------------------ */
function ventaPagadaConTarjeta(venta) {
  if (venta.estado !== 'PAGADA') return false;
  const metodo = venta.metodo_pago_final || venta.metodo_pago;
  return METODOS_CON_COMISION.includes(metodo) || (!!venta.pago_mixto && !!venta.maquina_tarjeta);
}

function bloqueDocumentoVenta(venta) {
  if (!venta || venta.estado === 'ANULADA' || venta.estado === 'PENDIENTE') return '';
  const admin = esAdmin();
  const folio = venta.dte_folio || '';
  // El trabajador solo anota el N° de una venta de hoy que todavía no lo tiene
  const puedeAnotar = admin || (!folio && String(venta.fecha) === todayISO());

  const filaFolio = puedeAnotar
    ? `<div class="folio-fila">
         <select class="hist-select" data-detalle-folio-tipo aria-label="Tipo de documento">${opcionesTipoFolio(tipoFolioDeVenta(venta))}</select>
         <input type="text" class="campo-pos" data-detalle-folio maxlength="30" autocomplete="off" inputmode="numeric"
                value="${escHtml(folio)}" placeholder="Sin anotar" aria-label="N° de boleta o factura">
         <button type="button" class="btn btn-outline btn-sm" data-detalle-folio-guardar="${Number(venta.id)}">Guardar</button>
       </div>`
    : `<p><b>${escHtml(folio || 'Sin anotar')}</b>${folio ? ` · ${venta.tipo_dte === 'FACTURA' ? 'Factura' : 'Boleta'}` : ''}</p>`;

  let filaMaquina = '';
  if (ventaPagadaConTarjeta(venta)) {
    const maquina = venta.maquina_tarjeta || 'TUU';
    filaMaquina = admin
      ? `<div class="venta-documento-titulo">💳 Máquina de tarjetas</div>
         <div class="folio-fila">
           <select class="hist-select" data-detalle-maquina="${Number(venta.id)}" aria-label="Máquina de tarjetas">
             ${Object.entries(NOMBRE_MAQUINA_TARJETA).map(([valor, nombre]) =>
               `<option value="${valor}"${valor === maquina ? ' selected' : ''}>${escHtml(nombre)}</option>`).join('')}
           </select>
           <small class="folio-aviso">Comisión guardada: ${fmtCLP(venta.comision_pos)}. Al cambiar la máquina se recalcula.</small>
         </div>`
      : `<div class="venta-documento-titulo">💳 Máquina de tarjetas</div><p>${escHtml(NOMBRE_MAQUINA_TARJETA[maquina] || maquina)}</p>`;
  }

  return `
    <div class="venta-documento">
      <div class="venta-documento-titulo">🧾 N° de boleta o factura <span class="folio-opcional">(opcional)</span></div>
      ${filaFolio}
      ${filaMaquina}
    </div>`;
}

async function guardarFolioDesdeDetalle(boton) {
  const caja = boton.closest('.venta-documento');
  const id = Number(boton.dataset.detalleFolioGuardar);
  const folio = (caja?.querySelector('[data-detalle-folio]')?.value || '').trim();
  const tipo = caja?.querySelector('[data-detalle-folio-tipo]')?.value || 'BOLETA';
  // Vacío = borrar el N° (solo el admin llega acá con un N° ya guardado)
  if (!folio && !esAdmin()) { showToast('Escribe el N° del documento', 'err'); return; }

  try {
    boton.disabled = true;
    const guardada = folio
      ? await guardarFolioDeVenta(id, folio, tipo)
      : await API.ventas.guardarFolio(id, { dte_folio: '' });
    showToast(folio ? 'N° de documento guardado' : 'N° de documento borrado', 'ok');
    refrescarDetalleTrasDocumento(guardada);
  } catch (err) {
    showToast(err.message || 'No se pudo guardar el N°', 'err');
    boton.disabled = false;
  }
}

async function cambiarMaquinaDeVenta(select) {
  const id = Number(select.dataset.detalleMaquina);
  const maquina = select.value;
  try {
    select.disabled = true;
    const guardada = await API.ventas.cambiarMaquina(id, maquina);
    showToast(`Máquina: ${NOMBRE_MAQUINA_TARJETA[maquina] || maquina} · comisión ${fmtCLP(guardada?.comision_pos)}`, 'ok');
    refrescarDetalleTrasDocumento(guardada);
  } catch (err) {
    showToast(err.message || 'No se pudo cambiar la máquina', 'err');
    select.disabled = false;
    if (typeof currentSaleDetails !== 'undefined' && currentSaleDetails) select.value = currentSaleDetails.maquina_tarjeta || 'TUU';
  }
}

/* El detalle abierto se repinta con lo guardado (conservando sus ítems) y la
   lista del Historial se vuelve a leer. */
function refrescarDetalleTrasDocumento(guardada) {
  if (guardada && typeof currentSaleDetails !== 'undefined' && currentSaleDetails
      && Number(currentSaleDetails.id) === Number(guardada.id)) {
    currentSaleDetails = { ...currentSaleDetails, ...guardada, items: currentSaleDetails.items };
    if (typeof renderDetalleVenta === 'function') renderDetalleVenta(currentSaleDetails);
  }
  if (typeof cargarHistorial === 'function') cargarHistorial();
  actualizarBotonFoliosPendientes(true);
}

/* ------------------------------------------------------------
   Eventos
   ------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnGuardarFolioVenta')?.addEventListener('click', guardarFolioVentaExitosa);
  /* Enter en el campo guarda el N°. Se corta acá para que no llegue a los
     atajos de la caja, que con Enter cierran la ventana. */
  document.getElementById('ventaExitosaFolio')?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    e.stopPropagation();
    guardarFolioVentaExitosa();
  });

  document.getElementById('btnFoliosPendientes')?.addEventListener('click', abrirFoliosPendientes);
  document.getElementById('btnCerrarFoliosPendientes')?.addEventListener('click', () => {
    document.getElementById('modalFoliosPendientes')?.classList.remove('show');
  });
  const modalLista = document.getElementById('modalFoliosPendientes');
  modalLista?.addEventListener('click', (e) => {
    if (e.target === modalLista) { modalLista.classList.remove('show'); return; }
    const guardar = e.target.closest('[data-folio-guardar]');
    if (guardar) guardarFolioPendiente(guardar.closest('[data-folio-venta]'));
  });
  modalLista?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.matches('[data-folio-numero]')) return;
    e.preventDefault();
    e.stopPropagation();
    guardarFolioPendiente(e.target.closest('[data-folio-venta]'));
  });

  const detalle = document.getElementById('detalleVentaContent');
  detalle?.addEventListener('click', (e) => {
    const guardar = e.target.closest('[data-detalle-folio-guardar]');
    if (guardar) guardarFolioDesdeDetalle(guardar);
  });
  detalle?.addEventListener('change', (e) => {
    if (e.target.matches('[data-detalle-maquina]')) cambiarMaquinaDeVenta(e.target);
  });
  detalle?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.matches('[data-detalle-folio]')) return;
    e.preventDefault();
    e.stopPropagation();
    const guardar = e.target.closest('.venta-documento')?.querySelector('[data-detalle-folio-guardar]');
    if (guardar) guardarFolioDesdeDetalle(guardar);
  });
});

document.addEventListener('pos:sesion-iniciada', () => actualizarBotonFoliosPendientes(true));
document.addEventListener('pos:vista-activa', () => actualizarBotonFoliosPendientes(false));
