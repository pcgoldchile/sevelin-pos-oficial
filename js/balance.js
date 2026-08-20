// ==========================================
// BALANCE.JS - Finanzas y Balance
// ------------------------------------------
// Panel único con la salud económica del negocio. Consolida en un solo
// lugar lo que antes había que cruzar a mano entre Historial y Gastos.
//
// DOS CIFRAS QUE NO SON LO MISMO Y CONVIENE NO CONFUNDIR
//
//   · Caja Física  → billetes y monedas que deberían estar en el cajón.
//                    Sirve para el arqueo al cerrar.
//   · Flujo Total  → todo el dinero disponible del negocio, incluyendo
//                    lo cobrado con tarjeta y transferencia.
//
// Un día puede cerrar con caja física baja y flujo alto (se vendió casi
// todo con tarjeta) sin que haya ningún problema. Mezclarlas es lo que
// hace que un arqueo "no cuadre" cuando en realidad está bien.
//
// Los cálculos se hacen en el servidor (GET /api/balance): los costos no
// se envían al rol trabajador, y sumar todas las ventas del mes en el
// navegador sería lento con datos móviles.
// ==========================================

let balanceActual = null;
let rangoBalance = { desde: null, hasta: null, etiqueta: 'Este mes' };
let gastosFijosLista = [];
let editandoGastoFijo = null;

const GRUPOS_GASTO = [
  { valor: 'OPERATIVO',  etiqueta: 'Operativos',        desc: 'Arriendo, servicios, sueldos', color: 'gold' },
  { valor: 'INVENTARIO', etiqueta: 'Inventario',        desc: 'Compra de mercadería',         color: 'blue' },
  { valor: 'INVERSION',  etiqueta: 'Inversión/Capital', desc: 'Activos y herramientas',       color: 'violet' }
];

document.addEventListener('DOMContentLoaded', () => {
  // Sub-pestañas del módulo
  const barra = document.getElementById('subtabsFinanzas');
  if (barra) {
    barra.addEventListener('click', (e) => {
      const b = e.target.closest('.subtab');
      if (b) mostrarPanelFinanzas(b.dataset.subtab);
    });
  }

  // Filtros de período
  document.querySelectorAll('[data-rango]').forEach(btn => {
    btn.addEventListener('click', () => aplicarRango(btn.dataset.rango));
  });
  document.getElementById('btnRangoPersonalizado')?.addEventListener('click', aplicarRangoPersonalizado);

  // Arqueo de caja
  document.getElementById('btnAbrirCaja')?.addEventListener('click', abrirModalAbrirCaja);
  document.getElementById('btnConfirmarAbrirCaja')?.addEventListener('click', confirmarAbrirCaja);
  document.getElementById('btnCancelarAbrirCaja')?.addEventListener('click', () => cerrarModal('modalAbrirCaja'));
  document.getElementById('btnCerrarCaja')?.addEventListener('click', abrirModalCerrarCaja);
  document.getElementById('btnConfirmarCerrarCaja')?.addEventListener('click', confirmarCerrarCaja);
  document.getElementById('btnCancelarCerrarCaja')?.addEventListener('click', () => cerrarModal('modalCerrarCaja'));
  document.getElementById('btnCerrarResultadoArqueo')?.addEventListener('click', () => cerrarModal('modalResultadoArqueo'));
  document.getElementById('btnImprimirArqueo')?.addEventListener('click', () => window.print());
  ['modalAbrirCaja', 'modalCerrarCaja'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => { if (e.target.id === id) cerrarModal(id); });
  });

  // Inyecciones de capital
  document.getElementById('btnNuevaInyeccion')?.addEventListener('click', abrirModalInyeccion);
  document.getElementById('btnGuardarInyeccion')?.addEventListener('click', guardarInyeccion);
  document.getElementById('btnCancelarInyeccion')?.addEventListener('click', () => cerrarModal('modalInyeccion'));

  // Gastos fijos
  document.getElementById('btnNuevoGastoFijo')?.addEventListener('click', () => abrirModalGastoFijo(null));
  document.getElementById('btnGuardarGastoFijo')?.addEventListener('click', guardarGastoFijo);
  document.getElementById('btnCancelarGastoFijo')?.addEventListener('click', () => cerrarModal('modalGastoFijo'));

  ['modalInyeccion', 'modalGastoFijo'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => { if (e.target.id === id) cerrarModal(id); });
  });
});

function cerrarModal(id) { document.getElementById(id)?.classList.remove('show'); }

function mostrarPanelFinanzas(nombre) {
  document.querySelectorAll('#subtabsFinanzas .subtab').forEach(b => {
    b.classList.toggle('activo', b.dataset.subtab === nombre);
  });
  document.querySelectorAll('[data-panel-finanzas]').forEach(p => {
    p.classList.toggle('activo', p.dataset.panelFinanzas === nombre);
  });

  // Carga perezosa de los módulos embebidos
  if (nombre === 'ventas' && typeof cargarHistorial === 'function') cargarHistorial();
  if (nombre === 'gastos' && typeof cargarCompras === 'function') cargarCompras();
  if (nombre === 'fijos') cargarGastosFijos();
}

/* ============================================================
   RANGO DE FECHAS
   Se calcula con las funciones de zona horaria de Chile: usar
   `new Date()` a secas desplaza el día después de las 20:00.
   ============================================================ */
