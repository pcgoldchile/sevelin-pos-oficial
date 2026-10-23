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

Nombre del producto | Cantidad | Costo por unidad | Enlace | Marca

Reglas:
1. Nombre: claro y completo, como para la ficha de una tienda (máximo 90 letras). Incluye marca, modelo, medida y color si aparecen. Sin emojis y sin mayúsculas sostenidas.
2. Cantidad: cuántas unidades compré, número entero. Si el producto es un pack que se vende cerrado, deja "Pack x6" (o el que sea) en el nombre y pon cuántos packs compré.
3. Costo por unidad: lo que pagué por CADA unidad, en pesos chilenos, solo el número, sin puntos ni signo $. Si solo aparece el subtotal, divídelo por la cantidad.
4. Enlace: el link del producto si lo tienes; si no, déjalo vacío.
4b. Marca: la marca del fabricante si se ve (por ejemplo Kingston o Fiddler). Si no tiene marca o no se ve, déjalo vacío. No pongas el nombre de la tienda como marca.
5. No inventes nada. Si un dato no se lee bien, escribe un signo ? en su lugar.
6. No pongas encabezado, numeración, comentarios ni el total.
7. Si se ve a quién le compré (el vendedor o la tienda), pon antes de la lista una línea así: PROVEEDOR: nombre
7b. Si la compra es en un marketplace (MercadoLibre, Falabella, Paris, Ripley, AliExpress, Temu, Amazon u otro), pon otra línea así: MARKETPLACE: nombre. En ese caso PROVEEDOR es el vendedor o la tienda oficial que aparece dentro del marketplace. Si es una compra directa a una tienda, no pongas esa línea.
8. Si se ve cuándo llega la compra (por ejemplo "Llega el sábado" o "Llega entre el 15 y el 20"), pon otra línea así: LLEGA: AAAA-MM-DD, con la fecha más lejana que aparezca. Hoy es __HOY__. Si no se ve, no pongas esa línea.

