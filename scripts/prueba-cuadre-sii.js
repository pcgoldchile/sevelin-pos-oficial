// Prueba de "Cuadrar con el SII" (v169) contra el servidor real y el doble de Supabase:
//   node scripts/prueba-cuadre-sii.js
// Los datos imitan casos reales de septiembre de 2026: tres boletas de $7.000 el mismo día con
// dos ventas marcadas con boleta, una venta anotada un día después, tres facturas que suman un
// solo gasto, una factura anulada con nota de crédito y las facturas de comisiones de TUU.
const path = require('path');
const POS = path.join(__dirname, '..');
const doble = require('./doble-supabase.js');
const { bases } = doble.instalar(POS);
Object.assign(process.env, { NODE_ENV: 'development', JWT_SECRET: 'x', ADMIN_PIN: 'a', WORKER_PIN: 'b', SYNC_SECRET: 's', CORS_ORIGINS: '*' });

bases.pos.__defaults = { sii_rcv_documentos: { cuadre_estado: 'pendiente', venta_id: null, compra_id: null } };
let idV = 0;
const venta = (fecha, total, tipo = 'SIN DTE', extra = {}) => ({ id: ++idV, numero_orden: idV, fecha, hora: '12:00', total, envio_cobrado: null, tipo_dte: tipo, dte_folio: null, metodo_pago: 'Efectivo', cliente: null, estado: 'PAGADA', comision_pos: 0, ...extra });
bases.pos.ventas = [
  venta('2026-09-03', 38000, 'BOLETA'),          // 1 → boleta 28083, segura
  venta('2026-09-05', 7000, 'BOLETA'),           // 2 ┐ dos ventas de $7.000 con boleta el 05-09
  venta('2026-09-05', 7000, 'BOLETA'),           // 3 ┘ para tres boletas de $7.000 de ese día
  venta('2026-09-06', 7000),                     // 4 → candidata floja de la tercera
  venta('2026-09-14', 97000, 'BOLETA'),          // 5 → boleta 28102 del 13-09 (anotada un día después)
  venta('2026-09-21', 7000, 'BOLETA'),           // 6 → boleta 28113 del 22-09
  venta('2026-09-21', 7000),                     // 7
  venta('2026-09-10', 20000, 'BOLETA', { dte_folio: '28091' }),   // 8 → ya anotada: se liga sola
  venta('2026-09-25', 15000, 'BOLETA'),          // 9 → con boleta en el POS pero sin boleta en el SII
  venta('2026-09-11', 3000, 'SIN DTE', { comision_pos: 800 }),
];
const doc = (id, operacion, tipo, rut, razon, folio, fecha, total, extra = {}) => ({
  id, periodo: fecha.slice(0, 7).replace('-', ''), operacion, estado: 'REGISTRO', tipo_doc: tipo, rut, razon_social: razon, folio, fecha_doc: fecha,
  neto: Math.round(total / 1.19), iva: total - Math.round(total / 1.19), exento: 0, iva_no_recuperable: 0, total, fuente: 'robot',
  cuadre_estado: 'pendiente', venta_id: null, compra_id: null, ...extra,
});
bases.pos.sii_rcv_documentos = [
  doc(1, 'COMPRA', 33, '96693120-5', 'COMPUTACION E INGENIERIA S.A.', 40816, '2026-09-13', 99990),
  doc(2, 'COMPRA', 33, '96693120-5', 'COMPUTACION E INGENIERIA S.A.', 40815, '2026-09-13', 199980),
  doc(3, 'COMPRA', 33, '96693120-5', 'COMPUTACION E INGENIERIA S.A.', 40818, '2026-09-13', 199980),
  doc(4, 'COMPRA', 33, '76585223-4', 'INVERSIONES SIPO SPA', 8067, '2026-09-19', 280942),
  doc(5, 'COMPRA', 33, '77261280-K', 'FALABELLA RETAIL S.A.', 5735835, '2026-09-02', 117365),
  doc(6, 'COMPRA', 61, '77261280-K', 'FALABELLA RETAIL S.A.', 30391725, '2026-09-09', 117365),
  doc(7, 'COMPRA', 33, '76795561-8', 'HAULMER CHILE SPA', 1972272, '2026-09-30', 22078),
  doc(8, 'COMPRA', 33, '27127383-5', 'JUAN JOSE PEREZ LEON', 10130, '2026-09-05', 10916),
  doc(9, 'COMPRA', 33, '27127383-5', 'JUAN JOSE PEREZ LEON', 10131, '2026-09-05', 11299),
  doc(10, 'COMPRA', 33, '76944138-7', 'HIGH-TECH SPA', 7435, '2026-09-08', 169990),
  doc(11, 'COMPRA', 33, '76585223-4', 'INVERSIONES SIPO SPA', 8069, '2026-09-20', 278971),
];
const gasto = (id, fecha, proveedor, costo, extra = {}) => ({ id, fecha: `${fecha}T15:00:00.000Z`, proveedor, clasificacion: 'Mercadería / Productos para Reventa', costo_total: costo, tiene_factura: false, iva_credito: 0, descripcion: null, origen: 'MANUAL', metodo_pago: 'Transferencia', afecta_saldo: true, ...extra });
bases.pos.compras = [
  gasto(9, '2026-09-13', 'MercadoLibre', 499950),     // = facturas 1 + 2 + 3
  gasto(11, '2026-09-20', 'SipoOnline', 280940),      // ≈ factura 4 (2 pesos de diferencia)
  gasto(12, '2026-09-20', 'SipoOnline', 280980),      // la factura 11 es $2.009 menos: no se propone
  gasto(30, '2026-09-06', 'Ajuste interno', 4638, { origen: 'MERMA' }),
];
bases.pos.compra_clasificaciones = ['Mercadería / Productos para Reventa', 'Gastos Operativos (Servicios, Arriendo, Sueldos, etc.)']
  .map((nombre, i) => ({ id: i + 1, nombre, activo: true, grupo: i ? 'OPERATIVO' : 'INVENTARIO' }));
