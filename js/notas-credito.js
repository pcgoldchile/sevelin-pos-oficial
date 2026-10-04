/* ============================================================
   NOTAS DE CRÉDITO RECIBIDAS Y PROVEEDORES DEL SII (v120, sql/85)
   ------------------------------------------------------------
   Pedido del dueño (04-10-2026): "hacer seguimiento a quienes están haciendo
   notas de crédito ... para evitarme sorpresas de proveedores que dan la
   factura y luego la nota de crédito silenciosamente".

   El robot del RCV (sql/51) ya trae del SII cada documento recibido. Acá:
   · Chip "notas de crédito sin revisar" en el encabezado (solo si hay).
     Cada una se marca "La esperaba" o "No la esperaba", con una nota.
   · La misma lista, siempre a mano, en Finanzas → Gastos.
   · En la compra de un producto: al escribir el proveedor se propone su
     RUT, se avisa si ese proveedor ya emitió notas de crédito y, con el N°
     de factura, se busca la factura en el SII.

   Solo lectura del SII: el POS no acepta ni reclama nada.
   ============================================================ */

let notasCreditoSii = null;          // respuesta de GET /finanzas/sii/notas-credito
let temporizadorFacturaSii = null;
let turnoFacturaSii = 0;

document.addEventListener('DOMContentLoaded', () => {
  ['btnNotasCredito', 'btnVerNotasCredito'].forEach(id =>
    document.getElementById(id)?.addEventListener('click', abrirNotasCredito));
  document.getElementById('btnCerrarNotasCredito')?.addEventListener('click', () => cerrarModal('modalNotasCredito'));
  document.getElementById('notasCreditoLista')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-revisar-nc]');
    if (!b) return;
    const id = Number(b.dataset.id);
    const revision = b.dataset.revisarNc === 'deshacer' ? null : b.dataset.revisarNc;
    const nota = document.querySelector(`[data-nota-nc="${id}"]`)?.value || '';
    revisarNotaCredito(id, revision, nota);
  });

  // La compra de un producto: RUT propuesto, aviso del proveedor y factura en el SII
  document.getElementById('ingProveedor')?.addEventListener('input', () => { proponerRutDeProveedor(); avisarProveedorDeCompra(); });
  document.getElementById('ingProveedor')?.addEventListener('change', () => { proponerRutDeProveedor(); avisarProveedorDeCompra(); });
  document.getElementById('ingProveedorRut')?.addEventListener('input', avisarProveedorDeCompra);
  document.getElementById('ingProveedorRut')?.addEventListener('blur', (e) => {
    const rut = rutConGuion(e.target.value);
    if (rut) e.target.value = rut;
  });
  document.getElementById('ingReferencia')?.addEventListener('input', avisarProveedorDeCompra);
});

document.addEventListener('pos:sesion-iniciada', () => {
  const btn = document.getElementById('btnNotasCredito');
  if (!esAdmin()) { if (btn) btn.hidden = true; return; }
  actualizarAvisoNotasCredito();
});

/* '77.398.220-1' o '773982201' → '77398220-1' (el formato del SII). '' si no alcanza a ser un RUT. */
function rutConGuion(valor) {
  const limpio = String(valor || '').replace(/[^0-9kK]/g, '').toUpperCase().replace(/^0+/, '');
  return limpio.length >= 8 ? `${limpio.slice(0, -1)}-${limpio.slice(-1)}` : '';
}

async function actualizarAvisoNotasCredito() {
  const btn = document.getElementById('btnNotasCredito');
  const texto = document.getElementById('textoNotasCredito');
  if (!tokenActual() || !esAdmin()) return;
  try {
    notasCreditoSii = await API.balance.siiNotasCredito();
  } catch (err) {
    // Silencioso: sondeo de fondo. Sin la migración 85, simplemente no hay aviso.
    console.error('Error al revisar las notas de crédito recibidas:', err.message || err);
    if (btn) btn.hidden = true;
    return;
  }
  poblarProveedoresSii();
  const n = Number(notasCreditoSii?.sin_revisar) || 0;
  if (btn && texto) {
    texto.textContent = `${n} nota(s) de crédito sin revisar`;
    btn.title = 'Notas de crédito que te emitieron tus proveedores: le restan crédito fiscal al mes';
    btn.hidden = n === 0;
  }
  if (document.getElementById('modalNotasCredito')?.classList.contains('show')) pintarNotasCredito();
}

