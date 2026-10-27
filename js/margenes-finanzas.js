// ==========================================
// MARGENES-FINANZAS.JS — "📐 Tipos de margen" en Finanzas → Utilidades (27-10-2026)
// ------------------------------------------
// Pedido del dueño: ver los márgenes del negocio (bruto, contribución, operativo,
// EBITDA, antes de impuestos y neto) con lo que ya registra el POS.
// Usa el mismo informe y período que Utilidades (utilInforme / utilRango de
// js/utilidades.js): no consulta nada nuevo.
//
// Supuestos, a la vista en la ventana:
//   · Las ventas van con IVA, igual que en Utilidades; el IVA a pagar del período
//     se descuenta al final (margen neto).
//   · Las compras de mercadería no son gasto: su costo entra cuando se vende.
//   · Activo fijo y devolución de préstamos o capital no son gasto del mes.
//   · Los pagos al SII ("Impuestos") son IVA de meses anteriores: no se restan otra
//     vez. El impuesto a la renta (anual) no está incluido.
//   · El POS no separa capital e intereses de las cuotas de crédito: se resta la
//     cuota completa como gasto financiero.
//   · No hay depreciación registrada: el EBITDA queda igual al operativo.
// ==========================================

function partidasDeMargenes(inf) {
  const gastos = inf?.detalleGastos || [];
  const suma = (filtro) => gastos.filter(filtro).reduce((a, g) => a + (Number(g.costo_total) || 0), 0);
  const esImpuesto = (g) => /^impuestos/i.test(g.clasificacion || '');
  const operativo = (g) => (g.grupo || 'OPERATIVO') === 'OPERATIVO' && !esImpuesto(g) && !g.es_cuota_credito;

  const ventas = Number(inf?.ingresos) || 0;
  const costoVendido = Number(inf?.costoVendido) || 0;
  const comisiones = Number(inf?.comisiones) || 0;
  const despachos = Number(inf?.despachosCobrados) || 0;
  const variablesGasto = suma(g => operativo(g) && g.tipo !== 'FIJO');
  const fijos = suma(g => operativo(g) && g.tipo === 'FIJO');
  const cuotas = suma(g => !!g.es_cuota_credito);
  const iva = Number(inf?.iva?.ivaAPagar) || 0;
  const depreciacion = 0;

  const bruto = ventas - costoVendido;
  const variables = comisiones + variablesGasto - despachos;
  const contribucion = bruto - variables;
  const operativoRes = contribucion - fijos;
  const ebitda = operativoRes + depreciacion;
  const ebt = ebitda - cuotas;
  const neto = ebt - iva;

  return {
    ventas, costoVendido, comisiones, despachos, variablesGasto, variables, fijos, cuotas, iva, depreciacion,
    bruto, contribucion, operativo: operativoRes, ebitda, ebt, neto,
    fueraInventario: suma(g => g.grupo === 'INVENTARIO'),
    fueraInversion: suma(g => g.grupo === 'INVERSION'),
    fueraImpuestos: suma(esImpuesto)
  };
}

function pctMargen(monto, ventas) {
  return ventas > 0 ? (monto / ventas) * 100 : null;
}

function tonoDeMargen(pct, verdeDesde, rojoBajo) {
  if (pct === null) return '';
  if (pct >= verdeDesde) return 'verde';
  if (pct < rojoBajo) return 'rojo';
  return 'ambar';
}

function tarjetaMargen({ titulo, sigla, monto, ventas, que, formula, verde, rojo }) {
  const pct = pctMargen(monto, ventas);
  const tono = tonoDeMargen(pct, verde, rojo);
  const pctTxt = pct === null ? '—' : `${pct.toLocaleString('es-CL', { maximumFractionDigits: 1 })}%`;
  return `<article class="mg-card ${tono ? `mg-${tono}` : ''}">
    <header><h3>${escHtml(titulo)}</h3>${sigla ? `<span class="mg-sigla">${escHtml(sigla)}</span>` : ''}</header>
    <div class="mg-pct">${pctTxt}</div>
    <div class="mg-monto">${fmtCLP(monto)}</div>
    <p class="mg-que">${que}</p>
    <p class="mg-formula">${formula}</p>
  </article>`;
}

