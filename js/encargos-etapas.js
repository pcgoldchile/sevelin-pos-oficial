// ==========================================
// ENCARGOS-ETAPAS.JS - El proceso con el proveedor (v110, sql/80)
// ------------------------------------------
// Encargos y Abonos ya llevaba la plata del cliente. Esto le suma el proceso
// con el proveedor: Cotizando → Confirmado → Pedido → Llegó → Entregado.
// Un encargo sin nada que pedir (reserva, servicio con seña) no lleva etapa.
// Nada de acá mueve stock ni plata: al llegar, la compra se registra con el
// ingreso de mercadería de siempre.
// ==========================================

const ETAPAS_ENCARGO = {
  COTIZANDO: { nombre: 'Cotizando', clase: 'badge-gold', siguiente: 'CONFIRMADO', accion: '✔ Confirmado con el proveedor' },
  CONFIRMADO: { nombre: 'Confirmado', clase: 'badge-blue', siguiente: 'PEDIDO', accion: '🚚 Ya lo pedí' },
  PEDIDO: { nombre: 'Pedido al proveedor', clase: 'badge-blue', siguiente: 'LLEGO', accion: '📦 Llegó' },
  LLEGO: { nombre: 'Llegó', clase: 'badge-green', siguiente: null, accion: null },
  ENTREGADO: { nombre: 'Entregado', clase: 'badge-green', siguiente: null, accion: null },
  CANCELADO: { nombre: 'Cancelado', clase: 'badge-red', siguiente: null, accion: null }
};
const ORIGEN_ENCARGO = { ENCARGO: 'producto por encargo', AGOTADO: 'estaba agotado', LOTE: 'faltaban unidades' };
const INTERVALO_CHIP_ENCARGOS_MS = 5 * 60 * 1000;

const encargoEnProceso = (e) => ['COTIZANDO', 'CONFIRMADO', 'PEDIDO', 'LLEGO'].includes(e?.etapa);

function fechaCortaEncargo(iso) {
  const [a, m, d] = String(iso || '').slice(0, 10).split('-');
  return d && m ? `${d}-${m}${a ? '-' + a : ''}` : '';
}

/* Celda "Etapa" de la tabla: chip, lo que dijo el proveedor y el paso siguiente. */
function celdaEtapaEncargo(e) {
  const etapa = ETAPAS_ENCARGO[e.etapa];
  if (!etapa) return '<small style="color:var(--text-muted);">Sin pedido</small>';

  const detalle = [];
  if (e.unidades_pedir) detalle.push(`pedir ${Number(e.unidades_pedir)} u.${ORIGEN_ENCARGO[e.origen] ? ' (' + ORIGEN_ENCARGO[e.origen] + ')' : ''}`);
  if (e.proveedor) detalle.push(escHtml(e.proveedor));
  if (e.fecha_estimada && e.etapa !== 'LLEGO' && e.etapa !== 'ENTREGADO') {
    const atrasado = e.etapa === 'PEDIDO' && String(e.fecha_estimada) < todayISO();
    detalle.push(`<span${atrasado ? ' style="color:var(--red); font-weight:600;"' : ''}>llega ${fechaCortaEncargo(e.fecha_estimada)}${atrasado ? ' · atrasado' : ''}</span>`);
  }
  if (e.etapa === 'LLEGO') {
    detalle.push(e.cliente_avisado_en
      ? `cliente avisado el ${fechaCortaEncargo(e.cliente_avisado_en)}`
      : '<span style="color:var(--red); font-weight:600;">falta avisar al cliente</span>');
  }
  if (e.etapa === 'CANCELADO' && e.cancelado_motivo) detalle.push(escHtml(e.cancelado_motivo));

  const botones = [];
  if (etapa.siguiente) botones.push(`<button class="btn btn-outline btn-sm" data-etapa-avanzar="${Number(e.id)}" data-etapa="${etapa.siguiente}">${etapa.accion}</button>`);
  if (e.etapa === 'LLEGO' && !e.cliente_avisado_en) {
    if (telefonoWhatsappOT(e.cliente_telefono)) botones.push(`<button class="btn btn-green btn-sm" data-etapa-whatsapp="${Number(e.id)}" title="Abre WhatsApp con el mensaje armado y anota el aviso">💬 Avisar por WhatsApp</button>`);
    botones.push(`<button class="btn btn-outline btn-sm" data-etapa-avisado="${Number(e.id)}" title="Si le avisaste por teléfono o en persona">✔ Ya le avisé</button>`);
  }
  if (e.etapa === 'LLEGO' && e.producto_id && esAdmin()) {
    botones.push(`<button class="btn btn-outline btn-sm" data-etapa-compra="${Number(e.id)}" title="Abre el producto con la compra ya escrita: el stock sube cuando tú la registras">📥 Registrar la compra</button>`);
  }

  return `<span class="badge ${etapa.clase}">${etapa.nombre}</span>`
    + (detalle.length ? `<br><small style="color:var(--text-muted);">${detalle.join(' · ')}</small>` : '')
    + (botones.length ? `<div class="etapa-acciones">${botones.join('')}</div>` : '');
}

