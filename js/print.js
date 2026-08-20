/* ============================================================
   PRINT.JS — Ticket térmico (58 mm por defecto, 80 mm opcional)
   ------------------------------------------------------------
   La impresión directa al finalizar la venta está restaurada:
   pos.js llama a imprimirTicketVenta() apenas se registra la venta,
   y el historial puede reimprimir el mismo ticket cuando se quiera.

   Para cambiar el ancho del papel, en la consola del navegador:
     localStorage.setItem('pos_ticket_ancho', '80mm')
   ============================================================ */

/* QR de reseñas de Google: se agrega solo si el usuario lo marca en la
   pantalla de confirmación, y se pregunta en cada impresión. La librería
   se sirve desde el propio dominio (js/vendor/qrcode.min.js) para no
   depender de un CDN externo que algunos bloqueadores de anuncios filtran
   por el nombre "qrcode". */
const URL_RESENA_GOOGLE = 'https://g.page/r/CZzFra1V3A9aEAE/review';

function deseaQRResena() {
  const chk = document.getElementById('chkQrResena');
  return !!(chk && chk.checked);
}

/* Genera el QR como SVG (vectorial: no depende de <canvas>, imprime más
   nítido que un PNG) y lo inserta al final del ticket ya renderizado. */
function agregarQRResena(container) {
  return new Promise((resolve) => {
    if (!container || typeof QRCode === 'undefined') {
      console.warn('La librería de QR no está disponible; se imprime el ticket sin QR.');
      resolve();
      return;
    }

    QRCode.toString(URL_RESENA_GOOGLE, { type: 'svg', margin: 1, width: 130 }, (err, svg) => {
      if (err) {
        console.warn('No se pudo generar el QR de reseña:', err.message || err);
        resolve();
        return;
      }

      const bloque = document.createElement('div');
      bloque.className = 't-qr';
      bloque.innerHTML = `
        <div class="t-line"></div>
        <p class="t-center"><b>¿Cómo fue tu experiencia?</b></p>
        ${svg}
        <p class="t-center t-small">Escanea y déjanos tu reseña en Google</p>
      `;

      // Se inserta antes del espacio de corte del papel
      const feed = container.querySelector('.t-feed');
      if (feed) container.insertBefore(bloque, feed);
      else container.appendChild(bloque);

      resolve();
    });
  });
}

function anchoTicket() {
  return localStorage.getItem('pos_ticket_ancho') || '58mm';
}

function aplicarAnchoTicket() {
  document.documentElement.style.setProperty('--ticket-ancho', anchoTicket());
}

function construirTicketHTML(venta, items) {
  const lista = items || venta.items || [];
  const numero = String(venta.numero_orden ?? venta.id ?? 0).padStart(5, '0');
  const totalCalculado = venta.total ?? lista.reduce((a, i) => a + (Number(i.subtotal) || 0), 0);

  const filas = lista.map(it => `
    <tr>
      <td class="t-desc">
        ${it.cantidad}x ${escHtml(it.nombre)}
        ${it.serial_number ? `<div class="t-sn">S/N: ${escHtml(it.serial_number)}</div>` : ''}
      </td>
      <td class="t-right">${fmtCLP(it.subtotal)}</td>
    </tr>
  `).join('');

  return `
    <div class="t-head">
      <h3>${escHtml(NEGOCIO_NOMBRE)}</h3>
      <p>Comprobante</p>
      <p><b>Orden #${numero}</b></p>
    </div>
    <div class="t-line"></div>
    <p><b>Fecha:</b> ${escHtml(venta.fecha || todayISO())}${venta.hora ? ' ' + escHtml(venta.hora) : ''}</p>
    ${venta.cliente && String(venta.cliente).trim() ? `<p><b>Cliente:</b> ${escHtml(venta.cliente)}</p>` : ''}
    <p><b>Pago:</b> ${escHtml(venta.metodo_pago || '-')}</p>
    <div class="t-line"></div>
    <table>
      <tbody>${filas}</tbody>
    </table>
    <div class="t-line"></div>
    <div class="t-total">
      <span>TOTAL</span>
      <span>${fmtCLP(totalCalculado)}</span>
    </div>
    <div class="t-line"></div>
    <p class="t-center">¡Gracias por su compra!</p>
    <p class="t-center t-small">Le deseamos un excelente día ◝(ᵔᵕᵔ)◜</p>
    <div class="t-feed"></div>
  `;
}

