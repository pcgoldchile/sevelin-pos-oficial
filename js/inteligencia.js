// ==========================================
// INTELIGENCIA.JS — Finanzas → Inteligencia
// ------------------------------------------
// Fase 1 del plan de crecimiento (docs/PLAN-CRECIMIENTO-2026.md): que
// cada número con el que se decide sea real.
//
// Responde tres preguntas que ningún otro panel respondía:
//   1. ¿Qué producto deja MÁS MARGEN? (no el que más factura)
//   2. ¿Cuánta plata hay dormida en stock que nunca rotó?
//   3. ¿Qué datos del catálogo están mal y ensucian todos los reportes?
//
// TODO EL CÁLCULO VIVE EN EL SERVIDOR (GET /api/pos/inteligencia).
// Acá solo se pinta: así el Excel, el panel y cualquier informe futuro
// no pueden contradecirse entre sí. Mismo criterio que Utilidades.
//
// OJO CON LOS SERVICIOS TÉCNICOS: tienen costo $0 legítimo (son mano de
// obra), así que su margen es 100% por definición. El backend los marca
// con `esServicio` y los deja fuera de los cajones — acá se muestran
// igual, pero etiquetados, para no leerlos como si fueran productos.
// ==========================================

let intelInforme = null;                          // último informe recibido
let intelRango = { desde: null, hasta: null, etiqueta: 'Todo el histórico' };
let intelCajonActivo = 'ancla';

/* Los cuatro cajones del catálogo. El corte no es un número inventado:
   el servidor compara cada producto contra la MEDIANA de rotación y de
   margen del propio catálogo vendido (ver `cortes` en la respuesta). */
const INTEL_CAJONES = [
  { clave: 'ancla',  titulo: 'Ancla',   emoji: '⚓', color: 'green',  regla: 'Rota bien y deja buen margen', accion: 'Acá va la plata de publicidad. Nunca bajarles el precio.' },
  { clave: 'gancho', titulo: 'Gancho',  emoji: '🪝', color: 'blue',   regla: 'Rota bien pero deja poco',     accion: 'Traen gente. Se anuncian, pero no se vive de ellos.' },
  { clave: 'joya',   titulo: 'Joya',    emoji: '💎', color: 'gold',   regla: 'Deja buen margen pero no rota', accion: 'Problema de visibilidad, no de precio. Mostrarlos más.' },
  { clave: 'lastre', titulo: 'Lastre',  emoji: '🪨', color: 'red',    regla: 'Ni rota ni deja margen',       accion: 'Liquidar y no reponer.' }
];

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-rango-intel]').forEach(btn => {
    btn.addEventListener('click', () => aplicarRangoInteligencia(btn.dataset.rangoIntel));
  });
  document.getElementById('btnIntelRangoPersonalizado')?.addEventListener('click', aplicarRangoIntelPersonalizado);
  document.getElementById('btnIntelRecargar')?.addEventListener('click', () => cargarInteligencia());

  document.getElementById('intelCajonesTabs')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cajon]');
    if (!b) return;
    intelCajonActivo = b.dataset.cajon;
    pintarCajonesInteligencia();
  });
});

/* ============================================================
   PERÍODO
   Reutiliza calcularRango() de balance.js (mismo cálculo de zona
   horaria de Chile que ya usa Balance y Utilidades) — no se duplica.
   "Todo" es propio de este panel: con pocos meses de historia, el
   histórico completo es la vista más útil y es la que abre por defecto.
   ============================================================ */
function aplicarRangoInteligencia(clave) {
  if (clave === 'todo') {
    intelRango = { desde: null, hasta: null, etiqueta: 'Todo el histórico' };
  } else if (typeof calcularRango === 'function') {
    const r = calcularRango(clave);
    intelRango = { desde: r.desde, hasta: r.hasta, etiqueta: r.etiqueta };
    const iDesde = document.getElementById('intelDesde');
    const iHasta = document.getElementById('intelHasta');
    if (iDesde) iDesde.value = r.desde;
    if (iHasta) iHasta.value = r.hasta;
  }
  document.querySelectorAll('[data-rango-intel]').forEach(b => {
    b.classList.toggle('activo', b.dataset.rangoIntel === clave);
  });
  cargarInteligencia();
}

function aplicarRangoIntelPersonalizado() {
  const desde = document.getElementById('intelDesde')?.value;
  const hasta = document.getElementById('intelHasta')?.value;
  if (!desde || !hasta) return showToast('Elige las dos fechas', 'error');
  if (desde > hasta) return showToast('La fecha "desde" no puede ser posterior a "hasta"', 'error');
  intelRango = { desde, hasta, etiqueta: `${desde} a ${hasta}` };
  document.querySelectorAll('[data-rango-intel]').forEach(b => b.classList.remove('activo'));
  cargarInteligencia();
}