function calcularRango(clave) {
  const hoy = todayISO();                    // YYYY-MM-DD en Chile
  const [a, m, d] = hoy.split('-').map(Number);
  const iso = (y, mes, dia) =>
    `${y}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

  if (clave === 'hoy') return { desde: hoy, hasta: hoy, etiqueta: 'Hoy' };

  if (clave === 'semana') {
    /* Semana corrida hacia atrás (7 días incluyendo hoy) en vez de
       "desde el lunes": para un negocio abierto todos los días es la
       comparación que sirve. */
    const ref = new Date(Date.UTC(a, m - 1, d));
    ref.setUTCDate(ref.getUTCDate() - 6);
    return {
      desde: ref.toISOString().slice(0, 10),
      hasta: hoy,
      etiqueta: 'Últimos 7 días'
    };
  }

  if (clave === 'mes') {
    return { desde: iso(a, m, 1), hasta: hoy, etiqueta: 'Este mes' };
  }

  if (clave === 'mes-anterior') {
    const mesAnt = m === 1 ? 12 : m - 1;
    const anioAnt = m === 1 ? a - 1 : a;
    const ultimo = new Date(Date.UTC(anioAnt, mesAnt, 0)).getUTCDate();
    return { desde: iso(anioAnt, mesAnt, 1), hasta: iso(anioAnt, mesAnt, ultimo), etiqueta: 'Mes anterior' };
  }

  return { desde: iso(a, m, 1), hasta: hoy, etiqueta: 'Este mes' };
}

function aplicarRango(clave) {
  rangoBalance = calcularRango(clave);
  document.querySelectorAll('[data-rango]').forEach(b => {
    b.classList.toggle('activo', b.dataset.rango === clave);
  });
  const dEl = document.getElementById('balanceDesde');
  const hEl = document.getElementById('balanceHasta');
  if (dEl) dEl.value = rangoBalance.desde;
  if (hEl) hEl.value = rangoBalance.hasta;

  cargarBalance();
}

function aplicarRangoPersonalizado() {
  const desde = document.getElementById('balanceDesde')?.value;
  const hasta = document.getElementById('balanceHasta')?.value;

  if (!desde || !hasta) { showToast('Elige las dos fechas', 'err'); return; }
  if (desde > hasta) { showToast('La fecha inicial no puede ser posterior a la final', 'err'); return; }

  rangoBalance = { desde, hasta, etiqueta: 'Personalizado' };
  document.querySelectorAll('[data-rango]').forEach(b => b.classList.remove('activo'));
  cargarBalance();
}

/* ============================================================
   CARGA Y PINTADO DEL BALANCE
   ============================================================ */
async function cargarBalance() {
  if (!esAdmin()) return;
  if (!rangoBalance.desde) rangoBalance = calcularRango('mes');

  const caja = document.getElementById('balanceContenido');
  if (caja) caja.classList.add('cargando');

  try {
    balanceActual = await API.balance.obtener(rangoBalance.desde, rangoBalance.hasta);
    pintarBalance(balanceActual);

    // Top 10 y horas pico usan el mismo período
    if (typeof cargarDashboardReportes === 'function') {
      cargarDashboardReportes(rangoBalance.desde, rangoBalance.hasta);
    }
  } catch (err) {
    console.error('Error al cargar el balance:', err.message || err);
    showToast(err.message || 'No se pudo cargar el balance', 'err');
  } finally {
    if (caja) caja.classList.remove('cargando');
  }
}

function pintarBalance(b) {
  const set = (id, valor) => { const el = document.getElementById(id); if (el) el.textContent = valor; };

  set('balancePeriodo', `${b.periodo.desde} al ${b.periodo.hasta} · ${rangoBalance.etiqueta}`);

  // --- Estado de resultados ---
  set('kpiIngresos', fmtCLP(b.ingresos));
  set('kpiIngresosDetalle', `${b.cantidadVentas} venta(s) · ticket ${fmtCLP(b.ticketPromedio)}`);

  set('kpiUtilidadBruta', fmtCLP(b.utilidadBruta));
  set('kpiUtilidadBrutaDetalle', `Costo de lo vendido ${fmtCLP(b.costoVendido)} · margen ${b.margenBruto.toFixed(1)}%`);

  set('kpiGastos', fmtCLP(b.totalGastos));
  set('kpiGastosDetalle', b.comisiones > 0
    ? `+ ${fmtCLP(b.comisiones)} de comisión Tuu`
    : 'Sin comisiones en el período');

  /* La utilidad neta es EL indicador: se pinta en verde o rojo según el
     signo, para que se lea sin tener que interpretar el número. */
  set('kpiUtilidadNeta', fmtCLP(b.utilidadNeta));
  const tarjetaNeta = document.getElementById('tarjetaUtilidadNeta');
  if (tarjetaNeta) {
    const positivo = b.utilidadNeta >= 0;
    tarjetaNeta.classList.toggle('salud-ok', positivo);
    tarjetaNeta.classList.toggle('salud-mal', !positivo);
    set('kpiUtilidadNetaDetalle', positivo
      ? `✅ El negocio gana · margen neto ${b.margenNeto.toFixed(1)}%`
      : `⚠️ Estás perdiendo dinero en el período · margen ${b.margenNeto.toFixed(1)}%`);
  }

  // --- Caja ---
  set('cajaFisica', fmtCLP(b.cajaFisica));
  set('cajaFisicaDetalle',
    `Fondo ${fmtCLP(b.fondoInicial || 0)} + ventas en efectivo ${fmtCLP(b.ventasEfectivo)} ` +
    `+ aportes ${fmtCLP(b.inyeccionesEfectivo)} − gastos en efectivo ${fmtCLP(b.gastosEfectivo || 0)}`);

  set('flujoLiquido', fmtCLP(b.flujoLiquido));
  set('flujoLiquidoDetalle',
    `Todas las ventas ${fmtCLP(b.ingresos)} + aportes ${fmtCLP(b.totalInyecciones)} − gastos y comisiones`);

  pintarArqueo(b);
  pintarMedios(b.porMedio);
  pintarGrupos(b.porGrupo, b.porClasificacion, b.totalGastos);
  pintarEquilibrio(b);
  pintarInyecciones(b.inyecciones);
}

function pintarMedios(porMedio) {
  const caja = document.getElementById('balanceMedios');
  if (!caja) return;

  const entradas = Object.entries(porMedio || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = entradas.reduce((a, [, v]) => a + v, 0);

  if (!entradas.length) { caja.innerHTML = '<p class="vacio-nota">Sin ventas en el período</p>'; return; }

  caja.innerHTML = entradas.map(([metodo, monto]) => {
    const pct = total > 0 ? (monto / total) * 100 : 0;
    return `
      <div class="barra-fila">
        <div class="barra-cabecera">
          <span>${escHtml(metodo)}</span>
          <b>${fmtCLP(monto)} <small>${pct.toFixed(0)}%</small></b>
        </div>
        <div class="barra-pista"><div class="barra-relleno" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');
}

function pintarGrupos(porGrupo, porClasificacion, totalGastos) {
  const caja = document.getElementById('balanceGrupos');
  if (!caja) return;

  if (!totalGastos) { caja.innerHTML = '<p class="vacio-nota">Sin gastos en el período</p>'; return; }

  caja.innerHTML = GRUPOS_GASTO.map(g => {
    const monto = Number(porGrupo?.[g.valor]) || 0;
    const pct = totalGastos > 0 ? (monto / totalGastos) * 100 : 0;
    /* req.4 — el gasto en mercadería (grupo INVENTARIO) se resalta como
       bloque destacado: es la métrica que el negocio mira para saber
       cuánto se reinvirtió en productos para reventa en el período. */
    const destacado = g.valor === 'INVENTARIO' ? ' barra-fila-destacada' : '';
    const etiqueta = g.valor === 'INVENTARIO' ? '📦 Mercadería / Reventa' : g.etiqueta;
    return `
      <div class="barra-fila${destacado}">
        <div class="barra-cabecera">
          <span>${etiqueta} <small>${g.desc}</small></span>
          <b>${fmtCLP(monto)} <small>${pct.toFixed(0)}%</small></b>
        </div>
        <div class="barra-pista"><div class="barra-relleno barra-${g.color}" style="width:${pct}%"></div></div>
      </div>`;
  }).join('');

  // Detalle por clasificación concreta, para saber qué hay dentro de cada familia
  const detalle = document.getElementById('balanceClasificaciones');
  if (detalle) {
    const filas = Object.entries(porClasificacion || {}).sort((a, b) => b[1] - a[1]);
    detalle.innerHTML = filas.length
      ? filas.map(([nombre, monto]) => `
          <div class="detalle-fila">
            <span>${escHtml(nombre)}</span>
            <b>${fmtCLP(monto)}</b>
          </div>`).join('')
      : '';
  }
}

/* Punto de equilibrio: qué parte de los gastos fijos del mes ya está
   cubierta por el margen bruto del período. */
