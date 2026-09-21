/* ============================================================
   NOTIFICACIONES DEL HEADER — pedidos web que necesitan atención
   ------------------------------------------------------------
   Junta en un solo contador los pedidos en PAGADO (recién pagados, por
   preparar) y ERROR_STOCK_SIN_DESPACHO (pagados pero sin stock para
   despachar — carrera entre dos checkouts casi simultáneos de la última
   unidad, ver POST /api/flow-webhook en sevelin-tienda). Ambos viven en
   pedidos_web (Supabase de la tienda), leídos en vivo vía GET
   /api/pos/pedidos-web — no existe una tabla de notificaciones aparte,
   así que no hay nada que marcar como "leído": el contador baja solo en
   cuanto el pedido se gestiona (pasa a PREPARANDO/CANCELADO/etc.).

   Solo para admin: el botón tiene la clase admin-only (se oculta solo
   para el rol trabajador) y el panel "Pedidos Web" al que lleva ya es
   admin-only (ver index.html, nav-btn "🌐 Página Web").
   ============================================================ */

const ESTADOS_NOTIFICACION_PEDIDOS_WEB = 'PAGADO,ERROR_STOCK_SIN_DESPACHO';
const INTERVALO_NOTIFICACIONES_MS = 60 * 1000;

const elBtnNotificaciones = document.getElementById('btnNotificaciones');
const elBadgeNotificaciones = document.getElementById('badgeNotificaciones');

let intervaloNotificaciones = null;

document.addEventListener('DOMContentLoaded', () => {
  if (elBtnNotificaciones) {
    elBtnNotificaciones.addEventListener('click', () => {
      if (typeof activarVista === 'function') activarVista('view-pagina-web', 'pedidos');
    });
  }
});

/* Arranca (o reinicia) el sondeo apenas hay sesión — mismo momento en que
   el resto de los módulos empiezan a cargar sus datos. Un trabajador
   nunca ve el botón (admin-only) ni gasta llamadas al servidor por él. */
document.addEventListener('pos:sesion-iniciada', () => {
  if (intervaloNotificaciones) { clearInterval(intervaloNotificaciones); intervaloNotificaciones = null; }
  if (!esAdmin()) return;

  actualizarNotificaciones();
  intervaloNotificaciones = setInterval(actualizarNotificaciones, INTERVALO_NOTIFICACIONES_MS);
});

async function actualizarNotificaciones() {
  if (!elBadgeNotificaciones || !tokenActual() || !esAdmin()) return;

  try {
    const pedidos = await API.pedidosWeb.listar(ESTADOS_NOTIFICACION_PEDIDOS_WEB);
    const cantidad = Array.isArray(pedidos) ? pedidos.length : 0;
    elBadgeNotificaciones.textContent = `(${cantidad})`;
    elBtnNotificaciones?.classList.toggle('tiene-pendientes', cantidad > 0);
  } catch (err) {
    // Silencioso a propósito (mismo criterio que verificarBackend()): un
    // fallo puntual de este sondeo cada 60s no debe interrumpir al
    // administrador con un toast — se reintenta solo en el próximo ciclo.
    console.error('Error al actualizar notificaciones:', err.message || err);
  }
}

/* ============================================================
   RECORDATORIO DEL F29 (sql/49)
   ------------------------------------------------------------
   Un botón en el header, al lado de la campana, que solo aparece si hay
   un período del F29 sin marcar como presentado. El color sube con la
   urgencia: gris (más de 7 días), ámbar (7 o menos), rojo con pulso (2 o
   menos, o atrasado). Al hacer clic abre el modal para marcarlo.

   El estado cambia una vez al día, así que se consulta al iniciar sesión
   y cada 30 minutos — no en el ciclo de 60s de los pedidos web.
   ============================================================ */

const INTERVALO_F29_MS = 30 * 60 * 1000;
let intervaloF29 = null;
let f29PendienteActual = null;   // el período más antiguo sin presentar

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnF29')?.addEventListener('click', abrirModalF29);
  document.getElementById('btnCancelarF29')?.addEventListener('click', () => cerrarModal('modalF29'));
  document.getElementById('btnConfirmarF29')?.addEventListener('click', confirmarF29Presentado);
  document.getElementById('f29RegistrarGasto')?.addEventListener('change', actualizarCamposF29);
  document.getElementById('f29Monto')?.addEventListener('input', actualizarCamposF29);
  ['f29Base', 'f29Debito', 'f29Credito', 'f29Determinado'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', revisarCuadraturaF29);
  });
  ['f29Credito', 'f29Debito'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', sugerirRemanenteF29);
  });
  /* Si lo escribe a mano, manda lo suyo y el POS deja de proponerlo.
     No hace falta distinguir quién disparó el evento: asignar .value desde
     sugerirRemanenteF29 NO dispara 'input', así que acá solo llega él. */
  document.getElementById('f29Remanente')?.addEventListener('input', (e) => {
    delete e.target.dataset.auto;
    const pista = document.getElementById('f29RemanentePista');
    if (pista) pista.textContent = '';
  });
});

