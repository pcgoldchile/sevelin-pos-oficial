// ==========================================
// METAS.JS — "🎯 Metas de hoy" al iniciar sesión (27-10-2026)
// ------------------------------------------
// Pedido del dueño: "empiezo el día con la memoria reseteada; deja una opción en
// el POS al loguearme sobre los objetivos y metas". Se abre sola una vez al día
// (solo admin) y después con el chip "🎯 Metas" del encabezado.
// Muestra: la meta del mes y cuánto falta por día, los indicadores de la etapa,
// lo que toca hoy (horario de docs/contenido/HORARIO-Y-PUBLICACION.md), las 3
// reglas del plan (docs/PLAN-ACCION-2026-10-24.md) y los pendientes del dueño.
// ==========================================

/* Lo que toca cada día (0 = domingo). Sale del horario de contenido y del plan.
   Si el plan cambia, se cambia aquí. */
const RUTINA_METAS = {
  0: ['🛌 Descanso: nada grande hoy.', '📊 Si quieres, mira cómo cerró la semana en Finanzas → Informe semanal.'],
  1: ['🗓️ 10:00 · Planifica la semana: el servicio de la semana y 2 productos ganadores (POS → Redes).',
      '🎬 Graba 1 reel de un trabajo real (antes y después, 20 a 40 s).',
      '📣 19:30 · Publica el reel en Instagram y Facebook; TikTok a las 20:30.'],
  2: ['🎬 Si no lo grabaste ayer: el reel de servicio técnico.',
      '📘 Sube 5 productos a Marketplace, de más a menos utilidad.'],
  3: ['🤖 10:30 · El robot de Claude arma las piezas de la semana.',
      '✅ 14:00 a 15:00 · Revisa, aprueba y programa toda la semana (Business Suite y TikTok Studio).',
      '📣 19:30 · Producto ganador 1, con el precio grande.'],
  4: ['📘 Sube 5 productos a Marketplace.', '⭐ Pide opinión en Google a 2 clientes contentos.'],
  5: ['📣 19:30 · Publicación de confianza o educativa.', '📘 Sube 5 productos a Marketplace.'],
  6: ['📸 11:00 · Graba material del local para varias semanas (30 min).',
      '📣 12:00 · Producto ganador 2; el reel de la semana otra vez en TikTok.']
};

const REGLAS_METAS = [
  '📝 Registra <strong>todas</strong> las ventas en el POS, con el origen del cliente.',
  '🧾 Boleta en cada venta.',
  '🛑 No compres mercadería nueva salvo lo que se vendió 2 o más veces en 30 días, o un encargo pagado.'
];

let datosMetas = null;

function claveVistoMetas() { return `metas-visto-${todayISO()}`; }

function barraMeta(valor, meta) {
  const pct = meta > 0 ? Math.min(100, Math.round((valor / meta) * 100)) : 0;
  return `<div class="metas-barra"><span style="width:${pct}%"></span></div>`;
}

function indicadorMeta(titulo, valorTxt, metaTxt, cumple) {
  const tono = cumple === null ? '' : cumple ? 'ok' : 'falta';
  return `<div class="metas-ind ${tono}">
    <span class="metas-ind-tit">${escHtml(titulo)}</span>
    <b>${valorTxt}</b>
    <small>meta ${metaTxt}</small>
  </div>`;
}

function pctTxtMeta(v) { return v === null || v === undefined ? '—' : `${Math.round(v)}%`; }