/* Bloque del detalle del encargo: etapa y, para el admin, cambiarla a mano o cancelar. */
function detalleEtapaEncargo(e) {
  const etapa = ETAPAS_ENCARGO[e.etapa];
  if (!etapa) return '<p class="modal-hint"><b>Proveedor:</b> no hay nada que pedir (para iniciarlo, edita el encargo y marca "Hay que pedirlo al proveedor").</p>';

  const datos = [
    e.unidades_pedir ? `pedir ${Number(e.unidades_pedir)} u.` : '',
    ORIGEN_ENCARGO[e.origen] || '',
    e.proveedor ? `proveedor: ${escHtml(e.proveedor)}` : '',
    e.costo_cotizado_unitario ? `cotizado a ${fmtCLP(e.costo_cotizado_unitario)} c/u` : '',
    e.fecha_estimada ? `llega aprox. el ${fechaCortaEncargo(e.fecha_estimada)}` : '',
    e.cliente_avisado_en ? `cliente avisado el ${fechaCortaEncargo(e.cliente_avisado_en)}` : '',
    e.etapa === 'CANCELADO' && e.cancelado_motivo ? `motivo: ${escHtml(e.cancelado_motivo)}` : ''
  ].filter(Boolean).join(' · ');

  let admin = '';
  if (esAdmin() && e.etapa !== 'ENTREGADO') {
    const opciones = ['COTIZANDO', 'CONFIRMADO', 'PEDIDO', 'LLEGO']
      .map(c => `<option value="${c}"${c === e.etapa ? ' selected' : ''}>${ETAPAS_ENCARGO[c].nombre}</option>`).join('');
    admin = `
      <div class="folio-fila admin-only" style="margin-top:8px;">
        <select class="hist-select" id="detalleEncargoEtapa" aria-label="Etapa del encargo">${opciones}</select>
        <button type="button" class="btn btn-outline btn-sm" data-etapa-fijar="${Number(e.id)}">Cambiar etapa</button>
        ${e.etapa !== 'CANCELADO' ? `<button type="button" class="btn btn-outline btn-sm" data-etapa-cancelar="${Number(e.id)}">✖ Cancelar encargo</button>` : ''}
      </div>`;
  }

  return `<p class="modal-hint"><b>Proveedor:</b> <span class="badge ${etapa.clase}">${etapa.nombre}</span>${datos ? ' · ' + datos : ''}</p>${admin}`;
}

/* ---------- Acciones ---------- */
async function cambiarEtapaEncargo(id, etapa, extra = {}) {
  try {
    await API.encargos.cambiarEtapa(id, { etapa, ...extra });
    showToast(`Encargo: ${ETAPAS_ENCARGO[etapa]?.nombre || etapa}`, 'ok');
    document.getElementById('modalDetalleEncargo')?.classList.remove('show');
    await cargarEncargos();
    return true;
  } catch (err) {
    showToast(err.message || 'No se pudo cambiar la etapa', 'err');
    return false;
  }
}