document.addEventListener('pos:sesion-iniciada', () => {
  if (intervaloF29) { clearInterval(intervaloF29); intervaloF29 = null; }
  const btn = document.getElementById('btnF29');
  if (!esAdmin()) { if (btn) btn.hidden = true; return; }

  actualizarRecordatorioF29();
  intervaloF29 = setInterval(actualizarRecordatorioF29, INTERVALO_F29_MS);
});

/* "vence lun 21-09 · en 8 días" — la fecha se arma a mano desde el ISO
   (new Date('2026-09-21') se leería como UTC y podría mostrar el 20). */
function textoVencimientoF29(p) {
  const [a, m, d] = String(p.vence).split('-').map(Number);
  const dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const dow = dias[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
  const fecha = `${dow} ${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}`;
  const n = Number(p.diasRestantes);
  const cuando = n < 0 ? `atrasado ${Math.abs(n)} día(s)` : n === 0 ? 'vence HOY' : n === 1 ? 'mañana' : `en ${n} días`;
  return { fecha, cuando };
}

async function actualizarRecordatorioF29() {
  const btn = document.getElementById('btnF29');
  const texto = document.getElementById('textoF29');
  if (!btn || !texto || !tokenActual() || !esAdmin()) return;

  try {
    const estado = await API.balance.f29Estado();
    const pendientes = Array.isArray(estado?.pendientes) ? estado.pendientes : [];
    f29PendienteActual = pendientes[0] || null;

    if (!f29PendienteActual) { btn.hidden = true; return; }

    const { fecha, cuando } = textoVencimientoF29(f29PendienteActual);
    const extra = pendientes.length > 1 ? ` (+${pendientes.length - 1})` : '';
    texto.textContent = `F29 ${f29PendienteActual.nombre}: ${cuando}${extra}`;
    btn.title = `F29 de ${f29PendienteActual.nombre} sin marcar como presentado · vence ${fecha}`;
    btn.classList.remove('f29-pronto', 'f29-urgente', 'f29-atrasado');
    if (f29PendienteActual.nivel !== 'normal') btn.classList.add(`f29-${f29PendienteActual.nivel}`);
    btn.hidden = false;
  } catch (err) {
    // Mismo criterio que la campana: un fallo puntual no interrumpe con un toast
    console.error('Error al revisar el F29:', err.message || err);
  }
}

/* Los códigos del Formulario Compacto (sql/58): id del input → campo que
   espera el servidor. Un solo mapa para limpiar, leer y no repetir ids. */
const CAMPOS_CODIGOS_F29 = {
  f29Folio: 'folio',
  f29FechaPresentacion: 'fecha_presentacion',
  f29Base: 'base_imponible',
  f29Debito: 'debito_total',
  f29Credito: 'credito_total',
  f29Determinado: 'iva_determinado',
  f29Ppm: 'ppm_pagado',
  f29RemanenteAnterior: 'remanente_anterior',
  f29Boletas: 'cant_boletas',
  f29Facturas: 'cant_facturas_recibidas'
};

function leerCodigosF29() {
  const datos = {};
  for (const [id, campo] of Object.entries(CAMPOS_CODIGOS_F29)) {
    datos[campo] = (document.getElementById(id)?.value || '').trim() || null;
  }
  return datos;
}

/* El código 77 sale de una resta: crédito (537) − débito (538). Si están
   los dos, el POS lo calcula y lo propone, para no hacerle copiar un
   número que ya se puede deducir. Queda editable: si el SII trae otro
   valor manda el del SII, y desde que lo toca a mano no se vuelve a
   pisar (dataset.auto). Se PROPONE y no se impone porque el 77 también
   se carga desde la propuesta, antes de que existan el 537 y el 538. */
function sugerirRemanenteF29() {
  const campo = document.getElementById('f29Remanente');
  const pista = document.getElementById('f29RemanentePista');
  if (!campo) return;
  if (campo.value !== '' && campo.dataset.auto !== '1') return;   // lo escribió él

  const v = (id) => { const t = (document.getElementById(id)?.value || '').trim(); return t === '' ? null : Number(t); };
  const cred = v('f29Credito'), deb = v('f29Debito');
  if (cred === null || deb === null || !Number.isFinite(cred) || !Number.isFinite(deb)) return;

  const remanente = Math.max(0, Math.round(cred - deb));
  campo.value = String(remanente);
  campo.dataset.auto = '1';
  if (pista) {
    pista.textContent = remanente > 0
      ? `Calculado solo: ${fmtCLP(cred)} de crédito − ${fmtCLP(deb)} de débito = ${fmtCLP(remanente)}. Si el SII dice otra cosa, cámbialo.`
      : 'Con ese débito y crédito no queda remanente para el mes siguiente.';
  }
}

/* Aviso de cuadratura en vivo, mientras escribe. El servidor lo revisa
   igual; esto es para darse cuenta antes de guardar. NO bloquea: el F29
   se anota como el SII lo recibió, aunque un número se vea raro. */
function revisarCuadraturaF29() {
  const aviso = document.getElementById('f29Cuadratura');
  if (!aviso) return;
  const v = (id) => { const t = (document.getElementById(id)?.value || '').trim(); return t === '' ? null : Number(t); };
  const base = v('f29Base'), deb = v('f29Debito'), cred = v('f29Credito'), det = v('f29Determinado');
  const problemas = [];

  if (base !== null && deb !== null && Math.abs(deb - Math.round(base * 0.19)) > 2) {
    problemas.push(`El 19% de ${fmtCLP(base)} es ${fmtCLP(Math.round(base * 0.19))}, y anotaste ${fmtCLP(deb)} en el 538.`);
  }
  if (deb !== null && cred !== null && det !== null) {
    const esperado = Math.max(0, deb - cred);
    if (Math.abs(det - esperado) > 2) problemas.push(`Con ese débito y crédito, el 089 debería ser ${fmtCLP(esperado)}.`);
  }
  if (deb !== null && cred !== null && det === null && cred >= deb) {
    aviso.textContent = '✔️ El crédito alcanzó: el IVA determinado (089) va en 0.';
    aviso.style.color = 'var(--green)';
    return;
  }

  aviso.textContent = problemas.length ? '⚠️ ' + problemas.join(' ') + ' Revísalo en el PDF; igual se puede guardar.' : '';
  aviso.style.color = problemas.length ? 'var(--gold)' : '';
}

function actualizarCamposF29() {
  const monto = Number(document.getElementById('f29Monto')?.value) || 0;
  const registrar = !!document.getElementById('f29RegistrarGasto')?.checked;
  const metodo = document.getElementById('f29Metodo');
  if (metodo) metodo.disabled = !(registrar && monto > 0);
}

function abrirModalF29() {
  if (!f29PendienteActual) return;
  const { fecha, cuando } = textoVencimientoF29(f29PendienteActual);
  const resumen = document.getElementById('f29Resumen');
  if (resumen) resumen.textContent = `Período ${f29PendienteActual.nombre} · vence ${fecha} (${cuando}).`;

  const monto = document.getElementById('f29Monto');
  if (monto) monto.value = '';
  const remanente = document.getElementById('f29Remanente');
  if (remanente) { remanente.value = ''; delete remanente.dataset.auto; }
  const pistaRem = document.getElementById('f29RemanentePista');
  if (pistaRem) pistaRem.textContent = '';
  const chk = document.getElementById('f29RegistrarGasto');
  if (chk) chk.checked = true;
  const metodo = document.getElementById('f29Metodo');
  if (metodo) metodo.value = 'Transferencia';
  for (const id of Object.keys(CAMPOS_CODIGOS_F29)) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  }
  const cuadratura = document.getElementById('f29Cuadratura');
  if (cuadratura) cuadratura.textContent = '';
  actualizarCamposF29();

  document.getElementById('modalF29')?.classList.add('show');
  setTimeout(() => monto?.focus(), 80);
}

