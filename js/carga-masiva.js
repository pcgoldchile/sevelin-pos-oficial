// ==========================================
// CARGA-MASIVA.JS - Cargar varios productos de una compra, por copiar y pegar (v125)
// ------------------------------------------
// Pedido del dueño (06-10-2026): "le saco una captura a mi carrito, le digo
// a la IA que me dé el resultado para llegar y pegar". El flujo:
//   1. Copia las instrucciones (un texto fijo) y se las da a cualquier IA
//      junto con la captura o el texto del carrito.
//   2. Pega acá lo que la IA respondió: una línea por producto,
//      "Nombre | Cantidad | Costo por unidad | Enlace".
//   3. El POS busca productos parecidos que ya existan y PREGUNTA por cada
//      uno: ¿es nuevo o se suma al que ya está? Y pregunta una vez si la
//      mercadería ya llegó, está por llegar o es por encargo.
//   4. Carga todo con POST /api/productos/carga-masiva, que usa lo mismo que
//      el formulario de una compra. Fotos, descripción y lo demás, después.
//
// Nada se guarda hasta el botón final. Si la compra se suma o no a Gastos se
// elige ANTES de cargar (v126, dueño 06-10-2026): con "sí" se abre el gasto
// ya llenado al terminar; con "no" no se anota nada. Nunca se anota solo.
// ==========================================

const CARGA_MASIVA_INSTRUCCIONES = `Te voy a pasar una captura o el texto de un carrito de compra (o de una factura). Saca cada producto y respóndeme SOLO con una lista de texto, una línea por producto, con este formato exacto, separado por barras verticales:

Nombre del producto | Cantidad | Costo por unidad | Enlace

Reglas:
1. Nombre: claro y completo, como para la ficha de una tienda (máximo 90 letras). Incluye marca, modelo, medida y color si aparecen. Sin emojis y sin mayúsculas sostenidas.
2. Cantidad: cuántas unidades compré, número entero. Si el producto es un pack que se vende cerrado, deja "Pack x6" (o el que sea) en el nombre y pon cuántos packs compré.
3. Costo por unidad: lo que pagué por CADA unidad, en pesos chilenos, solo el número, sin puntos ni signo $. Si solo aparece el subtotal, divídelo por la cantidad.
4. Enlace: el link del producto si lo tienes; si no, déjalo vacío.
5. No inventes nada. Si un dato no se lee bien, escribe un signo ? en su lugar.
6. No pongas encabezado, numeración, comentarios ni el total.
7. Si se ve a quién le compré, pon antes de la lista una línea así: PROVEEDOR: nombre
8. Si se ve cuándo llega la compra (por ejemplo "Llega el sábado" o "Llega entre el 15 y el 20"), pon otra línea así: LLEGA: AAAA-MM-DD, con la fecha más lejana que aparezca. Hoy es __HOY__. Si no se ve, no pongas esa línea.

Ejemplo de respuesta:
PROVEEDOR: MercadoLibre
LLEGA: 2026-10-10
Balanza Digital de Baño 180 kg Vidrio Transparente | 30 | 2912 | https://ejemplo.cl/balanza
Pack x6 Cinta de Embalaje Transparente 300 m | 3 | 8861 |`;

// Palabras que no sirven para decidir si dos productos son el mismo
const CARGA_MASIVA_VACIAS = new Set(['para', 'con', 'sin', 'los', 'las', 'del', 'por', 'una', 'uno', 'color', 'negro', 'negra',
  'blanco', 'blanca', 'azul', 'rojo', 'gris', 'verde', 'pack', 'unidad', 'unidades', 'nuevo', 'nueva', 'generico', 'generica', 'tipo']);

let cargaMasiva = { filas: [], estado: null, gasto: null, enviando: false, archivados: [] };

// Las instrucciones llevan la fecha de hoy: sin ella la IA no puede convertir "llega el sábado" en una fecha.
function instruccionesCargaMasiva() {
  const [a, m, d] = todayISO().split('-');
  const dia = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][new Date(Date.UTC(+a, +m - 1, +d)).getUTCDay()];
  return CARGA_MASIVA_INSTRUCCIONES.replace('__HOY__', `${dia} ${todayISO()}`);
}