function pintarEquilibrio(b) {
  const caja = document.getElementById('bloqueEquilibrio');
  if (!caja) return;

  if (!b.metaGastosFijos) {
    caja.innerHTML = `
      <p class="vacio-nota">
        Aún no hay gastos fijos cargados. Agrégalos en la pestaña
        <strong>Gastos Fijos</strong> para ver cuánto te falta para cubrir el mes.
      </p>`;
    return;
  }

  const avance = Math.max(0, Number(b.avanceEquilibrio) || 0);
  const falta = Math.max(0, b.metaGastosFijos - b.utilidadBruta);
  const cubierto = avance >= 100;

  caja.innerHTML = `
    <div class="equilibrio-cifras">
      <div>
        <span>Margen bruto del período</span>
        <strong>${fmtCLP(b.utilidadBruta)}</strong>
      </div>
      <div>
        <span>Gastos fijos del mes</span>
        <strong>${fmtCLP(b.metaGastosFijos)}</strong>
      </div>
    </div>

    <div class="barra-pista barra-alta">
      <div class="barra-relleno ${cubierto ? 'barra-green' : 'barra-gold'}"
           style="width:${Math.min(100, avance)}%"></div>
    </div>

    <p class="equilibrio-nota ${cubierto ? 'ok' : ''}">
      ${cubierto
        ? `✅ Punto de equilibrio cubierto · lo que sigue es ganancia`
        : `Llevas <strong>${avance.toFixed(0)}%</strong> · faltan <strong>${fmtCLP(falta)}</strong> de margen para cubrir el mes`}
    </p>`;
}

/* ============================================================
   ARQUEO DE CAJA
   ------------------------------------------------------------
   Abrir fija el fondo del cajón; cerrar guarda el conteo real y la
   diferencia. Sin el fondo inicial la caja física partía de 0 y nunca
   podía cuadrar con lo que hay de verdad en el cajón.
   ============================================================ */
function pintarArqueo(b) {
  const estado = document.getElementById('arqueoEstado');
  const detalle = document.getElementById('arqueoDetalle');
  const btnAbrir = document.getElementById('btnAbrirCaja');
  const btnCerrar = document.getElementById('btnCerrarCaja');
  if (!detalle) return;

  const a = b.arqueo;

  if (!a) {
    if (estado) estado.textContent = 'La caja no se ha abierto en este período';
    detalle.innerHTML = `
      <p class="vacio-nota">
        Abre la caja indicando con cuánto dinero parte el cajón. Sin ese fondo, la
        caja física arranca en $0 y no puede cuadrar con el conteo real.
      </p>`;
    if (btnAbrir) btnAbrir.style.display = '';
    if (btnCerrar) btnCerrar.style.display = 'none';
    return;
  }

  if (a.cerrado) {
    const dif = Number(a.diferencia) || 0;
    const estadoDif = dif === 0 ? 'cuadra' : (dif > 0 ? 'sobra' : 'falta');
    const clase = dif === 0 ? 'ok' : (Math.abs(dif) > 2000 ? 'mal' : 'aviso');

    if (estado) estado.textContent = `Caja del ${a.fecha} cerrada`;
    detalle.innerHTML = `
      <div class="arqueo-cifras">
        <div><span>Fondo inicial</span><strong>${fmtCLP(a.fondo_inicial)}</strong></div>
        <div><span>Esperado</span><strong>${fmtCLP(a.esperado)}</strong></div>
        <div><span>Contado</span><strong>${fmtCLP(a.contado)}</strong></div>
      </div>
      <div class="arqueo-resultado ${clase}">
        ${dif === 0
          ? '✅ La caja cuadró exacta'
          : `${dif > 0 ? '🔵' : '⚠️'} ${estadoDif} ${fmtCLP(Math.abs(dif))} respecto de lo esperado`}
      </div>
      ${a.observaciones ? `<p class="modal-hint">📝 ${escHtml(a.observaciones)}</p>` : ''}`;

    if (btnAbrir) btnAbrir.style.display = 'none';
    if (btnCerrar) btnCerrar.style.display = 'none';
    return;
  }

  // Caja abierta: se puede cerrar
  if (estado) estado.textContent = `Caja abierta desde el ${a.fecha}`;
  detalle.innerHTML = `
    <div class="arqueo-cifras">
      <div><span>Fondo inicial</span><strong>${fmtCLP(a.fondo_inicial)}</strong></div>
      <div><span>Debería haber ahora</span><strong>${fmtCLP(b.cajaFisica)}</strong></div>
    </div>
    <p class="modal-hint">
      Al cerrar, cuenta los billetes y compara. Cualquier diferencia queda
      registrada con su observación.
    </p>`;

  if (btnAbrir) btnAbrir.style.display = 'none';
  if (btnCerrar) btnCerrar.style.display = '';
}

function abrirModalAbrirCaja() {
  const f = document.getElementById('arqueoFechaApertura');
  const monto = document.getElementById('arqueoFondoInicial');
  if (f) f.value = todayISO();
  if (monto) monto.value = '';
  document.getElementById('modalAbrirCaja')?.classList.add('show');
  setTimeout(() => monto?.focus(), 80);
}

