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
          <span>${escaparTexto(metodo)}</span>
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
    return `
      <div class="barra-fila">
        <div class="barra-cabecera">
          <span>${g.etiqueta} <small>${g.desc}</small></span>
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
            <span>${escaparTexto(nombre)}</span>
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
      ${a.observaciones ? `<p class="modal-hint">📝 ${escaparTexto(a.observaciones)}</p>` : ''}`;

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

function abrirModalCerrarCaja() {
  if (!balanceActual) return;

  const esperado = Number(balanceActual.cajaFisica) || 0;
  const el = document.getElementById('arqueoEsperado');
  if (el) el.textContent = fmtCLP(esperado);

  const contado = document.getElementById('arqueoContado');
  if (contado) {
    contado.value = '';
    contado.oninput = () => mostrarDiferenciaArqueo(esperado);
  }
  const obs = document.getElementById('arqueoObservaciones');
  if (obs) obs.value = '';
  const dif = document.getElementById('arqueoDiferencia');
  if (dif) dif.style.display = 'none';

  document.getElementById('modalCerrarCaja')?.classList.add('show');
  setTimeout(() => contado?.focus(), 80);
}

/* La diferencia se muestra en vivo mientras se escribe: así se detecta
   un error de tecleo antes de cerrar, que es cuando todavía se puede
   volver a contar. */
function mostrarDiferenciaArqueo(esperado) {
  const caja = document.getElementById('arqueoDiferencia');
  const contado = Number(document.getElementById('arqueoContado')?.value);
  if (!caja) return;

  if (!contado && contado !== 0) { caja.style.display = 'none'; return; }

  const dif = contado - esperado;
  caja.style.display = '';
  caja.className = 'arqueo-diferencia ' + (dif === 0 ? 'ok' : (Math.abs(dif) > 2000 ? 'mal' : 'aviso'));
  caja.textContent = dif === 0
    ? '✅ Cuadra exacto'
    : (dif > 0 ? `🔵 Sobran ${fmtCLP(dif)}` : `⚠️ Faltan ${fmtCLP(-dif)}`);
}

async function confirmarCerrarCaja() {
  const contado = Number(document.getElementById('arqueoContado')?.value);
  if (!contado && contado !== 0) { showToast('Escribe el total contado', 'err'); return; }

  const esperado = Number(balanceActual?.cajaFisica) || 0;
  const dif = contado - esperado;

  /* Una diferencia grande casi siempre es un error de conteo o de
     tecleo, no un descuadre real. Se pide confirmar antes de dejarla
     grabada, porque el cierre no se puede deshacer. */
  if (Math.abs(dif) > 5000 &&
      !confirm(`La diferencia es de ${fmtCLP(Math.abs(dif))}.\n\n¿Seguro que el conteo es correcto? El cierre no se puede deshacer.`)) {
    return;
  }

  const btn = document.getElementById('btnConfirmarCerrarCaja');
  if (btn) btn.disabled = true;

  try {
    await API.balance.cerrarCaja({
      fecha: balanceActual?.arqueo?.fecha || todayISO(),
      contado, esperado,
      observaciones: document.getElementById('arqueoObservaciones')?.value || ''
    });
    showToast(dif === 0 ? 'Caja cerrada: cuadró exacto' : `Caja cerrada con ${fmtCLP(Math.abs(dif))} de diferencia`, 'ok');
    cerrarModal('modalCerrarCaja');
    cargarBalance();
  } catch (err) {
    showToast(err.message || 'No se pudo cerrar la caja', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
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
      <span>${i.fecha} · ${escaparTexto(i.metodo)}${i.descripcion ? ' · ' + escaparTexto(i.descripcion) : ''}</span>
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
          <strong>${escaparTexto(g.nombre)}</strong>
          <small>
            Día ${g.dia_mes} de cada mes · ${grupo.etiqueta}
            ${g.clasificacion ? ' · ' + escaparTexto(g.clasificacion) : ''}
            ${g.activo ? '' : ' · <span class="tag-pausado">Pausado</span>'}
          </small>
          ${g.notas ? `<small class="fijo-notas">${escaparTexto(g.notas)}</small>` : ''}
        </div>
        <b class="fijo-monto">${fmtCLP(g.monto)}</b>
        <div class="fijo-acciones">
          <button class="btn btn-mini" data-fijo-pausar="${g.id}"
                  title="${g.activo ? 'Pausar: deja de contar en el punto de equilibrio' : 'Reactivar'}">
            ${g.activo ? '⏸️' : '▶️'}
          </button>
          <button class="btn btn-mini" data-fijo-editar="${g.id}" title="Editar">✏️</button>
          <button class="btn btn-mini" data-fijo-borrar="${g.id}" title="Eliminar">🗑️</button>
        </div>
      </div>`;
  }).join('');

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

/* Escape básico: los nombres los escribe el usuario y van a innerHTML. */
function escaparTexto(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
