// ==========================================
// REPORTES.JS - Inteligencia de negocio
// ------------------------------------------
// Tres informes que responden preguntas distintas:
//
//   · Top 10 por volumen vs por margen → el producto que más se vende
//     casi nunca es el que más deja. Ver ambos rankings es lo que
//     permite decidir qué conviene empujar.
//   · Horas pico → cuándo conviene tener más gente en el mostrador.
//   · Resumen para el contador → lo que se entrega cada mes.
//
// Los gráficos se dibujan con divs y CSS, sin librería de charts: son
// barras simples, y sumar una dependencia de 200 KB para esto no se
// justifica en un sistema que ya carga bastante.
// ==========================================

let datosDashboard = null;
let listaReposicion = null;
let criterioActual = 'volumen';

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnGenerarReposicion')?.addEventListener('click', abrirReposicion);
  document.getElementById('btnExportarReposicion')?.addEventListener('click', exportarReposicion);
  document.getElementById('btnCerrarReposicion')?.addEventListener('click', () => cerrarModalRep('modalReposicion'));
  document.getElementById('btnExportarContador')?.addEventListener('click', abrirExportContador);
  document.getElementById('periodosContador')?.addEventListener('click', (e) => {
    const b = e.target.closest('.periodo-btn');
    if (b) marcarPeriodoContador(b.dataset.periodo);
  });
  document.getElementById('btnConfirmarPeriodoContador')?.addEventListener('click', confirmarPeriodoContador);
  document.getElementById('btnCancelarPeriodoContador')?.addEventListener('click', () => cerrarModalRep('modalPeriodoContador'));
  document.getElementById('btnContadorExcel')?.addEventListener('click', () => generarReporteContador('excel'));
  document.getElementById('btnContadorPDF')?.addEventListener('click', () => generarReporteContador('pdf'));
  document.getElementById('btnCancelarFormatoContador')?.addEventListener('click', () => cerrarModalRep('modalFormatoContador'));
  ['modalPeriodoContador', 'modalFormatoContador'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', (e) => { if (e.target.id === id) cerrarModalRep(id); });
  });

  // "Ver ranking completo" descarga el PDF directo, sin volcar la lista
  document.getElementById('btnPdfVolumen')?.addEventListener('click', () => descargarRankingPDF('volumen'));
  document.getElementById('btnPdfMargen')?.addEventListener('click', () => descargarRankingPDF('margen'));

  // Y el modal queda para revisar en pantalla y entrar a editar productos
  document.getElementById('btnVerRankings')?.addEventListener('click', () => abrirRankingCompleto('volumen'));
  document.getElementById('btnVerMenosVendidos')?.addEventListener('click', () => abrirRankingCompleto('menos'));
  document.getElementById('btnVerMenosMargen')?.addEventListener('click', () => abrirRankingCompleto('menosMargen'));
  document.getElementById('btnPdfRankingActual')?.addEventListener('click', () => descargarRankingPDF(criterioActual));
  document.getElementById('btnCerrarRanking')?.addEventListener('click', () => cerrarModalRep('modalRanking'));
  document.getElementById('rankingTabs')?.addEventListener('click', (e) => {
    const b = e.target.closest('.subtab');
    if (!b) return;
    document.querySelectorAll('#rankingTabs .subtab').forEach(x => x.classList.toggle('activo', x === b));
    pintarRankingCompleto(b.dataset.criterio);
  });
  document.getElementById('modalRanking')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalRanking') cerrarModalRep('modalRanking');
  });

  document.getElementById('modalReposicion')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalReposicion') cerrarModalRep('modalReposicion');
  });
});

function cerrarModalRep(id) { document.getElementById(id)?.classList.remove('show'); }

/* ============================================================
   DASHBOARD: TOP 10 Y HORAS PICO
   Lo llama balance.js con el mismo rango del período.
   ============================================================ */
async function cargarDashboardReportes(desde, hasta) {
  if (!esAdmin()) return;

  try {
    datosDashboard = await API.balance.dashboard(desde, hasta);
    pintarTop10(datosDashboard);
    pintarHorasPico(datosDashboard);
  } catch (err) {
    console.error('Error al cargar los reportes:', err.message || err);
  }
}

/* Se muestran 5 en el panel y el resto en un modal.
   Diez filas por ranking ocupaban toda la pantalla y empujaban el resto
   del balance fuera de la vista. */