/* El nombre del archivo al "Guardar como PDF" lo toma el navegador del
   título del documento. Se fija de inmediato (funciona en la mayoría de
   los casos), pero además se vuelve a fijar en el evento "beforeprint",
   que el navegador dispara justo en el instante en que arma el diálogo de
   impresión — esto es lo que garantiza el nombre sugerido incluso con
   impresoras reales de Windows (Microsoft Print to PDF), donde a veces el
   cambio de título hecho unos milisegundos antes no alcanza a "asentarse". */
const TITULO_ORIGINAL = document.title || 'Sistema POS - Sevelin';
let tituloParaImprimir = null;

function ponerTituloImpresion(titulo) {
  tituloParaImprimir = titulo;
  document.title = titulo;
}

function restaurarTitulo() {
  document.title = TITULO_ORIGINAL;
  tituloParaImprimir = null;
}

window.addEventListener('beforeprint', () => {
  if (tituloParaImprimir) document.title = tituloParaImprimir;
});

/* Imprime el ticket. Se usa al finalizar la venta y al reimprimir. */
function imprimirTicketVenta(venta, items, opciones) {
  const container = document.getElementById('ticketContainer');
  if (!container) return;

  aplicarAnchoTicket();
  container.innerHTML = construirTicketHTML(venta, items);

  // La clase indica QUÉ se imprime: ticket de 58 mm u orden de trabajo
  document.body.classList.remove('print-ot');
  document.body.classList.add('print-ticket');

  const numero = String(venta.numero_orden ?? venta.id ?? 0).padStart(5, '0');
  ponerTituloImpresion(`Ticket ${numero} - SEVELIN`);

  const conQR = (opciones && opciones.qr !== undefined) ? opciones.qr : deseaQRResena();

  const lanzar = () => setTimeout(() => {
    window.print();
    setTimeout(restaurarTitulo, 1500);   // por si no llega el evento afterprint
  }, 120);

  // Si va con QR hay que esperar a que la imagen esté generada
  if (conQR) agregarQRResena(container).then(lanzar);
  else lanzar();
}

function reimprimirTicket(venta, items, opciones) {
  imprimirTicketVenta(venta, items, opciones);
}

/* ============================================================
   ORDEN DE TRABAJO — Copia Cliente + Copia Taller
   Mantiene el estilo visual de la aplicación y deja el recuadro
   para la firma manuscrita de conformidad.
   ============================================================ */
function filaOT(etiqueta, valor) {
  if (valor === null || valor === undefined || valor === '' || valor === false) return '';
  return `<div class="ot-dato"><span>${etiqueta}</span><b>${escHtml(valor)}</b></div>`;
}