async function confirmarAbrirCaja() {
  const fondo = Number(document.getElementById('arqueoFondoInicial')?.value) || 0;
  const fecha = document.getElementById('arqueoFechaApertura')?.value || todayISO();

  const btn = document.getElementById('btnConfirmarAbrirCaja');
  if (btn) btn.disabled = true;

  try {
    await API.balance.abrirCaja({ fecha, fondo_inicial: fondo });
    showToast(`Caja abierta con ${fmtCLP(fondo)}`, 'ok');
    cerrarModal('modalAbrirCaja');
    cargarBalance();
  } catch (err) {
    showToast(err.message || 'No se pudo abrir la caja', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ============================================================
   ARQUEO CIEGO
   ------------------------------------------------------------
   El cajero cuenta SIN VER lo esperado. Es la única forma de que el
   arqueo sirva para algo: si el total aparece en pantalla, el conteo
   tiende a "ajustarse" a esa cifra sin querer, y las diferencias reales
   nunca salen a la luz.

   Por eso el esperado tampoco se envía desde el navegador: lo calcula el
   servidor al cerrar. Mandarlo desde acá permitiría leerlo en las
   herramientas del desarrollador antes de contar.

   El desglose de billetes es opcional pero ayuda: contar por
   denominación es más fiable que estimar un total de memoria.
   ============================================================ */
const DENOMINACIONES = [20000, 10000, 5000, 2000, 1000, 500, 100, 50, 10];

function abrirModalCerrarCaja() {
  const cont = document.getElementById('arqueoDenominaciones');
  if (cont) {
    cont.innerHTML = DENOMINACIONES.map(d => `
      <div class="denom-fila">
        <span class="denom-valor">${fmtCLP(d)}</span>
        <span class="denom-x">×</span>
        <input type="number" class="denom-cant" data-denom="${d}" min="0" step="1" placeholder="0">
        <b class="denom-sub" data-sub="${d}">$0</b>
      </div>`).join('');

    cont.querySelectorAll('.denom-cant').forEach(inp => {
      inp.addEventListener('input', recalcularConteo);
    });
  }

  const contado = document.getElementById('arqueoContado');
  if (contado) { contado.value = ''; contado.oninput = null; }

  const obs = document.getElementById('arqueoObservaciones');
  if (obs) obs.value = '';

  document.getElementById('modalCerrarCaja')?.classList.add('show');
  setTimeout(() => cont?.querySelector('.denom-cant')?.focus(), 80);
}

/* Suma el desglose y lo vuelca al total. El campo de total sigue
   editable por si se prefiere escribirlo directo. */
function recalcularConteo() {
  let total = 0;
  document.querySelectorAll('.denom-cant').forEach(inp => {
    const d = Number(inp.dataset.denom) || 0;
    const cant = Number(inp.value) || 0;
    const sub = d * cant;
    total += sub;
    const el = document.querySelector(`[data-sub="${d}"]`);
    if (el) el.textContent = fmtCLP(sub);
  });

  const contado = document.getElementById('arqueoContado');
  if (contado) contado.value = total || '';
}

async function confirmarCerrarCaja() {
  const contado = Number(document.getElementById('arqueoContado')?.value);
  if (!contado && contado !== 0) { showToast('Cuenta el efectivo antes de cerrar', 'err'); return; }

  /* No se puede advertir de una diferencia grande antes de cerrar: sería
     revelar lo esperado, que es justo lo que el arqueo ciego evita. Se
     confirma el conteo y el resultado se muestra DESPUÉS. */
  if (!confirm(`Vas a cerrar la caja con ${fmtCLP(contado)} contados.\n\nEl cierre no se puede deshacer. ¿Confirmas el conteo?`)) return;

  const btn = document.getElementById('btnConfirmarCerrarCaja');
  if (btn) btn.disabled = true;

  try {
    const arqueo = await API.balance.cerrarCaja({
      fecha: balanceActual?.arqueo?.fecha || todayISO(),
      contado,
      observaciones: document.getElementById('arqueoObservaciones')?.value || ''
    });

    cerrarModal('modalCerrarCaja');
    mostrarResultadoArqueo(arqueo);
    cargarBalance();
  } catch (err) {
    showToast(err.message || 'No se pudo cerrar la caja', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* Resultado del arqueo, ya con el esperado revelado. Imprimible. */
function mostrarResultadoArqueo(a) {
  const dif = Number(a?.diferencia) || 0;
  const caja = document.getElementById('resultadoArqueoCuerpo');
  if (!caja) { showToast('Caja cerrada', 'ok'); return; }

  const clase = dif === 0 ? 'ok' : (Math.abs(dif) > 2000 ? 'mal' : 'aviso');
  caja.innerHTML = `
    <div class="arqueo-cifras">
      <div><span>Fondo inicial</span><strong>${fmtCLP(a.fondo_inicial)}</strong></div>
      <div><span>Esperado por el sistema</span><strong>${fmtCLP(a.esperado)}</strong></div>
      <div><span>Contado físicamente</span><strong>${fmtCLP(a.contado)}</strong></div>
    </div>
    <div class="arqueo-resultado ${clase}">
      ${dif === 0
        ? '✅ La caja cuadró exacta'
        : (dif > 0 ? `🔵 Sobran ${fmtCLP(dif)}` : `⚠️ Faltan ${fmtCLP(-dif)}`)}
    </div>
    ${a.observaciones ? `<p class="modal-hint">📝 ${escHtml(a.observaciones)}</p>` : ''}
    <p class="modal-hint">Cerrado el ${a.fecha} · ${new Date(a.cerrado_en || Date.now()).toLocaleString('es-CL')}</p>`;

  document.getElementById('modalResultadoArqueo')?.classList.add('show');
}

/* ============================================================
   INYECCIONES DE CAPITAL
   ============================================================ */
function pintarInyecciones(lista) {
  const caja = document.getElementById('listaInyecciones');
  if (!caja) return;

  if (!lista?.length) {
    caja.innerHTML = '<p class="vacio-nota">Sin aportes registrados en el período</p>';
    return;
  }

  caja.innerHTML = lista.map(i => `
    <div class="detalle-fila">
      <span>${i.fecha} · ${escHtml(i.metodo)}${i.descripcion ? ' · ' + escHtml(i.descripcion) : ''}</span>
      <b>${fmtCLP(i.monto)}</b>
    </div>`).join('');
}

function abrirModalInyeccion() {
  const hoy = todayISO();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('inyeccionFecha', hoy);
  set('inyeccionMonto', '');
  set('inyeccionMetodo', 'Efectivo');
  set('inyeccionDescripcion', '');
  document.getElementById('modalInyeccion')?.classList.add('show');
  setTimeout(() => document.getElementById('inyeccionMonto')?.focus(), 80);
}

async function guardarInyeccion() {
  const monto = Number(document.getElementById('inyeccionMonto')?.value) || 0;
  if (monto <= 0) { showToast('El monto debe ser mayor a 0', 'err'); return; }

  const btn = document.getElementById('btnGuardarInyeccion');
  if (btn) btn.disabled = true;

  try {
    await API.balance.crearInyeccion({
      fecha: document.getElementById('inyeccionFecha')?.value || todayISO(),
      monto,
      metodo: document.getElementById('inyeccionMetodo')?.value || 'Efectivo',
      descripcion: document.getElementById('inyeccionDescripcion')?.value || ''
    });
    showToast(`Aporte de ${fmtCLP(monto)} registrado`, 'ok');
    cerrarModal('modalInyeccion');
    cargarBalance();
  } catch (err) {
    showToast(err.message || 'No se pudo registrar el aporte', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ============================================================
   GASTOS FIJOS
   ============================================================ */
async function cargarGastosFijos() {
  if (!esAdmin()) return;
  try {
    gastosFijosLista = await API.balance.listarGastosFijos();
    pintarGastosFijos();
  } catch (err) {
    showToast(err.message || 'No se pudieron cargar los gastos fijos', 'err');
  }
}

function pintarGastosFijos() {
  const caja = document.getElementById('listaGastosFijos');
  if (!caja) return;

  if (!gastosFijosLista.length) {
    caja.innerHTML = `
      <p class="vacio-nota">
        Sin gastos fijos cargados. Agrega el arriendo, internet, luz o sueldos
        para calcular tu punto de equilibrio mensual.
      </p>`;
    actualizarTotalFijos();
    return;
  }

  caja.innerHTML = gastosFijosLista.map(g => {
    const grupo = GRUPOS_GASTO.find(x => x.valor === g.grupo) || GRUPOS_GASTO[0];
    return `
      <div class="fijo-item${g.activo ? '' : ' pausado'}">
        <div class="fijo-info">
          <strong>${escHtml(g.nombre)}</strong>
          <small>
            Día ${g.dia_mes} de cada mes · ${grupo.etiqueta}
            ${g.clasificacion ? ' · ' + escHtml(g.clasificacion) : ''}
            ${g.activo ? '' : ' · <span class="tag-pausado">Pausado</span>'}
          </small>
          ${g.notas ? `<small class="fijo-notas">${escHtml(g.notas)}</small>` : ''}
        </div>
        <b class="fijo-monto">${fmtCLP(g.monto)}</b>
        <div class="fijo-acciones">
          <!-- Registrar el pago sin salir de esta pestaña. Antes había que
               ir a Gastos y escribir todo de nuevo a mano. -->
          <button class="btn btn-mini btn-mini-pagar" data-fijo-pagar="${g.id}"
                  title="Registrar el pago de este mes como gasto">💸</button>
          <button class="btn btn-mini" data-fijo-pausar="${g.id}"
                  title="${g.activo ? 'Pausar: deja de contar en el punto de equilibrio' : 'Reactivar'}">
            ${g.activo ? '⏸️' : '▶️'}
          </button>
          <button class="btn btn-mini" data-fijo-editar="${g.id}" title="Editar">✏️</button>
          <button class="btn btn-mini" data-fijo-borrar="${g.id}" title="Eliminar">🗑️</button>
        </div>
      </div>`;
  }).join('');

  caja.querySelectorAll('[data-fijo-pagar]').forEach(b => b.addEventListener('click', () =>
    abrirModalPagarFijo(gastosFijosLista.find(g => String(g.id) === b.dataset.fijoPagar))));

  caja.querySelectorAll('[data-fijo-editar]').forEach(b => b.addEventListener('click', () =>
    abrirModalGastoFijo(gastosFijosLista.find(g => String(g.id) === b.dataset.fijoEditar))));

  caja.querySelectorAll('[data-fijo-pausar]').forEach(b => b.addEventListener('click', () =>
    alternarGastoFijo(gastosFijosLista.find(g => String(g.id) === b.dataset.fijoPausar))));

  caja.querySelectorAll('[data-fijo-borrar]').forEach(b => b.addEventListener('click', () =>
    borrarGastoFijo(gastosFijosLista.find(g => String(g.id) === b.dataset.fijoBorrar))));

  actualizarTotalFijos();
}

function actualizarTotalFijos() {
  /* Solo los activos: un gasto pausado (por ejemplo, algo de temporada)
     no debe inflar la meta del mes. */
  const activos = gastosFijosLista.filter(g => g.activo);
  const total = activos.reduce((a, g) => a + (Number(g.monto) || 0), 0);
  const pausados = gastosFijosLista.length - activos.length;

  const el = document.getElementById('totalGastosFijos');
  if (el) el.textContent = fmtCLP(total);

  const det = document.getElementById('detalleGastosFijos');
  if (det) {
    det.textContent = `${activos.length} activo(s)` +
      (pausados ? ` · ${pausados} pausado(s), no cuentan` : '') +
      ` · equivale a ${fmtCLP(total / 30)} por día`;
  }
}

function abrirModalGastoFijo(gasto) {
  editandoGastoFijo = gasto || null;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  const chk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };

  document.getElementById('tituloGastoFijo').textContent = gasto ? 'Editar gasto fijo' : 'Nuevo gasto fijo';
  set('fijoNombre', gasto?.nombre || '');
  set('fijoMonto', gasto?.monto || '');
  set('fijoDia', gasto?.dia_mes || 1);
  set('fijoGrupo', gasto?.grupo || 'OPERATIVO');
  set('fijoClasificacion', gasto?.clasificacion || '');
  set('fijoNotas', gasto?.notas || '');
  chk('fijoActivo', gasto ? gasto.activo : true);

  document.getElementById('modalGastoFijo')?.classList.add('show');
  setTimeout(() => document.getElementById('fijoNombre')?.focus(), 80);
}

async function guardarGastoFijo() {
  const nombre = (document.getElementById('fijoNombre')?.value || '').trim();
  const monto = Number(document.getElementById('fijoMonto')?.value) || 0;

  if (!nombre) { showToast('Ponle un nombre al gasto', 'err'); return; }
  if (monto <= 0) { showToast('El monto debe ser mayor a 0', 'err'); return; }

  const datos = {
    nombre, monto,
    dia_mes: Number(document.getElementById('fijoDia')?.value) || 1,
    grupo: document.getElementById('fijoGrupo')?.value || 'OPERATIVO',
    clasificacion: document.getElementById('fijoClasificacion')?.value || '',
    notas: document.getElementById('fijoNotas')?.value || '',
    activo: !!document.getElementById('fijoActivo')?.checked
  };

  const btn = document.getElementById('btnGuardarGastoFijo');
  if (btn) btn.disabled = true;

  try {
    if (editandoGastoFijo) await API.balance.actualizarGastoFijo(editandoGastoFijo.id, datos);
    else await API.balance.crearGastoFijo(datos);

    showToast(editandoGastoFijo ? 'Gasto fijo actualizado' : 'Gasto fijo creado', 'ok');
    cerrarModal('modalGastoFijo');
    await cargarGastosFijos();
    cargarBalance();          // cambia el punto de equilibrio
  } catch (err) {
    showToast(err.message || 'No se pudo guardar', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function alternarGastoFijo(gasto) {
  if (!gasto) return;
  try {
    await API.balance.actualizarGastoFijo(gasto.id, { activo: !gasto.activo });
    showToast(gasto.activo ? `"${gasto.nombre}" pausado` : `"${gasto.nombre}" reactivado`, 'ok');
    await cargarGastosFijos();
    cargarBalance();
  } catch (err) {
    showToast(err.message || 'No se pudo cambiar el estado', 'err');
  }
}

async function borrarGastoFijo(gasto) {
  if (!gasto) return;
  /* Se sugiere pausar antes de borrar: lo habitual es que el gasto vuelva
     (temporada, corte temporal de un servicio) y borrarlo pierde el dato. */
  if (!confirm(`¿Eliminar "${gasto.nombre}" definitivamente?\n\nSi solo dejará de pagarse un tiempo, conviene pausarlo con ⏸️ en vez de borrarlo.`)) return;

  try {
    await API.balance.eliminarGastoFijo(gasto.id);
    showToast('Gasto fijo eliminado', 'ok');
    await cargarGastosFijos();
    cargarBalance();
  } catch (err) {
    showToast(err.message || 'No se pudo eliminar', 'err');
  }
}

/* ============================================================
   PAGAR UN GASTO FIJO DESDE SU PROPIA PESTAÑA
   ------------------------------------------------------------
   Los gastos fijos son una PLANTILLA, no movimientos: alimentan el
   punto de equilibrio pero no se registran solos (si se generaran
   solos, un mes que no pagaste aparecería como gasto igual y el balance
   mentiría). Esto se decidió así y no cambia.

   Lo que faltaba era el puente: pagar uno y tener que ir a Gastos a
   escribirlo todo de nuevo a mano. Ahora el botón 💸 abre este modal,
   pregunta lo que de verdad varía —monto y fecha— y crea el gasto real
   en `compras`.

   Por qué se PREGUNTA el monto en vez de darlo por hecho:
   una tarjeta de crédito no se paga igual dos meses seguidos, y el
   arriendo puede traer un reajuste. Dar por bueno el monto de la
   plantilla habría metido cifras falsas en el balance sin que nadie se
   diera cuenta.
   ============================================================ */
let gastoFijoPagando = null;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnCancelarPagarFijo')
    ?.addEventListener('click', () => cerrarModal('modalPagarFijo'));
  document.getElementById('btnConfirmarPagarFijo')
    ?.addEventListener('click', confirmarPagoGastoFijo);

  document.getElementById('modalPagarFijo')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalPagarFijo') cerrarModal('modalPagarFijo');
  });

  // Chips de monto: "el mismo" vuelve al valor de la plantilla
  document.getElementById('pagarFijoMontoChips')?.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      marcarChipsFijo('pagarFijoMontoChips', chip);
      const campo = document.getElementById('pagarFijoMonto');
      if (chip.dataset.monto === 'igual' && campo && gastoFijoPagando) {
        campo.value = Number(gastoFijoPagando.monto) || 0;
      } else if (campo) {
        campo.focus();
        campo.select();
      }
      actualizarDiferenciaFijo();
    });
  });

  // Chips de fecha: "hoy" vuelve a la fecha de Chile
  document.getElementById('pagarFijoFechaChips')?.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      marcarChipsFijo('pagarFijoFechaChips', chip);
      const campo = document.getElementById('pagarFijoFecha');
      if (!campo) return;
      if (chip.dataset.fecha === 'hoy') campo.value = todayISO();
      else if (typeof campo.showPicker === 'function') { try { campo.showPicker(); } catch (_) {} }
      actualizarAvisoFechaFijo();
    });
  });

  document.getElementById('pagarFijoMonto')?.addEventListener('input', () => {
    /* Si el usuario toca el monto a mano, el chip salta solo a "cambió":
       marcar "el mismo" y tener otra cifra en el campo sería mentirle
       al que revise después. */
    const campo = document.getElementById('pagarFijoMonto');
    const esperado = Number(gastoFijoPagando?.monto) || 0;
    if (Number(campo?.value) !== esperado) {
      const distinto = document.querySelector('#pagarFijoMontoChips .chip[data-monto="distinto"]');
      if (distinto) marcarChipsFijo('pagarFijoMontoChips', distinto);
    }
    actualizarDiferenciaFijo();
  });

  document.getElementById('pagarFijoFecha')?.addEventListener('change', actualizarAvisoFechaFijo);
});

