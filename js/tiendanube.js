// ==========================================
// TIENDANUBE.JS - Alta de productos pegando la ficha de Tiendanube
// ------------------------------------------
// Flujo en tres pasos:
//   1. "Nuevo Producto" pregunta: ¿carga manual o pegando texto?
//   2. Si es pegando, se abre un textarea para el Ctrl+A / Ctrl+C completo.
//   3. Se extraen los datos y se muestran en un modal de REVISIÓN editable.
//      Nada toca Supabase hasta que el usuario confirma en ese último paso.
//
// El texto que llega trae todo el menú lateral del admin de Tiendanube
// (Inicio, Estadísticas, Productos, Configuración…). El parser no intenta
// limpiarlo: se ancla en etiquetas exactas del formulario, que aparecen una
// sola vez y siempre en el mismo orden.
// ==========================================

// ============================================================
// PARSER
// ============================================================

/* Etiquetas de ayuda que Tiendanube imprime DEBAJO de un campo vacío. Si
   una de estas aparece donde debería estar el valor, el campo está en
   blanco. Sin este chequeo, un SKU vacío se guardaría con el texto
   "El SKU es un código que creas internamente…" como si fuera el código. */
const AYUDAS_TIENDANUBE = [
  'el sku es un código',
  'el código de barras consta',
  'ingresa los datos para calcular',
  'más sobre',
  'define una url',
  'ejemplo:',
  'agrega palabras clave',
  'indica la marca',
  'mejora la visibilidad',
  'es de uso interno',
  'pega un link',
  'tamaño mínimo recomendado',
  'con ellos podrás agregar',
  'combina diferentes propiedades',
  'pueden ser opciones',
  'elige en qué secciones',
  'define cómo aparece',
  'destaca tus productos',
  'el sku es un codigo'
];

function esLineaDeAyuda(linea) {
  const t = String(linea || '').toLowerCase().trim();
  if (!t) return true;
  return AYUDAS_TIENDANUBE.some(a => t.startsWith(a));
}

/* Convierte el texto de un número al formato interno.
   ------------------------------------------------------------
   El punto es ambiguo: en "19.990" separa miles, en "0.181" es decimal.
   Resolverlo mal es caro en los dos sentidos (un peso de 0,181 kg leído
   como 181 kg, o un precio de $19.990 leído como $19,99), así que se
   decide por CONTEXTO en vez de adivinar:

     · esMonto = true  (precio, costo) → "19.990" son 19.990 pesos.
       Los montos en CLP no llevan decimales, así que 3 dígitos exactos
       detrás del punto son miles.
     · esMonto = false (peso, medidas) → el punto SIEMPRE es decimal.
       Tiendanube escribe el peso con 3 decimales ("0.181"), que es
       justo el caso que la regla de miles rompería.

   La coma siempre es decimal en ambos casos.                          */
function numeroTiendanube(texto, { esMonto = false } = {}) {
  if (texto === null || texto === undefined) return 0;
  const limpio = String(texto).replace(/[^\d,.-]/g, '').trim();
  if (!limpio) return 0;

  // "1.234,56" → punto de miles + coma decimal
  if (limpio.includes(',') && limpio.includes('.')) {
    return Number(limpio.replace(/\./g, '').replace(',', '.')) || 0;
  }
  if (limpio.includes(',')) return Number(limpio.replace(',', '.')) || 0;

  /* Punto de miles solo en montos, y nunca si la parte entera es 0:
     "0.181" jamás es un separador de miles. */
  if (esMonto && /^-?[1-9]\d{0,2}(\.\d{3})+$/.test(limpio)) {
    return Number(limpio.replace(/\./g, '')) || 0;
  }
  return Number(limpio) || 0;
}

/* ¿La línea es un número suelto? Sirve para saltarse etiquetas sueltas
   como "$", "kg" o "cm" que Tiendanube pone en su propia línea. */
function esNumerico(linea) {
  const t = String(linea || '').trim();
  if (!t) return false;
  return /^\$?\s*-?[\d.,]+\s*(kg|cm|g|%)?$/i.test(t) && /\d/.test(t);
}

