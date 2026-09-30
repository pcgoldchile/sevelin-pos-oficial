/* ============================================================
   PRODUCTOS → AGOTADOS (v102)
   ------------------------------------------------------------
   Pedido del dueño (30-09-2026): "un submódulo en productos para verificar
   esto y editar información".

   El chip "N agotados" del encabezado (sql/55) muestra solo los que esperan
   decisión. Esta vista los muestra TODOS —sin decidir, ya decididos y por
   llegar— con lo que hace falta para decidir bien:
     · ventas de los últimos 90 días,
     · cuántos clientes esperan el aviso (o reservaron) en sevelin.cl,
     · la decisión tomada y cuándo.
   Las decisiones usan la MISMA ruta que el chip (POST /api/productos/:id/
   agotado): una sola regla para mover un agotado. "Editar" abre el editor
   de siempre y, al cerrarlo, vuelve acá.
   ============================================================ */

let panelAgotados = null;              // { dias, avisosDisponibles, productos }
let filtroPanelAgotados = 'todos';
let volverAAgotadosPendiente = false;
let porLlegarAbiertoId = null;         // fila con el formulario de "por llegar" abierto

const FILTROS_PANEL_AGOTADOS = {
  todos:     { nombre: 'Todos',                 f: () => true },
  decidir:   { nombre: 'Sin decidir',           f: p => !p.decision && !p.por_llegar },
  esperando: { nombre: 'Con clientes esperando', f: p => (p.avisos_pendientes || 0) + (p.reservas_pendientes || 0) > 0 },
  llegar:    { nombre: 'Por llegar',            f: p => p.por_llegar },
  web:       { nombre: 'Publicados en la web',  f: p => p.publicado_web }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnAgotadosPanelRecargar')?.addEventListener('click', cargarPanelAgotados);
  document.getElementById('agotadosPanelBuscar')?.addEventListener('input', pintarPanelAgotados);
  document.getElementById('agotadosPanelFiltros')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-filtro-agotados]');
    if (!b) return;
    filtroPanelAgotados = b.dataset.filtroAgotados;
    pintarPanelAgotados();
  });
  document.getElementById('agotadosPanelCuerpo')?.addEventListener('click', clickPanelAgotados);
  document.getElementById('agotadosPanelCuerpo')?.addEventListener('change', (e) => {
    const sel = e.target.closest('[data-decidir-agotado]');
    if (!sel || !sel.value) return;
    const id = Number(sel.dataset.decidirAgotado);
    if (sel.value === 'por_llegar') { porLlegarAbiertoId = id; pintarPanelAgotados(); return; }
    decidirDesdePanel(id, { decision: sel.value });
  });
});

async function cargarPanelAgotados() {
  const resumen = document.getElementById('agotadosPanelResumen');
  if (resumen) resumen.textContent = 'Cargando…';
  try {
    panelAgotados = await API.productos.agotadosPanel();
  } catch (err) {
    if (resumen) resumen.textContent = err.message || 'No se pudo cargar la lista de agotados';
    return;
  }
  porLlegarAbiertoId = null;
  pintarPanelAgotados();
}

function fechaCortaAgotados(valor) {
  return valor ? fechaCortaAviso(String(valor).slice(0, 10)) : '—';
}

function pintarPanelAgotados() {
  const cuerpo = document.getElementById('agotadosPanelCuerpo');
  const filtros = document.getElementById('agotadosPanelFiltros');
  const resumen = document.getElementById('agotadosPanelResumen');
  if (!cuerpo || !panelAgotados) return;
  const todos = panelAgotados.productos || [];

  if (filtros) {
    filtros.innerHTML = Object.entries(FILTROS_PANEL_AGOTADOS).map(([clave, def]) => `
      <button type="button" class="btn btn-sm ${clave === filtroPanelAgotados ? 'btn-primary' : 'btn-outline'}"
        data-filtro-agotados="${clave}">${def.nombre} (${todos.filter(def.f).length})</button>`).join('');
  }

  const q = (document.getElementById('agotadosPanelBuscar')?.value || '').trim().toLowerCase();
  const lista = todos
    .filter(FILTROS_PANEL_AGOTADOS[filtroPanelAgotados].f)
    .filter(p => !q || `${p.nombre} ${p.sku || ''}`.toLowerCase().includes(q));

  if (resumen) {
    const esperando = todos.filter(FILTROS_PANEL_AGOTADOS.esperando.f).length;
    resumen.textContent = `${todos.length} producto(s) sin stock · ${todos.filter(FILTROS_PANEL_AGOTADOS.decidir.f).length} sin decidir`
      + (panelAgotados.avisosDisponibles
        ? ` · ${esperando} con clientes esperando aviso en la tienda.`
        : ' · No se pudo leer quién espera en la tienda (se muestra "?").');
  }

  cuerpo.innerHTML = lista.length ? lista.map(filaPanelAgotadosHtml).join('')
    : '<tr><td colspan="5" class="modal-hint" style="padding:18px;">Nada en este filtro.</td></tr>';
}