/* Los proveedores que ya te facturaron, para elegirlos al escribir una compra. */
function poblarProveedoresSii() {
  const lista = document.getElementById('listaProveedoresSii');
  if (!lista || !notasCreditoSii) return;
  lista.innerHTML = (notasCreditoSii.proveedores || []).slice(0, 300)
    .map(p => `<option value="${escHtml(p.razon_social)}">${escHtml(p.rut)}</option>`).join('');
}

async function abrirNotasCredito() {
  document.getElementById('modalNotasCredito')?.classList.add('show');
  pintarNotasCredito();
  await actualizarAvisoNotasCredito();
}

function pintarNotasCredito() {
  const cont = document.getElementById('notasCreditoLista');
  const resumen = document.getElementById('notasCreditoResumen');
  const tabla = document.getElementById('notasCreditoProveedores');
  if (!cont) return;
  const c = notasCreditoSii;
  if (!c) { cont.innerHTML = '<p class="modal-hint">Cargando…</p>'; return; }

  const notas = c.notas || [];
  const desde = c.desde ? `${c.desde.slice(4, 6)}-${c.desde.slice(0, 4)}` : null;
  if (resumen) {
    const sync = c.ultimaSync ? ` Datos del SII al ${tsAChile(c.ultimaSync)}.` : '';
    resumen.textContent = notas.length
      ? `${notas.length} nota(s) de crédito recibida(s) por ${fmtCLP(c.total_notas)}: te restaron ${fmtCLP(c.iva_notas)} de crédito fiscal.${desde ? ` El POS tiene el registro del SII desde ${desde}.` : ''}${sync}`
      : `Ningún proveedor te ha emitido notas de crédito${desde ? ` desde ${desde}` : ''}.${sync}`;
  }

  cont.innerHTML = notas.length ? notas.map(d => {
    const etiqueta = d.revision === 'esperada' ? '<span class="pend-etiqueta hecho">La esperaba</span>'
      : d.revision === 'no_esperada' ? '<span class="pend-etiqueta vencido">No la esperaba</span>'
      : '<span class="pend-etiqueta pronto">Sin revisar</span>';
    return `
      <div class="pend-fila nc-fila">
        <div class="pend-cuerpo">
          <strong>${escHtml(d.razon_social || d.rut)} · ${fmtCLP(d.total)}</strong>
          <small>Nota de crédito N° ${escHtml(String(d.folio))} · ${fechaCortaAviso(d.fecha_doc)} · RUT ${escHtml(d.rut)} · IVA ${fmtCLP(d.iva)}</small>
          <span class="pend-etiquetas">${etiqueta}${d.estado && d.estado !== 'REGISTRO' ? `<span class="pend-etiqueta">${escHtml(d.estado)}</span>` : ''}</span>
          ${d.revision
            ? (d.revisado_nota ? `<small>${escHtml(d.revisado_nota)}</small>` : '')
            : `<input type="text" class="nc-nota" data-nota-nc="${Number(d.id)}" maxlength="200" placeholder="Nota (opcional): por qué te la hicieron">`}
        </div>
        <div class="pend-acciones">
          ${d.revision
            ? `<button type="button" class="btn btn-ghost btn-sm" data-revisar-nc="deshacer" data-id="${Number(d.id)}">Cambiar</button>`
            : `<button type="button" class="btn btn-outline btn-sm" data-revisar-nc="esperada" data-id="${Number(d.id)}" title="Devolviste algo o se anuló una compra">✔ La esperaba</button>
               <button type="button" class="btn btn-red btn-sm" data-revisar-nc="no_esperada" data-id="${Number(d.id)}">⚠️ No la esperaba</button>`}
        </div>
      </div>`;
  }).join('') : '<p class="modal-hint">Nada que revisar.</p>';

  if (tabla) {
    const conNotas = (c.proveedores || []).filter(p => p.notas > 0);
    tabla.innerHTML = conNotas.length ? `
      <p class="modal-hint" style="margin:14px 0 4px;"><strong>Quiénes te han hecho notas de crédito</strong></p>
      <table class="data-table">
        <thead><tr><th>Proveedor</th><th class="num">Facturas</th><th class="num">Notas de crédito</th><th class="num">Monto anulado</th><th>Última</th></tr></thead>
        <tbody>${conNotas.map(p => `
          <tr>
            <td>${escHtml(p.razon_social)}<br><small style="color:var(--text-muted);">${escHtml(p.rut)}</small></td>
            <td class="num">${Number(p.facturas)}</td>
            <td class="num">${Number(p.notas)}${p.no_esperadas ? ` <small style="color:var(--red);">(${Number(p.no_esperadas)} no esperada${p.no_esperadas === 1 ? '' : 's'})</small>` : ''}</td>
            <td class="num">${fmtCLP(p.total_notas)}</td>
            <td>${fechaCortaAviso(p.ultima_nota)}</td>
          </tr>`).join('')}</tbody>
      </table>` : '';
  }
}

