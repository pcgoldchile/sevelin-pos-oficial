// ==========================================
// REDES-TEXTO.JS — Texto para Facebook e Instagram desde la Descripción (v139, sql/95)
// ------------------------------------------
// Regla del dueño (13-10-2026): "debe existir la descripción, si no, no se
// debe generar nada inventado". Por eso esto NO usa IA: toma la introducción
// y las características que YA están escritas en la Descripción del producto
// y las ordena en el formato de cada red. Sin descripción devuelve ''.
//
// Sin DOM a propósito: el mismo archivo corre en Node para cargar en lote.
// El bloque de retiro, WhatsApp y pagos es el de PROMPT_FACEBOOK
// (api/index.js): si cambia allá, se cambia acá.
// ==========================================

const REDES_WHATSAPP = '+56935750828';
const REDES_WHATSAPP_EMOJIS = '➕5️⃣6️⃣9️⃣3️⃣5️⃣7️⃣5️⃣0️⃣8️⃣2️⃣8️⃣';
const REDES_TOPE_FACEBOOK = 8000;    // el mismo de productos.facebook_texto
const REDES_TOPE_INSTAGRAM = 2200;   // lo máximo que acepta Instagram en un pie de foto

/* La Descripción (HTML del editor, a veces con Markdown pegado) como líneas
   de texto. Los títulos quedan con "### " y cada <li> con "✅ ". */
function lineasDeFichaParaRedes(html) {
  let s = String(html || '');
  if (!s.trim() || s.trim().toLowerCase() === 'null') return [];
  s = s.replace(/\r/g, '')
    .replace(/<\s*h[1-6][^>]*>/gi, '\n### ')
    .replace(/<\s*li[^>]*>/gi, '\n✅ ')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|li|h[1-6]|ul|ol|div)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#0?39;/g, "'")
    .replace(/\*\*/g, '');
  /* En muchas fichas viene todo en un solo párrafo ("✨ intro ✨ Características: ✅ a ✅ b"):
     cada marca abre su propia línea. Los títulos (###) se dejan enteros. */
  const lineas = [];
  s.split('\n').forEach(cruda => {
    const l = cruda.replace(/\s+/g, ' ').trim();
    if (!l) return;
    if (l.startsWith('###')) { lineas.push(l); return; }
    l.replace(/\s*(✅|❌|✨|⚠️)/gu, '\n$1').split('\n').map(x => x.trim()).filter(Boolean).forEach(x => lineas.push(x));
  });
  return lineas;
}

/* A qué parte de la ficha pertenece un título ("Características principales",
   "Qué no incluye", "Importante"…). '' = no es un título. */
function seccionDeTituloParaRedes(texto) {
  const t = String(texto || '').replace(/^[^\p{L}¿¡]+/u, '').trim().toLowerCase();
  if (/^(qu[eé] )?no (incluye|cubre|hacemos)/.test(t)) return 'no';
  if (/^(importante|advertencia|ten en cuenta|antes de (comprar|agendar|venir))/.test(t)) return 'importante';
  if (/^(servicios? recomendados?|productos? relacionados?|te puede interesar)/.test(t)) return 'otros';
  // v171: lo que trae la caja va aparte (antes se mezclaba con las características)
  if (/^(qu[eé] incluye|incluye|contenido de la caja|en la caja)/.test(t)) return 'incluye';
  if (/^(caracter[ií]sticas|especificaciones|ventajas|beneficios|detalles)/.test(t)) return 'caracteristicas';
  return '';
}

/* Un párrafo corto que en realidad es un título sin formato: "✨ Características principales:". */
function esTituloSueltoParaRedes(texto) {
  const t = String(texto || '').replace(/^[^\p{L}¿¡]+/u, '').trim();
  return t.length <= 48 && !!seccionDeTituloParaRedes(t)
    && /^(\S+\s+){0,4}\S+\s*:?$/.test(t) && !/[.!?]$/.test(t);
}

/* Separa la Descripción en lo que cada red necesita. Nada se redacta: cada
   línea sale tal como está escrita en la ficha. */
