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
//   · Créditos: solo el costo financiero (interés, comisión, seguros) baja el margen;
//     del BancoEstado, solo la mitad del negocio (ver CUOTAS_BCI y BANCOESTADO).
//   · No hay depreciación registrada: el EBITDA queda igual al operativo.
// ==========================================

/* CRÉDITOS (27-10-2026, documentos del dueño). Montos y tasas solamente: nada personal.
   BCI: el calendario del comprobante, con capital, interés y comisión FOGAPE de cada cuota.
   BancoEstado: no hay tabla digital (el contrato está en papel). Se estima con el contrato:
   cuotas 1 y 2 solo intereses; desde la 3, cuota sin seguros $244.964 al 1,58% mensual
   más $48.620 de seguros. De este crédito al negocio le toca la MITAD: los otros $5.000.000
   son el préstamo al papá, que lo devuelve con el descuento del arriendo. */
const CUOTAS_BCI = [
  ['2026-08-20', 115390, 62914, 1400], ['2026-09-21', 134057, 44247, 985], ['2026-10-20', 142088, 36216, 806],
  ['2026-11-20', 143989, 34315, 764], ['2026-12-21', 148446, 29858, 664], ['2027-01-20', 153857, 24447, 544],
  ['2027-02-22', 156482, 21822, 486], ['2027-03-22', 164164, 14140, 315], ['2027-04-20', 168413, 9891, 220],
  ['2027-05-20', 173114, 5186, 115]
];
const BANCOESTADO = { primera: '2026-09-10', cuotas: 70, tasa: 0.0158, cuotaSinSeguros: 244964, seguros: 48620, parteNegocio: 0.5 };