function construirComprobanteOT(ot, etiquetaCopia) {
  const entregado = ot.estado === 'ENTREGADO';
  const cargador = ot.cargador_deja
    ? [ot.cargador_tipo, ot.cargador_voltaje ? ot.cargador_voltaje + 'V' : '', ot.cargador_amperaje ? ot.cargador_amperaje + 'A' : '',
       ot.cargador_cable ? 'con cable' : ''].filter(Boolean).join(' · ') || 'Sí'
    : 'No deja cargador';

  return `
    <div class="ot-doc">
      <div class="ot-doc-head">
        <div>
          <h3>${escHtml(NEGOCIO_NOMBRE)}</h3>
          <p>Orden de Trabajo · Servicio Técnico</p>
        </div>
        <div class="ot-doc-num">
          <strong>${escHtml(ot.numero_ot || '—')}</strong>
          <span>${etiquetaCopia}</span>
        </div>
      </div>

      <div class="ot-doc-meta">
        <span>Ingreso: <b>${tsAChile(ot.fecha_ingreso)}</b></span>
        <span>Estado: <b>${escHtml(ot.estado || 'PENDIENTE')}</b></span>
        ${entregado ? `<span>Entrega: <b>${tsAChile(ot.fecha_entrega)}</b></span>` : ''}
      </div>

      <div class="ot-doc-grid">
        <section>
          <h4>Cliente</h4>
          ${filaOT('Nombre', ot.cliente_nombre)}
          ${filaOT('RUT / ID', ot.cliente_rut)}
          ${filaOT('Teléfono', ot.cliente_telefono)}
          ${filaOT('Correo', ot.cliente_correo)}
          ${filaOT('Dirección', ot.cliente_direccion)}
        </section>

        <section>
          <h4>Equipo</h4>
          ${filaOT('Categoría', ot.dispositivo_categoria)}
          ${filaOT('Modelo', ot.dispositivo_modelo)}
          ${filaOT('N° de serie', ot.dispositivo_sn)}
          ${filaOT('Encendido', ot.dispositivo_enciende)}
          ${filaOT('PIN / Clave', ot.dispositivo_pin)}
          ${filaOT('Cargador', cargador)}
          ${filaOT('Accesorios', ot.accesorios)}
        </section>
      </div>

      <section class="ot-doc-bloque">
        <h4>Falla reportada</h4>
        <p>${escHtml(ot.falla_reportada || '—')}</p>
        ${ot.obs_cliente ? `<h4>Observaciones del cliente</h4><p>${escHtml(ot.obs_cliente)}</p>` : ''}
        ${ot.obs_tecnico ? `<h4>Observaciones del técnico</h4><p>${escHtml(ot.obs_tecnico)}</p>` : ''}
      </section>

      <p class="ot-doc-legal">
        ${ot.acepta_responsabilidad
          ? 'El cliente autoriza la revisión del equipo y, de ser necesario, el formateo o reinstalación del sistema. Declara haber respaldado su información. El taller no responde por pérdida de datos ni por fallas ocultas preexistentes. Equipos no retirados dentro de 90 días quedan sujetos a costo de bodegaje.'
          : 'El cliente NO autorizó formateo ni reinstalación del sistema.'}
      </p>

      <div class="ot-doc-firmas">
        <div class="ot-firma-box">
          ${ot.retira_firma_base64
            ? `<img src="${ot.retira_firma_base64}" alt="Firma de conformidad">`
            : '<span class="ot-firma-vacia"></span>'}
          <span class="ot-firma-linea"></span>
          <small>Firma de conformidad del cliente</small>
          ${ot.retira_nombre ? `<small><b>${escHtml(ot.retira_nombre)}</b>${ot.retira_rut ? ' · ' + escHtml(ot.retira_rut) : ''}</small>` : ''}
        </div>
        <div class="ot-firma-box">
          <span class="ot-firma-vacia"></span>
          <span class="ot-firma-linea"></span>
          <small>Recepción / Técnico responsable</small>
        </div>
      </div>
    </div>
  `;
}

function imprimirOrdenTrabajo(ot) {
  const area = document.getElementById('otPrintArea');
  if (!area) return;

  area.innerHTML = `
    ${construirComprobanteOT(ot, 'COPIA CLIENTE')}
    <div class="ot-corte">—————————————  corte aquí  —————————————</div>
    ${construirComprobanteOT(ot, 'COPIA TALLER')}
  `;

  document.body.classList.remove('print-ticket');
  document.body.classList.add('print-ot');

  // Nombre por defecto al guardar como PDF: "OT-000002 - SEVELIN"
  ponerTituloImpresion(`${ot.numero_ot || 'OT'} - SEVELIN`);

  setTimeout(() => {
    window.print();
    setTimeout(restaurarTitulo, 1500);
  }, 150);
}

/* ============================================================
   COMPROBANTE DE ABONO (58 mm / 80 mm)
   Detalla la seña recibida y el saldo que queda por pagar.
   ============================================================ */