async function revisarNotaCredito(id, revision, nota) {
  try {
    await API.balance.revisarNotaCredito(id, { revision, nota: String(nota || '').trim() });
    showToast(revision === null ? 'Quedó sin revisar' : revision === 'esperada' ? 'Anotada: la esperabas' : 'Anotada: no la esperabas', 'ok');
  } catch (err) {
    showToast(err.message || 'No se pudo guardar la revisión', 'err');
  }
  await actualizarAvisoNotasCredito();
  pintarNotasCredito();
}

/* ---------- En la compra de un producto ---------- */

function proveedorSiiDe(nombre, rut) {
  const lista = notasCreditoSii?.proveedores || [];
  if (rut) { const p = lista.find(x => x.rut === rut); if (p) return p; }
  const n = String(nombre || '').trim().toLowerCase();
  return n ? (lista.find(x => String(x.razon_social || '').toLowerCase() === n) || null) : null;
}

/* Al escribir el proveedor: si se conoce su RUT (por una compra anterior o
   porque el nombre es el del SII) y el campo está vacío, se propone. */
function proponerRutDeProveedor() {
  const elRut = document.getElementById('ingProveedorRut');
  const nombre = (document.getElementById('ingProveedor')?.value || '').trim();
  if (!elRut || elRut.value.trim() || !nombre) return;
  const guardado = typeof plazosProveedores !== 'undefined' && plazosProveedores ? plazosProveedores[nombre.toLowerCase()] : null;
  const rut = guardado?.rut || proveedorSiiDe(nombre, '')?.rut || '';
  if (rut) elRut.value = rut;
}

/* Una línea bajo los datos de la compra: si el proveedor ya hizo notas de
   crédito y si la factura escrita está en el SII. */
function avisarProveedorDeCompra() {
  const aviso = document.getElementById('ingAvisoProveedor');
  if (!aviso) return;
  const nombre = (document.getElementById('ingProveedor')?.value || '').trim();
  const rut = rutConGuion(document.getElementById('ingProveedorRut')?.value);
  const folio = String(document.getElementById('ingReferencia')?.value || '').replace(/\D/g, '');
  const p = proveedorSiiDe(nombre, rut);

  let linea = '';
  if (p && p.notas > 0) {
    linea = `<span style="color:var(--red);">⚠️ ${escHtml(p.razon_social)} te ha emitido ${Number(p.notas)} nota(s) de crédito por ${fmtCLP(p.total_notas)} (la última el ${fechaCortaAviso(p.ultima_nota)}). Revisa después que esta factura no termine anulada.</span>`;
  } else if (p) {
    linea = `<span style="color:var(--green);">✔ ${escHtml(p.razon_social)}: ${Number(p.facturas)} factura(s) en el SII y ninguna nota de crédito.</span>`;
  }
  aviso.innerHTML = linea;
  aviso.dataset.base = linea;

  clearTimeout(temporizadorFacturaSii);
  if (!rut || !folio) return;
  temporizadorFacturaSii = setTimeout(() => buscarFacturaEnSii(rut, folio), 600);
}

async function buscarFacturaEnSii(rut, folio) {
  const aviso = document.getElementById('ingAvisoProveedor');
  if (!aviso) return;
  const turno = ++turnoFacturaSii;
  try {
    const r = await API.balance.siiFactura(rut, folio);
    if (turno !== turnoFacturaSii) return;   // ya se escribió otra cosa
    const base = aviso.dataset.base || '';
    const f = r?.factura;
    const linea = f
      ? `<span style="color:var(--green);">✔ La factura N° ${escHtml(String(f.folio))} está en el SII: ${fmtCLP(f.total)} (IVA ${fmtCLP(f.iva)}), del ${fechaCortaAviso(f.fecha_doc)}${f.estado && f.estado !== 'REGISTRO' ? `, estado ${escHtml(f.estado)}` : ''}.</span>`
      : `<span>La factura N° ${escHtml(folio)} todavía no aparece en el SII con ese RUT. El POS se pone al día con el SII una vez al día; si mañana sigue sin aparecer, revisa el número.</span>`;
    aviso.innerHTML = [base, linea].filter(Boolean).join('<br>');
  } catch (err) {
    // Un RUT a medio escribir da error: no vale la pena interrumpir por eso.
    console.error('No se pudo buscar la factura en el SII:', err.message || err);
  }
}