function cancelarEncargoConMotivo(id) {
  const motivo = (prompt('¿Por qué se cancela? (el proveedor no lo tiene, el cliente desistió…)') || '').trim();
  if (!motivo) return;
  cambiarEtapaEncargo(id, 'CANCELADO', { motivo });
}

async function marcarClienteAvisado(id) {
  try {
    await API.encargos.marcarAvisado(id);
    showToast('Aviso al cliente anotado', 'ok');
    await cargarEncargos();
  } catch (err) {
    showToast(err.message || 'No se pudo anotar el aviso', 'err');
  }
}

function avisarLlegadaPorWhatsapp(encargo) {
  const telefono = telefonoWhatsappOT(encargo.cliente_telefono);
  if (!telefono) { showToast('Este encargo no tiene teléfono', 'err'); return; }
  const saldo = Number(encargo.saldo) || 0;
  const mensaje = `Hola ${encargo.cliente_nombre || ''}, te escribimos de Sevelin: ya llegó tu encargo (${encargo.descripcion || ''}). `
    + (saldo > 0 ? `Queda un saldo de ${fmtCLP(saldo)}. ` : 'Ya está pagado. ')
    + 'Puedes pasar a retirarlo en nuestro horario de atención.';
  window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener');
  marcarClienteAvisado(encargo.id);
}

/* Al llegar: abre el producto con la compra ya escrita. No registra nada solo:
   el stock sube cuando el dueño aprieta "Registrar compra" en el producto. */
function registrarCompraDeEncargo(encargo) {
  const producto = Array.isArray(productsList) ? productsList.find(p => String(p.id) === String(encargo.producto_id)) : null;
  if (!producto || typeof abrirModalProducto !== 'function') { showToast('No se encontró el producto de este encargo', 'err'); return; }
  activarVista('view-productos');
  abrirModalProducto(producto);
  setTimeout(() => {
    const poner = (id, valor) => { const el = document.getElementById(id); if (el && valor) { el.value = valor; el.dispatchEvent(new Event('input', { bubbles: true })); } };
    poner('ingCantidad', encargo.unidades_pedir || encargo.cantidad);
    poner('ingCosto', encargo.costo_cotizado_unitario);
    poner('ingProveedor', encargo.proveedor);
    const cantidad = document.getElementById('ingCantidad');
    cantidad?.closest('.card-plegable')?.classList.remove('plegada');
    cantidad?.scrollIntoView({ block: 'center' });
    showToast('Compra del encargo lista: revisa el costo y aprieta "Registrar compra"', 'ok');
  }, 900);
}

/* ---------- Formulario del encargo ---------- */
function pedidoSugeridoEncargo() {
  const p = typeof productoEncargo !== 'undefined' ? productoEncargo : null;
  const cantidad = Math.max(1, Number(document.getElementById('encargoCantidad')?.value) || 1);
  if (!p) return { pedir: 0, texto: '' };
  if (p.es_pedido_encargo) return { pedir: cantidad, texto: 'Es un producto por encargo: se piden todas las unidades.' };
  if (p.stock_ilimitado || p.es_servicio) return { pedir: 0, texto: '' };
  const stock = Math.max(0, Number(p.stock) || 0);
  if (stock <= 0) return { pedir: cantidad, texto: 'Está agotado: se piden todas las unidades.' };
  if (stock < cantidad) return { pedir: cantidad - stock, texto: `Hay ${stock} en stock y quiere ${cantidad}: faltan ${cantidad - stock}.` };
  return { pedir: 0, texto: `Hay ${stock} en stock: alcanza, no hace falta pedirlo.` };
}

function pintarCamposPedido() {
  const marcado = !!document.getElementById('encargoRequierePedido')?.checked;
  const campos = document.getElementById('encargoPedidoCampos');
  if (campos) campos.style.display = marcado ? '' : 'none';
}