/**
 * Extrae los datos de un producto desde el texto crudo copiado con
 * Ctrl+A / Ctrl+C en la ficha de producto del admin de Tiendanube.
 *
 * @param {string} rawText  Texto completo pegado por el usuario.
 * @returns {{datos: object, encontrados: string[], faltantes: string[]}}
 */
function parseTiendanubeText(rawText) {
  const lineas = String(rawText || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(l => l.trim());

  // Índice de la primera línea que sea EXACTAMENTE la etiqueta buscada.
  // Se compara exacto (no "incluye") a propósito: "Costo" debe encontrar la
  // etiqueta del campo, no la frase "…para calcular el costo de envío…".
  const indiceDe = (etiqueta, desde = 0) => {
    const objetivo = etiqueta.toLowerCase();
    for (let i = desde; i < lineas.length; i++) {
      if (lineas[i].toLowerCase() === objetivo) return i;
    }
    return -1;
  };

  /* Primer valor útil después de una etiqueta.
     salto  → cuántas líneas no vacías ignorar primero (para el "$" del precio)
     limite → hasta cuántas líneas mirar antes de rendirse                   */
  const valorTras = (etiqueta, { soloNumero = false, limite = 6, desde = null } = {}) => {
    const i = indiceDe(etiqueta, desde === null ? inicioFicha : desde);
    if (i === -1) return null;

    let vistos = 0;
    for (let j = i + 1; j < lineas.length && vistos < limite; j++) {
      const linea = lineas[j];
      if (!linea) continue;                       // hueco en blanco
      vistos++;

      // Separadores que Tiendanube imprime solos en su línea
      if (linea === '$' || /^(kg|cm|g)$/i.test(linea)) { vistos--; continue; }

      if (esLineaDeAyuda(linea)) return null;     // el campo está vacío
      if (soloNumero) {
        if (esNumerico(linea)) return linea;
        continue;                                 // sigue buscando el número
      }
      return linea;
    }
    return null;
  };

  /* El texto pegado empieza con TODO el menú lateral del admin (Inicio,
     Estadísticas, Productos, Inventario, Configuración…). Varias de esas
     entradas se llaman igual que campos del formulario: sin acotar la
     búsqueda, "Inventario" engancharía con el ítem del menú y devolvería
     "Categorías" como si fuera el stock.

     "Más opciones" es el botón que va justo después del título del
     producto, o sea el primer elemento real de la ficha: todo lo anterior
     es navegación y se descarta. */
  let inicioFicha = indiceDe('Más opciones');
  if (inicioFicha === -1) inicioFicha = indiceDe('Nombre y descripción');
  if (inicioFicha === -1) inicioFicha = 0;   // pegado parcial: se busca en todo

  const datos = {};
  const encontrados = [];
  const faltantes = [];

  const anotar = (clave, valor, etiquetaLegible) => {
    const vacio = valor === null || valor === undefined || valor === '' ||
                  (typeof valor === 'number' && valor === 0);
    if (vacio) faltantes.push(etiquetaLegible);
    else encontrados.push(etiquetaLegible);
  };

  // ---------- NOMBRE ----------
  /* Ancla principal: el bloque "Nombre y descripción" → "Nombre" → valor.
     Es mucho más fiable que buscar el nombre del negocio, que cambia según
     la tienda ("Sevelin" aquí, otra cosa en otra cuenta). */
  let nombre = null;
  const iBloqueNombre = indiceDe('Nombre y descripción');
  if (iBloqueNombre !== -1) {
    nombre = valorTras('Nombre', { desde: iBloqueNombre, limite: 4 });
    // Si el campo estuviera vacío, la siguiente etiqueta es "Descripción"
    if (nombre && nombre.toLowerCase() === 'descripción') nombre = null;
  }

  /* Respaldo: en la cabecera, el nombre es la última línea con contenido
     antes de "Más opciones". Se usa si el bloque de arriba no apareció
     (por ejemplo, si el usuario copió solo una parte de la pantalla). */
  if (!nombre) {
    const iMasOpciones = indiceDe('Más opciones');
    if (iMasOpciones > 0) {
      for (let j = iMasOpciones - 1; j >= 0 && j > iMasOpciones - 6; j--) {
        const candidata = lineas[j];
        if (candidata && !esLineaDeAyuda(candidata) && candidata.length > 3) { nombre = candidata; break; }
      }
    }
  }

  datos.nombre = nombre || '';
  anotar('nombre', datos.nombre, 'Nombre');

  // ---------- PRECIO DE VENTA ----------
  // Etiqueta exacta: así no se confunde con "Precio promocional".
  datos.precio_unitario = numeroTiendanube(valorTras('Precio de venta', { soloNumero: true }), { esMonto: true });
  anotar('precio', datos.precio_unitario, 'Precio de venta');

  // ---------- COSTO ----------
  datos.costo_unitario = numeroTiendanube(valorTras('Costo', { soloNumero: true }), { esMonto: true });
  anotar('costo', datos.costo_unitario, 'Costo');

  // ---------- SKU ----------
  // Suele venir vacío: Tiendanube deja el texto de ayuda en su lugar.
  const sku = valorTras('SKU', { limite: 3 });
  datos.sku = sku && !esLineaDeAyuda(sku) ? sku : '';
  anotar('sku', datos.sku, 'SKU');

  // ---------- CÓDIGO DE BARRAS ----------
  const barras = valorTras('Código de barras', { soloNumero: true, limite: 3 });
  datos.codigo_barras = barras ? String(barras).replace(/\D/g, '') : '';
  anotar('barras', datos.codigo_barras, 'Código de barras');

  // ---------- INVENTARIO ----------
  /* Tiendanube muestra "Infinito" o un número. "Infinito" se traduce al
     stock_ilimitado del POS, que es exactamente el mismo concepto. */
  const inventario = valorTras('Inventario', { limite: 3 });
  if (inventario && /^infinit/i.test(inventario)) {
    datos.stock_ilimitado = true;
    datos.stock = 0;
    encontrados.push('Inventario (infinito)');
  } else if (inventario && esNumerico(inventario)) {
    datos.stock_ilimitado = false;
    datos.stock = numeroTiendanube(inventario, { esMonto: true });
    encontrados.push('Stock');
  } else {
    datos.stock_ilimitado = false;
    datos.stock = 0;
    faltantes.push('Stock');
  }

  // ---------- PESO Y DIMENSIONES ----------
  // "Peso" exacto no choca con el encabezado "Peso y dimensiones".
  datos.peso_kg = numeroTiendanube(valorTras('Peso', { soloNumero: true }));
  datos.profundidad_cm = numeroTiendanube(valorTras('Profundidad', { soloNumero: true }));
  datos.ancho_cm = numeroTiendanube(valorTras('Ancho', { soloNumero: true }));
  datos.alto_cm = numeroTiendanube(valorTras('Alto', { soloNumero: true }));

  const medidas = [datos.peso_kg, datos.alto_cm, datos.ancho_cm, datos.profundidad_cm];
  if (medidas.some(m => m > 0)) encontrados.push('Peso y dimensiones');
  else faltantes.push('Peso y dimensiones');

  return { datos, encontrados, faltantes };
}

/* ============================================================
   NOMBRADO SECUENCIAL DE IMÁGENES
   ------------------------------------------------------------
   Regla pedida: las imágenes de un producto se numeran 1, 2, 3, 4…
   conservando su extensión real.

   OJO: hoy el POS no sube fotos de producto (la tabla productos no tiene
   columnas de imagen y no hay bucket de Storage configurado). Esta función
   queda lista para engancharla cuando se agregue esa función; mientras
   tanto no la llama nadie.
   ============================================================ */
function nombreSecuencialImagen(archivo, indice) {
  const nombre = (archivo && archivo.name) ? String(archivo.name) : '';
  const punto = nombre.lastIndexOf('.');

  // Extensión real del archivo; si no la trae, se asume .jpg
  let ext = punto > -1 ? nombre.slice(punto + 1).toLowerCase() : '';
  if (!/^(webp|png|jpe?g|gif|avif)$/.test(ext)) ext = 'jpg';
  if (ext === 'jpeg') ext = 'jpg';

  return `${Number(indice) + 1}.${ext}`;
}

/* Renombra una lista de archivos a 1.ext, 2.ext, 3.ext… */
function nombrarImagenesEnSecuencia(archivos) {
  return Array.from(archivos || []).map((archivo, i) => ({
    archivo,
    nombre: nombreSecuencialImagen(archivo, i)
  }));
}

// ============================================================
// INTERFAZ — los tres modales del flujo
// ============================================================

const elModalMetodoAlta = document.getElementById('modalMetodoAlta');
const elBtnAltaManual = document.getElementById('btnAltaManual');
const elBtnAltaTiendanube = document.getElementById('btnAltaTiendanube');
const elBtnCancelarMetodoAlta = document.getElementById('btnCancelarMetodoAlta');

const elModalPegar = document.getElementById('modalPegarTiendanube');
const elTextoTiendanube = document.getElementById('textoTiendanube');
const elBtnProcesarTexto = document.getElementById('btnProcesarTexto');
const elBtnLimpiarPegado = document.getElementById('btnLimpiarPegado');
const elBtnCancelarPegar = document.getElementById('btnCancelarPegarTiendanube');
const elAvisoPegado = document.getElementById('avisoPegado');

const elModalRevisar = document.getElementById('modalRevisarTiendanube');
const elRevResumen = document.getElementById('revResumenLectura');
const elRevMargen = document.getElementById('revMargen');
const elBtnConfirmarTiendanube = document.getElementById('btnConfirmarTiendanube');
const elBtnCancelarRevision = document.getElementById('btnCancelarRevision');
const elBtnVolverAPegar = document.getElementById('btnVolverAPegar');

// Campos del modal de revisión
const REV = {
  nombre: 'revNombre', sku: 'revSku', codigo_barras: 'revBarcode',
  costo_unitario: 'revCosto', precio_unitario: 'revPrecio', stock: 'revStock',
  peso_kg: 'revPeso', alto_cm: 'revAlto', ancho_cm: 'revAncho', profundidad_cm: 'revProfundidad',
  stock_minimo: 'revStockMinimo'
};
const REV_CHECKS = {
  alerta_stock: 'revAlertaStock', stock_ilimitado: 'revStockIlimitado',
  requiere_sn: 'revRequiereSN', es_repuesto: 'revEsRepuesto'
};

const $rev = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  if (elBtnAltaManual) elBtnAltaManual.addEventListener('click', () => {
    cerrarModal(elModalMetodoAlta);
    abrirModalProducto(null);            // formulario clásico de productos.js
  });

  if (elBtnAltaTiendanube) elBtnAltaTiendanube.addEventListener('click', () => {
    cerrarModal(elModalMetodoAlta);
    abrirPegarTiendanube();
  });

  if (elBtnCancelarMetodoAlta) elBtnCancelarMetodoAlta.addEventListener('click', () => cerrarModal(elModalMetodoAlta));
  if (elBtnCancelarPegar) elBtnCancelarPegar.addEventListener('click', () => cerrarModal(elModalPegar));
  if (elBtnCancelarRevision) elBtnCancelarRevision.addEventListener('click', () => cerrarModal(elModalRevisar));

  if (elBtnLimpiarPegado) elBtnLimpiarPegado.addEventListener('click', () => {
    if (elTextoTiendanube) { elTextoTiendanube.value = ''; elTextoTiendanube.focus(); }
    if (elAvisoPegado) elAvisoPegado.textContent = 'Se leen: nombre, SKU, código de barras, precio, costo, stock, peso y dimensiones.';
  });

  if (elBtnProcesarTexto) elBtnProcesarTexto.addEventListener('click', procesarTextoTiendanube);
  if (elBtnConfirmarTiendanube) elBtnConfirmarTiendanube.addEventListener('click', confirmarYGuardar);

  if (elBtnVolverAPegar) elBtnVolverAPegar.addEventListener('click', () => {
    cerrarModal(elModalRevisar);
    if (elModalPegar) elModalPegar.classList.add('show');
  });

  // Stock ilimitado desactiva el stock, igual que en el modal clásico
  const chkIlimitado = $rev(REV_CHECKS.stock_ilimitado);
  if (chkIlimitado) chkIlimitado.addEventListener('change', aplicarIlimitadoRevision);

  // Margen en vivo mientras se corrigen costo y precio
  [REV.costo_unitario, REV.precio_unitario].forEach(id => {
    const el = $rev(id);
    if (el) el.addEventListener('input', actualizarMargenRevision);
  });

  // Ctrl+Enter procesa sin soltar el teclado
  if (elTextoTiendanube) elTextoTiendanube.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); procesarTextoTiendanube(); }
  });

  [elModalMetodoAlta, elModalPegar, elModalRevisar].forEach(m => {
    if (m) m.addEventListener('click', (e) => { if (e.target === m) cerrarModal(m); });
  });
});

