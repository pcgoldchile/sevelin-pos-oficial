// ==========================================
// INFORME-COMPRAS.JS — Compras por marketplace, vendedor y marca (v132)
// ------------------------------------------
// Pedido del dueño (07-10-2026, pendiente #80): ver cuánto compra según por
// dónde compró (marketplace), a quién (vendedor) y de qué marca. Lo quiso en
// Finanzas y en Productos: es UNA ventana con un botón en cada lado.
//
// Los montos vienen sumados del servidor (GET /api/finanzas/compras-informe);
// acá solo se elige el período y la vista. Suma las compras cargadas con el
// stock (ya llegadas y por llegar), no los gastos de Finanzas.
// ==========================================

let informeComprasDatos = null;
let informeComprasVista = 'porMarketplace';
let informeComprasRango = 'todo';

const INFORME_COMPRAS_VISTAS = {
  porMarketplace: { columna: 'Marketplace', vacio: 'Sin compras en este período' },
  porVendedor: { columna: 'Vendedor', vacio: 'Sin compras en este período' },
  porMarca: { columna: 'Marca', vacio: 'Sin compras en este período' }
};

document.addEventListener('DOMContentLoaded', () => {
  ['btnInformeComprasFinanzas', 'btnInformeComprasProductos'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', abrirInformeCompras);
  });
  document.getElementById('btnCerrarInformeCompras')?.addEventListener('click', () => cerrarModal('modalInformeCompras'));
  document.getElementById('modalInformeCompras')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalInformeCompras') cerrarModal('modalInformeCompras');
  });
  document.querySelectorAll('[data-rango-compras]').forEach(btn => {
    btn.addEventListener('click', () => { informeComprasRango = btn.dataset.rangoCompras; cargarInformeCompras(); });
  });
  document.querySelectorAll('[data-vista-compras]').forEach(btn => {
    btn.addEventListener('click', () => { informeComprasVista = btn.dataset.vistaCompras; pintarInformeCompras(); });
  });
});

function abrirInformeCompras() {
  if (!esAdmin()) return;
  document.getElementById('modalInformeCompras')?.classList.add('show');
  cargarInformeCompras();
}

// Fechas del período elegido, en hora de Chile (todayISO). 'todo' = sin fechas.
function rangoInformeCompras(clave) {
  const hoy = todayISO();
  const [a, m] = hoy.split('-').map(Number);
  if (clave === 'mes') return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy, etiqueta: 'este mes' };
  if (clave === 'anio') return { desde: `${a}-01-01`, hasta: hoy, etiqueta: 'este año' };
  if (clave === '3meses') {
    const inicio = new Date(Date.UTC(a, m - 3, 1));   // el mes en curso y los dos anteriores
    return { desde: inicio.toISOString().slice(0, 10), hasta: hoy, etiqueta: 'los últimos 3 meses' };
  }
  return { desde: '', hasta: '', etiqueta: 'todo lo cargado' };
}

async function cargarInformeCompras() {
  const rango = rangoInformeCompras(informeComprasRango);
  document.querySelectorAll('[data-rango-compras]').forEach(b => b.classList.toggle('activo', b.dataset.rangoCompras === informeComprasRango));
  const resumen = document.getElementById('informeComprasResumen');
  if (resumen) resumen.textContent = 'Sumando las compras…';
  try {
    informeComprasDatos = await API.balance.comprasInforme(rango.desde, rango.hasta);
    informeComprasDatos.etiqueta = rango.etiqueta;
    pintarInformeCompras();
  } catch (err) {
    informeComprasDatos = null;
    if (resumen) resumen.textContent = 'No se pudo armar el informe: ' + (err.message || 'error');
    showToast(err.message || 'No se pudo armar el informe de compras', 'err');
  }
}

function fechaInformeCompras(iso) {
  if (!iso) return '—';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}-${m}-${a}`;
}

function pintarInformeCompras() {
  const d = informeComprasDatos;
  if (!d) return;
  const vista = INFORME_COMPRAS_VISTAS[informeComprasVista] || INFORME_COMPRAS_VISTAS.porMarketplace;
  document.querySelectorAll('[data-vista-compras]').forEach(b => b.classList.toggle('activo', b.dataset.vistaCompras === informeComprasVista));

  const resumen = document.getElementById('informeComprasResumen');
  if (resumen) {
    resumen.textContent = d.compras
      ? `${fmtCLP(d.total)} en ${d.compras} compra(s) y ${d.unidades} unidad(es), ${d.etiqueta}` +
        (d.porLlegar > 0 ? ` · ${fmtCLP(d.porLlegar)} todavía por llegar` : '')
      : `Sin compras cargadas, ${d.etiqueta}`;
  }

  const titulo = document.getElementById('informeComprasColumna');
  if (titulo) titulo.textContent = vista.columna;

  const filas = d[informeComprasVista] || [];
  const cuerpo = document.getElementById('informeComprasFilas');
  if (cuerpo) {
    cuerpo.innerHTML = filas.length ? filas.map(f => {
      const parte = d.total > 0 ? (f.monto / d.total) * 100 : 0;
      const bajada = [
        f.detalle ? `por ${f.detalle}` : '',
        f.porLlegar > 0 ? `${fmtCLP(f.porLlegar)} por llegar` : ''
      ].filter(Boolean).join(' · ');
      return `
        <tr>
          <td>${f.sinDato ? `<em>${escHtml(f.nombre)}</em>` : `<strong>${escHtml(f.nombre)}</strong>`}${
            bajada ? `<br><small>${escHtml(bajada)}</small>` : ''}</td>
          <td class="num">${f.compras}</td>
          <td class="num">${f.productos}</td>
          <td class="num">${f.unidades}</td>
          <td class="num"><b>${escHtml(fmtCLP(f.monto))}</b></td>
          <td class="num">${parte.toFixed(1)}%</td>
          <td class="num">${escHtml(fechaInformeCompras(f.ultima))}</td>
        </tr>`;
    }).join('') : `<tr class="empty-row"><td colspan="7">${escHtml(vista.vacio)}</td></tr>`;
  }

  const avisos = [];
  if (d.sinCosto > 0) avisos.push(`⚠️ ${d.sinCosto} compra(s) no tienen costo cargado: suman unidades, pero $0.`);
  (d.fechasRaras || []).forEach(f => {
    avisos.push(`⚠️ La compra de "${f.producto}" tiene una fecha imposible (${fechaInformeCompras(f.fecha)}): corrígela en la ficha del producto, en sus compras.`);
  });
  const cajaAvisos = document.getElementById('informeComprasAvisos');
  if (cajaAvisos) cajaAvisos.innerHTML = avisos.map(a => `<span>${escHtml(a)}</span>`).join('<br>');
}