Ejemplo de respuesta:
PROVEEDOR: Tienda Oficial Fiddler
MARKETPLACE: MercadoLibre
LLEGA: 2026-10-10
Aire Comprimido Spray Multipropósito Air Duster 400 ml | 5 | 4990 | https://ejemplo.cl/aire | Fiddler
Pack x6 Cinta de Embalaje Transparente 300 m | 3 | 8861 | |`;

// Para separar un "VENDEDOR / MERCADOLIBRE" escrito todo junto, como se anotaba antes.
const CARGA_MASIVA_MARKETPLACES = ['MercadoLibre', 'Falabella', 'Paris', 'Ripley', 'Líder', 'Sodimac', 'AliExpress', 'Temu', 'Shein', 'Amazon'];
function marketplaceConocidoCargaMasiva(texto) {
  const llave = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  const t = llave(texto).replace(/^mercadolibrechile$|^meli$|^ml$/, 'mercadolibre');
  return CARGA_MASIVA_MARKETPLACES.find(m => llave(m) === t) || '';
}

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
    else if (campo === 'marca') fila.marca = el.value;
    else fila[campo] = el.value === '' ? '' : Number(el.value);
    pintarResumenCargaMasiva();
  };
  tabla?.addEventListener('input', anotar);
  tabla?.addEventListener('change', anotar);

  /* v179: combo "¿Ya existe?" — abrir al enfocar, filtrar mientras se escribe
     (sin repintar la tabla entera, para no perder el foco) y elegir con un clic. */
  tabla?.addEventListener('focusin', (e) => {
    const el = e.target.closest('[data-cm-combo-input]');
    if (!el) return;
    const i = Number(el.dataset.cmComboInput);
    const fila = cargaMasiva.filas[i];
    if (!fila) return;
    fila.comboAbierto = true;
    fila.busqueda = '';
    fila.buscados = [];
    el.value = '';
    actualizarComboCargaMasiva(i, { mantenerTexto: true });
  });
  tabla?.addEventListener('input', (e) => {
    const el = e.target.closest('[data-cm-combo-input]');
    if (!el) return;
    const i = Number(el.dataset.cmComboInput);
    const fila = cargaMasiva.filas[i];
    if (!fila) return;
    fila.busqueda = el.value;
    fila.buscados = buscarEnCatalogoCargaMasiva(el.value);
    actualizarComboCargaMasiva(i, { mantenerTexto: true });
  });
  // La lista de opciones cuelga de <body> (ver posicionarComboLista): el clic se
  // escucha en document, no en la tabla.
  document.addEventListener('click', (e) => {
    const op = e.target.closest('[data-cm-opcion]');
    if (!op) return;
    const [i, valor] = op.dataset.cmOpcion.split(':');
    const fila = cargaMasiva.filas[Number(i)];
    if (!fila) return;
    fila.destino = valor;
    fila.comboAbierto = false;
    // Fotos que se habían quedado armando un producto nuevo no sirven si al final se suma a uno que ya existe.
    if (valor !== 'nuevo') fila.fotos = [];
    pintarCargaMasiva();
  });
  // Clic afuera del campo Y de su lista: cierra. Scrollear la tabla o el modal
  // también, para que la lista nunca quede pegada en un lugar que ya no es el suyo.
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-cm-combo]') || e.target.closest('.cm-combo-lista')) return;
    cerrarCombosCargaMasiva();
  });
  tabla?.addEventListener('scroll', cerrarCombosCargaMasiva);
  document.querySelector('#modalCargaMasiva .modal-box')?.addEventListener('scroll', cerrarCombosCargaMasiva);

  /* v179: fotos del producto nuevo — botón "📷+" por fila, un solo selector de
     archivos compartido (el mismo que ya usa la ficha para comprimir a webp). */
  tabla?.addEventListener('click', (e) => {
    const btnAgregar = e.target.closest('[data-cm-foto-agregar]');
    if (btnAgregar) {
      cmFotoFilaObjetivo = Number(btnAgregar.dataset.cmFotoAgregar);
      document.getElementById('cmFotoInput')?.click();
      return;
    }
    const btnQuitar = e.target.closest('[data-cm-foto-quitar]');
    if (btnQuitar) {
      const [i, k] = btnQuitar.dataset.cmFotoQuitar.split(':').map(Number);
      const fila = cargaMasiva.filas[i];
      if (fila?.fotos) { fila.fotos.splice(k, 1); pintarCargaMasiva(); }
    }
  });
  document.getElementById('cmFotoInput')?.addEventListener('change', (e) => {
    const archivos = [...(e.target.files || [])].filter(f => f.type.startsWith('image/'));
    e.target.value = '';
    if (cmFotoFilaObjetivo === null || !archivos.length) return;
    agregarFotosCargaMasiva(cmFotoFilaObjetivo, archivos);
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

const resumenProductoCargaMasiva = (p) => ({
  id: p.id, nombre: p.nombre, stock: Number(p.stock) || 0, archivado: !!p.archivado,
  usa_lotes: !!p.usa_lotes, foto: (Array.isArray(p.imagen_urls) && p.imagen_urls[0]) || null
});

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

/* v179: el <select> + buscador por separado se reemplazó por un solo combo
   (escribe y aparece la lista, con foto) — "buscarlos por un pop up según lo
   que escriba, y que salga la foto del producto" (dueño, 23-10-2026). */

/* El producto ya elegido para esta fila (null si es nuevo o no hay nada elegido). */
function productoElegidoCargaMasiva(f) {
  if (!f.destino || f.destino === 'nuevo') return null;
  const p = catalogoDeCargaMasiva().find(p => String(p.id) === String(f.destino));
  return p ? resumenProductoCargaMasiva(p) : null;
}

/* Candidatos a mostrar en la lista desplegable: los parecidos que propone el
   POS primero, después lo que el dueño va escribiendo. */
function candidatosComboCargaMasiva(f) {
  const candidatos = [];
  const agregar = (p) => { if (p && !candidatos.some(c => String(c.id) === String(p.id))) candidatos.push(p); };
  (f.parecidos || []).forEach(agregar);
  (f.buscados || []).forEach(agregar);
  return candidatos;
}

function filaComboCargaMasiva(p, i) {
  return `<div class="cm-combo-opcion" data-cm-opcion="${i}:${p.id}">
    ${p.foto ? `<img src="${escHtml(p.foto)}" class="cm-combo-foto" alt="">` : '<span class="cm-combo-sinfoto">🧩</span>'}
    <span class="cm-combo-opcion-texto">${escHtml(acortar(p.nombre, 56))}
      <small>Stock ${p.stock}${p.archivado ? ' · archivado: se desarchiva' : ''}${p.usa_lotes ? '' : ' · sin PEPS: se activa al cargar'}</small>
    </span>
  </div>`;
}

/* El contenido de la lista desplegable de una fila (se redibuja solo, sin
   tocar el resto de la tabla — ver actualizarComboCargaMasiva). */
function listaComboCargaMasiva(f, i) {
  const candidatos = candidatosComboCargaMasiva(f);
  const aviso = (f.parecidos || []).length && !f.destino
    ? '<div class="cm-combo-aviso">⚠️ Se parece a uno que ya tienes: elige abajo</div>' : '';
  const nuevo = `<div class="cm-combo-opcion cm-combo-opcion-nuevo" data-cm-opcion="${i}:nuevo">
    <span class="cm-combo-sinfoto">🆕</span><span>Es un producto nuevo</span></div>`;
  const vacio = String(f.busqueda || '').trim().length >= 2 && !candidatos.length
    ? '<div class="cm-combo-vacio">No hay ninguno con ese nombre</div>' : '';
  return aviso + nuevo + candidatos.map((p, k) => filaComboCargaMasiva(p, i)).join('') + vacio;
}

/* Celda "¿Ya existe?": el combo + abajo, si hay uno elegido, su foto y el
   estado del PEPS (informativo: se activa solo al cargar, sin preguntar). */
function celdaComboCargaMasiva(f, i) {
  const elegido = productoElegidoCargaMasiva(f);
  const textoInput = f.comboAbierto ? (f.busqueda ?? '')
    : (f.destino === 'nuevo' ? '🆕 Producto nuevo' : (elegido ? elegido.nombre : ''));
  return `
    <div class="cm-combo" data-cm-combo="${i}">
      <input type="text" class="cm-combo-input${f.destino ? '' : ' cm-falta'}" data-cm-combo-input="${i}"
        value="${escHtml(textoInput)}" placeholder="🔎 Nuevo o buscar en tu catálogo…" autocomplete="off">
    </div>
    ${elegido ? `
      <div class="cm-elegido">
        ${elegido.foto ? `<img src="${escHtml(elegido.foto)}" class="cm-elegido-foto" alt="">` : '<span class="cm-combo-sinfoto">🧩</span>'}
        <small>Stock ${elegido.stock} · ${elegido.usa_lotes ? '✅ PEPS activo' : '⚡ sin PEPS: se activa al cargar'}</small>
      </div>` : ''}`;
}

/* La lista desplegable NO vive dentro de la celda: #cmTabla tiene scroll
   propio (overflow-x) y, por regla de CSS, eso recorta también el eje
   vertical — una lista "absolute" adentro quedaba invisible, tapada por ese
   recorte. Se cuelga de <body> con position:fixed, calculada sobre dónde
   está el campo en pantalla, así nunca la corta ningún contenedor. */
function posicionarComboLista(input, lista) {
  const r = input.getBoundingClientRect();
  lista.style.left = `${r.left}px`;
  lista.style.top = `${r.bottom + 4}px`;
  lista.style.width = `${r.width}px`;
}

/* Redibuja SOLO el combo de una fila (abrir/cerrar la lista, o filtrarla
   mientras se escribe) sin repintar la tabla entera — así no se pierde el
   foco a mitad de tipear, igual que el buscador que reemplaza. */
function actualizarComboCargaMasiva(i, opciones = {}) {
  const fila = cargaMasiva.filas[i];
  const input = document.querySelector(`[data-cm-combo-input="${i}"]`);
  if (!fila || !input) return;
  let lista = document.querySelector(`.cm-combo-lista[data-cm-combo-lista="${i}"]`);
  if (fila.comboAbierto) {
    if (!lista) {
      lista = document.createElement('div');
      lista.className = 'cm-combo-lista';
      lista.dataset.cmComboLista = String(i);
      document.body.appendChild(lista);
    }
    lista.innerHTML = listaComboCargaMasiva(fila, i);
    posicionarComboLista(input, lista);
  } else if (lista) {
    lista.remove();
  }
  if (!opciones.mantenerTexto) {
    const elegido = productoElegidoCargaMasiva(fila);
    input.value = fila.destino === 'nuevo' ? '🆕 Producto nuevo' : (elegido ? elegido.nombre : '');
  }
}

/* Quita cualquier lista colgada de <body> y, si hace falta, cierra los
   combos abiertos (clic afuera, o scroll — scrollear dejaría la lista
   pegada en un lugar que ya no es el del campo). */
function cerrarCombosCargaMasiva() {
  document.querySelectorAll('.cm-combo-lista[data-cm-combo-lista]').forEach(el => el.remove());
  const habiaAbierto = cargaMasiva.filas.some(f => f.comboAbierto);
  if (!habiaAbierto) return;
  cargaMasiva.filas.forEach(f => { f.comboAbierto = false; });
  pintarCargaMasiva();
}

/* Después de cada repintado completo de la tabla: las listas abiertas
   quedaron sin su elemento en <body> (se borró junto con el resto del
   innerHTML viejo), así que se vuelven a colgar. */
function sincronizarCombosAbiertosCargaMasiva() {
  document.querySelectorAll('.cm-combo-lista[data-cm-combo-lista]').forEach(el => el.remove());
  cargaMasiva.filas.forEach((f, i) => {
    if (!f.comboAbierto) return;
    const input = document.querySelector(`[data-cm-combo-input="${i}"]`);
    if (!input) return;
    const lista = document.createElement('div');
    lista.className = 'cm-combo-lista';
    lista.dataset.cmComboLista = String(i);
    lista.innerHTML = listaComboCargaMasiva(f, i);
    document.body.appendChild(lista);
    posicionarComboLista(input, lista);
  });
}

/* Celda "Foto": solo para una fila que va a crear un producto nuevo (lo que
   ya existe administra sus fotos desde su ficha, no desde acá). */
function celdaFotoCargaMasiva(f, i) {
  if (f.destino && f.destino !== 'nuevo') return '<span class="cm-foto-na" title="Este producto ya existe: la foto se administra en su ficha">—</span>';
  const chips = (f.fotos || []).map((foto, k) => `
    <div class="cm-foto-chip"><img src="${foto}" alt=""><button type="button" class="cm-foto-quitar" data-cm-foto-quitar="${i}:${k}" title="Quitar esta foto">✕</button></div>`).join('');
  return `<div class="cm-fotos-fila" data-cm-fotos="${i}">${chips}<button type="button" class="cm-foto-agregar" data-cm-foto-agregar="${i}" title="Agregar una foto">📷+</button></div>`;
}

/* Fila que está esperando el resultado del selector de archivos del sistema. */
let cmFotoFilaObjetivo = null;

async function agregarFotosCargaMasiva(i, archivos) {
  const fila = cargaMasiva.filas[i];
  if (!fila) return;
  fila.fotos = fila.fotos || [];
  for (const archivo of archivos) {
    if (fila.fotos.length >= 6) { showToast('Hasta 6 fotos por producto nuevo', 'err'); break; }
    try {
      const bitmap = await cargarBitmapDeArchivo(archivo);
      const dataUrlWebp = await dibujarYComprimirFoto(bitmap);
      fila.fotos.push(dataUrlWebp);
    } catch (err) {
      console.error('No se pudo procesar una foto:', err.message || err);
      showToast('No se pudo procesar una de las fotos', 'err');
    }
  }
  pintarCargaMasiva();
}

function abrirCargaMasiva() {
  cargaMasiva = { filas: [], estado: null, gasto: null, enviando: false, archivados: [] };
  // Los archivados se traen aparte (la lista de Productos no los incluye). Si falla, se sigue sin ellos.
  cargaMasiva.esperaArchivados = API.productos.listarArchivados().then(lista => { cargaMasiva.archivados = Array.isArray(lista) ? lista : []; }).catch(() => {});
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('cmInstrucciones', instruccionesCargaMasiva());
  set('cmDevolucion', '');
  set('cmMarketplace', '');
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
  let marketplace = '';
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
    // v131: "MARKETPLACE: MercadoLibre" (opcional)
    const mk = linea.match(/^\**\s*(?:marketplace|plataforma)\s*\**\s*:\s*(.+)$/i);
    if (mk) { const m = mk[1].replace(/\*/g, '').trim().slice(0, 60); marketplace = marketplaceConocidoCargaMasiva(m) || m; continue; }
    const celdas = linea.replace(/^\|/, '').replace(/\|$/, '').split(linea.includes('|') ? '|' : '\t').map(c => c.trim());
    if (celdas.length < 2 || !celdas[0]) { sinEntender++; continue; }
    if (/^(nombre|producto)/i.test(celdas[0]) && numeroDeCargaMasiva(celdas[1]) === null) continue;   // encabezado
    const enlace = celdas.slice(3).find(c => /^https?:\/\//i.test(c)) || '';
    // La marca es la 5ª columna; se ignora si es un enlace, un "?" o la palabra de relleno
    const marcaCruda = (celdas[4] || '').replace(/\*\*/g, '').trim();
    const marca = /^https?:\/\//i.test(marcaCruda) || /^(\?+|-+|sin marca|n\/?a|ninguna)$/i.test(marcaCruda) ? '' : marcaCruda.slice(0, 80);
    filas.push({
      marca,
      nombre: celdas[0].replace(/^\d+[.)]\s+/, '').replace(/\*\*/g, '').slice(0, 200),
      cantidad: numeroDeCargaMasiva(celdas[1]) ?? '',
      costo: numeroDeCargaMasiva(celdas[2]) ?? '',
      precio: '',
      enlace,
      incluir: true,
      destino: ''
    });
  }
  /* "VENDEDOR / MERCADOLIBRE" en una sola línea (como se anotaba antes): si
     una de las partes es un marketplace conocido, se separan. */
  if (!marketplace && /[\/|–-]/.test(proveedor)) {
    const partes = proveedor.split(/\s*[\/|]\s*|\s+[–-]\s+/).map(p => p.trim()).filter(Boolean);
    const i = partes.findIndex(p => marketplaceConocidoCargaMasiva(p));
    if (i >= 0 && partes.length > 1) {
      marketplace = marketplaceConocidoCargaMasiva(partes[i]);
      proveedor = partes.filter((_, k) => k !== i).join(' / ');
    }
  }
  return { filas, proveedor, marketplace, llegada, sinEntender };
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
  const { filas, proveedor, marketplace, llegada, sinEntender } = leerTextoCargaMasiva(texto);
  if (!filas.length) {
    showToast('No encontré productos en lo pegado. Tiene que venir una línea por producto: Nombre | Cantidad | Costo por unidad', 'err');
    return;
  }
  // Sin parecidos parte como "nuevo" (se puede cambiar buscando); con parecidos hay que elegir.
  filas.forEach(f => {
    f.parecidos = parecidosDeCargaMasiva(f.nombre); f.buscados = []; f.busqueda = ''; f.destino = f.parecidos.length ? '' : 'nuevo';
    f.comboAbierto = false; f.fotos = [];   // v179: combo con foto + fotos del producto nuevo
  });
  cargaMasiva.filas = filas;
  const elProv = document.getElementById('cmProveedor');
  if (elProv && proveedor && !elProv.value) elProv.value = proveedor;
  const elMk = document.getElementById('cmMarketplace');
  if (elMk && marketplace && !elMk.value) elMk.value = marketplace;
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
  // Un encargo no es una compra, y lo que entregan los padres tampoco (sql/94): no hay gasto que decidir
  const padres = cargaMasiva.estado === 'padres';
  const bloqueGasto = document.getElementById('cmBloqueGasto');
  if (bloqueGasto) bloqueGasto.style.display = encargo || padres ? 'none' : 'block';
  const datosCompra = document.getElementById('cmDatos');
  if (datosCompra) datosCompra.style.display = padres ? 'none' : '';
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
        <th></th><th>Foto</th><th>Producto</th><th>Marca</th><th>Cantidad</th><th>Costo c/u</th><th>Precio de venta</th><th>¿Ya existe en tu catálogo?</th>
      </tr></thead>
      <tbody>
        ${cargaMasiva.filas.map((f, i) => `
          <tr>
            <td><input type="checkbox" data-cm-fila="${i}" data-cm-campo="incluir" ${f.incluir ? 'checked' : ''} title="Cargar esta fila"></td>
            <td class="cm-celda-foto">${celdaFotoCargaMasiva(f, i)}</td>
            <td><input type="text" class="cm-nombre" data-cm-fila="${i}" data-cm-campo="nombre" value="${escHtml(f.nombre)}" maxlength="200">
              ${f.enlace ? `<small class="fila-meta">${escHtml(acortar(f.enlace, 48))}</small>` : ''}</td>
            <td><input type="text" class="cm-marca" data-cm-fila="${i}" data-cm-campo="marca" value="${escHtml(f.marca || '')}" maxlength="80" placeholder="Sin marca" title="Solo se usa si el producto es nuevo"></td>
            <td><input type="number" class="cm-num" data-cm-fila="${i}" data-cm-campo="cantidad" value="${escHtml(f.cantidad)}" min="1" step="1" ${encargo ? 'disabled' : ''}></td>
            <td><input type="number" class="cm-num" data-cm-fila="${i}" data-cm-campo="costo" value="${escHtml(f.costo)}" min="0" step="1"></td>
            <td><input type="number" class="cm-num" data-cm-fila="${i}" data-cm-campo="precio" value="${escHtml(f.precio)}" min="0" step="1" placeholder="Después"></td>
            <td class="cm-celda-destino">${encargo
              ? '<span class="cm-nuevo">🆕 Producto nuevo</span>'
              : celdaComboCargaMasiva(f, i)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
  pintarResumenCargaMasiva();
  sincronizarCombosAbiertosCargaMasiva();
}