/* ============================================================
   CARGA
   ============================================================ */
async function cargarInteligencia() {
  const cuerpo = document.getElementById('intelContenido');
  if (cuerpo) cuerpo.classList.add('cargando');
  try {
    intelInforme = await API.inteligencia.obtener(intelRango.desde, intelRango.hasta);
    pintarInteligencia();
  } catch (err) {
    showToast(err.message || 'No se pudo cargar la inteligencia del negocio', 'error');
  } finally {
    if (cuerpo) cuerpo.classList.remove('cargando');
  }
}

function pintarInteligencia() {
  if (!intelInforme) return;
  const inf = intelInforme;

  const etiqueta = document.getElementById('intelPeriodo');
  if (etiqueta) {
    const rango = inf.resumen.primeraVenta
      ? `${inf.resumen.primeraVenta} → ${inf.resumen.ultimaVenta}`
      : 'sin ventas en el período';
    etiqueta.textContent = `${intelRango.etiqueta} · ${rango}`;
  }

  pintarAlertasInteligencia();
  pintarResumenInteligencia();
  pintarCajonesInteligencia();
  pintarRankingInteligencia();
  pintarCapitalDormido();
  pintarAuditoriaCatalogo();
  pintarMesesInteligencia();
}

/* ---------- Alertas: lo primero que hay que ver ---------- */
function pintarAlertasInteligencia() {
  const cont = document.getElementById('intelAlertas');
  if (!cont) return;
  const alertas = intelInforme.alertas || [];
  if (!alertas.length) {
    cont.innerHTML = '<p class="subtitle">Sin alertas: los datos del período no muestran problemas de costo, stock ni catálogo.</p>';
    return;
  }
  cont.innerHTML = alertas.map(a => `
    <div class="intel-alerta intel-alerta-${a.nivel === 'alta' ? 'alta' : 'media'}">
      <div class="intel-alerta-titulo">${a.nivel === 'alta' ? '🔴' : '🟡'} ${escHtml(a.titulo)}</div>
      <div class="intel-alerta-detalle">${escHtml(a.detalle)}</div>
      ${a.monto ? `<div class="intel-alerta-monto">${fmtCLP(a.monto)} en juego</div>` : ''}
    </div>
  `).join('');
}

/* ---------- KPIs del período ---------- */
function pintarResumenInteligencia() {
  const r = intelInforme.resumen;
  const s = intelInforme.stock;
  const set = (id, valor) => { const el = document.getElementById(id); if (el) el.textContent = valor; };

  set('intelKpiIngresos', fmtCLP(r.ingresos));
  set('intelKpiIngresosFoot', `${r.ventas} ventas`);
  set('intelKpiUtilidad', fmtCLP(r.utilidad));
  /* El margen se muestra como RANGO, no como una cifra sola, cuando una
     parte de la utilidad viene de ítems sin costo cargado. Publicar
     "30,9%" a secas se lee como exacto y puede estar muy inflado: parte
     de eso es mano de obra (correcto) y parte son productos vendidos sin
     costo (no correcto). El piso lo calcula el servidor. */
  set('intelKpiMargen', r.utilidadSinCostoPct >= 5
    ? `margen entre ${r.margenPisoPct.toFixed(1)}% y ${r.margenPct.toFixed(1)}%`
    : `${r.margenPct.toFixed(1)}% de margen`);
  const aviso = document.getElementById('intelAvisoMargen');
  if (aviso) {
    if (r.utilidadSinCostoPct >= 5) {
      aviso.textContent = `⚠️ ${fmtCLP(r.utilidadSinCosto)} — el ${r.utilidadSinCostoPct.toFixed(0)}% de la utilidad — viene de ítems vendidos sin costo cargado que el sistema NO puede confirmar como servicio. Los servicios reconocidos ya están descontados de esta cifra: ahí el costo $0 es correcto. Lo que queda son productos cobrados sin su costo (utilidad ficticia) y servicios escritos a mano que el POS no distingue de un producto. Por eso el margen va como rango: el real está entre esos dos números, y más cerca del alto. Las dos alertas de arriba separan un caso del otro.`;
      aviso.hidden = false;
    } else {
      aviso.hidden = true;
    }
  }
  set('intelKpiTicket', fmtCLP(r.ticket));
  set('intelKpiItems', `${r.itemsPorVenta.toFixed(2)} productos por venta`);
  set('intelKpiDormido', fmtCLP(s.capitalDormido));
  set('intelKpiDormidoFoot', s.capital
    ? `${Math.round((100 * s.capitalDormido) / s.capital)}% de ${fmtCLP(s.capital)} en stock`
    : 'sin stock valorizado');
  set('intelKpiSinCliente', `${r.sinCliente} de ${r.ventas}`);
  /* La recompra solo se puede medir con el teléfono: el nombre es texto
     libre y "Juan" no se une con "juan p.". Mientras no haya teléfonos
     cargados, el pie dice qué falta en vez de mostrar un 0% engañoso. */
  set('intelKpiSinClienteFoot', r.conTelefono
    ? `${r.clientesUnicos} clientes con WhatsApp · ${r.clientesQueRepiten} volvieron a comprar (${r.recompraPct.toFixed(0)}% de recompra)`
    : 'Sin nombre ni WhatsApp no hay recompra ni postventa posible');

  const conc = intelInforme.concentracion;
  set('intelKpiConcentracion', `${conc.top10.toFixed(0)}%`);
  set('intelKpiConcentracionFoot', `del margen lo hacen 10 productos (top 5: ${conc.top5.toFixed(0)}%)`);
}