function marcarChipsFijo(idGrupo, activo) {
  document.getElementById(idGrupo)?.querySelectorAll('.chip')
    .forEach(c => c.classList.toggle('active', c === activo));
}

function abrirModalPagarFijo(gasto) {
  if (!gasto) return;
  if (!esAdmin()) { showToast('Solo el administrador registra gastos', 'err'); return; }

  gastoFijoPagando = gasto;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  const txt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  txt('pagarFijoNombre', gasto.nombre);
  txt('pagarFijoRef', fmtCLP(gasto.monto));

  set('pagarFijoMonto', Number(gasto.monto) || 0);
  set('pagarFijoFecha', todayISO());
  set('pagarFijoDescripcion', '');
  set('pagarFijoMetodo', 'Efectivo');

  const chkPlantilla = document.getElementById('pagarFijoActualizarPlantilla');
  if (chkPlantilla) chkPlantilla.checked = false;

  marcarChipsFijo('pagarFijoMontoChips', document.querySelector('#pagarFijoMontoChips .chip[data-monto="igual"]'));
  marcarChipsFijo('pagarFijoFechaChips', document.querySelector('#pagarFijoFechaChips .chip[data-fecha="hoy"]'));

  llenarClasificacionesFijo(gasto);
  actualizarDiferenciaFijo();
  actualizarAvisoFechaFijo();

  document.getElementById('modalPagarFijo')?.classList.add('show');
  setTimeout(() => document.getElementById('pagarFijoMonto')?.focus(), 80);
}

