// ==========================================
// PUNTOS-CAJA.JS — Puntos Sevelin en el cobro (v167, sql/106 + tienda supabase/47)
// ------------------------------------------
// Dueño, 19-10-2026: "si compran presencial debe el mismo cliente avisar a qué RUT o
// teléfono se van esos puntos… o que también pueda decir su identificador único, o que lo
// mande justo al WhatsApp al momento de realizar su compra".
//   · Sumar: el cliente dice su celular, RUT o código SEV → la venta suma a esa cuenta.
//   · Canjear: además el código de 6 números que le llega a SU WhatsApp (abuso #1).
// Todos los topes los decide el servidor (POST /api/puntos/tope y POST /api/ventas).
// Todas las funciones empiezan con "puntosCaja" (regla 1 del CLAUDE.md).
// ==========================================

let puntosCajaEstado = { cuenta: null, canje: 0, codigo: '', tope: 0, activo: false };

/* Lo que viaja en la venta (pos.js → API.ventas.crear) */
function puntosCajaParaVenta() {
  const e = puntosCajaEstado;
  if (!e.activo || !e.cuenta) return null;
  return e.canje > 0 ? { cuenta_id: e.cuenta.id, canjear: e.canje, codigo: e.codigo } : { cuenta_id: e.cuenta.id };
}

/* Al abrir el cobro de una venta nueva (pago.js → abrirSelectorPago) */
function puntosCajaPreparar(config) {
  const caja = document.getElementById('pagoPuntosBox');
  puntosCajaEstado = { cuenta: null, canje: 0, codigo: '', tope: 0, activo: !!config?.pedirOrigen, totalBase: Number(config?.total) || 0 };
  if (!caja) return;
  caja.hidden = !puntosCajaEstado.activo;
  const campo = document.getElementById('pagoPuntosBuscar');
  if (campo) campo.value = document.getElementById('posClienteTelefono')?.value.trim() || '';
  puntosCajaPintar();
}

function puntosCajaPintar(mensaje = '') {
  const el = document.getElementById('pagoPuntosResultado');
  if (!el) return;
  const e = puntosCajaEstado;
  if (!e.cuenta) { el.innerHTML = mensaje; return; }
  const c = e.cuenta;
  const s = c.saldo || {};
  el.innerHTML = `
    <div class="puntos-caja-cuenta">
      <div><b>${escHtml(c.nombre)}</b> · ${escHtml(c.telefono)} · <span class="texto-apagado">${escHtml(c.codigo)}</span>
        ${c.es_personal ? '<span class="badge badge-gold">Personal: no suma</span>' : ''}</div>
      <div class="puntos-caja-saldo">Disponibles <b>${(s.disponible || 0).toLocaleString('es-CL')}</b> · Por confirmar ${(s.pendiente || 0).toLocaleString('es-CL')}
        ${s.por_vencer_30 ? ` · <span class="texto-error">${s.por_vencer_30.toLocaleString('es-CL')} vencen este mes</span>` : ''}</div>
      ${e.canje > 0
        ? `<div class="puntos-caja-canje">✅ Canje de <b>${fmtCLP(e.canje)}</b> aplicado al total <button type="button" class="btn btn-sm btn-outline" data-puntos="quitar">Quitar</button></div>`
        : `<button type="button" class="btn btn-sm btn-outline" data-puntos="usar">Usar puntos</button>`}
      <button type="button" class="btn btn-sm btn-link" data-puntos="cambiar">Otra cuenta</button>
      ${!c.tiene_correo ? `<div class="puntos-caja-correo"><input type="email" id="pagoPuntosCorreo" class="campo-pos" placeholder="Correo (opcional: une sus puntos con su cuenta de sevelin.cl)"><button type="button" class="btn btn-sm btn-outline" data-puntos="correo">Guardar</button></div>` : ''}
      <div id="pagoPuntosCanje"></div>
    </div>`;
}

async function puntosCajaBuscar() {
  const q = document.getElementById('pagoPuntosBuscar')?.value.trim();
  if (!q) { puntosCajaPintar('<span class="texto-apagado">Escribe el celular, RUT o código SEV del cliente.</span>'); return; }
  try {
    const r = await API.puntos.buscar(q);
    if (r.cuenta) { puntosCajaEstado.cuenta = r.cuenta; puntosCajaPintar(); return; }
    puntosCajaEstado.cuenta = null;
    puntosCajaPintar(`
      <div class="puntos-caja-nueva">
        <p>No tiene cuenta. <b>Inscríbelo en 10 segundos:</b></p>
        <input type="text" id="pagoPuntosNombre" class="campo-pos" placeholder="Nombre y apellido" maxlength="80" value="${escHtml(document.getElementById('posCliente')?.value.trim() || '')}">
        <input type="tel" id="pagoPuntosTelefono" class="campo-pos" placeholder="Celular 9 1234 5678" value="${escHtml(r.telefono || '')}">
        <input type="email" id="pagoPuntosCorreoNuevo" class="campo-pos" placeholder="Correo (opcional)">
        <label class="caja-check"><input type="checkbox" id="pagoPuntosAcepta"> El cliente acepta las bases de Puntos Sevelin y que guardemos su nombre y celular</label>
        <button type="button" class="btn btn-sm btn-primary" data-puntos="crear">Crear cuenta</button>
      </div>`);
  } catch (err) {
    puntosCajaPintar(`<span class="texto-error">${escHtml(err.message || 'No se pudo buscar')}</span>`);
  }
}