async function confirmarF29Presentado() {
  if (!f29PendienteActual) return;
  const monto = Number(document.getElementById('f29Monto')?.value) || 0;
  if (monto < 0) { showToast('El monto no puede ser negativo', 'err'); return; }

  const btn = document.getElementById('btnConfirmarF29');
  if (btn) btn.disabled = true;
  try {
    const registrar = !!document.getElementById('f29RegistrarGasto')?.checked && monto > 0;
    const resp = await API.balance.f29Marcar({
      periodo: f29PendienteActual.periodo,
      monto_pagado: monto,
      registrar_gasto: registrar,
      metodo_pago: document.getElementById('f29Metodo')?.value || 'Transferencia',
      // Código 77 (sql/51): vacío = no se toca el remanente guardado
      remanente_siguiente: (document.getElementById('f29Remanente')?.value || '').trim() || null,
      ...leerCodigosF29()
    });
    showToast(registrar
      ? `F29 de ${f29PendienteActual.nombre} marcado y pago de ${fmtCLP(monto)} registrado en Gastos`
      : `F29 de ${f29PendienteActual.nombre} marcado como presentado`, 'ok');
    // Guardado igual, pero algo no cuadra: se avisa, no se esconde.
    if (Array.isArray(resp?.avisos) && resp.avisos.length) {
      setTimeout(() => showToast('Quedó guardado, pero revisa: ' + resp.avisos[0], 'err'), 2200);
    }
    cerrarModal('modalF29');
    await actualizarRecordatorioF29();
    if (registrar && typeof cargarCompras === 'function') cargarCompras();
    if (typeof cargarHistorialF29 === 'function') cargarHistorialF29();
  } catch (err) {
    showToast(err.message || 'No se pudo marcar el F29', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ============================================================
   PRODUCTOS AGOTADOS: QUÉ HACER CON CADA UNO (sql/55)
   ------------------------------------------------------------
   Un producto que llega a stock 0 hoy se queda callado y deja de
   venderse sin que nadie lo note. Este botón aparece en el header solo
   si hay agotados sin decidir, y el modal ofrece las cuatro salidas que
   ya existen en el sistema:

     · Por llegar  → productos.por_llegar (sql/42): se puede reservar
                     pagando el 100% y la tienda avisa cuando llega.
     · Encargo     → productos.es_pedido_encargo (sql/30): se vende sin
                     stock, con abono.
     · Archivar    → productos.archivado (sql/32): sale del catálogo y de
                     la tienda, sin borrarse ni perder su historial.
     · Dejarlo     → no cambia nada, pero se GUARDA la decisión para no
                     volver a preguntar por ese producto.

   REGLA DEL DUEÑO: nada se mueve solo. El POS detecta y pregunta; el
   cambio lo aplica el servidor recién con la decisión aprobada.

   Se consulta cada 30 minutos, igual que el F29: un producto no se
   agota cada minuto y no vale la pena gastar llamadas en eso.
   ============================================================ */

const INTERVALO_AGOTADOS_MS = 30 * 60 * 1000;
let intervaloAgotados = null;
let agotadosPendientes = [];
let agotadosDias = 90;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnAgotados')?.addEventListener('click', abrirModalAgotados);
  document.getElementById('btnCerrarAgotados')?.addEventListener('click', () => cerrarModal('modalAgotados'));

  /* Clic delegado: la lista se vuelve a pintar entera después de cada
     decisión, así que enganchar botón por botón se perdería en el
     siguiente render (mismo criterio que el visor de imagen). */
  document.getElementById('agotadosLista')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-agotado-decision]');
    if (!btn) return;
    const id = Number(btn.dataset.agotadoId);
    const decision = btn.dataset.agotadoDecision;
    if (decision === 'por_llegar' && !btn.dataset.confirmado) {
      mostrarCamposPorLlegar(id);
      return;
    }
    decidirAgotado(id, decision);
  });
});