/* Se reutiliza el catálogo de clasificaciones que ya cargó compras.js.
   Si el gasto fijo trae una escrita y coincide, queda preseleccionada:
   es el caso normal y ahorra un clic cada mes. */
function llenarClasificacionesFijo(gasto) {
  const sel = document.getElementById('pagarFijoClasificacion');
  if (!sel) return;

  const lista = (typeof clasificacionesList !== 'undefined' && Array.isArray(clasificacionesList))
    ? clasificacionesList.filter(c => c.activo)
    : [];

  if (!lista.length) {
    sel.innerHTML = '<option value="">(sin clasificaciones: crea una en Gastos)</option>';
    return;
  }

  sel.innerHTML = lista.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');

  const preferida = (gasto?.clasificacion || '').trim();
  if (preferida && lista.some(c => c.nombre === preferida)) sel.value = preferida;
}

/* Diferencia en vivo contra la plantilla. Es la señal que hace obvio si
   este mes se pagó de más sin tener que sacar la resta a mano. */
function actualizarDiferenciaFijo() {
  const nota = document.getElementById('pagarFijoDiferencia');
  if (!nota) return;

  const esperado = Number(gastoFijoPagando?.monto) || 0;
  const real = Number(document.getElementById('pagarFijoMonto')?.value) || 0;
  const dif = real - esperado;

  if (!real) { nota.textContent = ''; nota.style.color = ''; return; }
  if (Math.abs(dif) < 1) {
    nota.textContent = 'Coincide con el monto habitual.';
    nota.style.color = 'var(--green)';
    return;
  }

  nota.textContent = dif > 0
    ? `Este mes salió ${fmtCLP(dif)} MÁS caro que lo presupuestado.`
    : `Este mes salió ${fmtCLP(-dif)} MÁS barato que lo presupuestado.`;
  nota.style.color = dif > 0 ? 'var(--red)' : 'var(--green)';
}

/* Avisa si la fecha elegida se adelanta o atrasa respecto del día de
   pago de la plantilla. No bloquea nada: solo confirma que fue a
   propósito, que era justo lo que se pidió. */
function actualizarAvisoFechaFijo() {
  const nota = document.getElementById('pagarFijoAvisoFecha');
  if (!nota) return;

  const valor = document.getElementById('pagarFijoFecha')?.value;
  const diaPlantilla = Number(gastoFijoPagando?.dia_mes) || 1;
  if (!valor) { nota.textContent = ''; nota.style.color = ''; return; }

  // Se parte el ISO a mano: new Date('2026-08-04') se lee como UTC (bug 3)
  const dia = Number(String(valor).split('-')[2]);
  if (!Number.isFinite(dia)) { nota.textContent = ''; return; }

  const dif = dia - diaPlantilla;
  if (dif === 0) {
    nota.textContent = `Coincide con el día ${diaPlantilla}, el habitual de este gasto.`;
    nota.style.color = 'var(--text-muted)';
  } else if (dif < 0) {
    nota.textContent = `Pago adelantado: ${Math.abs(dif)} día(s) antes del día ${diaPlantilla}.`;
    nota.style.color = 'var(--blue)';
  } else {
    nota.textContent = `Pago atrasado: ${dif} día(s) después del día ${diaPlantilla}.`;
    nota.style.color = 'var(--gold, #f59e0b)';
  }
}