async function puntosCajaCrear() {
  try {
    const r = await API.puntos.crear({
      nombre: document.getElementById('pagoPuntosNombre')?.value,
      telefono: document.getElementById('pagoPuntosTelefono')?.value,
      correo: document.getElementById('pagoPuntosCorreoNuevo')?.value,
      consentimiento: !!document.getElementById('pagoPuntosAcepta')?.checked,
    });
    puntosCajaEstado.cuenta = r.cuenta;
    puntosCajaPintar();
    showToast(`Cuenta creada: ${r.cuenta.codigo}. Esta compra ya suma.`, 'ok');
  } catch (err) {
    showToast(err.message || 'No se pudo crear la cuenta', 'err');
  }
}

async function puntosCajaGuardarCorreo() {
  const correo = document.getElementById('pagoPuntosCorreo')?.value.trim();
  if (!correo || !puntosCajaEstado.cuenta) return;
  try {
    const r = await API.puntos.actualizar(puntosCajaEstado.cuenta.id, { correo });
    puntosCajaEstado.cuenta = r.cuenta;
    puntosCajaPintar();
    showToast('Correo guardado: al entrar a sevelin.cl con ese correo, sus puntos se unen solos', 'ok');
  } catch (err) {
    showToast(err.message || 'No se pudo guardar el correo', 'err');
  }
}

/* "Usar puntos": el servidor dice cuánto se puede en este carrito; se manda el código a su WhatsApp */
async function puntosCajaUsar() {
  const el = document.getElementById('pagoPuntosCanje');
  if (!el || !puntosCajaEstado.cuenta) return;
  el.innerHTML = '<span class="texto-apagado">Calculando…</span>';
  try {
    const d = typeof obtenerDescuentoActual === 'function' ? obtenerDescuentoActual() : {};
    const r = await API.puntos.tope({ cuenta_id: puntosCajaEstado.cuenta.id, items: cart, descuento_tipo: d.tipo, descuento_valor: d.valor });
    if (r.motivo || !r.tope) { el.innerHTML = `<span class="texto-apagado">${escHtml(r.motivo || 'En esta compra no se pueden canjear puntos.')}</span>`; return; }
    puntosCajaEstado.tope = r.tope;
    el.innerHTML = `
      <p>Puede usar hasta <b>${fmtCLP(r.tope)}</b> en esta compra.</p>
      <button type="button" class="btn btn-sm btn-primary" data-puntos="whatsapp">📲 Mandar el código a su WhatsApp</button>
      <div class="puntos-caja-codigo">
        <input type="text" id="pagoPuntosCodigo" class="campo-pos" inputmode="numeric" maxlength="6" placeholder="Código de 6 números">
        <button type="button" class="btn btn-sm btn-primary" data-puntos="aplicar">Aplicar</button>
      </div>
      <p class="modal-hint">El código le llega al celular de SU cuenta y dura 10 minutos. También lo ve en "Mis puntos" de sevelin.cl.</p>`;
  } catch (err) {
    el.innerHTML = `<span class="texto-error">${escHtml(err.message || 'No se pudo calcular')}</span>`;
  }
}

async function puntosCajaMandarCodigo() {
  try {
    const r = await API.puntos.codigo(puntosCajaEstado.cuenta.id);
    window.open(r.whatsapp, '_blank', 'noopener');
    showToast('Se abrió WhatsApp con el código: envíalo y pídele al cliente que te lo dicte', 'ok');
  } catch (err) {
    showToast(err.message || 'No se pudo generar el código', 'err');
  }
}

async function puntosCajaAplicar() {
  const codigo = document.getElementById('pagoPuntosCodigo')?.value.replace(/\D/g, '');
  try {
    await API.puntos.verificar(puntosCajaEstado.cuenta.id, codigo);
    puntosCajaEstado.codigo = codigo;
    puntosCajaEstado.canje = puntosCajaEstado.tope;
    puntosCajaActualizarTotal();
    puntosCajaPintar();
  } catch (err) {
    showToast(err.message || 'Código incorrecto', 'err');
  }
}

function puntosCajaQuitar() {
  puntosCajaEstado.canje = 0;
  puntosCajaEstado.codigo = '';
  puntosCajaActualizarTotal();
  puntosCajaPintar();
}

/* El total del cobro baja con el canje (y sin redondeo: el servidor no redondea si hay descuento) */
function puntosCajaActualizarTotal() {
  if (typeof configPago !== 'object' || !configPago) return;
  const ajuste = typeof totalesCarrito === 'function' ? (totalesCarrito().ajuste || 0) : 0;
  const e = puntosCajaEstado;
  configPago.total = e.canje > 0 ? Math.max(0, e.totalBase - ajuste - e.canje) : e.totalBase;
  const el = document.getElementById('pagoTotal');
  if (el) el.textContent = fmtCLP(configPago.total);
  if (typeof renderMetodosPago === 'function') renderMetodosPago();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnPagoPuntosBuscar')?.addEventListener('click', puntosCajaBuscar);
  document.getElementById('pagoPuntosBuscar')?.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); puntosCajaBuscar(); } });
  document.getElementById('pagoPuntosResultado')?.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-puntos]');
    if (!b) return;
    const accion = b.dataset.puntos;
    if (accion === 'crear') puntosCajaCrear();
    else if (accion === 'usar') puntosCajaUsar();
    else if (accion === 'whatsapp') puntosCajaMandarCodigo();
    else if (accion === 'aplicar') puntosCajaAplicar();
    else if (accion === 'quitar') puntosCajaQuitar();
    else if (accion === 'correo') puntosCajaGuardarCorreo();
    else if (accion === 'cambiar') { puntosCajaQuitar(); puntosCajaEstado.cuenta = null; puntosCajaPintar(); document.getElementById('pagoPuntosBuscar')?.focus(); }
  });
});