bases.pos.sii_sync = []; bases.pos.auditoria_dte = [];
bases.pos.ajustes_saldo = [{ id: 1, canal: 'BANCO', delta: -2396516, creado_en: '2026-09-12T16:36:13Z' }];

const CSV = [
  'Tipo Doc;RUT Receptor;Fecha Docto;Fecha Venc.;Indicador Servicio;Folio;Monto Neto;Monto IVA; Monto Exento;Monto Total',
  '39;66666666-6;03/09/2026; ;3;28083;31933;6067;0;38000;',
  '39;66666666-6;05/09/2026; ;3;28086;5882;1118;0;7000;',
  '39;66666666-6;05/09/2026; ;3;28085;5882;1118;0;7000;',
  '39;66666666-6;05/09/2026; ;3;28088;5882;1118;0;7000;',
  '39;66666666-6;10/09/2026; ;3;28091;16807;3193;0;20000;',
  '39;66666666-6;13/09/2026; ;3;28102;81513;15487;0;97000;',
  '39;66666666-6;17/09/2026; ;3;28109;369748;70252;0;440000;',
  '39;66666666-6;22/09/2026; ;3;28113;5882;1118;0;7000;',
].join('\r\n');

const api = require(path.join(POS, 'api', 'index.js'));
const jwt = require('jsonwebtoken');
const express = require('express');
const app = express(); app.use(api);
let fallas = 0;
const ok = (cond, texto, extra = '') => { if (!cond) fallas++; console.log(`${cond ? '✔' : '✘'} ${texto}${extra ? ' — ' + extra : ''}`); };