function partesDeFichaParaRedes(html) {
  const partes = { intro: '', masTexto: [], caracteristicas: [], incluye: [], noIncluye: [], importante: [] };
  let seccion = 'inicio';
  for (const linea of lineasDeFichaParaRedes(html)) {
    if (linea.startsWith('###')) {
      seccion = seccionDeTituloParaRedes(linea.replace(/^#+\s*/, '')) || 'caracteristicas';
      continue;
    }
    const marca = linea.match(/^((?:✅|❌|✔️|✔|•|·|-|\*)\s*)+/u);
    if (!marca && esTituloSueltoParaRedes(linea)) { seccion = seccionDeTituloParaRedes(linea); continue; }
    const texto = (marca ? linea.slice(marca[0].length) : linea).trim();
    if (!texto) continue;
    if (marca) {
      if (seccion === 'otros') continue;
      if (marca[0].includes('❌') || seccion === 'no') partes.noIncluye.push(texto);
      else if (seccion === 'importante') partes.importante.push(texto);
      else if (seccion === 'incluye') partes.incluye.push(texto);
      else partes.caracteristicas.push(texto);
      continue;
    }
    const aviso = /^⚠️/u.test(texto);
    const conBrillo = /^✨/u.test(texto);
    const limpio = texto.replace(/^(✨|⚠️)\s*/u, '').replace(/^importante:\s*/i, '').trim();
    if (!limpio) continue;
    if (aviso || seccion === 'importante') { partes.importante.push(limpio); continue; }
    if (seccion !== 'inicio' && seccion !== 'caracteristicas') continue;
    /* La introducción es el primer párrafo de verdad: el que parte con ✨ o
       uno largo. Una línea corta antes de eso es el nombre repetido. */
    if (!partes.intro) { if (conBrillo || limpio.length >= 80) partes.intro = limpio; }
    else if (limpio.length >= 60) partes.masTexto.push(limpio);
  }
  return partes;
}

/* La descripción del producto: la de la ficha y, si está vacía, la que se publicó
   en la tienda (el editor de la ficha carga las dos en ese mismo orden). */
function descripcionParaRedes(p) {
  const limpia = (t) => { const x = String(t || '').trim(); return x && x.toLowerCase() !== 'null' ? x : ''; };
  return limpia(p?.descripcion) || limpia(p?.descripcion_web);
}

function sinAcentosRedes(texto) {
  return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function marcaRealParaRedes(marca) {
  const m = String(marca || '').trim();
  return m && !/^gen[eé]ric/i.test(m) ? m : '';
}

/* El nombre sin un "NUEVO" que ya venga escrito al principio. */
function nombreParaRedes(p) {
  return String(p?.nombre || '').trim().replace(/^nuev[oa]s?\s+/i, '');
}

/* NUEVO / NUEVA / NUEVOS / NUEVAS según la primera palabra del nombre. Es una
   regla simple (termina en "a" → femenino) con las excepciones del catálogo:
   por eso el texto queda en un cuadro que se puede corregir antes de guardar. */
function generoNuevoParaRedes(p) {
  const marca = sinAcentosRedes(marcaRealParaRedes(p?.marca)).toLowerCase();
  const palabras = sinAcentosRedes(nombreParaRedes(p)).toLowerCase().split(/[^a-z0-9ñ]+/).filter(Boolean);
  const saltar = new Set(['mini', 'super', 'smart', 'micro', 'nano']);
  let palabra = palabras.find(w => !saltar.has(w) && !(marca && (w === marca || marca.split(/[^a-z0-9ñ]+/).includes(w)))) || palabras[0] || '';
  const singularesConS = new Set(['chasis', 'ups', 'gps', 'atlas', 'virus', 'bios', 'nas', 'bus']);
  const plural = palabra.length > 3 && palabra.endsWith('s') && !singularesConS.has(palabra);
  // En plural se prueba sin la "s" y sin la "es": pilas → pila, redes → red
  const formas = plural ? [palabra.slice(0, -1), palabra.slice(0, -2)] : [palabra];
  const femeninas = new Set(['fuente', 'base', 'tablet', 'torre', 'webcam', 'luz', 'red', 'llave', 'laptop', 'interfaz', 'superficie', 'serie']);
  const masculinas = new Set(['sistema', 'problema', 'mapa', 'dia', 'programa', 'tema', 'motorola']);
  const femenino = formas.some(f => femeninas.has(f) || (!masculinas.has(f) && (/a$/.test(f) || /(cion|sion|dad|tud|umbre|triz)$/.test(f))));
  return 'NUEV' + (femenino ? 'A' : 'O') + (plural ? 'S' : '');
}

/* Primera línea de la publicación. Nunca dice "NUEVO" si el producto no lo es. */
function encabezadoParaRedes(p) {
  const nombre = nombreParaRedes(p);
  if (p?.es_servicio) return `🔧 ${nombre}`;
  const condicion = String(p?.condicion || 'nuevo').toLowerCase();
  if (condicion !== 'nuevo') return `✨ ${nombre}`;
  return `✨ ${generoNuevoParaRedes(p)} ${nombre}`;
}

function lineaCondicionParaRedes(p) {
  const condicion = String(p?.condicion || 'nuevo').toLowerCase();
  if (p?.es_servicio || condicion === 'nuevo') return '';
  return `♻️ Condición: ${condicion.replace(/_/g, ' ')}.`;
}

function lineaGarantiaParaRedes(p) {
  if (p?.es_servicio) return '';
  const meses = p?.meses_garantia === undefined || p?.meses_garantia === null || p?.meses_garantia === '' ? 6 : Number(p.meses_garantia);
  if (!(meses > 0)) return '';
  const condicion = String(p?.condicion || 'nuevo').toLowerCase();
  if (condicion !== 'nuevo') return `🛡️ Garantía: ${meses} ${meses === 1 ? 'mes' : 'meses'}.`;
  return meses === 6
    ? '🛡️ Garantía: 6 meses en todos nuestros productos por fallas de fábrica.'
    : `🛡️ Garantía: ${meses} ${meses === 1 ? 'mes' : 'meses'} por fallas de fábrica.`;
}

function etiquetaParaRedes(texto) {
  const conectores = new Set(['y', 'e', 'o', 'de', 'del', 'la', 'el', 'los', 'las', 'para', 'con', 'en', 'a', 'por']);
  const partes = sinAcentosRedes(texto).split(/[^A-Za-z0-9ñÑ]+/).filter(w => w && !conectores.has(w.toLowerCase()));
  const junto = partes.map(w => (/^[A-Z0-9]+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join('');
  return junto.length >= 2 && !/^\d+$/.test(junto) ? '#' + junto : '';
}

/* Hashtags armados solo con lo que el producto ya tiene: marca, nombre,
   categoría, la ciudad y una lista fija por tipo de producto. */
function hashtagsParaRedes(p, cuantos) {
  const tope = cuantos || 20;
  const vistos = new Set();
  const lista = [];
  const sumar = (etiqueta) => {
    const t = String(etiqueta || '').trim();
    const clave = t.toLowerCase();
    if (!t || t.length < 3 || t.length > 32 || vistos.has(clave) || lista.length >= tope) return;
    vistos.add(clave); lista.push(t);
  };
  const nombre = nombreParaRedes(p);
  const comunes = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'para', 'con', 'en', 'por', 'sin', 'una', 'uno', 'tipo', 'color', 'compatible',
    'negro', 'blanco', 'azul', 'rojo', 'gris', 'nuevo', 'nueva', 'servicio', 'metros', 'metro', 'macho', 'hembra', 'todas', 'marcas', 'pares', 'niveles']);
  const palabras = sinAcentosRedes(nombre).split(/[^A-Za-z0-9ñÑ]+/)
    .filter(w => w.length >= 3 && !/^\d/.test(w) && !comunes.has(w.toLowerCase()));

  sumar('#Sevelin');
  sumar(etiquetaParaRedes(marcaRealParaRedes(p?.marca)));
  if (palabras.length >= 2) sumar(etiquetaParaRedes(palabras[0] + ' ' + palabras[1]));
  palabras.slice(0, 5).forEach(w => sumar(etiquetaParaRedes(w)));
  sumar(etiquetaParaRedes(p?.subcategoria_web));
  sumar(etiquetaParaRedes(p?.categoria_web));
  if (!p?.es_servicio && String(p?.condicion || 'nuevo').toLowerCase() === 'reacondicionado') sumar('#Reacondicionado');
  ['#Arica', '#AricaChile', '#Chile'].forEach(sumar);

  const categoria = sinAcentosRedes(`${p?.categoria_web || ''} ${p?.subcategoria_web || ''}`).toLowerCase();
  const porTipo = p?.es_servicio || /servicio/.test(categoria)
    ? ['#ServicioTecnico', '#ServicioTecnicoArica', '#SoporteTecnico', '#Mantenimiento', '#Reparacion', '#TecnicoEnArica']
    : /hogar|herramient/.test(categoria) ? ['#Hogar', '#Casa', '#CosasParaElHogar', '#VidaPractica']
    : /monitor/.test(categoria) ? ['#Monitores', '#Computacion', '#Informatica', '#Oficina', '#SetupGamer']
    : /componentes/.test(categoria) ? ['#ComponentesPC', '#PCGamer', '#Hardware', '#Computacion', '#Informatica']
    : /perif/.test(categoria) ? ['#Perifericos', '#AccesoriosPC', '#Computacion', '#Informatica']
    : /cables/.test(categoria) ? ['#Cables', '#Adaptadores', '#AccesoriosPC', '#Computacion']
    : /audio/.test(categoria) ? ['#Audio', '#Musica', '#Sonido']
    : /energ|cargador/.test(categoria) ? ['#CargaRapida', '#AccesoriosCelular', '#Cargadores']
    : /almacen/.test(categoria) ? ['#Almacenamiento', '#Computacion', '#Informatica']
    : /movil|celular|smartphone/.test(categoria) ? ['#Celulares', '#Smartphone', '#AccesoriosCelular']
    : /computador/.test(categoria) ? ['#Computadores', '#Computacion', '#Informatica', '#Oficina']
    : ['#Electronica', '#Accesorios'];
  porTipo.forEach(sumar);
  (p?.es_servicio
    ? ['#Tecnologia', '#Computacion', '#Informatica', '#TiendaArica', '#SevelinCL', '#PC', '#Notebook', '#Celulares', '#Consolas', '#AricaSiempreArica']
    : ['#Tecnologia', '#Ofertas', '#TiendaOnline', '#CompraOnline', '#EnviosATodoChile', '#TiendaArica', '#SevelinCL', '#ComprasChile',
      '#RetiroEnTienda', '#Novedades', '#Electronica', '#Accesorios', '#Regalos', '#AricaSiempreArica']
  ).forEach(sumar);
  return lista;
}

/* Corta un párrafo en una oración completa que quepa en `tope` letras. */
function acortarParrafoParaRedes(texto, tope) {
  const t = String(texto || '').trim();
  if (t.length <= tope) return t;
  const oraciones = t.match(/[^.!?]+[.!?]+/g) || [];
  let corto = '';
  for (const o of oraciones) {
    if ((corto + o).trim().length > tope) break;
    corto += o;
  }
  return corto.trim() || t.slice(0, tope).replace(/\s+\S*$/, '').trim() + '…';
}

/* ¿Hay con qué armar una publicación? Sin introducción ni características no se arma nada. */
function fichaAlcanzaParaRedes(partes) {
  return !!(partes && (partes.intro.length >= 40 || partes.caracteristicas.length + (partes.incluye || []).length >= 2));
}

/* PUBLICACIÓN DE FACEBOOK: el mismo orden de la plantilla que usa la IA. */
function armarTextoFacebook(p) {
  const partes = partesDeFichaParaRedes(descripcionParaRedes(p));
  if (p?.es_servicio && partes.incluye.length) { partes.caracteristicas = partes.caracteristicas.concat(partes.incluye); partes.incluye = []; }
  if (!fichaAlcanzaParaRedes(partes)) return '';
  const servicio = !!p?.es_servicio;
  const bloques = [encabezadoParaRedes(p)];
  const condicion = lineaCondicionParaRedes(p);
  if (condicion) bloques.push(condicion);
  if (partes.intro) bloques.push('✨ ' + partes.intro);
  // Una ficha escrita en párrafos, sin lista: van los dos párrafos siguientes tal como están
  if (!partes.caracteristicas.length) partes.masTexto.slice(0, 2).forEach(t => bloques.push(t));
  if (partes.importante.length) bloques.push('⚠️ IMPORTANTE: ' + partes.importante.slice(0, 3).join(' '));
  if (partes.caracteristicas.length) {
    bloques.push((servicio ? '✨ QUÉ INCLUYE' : '✨ CARACTERÍSTICAS PRINCIPALES') + '\n\n' + partes.caracteristicas.slice(0, 12).map(c => '✅ ' + c).join('\n'));
  }
  if (partes.incluye.length) bloques.push('📦 INCLUYE\n\n' + partes.incluye.slice(0, 8).map(c => '✅ ' + c).join('\n'));
  if (partes.noIncluye.length) bloques.push('🚫 NO INCLUYE\n\n' + partes.noIncluye.slice(0, 6).map(c => '❌ ' + c).join('\n'));

  // Un producto por encargo no está en la tienda: no se promete envío hoy ni stock
  const encargo = !servicio && !!p?.es_pedido_encargo;
  bloques.push(encargo
    ? '📌 PRODUCTO POR ENCARGO · RETIRO PRESENCIAL SECTOR 11 SEPTIEMBRE O ENVÍO EN ARICA\n📍 San Rafael 896, Arica. Entrada por Robinson Rojas: busca los carteles de servicio técnico.\n⚠️ Se pide al proveedor cuando confirmas tu compra. Escríbenos antes y te confirmamos el plazo de llegada.'
    : servicio
    ? '📌 SERVICIO TÉCNICO EN ARICA, SECTOR 11 SEPTIEMBRE\n📍 San Rafael 896, Arica. Entrada por Robinson Rojas: busca los carteles de servicio técnico.\n⚠️ Antes de venir, escríbenos: te confirmamos el horario y coordinamos la recepción de tu equipo.'
    : '📌 RETIRO PRESENCIAL SECTOR 11 SEPTIEMBRE O ENVÍO HOY EN ARICA\n📍 San Rafael 896, Arica. Entrada por Robinson Rojas: busca los carteles de servicio técnico.\n⚠️ Antes de venir, consulta siempre la disponibilidad del producto. Escríbenos y te confirmamos el stock y el horario, para que tu pedido esté listo cuando llegues.');
  bloques.push('🕐 Horario de atención: Consulta nuestros horarios actualizados en nuestros canales digitales.');
  bloques.push(`📲 WhatsApp: ${REDES_WHATSAPP}\n${REDES_WHATSAPP_EMOJIS}\n📸 Instagram: @sevelin.cl`);
  if (!servicio) bloques.push('🇨🇱 Envíos a todo Chile.');
  const garantia = lineaGarantiaParaRedes(p);
  if (garantia) bloques.push(garantia);
  bloques.push('💳 Métodos de pago: Efectivo • Transferencia • Tarjetas de débito • Tarjetas de crédito.');
  bloques.push(servicio ? '🧾 Se emite boleta por el servicio.' : '🧾 Se emite boleta por su compra.');
  bloques.push(servicio
    ? '🛍️ Más servicios y precios en nuestra tienda online www.sevelin.cl'
    : '🛍️ Compra online: Compra de forma rápida y segura directamente en nuestra tienda online www.sevelin.cl');
  bloques.push(hashtagsParaRedes(p, 20).join(', '));
  return conAgregableParaRedes(bloques.join('\n\n'), p).slice(0, REDES_TOPE_FACEBOOK);
}

/* PIE DE FOTO DE INSTAGRAM: más corto, con los hashtags separados por espacios.
   Si no cabe en lo que acepta Instagram, se van quitando características. */
function armarTextoInstagram(p) {
  const partes = partesDeFichaParaRedes(descripcionParaRedes(p));
  if (p?.es_servicio && partes.incluye.length) { partes.caracteristicas = partes.caracteristicas.concat(partes.incluye); partes.incluye = []; }
  if (!fichaAlcanzaParaRedes(partes)) return '';
  const servicio = !!p?.es_servicio;
  const armar = (cuantas) => {
    const bloques = [encabezadoParaRedes(p)];
    const condicion = lineaCondicionParaRedes(p);
    if (condicion) bloques.push(condicion);
    if (partes.intro) bloques.push(acortarParrafoParaRedes(partes.intro, 320));
    if (partes.caracteristicas.length && cuantas > 0) bloques.push(partes.caracteristicas.slice(0, cuantas).map(c => '✅ ' + c).join('\n'));
    if (servicio && partes.noIncluye.length) bloques.push(partes.noIncluye.slice(0, 2).map(c => '❌ No incluye: ' + c).join('\n'));
    if (partes.importante.length) bloques.push('⚠️ ' + acortarParrafoParaRedes(partes.importante[0], 260));
    const cierre = ['📍 San Rafael 896, Arica. Entrada por Robinson Rojas.', `📲 WhatsApp: ${REDES_WHATSAPP}`,
      servicio ? '🛍️ Más servicios en www.sevelin.cl' : '🛍️ Compra online en www.sevelin.cl'];
    if (!servicio) cierre.push('🇨🇱 Envíos a todo Chile.');
    if (!servicio && p?.es_pedido_encargo) cierre.push('📦 Producto por encargo: escríbenos y te confirmamos el plazo de llegada.');
    const garantia = lineaGarantiaParaRedes(p);
    if (garantia) cierre.push(garantia);
    bloques.push(cierre.join('\n'));
    bloques.push(hashtagsParaRedes(p, 12).join(' '));
    return conAgregableParaRedes(bloques.join('\n\n'), p);
  };
  for (let cuantas = 6; cuantas >= 0; cuantas--) {
    const texto = armar(cuantas);
    if (texto.length <= REDES_TOPE_INSTAGRAM) return texto;
  }
  return armar(0).slice(0, REDES_TOPE_INSTAGRAM);
}

/* ==========================================================================
   v172 — EL MISMO PRODUCTO CON OTRO ENFOQUE (oferta, recién llegado, últimas
   unidades, liquidación, por llegar, regalo, por mayor, corto)
   --------------------------------------------------------------------------
   Dueño, 21-10-2026: "necesito otras formas de publicar el texto de un
   producto, distinta según contexto o promoción". Sigue la regla de v139:
   nada se inventa. Cada enfoque solo se ofrece si el DATO existe en el
   producto (oferta vigente, etiqueta, stock, por llegar, precio por mayor) y
   lo que agrega son frases de venta ciertas para cualquier producto. Las
   características siguen saliendo de la Descripción, tal como están.
   ========================================================================== */
const ENFOQUES_REDES = [
  { id: 'normal', texto: 'Normal', detalle: 'El texto de siempre' },
  { id: 'oferta', texto: '🔥 Oferta', detalle: 'Antes y ahora' },
  { id: 'nuevo', texto: '🆕 Recién llegado', detalle: 'Novedad en la tienda' },
  { id: 'ultimas', texto: '⏳ Últimas unidades', detalle: 'Queda poco' },
  { id: 'liquidacion', texto: '🏷️ Liquidación', detalle: 'Hasta agotar stock' },
  { id: 'por_llegar', texto: '🚚 Por llegar', detalle: 'Resérvalo antes' },
  { id: 'regalo', texto: '🎁 Para regalar', detalle: 'Idea de regalo' },
  { id: 'mayorista', texto: '📦 Por mayor', detalle: 'Precio por cantidad' },
  { id: 'corto', texto: '💬 Corto', detalle: 'WhatsApp e historias' },
];
const REDES_DIAS_RECIEN_LLEGADO = 30;
const REDES_TOPE_ULTIMAS = 3;

function pesosParaRedes(n) {
  return typeof fmtCLP === 'function' ? fmtCLP(n) : '$' + Math.round(Number(n) || 0).toLocaleString('es-CL');
}

function diaMesParaRedes(fechaISO) {
  const f = String(fechaISO || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(f) ? `${f.slice(8, 10)}-${f.slice(5, 7)}` : '';
}

/* El precio que se cobra HOY: la oferta de la web si está vigente y no pausada (igual que la
   tienda), si no el normal. `hoy` = 'AAAA-MM-DD'. Lo usa también js/redes-contenido.js. */
function precioVigenteParaRedes(p, hoy) {
  const normal = Number(p?.precio_web) || Number(p?.precio_unitario) || 0;
  const oferta = Number(p?.precio_oferta_web) || 0;
  const dia = (v) => String(v || '').slice(0, 10);
  const vigente = oferta > 0 && oferta < normal && !p?.oferta_pausada
    && (!p?.oferta_desde || dia(p.oferta_desde) <= hoy) && (!p?.oferta_hasta || dia(p.oferta_hasta) >= hoy);
  return { precio: vigente ? oferta : normal, antes: vigente ? normal : null, desde: !!p?.precio_a_consultar,
    hasta: vigente && p?.oferta_hasta ? dia(p.oferta_hasta) : null };
}

/* "➕ AGREGABLE" (v173, sql/110, dueño 21-10-2026): el accesorio opcional del producto (ej. el
   adaptador HDMI a VGA de un monitor sin HDMI) va como bloque propio antes de "📌 RETIRO" (Facebook)
   o del cierre "📍" (Instagram). Se arma con el precio del DÍA y se rehace cada vez: si el texto
   ya traía un bloque viejo, se reemplaza, así un precio cambiado nunca queda escrito.
   En el navegador el accesorio se busca en productsList; en Node se pasa p.agregable =
   { nombre, precio }. Sin stock o archivado, no sale (y un bloque viejo se quita). */
const REDES_MARCA_AGREGABLE = '➕ OPCIONAL';

function agregableParaRedes(p, hoy) {
  if (p?.agregable && p.agregable.nombre) return p.agregable;
  const id = Number(p?.agregable_id);
  if (!Number.isInteger(id) || id <= 0) return null;
  const lista = typeof productsList !== 'undefined' && Array.isArray(productsList) ? productsList : [];
  const a = lista.find(x => Number(x.id) === id);
  if (!a || a.archivado || (!a.stock_ilimitado && Number(a.stock) <= 0)) return null;
  const dia = hoy || (typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0, 10));
  return { nombre: a.nombre, precio: precioVigenteParaRedes(a, dia).precio };
}

function bloqueAgregableParaRedes(p, hoy) {
  const a = agregableParaRedes(p, hoy);
  if (!a || !(Number(a.precio) > 0)) return '';
  const motivo = String(p?.agregable_motivo || '').replace(/\s+/g, ' ').trim().replace(/\.+$/, '');
  return `${REDES_MARCA_AGREGABLE}\n🔌 ${a.nombre}: ${pesosParaRedes(a.precio)}${motivo ? `\n${motivo}.` : ''}\nPídelo junto con tu compra.`;
}

/* Pone (o saca, o actualiza) el bloque en un texto ya escrito. Un texto vacío queda vacío. */
function conAgregableParaRedes(texto, p, hoy) {
  const t = String(texto || '').replace(/\r\n/g, '\n');
  if (!t.trim()) return t;
  const bloques = t.split('\n\n').filter(b => !b.startsWith(REDES_MARCA_AGREGABLE));
  const nuevo = bloqueAgregableParaRedes(p, hoy);
  if (nuevo) {
    let i = bloques.findIndex(b => b.startsWith('📌 ') || b.startsWith('📍 '));
    if (i < 0) i = bloques.findIndex(b => b.startsWith('#'));
    bloques.splice(i < 0 ? bloques.length : i, 0, nuevo);
  }
  return bloques.join('\n\n');
}

function lineaPrecioParaRedes(pr) {
  if (!(pr.precio > 0)) return '💬 Precio: consúltanos por WhatsApp.';
  return `💰 ${pr.desde ? 'Desde ' : ''}${pesosParaRedes(pr.precio)}${pr.antes ? ` (antes ${pesosParaRedes(pr.antes)})` : ''}`;
}

/* Qué enfoques sirven para este producto y, si no, por qué (para el botón apagado). */
function enfoquesDisponiblesParaRedes(p, hoy) {
  const servicio = !!p?.es_servicio;
  const pr = precioVigenteParaRedes(p, hoy);
  const etiqueta = String(p?.etiqueta_web || '').toUpperCase();
  const stock = Number(p?.stock) || 0;
  const creado = String(p?.created_at || '').slice(0, 10);
  const dias = creado ? Math.round((Date.parse(hoy) - Date.parse(creado)) / 86400000) : null;
  const nuevo = etiqueta === 'NOVEDAD' || (dias !== null && dias >= 0 && dias <= REDES_DIAS_RECIEN_LLEGADO);
  // Una promoción de algo que no se puede llevar hoy engaña: oferta, novedad, liquidación, regalo y por mayor piden stock
  const hayStock = servicio || !!p?.stock_ilimitado || stock > 0;
  // razon: el porqué completo (al pasar el mouse) · corta: lo que cabe en el botón
  const ok = (si, razon, corta) => (si ? { ok: true } : { ok: false, razon, corta: corta || 'No aplica' });
  const conStock = (si, razon, corta) => (!hayStock ? { ok: false, razon: 'No tiene stock', corta: 'Sin stock' } : ok(si, razon, corta));
  return {
    normal: ok(true),
    oferta: conStock(!!pr.antes, 'No tiene una oferta vigente en la web (Productos → Ofertas)', 'Sin oferta vigente'),
    nuevo: conStock(!servicio && nuevo, `Se creó hace más de ${REDES_DIAS_RECIEN_LLEGADO} días y no tiene la etiqueta Novedad`, `Más de ${REDES_DIAS_RECIEN_LLEGADO} días`),
    ultimas: ok(!servicio && !p?.stock_ilimitado && !p?.por_llegar && stock >= 1 && stock <= REDES_TOPE_ULTIMAS,
      stock < 1 ? 'No tiene stock' : `Tiene ${stock} unidades (este enfoque es para ${REDES_TOPE_ULTIMAS} o menos)`,
      stock < 1 ? 'Sin stock' : `Tiene ${stock}`),
    liquidacion: conStock(etiqueta === 'LIQUIDACION', 'No tiene la etiqueta Liquidación', 'Sin etiqueta'),
    por_llegar: ok(!!p?.por_llegar, 'No está marcado como por llegar', 'No está por llegar'),
    regalo: conStock(!servicio, 'Es un servicio', 'Es servicio'),
    mayorista: conStock(!servicio && Number(p?.precio_mayorista) > 0 && Number(p?.mayorista_desde) > 1, 'No tiene precio por mayor', 'Sin precio por mayor'),
    corto: ok(true),
  };
}

/* Lo que va arriba en cada enfoque. Solo datos del producto y frases ciertas. */
function encabezadoDeEnfoqueParaRedes(p, enfoque, pr, hoy) {
  const nombre = nombreParaRedes(p);
  const precio = lineaPrecioParaRedes(pr);
  switch (enfoque) {
    case 'oferta': return [
      `🔥 OFERTA · ${nombre}`,
      `Antes ${pesosParaRedes(pr.antes)} → ahora ${pesosParaRedes(pr.precio)} (ahorras ${pesosParaRedes(pr.antes - pr.precio)})`
        + (pr.hasta ? `\n⏰ Válida hasta el ${diaMesParaRedes(pr.hasta)} o hasta agotar stock.` : '\n⏰ Hasta agotar stock.')];
    case 'nuevo': return [`🆕 RECIÉN LLEGADO A SEVELIN\n${encabezadoParaRedes(p)}`, precio];
    case 'ultimas': return [`⏳ ¡ÚLTIMAS UNIDADES!\n${encabezadoParaRedes(p)}`, precio,
      '📲 Escríbenos y te lo dejamos listo para retirar.'];
    case 'liquidacion': return [`🏷️ LIQUIDACIÓN · ${nombre}`, `${precio}\n📦 Hasta agotar stock.`];
    case 'por_llegar': {
      // Una fecha estimada que ya pasó no se publica: "llega pronto"
      const fecha = String(p?.fecha_llegada_estimada || '').slice(0, 10);
      const llega = fecha && (!hoy || fecha >= hoy) ? diaMesParaRedes(fecha) : '';
      return [`🚚 POR LLEGAR · ${nombre}`,
        `${llega ? `📅 Llega aprox. el ${llega}.` : '📅 Llega pronto.'}\n${precio}`,
        `📲 Escríbenos para reservarlo${p?.publicado_web ? ' o resérvalo en www.sevelin.cl/por-llegar' : ''}.`];
    }
    case 'regalo': return [`🎁 IDEA DE REGALO\n${encabezadoParaRedes(p)}`, precio,
      '🎀 Te lo dejamos listo para retirar en San Rafael 896 o te lo enviamos en Arica.'];
    case 'mayorista': return [`📦 PRECIO POR MAYOR · ${nombre}`,
      `💼 ¿Compras para tu negocio o para revender? Tenemos precio especial desde ${Number(p.mayorista_desde)} unidades.\n📲 Escríbenos y te cotizamos.`,
      `${precio} por unidad`];
    default: return [encabezadoParaRedes(p), precio];
  }
}

const REDES_HASHTAG_ENFOQUE = {
  oferta: ['#Oferta', '#Descuento'], nuevo: ['#NuevoIngreso', '#RecienLlegado'], ultimas: ['#UltimasUnidades'],
  liquidacion: ['#Liquidacion', '#HastaAgotarStock'], por_llegar: ['#PorLlegar', '#Reserva'], regalo: ['#IdeaDeRegalo', '#Regalos'],
  mayorista: ['#PorMayor', '#Mayorista'],
};

/* Texto corto: para WhatsApp, estados e historias. */
function armarTextoCortoParaRedes(p, pr) {
  const partes = partesDeFichaParaRedes(descripcionParaRedes(p));
  const puntos = (partes.caracteristicas || []).filter(c => c.length <= 70).slice(0, 3).map(c => '✅ ' + c);
  return [
    `✨ ${nombreParaRedes(p)}`,
    lineaPrecioParaRedes(pr),
    ...puntos,
    '',
    '📍 San Rafael 896, Arica (entrada por Robinson Rojas)',
    `📲 WhatsApp ${REDES_WHATSAPP}`,
    '🛍️ www.sevelin.cl',
  ].join('\n').replace(/\n{3,}/g, '\n\n');
}

/* El texto con el enfoque y la red elegidos. `red` = 'instagram' | 'facebook'.
   Toma el texto normal (desde la Descripción), le cambia el encabezado, en un "por llegar"
   cambia el bloque de retiro (todavía no está en la tienda) y suma los hashtags del enfoque. */
function armarTextoConEnfoqueParaRedes(p, enfoque, red, hoy) {
  const pr = precioVigenteParaRedes(p, hoy);
  if (enfoque === 'corto') return armarTextoCortoParaRedes(p, pr);
  const instagram = red !== 'facebook';
  const base = instagram ? armarTextoInstagram(p) : armarTextoFacebook(p);
  const arriba = encabezadoDeEnfoqueParaRedes(p, enfoque, pr, hoy);
  const extra = REDES_HASHTAG_ENFOQUE[enfoque] || [];

  if (!base) {
    // Sin Descripción no hay cuerpo que ordenar: solo el encabezado, el precio y cómo comprar
    // En Facebook el número va también en emojis: Facebook esconde los números escritos (v136)
    return [...arriba, '📍 San Rafael 896, Arica. Entrada por Robinson Rojas.',
      instagram ? `📲 WhatsApp: ${REDES_WHATSAPP}` : `📲 WhatsApp: ${REDES_WHATSAPP}\n${REDES_WHATSAPP_EMOJIS}`, '🛍️ www.sevelin.cl'].join('\n\n');
  }
  let bloques = base.split('\n\n');
  bloques.shift();                                               // el encabezado normal ("✨ NUEVO …")
  if (enfoque === 'por_llegar') {
    bloques = bloques.map(b => b.startsWith('📌 RETIRO PRESENCIAL')
      ? '📌 POR LLEGAR · RETIRO PRESENCIAL SECTOR 11 SEPTIEMBRE O ENVÍO EN ARICA CUANDO LLEGUE\n📍 San Rafael 896, Arica. Entrada por Robinson Rojas: busca los carteles de servicio técnico.'
      : b);
  }
  const ultimo = bloques.length - 1;
  if (extra.length && ultimo >= 0 && bloques[ultimo].startsWith('#')) {
    const sep = instagram ? ' ' : ', ';
    const ya = new Set(bloques[ultimo].split(/[\s,]+/).map(t => t.toLowerCase()));
    bloques[ultimo] = [...extra.filter(t => !ya.has(t.toLowerCase())), bloques[ultimo]].join(sep);
  }
  let texto = [...arriba, ...bloques].join('\n\n');
  // Instagram acepta hasta 2.200 letras: si el encabezado lo pasa, se quitan características del final
  const tope = instagram ? REDES_TOPE_INSTAGRAM : REDES_TOPE_FACEBOOK;
  while (texto.length > tope && /\n✅ [^\n]*/.test(texto)) {
    const lineas = texto.split('\n');
    let i = lineas.length - 1;
    while (i >= 0 && !lineas[i].startsWith('✅ ')) i--;
    if (i < 0) break;
    lineas.splice(i, 1);
    texto = lineas.join('\n');
  }
  return texto.slice(0, tope);
}

/* Frase grande de la imagen que acompaña a cada enfoque (el dueño la puede cambiar). */
const REDES_GANCHO_ENFOQUE = {
  oferta: '¡Está en oferta!', nuevo: 'Recién llegado', ultimas: 'Últimas unidades', liquidacion: 'Liquidación',
  por_llegar: 'Llega pronto', regalo: 'Idea de regalo', mayorista: 'Precio por mayor',
};