document.addEventListener('pos:sesion-iniciada', () => {
  if (intervaloAgotados) { clearInterval(intervaloAgotados); intervaloAgotados = null; }
  const btn = document.getElementById('btnAgotados');
  if (!esAdmin()) { if (btn) btn.hidden = true; return; }

  actualizarAvisoAgotados();
  intervaloAgotados = setInterval(actualizarAvisoAgotados, INTERVALO_AGOTADOS_MS);
});

async function actualizarAvisoAgotados() {
  const btn = document.getElementById('btnAgotados');
  const texto = document.getElementById('textoAgotados');
  if (!btn || !texto || !tokenActual() || !esAdmin()) return;

  try {
    const datos = await API.productos.agotados();
    agotadosPendientes = Array.isArray(datos?.pendientes) ? datos.pendientes : [];
    agotadosDias = Number(datos?.dias) || 90;

    if (agotadosPendientes.length === 0) { btn.hidden = true; return; }
    texto.textContent = `${agotadosPendientes.length} agotado${agotadosPendientes.length === 1 ? '' : 's'}`;
    btn.title = 'Productos en stock 0 esperando que decidas qué hacer con ellos';
    btn.hidden = false;
    if (document.getElementById('modalAgotados')?.classList.contains('show')) pintarListaAgotados();
  } catch (err) {
    // Mismo criterio que la campana y el F29: un fallo puntual del sondeo
    // no interrumpe al administrador con un toast.
    console.error('Error al revisar los productos agotados:', err.message || err);
  }
}

function abrirModalAgotados() {
  if (!agotadosPendientes.length) return;
  pintarListaAgotados();
  document.getElementById('modalAgotados')?.classList.add('show');
}

/* "vendió 8 en 90 días · última el 12-09" — sin esto la decisión se toma
   a ciegas: no es lo mismo que se agote algo que vendía 8 al mes que algo
   que vendió 1 en todo el año. */
function resumenVentasAgotado(p) {
  const u = Number(p.unidades_vendidas) || 0;
  if (u === 0) {
    return `Sin ventas en los últimos ${agotadosDias} días — se agotó hace rato y nadie lo pidió.`;
  }
  const ultima = p.ultima_venta ? ` · última el ${String(p.ultima_venta).slice(0, 10).split('-').reverse().join('-')}` : '';
  const ritmo = u / (agotadosDias / 30);
  return `Vendió ${u} unidad${u === 1 ? '' : 'es'} en ${agotadosDias} días (${ritmo.toFixed(1)} al mes)${ultima}`;
}

