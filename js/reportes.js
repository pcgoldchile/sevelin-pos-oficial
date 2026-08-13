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

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnGenerarReposicion')?.addEventListener('click', abrirReposicion);
  document.getElementById('btnExportarReposicion')?.addEventListener('click', exportarReposicion);
  document.getElementById('btnCerrarReposicion')?.addEventListener('click', () => cerrarModalRep('modalReposicion'));
  document.getElementById('btnExportarContador')?.addEventListener('click', exportarParaContador);

  document.getElementById('btnVerTodoVolumen')?.addEventListener('click', () => abrirRankingCompleto('volumen'));
  document.getElementById('btnVerTodoMargen')?.addEventListener('click', () => abrirRankingCompleto('margen'));
  document.getElementById('btnVerMenosVendidos')?.addEventListener('click', () => abrirRankingCompleto('menos'));
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

/* Ranking completo en un modal, con los tres criterios en pestañas. */
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

  /* topVolumen y topMargen vienen recortados a 10 desde el servidor.
     Para "los menos vendidos" se usa topVolumen invertido: son los
     mismos datos ordenados al revés. */
  let lista, campo, principal, secundario, subtitulo;

  if (criterio === 'menos') {
    lista = [...(datosDashboard.topVolumen || [])].sort((a, b) => a.unidades - b.unidades);
    campo = 'unidades';
    principal = p => `${p.unidades} un.`;
    secundario = p => fmtCLP(p.ingresos);
    subtitulo = 'Los que menos rotan del período. Ojo con el capital detenido en ellos.';
  } else if (criterio === 'margen') {
    lista = datosDashboard.topMargen || [];
    campo = 'utilidad';
    principal = p => fmtCLP(p.utilidad);
    secundario = p => `${p.unidades} un. vendidas`;
    subtitulo = 'Los que más utilidad dejaron, sin importar cuántas unidades se vendieron.';
  } else {
    lista = datosDashboard.topVolumen || [];
    campo = 'unidades';
    principal = p => `${p.unidades} un.`;
    secundario = p => fmtCLP(p.ingresos);
    subtitulo = 'Los que más unidades salieron del inventario.';
  }

  if (titulo) titulo.textContent = subtitulo;

  if (!lista.length) {
    caja.innerHTML = '<p class="vacio-nota">Sin ventas en el período</p>';
    return;
  }

  const max = Math.max(...lista.map(p => Math.abs(Number(p[campo]) || 0))) || 1;

  caja.innerHTML = lista.map((p, i) => {
    const valor = Number(p[campo]) || 0;
    const pct = Math.max(2, (Math.abs(valor) / max) * 100);
    const negativo = valor < 0;
    return `
      <div class="rank-fila rank-clicable" data-producto="${escaparRep(p.nombre)}"
           title="Abrir ${escaparRep(p.nombre)}">
        <span class="rank-pos">${i + 1}</span>
        <div class="rank-cuerpo">
          <div class="rank-cabecera">
            <span class="rank-nombre">${escaparRep(acortarRep(p.nombre, 45))}</span>
            <b class="${negativo ? 'rank-negativo' : ''}">${principal(p)}</b>
          </div>
          <div class="barra-pista">
            <div class="barra-relleno ${negativo ? 'barra-red' : ''}" style="width:${pct}%"></div>
          </div>
          <small>${secundario(p)}</small>
        </div>
      </div>`;
  }).join('');

  // Tocar un producto abre su editor
  caja.querySelectorAll('.rank-clicable').forEach(fila => {
    fila.addEventListener('click', () => abrirProductoDesdeRanking(fila.dataset.producto));
  });
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
async function exportarParaContador() {
  /* Los campos de fecha solo se llenan al usar los botones de rango.
     Si el usuario nunca los tocó, estaban vacíos y el botón fallaba con
     "Elige el período primero" sin decir dónde elegirlo. Ahora se toma
     el rango que ya está activo en el balance. */
  let desde = document.getElementById('balanceDesde')?.value;
  let hasta = document.getElementById('balanceHasta')?.value;

  if ((!desde || !hasta) && typeof rangoBalance === 'object') {
    desde = rangoBalance.desde;
    hasta = rangoBalance.hasta;
  }

  if (!desde || !hasta) {
    showToast('Elige un período en los filtros de arriba (Hoy, Este mes…)', 'err');
    document.getElementById('balanceDesde')?.focus();
    return;
  }

  const btn = document.getElementById('btnExportarContador');
  if (btn) btn.disabled = true;

  try {
    const d = await API.balance.contador(desde, hasta);
    const r = d.resumen;

    const libro = XLSX.utils.book_new();

    // --- Hoja 1: resumen ---
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
      { Concepto: 'OTROS', Valor: '' },
      { Concepto: 'Comisión POS Tuu', Valor: Math.round(r.comisiones) },
      { Concepto: '', Valor: '' },
      { Concepto: 'NOTA', Valor: 'Los precios del sistema son BRUTOS (IVA incluido). El neto se obtiene dividiendo por 1,19.' }
    ];
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(resumen), 'Resumen');

    // --- Hoja 2: ventas ---
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(
      d.ventas.map(v => ({
        Fecha: v.fecha,
        'N° Orden': v.numero_orden,
        Cliente: v.cliente || 'Consumidor Final',
        Documento: v.tipo_dte,
        'Medio de pago': v.metodo_pago,
        'Neto (sin IVA)': Math.round(v.neto),
        'IVA (19%)': Math.round(v.iva),
        'Total (bruto)': Math.round(v.total),
        'Comisión POS': Math.round(v.comision_pos)
      }))
    ), 'Ventas');

    // --- Hoja 3: gastos ---
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(
      d.gastos.map(g => ({
        Fecha: String(g.fecha).slice(0, 10),
        Proveedor: g.proveedor || '',
        Clasificación: g.clasificacion || 'Sin clasificar',
        Detalle: g.descripcion || '',
        'Medio de pago': g.metodo_pago || 'Efectivo',
        Monto: Math.round(g.costo_total)
      }))
    ), 'Gastos');

    // --- Hoja 4: gastos por clasificación ---
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(
      Object.entries(r.porClasificacion)
        .sort((a, b) => b[1] - a[1])
        .map(([clasificacion, monto]) => ({ Clasificación: clasificacion, Total: Math.round(monto) }))
    ), 'Gastos por categoría');

    XLSX.writeFile(libro, `contador-${d.periodo.desde}_a_${d.periodo.hasta}.xlsx`);
    showToast('Resumen para el contador descargado', 'ok');
  } catch (err) {
    showToast(err.message || 'No se pudo generar el resumen', 'err');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function escaparRep(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