function imprimirTicketAbono(encargo, montoAbono) {
  const container = document.getElementById('ticketContainer');
  if (!container || !encargo) return;

  aplicarAnchoTicket();

  const abonoMostrado = montoAbono !== undefined && montoAbono !== null
    ? Number(montoAbono)
    : Number(encargo.monto_abonado) || 0;

  const historial = (encargo.abonos || []).map(a => `
    <tr>
      <td class="t-desc">${tsAChile(a.fecha).slice(0, 16)}<div class="t-sn">${escHtml(a.metodo_pago || '')}</div></td>
      <td class="t-right">${fmtCLP(a.monto)}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div class="t-head">
      <h3>${escHtml(NEGOCIO_NOMBRE)}</h3>
      <p>Comprobante de Abono</p>
      ${encargo.numero_ot ? `<p><b>${escHtml(encargo.numero_ot)}</b></p>` : ''}
    </div>
    <div class="t-line"></div>
    <p><b>Fecha:</b> ${fechaHoraChile()}</p>
    <p><b>Cliente:</b> ${escHtml(encargo.cliente_nombre || 'Cliente')}</p>
    ${encargo.cliente_telefono ? `<p><b>Teléfono:</b> ${escHtml(encargo.cliente_telefono)}</p>` : ''}
    <div class="t-line"></div>
    <p><b>Encargo:</b></p>
    <p>${escHtml(encargo.descripcion || '')}</p>
    <div class="t-line"></div>
    ${historial ? `<p><b>Abonos registrados:</b></p><table><tbody>${historial}</tbody></table><div class="t-line"></div>` : ''}
    <div class="t-total"><span>ABONO</span><span>${fmtCLP(abonoMostrado)}</span></div>
    <p style="display:flex; justify-content:space-between;"><span>Total encargo</span><span>${fmtCLP(encargo.monto_total)}</span></p>
    <p style="display:flex; justify-content:space-between;"><span>Total abonado</span><span>${fmtCLP(encargo.monto_abonado)}</span></p>
    <div class="t-line"></div>
    <div class="t-total"><span>SALDO</span><span>${fmtCLP(encargo.saldo)}</span></div>
    <div class="t-line"></div>
    <p class="t-center">${Number(encargo.saldo) <= 0 ? 'ENCARGO PAGADO POR COMPLETO' : 'Este documento acredita la seña recibida.'}</p>
    <p class="t-center">¡Gracias por su compra!</p>
    <p class="t-center t-small">Le deseamos un excelente día ◝(ᵔᵕᵔ)◜</p>
    <div class="t-feed"></div>
  `;

  document.body.classList.remove('print-ot', 'print-etiqueta', 'print-ficha');
  document.body.classList.add('print-ticket');
  ponerTituloImpresion(`Abono ${encargo.numero_ot || encargo.cliente_nombre} - SEVELIN`);

  const lanzar = () => setTimeout(() => {
    window.print();
    setTimeout(restaurarTitulo, 1500);
  }, 150);

  if (deseaQRResena()) agregarQRResena(container).then(lanzar);
  else lanzar();
}

/* ============================================================
   FICHA MANUAL DE CLIENTE
   Mini plantilla recortable para que el cliente complete sus datos a mano.
   ============================================================ */
function imprimirFichaManual() {
  const area = document.getElementById('fichaPrintArea');
  if (!area) return;

  const lineas = [
    'Nombre y apellidos',
    'RUT / ID',
    'Teléfono',
    'Correo electrónico',
    'Dirección'
  ].map(campo => `
    <div class="ficha-campo">
      <span>${campo}</span>
      <span class="ficha-linea"></span>
    </div>
  `).join('');

  const ficha = `
    <div class="ficha-doc">
      <div class="ficha-head">
        <h3>${escHtml(NEGOCIO_NOMBRE)}</h3>
        <p>Ficha de datos del cliente · Servicio Técnico</p>
      </div>
      ${lineas}
      <p class="ficha-nota">Complete sus datos con letra clara. Solo el nombre es obligatorio;
      el resto nos sirve para avisarle cuando su equipo esté listo.</p>
      <div class="ficha-campo">
        <span>Firma</span>
        <span class="ficha-linea"></span>
      </div>
      <p class="ficha-fecha">Fecha: ${fechaHoraChile()}</p>
    </div>
  `;

  // Dos copias por hoja para aprovechar el papel
  area.innerHTML = ficha + '<div class="ficha-corte">— — — — —  corte aquí  — — — — —</div>' + ficha;

  document.body.classList.remove('print-ticket', 'print-ot', 'print-etiqueta');
  document.body.classList.add('print-ficha');
  ponerTituloImpresion('Ficha de cliente - SEVELIN');

  setTimeout(() => {
    window.print();
    setTimeout(restaurarTitulo, 1500);
  }, 150);
}

/* Al cerrar el diálogo de impresión se limpian los modos */
window.addEventListener('afterprint', () => {
  document.body.classList.remove('print-ticket', 'print-ot', 'print-etiqueta', 'print-ficha');
  restaurarTitulo();
});

/* Respaldo por si el navegador no dispara afterprint (algunos móviles) */
function restaurarEstadoImpresion() {
  document.body.classList.remove('print-ticket', 'print-ot', 'print-etiqueta', 'print-ficha');
  restaurarTitulo();
}

document.addEventListener('DOMContentLoaded', aplicarAnchoTicket);