function cerrarModal(modal) { if (modal) modal.classList.remove('show'); }

/* Punto de entrada del flujo, llamado desde el botón "Nuevo Producto". */
function abrirSelectorAltaProducto() {
  if (!esAdmin()) { showToast('Solo el administrador puede crear productos', 'err'); return; }

  // Sin el modal en el DOM se cae al formulario de siempre
  if (!elModalMetodoAlta) { abrirModalProducto(null); return; }
  elModalMetodoAlta.classList.add('show');
}

function abrirPegarTiendanube() {
  if (!elModalPegar) return;
  if (elTextoTiendanube) elTextoTiendanube.value = '';
  if (elAvisoPegado) {
    elAvisoPegado.textContent = 'Se leen: nombre, SKU, código de barras, precio, costo, stock, peso y dimensiones.';
    elAvisoPegado.style.color = '';
  }
  elModalPegar.classList.add('show');
  setTimeout(() => elTextoTiendanube?.focus(), 80);
}

// ---------- Paso 2 → 3 ----------
function procesarTextoTiendanube() {
  const texto = (elTextoTiendanube?.value || '').trim();

  if (!texto) {
    if (elAvisoPegado) {
      elAvisoPegado.textContent = 'Pega primero el texto copiado de Tiendanube.';
      elAvisoPegado.style.color = 'var(--red)';
    }
    elTextoTiendanube?.focus();
    return;
  }

  const { datos, encontrados, faltantes } = parseTiendanubeText(texto);

  /* Sin nombre no hay producto: es el único campo obligatorio de la base.
     Se avisa acá y no en el modal de revisión para que el usuario pueda
     corregir el pegado de inmediato. */
  if (!datos.nombre) {
    if (elAvisoPegado) {
      elAvisoPegado.textContent = 'No se encontró el nombre del producto. ¿Copiaste la ficha completa con Ctrl+A?';
      elAvisoPegado.style.color = 'var(--red)';
    }
    return;
  }

  cerrarModal(elModalPegar);
  abrirRevision(datos, encontrados, faltantes);
}