/* Qué falta para poder cargar, y cuánta plata es. Devuelve el mensaje de lo que falta o ''. */
function pintarResumenCargaMasiva() {
  const resumen = document.getElementById('cmResumen');
  const btn = document.getElementById('btnCmCargar');
  const filas = cargaMasiva.filas.filter(f => f.incluir);
  const encargo = cargaMasiva.estado === 'encargo';
  const padres = cargaMasiva.estado === 'padres';

  let falta = '';
  if (!cargaMasiva.filas.length) falta = '';
  else if (!filas.length) falta = 'Marca al menos un producto.';
  else if (!cargaMasiva.estado) falta = 'Elige arriba si ya llegaron, están por llegar, son por encargo o te los entregaron tus padres.';
  else if (!encargo && !padres && !cargaMasiva.gasto) falta = 'Dime si sumo esta compra a gastos de mercadería o no.';
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
      : padres ? `🤝 Cargar ${filas.length} de mis padres (sin compra)`
      : `📥 Cargar ${filas.length} y sumar al stock`;
  }
  return falta;
}

async function enviarCargaMasiva() {
  if (cargaMasiva.enviando || pintarResumenCargaMasiva()) return;
  // Lo de los padres (sql/94) no lleva proveedor, marketplace, devolución ni boleta, igual que un encargo
  const padres = cargaMasiva.estado === 'padres';
  const encargo = cargaMasiva.estado === 'encargo' || padres;
  const filas = cargaMasiva.filas.filter(f => f.incluir);
  const cuerpo = {
    estado: cargaMasiva.estado,
    fecha_compra: padres ? todayISO() : (document.getElementById('cmFechaCompra')?.value || todayISO()),
    proveedor: padres ? null : ((document.getElementById('cmProveedor')?.value || '').trim() || null),
    marketplace: encargo ? null : ((document.getElementById('cmMarketplace')?.value || '').trim() || null),
    fecha_llegada_estimada: cargaMasiva.estado === 'por_llegar' ? (document.getElementById('cmFechaLlegada')?.value || null) : null,
    // v130: los mismos datos opcionales del formulario de una compra
    devolucion_hasta: encargo ? null : (document.getElementById('cmDevolucion')?.value || null),
    referencia: encargo ? null : ((document.getElementById('cmReferencia')?.value || '').trim() || null),
    items: filas.map(f => ({
      nombre: String(f.nombre).trim(),
      cantidad: encargo && !padres ? 0 : Number(f.cantidad),
      costo_unitario: Number(f.costo) || 0,
      precio_venta: Number(f.precio) || 0,
      marca: String(f.marca || '').trim(),
      enlace: f.enlace || '',
      producto_id: (!encargo || padres) && f.destino && f.destino !== 'nuevo' ? Number(f.destino) : null,
      imagenes: f.fotos || []   // v179: solo cuenta si la fila termina creando un producto nuevo
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
          ${r.estado === 'padres' ? ` El stock ya quedó sumado, <strong>sin compra ni gasto</strong>: son ${fmtCLP(r.total_compra)} a costo, que se suman a la cuenta de Finanzas → Mis padres. Los nuevos quedaron marcados "De mis padres", con el costo por confirmar.` : ''}
          ${(r.resultados || []).some(x => x.desarchivado) ? `<br>📦 Volvieron del archivo: ${(r.resultados || []).filter(x => x.desarchivado).map(x => escHtml(x.nombre)).join(', ')}. Siguen sin publicar.` : ''}
          ${malos.length ? `<br>⚠️ No se pudieron cargar: ${malos.map(m => `${escHtml(m.nombre)} (${escHtml(m.error)})`).join('; ')}` : ''}
          ${num(r.publicados) ? `<br>🌐 ${num(r.publicados)} con foto quedaron <strong>publicados en sevelin.cl</strong> de inmediato.` : ''}
          ${num(r.sin_foto) ? `<br>📷 ${num(r.sin_foto)} nuevo(s) quedaron <strong>sin foto</strong>: no se publican solos (se vería un hueco). Agrégales foto y descripción — quedaron en <strong>📋 Por completar</strong> (arriba) y en la lista de Productos.` : ''}
          <br>⚡ Todos quedaron con PEPS/FIFO activado para calcular bien el costo.
          ${num(r.total_compra) > 0 && quiereGasto ? `<br><span class="compra-aviso-gasto" style="margin-top:8px;">💸 Esta compra son <strong>${fmtCLP(r.total_compra)}</strong>. Falta guardar el gasto en Finanzas.
            <button type="button" class="btn btn-primary btn-sm" id="btnCmGasto">Abrir el gasto</button></span>` : ''}
          ${num(r.total_compra) > 0 && !quiereGasto && !padres ? '<br>🚫 No se anotó ningún gasto por esta compra, como pediste.' : ''}
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
    if (typeof actualizarAvisoFichas === 'function') actualizarAvisoFichas();   // v131: aparecen al tiro en "Por completar"
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
