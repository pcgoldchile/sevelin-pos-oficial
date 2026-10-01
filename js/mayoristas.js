/* ============================================================
   VENTA MAYORISTA — Fase 1 (v103, sql/76 + supabase/39 de la tienda)
   ------------------------------------------------------------
   Página Web → Mayoristas. El cliente pide la cuenta desde "Mi cuenta" en
   sevelin.cl; acá se verifica por WhatsApp o llamada y se aprueba con la
   nota de cómo se verificó (obligatoria, regla del dueño 30-09-2026).
   También el pedido mínimo y la lista de productos con precio mayorista.

   Chip del encabezado: cuentas por aprobar y precios mayoristas que la base
   desactivó sola porque subió el costo (sql/76). Solo admin, cada 30 min.
   ============================================================ */

let mayoristasCache = null;          // respuesta de GET /api/pos/mayoristas
let filtroCuentasMayoristas = 'PENDIENTE';
let cambioEstadoMayorista = null;    // { userId, estado } del modal abierto
let intervaloAvisosMayoristas = null;
const INTERVALO_AVISOS_MAYORISTAS_MS = 30 * 60 * 1000;

const TEXTOS_ESTADO_MAYORISTA = {
  APROBAR: {
    estado: 'APROBADA', titulo: 'Aprobar cuenta mayorista', etiqueta: '¿Cómo lo verificaste?', boton: 'Aprobar',
    ayuda: 'Queda guardado con la fecha. Al aprobar, a la persona le llega un correo avisándole que ya puede ver sus precios.',
    ejemplo: 'Ej: hablé por WhatsApp el 01-10, es técnico en Arica y compra cables y pendrives para su taller'
  },
  REACTIVAR: {
    estado: 'APROBADA', titulo: 'Reactivar cuenta mayorista', etiqueta: '¿Por qué la reactivas?', boton: 'Reactivar',
    ayuda: 'Vuelve a ver y pagar precios mayoristas. Se le manda el mismo correo de cuenta aprobada.',
    ejemplo: 'Ej: pagó lo pendiente y conversamos por WhatsApp el 05-10'
  },
  RECHAZAR: {
    estado: 'RECHAZADA', titulo: 'Rechazar solicitud', etiqueta: 'Motivo', boton: 'Rechazar',
    ayuda: 'No se le manda correo: avísale tú por WhatsApp si corresponde. Podrá volver a pedirla desde su cuenta.',
    ejemplo: 'Ej: no respondió el WhatsApp en una semana'
  },
  SUSPENDER: {
    estado: 'SUSPENDIDA', titulo: 'Suspender cuenta mayorista', etiqueta: 'Motivo', boton: 'Suspender',
    ayuda: 'Desde ahora ve y paga precios normales en sevelin.cl. Puedes reactivarla cuando quieras.',
    ejemplo: 'Ej: estaba revendiendo bajo nuestro precio normal'
  }
};

const ETIQUETA_ESTADO_MAYORISTA = {
  PENDIENTE: '<span class="badge badge-gold">Por aprobar</span>',
  APROBADA: '<span class="badge badge-green">Aprobada</span>',
  SUSPENDIDA: '<span class="badge badge-red">Suspendida</span>',
  RECHAZADA: '<span class="badge">Rechazada</span>'
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('mayoristasChips')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-may-filtro]');
    if (!b) return;
    filtroCuentasMayoristas = b.dataset.mayFiltro;
    document.querySelectorAll('#mayoristasChips [data-may-filtro]').forEach(c => c.classList.toggle('active', c === b));
    pintarCuentasMayoristas();
  });
  document.getElementById('btnRecargarMayoristas')?.addEventListener('click', () => cargarMayoristas());
  document.getElementById('btnGuardarPedidoMinimo')?.addEventListener('click', guardarPedidoMinimoMayorista);
  document.getElementById('mayoristasLista')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-may-accion]');
    if (b) abrirEstadoMayorista(b.dataset.mayUsuario, b.dataset.mayAccion);
  });
  document.getElementById('mayoristasProductosBody')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-may-editar]');
    if (b) abrirEditorDesdeMayoristas(Number(b.dataset.mayEditar));
  });
  document.getElementById('btnCancelarEstadoMayorista')?.addEventListener('click', () => cerrarModal('modalEstadoMayorista'));
  document.getElementById('btnConfirmarEstadoMayorista')?.addEventListener('click', confirmarEstadoMayorista);
  document.getElementById('btnMayoristasAviso')?.addEventListener('click', () => {
    document.querySelector('.nav-subitem[data-view="view-pagina-web"][data-subtab="mayoristas"]')?.click();
  });
});