/* "2026-10-10", "10-10-2026" o "10/10/2026" → "2026-10-10" · cualquier otra cosa → '' */
function fechaDeCargaMasiva(texto) {
  const t = String(texto || '').trim();
  let m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) { const x = t.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/); if (x) m = [x[0], x[3], x[2], x[1]]; }
  if (!m) return '';
  const iso = `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  const f = new Date(iso + 'T12:00:00Z');
  return Number.isNaN(f.getTime()) || f.toISOString().slice(0, 10) !== iso ? '' : iso;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnCargaMasiva')?.addEventListener('click', abrirCargaMasiva);
  document.getElementById('btnCmCerrar')?.addEventListener('click', () => cerrarModal('modalCargaMasiva'));
  document.getElementById('btnCmCopiar')?.addEventListener('click', copiarInstruccionesCargaMasiva);
  document.getElementById('btnCmRevisar')?.addEventListener('click', revisarTextoCargaMasiva);
  document.getElementById('btnCmCargar')?.addEventListener('click', enviarCargaMasiva);
  document.getElementById('cmEstados')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-estado-masiva]');
    if (!b) return;
    cargaMasiva.estado = b.dataset.estadoMasiva;
    pintarCargaMasiva();
  });
  /* v126: sumar o no la compra a Gastos se elige antes de cargar (dueño, 06-10-2026). */
  document.getElementById('cmGastos')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-gasto-masiva]');
    if (!b) return;
    cargaMasiva.gasto = b.dataset.gastoMasiva;
    pintarCargaMasiva();
  });
  // Lo que se escribe en la tabla se guarda en la fila, sin redibujar (no se pierde el foco)
  const tabla = document.getElementById('cmTabla');
  const anotar = (e) => {
    const el = e.target.closest('[data-cm-campo]');
    if (!el) return;
    const fila = cargaMasiva.filas[Number(el.dataset.cmFila)];
    if (!fila) return;
    const campo = el.dataset.cmCampo;
    if (campo === 'incluir') fila.incluir = el.checked;
    else if (campo === 'nombre') fila.nombre = el.value;
    else if (campo === 'destino') fila.destino = el.value;
    else fila[campo] = el.value === '' ? '' : Number(el.value);
    pintarResumenCargaMasiva();
  };
  tabla?.addEventListener('input', anotar);
  tabla?.addEventListener('change', anotar);
  /* v130: buscador por fila. Solo se rehacen las opciones de ESA fila, para
     no perder el foco de lo que se está escribiendo. */
  tabla?.addEventListener('input', (e) => {
    const el = e.target.closest('[data-cm-buscar]');
    if (!el) return;
    const i = Number(el.dataset.cmBuscar);
    const fila = cargaMasiva.filas[i];
    if (!fila) return;
    fila.busqueda = el.value;
    fila.buscados = buscarEnCatalogoCargaMasiva(el.value);
    const sel = tabla.querySelector(`select[data-cm-fila="${i}"][data-cm-campo="destino"]`);
    if (sel) sel.innerHTML = opcionesDestinoCargaMasiva(fila);
    const nota = tabla.querySelector(`[data-cm-nota="${i}"]`);
    if (nota) nota.textContent = notaBusquedaCargaMasiva(fila);
  });
});

/* Todo lo que se puede comprar de nuevo: los productos activos y también los
   ARCHIVADOS (v130). Un producto archivado que se vuelve a comprar es el caso
   típico de duplicado: no aparecía en ninguna lista y se creaba otro igual. */
function catalogoDeCargaMasiva() {
  const activos = typeof productsList !== 'undefined' ? productsList : [];
  const vistos = new Set(activos.map(p => p.id));
  return activos.concat((cargaMasiva.archivados || []).filter(p => !vistos.has(p.id)))
    .filter(p => !p.es_servicio && !p.stock_ilimitado && !p.es_borrador);
}

const resumenProductoCargaMasiva = (p) => ({ id: p.id, nombre: p.nombre, stock: Number(p.stock) || 0, archivado: !!p.archivado });

/* Búsqueda a mano: todas las palabras escritas tienen que estar en el nombre,
   el SKU, el código de barras o el número del producto. */
function buscarEnCatalogoCargaMasiva(texto) {
  const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const palabras = norm(texto).split(/\s+/).filter(Boolean);
  if (norm(texto).trim().length < 2) return [];
  return catalogoDeCargaMasiva()
    .filter(p => { const donde = `${norm(p.nombre)} ${norm(p.sku)} ${norm(p.codigo_barras)} #${p.id}`; return palabras.every(x => donde.includes(x)); })
    .slice(0, 12).map(resumenProductoCargaMasiva);
}

