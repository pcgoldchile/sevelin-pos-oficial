// ==========================================
// UTILIDADES.JS — Finanzas → Utilidades
// ------------------------------------------
// Responde una sola pregunta, y la responde en capas: de todo lo que
// entró en el período, ¿cuánto es de verdad del negocio?
//
//   Ingresos brutos
//   − Costo de lo vendido        → UTILIDAD BRUTA
//   − Comisiones de tarjeta      ┐
//   − IVA a pagar (débito−créd.) ├ cada una se descuenta o no,
//   − Gastos operativos          ┘ según las casillas del usuario
//   = UTILIDAD DEL PERÍODO
//
// POR QUÉ LAS CASILLAS NO VUELVEN A CONSULTAR EL SERVIDOR
// El endpoint manda TODAS las partidas ya calculadas por separado, así
// que marcar/desmarcar recalcula en el navegador al instante. El
// servidor sigue siendo la única fuente de los montos: acá solo se
// suman o no las capas que ya vinieron.
//
// DOS ADVERTENCIAS CONTABLES QUE VAN SIEMPRE EN EL DOCUMENTO
//   1. El IVA de las ventas SIN DTE se queda como utilidad (decisión
//      del dueño). Es una vista de GESTIÓN, no una declaración: ante el
//      SII una venta sin documento igual genera débito fiscal.
//   2. La compra de mercadería (grupo INVENTARIO) no se descuenta como
//      gasto: ya está descontada como costo de lo vendido vía FIFO.
//      Restarla otra vez haría ver pérdidas al reponer stock.
// ==========================================

let utilInforme = null;                 // último informe recibido del servidor
let utilProyeccion = null;              // última proyección de flujo
let utilRemanente = null;               // remanente de crédito fiscal IVA
let utilRango = { desde: null, hasta: null, etiqueta: 'Este mes' };

/* Las tres capas descontables. `id` es el sufijo del checkbox en el
   HTML (chkUtilComisiones, chkUtilIva, chkUtilGastos) y `monto` sabe
   sacar su cifra del informe. Tener esto en una sola lista evita que
   la pantalla, el Excel y el PDF se contradigan entre sí. */
const UTIL_CAPAS = [
  {
    id: 'Comisiones',
    etiqueta: 'Comisiones de tarjeta',
    // `corta` va dentro de frases ("Descontando X, Y y Z"): poner ahí la
    // etiqueta larga en minúsculas dejaba cosas como "iva a pagar al sii"
    corta: 'comisiones',
    detalle: 'Lo que cobra la máquina de pago por cada transacción con tarjeta',
    monto: (inf) => inf.comisiones
  },
  {
    id: 'Iva',
    etiqueta: 'IVA a pagar al SII',
    corta: 'IVA',
    detalle: 'IVA débito de las ventas con boleta/factura, menos el crédito fiscal de las compras con factura',
    monto: (inf) => inf.iva.ivaAPagar
  },
  {
    id: 'Gastos',
    etiqueta: 'Gastos operativos',
    corta: 'gastos',
    detalle: 'Gastos fijos y variables del período (no incluye compra de mercadería)',
    monto: (inf) => inf.gastos.operativos
  }
];

document.addEventListener('DOMContentLoaded', () => {
  // Rangos rápidos del período
  document.querySelectorAll('[data-rango-util]').forEach(btn => {
    btn.addEventListener('click', () => aplicarRangoUtilidades(btn.dataset.rangoUtil));
  });
  document.getElementById('btnUtilRangoPersonalizado')
    ?.addEventListener('click', aplicarRangoUtilPersonalizado);

  // Las casillas solo repintan: los montos ya están en memoria
  UTIL_CAPAS.forEach(c => {
    document.getElementById('chkUtil' + c.id)?.addEventListener('change', pintarUtilidades);
  });

  // Exportación
  document.getElementById('btnUtilExcel')?.addEventListener('click', exportarUtilidadesExcel);
  document.getElementById('btnUtilPDF')?.addEventListener('click', exportarUtilidadesPDF);

  // IVA crédito fiscal
  document.getElementById('btnUtilAjustarIva')?.addEventListener('click', abrirModalAjusteIva);
  document.getElementById('btnGuardarAjusteIva')?.addEventListener('click', guardarAjusteIva);
  document.getElementById('btnCancelarAjusteIva')
    ?.addEventListener('click', () => cerrarModal('modalAjusteIva'));

  // Calculadora de flujo
  document.getElementById('btnUtilProyectar')?.addEventListener('click', cargarProyeccionCaja);

  // Borrado por período
  document.getElementById('btnUtilBorrarPeriodo')?.addEventListener('click', abrirModalBorrarPeriodo);
  document.getElementById('btnConfirmarBorrarPeriodo')?.addEventListener('click', confirmarBorrarPeriodo);
  document.getElementById('btnCancelarBorrarPeriodo')
    ?.addEventListener('click', () => cerrarModal('modalBorrarPeriodo'));

  ['modalAjusteIva', 'modalBorrarPeriodo'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => { if (e.target.id === id) cerrarModal(id); });
  });
});

/* ============================================================
   RANGO DE FECHAS
   Se calcula con todayISO() (hora de Chile): usar `new Date()` a secas
   desplaza el día después de las 20:00 — misma trampa que ya documenta
   balance.js.
   ============================================================ */