document.addEventListener('pos:sesion-iniciada', () => {
  if (intervaloAvisosMayoristas) { clearInterval(intervaloAvisosMayoristas); intervaloAvisosMayoristas = null; }
  const btn = document.getElementById('btnMayoristasAviso');
  if (!esAdmin()) { if (btn) btn.hidden = true; return; }
  actualizarAvisoMayoristas();
  intervaloAvisosMayoristas = setInterval(actualizarAvisoMayoristas, INTERVALO_AVISOS_MAYORISTAS_MS);
});

async function actualizarAvisoMayoristas() {
  const btn = document.getElementById('btnMayoristasAviso');
  const texto = document.getElementById('textoMayoristasAviso');
  if (!btn || !texto || !tokenActual() || !esAdmin()) return;
  try {
    const a = await API.mayoristas.avisos();
    const porAprobar = Number(a?.por_aprobar) || 0;
    const desactivados = Number(a?.desactivados) || 0;
    if (!porAprobar && !desactivados) { btn.hidden = true; return; }
    const partes = [];
    if (porAprobar) partes.push(`${porAprobar} mayorista${porAprobar === 1 ? '' : 's'} por aprobar`);
    if (desactivados) partes.push(`${desactivados} mayorista${desactivados === 1 ? '' : 's'} desactivado${desactivados === 1 ? '' : 's'}`);
    texto.textContent = partes.join(' · ');
    btn.title = desactivados
      ? 'Hay precios mayoristas que se desactivaron solos porque subió el costo o bajó el precio normal. Revísalos en Página Web → Mayoristas.'
      : 'Clientes que pidieron cuenta mayorista en sevelin.cl y esperan que los verifiques.';
    btn.hidden = false;
  } catch (err) {
    // Silencioso: sondeo de fondo, se reintenta en el próximo ciclo.
    console.error('Error al revisar los avisos de mayoristas:', err.message || err);
  }
}

async function cargarMayoristas() {
  const lista = document.getElementById('mayoristasLista');
  if (lista && !mayoristasCache) lista.innerHTML = '<p class="modal-hint">Cargando…</p>';
  try {
    mayoristasCache = await API.mayoristas.listar();
    pintarCuentasMayoristas();
    pintarPedidoMinimoMayorista();
    pintarProductosMayoristas();
  } catch (err) {
    console.error('Error al cargar mayoristas:', err.message || err);
    if (lista) lista.innerHTML = `<p class="modal-hint" style="color:var(--red);">${escHtml(err.message || 'No se pudo cargar')}</p>`;
  }
}

function mensajeWhatsappMayorista(c) {
  const nombre = String(c.nombre || '').split(' ')[0] || '';
  return `Hola ${nombre}, te escribimos de Sevelin (Arica) por tu solicitud de cuenta mayorista en sevelin.cl. ` +
    '¿Nos cuentas un poco a qué te dedicas y qué productos te interesan? Con eso la activamos.';
}

function pintarCuentasMayoristas() {
  const cont = document.getElementById('mayoristasLista');
  const resumen = document.getElementById('mayoristasResumen');
  if (!cont || !mayoristasCache) return;
  const todas = mayoristasCache.cuentas || [];
  const cuenta = e => todas.filter(c => c.estado === e).length;
  if (resumen) {
    resumen.textContent = `${cuenta('PENDIENTE')} por aprobar · ${cuenta('APROBADA')} aprobada(s) · ${cuenta('SUSPENDIDA')} suspendida(s) · ${cuenta('RECHAZADA')} rechazada(s). Verifica por WhatsApp o llamada antes de aprobar.`;
  }
  const lista = todas.filter(c => c.estado === filtroCuentasMayoristas);
  if (!lista.length) {
    cont.innerHTML = `<p class="modal-hint">${filtroCuentasMayoristas === 'PENDIENTE' ? 'No hay solicitudes esperando.' : 'Nada en esta lista.'}</p>`;
    return;
  }
  cont.innerHTML = lista.map(c => {
    const tel = typeof telefonoWhatsappOT === 'function' ? telefonoWhatsappOT(c.telefono) : String(c.telefono || '').replace(/\D/g, '');
    const wa = tel
      ? `<a class="btn btn-outline btn-sm" href="https://wa.me/${escHtml(tel)}?text=${encodeURIComponent(mensajeWhatsappMayorista(c))}" target="_blank" rel="noopener noreferrer">📲 WhatsApp</a>`
      : '';
    const u = escHtml(c.user_id);
    const acciones = {
      PENDIENTE: `${wa}<button class="btn btn-primary btn-sm" type="button" data-may-accion="APROBAR" data-may-usuario="${u}">Aprobar</button>
                  <button class="btn btn-outline btn-sm" type="button" data-may-accion="RECHAZAR" data-may-usuario="${u}" style="color:var(--red);border-color:rgba(239,68,68,.4);">Rechazar</button>`,
      APROBADA: `${wa}<button class="btn btn-outline btn-sm" type="button" data-may-accion="SUSPENDER" data-may-usuario="${u}" style="color:var(--red);border-color:rgba(239,68,68,.4);">Suspender</button>`,
      SUSPENDIDA: `${wa}<button class="btn btn-outline btn-sm" type="button" data-may-accion="REACTIVAR" data-may-usuario="${u}">Reactivar</button>`,
      RECHAZADA: wa
    }[c.estado] || '';
    const revision = c.revisado_en
      ? `<small>${c.estado === 'APROBADA' ? '✅ Verificado' : 'Revisado'} el ${tsAChile(c.revisado_en)}${c.nota_verificacion && c.estado === 'APROBADA' ? `: ${escHtml(c.nota_verificacion)}` : ''}${c.motivo ? ` · Motivo: ${escHtml(c.motivo)}` : ''}</small>`
      : '';
    return `
      <div class="agotado-fila">
        <div class="agotado-cabecera">
          <div class="agotado-datos">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;"><strong>${escHtml(c.nombre)}</strong>${ETIQUETA_ESTADO_MAYORISTA[c.estado] || ''}</div>
            <small>RUT ${escHtml(c.rut)} · ${escHtml(c.ciudad)} · ${escHtml(c.telefono)} · ${escHtml(c.email)}</small>
            <small>A qué se dedica: ${escHtml(c.actividad)}</small>
            <small>${c.declara_reventa ? 'Declara que compra para revender o para su negocio o taller.' : 'No marcó que compra para revender.'} Pidió la cuenta el ${tsAChile(c.solicitado_en)}.</small>
            ${revision}
          </div>
          <div class="cell-actions" style="justify-content:flex-end; flex-wrap:wrap; gap:6px;">${acciones}</div>
        </div>
      </div>`;
  }).join('');
}