function notaBusquedaCargaMasiva(f) {
  if (String(f.busqueda || '').trim().length < 2) return '';
  const n = (f.buscados || []).length;
  return n ? `${n} encontrado(s): elígelo en la lista de arriba` : 'No hay ninguno con ese nombre';
}

/* Las opciones de "¿ya existe?": producto nuevo, los parecidos que propone el
   POS, lo que el dueño buscó a mano y el que ya tenga elegido. */
function opcionesDestinoCargaMasiva(f) {
  const candidatos = [];
  const agregar = (p) => { if (p && !candidatos.some(c => String(c.id) === String(p.id))) candidatos.push(p); };
  (f.parecidos || []).forEach(agregar);
  (f.buscados || []).forEach(agregar);
  if (f.destino && f.destino !== 'nuevo' && !candidatos.some(c => String(c.id) === String(f.destino))) {
    const elegido = catalogoDeCargaMasiva().find(p => String(p.id) === String(f.destino));
    if (elegido) agregar(resumenProductoCargaMasiva(elegido));
  }
  return `${(f.parecidos || []).length && !f.destino ? '<option value="">⚠️ Se parece a uno que ya tienes: elige</option>' : ''}
    <option value="nuevo" ${f.destino === 'nuevo' ? 'selected' : ''}>🆕 Es un producto nuevo</option>
    ${candidatos.map(p => `<option value="${p.id}" ${String(f.destino) === String(p.id) ? 'selected' : ''}>➕ Sumar a: ${escHtml(acortar(p.nombre, 58))} (stock ${p.stock}${p.archivado ? ' · archivado: se desarchiva' : ''})</option>`).join('')}`;
}

function abrirCargaMasiva() {
  cargaMasiva = { filas: [], estado: null, gasto: null, enviando: false, archivados: [] };
  // Los archivados se traen aparte (la lista de Productos no los incluye). Si falla, se sigue sin ellos.
  cargaMasiva.esperaArchivados = API.productos.listarArchivados().then(lista => { cargaMasiva.archivados = Array.isArray(lista) ? lista : []; }).catch(() => {});
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('cmInstrucciones', instruccionesCargaMasiva());
  set('cmDevolucion', '');
  set('cmReferencia', '');
  set('cmTexto', '');
  set('cmFechaCompra', todayISO());
  set('cmProveedor', '');
  set('cmFechaLlegada', '');
  const resultado = document.getElementById('cmResultado');
  if (resultado) resultado.innerHTML = '';
  pintarCargaMasiva();
  document.getElementById('modalCargaMasiva')?.classList.add('show');
}

async function copiarInstruccionesCargaMasiva() {
  try {
    await navigator.clipboard.writeText(instruccionesCargaMasiva());
    showToast('Instrucciones copiadas: pégalas en tu IA junto con la captura del carrito', 'ok');
  } catch (_) {
    // Sin permiso de portapapeles: se abre el texto seleccionado para copiarlo a mano
    const caja = document.getElementById('cmInstrucciones');
    document.getElementById('cmVerInstrucciones')?.setAttribute('open', '');
    caja?.focus(); caja?.select();
    showToast('No pude copiar solo: el texto quedó seleccionado, cópialo con Ctrl + C', 'err');
  }
}