const TOP_VISIBLE = 5;

function pintarTop10(d) {
  pintarRanking('topVolumen', (d.topVolumen || []).slice(0, TOP_VISIBLE), 'unidades',
    p => `${p.unidades} un.`, p => fmtCLP(p.ingresos));

  pintarRanking('topMargen', (d.topMargen || []).slice(0, TOP_VISIBLE), 'utilidad',
    p => fmtCLP(p.utilidad), p => `${p.unidades} un. vendidas`);
}

/* ============================================================
   CRITERIOS DE RANKING
   ------------------------------------------------------------
   Definidos una sola vez: los usan el modal, el PDF y las pestañas. Así
   agregar un criterio nuevo no obliga a tocar tres lugares.
   ============================================================ */
const CRITERIOS = {
  volumen: {
    titulo: 'Más vendidos',
    subtitulo: 'Los que más unidades salieron del inventario.',
    campo: 'unidades',
    lista: d => d.topVolumen,
    principal: p => `${p.unidades} un.`,
    secundario: p => fmtCLP(p.ingresos),
    columnas: ['#', 'Producto', 'Unidades', 'Ingresos']
  },
  margen: {
    titulo: 'Más utilidad',
    subtitulo: 'Los que más utilidad dejaron, sin importar cuántas unidades se vendieron.',
    campo: 'utilidad',
    lista: d => d.topMargen,
    principal: p => fmtCLP(p.utilidad),
    secundario: p => `${p.unidades} un. vendidas`,
    columnas: ['#', 'Producto', 'Utilidad', 'Unidades']
  },
  menos: {
    titulo: 'Menos rotan',
    subtitulo: 'Los que menos se vendieron. Ojo con el capital detenido en ellos.',
    campo: 'unidades',
    lista: d => d.menosVolumen || [...(d.topVolumen || [])].reverse(),
    principal: p => `${p.unidades} un.`,
    secundario: p => fmtCLP(p.ingresos),
    columnas: ['#', 'Producto', 'Unidades', 'Ingresos']
  },
  menosMargen: {
    titulo: 'Menos utilidad',
    subtitulo: 'Los que menos dejaron. Si alguno sale en rojo, se vendió bajo el costo.',
    campo: 'utilidad',
    lista: d => d.menosMargen || [...(d.topMargen || [])].reverse(),
    principal: p => fmtCLP(p.utilidad),
    secundario: p => `${p.unidades} un. vendidas`,
    columnas: ['#', 'Producto', 'Utilidad', 'Unidades']
  }
};

/* Ranking completo en un modal, con los cuatro criterios en pestañas. */
function abrirRankingCompleto(criterio) {
  if (!datosDashboard) { showToast('Elige un período primero', 'err'); return; }

  const modal = document.getElementById('modalRanking');
  if (!modal) return;

  document.querySelectorAll('#rankingTabs .subtab').forEach(b => {
    b.classList.toggle('activo', b.dataset.criterio === criterio);
  });

  pintarRankingCompleto(criterio);
  modal.classList.add('show');
}

function pintarRankingCompleto(criterio) {
  const caja = document.getElementById('rankingCompleto');
  const titulo = document.getElementById('rankingTitulo');
  if (!caja || !datosDashboard) return;

  criterioActual = criterio;
  const c = CRITERIOS[criterio] || CRITERIOS.volumen;
  const lista = (c.lista(datosDashboard) || []).slice(0, 50);

  if (titulo) titulo.textContent = c.subtitulo;

  if (!lista.length) {
    caja.innerHTML = '<p class="vacio-nota">Sin ventas en el período</p>';
    return;
  }

  const max = Math.max(...lista.map(p => Math.abs(Number(p[c.campo]) || 0))) || 1;

  caja.innerHTML = lista.map((p, i) => {
    const valor = Number(p[c.campo]) || 0;
    const pct = Math.max(2, (Math.abs(valor) / max) * 100);
    const negativo = valor < 0;
    return `
      <div class="rank-fila rank-clicable" data-producto="${escaparRep(p.nombre)}"
           title="Abrir ${escaparRep(p.nombre)}">
        <span class="rank-pos">${i + 1}</span>
        <div class="rank-cuerpo">
          <div class="rank-cabecera">
            <span class="rank-nombre">${escaparRep(acortarRep(p.nombre, 45))}</span>
            <b class="${negativo ? 'rank-negativo' : ''}">${c.principal(p)}</b>
          </div>
          <div class="barra-pista">
            <div class="barra-relleno ${negativo ? 'barra-red' : ''}" style="width:${pct}%"></div>
          </div>
          <small>${c.secundario(p)}</small>
        </div>
      </div>`;
  }).join('');

  caja.querySelectorAll('.rank-clicable').forEach(fila => {
    fila.addEventListener('click', () => abrirProductoDesdeRanking(fila.dataset.producto));
  });
}