function abrirRevision(datos, encontrados, faltantes) {
  if (!elModalRevisar) return;

  // Campos de texto y número
  Object.entries(REV).forEach(([clave, id]) => {
    const el = $rev(id);
    if (!el) return;
    if (clave === 'stock_minimo') { el.value = 3; return; }   // valor por defecto del catálogo
    const v = datos[clave];
    el.value = (v === null || v === undefined) ? '' : v;
  });

  /* Checkboxes: solo stock_ilimitado se deduce del texto ("Infinito").
     requiere_sn y es_repuesto son criterios del taller que Tiendanube no
     conoce, así que se dejan apagados para que los marque el usuario. */
  const set = (id, valor) => { const el = $rev(id); if (el) el.checked = !!valor; };
  set(REV_CHECKS.stock_ilimitado, datos.stock_ilimitado);
  set(REV_CHECKS.alerta_stock, true);
  set(REV_CHECKS.requiere_sn, false);
  set(REV_CHECKS.es_repuesto, false);

  // Resumen de lectura: qué se encontró y qué quedó pendiente
  if (elRevResumen) {
    const ok = encontrados.length
      ? `<span class="rev-ok">✅ Leído: ${encontrados.join(' · ')}</span>` : '';
    const falta = faltantes.length
      ? `<span class="rev-falta">⚠️ Sin datos (complétalo a mano): ${faltantes.join(' · ')}</span>` : '';
    elRevResumen.innerHTML = ok + falta;
  }

  aplicarIlimitadoRevision();
  actualizarMargenRevision();

  elModalRevisar.classList.add('show');
  setTimeout(() => $rev(REV.nombre)?.focus(), 80);
}