/* "$9.990" → 9990 · "6.446,50" → 6447 · "2912.00" → 2912 · "?" → null */
function numeroDeCargaMasiva(texto) {
  let t = String(texto ?? '').replace(/[^\d.,]/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/* Parte el texto pegado en filas. Acepta barras o tabuladores, con o sin
   barras en los bordes (tabla de Markdown), y salta encabezados y rayas. */
function leerTextoCargaMasiva(texto) {
  const filas = [];
  let proveedor = '';
  let llegada = '';
  let sinEntender = 0;
  for (const cruda of String(texto || '').split(/\r?\n/)) {
    const linea = cruda.trim();
    if (!linea || /^[\s|:\-–—=_]+$/.test(linea)) continue;
    const prov = linea.match(/^\**\s*proveedor\s*\**\s*:\s*(.+)$/i);
    if (prov) { proveedor = prov[1].replace(/\*/g, '').trim().slice(0, 80); continue; }
    // v130: "LLEGA: 2026-10-10" (opcional). Una fecha que no se entiende se ignora, no frena nada.
    const llega = linea.match(/^\**\s*(?:llega|llegada|fecha de llegada)\s*\**\s*:\s*(.+)$/i);
    if (llega) { llegada = fechaDeCargaMasiva(llega[1]); continue; }
    const celdas = linea.replace(/^\|/, '').replace(/\|$/, '').split(linea.includes('|') ? '|' : '\t').map(c => c.trim());
    if (celdas.length < 2 || !celdas[0]) { sinEntender++; continue; }
    if (/^(nombre|producto)/i.test(celdas[0]) && numeroDeCargaMasiva(celdas[1]) === null) continue;   // encabezado
    const enlace = celdas.slice(3).find(c => /^https?:\/\//i.test(c)) || '';
    filas.push({
      nombre: celdas[0].replace(/^\d+[.)]\s+/, '').replace(/\*\*/g, '').slice(0, 200),
      cantidad: numeroDeCargaMasiva(celdas[1]) ?? '',
      costo: numeroDeCargaMasiva(celdas[2]) ?? '',
      precio: '',
      enlace,
      incluir: true,
      destino: ''
    });
  }
  return { filas, proveedor, llegada, sinEntender };
}

function palabrasDeCargaMasiva(nombre) {
  return [...new Set(String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .split(/[^a-z0-9]+/).filter(p => p.length >= 3 && !CARGA_MASIVA_VACIAS.has(p)))];
}

/* Productos del catálogo que se parecen: comparten al menos 2 palabras
   (o el comienzo de ellas: "raqueta" y "raquetas") y eso es la mitad o más
   del nombre más corto. Solo PROPONE: la decisión es siempre del dueño. */
function parecidosDeCargaMasiva(nombre) {
  const mias = palabrasDeCargaMasiva(nombre);
  if (!mias.length) return [];
  const calza = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));
  const lista = [];
  for (const p of catalogoDeCargaMasiva()) {
    const suyas = palabrasDeCargaMasiva(p.nombre);
    if (!suyas.length) continue;
    const comunes = mias.filter(a => suyas.some(b => calza(a, b))).length;
    const parte = comunes / Math.min(mias.length, suyas.length);
    if (comunes >= 2 && parte >= 0.5) lista.push({ ...resumenProductoCargaMasiva(p), comunes, parte });
  }
  return lista.sort((a, b) => b.parte - a.parte || b.comunes - a.comunes).slice(0, 4);
}