/* ---------- Los cuatro cajones ---------- */
function pintarCajonesInteligencia() {
  const tabs = document.getElementById('intelCajonesTabs');
  const cuerpo = document.getElementById('intelCajonCuerpo');
  if (!tabs || !cuerpo || !intelInforme) return;

  const conteo = intelInforme.cajones.conteo;
  tabs.innerHTML = INTEL_CAJONES.map(c => `
    <button class="btn btn-outline btn-sm ${c.clave === intelCajonActivo ? 'activo' : ''}" data-cajon="${c.clave}">
      ${c.emoji} ${c.titulo} <span class="badge badge-soft">${conteo[c.clave] || 0}</span>
    </button>
  `).join('');

  const def = INTEL_CAJONES.find(c => c.clave === intelCajonActivo);
  const filas = intelInforme.cajones[intelCajonActivo] || [];
  const cortes = intelInforme.cortes;

  cuerpo.innerHTML = `
    <p class="subtitle">
      <strong>${escHtml(def.regla)}.</strong> ${escHtml(def.accion)}
      <br>Corte de este período: rota bien = ${cortes.medianaUnidades} o más unidades vendidas;
      buen margen = ${cortes.medianaMargen.toFixed(0)}% o más (mediana del propio catálogo, no un número fijo).
    </p>
    ${filas.length ? `
    <div class="tabla-scroll">
      <table class="data-table">
        <thead><tr><th>Producto</th><th>Unid.</th><th>Vendido</th><th>Margen</th><th>%</th><th>Stock</th></tr></thead>
        <tbody>
          ${filas.map(f => `
            <tr>
              <td>${escHtml(f.nombre || '')}</td>
              <td>${f.unidades}</td>
              <td>${fmtCLP(f.ingresos)}</td>
              <td>${fmtCLP(f.margen)}</td>
              <td>${f.margenPct.toFixed(0)}%</td>
              <td>${f.stock === null ? '—' : f.stock}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>` : '<p class="subtitle">Ningún producto cayó en este cajón en el período.</p>'}
  `;
}

/* ---------- Ranking por margen, con acumulado ---------- */
function pintarRankingInteligencia() {
  const cont = document.getElementById('intelRanking');
  if (!cont) return;
  const filas = (intelInforme.productos || []).slice(0, 20);
  const total = (intelInforme.productos || []).reduce((s, p) => s + p.margen, 0);
  let acumulado = 0;

  cont.innerHTML = `
    <div class="tabla-scroll">
      <table class="data-table">
        <thead><tr><th>#</th><th>Producto</th><th>Unid.</th><th>Vendido</th><th>Margen</th><th>%</th><th>Acum.</th></tr></thead>
        <tbody>
          ${filas.map((f, i) => {
            acumulado += f.margen;
            return `
            <tr>
              <td>${i + 1}</td>
              <td>${escHtml(f.nombre || '')}${f.esServicio ? ' <span class="badge badge-soft">servicio</span>' : ''}</td>
              <td>${f.unidades}</td>
              <td>${fmtCLP(f.ingresos)}</td>
              <td>${fmtCLP(f.margen)}</td>
              <td>${f.margenPct.toFixed(0)}%</td>
              <td>${total ? ((100 * acumulado) / total).toFixed(0) : 0}%</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <p class="subtitle">Ordenado por MARGEN generado, no por monto vendido: un producto puede facturar mucho y dejar poco. Los servicios técnicos van marcados porque su costo $0 es real (mano de obra), no un dato faltante.</p>
  `;
}

/* ---------- Capital dormido ---------- */
function pintarCapitalDormido() {
  const cont = document.getElementById('intelDormido');
  if (!cont) return;
  const s = intelInforme.stock;
  if (!s.dormidos.length) {
    cont.innerHTML = '<p class="subtitle">Todo el stock con existencias registró al menos una venta alguna vez.</p>';
    return;
  }
  cont.innerHTML = `
    <p class="subtitle">
      ${fmtCLP(s.capitalDormido)} inmovilizados en ${s.productosDormidos} productos que <strong>nunca</strong>
      registraron una venta, sobre ${fmtCLP(s.capital)} de stock total valorizado al costo.
      Cada peso acá es un peso que no está comprando lo que sí rota.
    </p>
    <div class="tabla-scroll">
      <table class="data-table">
        <thead><tr><th>ID</th><th>Producto</th><th>Stock</th><th>Costo unit.</th><th>Inmovilizado</th><th>Precio</th></tr></thead>
        <tbody>
          ${s.dormidos.map(p => `
            <tr>
              <td>${p.id}</td>
              <td>${escHtml(p.nombre || '')}</td>
              <td>${p.stock}</td>
              <td>${fmtCLP(p.costo)}</td>
              <td>${fmtCLP(p.valor)}</td>
              <td>${fmtCLP(p.precio)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ---------- Auditoría del catálogo ---------- */
function pintarAuditoriaCatalogo() {
  const cont = document.getElementById('intelAuditoria');
  if (!cont) return;
  const a = intelInforme.auditoria;

  const chip = (etiqueta, n, nota) => `
    <div class="intel-chip ${n ? 'intel-chip-alerta' : ''}">
      <div class="intel-chip-valor">${n}</div>
      <div class="intel-chip-label">${escHtml(etiqueta)}</div>
      ${nota ? `<div class="intel-chip-nota">${escHtml(nota)}</div>` : ''}
    </div>`;

  const tabla = (titulo, filas, extra) => filas.length ? `
    <h4 style="margin:18px 0 6px;">${escHtml(titulo)}</h4>
    <div class="tabla-scroll">
      <table class="data-table">
        <thead><tr><th>ID</th><th>Producto</th><th>SKU</th><th>Costo</th><th>Precio</th>${extra ? '<th>Margen</th>' : ''}</tr></thead>
        <tbody>
          ${filas.map(p => `
            <tr>
              <td>${p.id}</td>
              <td>${escHtml(p.nombre || '')}</td>
              <td>${escHtml(p.sku || '—')}</td>
              <td>${fmtCLP(p.costo)}</td>
              <td>${fmtCLP(p.precio)}</td>
              ${extra ? `<td>${(p.margenPct || 0).toFixed(1)}%</td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>` : '';

  cont.innerHTML = `
    <div class="intel-chips">
      ${chip('sin costo cargado', a.costoCero.length, 'su margen es falso')}
      ${chip('margen bajo 15%', a.margenFlaco.length, 'revisar precio')}
      ${chip('se vende bajo el costo', a.margenNegativo.length, 'pérdida directa')}
      ${chip('sin SKU', a.sinSku, '')}
      ${chip('sin foto', a.sinFoto, 'no se venden')}
      ${chip('sin ficha', a.sinFicha, 'Google no las posiciona')}
      ${chip('sin publicar en la web', a.sinPublicar, '')}
      ${chip('sin peso ni medidas', a.sinMedidas, 'no se puede cotizar envío')}
      ${chip('publicados sin marca', a.sinMarca || 0, 'compiten peor en Google')}
    </div>
    <p class="subtitle">Sobre ${a.totalActivos} productos activos (sin archivados ni borradores). Los servicios técnicos quedan fuera de "sin costo" y "sin medidas": no tienen ni lo uno ni lo otro por naturaleza.</p>
    ${tabla('Productos del catálogo con costo en $0', a.costoCero)}
    ${tabla('Productos publicados con margen bajo 15%', a.margenFlaco, true)}
    ${tabla('Productos cuyo precio está por debajo del costo', a.margenNegativo)}
  `;
}

/* ---------- Evolución mes a mes ---------- */
function pintarMesesInteligencia() {
  const cont = document.getElementById('intelMeses');
  if (!cont) return;
  const meses = intelInforme.meses || [];
  if (!meses.length) { cont.innerHTML = '<p class="subtitle">Sin ventas en el período.</p>'; return; }
  cont.innerHTML = `
    <div class="tabla-scroll">
      <table class="data-table">
        <thead><tr><th>Mes</th><th>Ventas</th><th>Facturado</th><th>Utilidad</th><th>Margen</th><th>Ticket</th></tr></thead>
        <tbody>
          ${meses.map(m => `
            <tr>
              <td>${escHtml(m.mes)}</td>
              <td>${m.ventas}</td>
              <td>${fmtCLP(m.ingresos)}</td>
              <td>${fmtCLP(m.utilidad)}</td>
              <td>${m.margenPct.toFixed(1)}%</td>
              <td>${fmtCLP(m.ticket)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
