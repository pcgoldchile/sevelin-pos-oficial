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
  return bloques.join('\n\n').slice(0, REDES_TOPE_FACEBOOK);
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
    return bloques.join('\n\n');
  };
  for (let cuantas = 6; cuantas >= 0; cuantas--) {
    const texto = armar(cuantas);
    if (texto.length <= REDES_TOPE_INSTAGRAM) return texto;
  }
  return armar(0).slice(0, REDES_TOPE_INSTAGRAM);
}
