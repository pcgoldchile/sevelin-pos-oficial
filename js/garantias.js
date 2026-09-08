/* ============================================================
   GARANTÍAS — busca ventas de productos y órdenes de trabajo entregadas
   para revisar el estado de su garantía (vigente/vencida). Ver
   sql/31-garantias.sql y GET /api/garantias/productos|servicios en
   api/index.js (ahí se calcula vence_el/estado_garantia, nunca acá).
   Mismo patrón de sub-pestañas que Página Web (js/pagina-web.js) y de
   buscador con debounce que el Historial de Ventas (js/historial.js).
   ============================================================ */

let garantiasProductosList = [];
let garantiasServiciosList = [];
let filtroEstadoGarantiasProductos = '';
let filtroEstadoGarantiasServicios = '';

const elSubtabsGarantias = document.getElementById('subtabsGarantias');

const elGarantiasProductosBuscar = document.getElementById('garantiasProductosBuscar');
const elGarantiasProductosChips = document.getElementById('garantiasProductosChips');
const elGarantiasProductosTableBody = document.getElementById('garantiasProductosTableBody');
const elBtnRecargarGarantiasProductos = document.getElementById('btnRecargarGarantiasProductos');

const elGarantiasServiciosBuscar = document.getElementById('garantiasServiciosBuscar');
const elGarantiasServiciosChips = document.getElementById('garantiasServiciosChips');
const elGarantiasServiciosTableBody = document.getElementById('garantiasServiciosTableBody');
const elBtnRecargarGarantiasServicios = document.getElementById('btnRecargarGarantiasServicios');

document.addEventListener('DOMContentLoaded', () => {
  if (elSubtabsGarantias) {
    elSubtabsGarantias.addEventListener('click', (e) => {
      const b = e.target.closest('.subtab');
      if (b) mostrarPanelGarantias(b.dataset.subtab);
    });
  }

  /* Buscador con debounce (mismo criterio que el Historial de Ventas,
     js/historial.js): esperar a que la persona termine de escribir antes
     de golpear al servidor, pero Enter busca al tiro. */
  if (elGarantiasProductosBuscar) {
    let temp = null;
    elGarantiasProductosBuscar.addEventListener('input', () => {
      clearTimeout(temp);
      temp = setTimeout(cargarGarantiasProductos, 350);
    });
    elGarantiasProductosBuscar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); clearTimeout(temp); cargarGarantiasProductos(); }
    });
  }
  if (elGarantiasServiciosBuscar) {
    let temp = null;
    elGarantiasServiciosBuscar.addEventListener('input', () => {
      clearTimeout(temp);
      temp = setTimeout(cargarGarantiasServicios, 350);
    });
    elGarantiasServiciosBuscar.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); clearTimeout(temp); cargarGarantiasServicios(); }
    });
  }

  if (elGarantiasProductosChips) {
    elGarantiasProductosChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        filtroEstadoGarantiasProductos = chip.dataset.estado || '';
        elGarantiasProductosChips.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
        cargarGarantiasProductos();
      });
    });
  }
  if (elGarantiasServiciosChips) {
    elGarantiasServiciosChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        filtroEstadoGarantiasServicios = chip.dataset.estado || '';
        elGarantiasServiciosChips.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
        cargarGarantiasServicios();
      });
    });
  }

  if (elBtnRecargarGarantiasProductos) elBtnRecargarGarantiasProductos.addEventListener('click', cargarGarantiasProductos);
  if (elBtnRecargarGarantiasServicios) elBtnRecargarGarantiasServicios.addEventListener('click', cargarGarantiasServicios);
});

function mostrarPanelGarantias(nombre) {
  document.querySelectorAll('#subtabsGarantias .subtab').forEach(b => {
    b.classList.toggle('activo', b.dataset.subtab === nombre);
  });
  document.querySelectorAll('[data-panel-garantias]').forEach(p => {
    p.classList.toggle('activo', p.dataset.panelGarantias === nombre);
  });

  if (nombre === 'productos') cargarGarantiasProductos();
  if (nombre === 'servicios') cargarGarantiasServicios();
  if (nombre === 'por-vencer') cargarGarantiasPorVencer();
}

function badgeEstadoGarantia(estado) {
  if (estado === 'VIGENTE') return '<span class="badge badge-green">✅ Vigente</span>';
  if (estado === 'VENCIDA') return '<span class="badge badge-red">⌛ Vencida</span>';
  return '<span class="badge badge-soft">—</span>';
}