function diasEntre(a, b) { return Math.abs((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 86400000); }

/* Cuota N (1…70) del BancoEstado según la fecha de pago. Vence el 10: pagada
   después del 25 se toma como la del mes siguiente (adelantada). */
function numeroCuotaBancoEstado(fechaPago) {
  const [a, m] = BANCOESTADO.primera.split('-').map(Number);
  const [pa, pm, pd] = String(fechaPago).slice(0, 10).split('-').map(Number);
  let n = (pa - a) * 12 + (pm - m) + 1;
  if (pd >= 25) n += 1;
  return Math.min(Math.max(n, 1), BANCOESTADO.cuotas);
}

/* Interés estimado de la cuota N del BancoEstado (sin seguros), por sistema francés.
   null en las cuotas 1 y 2: son solo intereses, toda la cuota es costo financiero. */
function interesBancoEstado(n) {
  if (n <= 2) return null;
  const { tasa, cuotaSinSeguros, cuotas } = BANCOESTADO;
  let saldo = cuotaSinSeguros * (1 - Math.pow(1 + tasa, -(cuotas - 2))) / tasa;
  let interes = 0;
  for (let k = 3; k <= n; k++) { interes = saldo * tasa; saldo -= (cuotaSinSeguros - interes); }
  return Math.round(interes);
}

/* Qué parte de una cuota pagada es costo financiero DEL NEGOCIO, cuál es capital
   del negocio y cuál le toca a otra persona. */
function desglosarCuotaCredito(g) {
  const monto = Number(g.costo_total) || 0;
  const nombre = String(g.credito || '');
  const fecha = String(g.fecha || '').slice(0, 10);
  if (/bci/i.test(nombre)) {
    const c = CUOTAS_BCI.slice().sort((x, y) => diasEntre(x[0], fecha) - diasEntre(y[0], fecha))[0];
    const financiero = Math.min(monto, c[2] + c[3]);
    return { financiero, capital: monto - financiero, otro: 0, estimado: false, detalle: `BCI, cuota con vencimiento ${fechaCorta(c[0])}` };
  }
  if (/banco ?estado/i.test(nombre)) {
    const n = numeroCuotaBancoEstado(fecha);
    const interes = interesBancoEstado(n);
    const financieroTotal = interes === null ? monto : Math.min(monto, interes + BANCOESTADO.seguros);
    const parte = BANCOESTADO.parteNegocio;
    const financiero = Math.round(financieroTotal * parte);
    const capital = Math.round((monto - financieroTotal) * parte);
    return { financiero, capital, otro: monto - financiero - capital, estimado: true, detalle: `BancoEstado, cuota ${n} de 70` };
  }
  // Otro crédito sin datos: la cuota completa
  return { financiero: monto, capital: 0, otro: 0, estimado: true, detalle: nombre || 'Crédito' };
}

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
  const cuotasPagadas = suma(g => !!g.es_cuota_credito);
  const desglose = gastos.filter(g => g.es_cuota_credito).map(g => ({ ...desglosarCuotaCredito(g), monto: Number(g.costo_total) || 0 }));
  const cuotas = desglose.reduce((a, d) => a + d.financiero, 0);          // intereses, comisión y seguros del negocio
  const capitalPropio = desglose.reduce((a, d) => a + d.capital, 0);
  const parteOtro = desglose.reduce((a, d) => a + d.otro, 0);
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
    cuotasPagadas, capitalPropio, parteOtro, desglose,
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
  const equilibrio = pctContrib > 0 ? Math.ceil((p.fijos + p.cuotas + p.capitalPropio) / (pctContrib / 100)) : null;

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
        que: 'Lo que queda después del costo de las deudas: intereses, comisión FOGAPE y seguros. El capital no es gasto.',
        formula: `EBITDA − intereses y comisiones ${fmtCLP(p.cuotas)}${p.desglose.some(d => d.estimado) ? ' (BancoEstado estimado)' : ''}` })}
      ${tarjetaMargen({ titulo: 'Margen neto', sigla: '', monto: p.neto, ventas: p.ventas, verde: 5, rojo: 0,
        que: 'Lo que de verdad queda para ti al final del período.',
        formula: `Antes de impuestos − IVA a pagar del período ${fmtCLP(p.iva)}` })}
    </div>
    ${p.desglose.length ? `<div class="mg-cuotas"><strong>💳 Cuotas pagadas en el período: ${fmtCLP(p.cuotasPagadas)}</strong>
      <ul>${p.desglose.map(d => `<li>${escHtml(d.detalle)}: ${fmtCLP(d.monto)} → costo tuyo ${fmtCLP(d.financiero)} · capital tuyo ${fmtCLP(d.capital)}${d.otro ? ` · mitad de tu papá ${fmtCLP(d.otro)} (la devuelve con el descuento del arriendo)` : ''}${d.estimado ? ' <span class="texto-apagado">(estimado)</span>' : ''}</li>`).join('')}</ul>
      <small>El capital no baja el margen, pero sí sale de la caja: para el flujo de plata cuenta la cuota completa.</small></div>` : ''}
    ${equilibrio ? `<div class="mg-equilibrio">🎯 Con este margen de contribución (${pctContrib.toLocaleString('es-CL', { maximumFractionDigits: 1 })}%), para cubrir los gastos fijos y tus cuotas (${fmtCLP(p.fijos + p.cuotas + p.capitalPropio)}) necesitas vender <strong>${fmtCLP(equilibrio)}</strong> en el período.${p.ventas >= equilibrio ? ' ✅ Ya lo pasaste.' : ` Te faltan ${fmtCLP(equilibrio - p.ventas)}.`}</div>` : ''}
    <details class="mg-notas">
      <summary>Qué quedó fuera y por qué</summary>
      <ul>
        <li><strong>Compras de mercadería</strong> (${fmtCLP(p.fueraInventario)}): no son gasto del mes; su costo cuenta cuando se vende (costo de lo vendido).</li>
        <li><strong>Activo fijo y devolución de préstamos o capital</strong> (${fmtCLP(p.fueraInversion)}): son inversión o devolver plata, no gasto.</li>
        <li><strong>Pagos al SII</strong> (${fmtCLP(p.fueraImpuestos)}): son el F29 de meses anteriores. Ya se descuenta el IVA de este período, así que no se restan otra vez.</li>
        <li><strong>Créditos:</strong> del BCI se resta el interés y la comisión exactos de su calendario. Del BancoEstado se resta solo <strong>tu mitad</strong>: la otra es el préstamo a tu papá. Su interés es un cálculo con el contrato (1,58% mensual más $48.620 de seguros), porque la tabla está en papel.</li>
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