/* Al elegir producto o cambiar la cantidad en un encargo NUEVO: propone si hay que pedirlo. */
function sugerirPedidoEncargo() {
  const check = document.getElementById('encargoRequierePedido');
  const hint = document.getElementById('encargoPedidoHint');
  if (!check || check.disabled) return;
  const sugerido = pedidoSugeridoEncargo();
  if (hint) hint.textContent = sugerido.texto;
  if (typeof editandoEncargoId !== 'undefined' && editandoEncargoId) return;   // al editar no se cambia lo que ya se decidió
  check.checked = sugerido.pedir > 0;
  const unidades = document.getElementById('encargoUnidadesPedir');
  if (unidades) unidades.value = sugerido.pedir > 0 ? sugerido.pedir : '';
  pintarCamposPedido();
}

function prepararPedidoEncargo(encargo) {
  const check = document.getElementById('encargoRequierePedido');
  if (!check) return;
  const poner = (id, valor) => { const el = document.getElementById(id); if (el) el.value = valor ?? ''; };
  const yaPedido = ['PEDIDO', 'LLEGO', 'ENTREGADO', 'CANCELADO'].includes(encargo?.etapa);
  check.checked = !!encargo?.etapa;
  check.disabled = yaPedido;   // lo que ya se pidió no se "des-pide" desde acá
  poner('encargoUnidadesPedir', encargo?.unidades_pedir);
  poner('encargoProveedor', encargo?.proveedor);
  poner('encargoCostoCotizado', encargo?.costo_cotizado_unitario);
  poner('encargoFechaEstimada', encargo?.fecha_estimada);
  const hint = document.getElementById('encargoPedidoHint');
  if (hint) hint.textContent = encargo?.etapa ? `Etapa: ${ETAPAS_ENCARGO[encargo.etapa]?.nombre || encargo.etapa}.` : '';
  pintarCamposPedido();
  pintarMaquinaAbono('encargoMetodoPago', 'encargoMaquinaTarjeta', !!encargo);
}

function datosPedidoEncargo() {
  const check = document.getElementById('encargoRequierePedido');
  if (!check) return {};
  const val = (id) => (document.getElementById(id)?.value || '').trim();
  const datos = { requiere_pedido: check.checked };
  if (!check.checked) return datos;
  return {
    ...datos,
    unidades_pedir: Number(val('encargoUnidadesPedir')) || null,
    proveedor: val('encargoProveedor') || null,
    fecha_estimada: val('encargoFechaEstimada') || null,
    ...(esAdmin() ? { costo_cotizado_unitario: Number(val('encargoCostoCotizado')) || null } : {})
  };
}

/* ---------- Máquina de tarjetas en los abonos (sql/79) ---------- */
function pintarMaquinaAbono(idMetodo, idMaquina, ocultar) {
  const metodo = document.getElementById(idMetodo)?.value;
  const maquina = document.getElementById(idMaquina);
  if (!maquina) return;
  const conTarjeta = !ocultar && METODOS_CON_COMISION.includes(metodo);
  maquina.style.display = conTarjeta ? '' : 'none';
  if (conTarjeta && typeof leerMaquinaTarjeta === 'function') maquina.value = leerMaquinaTarjeta();
}

function maquinaDeAbono(idMetodo, idMaquina) {
  const metodo = document.getElementById(idMetodo)?.value;
  return METODOS_CON_COMISION.includes(metodo) ? (document.getElementById(idMaquina)?.value || 'TUU') : null;
}

/* ---------- Entradas desde otros módulos ---------- */
/* Abre "Nuevo encargo" con el producto ya puesto (Productos → Agotados, o la
   caja cuando piden más unidades de las que hay). */
function iniciarEncargoDeProducto(producto, cantidad) {
  if (!producto) return;
  activarVista('view-encargos');
  abrirModalEncargo();
  const elCantidad = document.getElementById('encargoCantidad');
  if (elCantidad) elCantidad.value = Math.max(1, Number(cantidad) || 1);
  seleccionarProductoEncargo(producto, true);
}