function aplicarIlimitadoRevision() {
  const ilimitado = !!$rev(REV_CHECKS.stock_ilimitado)?.checked;
  const elStock = $rev(REV.stock);
  const elMinimo = $rev(REV.stock_minimo);

  if (elStock) {
    elStock.disabled = ilimitado;
    elStock.placeholder = ilimitado ? 'Ilimitado' : '0';
    if (ilimitado) elStock.value = '';
  }
  if (elMinimo) elMinimo.disabled = ilimitado;
}

/* Margen en vivo: sirve de control cruzado contra el que muestra
   Tiendanube. Si no coincide, el costo o el precio se leyeron mal. */
function actualizarMargenRevision() {
  if (!elRevMargen) return;
  const costo = Number($rev(REV.costo_unitario)?.value) || 0;
  const precio = Number($rev(REV.precio_unitario)?.value) || 0;

  if (precio <= 0) { elRevMargen.textContent = '—'; elRevMargen.style.color = ''; return; }

  const margen = ((precio - costo) / precio) * 100;
  elRevMargen.textContent =
    `Utilidad por unidad: ${fmtCLP(precio - costo)} · Margen ${margen.toFixed(0)}% ` +
    `(compáralo con el que muestra Tiendanube: si no coincide, revisa costo y precio)`;
  elRevMargen.style.color = costo > 0 && costo >= precio ? 'var(--red)' : '';
}