async function confirmarPagoGastoFijo() {
  if (!gastoFijoPagando) return;

  const monto = Number(document.getElementById('pagarFijoMonto')?.value) || 0;
  const clasificacion = document.getElementById('pagarFijoClasificacion')?.value || '';
  const fecha = document.getElementById('pagarFijoFecha')?.value || todayISO();

  if (monto <= 0) { showToast('El monto pagado debe ser mayor a 0', 'err'); return; }
  if (!clasificacion) { showToast('Elige una clasificación para el gasto', 'err'); return; }

  const btn = document.getElementById('btnConfirmarPagarFijo');
  if (btn) btn.disabled = true;

  /* La descripción deja rastro del origen: al mirar el listado de Gastos
     dentro de tres meses hay que poder saber que esa línea salió de un
     gasto fijo y no de una compra suelta. */
  const extra = (document.getElementById('pagarFijoDescripcion')?.value || '').trim();
  const descripcion = `Gasto fijo: ${gastoFijoPagando.nombre}` + (extra ? ` · ${extra}` : '');

  try {
    await API.compras.crear({
      fecha,
      proveedor: gastoFijoPagando.nombre,
      clasificacion,
      metodo_pago: document.getElementById('pagarFijoMetodo')?.value || 'Efectivo',
      costo_total: monto,
      descripcion,
      // Vínculo para el checklist del mes (req. 4): marca este fijo como pagado
      gasto_fijo_id: gastoFijoPagando.id
    });

    // Solo si el usuario lo pidió: un cambio permanente, no el de un mes
    if (document.getElementById('pagarFijoActualizarPlantilla')?.checked) {
      await API.balance.actualizarGastoFijo(gastoFijoPagando.id, { monto });
      showToast(`Gasto registrado y plantilla actualizada a ${fmtCLP(monto)}`, 'ok');
    } else {
      showToast(`Gasto de ${fmtCLP(monto)} registrado`, 'ok');
    }

    cerrarModal('modalPagarFijo');
    gastoFijoPagando = null;

    await cargarGastosFijos();
    cargarBalance();                                              // caja y utilidad al día
    if (typeof cargarCompras === 'function') cargarCompras();     // aparece en Gastos
  } catch (err) {
    console.error('Error al registrar el pago del gasto fijo:', err.message || err);
    showToast(err.message || 'No se pudo registrar el gasto', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ============================================================
   WIDGET DE SALDO EN TIEMPO REAL · CANALES DE DINERO
   ------------------------------------------------------------
   Muestra cuánto hay en efectivo (caja chica) y en banco, más el total.
   El canal de cada movimiento lo deriva el backend del método de pago,
   así que aquí solo se pinta y se refresca. Los traspasos internos mueven
   plata entre canales sin tocar la utilidad.

   Todo dato que se interpola en innerHTML pasa por escHtml() (regla v7).
   ============================================================ */

let saldosActuales = null;   // último cálculo recibido, para el modal de traspaso
let checklistFijosActual = null;   // último checklist de gastos fijos del mes (para el modal)

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnTraspaso')?.addEventListener('click', abrirModalTraspaso);
  document.getElementById('btnCancelarTraspaso')?.addEventListener('click', () => cerrarModal('modalTraspaso'));
  document.getElementById('btnConfirmarTraspaso')?.addEventListener('click', confirmarTraspaso);
  document.getElementById('modalTraspaso')?.addEventListener('click', (e) => { if (e.target.id === 'modalTraspaso') cerrarModal('modalTraspaso'); });

  document.getElementById('btnResguardo')?.addEventListener('click', abrirModalResguardo);
  document.getElementById('btnCancelarResguardo')?.addEventListener('click', () => cerrarModal('modalResguardo'));
  document.getElementById('btnGuardarResguardo')?.addEventListener('click', guardarResguardo);
  document.getElementById('modalResguardo')?.addEventListener('click', (e) => { if (e.target.id === 'modalResguardo') cerrarModal('modalResguardo'); });

  // El origen del traspaso cambia el disponible mostrado y si pide banco
  document.getElementById('traspasoOrigen')?.addEventListener('change', sincronizarTraspaso);
  document.getElementById('traspasoDestino')?.addEventListener('change', sincronizarTraspaso);
  document.getElementById('traspasoMonto')?.addEventListener('input', sincronizarTraspaso);

  /* Cuando una venta se registra en el POS, el widget debe refrescarse.
     pos.js emite este evento tras cobrar; también lo emiten los flujos de
     gasto y OT. Así el saldo queda al día sin recargar. */
  document.addEventListener('pos:movimiento-dinero', () => {
    if (document.getElementById('view-finanzas')?.classList.contains('activo-view') ||
        !document.getElementById('view-finanzas')?.classList.contains('hidden')) {
      cargarSaldosCanales();
    }
  });
});

async function cargarSaldosCanales() {
  if (!esAdmin()) return;
  try {
    const s = await API.balance.saldos();
    saldosActuales = s;

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = fmtCLP(v); };
    set('saldoEfectivo', s.efectivo);
    set('saldoBanco', s.banco);
    set('saldoTotal', s.total);

    // Un saldo negativo es una señal de error de registro: se resalta
    document.getElementById('saldoEfectivo')?.classList.toggle('saldo-negativo', s.efectivo < 0);
    document.getElementById('saldoBanco')?.classList.toggle('saldo-negativo', s.banco < 0);

    /* Resguardo dinámico (req. 4): el mínimo a resguardar es la suma de
       los gastos fijos que AÚN faltan por pagar este mes. Se pide aparte
       porque necesita cruzar gastos fijos con las compras del mes. */
    try {
      const chk = await API.balance.gastosFijosMes();
      checklistFijosActual = chk;
      set('saldoResguardo', chk.totalPendiente);
      // Si el total disponible no cubre lo pendiente, el resguardo se pinta en alerta
      document.getElementById('saldoResguardo')?.classList.toggle('saldo-negativo', s.total < chk.totalPendiente);
    } catch (e) {
      console.warn('No se pudo cargar el checklist de fijos:', e.message || e);
    }

    evaluarCobertura(s);
  } catch (err) {
    console.error('No se pudieron cargar los saldos:', err.message || err);
  }
}

/* ============================================================
   ALERTA DE COBERTURA
   ------------------------------------------------------------
   Arma el calendario de vencimientos fijos (gastos_fijos.dia_mes) dentro
   de la ventana configurada y avisa si el saldo disponible no alcanza a
   cubrir el próximo compromiso manteniendo el resguardo mínimo.
   ============================================================ */
function evaluarCobertura(s) {
  const badge = document.getElementById('badgeCobertura');
  if (!badge) return;

  const fijos = (s.gastosFijos || []).filter(f => f.activo);
  const resguardo = num(s.config?.resguardo_caja);
  const dias = parseInt(s.config?.dias_alerta, 10) || 15;

  const proximos = proximosVencimientos(fijos, dias);

  if (!proximos.length) {
    // Sin vencimientos próximos: solo se avisa si ya se está bajo el resguardo
    if (resguardo > 0 && s.total < resguardo) {
      pintarBadgeCobertura('warn',
        `⚠️ Saldo total (${fmtCLP(s.total)}) bajo tu resguardo de ${fmtCLP(resguardo)}.`);
    } else {
      badge.classList.add('hidden');
    }
    return;
  }

  // Suma de lo que vence en la ventana
  const totalPorVencer = proximos.reduce((a, v) => a + num(v.monto), 0);
  const saldoTrasPagar = s.total - totalPorVencer;
  const prox = proximos[0];

  if (saldoTrasPagar < 0) {
    pintarBadgeCobertura('crit',
      `🔴 Cobertura crítica: los próximos ${proximos.length} vencimiento(s) suman ${fmtCLP(totalPorVencer)}, ` +
      `más que tu saldo disponible (${fmtCLP(s.total)}). El más cercano: ${escHtml(prox.nombre)} (día ${prox.dia_mes}).`);
  } else if (resguardo > 0 && saldoTrasPagar < resguardo) {
    // Sugerencia de flujo: ¿el canal correcto tiene lo suficiente?
    const consejo = sugerenciaTraspaso(s, prox);
    pintarBadgeCobertura('warn',
      `⚠️ Próximo vencimiento: día ${prox.dia_mes} · ${escHtml(prox.nombre)} (${fmtCLP(prox.monto)}). ` +
      `Tras pagarlo quedarías en ${fmtCLP(saldoTrasPagar)}, bajo tu resguardo de ${fmtCLP(resguardo)}. ${consejo}`);
  } else {
    pintarBadgeCobertura('ok',
      `✅ Cobertura al día. Próximo: día ${prox.dia_mes} · ${escHtml(prox.nombre)} (${fmtCLP(prox.monto)}). ` +
      `Quedarías con ${fmtCLP(saldoTrasPagar)}.`);
  }
}