/* ---------- Aviso del encabezado ---------- */
let intervaloChipEncargos = null;

async function actualizarChipEncargos() {
  const boton = document.getElementById('btnEncargosPendientes');
  const texto = document.getElementById('textoEncargosPendientes');
  if (!boton || !texto || !tokenActual()) return;
  try {
    const r = await API.encargos.resumen();
    const enCurso = Number(r?.en_curso) || 0;
    if (!enCurso) { boton.hidden = true; return; }
    const urgentes = Number(r.urgentes) || 0;
    texto.textContent = enCurso === 1 ? '1 encargo en proceso' : `${enCurso} encargos en proceso`;
    boton.classList.toggle('tiene-pendientes', urgentes > 0);
    const motivos = [
      r.por_avisar ? `${r.por_avisar} llegó y falta avisar al cliente` : '',
      r.cotizando_atrasados ? `${r.cotizando_atrasados} lleva más de 2 días cotizándose` : '',
      r.llegada_atrasada ? `${r.llegada_atrasada} ya debió llegar` : ''
    ].filter(Boolean);
    boton.title = motivos.length ? motivos.join(' · ') : 'Encargos en proceso con el proveedor';
    boton.hidden = false;
  } catch (err) {
    console.error('No se pudo revisar los encargos en proceso:', err.message || err);
  }
}

/* ---------- Eventos ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const buscar = (id) => (Array.isArray(encargosList) ? encargosList : []).find(e => String(e.id) === String(id));

  document.getElementById('encargosTableBody')?.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.etapaAvanzar) cambiarEtapaEncargo(b.dataset.etapaAvanzar, b.dataset.etapa);
    else if (b.dataset.etapaWhatsapp) avisarLlegadaPorWhatsapp(buscar(b.dataset.etapaWhatsapp));
    else if (b.dataset.etapaAvisado) marcarClienteAvisado(b.dataset.etapaAvisado);
    else if (b.dataset.etapaCompra) registrarCompraDeEncargo(buscar(b.dataset.etapaCompra));
  });

  document.getElementById('detalleEncargoContent')?.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.etapaFijar) cambiarEtapaEncargo(b.dataset.etapaFijar, document.getElementById('detalleEncargoEtapa')?.value);
    else if (b.dataset.etapaCancelar) cancelarEncargoConMotivo(b.dataset.etapaCancelar);
  });

  document.getElementById('encargoRequierePedido')?.addEventListener('change', () => {
    const unidades = document.getElementById('encargoUnidadesPedir');
    if (unidades && !unidades.value && document.getElementById('encargoRequierePedido').checked) {
      unidades.value = pedidoSugeridoEncargo().pedir || Math.max(1, Number(document.getElementById('encargoCantidad')?.value) || 1);
    }
    pintarCamposPedido();
  });
  document.getElementById('encargoCantidad')?.addEventListener('input', sugerirPedidoEncargo);
  document.getElementById('encargoMetodoPago')?.addEventListener('change', () => pintarMaquinaAbono('encargoMetodoPago', 'encargoMaquinaTarjeta', !!editandoEncargoId));
  document.getElementById('abonoMetodoPago')?.addEventListener('change', () => pintarMaquinaAbono('abonoMetodoPago', 'abonoMaquinaTarjeta', false));

  // El aviso del encabezado lleva al módulo, filtrado por los que están en proceso
  document.getElementById('btnEncargosPendientes')?.addEventListener('click', () => {
    activarVista('view-encargos');
    document.querySelector('#encargosChips .chip[data-estado="__pedido"]')?.click();
  });
});

document.addEventListener('pos:sesion-iniciada', () => {
  actualizarChipEncargos();
  clearInterval(intervaloChipEncargos);
  intervaloChipEncargos = setInterval(actualizarChipEncargos, INTERVALO_CHIP_ENCARGOS_MS);
});