function calcularRangoUtilidades(clave) {
  const hoy = todayISO();
  const [a, m, d] = hoy.split('-').map(Number);
  const iso = (y, mes, dia) =>
    `${y}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

  const restarDias = (n) => {
    const ref = new Date(Date.UTC(a, m - 1, d));
    ref.setUTCDate(ref.getUTCDate() - n);
    return ref.toISOString().slice(0, 10);
  };

  if (clave === 'hoy') return { desde: hoy, hasta: hoy, etiqueta: 'Hoy' };

  if (clave === 'ayer') {
    const ayer = restarDias(1);
    return { desde: ayer, hasta: ayer, etiqueta: 'Ayer' };
  }

  /* "Esta semana" = los últimos 7 días corridos, incluyendo hoy. Para un
     negocio abierto todos los días es la comparación útil; "desde el
     lunes" haría que un lunes muestre un solo día. */
  if (clave === 'semana') {
    return { desde: restarDias(6), hasta: hoy, etiqueta: 'Esta semana (7 días)' };
  }

  if (clave === 'mes') return { desde: iso(a, m, 1), hasta: hoy, etiqueta: 'Este mes' };

  if (clave === 'mes-anterior') {
    const mesAnt = m === 1 ? 12 : m - 1;
    const anioAnt = m === 1 ? a - 1 : a;
    const ultimo = new Date(Date.UTC(anioAnt, mesAnt, 0)).getUTCDate();
    return {
      desde: iso(anioAnt, mesAnt, 1),
      hasta: iso(anioAnt, mesAnt, ultimo),
      etiqueta: 'Mes anterior'
    };
  }

  return { desde: iso(a, m, 1), hasta: hoy, etiqueta: 'Este mes' };
}

function aplicarRangoUtilidades(clave) {
  utilRango = calcularRangoUtilidades(clave);
  document.querySelectorAll('[data-rango-util]').forEach(b => {
    b.classList.toggle('activo', b.dataset.rangoUtil === clave);
  });

  const dEl = document.getElementById('utilDesde');
  const hEl = document.getElementById('utilHasta');
  if (dEl) dEl.value = utilRango.desde;
  if (hEl) hEl.value = utilRango.hasta;

  cargarUtilidades();
}

function aplicarRangoUtilPersonalizado() {
  const desde = document.getElementById('utilDesde')?.value;
  const hasta = document.getElementById('utilHasta')?.value;

  if (!desde || !hasta) { showToast('Elige las dos fechas', 'err'); return; }
  if (desde > hasta) { showToast('La fecha inicial no puede ser posterior a la final', 'err'); return; }

  utilRango = { desde, hasta, etiqueta: 'Período personalizado' };
  document.querySelectorAll('[data-rango-util]').forEach(b => b.classList.remove('activo'));
  cargarUtilidades();
}

/* ============================================================
   CARGA
   ============================================================ */
async function cargarUtilidades() {
  if (!esAdmin()) return;
  if (!utilRango.desde) utilRango = calcularRangoUtilidades('mes');

  const caja = document.getElementById('utilContenido');
  if (caja) caja.classList.add('cargando');

  try {
    utilInforme = await API.balance.utilidades(utilRango.desde, utilRango.hasta);
    utilRemanente = await API.balance.ivaRemanente(utilRango.hasta);
    pintarUtilidades();
  } catch (err) {
    console.error('Error al cargar utilidades:', err.message || err);
    showToast(err.message || 'No se pudieron cargar las utilidades', 'err');
  } finally {
    if (caja) caja.classList.remove('cargando');
  }
}

// Qué capas están marcadas ahora mismo
function capasUtilActivas() {
  return UTIL_CAPAS.filter(c => document.getElementById('chkUtil' + c.id)?.checked);
}

/* La utilidad final según las casillas marcadas. Es la única función que
   decide el número grande: la usan la pantalla, el Excel y el PDF. */
function utilidadSegunCasillas(inf) {
  const activas = capasUtilActivas();
  const descontado = activas.reduce((a, c) => a + c.monto(inf), 0);
  return {
    activas,
    descontado,
    utilidad: inf.utilidadBruta - descontado,
    margen: inf.ingresos > 0 ? ((inf.utilidadBruta - descontado) / inf.ingresos) * 100 : 0
  };
}

/* ============================================================
   PINTADO
   ============================================================ */
function pintarUtilidades() {
  if (!utilInforme) return;
  const inf = utilInforme;
  const set = (id, valor) => { const el = document.getElementById(id); if (el) el.textContent = valor; };

  const { activas, utilidad, margen } = utilidadSegunCasillas(inf);

  set('utilPeriodo', `${inf.periodo.desde} al ${inf.periodo.hasta} · ${utilRango.etiqueta}`);

  // --- Cifras principales ---
  set('utilBrutaMonto', fmtCLP(inf.utilidadBruta));
  set('utilBrutaDetalle',
    `${fmtCLP(inf.ingresos)} vendidos − ${fmtCLP(inf.costoVendido)} de costo · margen ${inf.margenBruto.toFixed(1)}%`);

  set('utilNetaMonto', fmtCLP(utilidad));
  set('utilNetaDetalle', activas.length
    ? `Descontando ${activas.map(c => c.corta).join(', ')} · margen ${margen.toFixed(1)}%`
    : 'Sin descuentos aplicados — marca las casillas de abajo');

  const netaEl = document.getElementById('utilNetaMonto');
  if (netaEl) netaEl.classList.toggle('kpi-negativo', utilidad < 0);

  set('utilVentasMonto', fmtCLP(inf.ingresos));
  set('utilVentasDetalle', `${inf.cantidadVentas} venta(s) · ticket ${fmtCLP(inf.ticketPromedio)}`);

  // --- Cascada: de bruto a final, línea por línea ---
  const filas = [
    { etiqueta: 'Ingresos brutos', detalle: `${inf.cantidadVentas} ventas cobradas`, monto: inf.ingresos, tipo: 'suma' },
    { etiqueta: 'Costo de lo vendido', detalle: 'Lo que costó comprar lo que se vendió (FIFO)', monto: -inf.costoVendido, tipo: 'resta' },
    { etiqueta: 'UTILIDAD BRUTA', detalle: `Margen ${inf.margenBruto.toFixed(1)}%`, monto: inf.utilidadBruta, tipo: 'subtotal' }
  ];

  UTIL_CAPAS.forEach(c => {
    const aplicada = activas.includes(c);
    filas.push({
      etiqueta: c.etiqueta,
      detalle: aplicada ? c.detalle : 'No descontado (casilla desmarcada)',
      monto: aplicada ? -c.monto(inf) : 0,
      tipo: aplicada ? 'resta' : 'ignorada',
      montoIgnorado: c.monto(inf)
    });
  });

  filas.push({
    etiqueta: 'UTILIDAD DEL PERÍODO',
    detalle: `Margen ${margen.toFixed(1)}% sobre lo vendido`,
    monto: utilidad,
    tipo: 'total'
  });

  const cascada = document.getElementById('utilCascada');
  if (cascada) {
    cascada.innerHTML = filas.map(f => `
      <div class="util-fila util-fila-${f.tipo}">
        <div class="util-fila-texto">
          <span class="util-fila-etiqueta">${escHtml(f.etiqueta)}</span>
          <small>${escHtml(f.detalle)}</small>
        </div>
        <b class="util-fila-monto ${f.monto < 0 ? 'util-monto-resta' : ''}">${
          f.tipo === 'ignorada'
            ? `<span class="util-tachado">${escHtml(fmtCLP(f.montoIgnorado))}</span>`
            : escHtml(fmtCLP(f.monto))
        }</b>
      </div>`).join('');
  }

  pintarBloqueIva(inf);
  pintarBloqueGastos(inf);
}

function pintarBloqueIva(inf) {
  const set = (id, valor) => { const el = document.getElementById(id); if (el) el.textContent = valor; };
  const iva = inf.iva;

  set('utilIvaDebito', fmtCLP(iva.ivaDebito));
  set('utilIvaDebitoDetalle', `De ${fmtCLP(iva.ventasConDte)} vendidos con boleta o factura`);

  set('utilIvaCredito', fmtCLP(iva.ivaCredito));
  set('utilIvaCreditoDetalle', 'IVA de las compras del período respaldadas con factura');

  set('utilIvaPagar', fmtCLP(iva.ivaAPagar));
  set('utilIvaPagarDetalle', iva.remanenteGenerado > 0
    ? `El crédito superó al débito: genera ${fmtCLP(iva.remanenteGenerado)} de remanente`
    : 'Débito menos crédito fiscal del período');

  set('utilIvaRetenido', fmtCLP(iva.ivaRetenidoSinDte));
  set('utilIvaRetenidoDetalle',
    `Contenido en ${fmtCLP(iva.ventasSinDte)} vendidos sin DTE · se registra como utilidad`);

  set('utilIvaRemanente', fmtCLP(utilRemanente?.remanente || 0));
}

function pintarBloqueGastos(inf) {
  const set = (id, valor) => { const el = document.getElementById(id); if (el) el.textContent = valor; };
  const g = inf.gastos;

  set('utilGastosFijos', fmtCLP(g.fijos));
  set('utilGastosVariables', fmtCLP(g.variables));
  set('utilGastosOperativos', fmtCLP(g.operativos));
  set('utilGastosInventario', fmtCLP(g.inventario));

  const lista = document.getElementById('utilGastosClasificacion');
  if (!lista) return;

  const entradas = Object.entries(g.porClasificacion || {}).sort((a, b) => b[1] - a[1]);
  if (!entradas.length) {
    lista.innerHTML = '<p class="vacio-nota">Sin gastos operativos en el período</p>';
    return;
  }

  const max = Math.max(...entradas.map(([, v]) => v)) || 1;
  lista.innerHTML = entradas.map(([nombre, monto]) => `
    <div class="rank-fila">
      <div class="rank-cuerpo">
        <div class="rank-cabecera">
          <span class="rank-nombre">${escHtml(nombre)}</span>
          <b>${escHtml(fmtCLP(monto))}</b>
        </div>
        <div class="barra-pista">
          <div class="barra-relleno" style="width:${Math.max(2, (monto / max) * 100)}%"></div>
        </div>
      </div>
    </div>`).join('');
}

/* ============================================================
   IVA — AJUSTE MANUAL DEL REMANENTE DE CRÉDITO FISCAL
   El remanente NO se guarda: se recalcula mes a mes desde el histórico
   (ver calcularRemanenteIva en el backend). Estos ajustes son deltas
   con motivo, y sirven sobre todo para cargar el remanente que venía de
   antes de usar el sistema.
   ============================================================ */
function abrirModalAjusteIva() {
  const modal = document.getElementById('modalAjusteIva');
  if (!modal) return;

  const actual = document.getElementById('ajusteIvaActual');
  if (actual) actual.textContent = fmtCLP(utilRemanente?.remanente || 0);

  const monto = document.getElementById('ajusteIvaMonto');
  const motivo = document.getElementById('ajusteIvaMotivo');
  const fecha = document.getElementById('ajusteIvaFecha');
  if (monto) monto.value = '';
  if (motivo) motivo.value = '';
  if (fecha) fecha.value = todayISO();

  pintarHistorialAjustesIva();
  modal.classList.add('show');
  setTimeout(() => monto?.focus(), 80);
}

function pintarHistorialAjustesIva() {
  const caja = document.getElementById('ajusteIvaHistorial');
  if (!caja) return;

  const ajustes = utilRemanente?.ajustes || [];
  if (!ajustes.length) {
    caja.innerHTML = '<p class="vacio-nota">Sin ajustes registrados</p>';
    return;
  }

  caja.innerHTML = ajustes.slice().reverse().map(a => `
    <div class="util-ajuste-fila">
      <div>
        <b class="${num(a.monto) < 0 ? 'texto-rojo' : 'texto-verde'}">${
          num(a.monto) > 0 ? '+' : ''}${escHtml(fmtCLP(num(a.monto)))}</b>
        <small>${escHtml(a.fecha)}</small>
      </div>
      <small class="util-ajuste-motivo">${escHtml(a.motivo)}</small>
    </div>`).join('');
}

async function guardarAjusteIva() {
  const monto = Number(document.getElementById('ajusteIvaMonto')?.value) || 0;
  const motivo = (document.getElementById('ajusteIvaMotivo')?.value || '').trim();
  const fecha = document.getElementById('ajusteIvaFecha')?.value || todayISO();

  if (!monto) { showToast('El ajuste no puede ser $0', 'err'); return; }
  if (motivo.length < 5) { showToast('Escribe el motivo del ajuste', 'err'); return; }

  const btn = document.getElementById('btnGuardarAjusteIva');
  if (btn) btn.disabled = true;

  try {
    await API.balance.ivaAjustar({ monto, motivo, fecha });
    showToast('Ajuste de IVA registrado', 'ok');
    cerrarModal('modalAjusteIva');
    await cargarUtilidades();
  } catch (err) {
    showToast(err.message || 'No se pudo guardar el ajuste', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ============================================================
   CALCULADORA DE FLUJO DE CAJA
   Proyecta con percentiles de la serie diaria real (los días cerrados
   cuentan como $0). Se usan percentiles y no promedios a propósito: un
   solo día excepcional levanta el promedio y hace planificar con plata
   que normalmente no llega.
   ============================================================ */
async function cargarProyeccionCaja() {
  if (!esAdmin()) return;

  const dias = Number(document.getElementById('proyDias')?.value) || 30;
  const historico = Number(document.getElementById('proyHistorico')?.value) || 90;

  const btn = document.getElementById('btnUtilProyectar');
  if (btn) btn.disabled = true;

  try {
    utilProyeccion = await API.balance.proyeccion(dias, historico);

    // El saldo disponible hoy es lo que vuelve accionable la proyección
    let saldos = null;
    try { saldos = await API.balance.saldos(); } catch (_) { saldos = null; }

    pintarProyeccionCaja(utilProyeccion, saldos);
  } catch (err) {
    showToast(err.message || 'No se pudo calcular la proyección', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function pintarProyeccionCaja(p, saldos) {
  const set = (id, valor) => { const el = document.getElementById(id); if (el) el.textContent = valor; };
  const h = p.historia;

  set('proyResumen',
    `${h.diasAnalizados} días analizados (${p.parametros.desde} al ${p.parametros.hasta}) · ` +
    `${h.diasConVenta} con ventas, ${h.diasSinVenta} sin ventas`);

  set('proyPromedios',
    `Promedio: ${fmtCLP(h.promedioIngresoDiario)} de ingreso y ${fmtCLP(h.promedioEgresoDiario)} de gasto por día · ` +
    `mejor día ${fmtCLP(h.mejorDia)}`);

  const saldoActual = num(saldos?.total);
  const resguardo = num(p.resguardo);

  const CLASES = { Conservador: 'esc-conservador', Probable: 'esc-probable', Excelente: 'esc-excelente' };
  const ICONOS = { Conservador: '🛡️', Probable: '📊', Excelente: '🚀' };

  const caja = document.getElementById('proyEscenarios');
  if (caja) {
    caja.innerHTML = p.escenarios.map(e => {
      /* Cuánto se puede comprometer sin bajar del resguardo: lo que hay
         hoy, más lo que este escenario proyecta que entrará neto, menos
         el colchón que el dueño definió como intocable. */
      const disponible = saldoActual + e.netoProyectado - resguardo;
      return `
        <div class="proy-card ${CLASES[e.nombre] || ''}">
          <div class="proy-card-head">
            <span class="proy-nombre">${ICONOS[e.nombre] || ''} ${escHtml(e.nombre)}</span>
            <small title="Percentil usado para ventas y para gastos">
              p${e.percentil} ventas · p${e.percentilGasto} gastos
            </small>
          </div>
          <p class="proy-desc">${escHtml(e.descripcion)}</p>

          <div class="proy-linea">
            <span>Ingreso diario estimado</span><b>${escHtml(fmtCLP(e.ingresoDiario))}</b>
          </div>
          <div class="proy-linea">
            <span>Gasto diario estimado</span><b>${escHtml(fmtCLP(e.egresoDiario))}</b>
          </div>
          <div class="proy-linea proy-linea-fuerte">
            <span>Entrada neta en ${p.parametros.dias} días</span>
            <b class="${e.netoProyectado < 0 ? 'texto-rojo' : 'texto-verde'}">${escHtml(fmtCLP(e.netoProyectado))}</b>
          </div>
          <div class="proy-linea proy-linea-total">
            <span>Podrías gastar hasta</span>
            <b class="${disponible < 0 ? 'texto-rojo' : ''}">${escHtml(fmtCLP(Math.max(0, disponible)))}</b>
          </div>
          <small class="proy-nota">Saldo hoy ${fmtCLP(saldoActual)} + proyección − resguardo ${fmtCLP(resguardo)}</small>
        </div>`;
    }).join('');
  }

  document.getElementById('proyResultado')?.classList.remove('hidden');
}

/* ============================================================
   EXPORTACIÓN A EXCEL
   4 hojas: Resumen (el estado de resultados legible), Ventas, Gastos e
   IVA. La hoja Resumen está pensada para que un contador la lea de
   corrido, con las notas metodológicas incluidas.
   ============================================================ */
function exportarUtilidadesExcel() {
  if (!utilInforme) { showToast('Carga primero un período', 'err'); return; }

  const inf = utilInforme;
  const { activas, utilidad, margen } = utilidadSegunCasillas(inf);
  const aplicada = (capa) => (activas.includes(capa) ? 'Sí' : 'No');

  const libro = XLSX.utils.book_new();
  const negocio = (typeof NEGOCIO_NOMBRE !== 'undefined' && NEGOCIO_NOMBRE) ? NEGOCIO_NOMBRE : 'Sevelin';

  /* --- Hoja 1: Resumen ---
     Se arma como matriz (aoa) y no desde objetos, porque un estado de
     resultados necesita filas de título y separadores que un
     json_to_sheet no sabe producir. */
  const R = [
    [`${negocio} — Informe de Utilidades`],
    [`Período: ${inf.periodo.desde} al ${inf.periodo.hasta} (${utilRango.etiqueta})`],
    [`Generado: ${todayISO()}`],
    [],
    ['ESTADO DE RESULTADOS', '', 'Monto', 'Descontado'],
    ['Ingresos brutos', `${inf.cantidadVentas} ventas cobradas`, inf.ingresos, ''],
    ['Costo de lo vendido', 'Costo real de la mercadería vendida (FIFO)', -inf.costoVendido, 'Sí'],
    ['UTILIDAD BRUTA', `Margen ${inf.margenBruto.toFixed(1)}%`, inf.utilidadBruta, ''],
    []
  ];

  UTIL_CAPAS.forEach(c => {
    R.push([c.etiqueta, c.detalle, -c.monto(inf), aplicada(c)]);
  });

  R.push(
    [],
    ['UTILIDAD DEL PERÍODO', `Margen ${margen.toFixed(1)}% sobre lo vendido`, utilidad, ''],
    [],
    ['DESGLOSE DE IVA', '', '', ''],
    ['Ventas con DTE (boleta/factura)', '', inf.iva.ventasConDte, ''],
    ['Ventas sin DTE', '', inf.iva.ventasSinDte, ''],
    ['IVA débito fiscal', 'Contenido en las ventas con DTE', inf.iva.ivaDebito, ''],
    ['IVA crédito fiscal', 'De las compras del período con factura', -inf.iva.ivaCredito, ''],
    ['IVA a pagar al SII', 'Débito menos crédito (nunca negativo)', inf.iva.ivaAPagar, ''],
    ['Remanente generado en el período', 'Crédito no usado, se arrastra al mes siguiente', inf.iva.remanenteGenerado, ''],
    ['Remanente acumulado al cierre', 'Crédito fiscal disponible a la fecha', inf.remanenteIva, ''],
    ['IVA retenido como utilidad', 'Contenido en las ventas SIN DTE — ver nota 1', inf.iva.ivaRetenidoSinDte, ''],
    [],
    ['DESGLOSE DE GASTOS', '', '', ''],
    ['Gastos fijos pagados', 'Vinculados a la lista de gastos fijos', inf.gastos.fijos, ''],
    ['Gastos variables', 'El resto de los gastos operativos', inf.gastos.variables, ''],
    ['Total gastos operativos', 'Fijos + variables (esto es lo que descuenta la casilla)', inf.gastos.operativos, ''],
    ['Compra de mercadería', 'Inventario — NO se descuenta, ver nota 2', inf.gastos.inventario, ''],
    [],
    ['NOTAS METODOLÓGICAS'],
    ['1', 'Los precios del sistema incluyen IVA. El neto es total / 1,19 y el IVA es la diferencia.'],
    ['', 'El IVA de las ventas SIN DTE se registra como utilidad por decisión de la administración.'],
    ['', 'ADVERTENCIA: es una vista de gestión, no una declaración de impuestos. Ante el SII una'],
    ['', 'venta sin documento igualmente genera débito fiscal. Consulte a su contador.'],
    ['2', 'La compra de mercadería (grupo Inventario) no se descuenta como gasto porque ya está'],
    ['', 'descontada como costo de lo vendido cuando el producto se vende (método FIFO).'],
    ['', 'Restarla otra vez mostraría pérdidas cada vez que se repone stock.'],
    ['3', 'Los gastos fijos ya pagados se registran como gasto normal, así que están incluidos una'],
    ['', 'sola vez dentro del total de gastos operativos. El desglose fijos/variables no se suma.']
  );

  const hojaResumen = XLSX.utils.aoa_to_sheet(R);
  hojaResumen['!cols'] = [{ wch: 34 }, { wch: 56 }, { wch: 16 }, { wch: 12 }];
  formatearMontosHoja(hojaResumen, [2]);
  XLSX.utils.book_append_sheet(libro, hojaResumen, 'Resumen');

  // --- Hoja 2: Ventas ---
  const hojaVentas = XLSX.utils.json_to_sheet(inf.detalleVentas.map(v => ({
    'Fecha': v.fecha,
    'N° Orden': v.numero_orden,
    'Cliente': v.cliente || '',
    'Documento': v.tipo_dte,
    'Medio de pago': v.metodo_pago || '',
    'Total': v.total,
    'Costo': v.costo,
    'Utilidad': v.utilidad,
    'Comisión': v.comision,
    'IVA débito': v.iva,
    'IVA retenido (sin DTE)': v.ivaRetenido
  })));
  hojaVentas['!cols'] = [
    { wch: 20 }, { wch: 12 }, { wch: 26 }, { wch: 12 }, { wch: 16 },
    { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 12 }, { wch: 13 }, { wch: 20 }
  ];
  formatearMontosHoja(hojaVentas, [5, 6, 7, 8, 9, 10]);
  XLSX.utils.book_append_sheet(libro, hojaVentas, 'Ventas');

  // --- Hoja 3: Gastos ---
  const hojaGastos = XLSX.utils.json_to_sheet(inf.detalleGastos.map(g => ({
    'Fecha': g.fecha,
    'Proveedor': g.proveedor || '',
    'Clasificación': g.clasificacion || '',
    'Grupo': g.grupo,
    'Tipo': g.tipo,
    'Detalle': g.descripcion || '',
    'Pagado con': g.metodo_pago || '',
    'Monto': g.costo_total,
    '¿Con factura?': g.tiene_factura ? 'Sí' : 'No',
    'IVA crédito': g.iva_credito
  })));
  hojaGastos['!cols'] = [
    { wch: 20 }, { wch: 24 }, { wch: 22 }, { wch: 13 }, { wch: 10 },
    { wch: 30 }, { wch: 16 }, { wch: 13 }, { wch: 14 }, { wch: 13 }
  ];
  formatearMontosHoja(hojaGastos, [7, 9]);
  XLSX.utils.book_append_sheet(libro, hojaGastos, 'Gastos');

  // --- Hoja 4: IVA mes a mes (el arrastre del remanente) ---
  const detalleIva = utilRemanente?.detalle || [];
  if (detalleIva.length) {
    const hojaIva = XLSX.utils.json_to_sheet(detalleIva.map(m => ({
      'Mes': m.mes,
      'Remanente inicial': m.remanenteInicial,
      'IVA débito': m.debito,
      'IVA crédito': m.credito,
      'Ajustes manuales': m.ajustes,
      'IVA a pagar': m.aPagar,
      'Remanente final': m.remanenteFinal
    })));
    hojaIva['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 17 }, { wch: 14 }, { wch: 17 }];
    formatearMontosHoja(hojaIva, [1, 2, 3, 4, 5, 6]);
    XLSX.utils.book_append_sheet(libro, hojaIva, 'IVA mes a mes');
  }

  XLSX.writeFile(libro, `utilidades_${inf.periodo.desde}_a_${inf.periodo.hasta}.xlsx`);
  showToast('Planilla de utilidades descargada', 'ok');
}

/* Aplica formato de peso chileno a las columnas indicadas (índice 0).
   SheetJS en su versión community no permite colores ni bordes, pero el
   formato numérico sí viaja: sin esto los montos se abren como números
   pelados y el contador tiene que formatearlos a mano. */
function formatearMontosHoja(hoja, columnas) {
  const rango = XLSX.utils.decode_range(hoja['!ref'] || 'A1');
  for (let fila = rango.s.r; fila <= rango.e.r; fila++) {
    columnas.forEach(col => {
      const celda = hoja[XLSX.utils.encode_cell({ r: fila, c: col })];
      if (celda && typeof celda.v === 'number') {
        celda.z = '"$"#,##0;[Red]-"$"#,##0';
        celda.t = 'n';
      }
    });
  }
}

/* ============================================================
   EXPORTACIÓN A PDF
   Documento de una o dos páginas pensado para imprimir y entregar:
   encabezado con el período, tarjetas con las tres cifras que
   importan, el estado de resultados como cascada, el desglose de IVA
   y las notas metodológicas.
   ============================================================ */
function exportarUtilidadesPDF() {
  if (!utilInforme) { showToast('Carga primero un período', 'err'); return; }

  const inf = utilInforme;
  const { activas, utilidad, margen } = utilidadSegunCasillas(inf);
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const negocio = (typeof NEGOCIO_NOMBRE !== 'undefined' && NEGOCIO_NOMBRE) ? NEGOCIO_NOMBRE : 'Sevelin';

  // Paleta: el cian/magenta de la marca, apagado lo justo para papel
  const TINTA = [15, 23, 42];
  const CIAN = [8, 145, 178];
  const MAGENTA = [190, 24, 93];
  const GRIS = [100, 116, 139];
  const ancho = doc.internal.pageSize.getWidth();

  // --- Encabezado ---
  doc.setFillColor(...TINTA);
  doc.rect(0, 0, ancho, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont(undefined, 'bold');
  doc.text(`${negocio}`, 14, 13);
  doc.setFontSize(11);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(103, 232, 249);
  doc.text('Informe de Utilidades', 14, 21);

  doc.setTextColor(203, 213, 225);
  doc.setFontSize(8.5);
  doc.text(`${inf.periodo.desde} al ${inf.periodo.hasta}`, ancho - 14, 13, { align: 'right' });
  doc.text(utilRango.etiqueta, ancho - 14, 19, { align: 'right' });
  doc.text(`Emitido ${todayISO()}`, ancho - 14, 25, { align: 'right' });

  // --- Tres tarjetas con lo esencial ---
  const tarjetas = [
    { titulo: 'VENDIDO', valor: fmtCLP(inf.ingresos), pie: `${inf.cantidadVentas} ventas`, color: GRIS },
    { titulo: 'UTILIDAD BRUTA', valor: fmtCLP(inf.utilidadBruta), pie: `Margen ${inf.margenBruto.toFixed(1)}%`, color: CIAN },
    { titulo: 'UTILIDAD DEL PERÍODO', valor: fmtCLP(utilidad), pie: `Margen ${margen.toFixed(1)}%`, color: utilidad < 0 ? [220, 38, 38] : MAGENTA }
  ];

  const anchoT = (ancho - 28 - 8) / 3;
  tarjetas.forEach((t, i) => {
    const x = 14 + i * (anchoT + 4);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, 37, anchoT, 26, 2, 2, 'F');
    doc.setDrawColor(...t.color);
    doc.setLineWidth(0.8);
    doc.line(x, 37, x + anchoT, 37);

    doc.setTextColor(...GRIS);
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text(t.titulo, x + 4, 44);

    doc.setTextColor(...t.color);
    doc.setFontSize(13);
    doc.text(t.valor, x + 4, 53);

    doc.setTextColor(...GRIS);
    doc.setFontSize(7.5);
    doc.setFont(undefined, 'normal');
    doc.text(t.pie, x + 4, 59);
  });

  // --- Estado de resultados ---
  const cuerpo = [
    ['Ingresos brutos', `${inf.cantidadVentas} ventas cobradas`, fmtCLP(inf.ingresos), ''],
    ['Costo de lo vendido', 'Costo real de lo vendido (FIFO)', `- ${fmtCLP(inf.costoVendido)}`, 'Sí'],
    ['UTILIDAD BRUTA', `Margen ${inf.margenBruto.toFixed(1)}%`, fmtCLP(inf.utilidadBruta), '']
  ];

  UTIL_CAPAS.forEach(c => {
    const on = activas.includes(c);
    cuerpo.push([
      c.etiqueta,
      on ? c.detalle : 'No descontado en este informe',
      on ? `- ${fmtCLP(c.monto(inf))}` : fmtCLP(c.monto(inf)),
      on ? 'Sí' : 'No'
    ]);
  });

  cuerpo.push(['UTILIDAD DEL PERÍODO', `Margen ${margen.toFixed(1)}% sobre lo vendido`, fmtCLP(utilidad), '']);

  doc.autoTable({
    startY: 70,
    head: [['Concepto', 'Explicación', 'Monto', '¿Descontado?']],
    body: cuerpo,
    styles: { fontSize: 8.5, cellPadding: 3, textColor: TINTA },
    headStyles: { fillColor: TINTA, textColor: [248, 250, 252], fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 46, fontStyle: 'bold' },
      1: { cellWidth: 74, textColor: GRIS, fontSize: 7.5 },
      2: { cellWidth: 32, halign: 'right' },
      3: { cellWidth: 24, halign: 'center', fontSize: 7.5 }
    },
    /* Las dos filas de resultado (bruta y del período) van resaltadas:
       son las que el ojo tiene que encontrar sin leer la tabla entera. */
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const etiqueta = cuerpo[data.row.index][0];
      if (etiqueta === 'UTILIDAD BRUTA') {
        data.cell.styles.fillColor = [236, 254, 255];
        data.cell.styles.fontStyle = 'bold';
      }
      if (etiqueta === 'UTILIDAD DEL PERÍODO') {
        data.cell.styles.fillColor = utilidad < 0 ? [254, 226, 226] : [253, 242, 248];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 9.5;
      }
      // Una capa no descontada se muestra atenuada: está informada, no aplicada
      if (cuerpo[data.row.index][3] === 'No') data.cell.styles.textColor = [148, 163, 184];
    }
  });

  // --- Desglose de IVA ---
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 8,
    head: [['Desglose de IVA', 'Monto']],
    body: [
      ['Ventas con DTE (boleta / factura)', fmtCLP(inf.iva.ventasConDte)],
      ['Ventas sin DTE', fmtCLP(inf.iva.ventasSinDte)],
      ['IVA débito fiscal (ventas con DTE)', fmtCLP(inf.iva.ivaDebito)],
      ['IVA crédito fiscal (compras con factura)', `- ${fmtCLP(inf.iva.ivaCredito)}`],
      ['IVA a pagar al SII', fmtCLP(inf.iva.ivaAPagar)],
      ['Remanente generado en el período', fmtCLP(inf.iva.remanenteGenerado)],
      ['Remanente acumulado al cierre', fmtCLP(inf.remanenteIva)],
      ['IVA retenido como utilidad (ventas sin DTE) — ver nota 1', fmtCLP(inf.iva.ivaRetenidoSinDte)]
    ],
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: TINTA },
    headStyles: { fillColor: CIAN, textColor: [255, 255, 255], fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 140 }, 1: { halign: 'right' } }
  });

  // --- Desglose de gastos ---
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 6,
    head: [['Desglose de gastos', 'Monto']],
    body: [
      ['Gastos fijos pagados en el período', fmtCLP(inf.gastos.fijos)],
      ['Gastos variables', fmtCLP(inf.gastos.variables)],
      ['Total gastos operativos (lo que descuenta la casilla)', fmtCLP(inf.gastos.operativos)],
      ['Compra de mercadería (inventario) — no se descuenta, ver nota 2', fmtCLP(inf.gastos.inventario)]
    ],
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: TINTA },
    headStyles: { fillColor: MAGENTA, textColor: [255, 255, 255], fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 0: { cellWidth: 140 }, 1: { halign: 'right' } }
  });

  // --- Notas metodológicas ---
  let y = doc.lastAutoTable.finalY + 8;
  if (y > 245) { doc.addPage(); y = 20; }

  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(...TINTA);
  doc.text('Notas metodológicas', 14, y);
  y += 5;

  doc.setFont(undefined, 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(...GRIS);

  const notas = [
    '1. Los precios incluyen IVA: el neto es total / 1,19 y el IVA es la diferencia. El IVA de las ventas SIN documento se ' +
    'registra como utilidad por decisión de la administración. ADVERTENCIA: esta es una vista de gestión, no una declaración ' +
    'de impuestos — ante el SII una venta sin documento igualmente genera débito fiscal. Consulte a su contador.',
    '2. La compra de mercadería (grupo Inventario) no se descuenta como gasto: ya está descontada como costo de lo vendido ' +
    'cuando el producto se vende (FIFO). Restarla otra vez mostraría pérdidas cada vez que se repone stock.',
    '3. Los gastos fijos ya pagados se registran como un gasto más, por lo que están incluidos una sola vez dentro del total ' +
    'de gastos operativos. El desglose fijos / variables reparte ese mismo total, no lo suma dos veces.',
    '4. Solo se consideran las ventas en estado PAGADA. Las ventas por cobrar no entran hasta que se cobran.'
  ];

  notas.forEach(n => {
    const lineas = doc.splitTextToSize(n, ancho - 28);
    doc.text(lineas, 14, y);
    y += lineas.length * 3.4 + 2.5;
  });

  // --- Pie de página en todas las hojas ---
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`${negocio} · Informe de utilidades · ${inf.periodo.desde} a ${inf.periodo.hasta}`, 14,
      doc.internal.pageSize.getHeight() - 8);
    doc.text(`Página ${i} de ${total}`, ancho - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
  }

  doc.save(`utilidades_${inf.periodo.desde}_a_${inf.periodo.hasta}.pdf`);
  showToast('PDF de utilidades descargado', 'ok');
}

/* ============================================================
   BORRADO CONTABLE POR PERÍODO
   Destructivo y sin vuelta atrás. Por eso: fechas explícitas, elección
   de qué se borra, conteo previo de lo que se va a perder, PIN de
   administrador y confirmación escrita.
   ============================================================ */
function abrirModalBorrarPeriodo() {
  const modal = document.getElementById('modalBorrarPeriodo');
  if (!modal) return;

  // Arranca con el período que se está mirando: es el error menos probable
  const d = document.getElementById('borrarDesde');
  const h = document.getElementById('borrarHasta');
  if (d) d.value = utilRango.desde || todayISO();
  if (h) h.value = utilRango.hasta || todayISO();

  const conf = document.getElementById('borrarConfirmacion');
  if (conf) conf.value = '';

  modal.classList.add('show');
}

async function confirmarBorrarPeriodo() {
  const desde = document.getElementById('borrarDesde')?.value;
  const hasta = document.getElementById('borrarHasta')?.value;

  if (!desde || !hasta) { showToast('Elige el rango de fechas a borrar', 'err'); return; }
  if (desde > hasta) { showToast('La fecha inicial no puede ser posterior a la final', 'err'); return; }

  const incluir = Array.from(document.querySelectorAll('[data-borrar-tipo]'))
    .filter(c => c.checked).map(c => c.dataset.borrarTipo);

  if (!incluir.length) { showToast('Marca al menos qué quieres borrar', 'err'); return; }

  /* Confirmación escrita: en una operación irreversible, un "¿seguro?"
     se acepta por reflejo. Escribir la palabra obliga a leer. */
  const escrito = (document.getElementById('borrarConfirmacion')?.value || '').trim().toUpperCase();
  if (escrito !== 'BORRAR') {
    showToast('Escribe BORRAR para confirmar', 'err');
    return;
  }

  const nombres = {
    ventas: 'ventas (repone el stock)',
    gastos: 'gastos y compras',
    aportes: 'aportes de capital',
    arqueos: 'arqueos, ajustes y traspasos'
  };

  const pin = await pedirPinAdmin({
    titulo: '🗑️ Borrar balance del período',
    mensaje: 'Esta acción NO se puede deshacer. Se eliminarán definitivamente los registros del período elegido.',
    resumen: `${desde} al ${hasta}\n\nSe borrará: ${incluir.map(i => nombres[i] || i).join(', ')}`,
    textoBoton: 'Borrar definitivamente'
  });
  if (!pin) return;

  const btn = document.getElementById('btnConfirmarBorrarPeriodo');
  if (btn) btn.disabled = true;

  try {
    const r = await API.balance.borrarPeriodo({ desde, hasta, incluir, pin });
    const detalle = Object.entries(r.borrado || {})
      .map(([k, v]) => `${v} ${nombres[k] || k}`).join(' · ');

    showToast(`Período borrado: ${detalle || 'sin registros'}`, 'ok');
    cerrarModal('modalBorrarPeriodo');

    // Todo lo que dependa de estas cifras queda obsoleto: se recarga
    document.dispatchEvent(new CustomEvent('pos:movimiento-dinero'));
    await cargarUtilidades();
    if (typeof cargarBalance === 'function') cargarBalance();
  } catch (err) {
    showToast(err.message || 'No se pudo borrar el período', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}