/* Sugiere un traspaso si la plata está en el canal equivocado. Los
   compromisos fijos (tarjetas, préstamos) se pagan por banco; si el banco
   no alcanza pero el efectivo sí, se propone mover fondos. */
function sugerenciaTraspaso(s, prox) {
  const monto = num(prox.monto);
  if (s.banco < monto && s.efectivo >= (monto - s.banco)) {
    const falta = monto - s.banco;
    return `Tu banco (${fmtCLP(s.banco)}) no alcanza para esta cuota; ` +
           `traspasa al menos ${fmtCLP(falta)} de Efectivo a Banco antes de la fecha.`;
  }
  return 'Considera reponer caja antes del vencimiento.';
}

/* Calcula qué gastos fijos vencen en los próximos `dias` días, ordenados
   por cercanía. dia_mes es el día del mes; se proyecta al próximo que
   caiga dentro de la ventana. */
function proximosVencimientos(fijos, dias) {
  const hoyISO = todayISO();
  const [ay, am, ad] = hoyISO.split('-').map(Number);
  const hoy = new Date(ay, am - 1, ad);

  const lista = [];
  fijos.forEach(f => {
    const dia = Math.min(31, Math.max(1, parseInt(f.dia_mes, 10) || 1));
    // Próxima ocurrencia de ese día: este mes si aún no pasó, si no el que viene
    let cand = new Date(ay, am - 1, dia);
    if (cand < hoy) cand = new Date(ay, am, dia);   // mes siguiente
    const diff = Math.round((cand - hoy) / (1000 * 60 * 60 * 24));
    if (diff >= 0 && diff <= dias) {
      lista.push({ ...f, diasRestantes: diff });
    }
  });
  return lista.sort((a, b) => a.diasRestantes - b.diasRestantes);
}

function pintarBadgeCobertura(tipo, mensaje) {
  const badge = document.getElementById('badgeCobertura');
  if (!badge) return;
  badge.classList.remove('hidden', 'cobertura-ok', 'cobertura-warn', 'cobertura-crit');
  badge.classList.add(tipo === 'crit' ? 'cobertura-crit' : tipo === 'warn' ? 'cobertura-warn' : 'cobertura-ok');
  badge.textContent = mensaje;   // ya viene con escHtml en las partes de usuario
}

/* ---------- Traspaso interno ---------- */
function abrirModalTraspaso() {
  if (!esAdmin()) { showToast('Solo el administrador mueve fondos', 'err'); return; }
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('traspasoMonto', '');
  set('traspasoBanco', '');
  set('traspasoNota', '');
  const org = document.getElementById('traspasoOrigen'); if (org) org.value = 'EFECTIVO';
  const dst = document.getElementById('traspasoDestino'); if (dst) dst.value = 'BANCO';
  sincronizarTraspaso();
  document.getElementById('modalTraspaso')?.classList.add('show');
  setTimeout(() => document.getElementById('traspasoMonto')?.focus(), 80);
}

/* Mantiene coherente el modal: evita origen == destino, muestra el
   disponible del canal de origen y pide banco solo cuando toca. */
function sincronizarTraspaso() {
  const org = document.getElementById('traspasoOrigen');
  const dst = document.getElementById('traspasoDestino');
  if (!org || !dst) return;

  // Si coinciden, se voltea el destino automáticamente
  if (org.value === dst.value) dst.value = org.value === 'EFECTIVO' ? 'BANCO' : 'EFECTIVO';

  const disponible = saldosActuales
    ? (org.value === 'EFECTIVO' ? saldosActuales.efectivo : saldosActuales.banco)
    : 0;
  const nota = document.getElementById('traspasoDisponible');
  if (nota) {
    const monto = num(document.getElementById('traspasoMonto')?.value);
    nota.textContent = `Disponible en ${org.value === 'EFECTIVO' ? 'efectivo' : 'banco'}: ${fmtCLP(disponible)}` +
      (monto > disponible ? ' · ⚠️ el monto supera lo disponible' : '');
    nota.style.color = monto > disponible ? 'var(--red)' : 'var(--text-muted)';
  }

  // El banco se pide cuando el traspaso toca una cuenta bancaria
  const pideBanco = org.value === 'BANCO' || dst.value === 'BANCO';
  document.getElementById('traspasoBancoWrap')?.classList.toggle('hidden', !pideBanco);
}

async function confirmarTraspaso() {
  const origen = document.getElementById('traspasoOrigen')?.value;
  const destino = document.getElementById('traspasoDestino')?.value;
  const monto = num(document.getElementById('traspasoMonto')?.value);
  const banco = (document.getElementById('traspasoBanco')?.value || '').trim();
  const nota = (document.getElementById('traspasoNota')?.value || '').trim();

  if (!(monto > 0)) { showToast('Ingresa un monto mayor a 0', 'err'); return; }
  if (origen === destino) { showToast('El origen y el destino no pueden ser iguales', 'err'); return; }

  const btn = document.getElementById('btnConfirmarTraspaso');
  if (btn) btn.disabled = true;
  try {
    await API.balance.traspaso({ origen, destino, monto, banco, nota });
    showToast(`Traspaso de ${fmtCLP(monto)} registrado`, 'ok');
    cerrarModal('modalTraspaso');
    cargarSaldosCanales();
  } catch (err) {
    showToast(err.message || 'No se pudo registrar el traspaso', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ---------- Resguardo de caja ---------- */
function abrirModalResguardo() {
  if (!esAdmin()) return;
  const cfg = saldosActuales?.config || { resguardo_caja: 0, dias_alerta: 15 };
  const m = document.getElementById('resguardoMonto'); if (m) m.value = num(cfg.resguardo_caja) || '';
  const d = document.getElementById('resguardoDias'); if (d) d.value = String(cfg.dias_alerta || 15);
  document.getElementById('modalResguardo')?.classList.add('show');
  setTimeout(() => document.getElementById('resguardoMonto')?.focus(), 80);
}

async function guardarResguardo() {
  const resguardo_caja = num(document.getElementById('resguardoMonto')?.value);
  const dias_alerta = parseInt(document.getElementById('resguardoDias')?.value, 10) || 15;
  const btn = document.getElementById('btnGuardarResguardo');
  if (btn) btn.disabled = true;
  try {
    await API.balance.guardarConfig({ resguardo_caja, dias_alerta });
    showToast('Resguardo actualizado', 'ok');
    cerrarModal('modalResguardo');
    cargarSaldosCanales();
  } catch (err) {
    showToast(err.message || 'No se pudo guardar', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}