const srv = app.listen(0, async () => {
  const base = `http://127.0.0.1:${srv.address().port}/api`;
  const tok = jwt.sign({ rol: 'admin', nombre: 'Prueba' }, 'x');
  const pedir = async (m, ruta, cuerpo) => { const r = await fetch(base + ruta, { method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: cuerpo ? JSON.stringify(cuerpo) : undefined }); return [r.status, await r.json()]; };
  const docDe = (folio, op = 'VENTA') => bases.pos.sii_rcv_documentos.find(x => x.operacion === op && Number(x.folio) === folio);
  try {
    // 1. CSV de ventas: mes equivocado y mes correcto
    let [st, r] = await pedir('POST', '/finanzas/sii/cuadre/ventas-csv', { periodo: '2026-08', csv: CSV });
    ok(st === 400, '1a CSV de septiembre subido como agosto se rechaza', r.error);
    [st, r] = await pedir('POST', '/finanzas/sii/cuadre/ventas-csv', { periodo: '2026-09', csv: CSV });
    ok(st === 200 && r.documentos === 8, '1b CSV de ventas: 8 boletas guardadas', JSON.stringify(r));
    [st, r] = await pedir('POST', '/finanzas/sii/cuadre/ventas-csv', { periodo: '2026-09', csv: CSV });
    ok(bases.pos.sii_rcv_documentos.filter(x => x.operacion === 'VENTA').length === 8, '1c subirlo dos veces no duplica');
    ok(docDe(28091).cuadre_estado === 'asociado' && docDe(28091).venta_id === 8, '1d la boleta ya anotada en la venta se liga sola');

    // 2. El cuadre del mes
    [st, r] = await pedir('GET', '/finanzas/sii/cuadre?periodo=202609');
    ok(st === 200, '2a GET cuadre', r.error);
    const v = (folio) => r.ventas.find(x => Number(x.folio) === folio);
    const c = (folio) => r.compras.find(x => Number(x.folio) === folio);
    ok(v(28083).propuesta?.venta_id === 1 && v(28083).propuesta.confianza === 'alta', '2b 28083 → venta 1, alta');
    const de7 = [28086, 28085, 28088].map(f => v(f).propuesta);
    ok(de7.filter(p => p && [2, 3].includes(p.venta_id) && p.confianza === 'alta').length === 2, '2c dos de las tres boletas de $7.000 van a las ventas 2 y 3 con confianza alta', JSON.stringify(de7.map(p => p && [p.venta_id, p.confianza])));
    ok(de7.filter(p => p && p.venta_id === 4 && p.confianza === 'media').length === 1, '2d la tercera queda como propuesta media (venta 4, sin boleta, otro día)');
    ok(v(28102).propuesta?.venta_id === 5 && v(28102).propuesta.confianza === 'alta', '2e venta anotada un día después → alta');
    ok(v(28113).propuesta?.venta_id === 6 && v(28113).propuesta.confianza === 'alta', '2f prefiere la venta marcada con boleta (6) a la sin boleta (7)');
    ok(!v(28109).propuesta && !v(28109).sugerencias.length, '2g la RTX de $440.000 queda sin venta (para registrarla)');
    ok(c(1972272).cuadre_estado === 'comision', '2h la factura de Haulmer (TUU) queda como comisión, sin gasto');
    ok([40816, 40815, 40818].every(f => c(f).propuesta?.compra_id === 9 && c(f).propuesta.grupo?.length === 3), '2i las 3 facturas de Computación e Ingeniería suman el gasto de $499.950');
    ok(c(8067).propuesta?.compra_id === 11 && c(8067).propuesta.confianza === 'alta', '2j la de SIPO calza con 2 pesos de diferencia (y no con el gasto de $38 de diferencia)', c(8067).propuesta?.motivo);
    ok(!c(8069).propuesta && c(8069).sugerencias[0]?.id === 12, '2j2 la otra de SIPO ($2.009 de diferencia) no se propone, pero sale primera en las sugerencias');
    ok(r.ultimo_reajuste?.BANCO === '2026-09-12', '2q el último reajuste del banco viaja al panel');
    ok(c(5735835).propuesta?.nc?.folio === 30391725, '2k la de Falabella se propone anulada por su nota de crédito');
    ok(!r.compras.some(x => x.tipo_doc === 61), '2l las notas de crédito no se listan como facturas');
    ok(!c(7435).propuesta && c(7435).sugerencias.every(g => g.origen !== 'MERMA'), '2m HIGH-TECH sin gasto; las mermas nunca se sugieren');
    ok(r.pos_sin_documento.some(x => x.id === 9), '2n la venta 9 (con boleta en el POS, sin boleta en el SII) aparece aparte');
    ok(r.comisiones.length === 1 && r.comisiones[0].facturado === 22078 && r.comisiones[0].pos === 800, '2o comisiones: facturado vs lo que calculó el POS', JSON.stringify(r.comisiones));
    ok(bases.pos.ventas.every(x => x.id === 8 || !x.dte_folio), '2p abrir el cuadre no anota ninguna boleta sin confirmar');

    // 3. Confirmar lo marcado (todas las altas + una manipulada)
    const marcadas = [...r.ventas, ...r.compras].filter(x => x.propuesta?.confianza === 'alta')
      .map(x => ({ doc_id: x.id, venta_id: x.propuesta.venta_id, compra_id: x.propuesta.compra_id, nc_id: x.propuesta.nc?.id }));
    marcadas.push({ doc_id: docDe(28109).id, venta_id: 7 });   // no era una propuesta: se omite
    [st, r] = await pedir('POST', '/finanzas/sii/cuadre/confirmar', { periodo: '202609', propuestas: marcadas });
    ok(st === 200 && r.omitidas === 1, '3a confirmar: aplica las altas, omite la que no era propuesta', JSON.stringify(r));
    ok(bases.pos.ventas.find(x => x.id === 1).dte_folio === '28083', '3b la venta 1 queda con la boleta 28083');
    ok(bases.pos.ventas.find(x => x.id === 5).dte_folio === '28102', '3c la venta 5 queda con la boleta 28102');
    ok(docDe(5735835, 'COMPRA').cuadre_estado === 'ignorado' && /30391725/.test(docDe(5735835, 'COMPRA').cuadre_nota), '3d Falabella: ignorada con la NC en la nota');
    ok([40816, 40815, 40818].every(f => docDe(f, 'COMPRA').compra_id === 9), '3e las 3 facturas quedan en el mismo gasto');
    [st, r] = await pedir('POST', '/finanzas/sii/cuadre/confirmar', { periodo: '202609', propuestas: marcadas });
    ok(st === 200 && r.aplicadas === 0, '3f confirmar dos veces no hace nada', JSON.stringify(r));

    // 4. Asociar a mano, ignorar y reabrir
    const tercera = [28086, 28085, 28088].map(f => docDe(f)).find(x => x.cuadre_estado === 'pendiente');
    [st, r] = await pedir('POST', `/finanzas/sii/cuadre/${tercera.id}/asociar`, { venta_id: 1 });
    ok(st === 409, '4a no se asocia a una venta que ya tiene otra boleta', r.error);
    [st, r] = await pedir('POST', `/finanzas/sii/cuadre/${tercera.id}/asociar`, { venta_id: 10 });
    ok(st === 200 && /3\.000/.test(r.aviso || ''), '4b asociar con montos distintos avisa', r.aviso);
    ok(bases.pos.ventas.find(x => x.id === 10).tipo_dte === 'BOLETA' && bases.pos.auditoria_dte.length >= 1, '4c la venta pasa a BOLETA y queda en la auditoría de DTE');
    [st, r] = await pedir('POST', `/finanzas/sii/cuadre/${tercera.id}/reabrir`);
    ok(st === 200 && docDe(tercera.folio).cuadre_estado === 'pendiente', '4d reabrir la deja pendiente');
    [st, r] = await pedir('POST', `/finanzas/sii/cuadre/${docDe(28109).id}/ignorar`, {});
    ok(st === 400, '4e ignorar sin nota se rechaza');
    [st, r] = await pedir('POST', `/finanzas/sii/cuadre/${docDe(28109).id}/ignorar`, { nota: 'prueba' });
    ok(st === 200 && docDe(28109).cuadre_estado === 'ignorado', '4f ignorar con nota');
    await pedir('POST', `/finanzas/sii/cuadre/${docDe(28109).id}/reabrir`);

    // 5. Crear el gasto de dos facturas del mismo proveedor
    [st, r] = await pedir('POST', '/finanzas/sii/cuadre/crear-gasto', { ids: [docDe(10130, 'COMPRA').id, docDe(7435, 'COMPRA').id] });
    ok(st === 400, '5a no junta facturas de dos proveedores', r.error);
    [st, r] = await pedir('POST', '/finanzas/sii/cuadre/crear-gasto', { ids: [docDe(10130, 'COMPRA').id, docDe(10131, 'COMPRA').id], clasificacion: 'Mercadería / Productos para Reventa', metodo_pago: 'Transferencia', afecta_saldo: false });
    const nuevo = bases.pos.compras.find(x => x.id === r.compra_id);
    ok(st === 201 && nuevo && nuevo.costo_total === 22215 && nuevo.tiene_factura && nuevo.iva_credito === r.iva && nuevo.afecta_saldo === false && nuevo.origen === 'SII', '5b gasto creado con el total, el IVA y sin tocar el saldo', JSON.stringify(nuevo && { costo: nuevo.costo_total, iva: nuevo.iva_credito, saldo: nuevo.afecta_saldo, d: nuevo.descripcion, f: nuevo.fecha }));
    ok(/10130, 10131/.test(nuevo?.descripcion || '') && String(nuevo?.fecha).startsWith('2026-09-05'), '5c con los folios en la descripción y la fecha de la factura');
    [st, r] = await pedir('POST', '/finanzas/sii/cuadre/crear-gasto', { ids: [docDe(10130, 'COMPRA').id] });
    ok(st === 409, '5d la misma factura no crea dos gastos');

    // 6. Marcar la factura en un gasto que no la tenía
    [st, r] = await pedir('POST', `/finanzas/sii/cuadre/${docDe(40816, 'COMPRA').id}/marcar-factura`);
    const g9 = bases.pos.compras.find(x => x.id === 9);
    ok(st === 200 && g9.tiene_factura === true && g9.iva_credito === [1, 2, 3].reduce((s, i) => s + bases.pos.sii_rcv_documentos.find(x => x.id === i).iva, 0), '6a el gasto de $499.950 queda con la factura y el IVA de sus 3 facturas', `IVA ${g9.iva_credito}`);

    // 7. El aviso del encabezado
    [st, r] = await pedir('GET', '/finanzas/sii/cuadre-aviso');
    ok(st === 200 && r.ventas >= 1 && r.compras >= 1, '7a aviso', JSON.stringify(r));
    ok(!('1972272' in r), '7b las comisiones no cuentan en el aviso');

    // 8. Un trabajador no entra
    const tokT = jwt.sign({ rol: 'trabajador' }, 'x');
    const rt = await fetch(base + '/finanzas/sii/cuadre?periodo=202609', { headers: { Authorization: 'Bearer ' + tokT } });
    ok(rt.status === 403, '8a el trabajador no ve el cuadre', String(rt.status));
  } catch (e) {
    fallas++;
    console.error('ERROR', e);
  }
  console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo bien');
  srv.close();
  process.exit(fallas ? 1 : 0);
});