// ---------- Paso 3: guardar ----------
async function confirmarYGuardar() {
  const nombre = ($rev(REV.nombre)?.value || '').trim();
  if (!nombre) { showToast('El nombre del producto es obligatorio', 'err'); $rev(REV.nombre)?.focus(); return; }

  const ilimitado = !!$rev(REV_CHECKS.stock_ilimitado)?.checked;

  const payload = {
    nombre,
    sku: ($rev(REV.sku)?.value || '').trim() || null,
    codigo_barras: ($rev(REV.codigo_barras)?.value || '').trim() || null,
    costo_unitario: Number($rev(REV.costo_unitario)?.value) || 0,
    precio_unitario: Number($rev(REV.precio_unitario)?.value) || 0,
    stock: ilimitado ? 0 : (Number($rev(REV.stock)?.value) || 0),
    stock_minimo: Number($rev(REV.stock_minimo)?.value) || 0,
    alerta_stock: !!$rev(REV_CHECKS.alerta_stock)?.checked,
    stock_ilimitado: ilimitado,
    requiere_sn: !!$rev(REV_CHECKS.requiere_sn)?.checked,
    es_repuesto: !!$rev(REV_CHECKS.es_repuesto)?.checked,
    peso_kg: Number($rev(REV.peso_kg)?.value) || 0,
    alto_cm: Number($rev(REV.alto_cm)?.value) || 0,
    ancho_cm: Number($rev(REV.ancho_cm)?.value) || 0,
    profundidad_cm: Number($rev(REV.profundidad_cm)?.value) || 0
    // usa_lotes NO se manda: los lotes se activan a mano desde el modal
    // de producto, nunca en un alta automática.
  };

  if (elBtnConfirmarTiendanube) elBtnConfirmarTiendanube.disabled = true;

  try {
    /* Aviso de duplicado antes de crear: el catálogo no tiene índice único
       sobre SKU ni código de barras, así que el choque no lo detecta la
       base. Es un aviso, no un bloqueo: puede haber duplicados legítimos. */
    const clave = payload.sku || payload.codigo_barras;
    if (clave && Array.isArray(productsList)) {
      const repetido = productsList.find(p =>
        (payload.sku && (p.sku || '').trim() === payload.sku) ||
        (payload.codigo_barras && (p.codigo_barras || '').trim() === payload.codigo_barras)
      );
      if (repetido && !confirm(
        `Ya existe "${repetido.nombre}" con el mismo SKU o código de barras.\n\n¿Crear igual un producto nuevo?`
      )) return;
    }

    await API.productos.crear(payload);
    showToast(`Producto "${nombre}" creado`, 'ok');
    cerrarModal(elModalRevisar);
    if (typeof cargarProductos === 'function') cargarProductos();
  } catch (err) {
    console.error('Error al guardar el producto de Tiendanube:', err.message || err);
    showToast(err.message || 'No se pudo guardar el producto', 'err');
  } finally {
    if (elBtnConfirmarTiendanube) elBtnConfirmarTiendanube.disabled = false;
  }
}

// Exporta el parser para poder probarlo fuera del navegador
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseTiendanubeText, numeroTiendanube, nombreSecuencialImagen };
}