function pintarListaAgotados() {
  const cont = document.getElementById('agotadosLista');
  const resumen = document.getElementById('agotadosResumen');
  if (!cont) return;

  if (resumen) {
    resumen.textContent = agotadosPendientes.length
      ? `${agotadosPendientes.length} producto(s) en stock 0 esperando tu decisión. Nada cambia hasta que elijas.`
      : 'No queda ningún agotado por decidir.';
  }

  if (!agotadosPendientes.length) {
    cont.innerHTML = '<p class="modal-hint">Nada pendiente por acá.</p>';
    return;
  }

  cont.innerHTML = agotadosPendientes.map(p => `
    <div class="agotado-fila" data-fila-agotado="${p.id}">
      <div class="agotado-cabecera">
        ${miniaturaProducto({ imagen_urls: p.imagen_url ? [p.imagen_url] : [], nombre: p.nombre }, 56, { ampliable: true })}
        <div class="agotado-datos">
          <strong>${escHtml(p.nombre)}</strong>
          ${p.sku ? `<small>SKU ${escHtml(p.sku)}</small>` : ''}
          <small>${escHtml(resumenVentasAgotado(p))}</small>
          <small>Deja ${fmtCLP(p.margen)} por unidad (costo ${fmtCLP(p.costo_unitario)} · precio ${fmtCLP(p.precio_unitario)})</small>
        </div>
      </div>
      <div class="agotado-campos" id="agotadoCampos-${p.id}" style="display:none;">
        <label>¿Cuántas vienen?</label>
        <input type="number" id="agotadoUnidades-${p.id}" min="0" step="1" placeholder="Ej: 5" inputmode="numeric">
        <label>¿Cuándo llegan?</label>
        <input type="date" id="agotadoFecha-${p.id}">
        <button class="btn btn-blue btn-sm" data-agotado-decision="por_llegar" data-agotado-id="${p.id}" data-confirmado="1">Confirmar</button>
      </div>
      <div class="agotado-acciones">
        <button class="btn btn-outline btn-sm" data-agotado-decision="por_llegar" data-agotado-id="${p.id}">🚚 Por llegar</button>
        <button class="btn btn-outline btn-sm" data-agotado-decision="encargo" data-agotado-id="${p.id}">📝 Por encargo</button>
        <button class="btn btn-outline btn-sm" data-agotado-decision="archivar" data-agotado-id="${p.id}">🗄️ Archivar</button>
        <button class="btn btn-ghost btn-sm" data-agotado-decision="dejar" data-agotado-id="${p.id}">Dejarlo como está</button>
      </div>
    </div>
  `).join('');
}

/* "Por llegar" es la única salida que pide datos extra: cuántas vienen
   (es el tope de lo que se puede reservar, sql/44) y cuándo. Las dos son
   opcionales — se puede confirmar sin llenarlas. */
function mostrarCamposPorLlegar(id) {
  const campos = document.getElementById(`agotadoCampos-${id}`);
  if (campos) campos.style.display = campos.style.display === 'none' ? 'flex' : 'none';
}

async function decidirAgotado(id, decision) {
  const fila = document.querySelector(`[data-fila-agotado="${id}"]`);
  fila?.querySelectorAll('button').forEach(b => { b.disabled = true; });
  try {
    const datos = { decision };
    if (decision === 'por_llegar') {
      const u = Number(document.getElementById(`agotadoUnidades-${id}`)?.value) || 0;
      if (u > 0) datos.stock_por_llegar = u;
      const f = (document.getElementById(`agotadoFecha-${id}`)?.value || '').trim();
      if (f) datos.fecha_llegada_estimada = f;
    }
    await API.productos.decidirAgotado(id, datos);

    const nombres = { por_llegar: 'marcado "por llegar"', encargo: 'pasado a encargo', archivar: 'archivado', dejar: 'dejado como está' };
    showToast(`Producto ${nombres[decision] || 'actualizado'}`, 'ok');

    agotadosPendientes = agotadosPendientes.filter(p => Number(p.id) !== Number(id));
    pintarListaAgotados();
    const btn = document.getElementById('btnAgotados');
    const texto = document.getElementById('textoAgotados');
    if (agotadosPendientes.length === 0) {
      if (btn) btn.hidden = true;
      cerrarModal('modalAgotados');
    } else if (texto) {
      texto.textContent = `${agotadosPendientes.length} agotado${agotadosPendientes.length === 1 ? '' : 's'}`;
    }

    // El catálogo cambió: se recarga para que el POS y la tabla de
    // productos no sigan mostrando el estado viejo.
    if (typeof cargarProductos === 'function') cargarProductos();
  } catch (err) {
    showToast(err.message || 'No se pudo aplicar la decisión', 'err');
    fila?.querySelectorAll('button').forEach(b => { b.disabled = false; });
  }
}

/* ============================================================
   COMPRAS POR CONFIRMAR (sql/57)
   ------------------------------------------------------------
   El POS detectó que subió el stock y armó el borrador solo: fecha,
   cuántas entraron y el costo cargado. Acá el dueño revisa eso y pone
   lo único que el POS no puede saber — hasta cuándo el proveedor las
   recibe de vuelta.

   Mientras el borrador no se confirma NO cuenta en el informe de
   "Compras y devoluciones": contarlo sería analizar con un costo
   supuesto y un plazo inexistente.

   "No fue una compra" existe porque el stock también sube por razones
   que no son compras (un ajuste de inventario a mano, por ejemplo), y
   forzar a inventar un costo para sacarse el aviso de encima ensuciaría
   el informe justamente donde más duele.

   Se consulta cada 30 minutos, igual que el F29 y los agotados.
   ============================================================ */

const INTERVALO_BORRADORES_MS = 30 * 60 * 1000;
let intervaloBorradores = null;
let borradoresPendientes = [];