function pintarPedidoMinimoMayorista() {
  const input = document.getElementById('mayoristaPedidoMinimo');
  const info = document.getElementById('mayoristaPedidoMinimoInfo');
  if (!mayoristasCache) return;
  if (input && document.activeElement !== input) input.value = mayoristasCache.pedido_minimo ?? '';
  if (info) {
    info.textContent = `Hoy: ${fmtCLP(mayoristasCache.pedido_minimo)}` +
      (mayoristasCache.pedido_minimo_actualizado_en ? ` · cambiado el ${tsAChile(mayoristasCache.pedido_minimo_actualizado_en)}` : '') +
      ` · piso de margen: ${Math.round(Number(mayoristasCache.piso_margen) * 100)}% sobre el mayor costo conocido.`;
  }
}

async function guardarPedidoMinimoMayorista() {
  const input = document.getElementById('mayoristaPedidoMinimo');
  const valor = Number(input?.value);
  if (!Number.isInteger(valor) || valor < 0) { showToast('Escribe un monto sin decimales', 'err'); return; }
  const btn = document.getElementById('btnGuardarPedidoMinimo');
  if (btn) btn.disabled = true;
  try {
    const r = await API.mayoristas.guardarPedidoMinimo(valor);
    if (mayoristasCache) {
      mayoristasCache.pedido_minimo = Number(r.pedido_minimo);
      mayoristasCache.pedido_minimo_actualizado_en = r.actualizado_en;
    }
    pintarPedidoMinimoMayorista();
    showToast(`Pedido mínimo mayorista: ${fmtCLP(valor)}`, 'ok');
  } catch (err) {
    showToast(err.message || 'No se pudo guardar', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function pintarProductosMayoristas() {
  const body = document.getElementById('mayoristasProductosBody');
  const resumen = document.getElementById('mayoristasProductosResumen');
  if (!body || !mayoristasCache) return;
  const productos = mayoristasCache.productos || [];
  const activos = productos.filter(p => Number(p.precio_mayorista) > 0);
  const desactivados = productos.filter(p => !(Number(p.precio_mayorista) > 0) && p.mayorista_aviso);
  if (resumen) {
    resumen.textContent = `${activos.length} con precio mayorista` +
      (desactivados.length ? ` · ⚠️ ${desactivados.length} desactivado(s) solo(s): revísalos abajo` : '') +
      '. Se cargan en el editor de cada producto (tarjeta "Precio y stock").';
  }
  if (!productos.length) {
    body.innerHTML = '<tr class="empty-row"><td colspan="8">Todavía no hay productos con precio mayorista.</td></tr>';
    return;
  }
  const fila = p => {
    const pm = Number(p.precio_mayorista) || 0;
    const normal = Math.min(Number(p.precio_unitario) || Infinity, Number(p.precio_web) || Infinity);
    const costo = Number(p.costo_referencia) || 0;
    // v105: las dos barras juntas (lineaMargen, js/productos.js), para comparar de un vistazo
    const margenes = costo > 0
      ? (Number.isFinite(normal) ? lineaMargen('Menor', normal, costo) : '') + (pm ? lineaMargen('Mayor', pm, costo) : '')
      : '';
    const pocoStock = pm && Number(p.stock) < Number(p.mayorista_desde);
    return `<tr>
      <td><strong>${escHtml(p.nombre)}</strong>${p.publicado_web ? '' : ' <span class="badge">No publicado</span>'}
        ${p.mayorista_aviso && !pm ? `<br><small style="color:var(--red);">⚠️ ${escHtml(p.mayorista_aviso)}</small>` : ''}</td>
      <td class="num">${Number.isFinite(normal) ? fmtCLP(normal) : '—'}</td>
      <td class="num">${pm ? `<strong>${fmtCLP(pm)}</strong>` : '—'}</td>
      <td class="num">${pm ? `${escHtml(String(p.mayorista_desde))} u.` : '—'}</td>
      <td class="col-margen">${margenes || '—'}</td>
      <td class="num">${p.precio_minimo ? fmtCLP(p.precio_minimo) : '—'}</td>
      <td class="num"${pocoStock ? ' style="color:var(--red);" title="Hay menos stock que la cantidad mínima: en la web no se muestra"' : ''}>${escHtml(String(p.stock ?? 0))}</td>
      <td style="text-align:right;"><button class="btn btn-outline btn-sm" type="button" data-may-editar="${Number(p.id)}">Editar</button></td>
    </tr>`;
  };
  body.innerHTML = [...desactivados, ...activos].map(fila).join('');
}

async function abrirEditorDesdeMayoristas(id) {
  if (typeof cargarProductos === 'function' && !productsList.some(p => Number(p.id) === id)) await cargarProductos(true);
  const producto = productsList.find(p => Number(p.id) === id);
  if (!producto) return showToast('No se encontró el producto', 'err');
  document.getElementById('view-pagina-web')?.classList.remove('active');
  abrirModalProducto(producto);
}

function abrirEstadoMayorista(userId, accion) {
  const c = (mayoristasCache?.cuentas || []).find(x => x.user_id === userId);
  const t = TEXTOS_ESTADO_MAYORISTA[accion];
  if (!c || !t) return;
  cambioEstadoMayorista = { userId, estado: t.estado };
  document.getElementById('estadoMayoristaTitulo').textContent = t.titulo;
  document.getElementById('estadoMayoristaCliente').textContent = `${c.nombre} · RUT ${c.rut} · ${c.ciudad}`;
  document.getElementById('estadoMayoristaNotaLabel').textContent = t.etiqueta;
  document.getElementById('estadoMayoristaAyuda').textContent = t.ayuda;
  const nota = document.getElementById('estadoMayoristaNota');
  nota.value = '';
  nota.placeholder = t.ejemplo;
  const btn = document.getElementById('btnConfirmarEstadoMayorista');
  btn.textContent = t.boton;
  btn.classList.toggle('btn-red', t.estado !== 'APROBADA');
  btn.classList.toggle('btn-primary', t.estado === 'APROBADA');
  document.getElementById('modalEstadoMayorista')?.classList.add('show');
  setTimeout(() => nota.focus(), 50);
}

async function confirmarEstadoMayorista() {
  if (!cambioEstadoMayorista) return;
  const nota = document.getElementById('estadoMayoristaNota')?.value.trim() || '';
  const minimo = cambioEstadoMayorista.estado === 'APROBADA' ? 10 : 5;
  if (nota.length < minimo) { showToast(`Escribe al menos ${minimo} letras`, 'err'); return; }
  const btn = document.getElementById('btnConfirmarEstadoMayorista');
  if (btn) btn.disabled = true;
  try {
    const r = await API.mayoristas.cambiarEstado(cambioEstadoMayorista.userId, cambioEstadoMayorista.estado, nota);
    cerrarModal('modalEstadoMayorista');
    if (cambioEstadoMayorista.estado === 'APROBADA') {
      if (r.correo?.enviado) showToast('Cuenta aprobada. Le llegó un correo avisándole.', 'ok');
      else showToast(`Cuenta aprobada. El correo NO salió: ${r.correo?.motivo || 'sin detalle'}`, 'err');
    } else {
      showToast(cambioEstadoMayorista.estado === 'RECHAZADA' ? 'Solicitud rechazada' : 'Cuenta suspendida', 'ok');
    }
    cambioEstadoMayorista = null;
    await cargarMayoristas();
    actualizarAvisoMayoristas();
  } catch (err) {
    showToast(err.message || 'No se pudo guardar', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}
