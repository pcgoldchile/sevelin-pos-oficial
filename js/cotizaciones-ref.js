// ==========================================
// COTIZACIONES-REF.JS — Taller → Cotizaciones aproximadas (sql/90, v133)
// ------------------------------------------
// Pedido del dueño (11-10-2026): "una opción en servicio técnico de
// cotizaciones aproximadas, para ir cargando valores" — por ejemplo, Samsung
// A07, cambio de parlante, $15.000. Es una lista de precios de referencia:
// no crea productos, no toca órdenes y no es una cotización formal.
// La leen y la llenan todos; el costo del repuesto y borrar, solo el admin.
// ==========================================

let cotizacionesRefLista = [];
let cotizacionRefEditando = null;   // id que se está corrigiendo, o null si es nueva

async function cargarCotizacionesRef() {
  try {
    cotizacionesRefLista = await API.cotizacionesRef.listar();
  } catch (err) {
    showToast(err.message || 'No se pudieron cargar las cotizaciones aproximadas', 'err');
    return;
  }
  pintarCotizacionesRef();
}

const SINONIMOS_COTIZACION_REF = {
  motorola: ['moto'], apple: ['iphone'], iphon: ['iphone'], samsumg: ['samsung'], sansung: ['samsung'],
  frp: ['frp', 'google'], desbloqueo: ['desbloq'], desvinculacion: ['desbloq', 'desvincul'], galaxy: []
};