const ORIGEN_BORRADOR = {
  reposicion: 'le subiste el stock',
  alta: 'lo creaste con stock',
  lote: 'le cargaste una capa de costo',
  manual: 'lo cargaste a mano'
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnBorradores')?.addEventListener('click', abrirModalBorradores);
  document.getElementById('btnCerrarBorradores')?.addEventListener('click', () => cerrarModal('modalIngresosBorradores'));

  document.getElementById('borradoresLista')?.addEventListener('click', (e) => {
    const conf = e.target.closest('[data-confirmar-borrador]');
    if (conf) { confirmarBorradorCompra(Number(conf.dataset.confirmarBorrador)); return; }
    const desc = e.target.closest('[data-descartar-borrador]');
    if (desc) descartarBorradorCompra(Number(desc.dataset.descartarBorrador));
  });
});

document.addEventListener('pos:sesion-iniciada', () => {
  if (intervaloBorradores) { clearInterval(intervaloBorradores); intervaloBorradores = null; }
  const btn = document.getElementById('btnBorradores');
  if (!esAdmin()) { if (btn) btn.hidden = true; return; }

  actualizarAvisoBorradores();
  intervaloBorradores = setInterval(actualizarAvisoBorradores, INTERVALO_BORRADORES_MS);
});

async function actualizarAvisoBorradores() {
  const btn = document.getElementById('btnBorradores');
  const texto = document.getElementById('textoBorradores');
  if (!btn || !texto || !tokenActual() || !esAdmin()) return;

  try {
    const datos = await API.productos.ingresosBorradores();
    borradoresPendientes = Array.isArray(datos?.pendientes) ? datos.pendientes : [];

    if (borradoresPendientes.length === 0) { btn.hidden = true; return; }
    texto.textContent = `${borradoresPendientes.length} compra${borradoresPendientes.length === 1 ? '' : 's'}`;
    btn.title = 'Compras que detecté al subir el stock y esperan que confirmes costo y plazo de devolución';
    btn.hidden = false;
    if (document.getElementById('modalIngresosBorradores')?.classList.contains('show')) pintarListaBorradores();
  } catch (err) {
    // Mismo criterio que la campana, el F29 y los agotados: un fallo del
    // sondeo cada 30 min no interrumpe al administrador con un toast.
    console.error('Error al revisar las compras por confirmar:', err.message || err);
  }
}

function abrirModalBorradores() {
  if (!borradoresPendientes.length) return;
  pintarListaBorradores();
  document.getElementById('modalIngresosBorradores')?.classList.add('show');
}

/* Propone el mismo plazo que duró la ventana de la compra anterior de ese
   producto (si la hubo). Es una sugerencia visible y editable, nunca un
   dato dado por cierto: el plazo real está en la factura. */