function estadoAgotadoHtml(p) {
  if (p.por_llegar) {
    const cuando = p.fecha_llegada_estimada ? ` ~${fechaCortaAgotados(p.fecha_llegada_estimada)}` : '';
    const cuantas = p.stock_por_llegar ? ` · ${p.stock_por_llegar} u.` : '';
    return `<span class="pend-etiqueta">🚚 Por llegar${cuando}${cuantas}</span>`;
  }
  if (p.decision === 'dejar') return `<span class="pend-etiqueta">✋ Dejado como está · ${fechaCortaAgotados(p.decidido_en)}</span>`;
  if (p.decision) return `<span class="pend-etiqueta">${escHtml(p.decision)} · ${fechaCortaAgotados(p.decidido_en)}</span>`;
  return '<span class="pend-etiqueta postergado">Sin decidir</span>';
}

function filaPanelAgotadosHtml(p) {
  const ventas = p.unidades_vendidas
    ? `${p.unidades_vendidas} u. en ${panelAgotados.dias} días<br><small>última: ${fechaCortaAgotados(p.ultima_venta)}</small>`
    : `<small>sin ventas en ${panelAgotados.dias} días</small>`;
  const esperando = p.avisos_pendientes === null ? '?'
    : (p.avisos_pendientes + p.reservas_pendientes) === 0 ? '<small>nadie</small>'
    : `${p.avisos_pendientes ? `🔔 ${p.avisos_pendientes} aviso(s)` : ''}${p.avisos_pendientes && p.reservas_pendientes ? '<br>' : ''}${p.reservas_pendientes ? `💳 ${p.reservas_pendientes} reserva(s)` : ''}`;
  const formLlegar = porLlegarAbiertoId === p.id ? `
    <div class="agotado-llegar-form">
      <label>Llega aprox. <input type="date" id="agLlegaFecha-${p.id}"></label>
      <label>Unidades <input type="number" min="0" id="agLlegaUnid-${p.id}" style="width:70px;"></label>
      <button type="button" class="btn btn-blue btn-sm" data-confirmar-llegar="${p.id}">Confirmar</button>
      <button type="button" class="btn btn-ghost btn-sm" data-cancelar-llegar="${p.id}">Cancelar</button>
    </div>` : '';
  return `
    <tr>
      <td>
        <div class="agotado-panel-prod">
          ${p.imagen_url ? `<img src="${escHtml(p.imagen_url)}" alt="" loading="lazy">` : '<span class="agotado-panel-sinfoto">📦</span>'}
          <div>
            <strong>${escHtml(p.nombre)}</strong>
            <small>${p.sku ? escHtml(p.sku) + ' · ' : ''}${fmtCLP(p.precio_unitario)}${p.publicado_web ? ' · 🌐 en la web' : ''}</small>
          </div>
        </div>
      </td>
      <td>${ventas}</td>
      <td>${esperando}</td>
      <td>${estadoAgotadoHtml(p)}${formLlegar}</td>
      <td>
        <div class="agotado-panel-acciones">
          <button type="button" class="btn btn-outline btn-sm" data-editar-agotado="${p.id}">✏️ Editar</button>
          <select class="campo-pos" data-decidir-agotado="${p.id}" aria-label="Decidir qué hacer con ${escHtml(p.nombre)}">
            <option value="">Decidir…</option>
            <option value="por_llegar">🚚 Viene en camino</option>
            <option value="encargo">📝 Pasar a encargo</option>
            <option value="archivar">🗄️ Archivar</option>
            <option value="dejar">✋ Dejar como está</option>
          </select>
        </div>
      </td>
    </tr>`;
}

async function clickPanelAgotados(e) {
  const editar = e.target.closest('[data-editar-agotado]');
  if (editar) return abrirEditorDesdeAgotados(Number(editar.dataset.editarAgotado));
  const confirmar = e.target.closest('[data-confirmar-llegar]');
  if (confirmar) {
    const id = Number(confirmar.dataset.confirmarLlegar);
    return decidirDesdePanel(id, {
      decision: 'por_llegar',
      fecha_llegada_estimada: document.getElementById(`agLlegaFecha-${id}`)?.value || '',
      stock_por_llegar: Number(document.getElementById(`agLlegaUnid-${id}`)?.value) || 0
    });
  }
  if (e.target.closest('[data-cancelar-llegar]')) { porLlegarAbiertoId = null; pintarPanelAgotados(); }
}

async function decidirDesdePanel(id, datos) {
  try {
    await API.productos.decidirAgotado(id, datos);
    showToast('Listo', 'ok');
    if (typeof invalidarCacheProductos === 'function') invalidarCacheProductos();
    if (typeof actualizarAvisoAgotados === 'function') actualizarAvisoAgotados();   // el chip del encabezado
  } catch (err) {
    showToast(err.message || 'No se pudo guardar la decisión', 'err');
  }
  await cargarPanelAgotados();
}

async function abrirEditorDesdeAgotados(id) {
  if (typeof cargarProductos === 'function' && !productsList.some(p => Number(p.id) === id)) await cargarProductos(true);
  const producto = productsList.find(p => Number(p.id) === id);
  if (!producto) return showToast('No se encontró el producto', 'err');
  volverAAgotadosPendiente = true;
  document.getElementById('view-agotados')?.classList.remove('active');
  abrirModalProducto(producto);
}

/* La llama cerrarModalProducto() (js/productos.js): si el editor se abrió
   desde acá, vuelve a esta vista con los datos al día. */
function volverDelEditorAAgotados() {
  if (!volverAAgotadosPendiente) return false;
  volverAAgotadosPendiente = false;
  document.getElementById('view-agotados')?.classList.add('active');
  cargarPanelAgotados();
  return true;
}