/* ---------- Productos ---------- */

async function cargarGarantiasProductos() {
  if (!tokenActual()) return;
  const q = elGarantiasProductosBuscar?.value.trim() || '';
  if (elGarantiasProductosTableBody) {
    elGarantiasProductosTableBody.innerHTML = '<tr class="empty-row"><td colspan="8">Buscando…</td></tr>';
  }

  try {
    garantiasProductosList = await API.garantias.productos(q, filtroEstadoGarantiasProductos);
    renderGarantiasProductosTabla(garantiasProductosList);
  } catch (err) {
    console.error('Error al cargar garantías de productos:', err.message || err);
    showToast(err.message || 'No se pudieron cargar las garantías', 'err');
    if (elGarantiasProductosTableBody) {
      elGarantiasProductosTableBody.innerHTML = `<tr class="empty-row"><td colspan="8">${escHtml(err.message || 'Error al cargar')}</td></tr>`;
    }
  }
}

function renderGarantiasProductosTabla(lista) {
  if (!elGarantiasProductosTableBody) return;

  if (!lista || lista.length === 0) {
    elGarantiasProductosTableBody.innerHTML = '<tr class="empty-row"><td colspan="8">Sin resultados para este filtro.</td></tr>';
    return;
  }

  elGarantiasProductosTableBody.innerHTML = lista.map(it => {
    const skuSn = [it.sku, it.serial_number].filter(Boolean).map(escHtml).join(' · ') || '—';
    const condicion = it.condicion === 'reacondicionado' ? '♻️ Reacondicionado' : (it.condicion === 'nuevo' ? '🆕 Nuevo' : '—');
    return `<tr>
      <td>${escHtml(it.numero_orden || `#${it.venta_id}`)}</td>
      <td>${it.fecha_venta ? tsAChile(it.fecha_venta) : '—'}</td>
      <td>${escHtml(it.nombre)}${it.cantidad > 1 ? ` × ${it.cantidad}` : ''}</td>
      <td>${skuSn}</td>
      <td>${condicion}</td>
      <td>${it.meses_garantia} mes(es)</td>
      <td>${it.vence_el || '—'}</td>
      <td>${badgeEstadoGarantia(it.estado_garantia)}</td>
    </tr>`;
  }).join('');
}

/* ---------- Servicios (Órdenes de Trabajo entregadas) ---------- */

async function cargarGarantiasServicios() {
  if (!tokenActual()) return;
  const q = elGarantiasServiciosBuscar?.value.trim() || '';
  if (elGarantiasServiciosTableBody) {
    elGarantiasServiciosTableBody.innerHTML = '<tr class="empty-row"><td colspan="7">Buscando…</td></tr>';
  }

  try {
    garantiasServiciosList = await API.garantias.servicios(q, filtroEstadoGarantiasServicios);
    renderGarantiasServiciosTabla(garantiasServiciosList);
  } catch (err) {
    console.error('Error al cargar garantías de servicios:', err.message || err);
    showToast(err.message || 'No se pudieron cargar las garantías', 'err');
    if (elGarantiasServiciosTableBody) {
      elGarantiasServiciosTableBody.innerHTML = `<tr class="empty-row"><td colspan="7">${escHtml(err.message || 'Error al cargar')}</td></tr>`;
    }
  }
}

function renderGarantiasServiciosTabla(lista) {
  if (!elGarantiasServiciosTableBody) return;

  if (!lista || lista.length === 0) {
    elGarantiasServiciosTableBody.innerHTML = '<tr class="empty-row"><td colspan="7">Sin resultados para este filtro.</td></tr>';
    return;
  }

  elGarantiasServiciosTableBody.innerHTML = lista.map(o => {
    const equipo = [o.dispositivo_categoria, o.dispositivo_modelo].filter(Boolean).map(escHtml).join(' · ') || '—';
    return `<tr>
      <td>${escHtml(o.numero_ot)}</td>
      <td>${escHtml(o.cliente_nombre || '—')}</td>
      <td>${equipo}</td>
      <td>${o.fecha_entrega ? tsAChile(o.fecha_entrega) : '—'}</td>
      <td>${o.meses_garantia} mes(es)</td>
      <td>${o.vence_el || '—'}</td>
      <td>${badgeEstadoGarantia(o.estado_garantia)}</td>
    </tr>`;
  }).join('');
}

/* ============================================================
   POR VENCER — Garantías → ⏰ Por vencer
   ------------------------------------------------------------
   El resto del módulo Garantías responde "¿esto está cubierto?" cuando
   alguien llega con un problema. Esta pestaña da vuelta la pregunta:
   ¿a quién le vence pronto y todavía no le avisamos?

   El envío es manual por WhatsApp, no automático: es el canal real de
   Sevelin y el correo está bloqueado hasta verificar el dominio en
   Resend. El panel arma la lista y redacta el mensaje; el click lo da
   el dueño. Cuando haya correo, el mismo endpoint sirve para
   automatizarlo — la lista ya viene calculada del servidor.

   Nada de esto se calcula acá: vence_el, días restantes y el próximo
   vencimiento vienen de GET /api/garantias/por-vencer.
   ============================================================ */

let porVencerDias = 30;
let porVencerDatos = null;

const elPorVencerChips = document.getElementById('porVencerChips');
const elPorVencerIncluirAvisados = document.getElementById('porVencerIncluirAvisados');
const elPorVencerResumen = document.getElementById('porVencerResumen');
const elPorVencerTableBody = document.getElementById('porVencerTableBody');

document.addEventListener('DOMContentLoaded', () => {
  elPorVencerChips?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    porVencerDias = Number(chip.dataset.dias) || 30;
    elPorVencerChips.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
    cargarGarantiasPorVencer();
  });
  elPorVencerIncluirAvisados?.addEventListener('click', cargarGarantiasPorVencer);
  document.getElementById('btnRecargarPorVencer')?.addEventListener('click', cargarGarantiasPorVencer);

  /* Delegación: la tabla se repinta entera en cada carga, así que los
     listeners no pueden colgar de las filas. */
  elPorVencerTableBody?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-aviso]');
    if (btn) marcarAvisoGarantia(btn.dataset.tipo, btn.dataset.id, btn.dataset.aviso === 'marcar');
  });
});

async function cargarGarantiasPorVencer() {
  if (!elPorVencerTableBody) return;
  elPorVencerTableBody.innerHTML = '<tr class="empty-row"><td colspan="6">Cargando…</td></tr>';
  try {
    const incluir = elPorVencerIncluirAvisados?.checked ? 1 : 0;
    porVencerDatos = await API.garantias.porVencer(porVencerDias, incluir);
    renderGarantiasPorVencer();
  } catch (err) {
    elPorVencerTableBody.innerHTML = '<tr class="empty-row"><td colspan="6">No se pudo cargar.</td></tr>';
    showToast(err.message || 'No se pudieron cargar las garantías por vencer', 'err');
  }
}

/* Mensaje de WhatsApp. Es POSTVENTA, no publicidad: le recuerda al
   cliente algo que compró y un derecho que tiene, con fecha concreta.
   Por eso no lleva ofertas ni links de catálogo — meter promoción acá
   convierte un servicio en spam y quema el canal. */
function mensajeAvisoGarantia(fila) {
  /* Solo el primer nombre, y solo letras: el campo `cliente` es texto
     libre y suele traer cosas que no van en un saludo ("Juan (debe
     5000)", "María - vecina"). Mejor saludar sin nombre que mandar un
     mensaje que se lea como una nota interna. */
  const nombre = (fila.cliente || '')
    .trim().split(/\s+/)[0]
    .replace(/[^\p{L}'-]/gu, '');
  const saludo = nombre.length >= 2 ? `Hola ${nombre}` : 'Hola';
  const dias = fila.dias_restantes;
  const cuando = dias <= 0 ? 'vence hoy'
    : dias === 1 ? 'vence mañana'
      : `vence en ${dias} días (el ${fila.vence_el})`;
  return `${saludo}, te escribimos de Sevelin 👋

La garantía de tu ${fila.detalle} ${cuando}.

Si notaste algo raro —que se apague solo, que caliente, que ande lento, lo que sea— tráelo antes de esa fecha y lo revisamos sin costo. Si anda todo bien, no tienes que hacer nada.

Cualquier duda, respóndenos por acá.`;
}

function renderGarantiasPorVencer() {
  const d = porVencerDatos;
  if (!d) return;

  /* Resumen honesto: decir "hay 12 por avisar" no sirve si a 11 no se
     les puede escribir. El teléfono se empezó a registrar en v52, así
     que las ventas viejas no lo tienen. */
  if (elPorVencerResumen) {
    if (!d.total) {
      const proximo = d.proximo_vencimiento
        ? `La garantía vigente más próxima vence el <b>${escHtml(d.proximo_vencimiento)}</b>, en ${d.dias_al_proximo} días. Esta lista se va a llenar sola cuando falten menos de ${d.dias}.`
        : 'Todavía no hay ninguna garantía vigente registrada.';
      elPorVencerResumen.innerHTML = `<p class="subtitle">✅ Nadie por avisar en los próximos ${d.dias} días. ${proximo}</p>`;
    } else {
      elPorVencerResumen.innerHTML = `
        <p class="subtitle">
          <b>${d.total}</b> ${d.total === 1 ? 'garantía vence' : 'garantías vencen'} en los próximos ${d.dias} días.
          ${d.conTelefono} ${d.conTelefono === 1 ? 'tiene' : 'tienen'} WhatsApp registrado.
          ${d.sinTelefono ? `<b>${d.sinTelefono} no ${d.sinTelefono === 1 ? 'lo tiene' : 'lo tienen'}</b>: a esos hay que buscarlos a mano, y por eso conviene registrar el WhatsApp en cada venta nueva.` : ''}
        </p>`;
    }
  }

  if (!d.filas.length) {
    elPorVencerTableBody.innerHTML = `<tr class="empty-row"><td colspan="6">Nada por avisar en esta ventana.</td></tr>`;
    return;
  }

  elPorVencerTableBody.innerHTML = d.filas.map(f => {
    const dias = f.dias_restantes;
    const urgencia = dias <= 7 ? 'badge-red' : dias <= 15 ? 'badge-gold' : 'badge-blue';
    const cuando = dias <= 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`;
    const telefono = String(f.cliente_telefono || '').replace(/\D/g, '');
    const enlace = telefono
      ? `<a class="btn btn-outline btn-sm" target="_blank" rel="noopener noreferrer"
            href="https://wa.me/${escHtml(telefono)}?text=${encodeURIComponent(mensajeAvisoGarantia(f))}"
            title="Abre WhatsApp con el mensaje ya escrito">📲 Avisar</a>`
      : '<span class="fila-meta">sin WhatsApp</span>';
    const marcar = f.aviso_garantia_en
      ? `<button class="btn btn-outline btn-sm" data-aviso="deshacer" data-tipo="${escHtml(f.tipo)}" data-id="${escHtml(String(f.id))}"
           title="Avisado el ${escHtml(String(f.aviso_garantia_en).slice(0, 10))} — click para deshacer">✔️ Avisado</button>`
      : `<button class="btn btn-outline btn-sm" data-aviso="marcar" data-tipo="${escHtml(f.tipo)}" data-id="${escHtml(String(f.id))}"
           title="Marcar como avisado">Marcar avisado</button>`;

    return `
      <tr>
        <td><span class="badge ${urgencia}">${escHtml(cuando)}</span><br><small class="fila-meta">${escHtml(f.vence_el)}</small></td>
        <td>${escHtml(f.cliente || 'Sin nombre')}</td>
        <td>${escHtml(f.detalle || '')}${f.serial_number ? `<br><small class="fila-meta">S/N ${escHtml(f.serial_number)}</small>` : ''}</td>
        <td>${escHtml(f.referencia)}<br><small class="fila-meta">${escHtml(f.fecha_inicio || '')}</small></td>
        <td>${f.meses_garantia} meses${f.condicion ? `<br><small class="fila-meta">${escHtml(f.condicion)}</small>` : ''}</td>
        <td style="text-align:right;">
          <div class="cell-actions" style="justify-content:flex-end;">${enlace}${marcar}</div>
        </td>
      </tr>`;
  }).join('');
}

async function marcarAvisoGarantia(tipo, id, marcar) {
  try {
    await API.garantias.marcarAviso(tipo, id, marcar);
    showToast(marcar ? 'Marcado como avisado' : 'Aviso deshecho', 'ok');
    cargarGarantiasPorVencer();
  } catch (err) {
    showToast(err.message || 'No se pudo guardar el aviso', 'err');
  }
}