function abrirMargenesFinanzas() {
  if (typeof esAdmin === 'function' && !esAdmin()) return;
  const caja = document.getElementById('margenesContenido');
  const titulo = document.getElementById('margenesPeriodo');
  if (!caja) return;
  if (typeof utilInforme === 'undefined' || !utilInforme) {
    caja.innerHTML = '<p class="modal-hint">Todavía no carga el informe de Utilidades. Espera un segundo y vuelve a abrir.</p>';
    document.getElementById('modalMargenes')?.classList.add('show');
    return;
  }
  const p = partidasDeMargenes(utilInforme);
  const rango = typeof utilRango !== 'undefined' ? utilRango : null;
  if (titulo) titulo.textContent = rango?.desde
    ? `${rango.etiqueta || 'Período'} · ${fechaCorta(rango.desde)} al ${fechaCorta(rango.hasta)} · ventas ${fmtCLP(p.ventas)}`
    : '';

  const pctContrib = pctMargen(p.contribucion, p.ventas);
  const equilibrio = pctContrib > 0 ? Math.ceil((p.fijos + p.cuotas) / (pctContrib / 100)) : null;

  caja.innerHTML = p.ventas <= 0
    ? '<p class="modal-hint">No hay ventas pagadas en este período: sin ventas no hay margen que calcular.</p>'
    : `<div class="mg-grid">
      ${tarjetaMargen({ titulo: 'Margen bruto', sigla: '', monto: p.bruto, ventas: p.ventas, verde: 35, rojo: 20,
        que: 'Lo que deja la mercadería y los servicios, antes de cualquier gasto del local.',
        formula: `Ventas ${fmtCLP(p.ventas)} − costo de lo vendido ${fmtCLP(p.costoVendido)}` })}
      ${tarjetaMargen({ titulo: 'Margen de contribución', sigla: '', monto: p.contribucion, ventas: p.ventas, verde: 30, rojo: 15,
        que: 'Lo que aporta cada venta para pagar los gastos fijos. Con él se saca cuánto hay que vender para no perder.',
        formula: `Bruto − comisiones ${fmtCLP(p.comisiones)} − gastos variables ${fmtCLP(p.variablesGasto)}${p.despachos ? ` + despachos cobrados ${fmtCLP(p.despachos)}` : ''}` })}
      ${tarjetaMargen({ titulo: 'Margen operativo', sigla: 'EBIT', monto: p.operativo, ventas: p.ventas, verde: 10, rojo: 0,
        que: 'Lo que gana la operación del negocio: ya pagó arriendo, sueldos, luz y demás gastos fijos.',
        formula: `Contribución − gastos fijos ${fmtCLP(p.fijos)} (sin cuotas de crédito)` })}
      ${tarjetaMargen({ titulo: 'Margen EBITDA', sigla: 'EBITDA', monto: p.ebitda, ventas: p.ventas, verde: 10, rojo: 0,
        que: 'La caja que genera el negocio antes de intereses, impuestos y depreciación.',
        formula: 'Operativo + depreciación ($0: el POS no la registra, así que queda igual al operativo)' })}
      ${tarjetaMargen({ titulo: 'Margen antes de impuestos', sigla: 'EBT', monto: p.ebt, ventas: p.ventas, verde: 8, rojo: 0,
        que: 'Lo que queda después de pagar las deudas (BancoEstado, BCI).',
        formula: `EBITDA − cuotas de crédito ${fmtCLP(p.cuotas)} (cuota completa: capital + intereses)` })}
      ${tarjetaMargen({ titulo: 'Margen neto', sigla: '', monto: p.neto, ventas: p.ventas, verde: 5, rojo: 0,
        que: 'Lo que de verdad queda para ti al final del período.',
        formula: `Antes de impuestos − IVA a pagar del período ${fmtCLP(p.iva)}` })}
    </div>
    ${equilibrio ? `<div class="mg-equilibrio">🎯 Con este margen de contribución (${pctContrib.toLocaleString('es-CL', { maximumFractionDigits: 1 })}%), para cubrir los gastos fijos y las cuotas (${fmtCLP(p.fijos + p.cuotas)}) necesitas vender <strong>${fmtCLP(equilibrio)}</strong> en el período.${p.ventas >= equilibrio ? ' ✅ Ya lo pasaste.' : ` Te faltan ${fmtCLP(equilibrio - p.ventas)}.`}</div>` : ''}
    <details class="mg-notas">
      <summary>Qué quedó fuera y por qué</summary>
      <ul>
        <li><strong>Compras de mercadería</strong> (${fmtCLP(p.fueraInventario)}): no son gasto del mes; su costo cuenta cuando se vende (costo de lo vendido).</li>
        <li><strong>Activo fijo y devolución de préstamos o capital</strong> (${fmtCLP(p.fueraInversion)}): son inversión o devolver plata, no gasto.</li>
        <li><strong>Pagos al SII</strong> (${fmtCLP(p.fueraImpuestos)}): son el F29 de meses anteriores. Ya se descuenta el IVA de este período, así que no se restan otra vez.</li>
        <li>Las <strong>cuotas de crédito</strong> se restan completas porque el POS no separa capital e intereses. Con la tabla de pagos del banco se puede restar solo el interés.</li>
        <li>El <strong>impuesto a la renta</strong> (anual, régimen Pro Pyme) no está incluido.</li>
        <li>Las ventas van con IVA, igual que en Utilidades. Solo cuentan las ventas pagadas.</li>
      </ul>
    </details>`;
  document.getElementById('modalMargenes')?.classList.add('show');
}

function cerrarMargenesFinanzas() {
  document.getElementById('modalMargenes')?.classList.remove('show');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnMargenesFinanzas')?.addEventListener('click', abrirMargenesFinanzas);
  document.getElementById('btnMargenesCerrar')?.addEventListener('click', cerrarMargenesFinanzas);
  document.getElementById('modalMargenes')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalMargenes') cerrarMargenesFinanzas();
  });
});