async function revisarTextoCargaMasiva() {
  await cargaMasiva.esperaArchivados;   // los archivados tienen que estar antes de buscar parecidos
  const texto = document.getElementById('cmTexto')?.value || '';
  const { filas, proveedor, llegada, sinEntender } = leerTextoCargaMasiva(texto);
  if (!filas.length) {
    showToast('No encontré productos en lo pegado. Tiene que venir una línea por producto: Nombre | Cantidad | Costo por unidad', 'err');
    return;
  }
  // Sin parecidos parte como "nuevo" (se puede cambiar buscando); con parecidos hay que elegir.
  filas.forEach(f => { f.parecidos = parecidosDeCargaMasiva(f.nombre); f.buscados = []; f.busqueda = ''; f.destino = f.parecidos.length ? '' : 'nuevo'; });
  cargaMasiva.filas = filas;
  const elProv = document.getElementById('cmProveedor');
  if (elProv && proveedor && !elProv.value) elProv.value = proveedor;
  /* v130: si la IA leyó cuándo llega, queda puesta la fecha y marcado "por
     llegar" (una fecha de llegada futura es justamente eso). Se puede cambiar. */
  const elLlegada = document.getElementById('cmFechaLlegada');
  if (llegada && elLlegada) {
    elLlegada.value = llegada;
    if (!cargaMasiva.estado && llegada >= todayISO()) cargaMasiva.estado = 'por_llegar';
  }
  const resultado = document.getElementById('cmResultado');
  if (resultado) resultado.innerHTML = '';
  pintarCargaMasiva();
  showToast(`${filas.length} producto(s) leído(s)${llegada ? ` · llega el ${llegada.split('-').reverse().join('-')}` : ''}${sinEntender ? ` · ${sinEntender} línea(s) no se entendieron` : ''}`, sinEntender ? 'err' : 'ok');
  document.getElementById('cmRevision')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function pintarCargaMasiva() {
  const revision = document.getElementById('cmRevision');
  const tabla = document.getElementById('cmTabla');
  if (!revision || !tabla) return;
  const hay = cargaMasiva.filas.length > 0;
  revision.style.display = hay ? 'block' : 'none';
  if (!hay) { pintarResumenCargaMasiva(); return; }

  const encargo = cargaMasiva.estado === 'encargo';
  document.querySelectorAll('#cmEstados [data-estado-masiva]').forEach(b => {
    const activo = b.dataset.estadoMasiva === cargaMasiva.estado;
    b.classList.toggle('activo', activo);
    b.setAttribute('aria-checked', activo ? 'true' : 'false');
  });
  // Un encargo no es una compra: no hay gasto que decidir
  const bloqueGasto = document.getElementById('cmBloqueGasto');
  if (bloqueGasto) bloqueGasto.style.display = encargo ? 'none' : 'block';
  document.querySelectorAll('#cmGastos [data-gasto-masiva]').forEach(b => {
    const activo = b.dataset.gastoMasiva === cargaMasiva.gasto;
    b.classList.toggle('activo', activo);
    b.setAttribute('aria-checked', activo ? 'true' : 'false');
  });
  const bloqueFecha = document.getElementById('cmBloqueLlegada');
  if (bloqueFecha) bloqueFecha.style.display = cargaMasiva.estado === 'por_llegar' ? 'block' : 'none';

  tabla.innerHTML = `
    <table class="data-table tabla-carga-masiva">
      <thead><tr>
        <th></th><th>Producto</th><th>Cantidad</th><th>Costo c/u</th><th>Precio de venta</th><th>¿Ya existe en tu catálogo?</th>
      </tr></thead>
      <tbody>
        ${cargaMasiva.filas.map((f, i) => `
          <tr>
            <td><input type="checkbox" data-cm-fila="${i}" data-cm-campo="incluir" ${f.incluir ? 'checked' : ''} title="Cargar esta fila"></td>
            <td><input type="text" class="cm-nombre" data-cm-fila="${i}" data-cm-campo="nombre" value="${escHtml(f.nombre)}" maxlength="200">
              ${f.enlace ? `<small class="fila-meta">${escHtml(acortar(f.enlace, 48))}</small>` : ''}</td>
            <td><input type="number" class="cm-num" data-cm-fila="${i}" data-cm-campo="cantidad" value="${escHtml(f.cantidad)}" min="1" step="1" ${encargo ? 'disabled' : ''}></td>
            <td><input type="number" class="cm-num" data-cm-fila="${i}" data-cm-campo="costo" value="${escHtml(f.costo)}" min="0" step="1"></td>
            <td><input type="number" class="cm-num" data-cm-fila="${i}" data-cm-campo="precio" value="${escHtml(f.precio)}" min="0" step="1" placeholder="Después"></td>
            <td class="cm-celda-destino">${encargo
              ? '<span class="cm-nuevo">🆕 Producto nuevo</span>'
              : `<select data-cm-fila="${i}" data-cm-campo="destino" class="cm-destino${f.destino ? '' : ' cm-falta'}">${opcionesDestinoCargaMasiva(f)}</select>
                 <input type="search" class="cm-buscar" data-cm-buscar="${i}" value="${escHtml(f.busqueda || '')}" placeholder="🔎 ¿No aparece? Búscalo en tu catálogo…" autocomplete="off">
                 <small class="cm-buscar-nota" data-cm-nota="${i}">${escHtml(notaBusquedaCargaMasiva(f))}</small>`}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
  pintarResumenCargaMasiva();
}

/* Qué falta para poder cargar, y cuánta plata es. Devuelve el mensaje de lo que falta o ''. */
function pintarResumenCargaMasiva() {
  const resumen = document.getElementById('cmResumen');
  const btn = document.getElementById('btnCmCargar');
  const filas = cargaMasiva.filas.filter(f => f.incluir);
  const encargo = cargaMasiva.estado === 'encargo';
  document.querySelectorAll('#cmTabla select[data-cm-campo="destino"]').forEach(s => s.classList.toggle('cm-falta', !s.value));

  let falta = '';
  if (!cargaMasiva.filas.length) falta = '';
  else if (!filas.length) falta = 'Marca al menos un producto.';
  else if (!cargaMasiva.estado) falta = 'Elige arriba si ya llegaron, están por llegar o son por encargo.';
  else if (!encargo && !cargaMasiva.gasto) falta = 'Dime si sumo esta compra a gastos de mercadería o no.';
  else if (filas.some(f => !String(f.nombre || '').trim())) falta = 'Hay un producto sin nombre.';
  else if (!encargo && filas.some(f => !(Number(f.cantidad) > 0))) falta = 'Hay un producto sin cantidad.';
  else if (!encargo && filas.some(f => f.costo === '' || Number(f.costo) < 0)) falta = 'Hay un producto sin costo (si de verdad fue gratis, escribe 0).';
  else if (!encargo && filas.some(f => f.parecidos.length && !f.destino)) falta = 'Hay productos que se parecen a uno que ya tienes: dime en cada uno si es nuevo o se suma.';

  const total = encargo ? 0 : filas.reduce((a, f) => a + (Number(f.cantidad) || 0) * (Number(f.costo) || 0), 0);
  const unidades = encargo ? 0 : filas.reduce((a, f) => a + (Number(f.cantidad) || 0), 0);
  if (resumen) {
    resumen.innerHTML = !cargaMasiva.filas.length ? '' : falta
      ? `<span class="cm-aviso">⚠️ ${escHtml(falta)}</span>`
      : `<span>${filas.length} producto(s)${encargo ? ' por encargo' : ` · ${unidades} unidades · <strong>${fmtCLP(total)}</strong>`}</span>`;
  }
  if (btn) {
    btn.disabled = !!falta || !filas.length || cargaMasiva.enviando;
    btn.textContent = cargaMasiva.estado === 'por_llegar' ? `🚚 Cargar ${filas.length} como "por llegar"`
      : encargo ? `📦 Crear ${filas.length} por encargo`
      : `📥 Cargar ${filas.length} y sumar al stock`;
  }
  return falta;
}

async function enviarCargaMasiva() {
  if (cargaMasiva.enviando || pintarResumenCargaMasiva()) return;
  const encargo = cargaMasiva.estado === 'encargo';
  const filas = cargaMasiva.filas.filter(f => f.incluir);
  const cuerpo = {
    estado: cargaMasiva.estado,
    fecha_compra: document.getElementById('cmFechaCompra')?.value || todayISO(),
    proveedor: (document.getElementById('cmProveedor')?.value || '').trim() || null,
    fecha_llegada_estimada: cargaMasiva.estado === 'por_llegar' ? (document.getElementById('cmFechaLlegada')?.value || null) : null,
    // v130: los mismos datos opcionales del formulario de una compra
    devolucion_hasta: encargo ? null : (document.getElementById('cmDevolucion')?.value || null),
    referencia: encargo ? null : ((document.getElementById('cmReferencia')?.value || '').trim() || null),
    items: filas.map(f => ({
      nombre: String(f.nombre).trim(),
      cantidad: encargo ? 0 : Number(f.cantidad),
      costo_unitario: Number(f.costo) || 0,
      precio_venta: Number(f.precio) || 0,
      enlace: f.enlace || '',
      producto_id: !encargo && f.destino && f.destino !== 'nuevo' ? Number(f.destino) : null
    }))
  };

  cargaMasiva.enviando = true;
  pintarResumenCargaMasiva();
  try {
    const r = await API.productos.cargaMasiva(cuerpo);
    const malos = (r.resultados || []).filter(x => !x.ok);
    const quiereGasto = !encargo && cargaMasiva.gasto === 'si';
    const abrirGasto = () => {
      cerrarModal('modalCargaMasiva');
      abrirGastoPrellenado({ monto: num(r.total_compra), descripcion: `Compra de ${num(r.cargados)} productos (carga masiva)`, proveedor: r.proveedor || '' });
    };
    const resultado = document.getElementById('cmResultado');
    if (resultado) {
      resultado.innerHTML = `
        <div class="cm-resultado ${malos.length ? 'con-fallas' : ''}">
          <strong>✅ ${num(r.cargados)} producto(s) cargado(s)</strong>: ${num(r.creados)} nuevo(s) y ${num(r.sumados)} sumado(s) a uno que ya existía.
          ${r.estado === 'por_llegar' ? ' Quedaron <strong>por llegar</strong>, sin sumar stock: cuando lleguen, botón 🚚 de arriba y "Ya llegó".' : ''}
          ${r.estado === 'llego' ? ' El stock ya quedó sumado.' : ''}
          ${(r.resultados || []).some(x => x.desarchivado) ? `<br>📦 Volvieron del archivo: ${(r.resultados || []).filter(x => x.desarchivado).map(x => escHtml(x.nombre)).join(', ')}. Siguen sin publicar.` : ''}
          ${malos.length ? `<br>⚠️ No se pudieron cargar: ${malos.map(m => `${escHtml(m.nombre)} (${escHtml(m.error)})`).join('; ')}` : ''}
          <br>Les falta foto, descripción, categoría${filas.some(f => !(Number(f.precio) > 0)) ? ', precio de venta' : ''} y publicarlos: están en la lista de Productos.
          ${num(r.total_compra) > 0 && quiereGasto ? `<br><span class="compra-aviso-gasto" style="margin-top:8px;">💸 Esta compra son <strong>${fmtCLP(r.total_compra)}</strong>. Falta guardar el gasto en Finanzas.
            <button type="button" class="btn btn-primary btn-sm" id="btnCmGasto">Abrir el gasto</button></span>` : ''}
          ${num(r.total_compra) > 0 && !quiereGasto ? '<br>🚫 No se anotó ningún gasto por esta compra, como pediste.' : ''}
        </div>`;
      document.getElementById('btnCmGasto')?.addEventListener('click', abrirGasto);
    }
    // Lo que entró sale de la lista; lo que falló se queda para corregirlo
    const fallidos = new Set(malos.map(m => m.nombre));
    cargaMasiva.filas = cargaMasiva.filas.filter(f => !f.incluir || fallidos.has(String(f.nombre).trim()));
    const texto = document.getElementById('cmTexto');
    if (texto && !cargaMasiva.filas.length) texto.value = '';
    showToast(`${num(r.cargados)} producto(s) cargado(s)`, malos.length ? 'err' : 'ok');
    if (typeof cargarProductos === 'function') await cargarProductos(true);
    if (typeof actualizarAvisoEnCamino === 'function') actualizarAvisoEnCamino();
    // Pidió sumar el gasto y todo cargó bien: se abre el gasto ya llenado, sin otro clic
    if (quiereGasto && !malos.length && num(r.total_compra) > 0) abrirGasto();
    cargaMasiva.gasto = null;
  } catch (err) {
    showToast(err.message || 'No se pudo cargar la lista', 'err');
  } finally {
    cargaMasiva.enviando = false;
    pintarCargaMasiva();
  }
}