function normalizarCotizacionRef(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

// Cada palabra se vuelve la lista de formas que se aceptan (vacía = no pesa)
function palabrasBusquedaCotizacionRef(q) {
  return normalizarCotizacionRef(q).split(' ').filter(Boolean)
    .map(p => SINONIMOS_COTIZACION_REF[p] || [p]).filter(f => f.length);
}

function pintarCotizacionesRef() {
  const cuerpo = document.getElementById('cotizacionRefBody');
  if (!cuerpo) return;
  const admin = esAdmin();
  const columnas = admin ? 7 : 6;
  const elThCosto = document.getElementById('cotizacionRefThCosto');
  if (elThCosto) elThCosto.style.display = admin ? '' : 'none';

  // Cada palabra escrita tiene que aparecer en el equipo, el trabajo o la nota (v171: sin
  // tildes, junto o separado, y "motorola" = "moto", como el cotizador de celulares)
  const palabras = palabrasBusquedaCotizacionRef(document.getElementById('cotizacionRefBuscar')?.value || '');
  const filas = cotizacionesRefLista.filter(c => {
    const texto = normalizarCotizacionRef(`${c.equipo} ${c.trabajo} ${c.nota || ''}`);
    const junto = texto.replace(/ /g, '');
    return palabras.every(formas => formas.some(f => texto.includes(f) || junto.includes(f)));
  });

  if (!filas.length) {
    cuerpo.innerHTML = `<tr class="empty-row"><td colspan="${columnas}">${cotizacionesRefLista.length
      ? 'Ningún precio calza con esa búsqueda.'
      : 'Todavía no hay precios cargados. Agrega el primero con "Agregar precio".'}</td></tr>`;
    return;
  }

  cuerpo.innerHTML = filas.map(c => {
    const costo = c.costo_repuesto === null || c.costo_repuesto === undefined ? null : Number(c.costo_repuesto);
    return `<tr>
      <td class="strong">${escHtml(c.equipo)}</td>
      <td>${escHtml(c.trabajo)}</td>
      <td class="strong">${fmtCLP(c.precio)}</td>
      ${admin ? `<td>${costo === null ? '—' : `${fmtCLP(costo)}<br><small style="color:var(--text-muted);">quedan ${fmtCLP(Number(c.precio) - costo)}</small>`}</td>` : ''}
      <td style="white-space:pre-line;max-width:360px;">${escHtml(c.nota || '—')}</td>
      <td>${fechaCorta(tsAChile(c.actualizado_en, false))}</td>
      <td>
        <div class="cell-actions">
          <button type="button" class="btn btn-outline btn-sm" data-cotizacion-editar="${Number(c.id)}">Corregir</button>
          ${admin ? `<button type="button" class="btn btn-ghost btn-sm" data-cotizacion-eliminar="${Number(c.id)}" title="Eliminar este precio">🗑️</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* Sugerencias al escribir: los equipos y trabajos ya cargados, para no
   terminar con "Cambio de pantalla" y "cambio pantalla" como dos trabajos. */
function llenarSugerenciasCotizacionRef() {
  const opciones = (campo) => [...new Set(cotizacionesRefLista.map(c => c[campo]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map(v => `<option value="${escHtml(v)}"></option>`).join('');
  const elEquipos = document.getElementById('listaEquiposCotizacion');
  const elTrabajos = document.getElementById('listaTrabajosCotizacion');
  if (elEquipos) elEquipos.innerHTML = opciones('equipo');
  if (elTrabajos) elTrabajos.innerHTML = opciones('trabajo');
}

function abrirModalCotizacionRef(cotizacion = null) {
  cotizacionRefEditando = cotizacion ? cotizacion.id : null;
  const poner = (id, valor) => { const el = document.getElementById(id); if (el) el.value = valor ?? ''; };
  const elTitulo = document.getElementById('cotizacionRefTitulo');
  if (elTitulo) elTitulo.textContent = cotizacion ? 'Corregir precio aproximado' : 'Agregar precio aproximado';
  poner('cotizacionRefEquipo', cotizacion?.equipo);
  poner('cotizacionRefTrabajo', cotizacion?.trabajo);
  poner('cotizacionRefPrecio', cotizacion?.precio);
  poner('cotizacionRefCosto', cotizacion?.costo_repuesto);
  poner('cotizacionRefNota', cotizacion?.nota);
  const elCosto = document.getElementById('cotizacionRefCostoWrap');
  if (elCosto) elCosto.style.display = esAdmin() ? '' : 'none';
  llenarSugerenciasCotizacionRef();
  document.getElementById('modalCotizacionRef')?.classList.add('show');
  setTimeout(() => document.getElementById('cotizacionRefEquipo')?.focus(), 80);
}

async function guardarCotizacionRef() {
  const leer = (id) => (document.getElementById(id)?.value || '').trim();
  const datos = {
    equipo: leer('cotizacionRefEquipo'),
    trabajo: leer('cotizacionRefTrabajo'),
    precio: Number(leer('cotizacionRefPrecio')) || 0,
    nota: leer('cotizacionRefNota')
  };
  if (!datos.equipo) { showToast('Escribe el equipo (por ejemplo: Samsung A07)', 'err'); return; }
  if (!datos.trabajo) { showToast('Escribe el trabajo (por ejemplo: Cambio de parlante)', 'err'); return; }
  if (datos.precio <= 0) { showToast('Escribe el precio aproximado', 'err'); return; }
  if (esAdmin()) {
    const costo = leer('cotizacionRefCosto');
    datos.costo_repuesto = costo === '' ? null : Number(costo);
  }

  try {
    if (cotizacionRefEditando) await API.cotizacionesRef.actualizar(cotizacionRefEditando, datos);
    else await API.cotizacionesRef.crear(datos);
    cerrarModal('modalCotizacionRef');
    showToast(cotizacionRefEditando ? 'Precio corregido' : 'Precio agregado', 'ok');
    cotizacionRefEditando = null;
    cargarCotizacionesRef();
  } catch (err) {
    showToast(err.message || 'No se pudo guardar el precio', 'err');
  }
}

async function eliminarCotizacionRef(id) {
  const c = cotizacionesRefLista.find(x => Number(x.id) === Number(id));
  if (!c || !await ventanaConfirmar(`¿Eliminar "${c.equipo} · ${c.trabajo}" de las cotizaciones aproximadas?`, { peligro: true })) return;
  try {
    await API.cotizacionesRef.eliminar(id);
    showToast('Precio eliminado', 'ok');
    cargarCotizacionesRef();
  } catch (err) {
    showToast(err.message || 'No se pudo eliminar el precio', 'err');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // mostrarPanelTaller (js/atajos.js) avisa cada vez que se entra a una pestaña del taller
  document.addEventListener('pos:subtab-taller', (e) => {
    if (e.detail?.panel === 'cotizaciones-ref') cargarCotizacionesRef();
  });
  document.getElementById('cotizacionRefBuscar')?.addEventListener('input', pintarCotizacionesRef);
  document.getElementById('btnNuevaCotizacionRef')?.addEventListener('click', () => abrirModalCotizacionRef(null));
  document.getElementById('btnCotizacionRefGuardar')?.addEventListener('click', guardarCotizacionRef);
  document.getElementById('btnCotizacionRefCancelar')?.addEventListener('click', () => cerrarModal('modalCotizacionRef'));
  document.getElementById('modalCotizacionRef')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalCotizacionRef') cerrarModal('modalCotizacionRef');
  });
  document.getElementById('cotizacionRefBody')?.addEventListener('click', (e) => {
    const editar = e.target.closest('[data-cotizacion-editar]');
    if (editar) {
      const c = cotizacionesRefLista.find(x => Number(x.id) === Number(editar.dataset.cotizacionEditar));
      if (c) abrirModalCotizacionRef(c);
      return;
    }
    const eliminar = e.target.closest('[data-cotizacion-eliminar]');
    if (eliminar) eliminarCotizacionRef(eliminar.dataset.cotizacionEliminar);
  });
});