function pintarMetas() {
  const caja = document.getElementById('metasContenido');
  const d = datosMetas;
  if (!caja || !d) return;
  const m = d.metas, mes = d.mes;
  const dia = new Date(d.hoy + 'T12:00:00').getDay();
  const nombreDia = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][dia];
  const vaBien = mes.proyeccion >= m.venta_mes;

  document.getElementById('metasEtapa').textContent = m.etapa;

  caja.innerHTML = `
    <section class="metas-principal">
      <div class="metas-principal-top">
        <div>
          <span class="metas-label">Venta del mes</span>
          <div class="metas-grande">${fmtCLP(mes.venta)} <small>de ${fmtCLP(m.venta_mes)}</small></div>
        </div>
        <div class="metas-pordia ${mes.falta > 0 ? '' : 'ok'}">
          ${mes.falta > 0
            ? `<span class="metas-label">Para llegar necesitas</span><b>${fmtCLP(Math.ceil(mes.por_dia))}</b><small>por día · quedan ${d.dias_quedan} día(s)</small>`
            : '<b>🎉 Meta del mes cumplida</b>'}
        </div>
      </div>
      ${barraMeta(mes.venta, m.venta_mes)}
      <p class="metas-ritmo ${vaBien ? 'ok' : 'falta'}">${vaBien ? '✅' : '⚠️'} Al ritmo de este mes cierras en <strong>${fmtCLP(Math.round(mes.proyeccion))}</strong>
        (${mes.cantidad} venta(s) en ${d.dia} día(s)).</p>
    </section>

    <section class="metas-inds">
      ${indicadorMeta('Margen', pctTxtMeta(mes.margen), `≥ ${m.margen_min}%`, mes.margen === null ? null : mes.margen >= m.margen_min)}
      ${indicadorMeta('Servicios técnicos', String(mes.servicios), String(m.servicios_mes), mes.servicios >= m.servicios_mes)}
      ${indicadorMeta('Ticket promedio', mes.ticket ? fmtCLP(Math.round(mes.ticket)) : '—', fmtCLP(m.ticket), mes.ticket === null ? null : mes.ticket >= m.ticket)}
      ${indicadorMeta('Ventas con origen', pctTxtMeta(mes.origen_pct), `${m.origen_pct}%`, mes.origen_pct === null ? null : mes.origen_pct >= m.origen_pct)}
      ${indicadorMeta('Ventas con boleta', pctTxtMeta(mes.boleta_pct), '100%', mes.boleta_pct === null ? null : mes.boleta_pct >= 99.5)}
    </section>

    <div class="metas-columnas">
      <section class="metas-bloque">
        <h3>📅 Hoy ${escHtml(nombreDia)} toca</h3>
        <ul>${(RUTINA_METAS[dia] || []).map(t => `<li>${escHtml(t)}</li>`).join('')}</ul>
      </section>
      <section class="metas-bloque">
        <h3>📌 Tus pendientes${d.pendientes_total ? ` (${d.pendientes_total})` : ''}</h3>
        ${d.pendientes.length
          ? `<ul>${d.pendientes.map(p => `<li class="${p.prioridad === 'alta' ? 'alta' : ''}">${escHtml(p.titulo)}${p.fecha_limite ? ` <small>· ${escHtml(fechaCorta(p.fecha_limite))}</small>` : ''}</li>`).join('')}</ul>`
          : '<p class="texto-apagado">Nada pendiente para hoy. 👌</p>'}
        <button type="button" class="btn btn-outline btn-sm" id="btnMetasVerPendientes">Ver y marcar pendientes</button>
      </section>
    </div>

    <section class="metas-bloque metas-reglas">
      <h3>🧭 Las 3 reglas de la etapa</h3>
      <ul>${REGLAS_METAS.map(r => `<li>${r}</li>`).join('')}</ul>
      <small class="texto-apagado">El plan completo está en docs/PLAN-ACCION-2026-10-24.md. Pídele a Claude "¿cómo voy?" cuando quieras el detalle.</small>
    </section>`;
  document.getElementById('btnMetasVerPendientes')?.addEventListener('click', () => {
    cerrarMetas();
    if (typeof abrirPendientes === 'function') abrirPendientes();
  });
}

async function abrirMetas() {
  if (typeof esAdmin === 'function' && !esAdmin()) return;
  const modal = document.getElementById('modalMetas');
  const caja = document.getElementById('metasContenido');
  if (!modal || !caja) return;
  document.getElementById('metasEditar').hidden = true;
  caja.innerHTML = '<p class="modal-hint">Cargando cómo va el mes…</p>';
  modal.classList.add('show');
  try {
    datosMetas = await API.metas.hoy();
    pintarMetas();
  } catch (err) {
    caja.innerHTML = `<p class="modal-hint">No se pudieron cargar las metas: ${escHtml(err.message || '')}</p>`;
  }
  try { localStorage.setItem(claveVistoMetas(), '1'); } catch (_) { /* sin almacenamiento: se vuelve a abrir, no pasa nada */ }
}

function cerrarMetas() {
  document.getElementById('modalMetas')?.classList.remove('show');
}

function abrirEditarMetas() {
  const m = datosMetas?.metas;
  if (!m) return;
  const poner = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  poner('metaEtapa', m.etapa); poner('metaVenta', m.venta_mes); poner('metaMargen', m.margen_min);
  poner('metaServicios', m.servicios_mes); poner('metaTicket', m.ticket); poner('metaOrigen', m.origen_pct);
  document.getElementById('metasEditar').hidden = false;
}

async function guardarMetas() {
  const v = id => document.getElementById(id)?.value;
  try {
    const r = await API.metas.guardar({
      etapa: v('metaEtapa'), venta_mes: v('metaVenta'), margen_min: v('metaMargen'),
      servicios_mes: v('metaServicios'), ticket: v('metaTicket'), origen_pct: v('metaOrigen')
    });
    if (datosMetas) datosMetas.metas = r.metas;
    document.getElementById('metasEditar').hidden = true;
    showToast('Metas guardadas', 'ok');
    abrirMetas();
  } catch (err) {
    showToast(err.message || 'No se pudieron guardar las metas', 'err');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnMetas')?.addEventListener('click', abrirMetas);
  document.getElementById('btnMetasCerrar')?.addEventListener('click', cerrarMetas);
  document.getElementById('btnMetasEditar')?.addEventListener('click', abrirEditarMetas);
  document.getElementById('btnMetasGuardar')?.addEventListener('click', guardarMetas);
  document.getElementById('modalMetas')?.addEventListener('click', (e) => { if (e.target.id === 'modalMetas') cerrarMetas(); });
});

/* Se abre sola la primera vez de cada día, solo para el administrador. */
document.addEventListener('pos:sesion-iniciada', (e) => {
  if (e.detail?.rol !== 'admin') return;
  const chip = document.getElementById('btnMetas');
  if (chip) chip.hidden = false;
  let visto = false;
  try { visto = localStorage.getItem(claveVistoMetas()) === '1'; } catch (_) { /* se abre igual */ }
  if (!visto) setTimeout(abrirMetas, 900);
});