function fechaDevolucionSugerida(b) {
  if (!b.dias_ventana_previa) return '';
  const base = new Date(`${b.fecha_compra}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + Number(b.dias_ventana_previa));
  return base.toISOString().slice(0, 10);
}

function pintarListaBorradores() {
  const cont = document.getElementById('borradoresLista');
  const resumen = document.getElementById('borradoresResumen');
  if (!cont) return;

  if (resumen) {
    resumen.textContent = borradoresPendientes.length
      ? `${borradoresPendientes.length} compra(s) que detecté al subir el stock. Confirma el costo y hasta cuándo se pueden devolver — eso último no lo puedo saber yo.`
      : 'No queda ninguna compra por confirmar.';
  }
  if (!borradoresPendientes.length) {
    cont.innerHTML = '<p class="modal-hint">Nada pendiente por acá.</p>';
    return;
  }

  cont.innerHTML = borradoresPendientes.map(b => {
    const movimiento = b.stock_antes != null && b.stock_despues != null
      ? `El stock pasó de ${b.stock_antes} a ${b.stock_despues}`
      : `Entraron ${b.cantidad} unidades`;
    const sugerida = fechaDevolucionSugerida(b);
    return `
      <div class="agotado-fila" data-fila-borrador="${b.id}">
        <div class="agotado-cabecera">
          ${miniaturaProducto({ imagen_urls: b.imagen_url ? [b.imagen_url] : [], nombre: b.nombre }, 56, { ampliable: true })}
          <div class="agotado-datos">
            <strong>${escHtml(b.nombre)}</strong>
            ${b.sku ? `<small>SKU ${escHtml(b.sku)}</small>` : ''}
            <small>${escHtml(movimiento)} el ${escHtml(fechaCorta(b.fecha_compra))} — ${escHtml(ORIGEN_BORRADOR[b.origen] || 'subió el stock')}.</small>
            ${b.proveedor_sugerido ? `<small>La vez pasada se la compraste a ${escHtml(b.proveedor_sugerido)}.</small>` : ''}
          </div>
        </div>
        <div class="borrador-campos">
          <label>Cuántas
            <input type="number" id="borrCantidad-${b.id}" min="1" step="1" value="${b.cantidad}" inputmode="numeric">
          </label>
          <label>Costo por unidad
            <input type="number" id="borrCosto-${b.id}" min="0" step="1" value="${b.costo_unitario}" inputmode="numeric">
          </label>
          <label>Devolver hasta
            <input type="date" id="borrDevolucion-${b.id}" value="${escHtml(sugerida)}">
          </label>
          <label>Proveedor
            <input type="text" id="borrProveedor-${b.id}" maxlength="80" value="${escHtml(b.proveedor_sugerido || '')}" placeholder="Opcional">
          </label>
        </div>
        <div class="agotado-acciones">
          <button class="btn btn-green btn-sm" data-confirmar-borrador="${b.id}">✔️ Confirmar compra</button>
          <button class="btn btn-ghost btn-sm" data-descartar-borrador="${b.id}">No fue una compra</button>
        </div>
      </div>`;
  }).join('');
}

async function confirmarBorradorCompra(id) {
  const fila = document.querySelector(`[data-fila-borrador="${id}"]`);
  const cantidad = Number(document.getElementById(`borrCantidad-${id}`)?.value) || 0;
  if (cantidad <= 0) { showToast('La cantidad tiene que ser mayor a 0', 'err'); return; }

  fila?.querySelectorAll('button').forEach(b => { b.disabled = true; });
  try {
    await API.productos.confirmarIngreso(id, {
      cantidad,
      costo_unitario: Number(document.getElementById(`borrCosto-${id}`)?.value) || 0,
      devolucion_hasta: (document.getElementById(`borrDevolucion-${id}`)?.value || '').trim() || null,
      proveedor: (document.getElementById(`borrProveedor-${id}`)?.value || '').trim() || null
    });
    showToast('Compra confirmada: ya cuenta en el informe', 'ok');
    quitarBorradorDeLaLista(id);
  } catch (err) {
    showToast(err.message || 'No se pudo confirmar la compra', 'err');
    fila?.querySelectorAll('button').forEach(b => { b.disabled = false; });
  }
}

async function descartarBorradorCompra(id) {
  if (!confirm('¿Descartar este aviso? Se usa cuando el stock subió por algo que no fue una compra (un ajuste de inventario, por ejemplo). No cambia el stock.')) return;
  try {
    await API.productos.eliminarIngreso(id);
    showToast('Aviso descartado', 'ok');
    quitarBorradorDeLaLista(id);
  } catch (err) {
    showToast(err.message || 'No se pudo descartar el aviso', 'err');
  }
}

function quitarBorradorDeLaLista(id) {
  borradoresPendientes = borradoresPendientes.filter(b => Number(b.id) !== Number(id));
  pintarListaBorradores();
  const btn = document.getElementById('btnBorradores');
  const texto = document.getElementById('textoBorradores');
  if (borradoresPendientes.length === 0) {
    if (btn) btn.hidden = true;
    cerrarModal('modalIngresosBorradores');
  } else if (texto) {
    texto.textContent = `${borradoresPendientes.length} compra${borradoresPendientes.length === 1 ? '' : 's'}`;
  }
}

/* ============================================================
   PEDIDOS POR ENTREGAR (dueño, 17-09-2026)
   ------------------------------------------------------------
   "A veces me olvido que dejé un pedido en pendiente, y al llegar no le
   pongo entregado ya que requiere que entre a historial de ventas; mejor
   que me salte una notificación también de aceptar como entregado."

   Botón en el header con los despachos que no están entregados, y un
   "✅ Entregado" por fila que lo marca ahí mismo. Cero pasos intermedios:
   el problema no era que faltara la función, era que estaba a tres clics.

   SIN PIN, a propósito: marcar entregado es logística y se hace con el
   cliente delante. Editar la dirección o el costo del viaje sí lo pide
   (ver guardarDespachoCompleto en js/historial.js) porque eso es plata.

   NO es admin-only, por lo mismo: el que entrega puede ser el trabajador.
   Por eso el endpoint no devuelve costo ni utilidad.

   Se consulta cada 5 minutos, no cada 30 como el F29: un pedido se
   entrega dentro del día, no dentro del mes.
   ============================================================ */

const INTERVALO_ENVIOS_MS = 5 * 60 * 1000;
let intervaloEnvios = null;
let enviosPendientesCache = [];

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnEnviosPendientes')?.addEventListener('click', abrirModalEnviosPendientes);
  document.getElementById('btnCerrarEnviosPendientes')?.addEventListener('click', () => cerrarModal('modalEnviosPendientes'));

  document.getElementById('enviosPendientesLista')?.addEventListener('click', (e) => {
    const entregar = e.target.closest('[data-entregar-venta]');
    if (entregar) { marcarEntregado(Number(entregar.dataset.entregarVenta)); return; }
    const detalle = e.target.closest('[data-ver-venta]');
    if (detalle && typeof verDetalleVenta === 'function') {
      cerrarModal('modalEnviosPendientes');
      verDetalleVenta(Number(detalle.dataset.verVenta));
    }
  });
});

document.addEventListener('pos:sesion-iniciada', () => {
  if (intervaloEnvios) { clearInterval(intervaloEnvios); intervaloEnvios = null; }
  actualizarAvisoEnvios();
  intervaloEnvios = setInterval(actualizarAvisoEnvios, INTERVALO_ENVIOS_MS);
});

async function actualizarAvisoEnvios() {
  const btn = document.getElementById('btnEnviosPendientes');
  const texto = document.getElementById('textoEnviosPendientes');
  if (!btn || !texto || !tokenActual()) return;

  try {
    enviosPendientesCache = await API.ventas.enviosPendientes() || [];
    if (enviosPendientesCache.length === 0) { btn.hidden = true; return; }

    const n = enviosPendientesCache.length;
    texto.textContent = `${n} por entregar`;
    /* El más viejo manda el color: uno de hace 3 días es otra cosa que uno
       de hoy, y ese olvido es justamente lo que hay que hacer visible. */
    const masViejo = Math.max(...enviosPendientesCache.map(v => Number(v.dias_esperando) || 0));
    btn.classList.remove('envios-atrasado');
    if (masViejo >= 2) btn.classList.add('envios-atrasado');
    btn.title = masViejo >= 2
      ? `El más antiguo lleva ${masViejo} días sin marcarse como entregado`
      : 'Pedidos despachados sin marcar como entregados';
    btn.hidden = false;
    if (document.getElementById('modalEnviosPendientes')?.classList.contains('show')) pintarEnviosPendientes();
  } catch (err) {
    // Mismo criterio que el resto de los avisos: un fallo del sondeo no
    // interrumpe con un toast; se reintenta en el próximo ciclo.
    console.error('Error al revisar los pedidos por entregar:', err.message || err);
  }
}

function abrirModalEnviosPendientes() {
  if (!enviosPendientesCache.length) return;
  pintarEnviosPendientes();
  document.getElementById('modalEnviosPendientes')?.classList.add('show');
}

function pintarEnviosPendientes() {
  const cont = document.getElementById('enviosPendientesLista');
  const resumen = document.getElementById('enviosPendientesResumen');
  if (!cont) return;

  if (resumen) {
    const atrasados = enviosPendientesCache.filter(v => Number(v.dias_esperando) >= 2).length;
    resumen.textContent = enviosPendientesCache.length
      ? `${enviosPendientesCache.length} pedido(s) despachado(s) sin marcar como entregados`
        + (atrasados ? ` · ${atrasados} llevan 2 días o más.` : '.')
      : 'No queda ningún pedido por entregar.';
  }
  if (!enviosPendientesCache.length) {
    cont.innerHTML = '<p class="modal-hint">Nada pendiente por acá.</p>';
    return;
  }

  cont.innerHTML = enviosPendientesCache.map(v => {
    const dias = Number(v.dias_esperando) || 0;
    const cuando = dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`;
    const est = ETIQUETAS_ENVIO[v.estado_envio || 'pendiente'] || ETIQUETAS_ENVIO.pendiente;
    const orden = String(v.numero_orden ?? v.id).padStart(5, '0');
    return `
      <div class="agotado-fila" data-fila-envio="${v.id}">
        <div class="agotado-cabecera">
          <div class="agotado-datos">
            <strong>#${escHtml(orden)} · ${escHtml(v.cliente || 'Consumidor Final')}</strong>
            <small>Vendido ${escHtml(cuando)} (${escHtml(v.fecha || '')}${v.hora ? ' · ' + escHtml(v.hora) : ''}) · ${fmtCLP(v.total)}</small>
            <small>📍 ${escHtml(v.direccion_envio || 'sin dirección anotada')}</small>
            ${v.notas_despacho ? `<small>📝 ${escHtml(v.notas_despacho)}</small>` : ''}
            ${v.cliente_telefono ? `<small>📱 ${escHtml(v.cliente_telefono)}</small>` : ''}
          </div>
          <span class="badge ${est.clase}">${est.txt}</span>
        </div>
        <div class="agotado-acciones">
          <button class="btn btn-green btn-sm" data-entregar-venta="${v.id}">✅ Entregado</button>
          <button class="btn btn-ghost btn-sm" data-ver-venta="${v.id}">Ver detalle</button>
        </div>
      </div>`;
  }).join('');
}

async function marcarEntregado(id) {
  const fila = document.querySelector(`[data-fila-envio="${id}"]`);
  fila?.querySelectorAll('button').forEach(b => { b.disabled = true; });
  try {
    await API.ventas.actualizarEnvio(id, { estado_envio: 'entregado' });
    showToast('Pedido marcado como entregado', 'ok');

    enviosPendientesCache = enviosPendientesCache.filter(v => Number(v.id) !== Number(id));
    pintarEnviosPendientes();
    const btn = document.getElementById('btnEnviosPendientes');
    const texto = document.getElementById('textoEnviosPendientes');
    if (enviosPendientesCache.length === 0) {
      if (btn) btn.hidden = true;
      cerrarModal('modalEnviosPendientes');
    } else if (texto) {
      texto.textContent = `${enviosPendientesCache.length} por entregar`;
    }

    // El historial, si está abierto, muestra el estado viejo hasta recargar
    if (typeof cargarHistorial === 'function') cargarHistorial();
  } catch (err) {
    showToast(err.message || 'No se pudo marcar como entregado', 'err');
    fila?.querySelectorAll('button').forEach(b => { b.disabled = false; });
  }
}