/* ============================================================
   RANKING EN PDF
   ------------------------------------------------------------
   Se usa jsPDF + AutoTable, que ya están cargados para los otros
   informes. Sale la lista completa (hasta 100), que es justamente lo que
   no conviene volcar en pantalla.
   ============================================================ */
function descargarRankingPDF(criterio) {
  if (!datosDashboard) { showToast('Elige un período primero', 'err'); return; }

  const c = CRITERIOS[criterio] || CRITERIOS.volumen;
  const lista = c.lista(datosDashboard) || [];

  if (!lista.length) { showToast('Sin ventas en el período', 'err'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const per = datosDashboard.periodo;

  doc.setFontSize(15);
  doc.setFont(undefined, 'bold');
  doc.text(`${NEGOCIO_NOMBRE} · Ranking: ${c.titulo}`, 14, 18);

  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(`Período ${per.desde} al ${per.hasta}`, 14, 25);
  doc.text(c.subtitulo, 14, 30, { maxWidth: 180 });

  const esUtilidad = c.campo === 'utilidad';

  doc.autoTable({
    startY: 36,
    head: [c.columnas],
    body: lista.map((p, i) => [
      i + 1,
      p.nombre,
      esUtilidad ? fmtCLP(p.utilidad) : `${p.unidades}`,
      esUtilidad ? `${p.unidades}` : fmtCLP(p.ingresos)
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [30, 41, 59], textColor: [248, 250, 252] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' }
    },
    /* Las utilidades negativas en rojo: un producto vendido bajo el
       costo es lo primero que hay que ver en este informe. */
    didParseCell: (data) => {
      if (esUtilidad && data.section === 'body' && data.column.index === 2) {
        const p = lista[data.row.index];
        if (p && Number(p.utilidad) < 0) data.cell.styles.textColor = [220, 38, 38];
      }
    }
  });

  doc.save(`ranking-${criterio}-${per.desde}_a_${per.hasta}.pdf`);
  showToast(`PDF de "${c.titulo}" descargado`, 'ok');
}

/* Los rankings agrupan por nombre (los ítems manuales no tienen id), así
   que se busca el producto por nombre en el catálogo. */
function abrirProductoDesdeRanking(nombre) {
  if (typeof productsList === 'undefined' || typeof abrirModalProducto !== 'function') return;

  const buscado = String(nombre || '').trim().toLowerCase();
  const producto = productsList.find(p => (p.nombre || '').trim().toLowerCase() === buscado);

  if (!producto) {
    showToast('Ese ítem no está en el catálogo (se vendió como producto manual)', 'err');
    return;
  }

  document.getElementById('modalRanking')?.classList.remove('show');
  abrirModalProducto(producto);
}

function acortarRep(texto, largo) {
  const t = String(texto == null ? '' : texto);
  return t.length > largo ? t.slice(0, largo).trimEnd() + '…' : t;
}

function pintarRanking(contenedorId, lista, campo, valorPrincipal, valorSecundario) {
  const caja = document.getElementById(contenedorId);
  if (!caja) return;

  if (!lista?.length) {
    caja.innerHTML = '<p class="vacio-nota">Sin ventas en el período</p>';
    return;
  }

  // El máximo define el 100% de la barra, para comparar entre sí
  const max = Math.max(...lista.map(p => Math.abs(Number(p[campo]) || 0))) || 1;

  caja.innerHTML = lista.map((p, i) => {
    const valor = Number(p[campo]) || 0;
    const pct = Math.max(2, (Math.abs(valor) / max) * 100);
    /* Un producto puede tener margen negativo (se vendió bajo el costo).
       Se pinta en rojo en vez de ocultarlo: es justo lo que hay que ver. */
    const negativo = valor < 0;

    return `
      <div class="rank-fila rank-clicable" data-producto="${escaparRep(p.nombre)}"
           title="Abrir ${escaparRep(p.nombre)}">
        <span class="rank-pos">${i + 1}</span>
        <div class="rank-cuerpo">
          <div class="rank-cabecera">
            <span class="rank-nombre">${escaparRep(acortarRep(p.nombre, 40))}</span>
            <b class="${negativo ? 'rank-negativo' : ''}">${valorPrincipal(p)}</b>
          </div>
          <div class="barra-pista">
            <div class="barra-relleno ${negativo ? 'barra-red' : ''}" style="width:${pct}%"></div>
          </div>
          <small>${valorSecundario(p)}</small>
        </div>
      </div>`;
  }).join('');

  caja.querySelectorAll('.rank-clicable').forEach(fila => {
    fila.addEventListener('click', () => abrirProductoDesdeRanking(fila.dataset.producto));
  });
}

/* Horas pico: 24 barras verticales. La más alta define la escala. */
function pintarHorasPico(d) {
  const caja = document.getElementById('graficoHoras');
  if (!caja) return;

  const horas = d.porHora || [];
  const max = Math.max(...horas.map(h => h.ventas), 1);

  if (!horas.some(h => h.ventas > 0)) {
    caja.innerHTML = '<p class="vacio-nota">Sin ventas en el período</p>';
    return;
  }

  /* Solo se muestran las horas con actividad ±1: mostrar las 24 con la
     tienda cerrada de madrugada aplasta las barras útiles. */
  const activas = horas.map((h, i) => ({ ...h, hora: i })).filter(h => h.ventas > 0);
  const desde = Math.max(0, Math.min(...activas.map(h => h.hora)) - 1);
  const hasta = Math.min(23, Math.max(...activas.map(h => h.hora)) + 1);

  const pico = activas.reduce((a, b) => (b.ventas > a.ventas ? b : a), activas[0]);

  caja.innerHTML = `
    <div class="grafico-horas">
      ${horas.slice(desde, hasta + 1).map((h, idx) => {
        const hora = desde + idx;
        const alto = (h.ventas / max) * 100;
        const esPico = hora === pico.hora;
        return `
          <div class="hora-col" title="${hora}:00 · ${h.ventas} venta(s) · ${fmtCLP(h.monto)}">
            <div class="hora-barra-pista">
              <div class="hora-barra ${esPico ? 'pico' : ''}" style="height:${Math.max(2, alto)}%"></div>
            </div>
            <span class="hora-etiqueta">${hora}</span>
          </div>`;
      }).join('')}
    </div>
    <p class="modal-hint">
      🔥 Hora pico: <strong>${pico.hora}:00 a ${pico.hora + 1}:00</strong> ·
      ${pico.ventas} venta(s) por ${fmtCLP(pico.monto)}
    </p>`;

  pintarDiasSemana(d.porDia);
}

function pintarDiasSemana(porDia) {
  const caja = document.getElementById('graficoDias');
  if (!caja || !porDia) return;

  const nombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const max = Math.max(...porDia.map(d => d.ventas), 1);

  caja.innerHTML = porDia.map((d, i) => `
    <div class="barra-fila">
      <div class="barra-cabecera">
        <span>${nombres[i]}</span>
        <b>${d.ventas} venta(s) · ${fmtCLP(d.monto)}</b>
      </div>
      <div class="barra-pista">
        <div class="barra-relleno" style="width:${(d.ventas / max) * 100}%"></div>
      </div>
    </div>`).join('');
}

/* ============================================================
   LISTA DE REPOSICIÓN
   ============================================================ */
async function abrirReposicion() {
  const modal = document.getElementById('modalReposicion');
  const lista = document.getElementById('listaReposicion');
  if (!modal || !lista) return;

  lista.innerHTML = '<p class="vacio-nota">Calculando…</p>';
  modal.classList.add('show');

  try {
    listaReposicion = await API.balance.reposicion();
    pintarReposicion(listaReposicion);
  } catch (err) {
    lista.innerHTML = `<p class="vacio-nota error">${escaparRep(err.message || 'Error')}</p>`;
  }
}

function pintarReposicion(r) {
  const lista = document.getElementById('listaReposicion');
  const resumen = document.getElementById('resumenReposicion');
  if (!lista) return;

  if (!r.productos?.length) {
    lista.innerHTML = '<p class="vacio-nota">✅ Ningún producto está bajo su stock mínimo</p>';
    if (resumen) resumen.textContent = 'Todo el inventario está sobre el mínimo';
    return;
  }

  if (resumen) {
    resumen.textContent =
      `${r.total} producto(s) por reponer · ${r.agotados} sin stock · ` +
      `costo estimado ${fmtCLP(r.costoTotal)}`;
  }

  lista.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Producto</th><th>SKU</th>
          <th style="text-align:right;">Stock</th>
          <th style="text-align:right;">Mín.</th>
          <th style="text-align:right;">Pedir</th>
          <th style="text-align:right;">Costo est.</th>
        </tr>
      </thead>
      <tbody>
        ${r.productos.map(p => `
          <tr${p.agotado ? ' class="fila-agotada"' : ''}>
            <td>${escaparRep(p.nombre)}</td>
            <td>${escaparRep(p.sku || '—')}</td>
            <td style="text-align:right;" class="${p.agotado ? 'stock-agotado' : ''}">
              ${p.stock}${p.agotado ? ' ⚠️' : ''}
            </td>
            <td style="text-align:right;">${p.stock_minimo}</td>
            <td style="text-align:right;"><b>${p.sugerido}</b></td>
            <td style="text-align:right;">${fmtCLP(p.costo_estimado)}</td>
          </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="5" style="text-align:right;"><strong>Total estimado</strong></td>
          <td style="text-align:right;"><strong>${fmtCLP(r.costoTotal)}</strong></td>
        </tr>
      </tfoot>
    </table>`;
}

/* Excel para mandarle al proveedor. Se usa SheetJS, que ya está cargado
   para los otros informes. */
function exportarReposicion() {
  if (!listaReposicion?.productos?.length) {
    showToast('No hay productos por reponer', 'err');
    return;
  }

  const filas = listaReposicion.productos.map(p => ({
    Producto: p.nombre,
    SKU: p.sku || '',
    'Código de Barras': p.codigo_barras || '',
    'Stock actual': p.stock,
    'Stock mínimo': p.stock_minimo,
    'Cantidad a pedir': p.sugerido,
    'Costo unitario': p.costo_unitario,
    'Costo estimado': p.costo_estimado
  }));

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas), 'Pedido');
  XLSX.writeFile(libro, `pedido-proveedor-${todayISO()}.xlsx`);

  showToast(`Pedido de ${filas.length} producto(s) descargado`, 'ok');
}

/* ============================================================
   RESUMEN PARA EL CONTADOR
   Un Excel con cuatro hojas: resumen, ventas, gastos y el desglose por
   clasificación. Es lo que se entrega cada mes.
   ============================================================ */
/* ============================================================
   EXPORTACIÓN PARA EL CONTADOR — flujo de dos pasos
   ------------------------------------------------------------
   Paso 1: elegir el período (Hoy · Esta semana · Este mes · Este año ·
           Personalizado).
   Paso 2: elegir el formato (Excel o PDF).

   Antes el botón usaba en silencio las fechas del filtro del balance, y
   si el usuario no las había tocado fallaba sin decir dónde elegirlas.
   Ahora el período se pide siempre y de forma explícita.
   ============================================================ */
let rangoContador = null;

function abrirExportContador() {
  const modal = document.getElementById('modalPeriodoContador');
  if (!modal) return;

  // Se preselecciona "Este mes", que es lo que se pide casi siempre
  marcarPeriodoContador('mes');
  modal.classList.add('show');
}

function calcularPeriodo(clave) {
  const hoy = todayISO();
  const [a, m, d] = hoy.split('-').map(Number);
  const iso = (y, mes, dia) =>
    `${y}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

  if (clave === 'hoy') return { desde: hoy, hasta: hoy, etiqueta: 'Hoy' };

  if (clave === 'semana') {
    const ref = new Date(Date.UTC(a, m - 1, d));
    ref.setUTCDate(ref.getUTCDate() - 6);
    return { desde: ref.toISOString().slice(0, 10), hasta: hoy, etiqueta: 'Últimos 7 días' };
  }

  if (clave === 'mes') return { desde: iso(a, m, 1), hasta: hoy, etiqueta: 'Este mes' };

  if (clave === 'anio') return { desde: iso(a, 1, 1), hasta: hoy, etiqueta: 'Este año' };

  return null;   // personalizado: lo escribe el usuario
}

function marcarPeriodoContador(clave) {
  document.querySelectorAll('#periodosContador .periodo-btn').forEach(b => {
    b.classList.toggle('activo', b.dataset.periodo === clave);
  });

  const caja = document.getElementById('contadorPersonalizado');
  const esPersonalizado = clave === 'personalizado';
  if (caja) caja.style.display = esPersonalizado ? '' : 'none';

  if (esPersonalizado) {
    rangoContador = null;
    return;
  }

  rangoContador = calcularPeriodo(clave);
  const resumen = document.getElementById('contadorResumen');
  if (resumen && rangoContador) {
    resumen.textContent = `${rangoContador.etiqueta}: del ${rangoContador.desde} al ${rangoContador.hasta}`;
  }
}

function confirmarPeriodoContador() {
  const activo = document.querySelector('#periodosContador .periodo-btn.activo');
  const clave = activo?.dataset.periodo;

  if (clave === 'personalizado') {
    const desde = document.getElementById('contadorDesde')?.value;
    const hasta = document.getElementById('contadorHasta')?.value;

    if (!desde || !hasta) { showToast('Escribe las dos fechas', 'err'); return; }
    if (desde > hasta) { showToast('La fecha inicial no puede ser posterior a la final', 'err'); return; }

    rangoContador = { desde, hasta, etiqueta: 'Personalizado' };
  }

  if (!rangoContador) { showToast('Elige un período', 'err'); return; }

  cerrarModalRep('modalPeriodoContador');

  // Paso 2: formato
  const resumen = document.getElementById('formatoResumen');
  if (resumen) resumen.textContent = `Período: ${rangoContador.desde} al ${rangoContador.hasta}`;
  document.getElementById('modalFormatoContador')?.classList.add('show');
}

async function generarReporteContador(formato) {
  if (!rangoContador) return;

  cerrarModalRep('modalFormatoContador');
  showToast('Generando el reporte…', '');

  try {
    const d = await API.balance.contador(rangoContador.desde, rangoContador.hasta);
    if (formato === 'pdf') generarContadorPDF(d);
    else generarContadorExcel(d);
  } catch (err) {
    showToast(err.message || 'No se pudo generar el reporte', 'err');
  }
}

function generarContadorExcel(d) {
  const r = d.resumen;
  const libro = XLSX.utils.book_new();

  const resumen = [
    { Concepto: 'PERÍODO', Valor: `${d.periodo.desde} al ${d.periodo.hasta}` },
    { Concepto: '', Valor: '' },
    { Concepto: 'VENTAS', Valor: '' },
    { Concepto: 'Cantidad de ventas', Valor: r.cantidadVentas },
    { Concepto: 'Total vendido (bruto)', Valor: Math.round(r.totalVentas) },
    { Concepto: '', Valor: '' },
    { Concepto: 'DOCUMENTOS TRIBUTARIOS', Valor: '' },
    { Concepto: 'Ventas con Boleta', Valor: Math.round(r.porDte.BOLETA || 0) },
    { Concepto: 'Ventas con Factura', Valor: Math.round(r.porDte.FACTURA || 0) },
    { Concepto: 'Ventas sin DTE', Valor: Math.round(r.ventasSinDte) },
    { Concepto: '', Valor: '' },
    { Concepto: 'IVA (solo ventas con documento)', Valor: '' },
    { Concepto: 'Total con DTE (bruto)', Valor: Math.round(r.totalConDte) },
    { Concepto: 'Neto (sin IVA)', Valor: Math.round(r.netoConDte) },
    { Concepto: 'IVA débito fiscal (19%)', Valor: Math.round(r.ivaDebito) },
    { Concepto: '', Valor: '' },
    { Concepto: 'GASTOS', Valor: '' },
    { Concepto: 'Total gastos', Valor: Math.round(r.totalGastos) },
    { Concepto: '', Valor: '' },
    { Concepto: 'Comisión POS Tuu', Valor: Math.round(r.comisiones) },
    { Concepto: '', Valor: '' },
    { Concepto: 'NOTA', Valor: 'Los precios del sistema son BRUTOS (IVA incluido). El neto se obtiene dividiendo por 1,19.' }
  ];
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(resumen), 'Resumen');

  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(
    d.ventas.map(v => ({
      Fecha: v.fecha, 'N° Orden': v.numero_orden,
      Cliente: v.cliente || 'Consumidor Final',
      Documento: v.tipo_dte, 'Medio de pago': v.metodo_pago,
      'Neto (sin IVA)': Math.round(v.neto), 'IVA (19%)': Math.round(v.iva),
      'Total (bruto)': Math.round(v.total), 'Comisión POS': Math.round(v.comision_pos)
    }))
  ), 'Ventas');

  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(
    d.gastos.map(g => ({
      Fecha: String(g.fecha).slice(0, 10), Proveedor: g.proveedor || '',
      Clasificación: g.clasificacion || 'Sin clasificar', Detalle: g.descripcion || '',
      'Medio de pago': g.metodo_pago || 'Efectivo', Monto: Math.round(g.costo_total)
    }))
  ), 'Gastos');

  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(
    Object.entries(r.porClasificacion).sort((a, b) => b[1] - a[1])
      .map(([clasificacion, monto]) => ({ Clasificación: clasificacion, Total: Math.round(monto) }))
  ), 'Gastos por categoría');

  XLSX.writeFile(libro, `contador-${d.periodo.desde}_a_${d.periodo.hasta}.xlsx`);
  showToast('Excel para el contador descargado', 'ok');
}

function generarContadorPDF(d) {
  const r = d.resumen;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(15);
  doc.setFont(undefined, 'bold');
  doc.text(`${NEGOCIO_NOMBRE} · Resumen para el contador`, 14, 18);

  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(`Período ${d.periodo.desde} al ${d.periodo.hasta}`, 14, 25);

  // --- Resumen tributario ---
  doc.autoTable({
    startY: 31,
    head: [['Concepto', 'Monto']],
    body: [
      ['Cantidad de ventas', String(r.cantidadVentas)],
      ['Total vendido (bruto)', fmtCLP(r.totalVentas)],
      ['', ''],
      ['Ventas con Boleta', fmtCLP(r.porDte.BOLETA || 0)],
      ['Ventas con Factura', fmtCLP(r.porDte.FACTURA || 0)],
      ['Ventas sin DTE', fmtCLP(r.ventasSinDte)],
      ['', ''],
      ['Total con DTE (bruto)', fmtCLP(r.totalConDte)],
      ['Neto (sin IVA)', fmtCLP(r.netoConDte)],
      ['IVA débito fiscal (19%)', fmtCLP(r.ivaDebito)],
      ['', ''],
      ['Total gastos', fmtCLP(r.totalGastos)],
      ['Comisión POS Tuu', fmtCLP(r.comisiones)]
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59], textColor: [248, 250, 252] },
    columnStyles: { 1: { halign: 'right' } }
  });

  // --- Gastos por categoría ---
  const filasGasto = Object.entries(r.porClasificacion).sort((a, b) => b[1] - a[1]);
  if (filasGasto.length) {
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 8,
      head: [['Gastos por categoría', 'Total']],
      body: filasGasto.map(([c, m]) => [c, fmtCLP(m)]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [120, 53, 15], textColor: [248, 250, 252] },
      columnStyles: { 1: { halign: 'right' } }
    });
  }

  /* El detalle de ventas va en página aparte: con un mes de trabajo son
     decenas de filas y partirlas a media hoja dificulta la lectura. */
  if (d.ventas.length) {
    doc.addPage();
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Detalle de ventas', 14, 16);

    doc.autoTable({
      startY: 21,
      head: [['Fecha', 'N°', 'Documento', 'Pago', 'Neto', 'IVA', 'Total']],
      body: d.ventas.map(v => [
        v.fecha, String(v.numero_orden), v.tipo_dte, v.metodo_pago,
        fmtCLP(v.neto), fmtCLP(v.iva), fmtCLP(v.total)
      ]),
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: [248, 250, 252] },
      columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } }
    });
  }

  if (d.gastos.length) {
    doc.addPage();
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Detalle de gastos', 14, 16);

    doc.autoTable({
      startY: 21,
      head: [['Fecha', 'Proveedor', 'Clasificación', 'Pago', 'Monto']],
      body: d.gastos.map(g => [
        String(g.fecha).slice(0, 10), g.proveedor || '—',
        g.clasificacion || 'Sin clasificar', g.metodo_pago || 'Efectivo',
        fmtCLP(g.costo_total)
      ]),
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: [120, 53, 15], textColor: [248, 250, 252] },
      columnStyles: { 4: { halign: 'right' } }
    });
  }

  doc.save(`contador-${d.periodo.desde}_a_${d.periodo.hasta}.pdf`);
  showToast('PDF para el contador descargado', 'ok');
}

function escaparRep(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
