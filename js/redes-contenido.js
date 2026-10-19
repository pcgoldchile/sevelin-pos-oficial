// ==========================================
// REDES-CONTENIDO.JS — Redes sociales: crear contenido de un producto (v164, sql/104)
// ------------------------------------------
// Pedido del dueño (19-10-2026): "una opción de crear contenido a partir de un producto
// con un botón, para armar si es para historia, feed, carrusel o contenido, en un módulo
// de redes sociales en el POS… y que haya un registro de qué se ha promocionado
// últimamente… y formas de variar si subo de un producto, pero hecho de otra forma".
//
// Las piezas se DIBUJAN EN EL NAVEGADOR (canvas) con los datos reales del producto:
// foto, nombre, precio y lo que ya dice su ficha. Nada se inventa y nada se publica solo:
// se descarga, él revisa y sube. Cada descarga queda en el registro (contenido_redes),
// que avisa si el producto se mostró hace poco y elige otra versión para no repetir.
//   Formatos: historia 1080×1920 · post 1080×1350 · carrusel 5 × 1080×1350 · reel 12 s.
//   Estilos:  dinamico · minimalista · precio · beneficios · confianza.
// Todas las funciones empiezan con "contenidoRedes" (regla 1 del CLAUDE.md: un solo ámbito).
// ==========================================

const CONTENIDO_REDES_TIENDA = {
  whatsapp: '+56 9 3575 0828',
  direccion: 'San Rafael 896, Arica',
  entrada: 'Entrada por Av. Robinson Rojas',
  web: 'sevelin.cl',
};
const CONTENIDO_REDES_DIAS_REPETIDO = 14;   // el mismo REDES_DIAS_REPETIDO del servidor

const CONTENIDO_REDES_FORMATOS = [
  { id: 'historia', texto: 'Historia', detalle: '1080 × 1920', ancho: 1080, alto: 1920 },
  { id: 'post', texto: 'Post (feed)', detalle: '1080 × 1350', ancho: 1080, alto: 1350 },
  { id: 'carrusel', texto: 'Carrusel', detalle: '5 láminas', ancho: 1080, alto: 1350 },
  { id: 'reel', texto: 'Reel', detalle: 'video de 12 s', ancho: 1080, alto: 1920 },
];
const CONTENIDO_REDES_ESTILOS = [
  { id: 'dinamico', texto: 'Dinámico', detalle: 'Oscuro, con brillo azul' },
  { id: 'minimalista', texto: 'Minimalista', detalle: 'Claro y limpio' },
  { id: 'precio', texto: 'Precio grande', detalle: 'El precio manda' },
  { id: 'beneficios', texto: 'Beneficios', detalle: 'Lo que dice su ficha' },
  { id: 'confianza', texto: 'Por qué Sevelin', detalle: 'Garantía y retiro' },
];
/* Frases grandes. Todas son ciertas para cualquier producto de la tienda (nada de "el más
   vendido" sin el dato). Se elige una que este producto no haya usado en 30 días. */
const CONTENIDO_REDES_GANCHOS = {
  producto: ['Lo pides hoy, lo tienes hoy', '¿Lo andabas buscando?', 'Ya está en Sevelin', 'Para tu día a día', 'Míralo en San Rafael 896', 'Con garantía Sevelin', 'Hecho para durar'],
  servicio: ['Tu equipo como nuevo', '¿Tu equipo anda lento?', 'Lo dejamos funcionando', 'Servicio técnico en Arica', 'Con garantía, sin vueltas'],
  precio: ['Precio Sevelin', 'Mira este precio', 'Así de simple'],
};

let contenidoRedesEstado = null;     // { producto, formato, estilo, gancho, iFoto, fotos[], registro[], beneficios[] }
let contenidoRedesRegistroCache = [];

/* ---------- Datos del producto ---------- */

function contenidoRedesPrecio(p) {
  const normal = Number(p.precio_web) || Number(p.precio_unitario) || 0;
  const oferta = Number(p.precio_oferta_web) || 0;
  const hoy = todayISO();
  const vigente = oferta > 0 && oferta < normal && (!p.oferta_desde || String(p.oferta_desde).slice(0, 10) <= hoy) && (!p.oferta_hasta || String(p.oferta_hasta).slice(0, 10) >= hoy);
  return { precio: vigente ? oferta : normal, antes: vigente ? normal : null, desde: !!p.precio_a_consultar };
}

/* Hasta 4 frases cortas de la ficha (las "✅" de la Descripción), sin inventar nada. */
function contenidoRedesBeneficios(p) {
  if (typeof lineasDeFichaParaRedes !== 'function') return [];
  const html = (typeof descripcionParaRedes === 'function' ? descripcionParaRedes(p) : '') || p.descripcion_web || p.descripcion || '';
  return lineasDeFichaParaRedes(html)
    .filter(l => l.startsWith('✅'))
    .map(l => l.replace(/^✅\s*/, '').replace(/\s+/g, ' ').trim())
    .filter(l => l.length >= 6 && l.length <= 70)
    .slice(0, 4);
}

function contenidoRedesEsServicio(p) {
  return !!p.es_servicio || p.categoria_web === 'Servicios Técnicos';
}

function contenidoRedesFormatoDe(id) { return CONTENIDO_REDES_FORMATOS.find(f => f.id === id) || CONTENIDO_REDES_FORMATOS[0]; }

/* ---------- Dibujo (canvas) ---------- */

const CONTENIDO_REDES_LETRA = "'IBM Plex Sans', 'Segoe UI', Arial, sans-serif";

async function contenidoRedesCargarLetras() {
  if (!document.fonts?.load) return;
  try { await Promise.all(['400', '600', '700'].map(w => document.fonts.load(`${w} 40px 'IBM Plex Sans'`))); } catch (_) { /* usa la de respaldo */ }
}

async function contenidoRedesCargarFoto(url) {
  const resp = await fetch(url, { mode: 'cors' });
  if (!resp.ok) throw new Error(`No se pudo cargar una foto (${resp.status})`);
  return createImageBitmap(await resp.blob());
}

function contenidoRedesRedondeado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* Parte un texto en líneas que caben en `ancho`; achica la letra hasta que entran en `maxLineas`. */
function contenidoRedesLineas(ctx, texto, ancho, tam, peso, maxLineas, minimo = 26) {
  let t = tam;
  for (; t >= minimo; t -= 4) {
    ctx.font = `${peso} ${t}px ${CONTENIDO_REDES_LETRA}`;
    const palabras = String(texto || '').split(/\s+/).filter(Boolean);
    const lineas = [];
    let actual = '';
    for (const p of palabras) {
      const prueba = actual ? `${actual} ${p}` : p;
      if (ctx.measureText(prueba).width <= ancho || !actual) actual = prueba;
      else { lineas.push(actual); actual = p; }
    }
    if (actual) lineas.push(actual);
    if (lineas.length <= maxLineas) return { lineas, tam: t };
  }
  ctx.font = `${peso} ${minimo}px ${CONTENIDO_REDES_LETRA}`;
  const todas = contenidoRedesLineas(ctx, texto, ancho, minimo, peso, 99, minimo).lineas;
  const cortadas = todas.slice(0, maxLineas);
  if (todas.length > maxLineas) cortadas[maxLineas - 1] = cortadas[maxLineas - 1].replace(/\s*\S*$/, '') + '…';
  return { lineas: cortadas, tam: minimo };
}

function contenidoRedesTexto(ctx, texto, x, y, ancho, { tam = 48, peso = 600, color = '#fff', alinear = 'center', maxLineas = 2, interlineado = 1.15, sombra = null, minimo } = {}) {
  const { lineas, tam: t } = contenidoRedesLineas(ctx, texto, ancho, tam, peso, maxLineas, minimo);
  ctx.save();
  ctx.font = `${peso} ${t}px ${CONTENIDO_REDES_LETRA}`;
  ctx.fillStyle = color;
  ctx.textAlign = alinear;
  ctx.textBaseline = 'top';
  if (sombra) { ctx.shadowColor = sombra; ctx.shadowBlur = t * 0.6; }
  const xx = alinear === 'center' ? x + ancho / 2 : alinear === 'right' ? x + ancho : x;
  lineas.forEach((l, i) => ctx.fillText(l, xx, y + i * t * interlineado));
  ctx.restore();
  return y + lineas.length * t * interlineado;
}

function contenidoRedesFoto(ctx, foto, x, y, w, h, { fondo = '#ffffff', radio = 48, borde = null, brillo = null, margen = 0.06 } = {}) {
  ctx.save();
  if (brillo) { ctx.shadowColor = brillo; ctx.shadowBlur = 90; }
  contenidoRedesRedondeado(ctx, x, y, w, h, radio);
  ctx.fillStyle = fondo;
  ctx.fill();
  ctx.restore();
  if (borde) { ctx.save(); contenidoRedesRedondeado(ctx, x, y, w, h, radio); ctx.strokeStyle = borde; ctx.lineWidth = 4; ctx.stroke(); ctx.restore(); }
  if (!foto) return;
  const m = Math.min(w, h) * margen;
  const escala = Math.min((w - 2 * m) / foto.width, (h - 2 * m) / foto.height);
  const fw = foto.width * escala, fh = foto.height * escala;
  ctx.save();
  contenidoRedesRedondeado(ctx, x, y, w, h, radio);
  ctx.clip();
  ctx.drawImage(foto, x + (w - fw) / 2, y + (h - fh) / 2, fw, fh);
  ctx.restore();
}

function contenidoRedesLogo(ctx, cx, y, tam, oscuro) {
  ctx.save();
  ctx.font = `700 ${tam}px ${CONTENIDO_REDES_LETRA}`;
  ctx.textBaseline = 'top';
  const ancho = ctx.measureText('SEVELIN').width + tam * 0.55;
  const x0 = cx - ancho / 2;
  ctx.fillStyle = '#3b82f6';
  ctx.shadowColor = '#3b82f6'; ctx.shadowBlur = oscuro ? tam * 0.5 : 0;
  ctx.beginPath(); ctx.arc(x0 + tam * 0.16, y + tam * 0.55, tam * 0.16, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.textAlign = 'left';
  ctx.fillStyle = oscuro ? '#f4f4f5' : '#0f172a';
  ctx.fillText('SE', x0 + tam * 0.45, y);
  const se = ctx.measureText('SE').width;
  ctx.fillStyle = '#3b82f6';
  ctx.fillText('VELIN', x0 + tam * 0.45 + se, y);
  ctx.restore();
}

function contenidoRedesPrecioTexto(pr) { return fmtCLP(pr.precio); }

function contenidoRedesFondoOscuro(ctx, W, H, mov = 0) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const halo = (x, y, r, color, alfa) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace('A', String(alfa)));
    g.addColorStop(1, color.replace('A', '0'));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  halo(W * 0.85 + mov * 60, H * 0.08, W * 0.75, 'rgba(59,130,246,A)', 0.32);
  halo(W * 0.1, H * 0.95 - mov * 60, W * 0.7, 'rgba(29,78,216,A)', 0.35);
}

/* Pie con WhatsApp y dirección, en dos líneas, centrado en `y`. */
function contenidoRedesPie(ctx, W, y, oscuro, escala = 1) {
  ctx.save();
  const w = 900 * escala, h = 110 * escala, x = (W - w) / 2;
  contenidoRedesRedondeado(ctx, x, y, w, h, 30 * escala);
  ctx.fillStyle = oscuro ? 'rgba(13,13,16,0.88)' : '#ffffff';
  ctx.fill();
  ctx.strokeStyle = oscuro ? 'rgba(59,130,246,0.45)' : '#dbe1ea';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `700 ${36 * escala}px ${CONTENIDO_REDES_LETRA}`;
  ctx.fillStyle = oscuro ? '#22c55e' : '#15803d';
  ctx.fillText(`WhatsApp ${CONTENIDO_REDES_TIENDA.whatsapp}`, W / 2, y + 16 * escala);
  ctx.font = `600 ${27 * escala}px ${CONTENIDO_REDES_LETRA}`;
  ctx.fillStyle = oscuro ? '#cbd5e1' : '#475569';
  ctx.fillText(`${CONTENIDO_REDES_TIENDA.direccion} · ${CONTENIDO_REDES_TIENDA.entrada.toLowerCase().replace('av. robinson rojas', 'Av. Robinson Rojas')}`, W / 2, y + 64 * escala);
  ctx.restore();
}

function contenidoRedesSellos(ctx, W, y, textos, oscuro, tam = 34) {
  ctx.save();
  ctx.font = `600 ${tam}px ${CONTENIDO_REDES_LETRA}`;
  const pads = 28, sep = 16;
  const anchos = textos.map(t => ctx.measureText(`✓ ${t}`).width + pads * 2);
  /* En filas que caben en 980 px */
  const filas = [[]];
  let ancho = 0;
  textos.forEach((t, i) => {
    if (ancho + anchos[i] > 980 && filas[filas.length - 1].length) { filas.push([]); ancho = 0; }
    filas[filas.length - 1].push(i);
    ancho += anchos[i] + sep;
  });
  filas.forEach((fila, f) => {
    const total = fila.reduce((s, i) => s + anchos[i], 0) + sep * (fila.length - 1);
    let x = (W - total) / 2;
    const yy = y + f * (tam * 2.1);
    fila.forEach(i => {
      contenidoRedesRedondeado(ctx, x, yy, anchos[i], tam * 1.75, tam * 0.875);
      ctx.fillStyle = oscuro ? 'rgba(59,130,246,0.16)' : '#eff6ff';
      ctx.fill();
      ctx.strokeStyle = oscuro ? 'rgba(59,130,246,0.6)' : '#bfdbfe';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = oscuro ? '#f4f4f5' : '#1e3a8a';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(`✓ ${textos[i]}`, x + pads, yy + tam * 0.9);
      x += anchos[i] + sep;
    });
  });
  ctx.restore();
  return y + filas.length * tam * 2.1;
}

function contenidoRedesSellosDe(p) {
  return contenidoRedesEsServicio(p)
    ? ['Con garantía', 'Servicio técnico propio', 'Precio a la vista']
    : ['Garantía en todo', 'Retiro hoy en tienda', 'Te lo llevamos en Arica'];
}

/* Una lámina completa. `a` = avance de la animación (1 = quieta). */
function contenidoRedesDibujarLamina(ctx, W, H, e, opciones = {}) {
  const { estilo, producto: p, gancho } = e;
  const foto = e.fotos[opciones.iFoto ?? e.iFoto] || e.fotos[0] || null;
  const pr = contenidoRedesPrecio(p);
  const historia = H > 1600;
  const a = opciones.a ?? 1;
  const entra = (desde, hasta) => Math.max(0, Math.min(1, (a - desde) / (hasta - desde)));
  const suave = (x) => 1 - Math.pow(1 - x, 3);
  const libreAbajo = historia ? 230 : 0;   // aire para el sticker de enlace de la historia
  const pieY = H - libreAbajo - (historia ? 170 : 132);

  if (estilo === 'minimalista') {
    ctx.fillStyle = '#f3f4f6'; ctx.fillRect(0, 0, W, H);
    contenidoRedesLogo(ctx, W / 2, historia ? 120 : 60, historia ? 46 : 40, false);
    let y = (historia ? 230 : 140);
    const lado = historia ? 860 : 700;
    ctx.globalAlpha = suave(entra(0, 0.35));
    contenidoRedesFoto(ctx, foto, (W - lado) / 2, y + (1 - suave(entra(0, 0.35))) * 60, lado, lado, { radio: 36 });
    ctx.globalAlpha = 1;
    y += lado + (historia ? 70 : 44);
    y = contenidoRedesTexto(ctx, gancho, 90, y, W - 180, { tam: historia ? 64 : 54, peso: 600, color: '#0f172a', maxLineas: 2 });
    y = contenidoRedesTexto(ctx, p.nombre, 110, y + 16, W - 220, { tam: 34, peso: 400, color: '#475569', maxLineas: 2 });
    ctx.globalAlpha = suave(entra(0.3, 0.6));
    const precioTxt = (pr.desde ? 'Desde ' : '') + contenidoRedesPrecioTexto(pr);
    contenidoRedesTexto(ctx, precioTxt, 90, y + 26, W - 180, { tam: historia ? 104 : 88, peso: 700, color: '#2563eb', maxLineas: 1 });
    ctx.globalAlpha = 1;
    contenidoRedesPie(ctx, W, pieY, false, 0.95);
    return;
  }

  if (estilo === 'precio') {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#1d4ed8'); g.addColorStop(1, '#0b1640');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    /* Franja diagonal amarilla */
    ctx.save();
    ctx.translate(W / 2, historia ? 300 : 210);
    ctx.rotate(-0.06);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-W, -62, W * 2, 124);
    ctx.fillStyle = '#111827';
    ctx.font = `800 64px ${CONTENIDO_REDES_LETRA}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(gancho).toUpperCase(), 0, 4);
    ctx.restore();
    contenidoRedesLogo(ctx, W / 2, historia ? 110 : 44, historia ? 46 : 38, true);
    const lado = historia ? 720 : 500;
    let y = historia ? 440 : 320;
    ctx.globalAlpha = suave(entra(0, 0.35));
    contenidoRedesFoto(ctx, foto, (W - lado) / 2, y, lado, lado, { radio: 40, brillo: 'rgba(0,0,0,0.5)' });
    ctx.globalAlpha = 1;
    y += lado + 36;
    y = contenidoRedesTexto(ctx, p.nombre, 90, y, W - 180, { tam: 40, peso: 600, color: '#e0e7ff', maxLineas: 2 });
    const golpe = suave(entra(0.35, 0.55));
    ctx.save();
    ctx.translate(W / 2, y + (historia ? 110 : 95));
    ctx.scale(0.6 + 0.4 * golpe, 0.6 + 0.4 * golpe);
    ctx.globalAlpha = golpe;
    ctx.font = `800 ${historia ? 190 : 160}px ${CONTENIDO_REDES_LETRA}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#facc15';
    ctx.shadowColor = 'rgba(250,204,21,0.45)'; ctx.shadowBlur = 50;
    ctx.fillText(contenidoRedesPrecioTexto(pr), 0, 0);
    ctx.restore();
    y += historia ? 220 : 190;
    if (pr.antes) contenidoRedesTexto(ctx, `Antes ${fmtCLP(pr.antes)}`, 90, y, W - 180, { tam: 40, peso: 600, color: '#c7d2fe', maxLineas: 1 });
    else if (pr.desde) contenidoRedesTexto(ctx, 'Precio desde, según el modelo', 90, y, W - 180, { tam: 34, peso: 400, color: '#c7d2fe', maxLineas: 1 });
    contenidoRedesPie(ctx, W, pieY, true, 0.95);
    return;
  }

  /* dinamico, beneficios y confianza comparten el fondo oscuro */
  contenidoRedesFondoOscuro(ctx, W, H, a);
  contenidoRedesLogo(ctx, W / 2, historia ? 110 : 50, historia ? 50 : 42, true);
  let y = historia ? 210 : 120;
  y = contenidoRedesTexto(ctx, String(gancho).toUpperCase(), 70, y + (1 - suave(entra(0, 0.25))) * 40, W - 140, { tam: historia ? 98 : 80, peso: 700, color: '#ffffff', maxLineas: 2, interlineado: 1.02, sombra: 'rgba(59,130,246,0.9)' });

  if (estilo === 'beneficios' && e.beneficios.length) {
    const lado = historia ? 560 : 430;
    y += 34;
    ctx.globalAlpha = suave(entra(0.05, 0.35));
    contenidoRedesFoto(ctx, foto, (W - lado) / 2, y, lado, lado, { radio: 40, brillo: 'rgba(59,130,246,0.45)' });
    ctx.globalAlpha = 1;
    y += lado + 40;
    e.beneficios.forEach((b, i) => {
      const v = suave(entra(0.3 + i * 0.08, 0.5 + i * 0.08));
      ctx.save();
      ctx.globalAlpha = v;
      ctx.translate((1 - v) * 80, 0);
      ctx.fillStyle = '#22c55e';
      ctx.beginPath(); ctx.arc(120, y + 26, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#04130a'; ctx.font = `700 28px ${CONTENIDO_REDES_LETRA}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✓', 120, y + 27);
      const fin = contenidoRedesTexto(ctx, b, 162, y, W - 250, { tam: 38, peso: 600, color: '#f4f4f5', alinear: 'left', maxLineas: 2, minimo: 30 });
      ctx.restore();
      y = fin + 22;
    });
    const precioTxt = (pr.desde ? 'Desde ' : '') + contenidoRedesPrecioTexto(pr);
    contenidoRedesTexto(ctx, precioTxt, 90, y + 10, W - 180, { tam: historia ? 96 : 80, peso: 700, color: '#ffffff', maxLineas: 1, sombra: 'rgba(59,130,246,0.8)' });
    contenidoRedesPie(ctx, W, pieY, true, 0.95);
    return;
  }

  /* La foto toma lo que sobra: así el nombre, el precio y los sellos nunca chocan con el pie */
  const conSellos = estilo === 'confianza' || historia;
  const reserva = 40 + 106 + 18 + (historia ? 150 : 128) + (pr.antes ? 50 : 0) + (conSellos ? 30 + (historia ? 75 : 66) : 0) + 24;
  y += 36;
  const lado = Math.max(380, Math.min(historia ? 760 : 600, pieY - y - reserva));
  const v = suave(entra(0.05, 0.4));
  ctx.globalAlpha = v;
  contenidoRedesFoto(ctx, foto, (W - lado) / 2, y + (1 - v) * 120, lado, lado, { radio: 50, borde: 'rgba(59,130,246,0.55)', brillo: 'rgba(59,130,246,0.5)' });
  ctx.globalAlpha = 1;
  y += lado + 40;
  y = contenidoRedesTexto(ctx, p.nombre, 80, y, W - 160, { tam: 46, peso: 600, color: '#f4f4f5', maxLineas: 2 });
  const golpe = suave(entra(0.4, 0.6));
  ctx.save();
  ctx.globalAlpha = golpe;
  const precioTxt = (pr.desde ? 'Desde ' : '') + contenidoRedesPrecioTexto(pr);
  y = contenidoRedesTexto(ctx, precioTxt, 80, y + 18, W - 160, { tam: historia ? 132 : 112, peso: 700, color: '#ffffff', maxLineas: 1, sombra: 'rgba(59,130,246,0.85)' });
  ctx.restore();
  if (pr.antes) y = contenidoRedesTexto(ctx, `Antes ${fmtCLP(pr.antes)}`, 80, y + 4, W - 160, { tam: 38, peso: 400, color: '#a1a1aa', maxLineas: 1 });
  if (conSellos) {
    ctx.globalAlpha = suave(entra(0.55, 0.75));
    contenidoRedesSellos(ctx, W, y + 30, contenidoRedesSellosDe(p), true, historia ? 34 : 30);
    ctx.globalAlpha = 1;
  }
  contenidoRedesPie(ctx, W, pieY, true, 0.95);
}

/* Cierre (última lámina del carrusel y final del reel): las dos formas de comprar. */
function contenidoRedesDibujarCierre(ctx, W, H, e, a = 1) {
  const p = e.producto;
  const servicio = contenidoRedesEsServicio(p);
  const claro = e.estilo === 'minimalista';
  if (claro) { ctx.fillStyle = '#f3f4f6'; ctx.fillRect(0, 0, W, H); } else contenidoRedesFondoOscuro(ctx, W, H, 1);
  const tinta = claro ? '#0f172a' : '#ffffff';
  contenidoRedesLogo(ctx, W / 2, H > 1600 ? 140 : 70, 46, !claro);
  let y = H * (H > 1600 ? 0.26 : 0.18);
  y = contenidoRedesTexto(ctx, servicio || contenidoRedesPrecio(p).desde ? 'Cotízalo hoy' : 'Pídelo hoy', 80, y, W - 160, { tam: 110, peso: 700, color: tinta, maxLineas: 1, sombra: claro ? null : 'rgba(59,130,246,0.9)' });
  y += 50;
  const opcion = (i, color, icono, titulo, detalle) => {
    const v = Math.max(0, Math.min(1, (a - 0.15 - i * 0.12) / 0.3));
    const s = 1 - Math.pow(1 - v, 3);
    const x = 90 + (1 - s) * 140, w = W - 180, h = 170;
    ctx.save();
    ctx.globalAlpha = s;
    contenidoRedesRedondeado(ctx, x, y, w, h, 36);
    ctx.fillStyle = claro ? '#ffffff' : 'rgba(13,13,16,0.92)';
    ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.stroke();
    contenidoRedesRedondeado(ctx, x + 28, y + 28, 114, 114, 28);
    ctx.fillStyle = color; ctx.fill();
    ctx.font = `600 60px ${CONTENIDO_REDES_LETRA}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
    ctx.fillText(icono, x + 85, y + 88);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = `700 50px ${CONTENIDO_REDES_LETRA}`; ctx.fillStyle = tinta;
    ctx.fillText(titulo, x + 170, y + 34);
    ctx.font = `600 38px ${CONTENIDO_REDES_LETRA}`; ctx.fillStyle = color;
    ctx.fillText(detalle, x + 170, y + 100);
    ctx.restore();
    y += h + 30;
  };
  opcion(0, '#22c55e', '💬', servicio ? 'Cotiza por WhatsApp' : 'Escríbenos por WhatsApp', CONTENIDO_REDES_TIENDA.whatsapp);
  opcion(1, '#3b82f6', '🛒', servicio ? 'Agenda en la web' : 'Cómpralo en la web', servicio ? `${CONTENIDO_REDES_TIENDA.web}/diagnostico` : `${CONTENIDO_REDES_TIENDA.web} · despacho o retiro`);
  y += 30;
  y = contenidoRedesTexto(ctx, `📍 ${CONTENIDO_REDES_TIENDA.direccion}`, 80, y, W - 160, { tam: 40, peso: 400, color: claro ? '#475569' : '#a1a1aa', maxLineas: 1 });
  contenidoRedesTexto(ctx, CONTENIDO_REDES_TIENDA.entrada, 80, y + 8, W - 160, { tam: 42, peso: 700, color: tinta, maxLineas: 1 });
}

/* Las láminas del carrusel: portada, beneficios (o segunda foto), detalle, precio y sellos, cierre. */
function contenidoRedesLaminasCarrusel(e) {
  const laminas = [{ tipo: 'lamina', estilo: e.estilo, iFoto: e.iFoto }];
  if (e.beneficios.length) laminas.push({ tipo: 'lamina', estilo: 'beneficios', iFoto: (e.iFoto + 1) % Math.max(1, e.fotos.length) });
  if (e.fotos.length > 1) laminas.push({ tipo: 'lamina', estilo: e.estilo === 'minimalista' ? 'minimalista' : 'dinamico', iFoto: (e.iFoto + 2) % e.fotos.length, gancho: 'Míralo de cerca' });
  laminas.push({ tipo: 'lamina', estilo: e.estilo === 'precio' ? 'confianza' : 'precio', iFoto: e.iFoto, gancho: 'Precio Sevelin' });
  laminas.push({ tipo: 'cierre' });
  return laminas.slice(0, 5);
}

function contenidoRedesDibujarEn(canvas, e, lamina = null) {
  const f = contenidoRedesFormatoDe(e.formato);
  canvas.width = f.ancho;
  canvas.height = f.alto;
  const ctx = canvas.getContext('2d');
  if (lamina?.tipo === 'cierre') { contenidoRedesDibujarCierre(ctx, f.ancho, f.alto, e); return; }
  const variante = lamina ? { ...e, estilo: lamina.estilo || e.estilo, gancho: lamina.gancho || e.gancho } : e;
  contenidoRedesDibujarLamina(ctx, f.ancho, f.alto, variante, { iFoto: lamina?.iFoto ?? e.iFoto });
}

/* ---------- Variar sin repetir ---------- */

function contenidoRedesGanchosPara(p, estilo) {
  if (estilo === 'precio') return CONTENIDO_REDES_GANCHOS.precio;
  return contenidoRedesEsServicio(p) ? CONTENIDO_REDES_GANCHOS.servicio : CONTENIDO_REDES_GANCHOS.producto;
}

/* La combinación menos usada por este producto en el registro (estilo, frase y foto). */
function contenidoRedesElegirVariante(e, saltar = 0) {
  const usados = e.registro || [];
  const cuenta = (campo, valor) => usados.filter(r => r[campo] === valor).length;
  const estilos = CONTENIDO_REDES_ESTILOS.map(s => s.id).filter(s => s !== 'beneficios' || e.beneficios.length);
  const ordenEstilos = [...estilos].sort((x, y) => cuenta('estilo', x) - cuenta('estilo', y));
  const estilo = ordenEstilos[saltar % ordenEstilos.length];
  const ganchos = [...contenidoRedesGanchosPara(e.producto, estilo)].sort((x, y) => cuenta('gancho', x) - cuenta('gancho', y));
  return { estilo, gancho: ganchos[saltar % ganchos.length], iFoto: e.fotos.length ? saltar % e.fotos.length : 0 };
}

/* ---------- Modal del creador ---------- */

async function abrirContenidoRedes(productoOId) {
  const p = typeof productoOId === 'object' ? productoOId : (productsList || []).find(x => String(x.id) === String(productoOId));
  if (!p) { showToast('No encontré ese producto. Abre Productos una vez y vuelve a intentar.', 'err'); return; }
  if (!(p.imagen_urls || []).length) { showToast('Este producto no tiene fotos: sin foto no se puede armar contenido', 'err'); return; }
  const modal = document.getElementById('modalContenidoRedes');
  if (!modal) return;
  document.getElementById('contenidoRedesNombre').textContent = p.nombre || '';
  document.getElementById('contenidoRedesVista').innerHTML = '<p class="texto-apagado">Cargando las fotos…</p>';
  document.getElementById('contenidoRedesAviso').innerHTML = '';
  modal.classList.add('show');
  try {
    await contenidoRedesCargarLetras();
    const [fotos, registro] = await Promise.all([
      Promise.all((p.imagen_urls || []).slice(0, 4).map(u => contenidoRedesCargarFoto(u).catch(() => null))),
      API.redes.registro(30, p.id).then(r => r.piezas || []).catch(() => []),
    ]);
    contenidoRedesEstado = { producto: p, formato: 'post', fotos: fotos.filter(Boolean), registro, beneficios: contenidoRedesBeneficios(p), saltar: 0 };
    if (!contenidoRedesEstado.fotos.length) throw new Error('No se pudo cargar ninguna foto del producto');
    Object.assign(contenidoRedesEstado, contenidoRedesElegirVariante(contenidoRedesEstado, 0));
    contenidoRedesPintarControles();
    contenidoRedesPintarAviso();
    contenidoRedesPintarTexto();
    contenidoRedesRedibujar();
  } catch (err) {
    document.getElementById('contenidoRedesVista').innerHTML = `<p class="texto-error">${escHtml(err.message || 'No se pudo preparar el contenido')}</p>`;
  }
}

function cerrarContenidoRedes() {
  document.getElementById('modalContenidoRedes')?.classList.remove('show');
  contenidoRedesEstado = null;
}

function contenidoRedesPintarControles() {
  const e = contenidoRedesEstado;
  const chips = (lista, actual, attr) => lista.map(x => `
    <button type="button" class="entrega-tipo-btn contenido-redes-chip${x.id === actual ? ' activo' : ''}" data-${attr}="${x.id}"
      aria-pressed="${x.id === actual}" ${attr === 'estilo' && x.id === 'beneficios' && !e.beneficios.length ? 'disabled title="La ficha no tiene características (✅) que mostrar"' : ''}>
      <b>${escHtml(x.texto)}</b><small>${escHtml(x.detalle)}</small></button>`).join('');
  document.getElementById('contenidoRedesFormatos').innerHTML = chips(CONTENIDO_REDES_FORMATOS, e.formato, 'formato');
  document.getElementById('contenidoRedesEstilos').innerHTML = chips(CONTENIDO_REDES_ESTILOS, e.estilo, 'estilo');
  document.getElementById('contenidoRedesGancho').value = e.gancho || '';
  document.getElementById('contenidoRedesFotos').innerHTML = (e.producto.imagen_urls || []).slice(0, e.fotos.length).map((u, i) => `
    <button type="button" class="contenido-redes-foto${i === e.iFoto ? ' activo' : ''}" data-foto="${i}" aria-label="Usar la foto ${i + 1}"><img src="${escHtml(u)}" alt=""></button>`).join('');
  const boton = document.getElementById('btnContenidoRedesDescargar');
  if (boton) boton.textContent = e.formato === 'reel' ? '🎬 Grabar y descargar el reel' : e.formato === 'carrusel' ? '⬇️ Descargar las láminas (.zip)' : '⬇️ Descargar la imagen';
}

function contenidoRedesPintarAviso() {
  const e = contenidoRedesEstado;
  const el = document.getElementById('contenidoRedesAviso');
  if (!el || !e) return;
  const reg = e.registro || [];
  if (!reg.length) { el.innerHTML = '<span class="badge badge-green">Nuevo</span> No se ha promocionado en los últimos 30 días.'; return; }
  const ultima = reg[0];
  const dias = Math.floor((Date.now() - new Date(ultima.creado_en).getTime()) / 86400000);
  const reciente = dias < CONTENIDO_REDES_DIAS_REPETIDO;
  const formato = contenidoRedesFormatoDe(ultima.formato).texto.toLowerCase();
  const estilo = (CONTENIDO_REDES_ESTILOS.find(s => s.id === ultima.estilo)?.texto || ultima.estilo).toLowerCase();
  el.innerHTML = `<span class="badge ${reciente ? 'badge-gold' : 'badge-blue'}">${reg.length} en 30 días</span>
    La última fue ${dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`} (${escHtml(formato)}, ${escHtml(estilo)}${ultima.gancho ? `, "${escHtml(ultima.gancho)}"` : ''}).
    ${reciente ? '<b>Mostrado hace poco:</b> toca 🎲 Otra versión para cambiar el estilo, la frase y la foto.' : ''}`;
}

/* El texto para pegar: el de Instagram que ya está guardado en el producto (v139), o el que
   arma redes-texto.js desde la ficha. Si no hay descripción, solo los datos de contacto. */
function contenidoRedesPintarTexto() {
  const e = contenidoRedesEstado;
  const p = e.producto;
  const pr = contenidoRedesPrecio(p);
  let texto = p.instagram_texto || (typeof armarTextoInstagram === 'function' ? armarTextoInstagram(p) : '') || '';
  if (!texto) {
    texto = `${p.nombre}\n${pr.desde ? 'Desde ' : ''}${fmtCLP(pr.precio)}\n\n📲 WhatsApp ${CONTENIDO_REDES_TIENDA.whatsapp}\n📍 ${CONTENIDO_REDES_TIENDA.direccion} (${CONTENIDO_REDES_TIENDA.entrada.toLowerCase()})\n🌐 ${CONTENIDO_REDES_TIENDA.web}\n\n#Arica #AricaChile #Tecnología`;
  }
  document.getElementById('contenidoRedesTexto').value = texto;
}

function contenidoRedesRedibujar() {
  const e = contenidoRedesEstado;
  const vista = document.getElementById('contenidoRedesVista');
  if (!e || !vista) return;
  vista.innerHTML = '';
  vista.dataset.formato = e.formato;
  const laminas = e.formato === 'carrusel' ? contenidoRedesLaminasCarrusel(e) : e.formato === 'reel' ? [null, { tipo: 'cierre' }] : [null];
  laminas.forEach((l, i) => {
    const c = document.createElement('canvas');
    c.className = 'contenido-redes-canvas';
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', e.formato === 'reel' ? (i === 0 ? 'Cuadro principal del reel' : 'Cierre del reel') : `Lámina ${i + 1}`);
    contenidoRedesDibujarEn(c, e, l);
    vista.appendChild(c);
  });
  if (e.formato === 'reel') {
    const nota = document.createElement('p');
    nota.className = 'texto-apagado contenido-redes-nota';
    nota.textContent = 'El reel dura 12 segundos: la frase entra, aparece el producto pasando por sus fotos, el precio con un golpe y cierra con WhatsApp y la web. Sin música: se la pones en Instagram al subirlo.';
    vista.appendChild(nota);
  }
}

function contenidoRedesCambiar(campo, valor) {
  const e = contenidoRedesEstado;
  if (!e) return;
  if (campo === 'estilo' && valor !== e.estilo) {
    const usados = (e.registro || []).map(r => r.gancho);
    const lista = contenidoRedesGanchosPara(e.producto, valor);
    if (!lista.includes(e.gancho)) e.gancho = lista.find(g => !usados.includes(g)) || lista[0];
  }
  e[campo] = valor;
  contenidoRedesPintarControles();
  contenidoRedesRedibujar();
}

function contenidoRedesOtraVersion() {
  const e = contenidoRedesEstado;
  if (!e) return;
  e.saltar = (e.saltar || 0) + 1;
  Object.assign(e, contenidoRedesElegirVariante(e, e.saltar));
  contenidoRedesPintarControles();
  contenidoRedesRedibujar();
}

/* ---------- Descargar y registrar ---------- */

function contenidoRedesCanvasABlob(canvas) {
  return new Promise((ok, mal) => canvas.toBlob(b => (b ? ok(b) : mal(new Error('No se pudo armar la imagen'))), 'image/png'));
}

function contenidoRedesNombreArchivo(e, sufijo, ext) {
  const base = typeof slugArchivo === 'function' ? slugArchivo(e.producto.nombre) : 'producto';
  return `${base}-${e.formato}-${e.estilo}${sufijo ? `-${sufijo}` : ''}.${ext}`;
}

/* Graba el reel en tiempo real (12 s) desde un canvas: MP4 donde el navegador lo permite (Chrome
   reciente), si no WebM. */
async function contenidoRedesGrabarReel(e, alAvanzar) {
  const W = 1080, H = 1920, DURACION = 12000;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const tipos = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  const tipo = tipos.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
  if (!tipo) throw new Error('Este navegador no puede grabar video. Usa Chrome del computador.');
  const flujo = canvas.captureStream(30);
  const grabador = new MediaRecorder(flujo, { mimeType: tipo, videoBitsPerSecond: 8_000_000 });
  const trozos = [];
  grabador.ondataavailable = (ev) => { if (ev.data.size) trozos.push(ev.data); };
  const listo = new Promise(ok => { grabador.onstop = ok; });
  const cuadro = (ms) => {
    const t = ms / DURACION;
    if (t < 0.17) {
      /* Escena 1: la frase sola, entrando */
      const v = Math.min(1, t / 0.08);
      const claro = e.estilo === 'minimalista';
      if (claro) { ctx.fillStyle = '#f3f4f6'; ctx.fillRect(0, 0, W, H); } else contenidoRedesFondoOscuro(ctx, W, H, t);
      contenidoRedesLogo(ctx, W / 2, 140, 54, !claro);
      ctx.save();
      ctx.globalAlpha = v * (t > 0.14 ? Math.max(0, 1 - (t - 0.14) / 0.03) : 1);
      ctx.translate(W / 2, H / 2);
      const s = 0.7 + 0.3 * (1 - Math.pow(1 - v, 3));
      ctx.scale(s, s);
      contenidoRedesTexto(ctx, String(e.gancho).toUpperCase(), -470, -160, 940, { tam: 130, peso: 700, color: claro ? '#0f172a' : '#ffffff', maxLineas: 3, interlineado: 1.0, sombra: claro ? null : 'rgba(59,130,246,0.9)' });
      ctx.restore();
    } else if (t < 0.74) {
      /* Escena 2: la lámina del estilo, animada, pasando por las fotos */
      const a = Math.min(1, (t - 0.17) / 0.4);
      const iFoto = e.fotos.length ? (e.iFoto + Math.floor((t - 0.17) / 0.14)) % e.fotos.length : 0;
      ctx.clearRect(0, 0, W, H);
      contenidoRedesDibujarLamina(ctx, W, H, e, { a, iFoto });
    } else {
      /* Escena 3: cierre */
      ctx.clearRect(0, 0, W, H);
      contenidoRedesDibujarCierre(ctx, W, H, e, Math.min(1, (t - 0.74) / 0.2));
    }
  };
  cuadro(0);
  grabador.start(250);
  const inicio = performance.now();
  await new Promise(ok => {
    const paso = () => {
      const ms = performance.now() - inicio;
      cuadro(Math.min(ms, DURACION));
      alAvanzar?.(Math.min(1, ms / DURACION));
      if (ms < DURACION) requestAnimationFrame(paso); else ok();
    };
    requestAnimationFrame(paso);
  });
  grabador.stop();
  await listo;
  flujo.getTracks().forEach(tr => tr.stop());
  return { blob: new Blob(trozos, { type: tipo.split(';')[0] }), ext: tipo.startsWith('video/mp4') ? 'mp4' : 'webm' };
}

async function contenidoRedesDescargar() {
  const e = contenidoRedesEstado;
  if (!e) return;
  const boton = document.getElementById('btnContenidoRedesDescargar');
  const textoBoton = boton?.textContent;
  if (boton) boton.disabled = true;
  try {
    if (e.formato === 'reel') {
      const { blob, ext } = await contenidoRedesGrabarReel(e, (v) => { if (boton) boton.textContent = `🎬 Grabando… ${Math.round(v * 100)}%`; });
      dispararDescargaBlob(blob, contenidoRedesNombreArchivo(e, '', ext));
      if (ext !== 'mp4') showToast('Este navegador grabó el reel en WebM. Si Instagram no lo acepta, súbelo desde Meta Business Suite en el computador.', 'err');
    } else if (e.formato === 'carrusel') {
      const laminas = contenidoRedesLaminasCarrusel(e);
      const archivos = [];
      for (let i = 0; i < laminas.length; i++) {
        const c = document.createElement('canvas');
        contenidoRedesDibujarEn(c, e, laminas[i]);
        archivos.push({ nombre: contenidoRedesNombreArchivo(e, String(i + 1), 'png'), blob: await contenidoRedesCanvasABlob(c) });
      }
      await entregarVariasFotos(null, '', archivos, contenidoRedesNombreArchivo(e, 'laminas', 'zip'));
    } else {
      const c = document.createElement('canvas');
      contenidoRedesDibujarEn(c, e, null);
      dispararDescargaBlob(await contenidoRedesCanvasABlob(c), contenidoRedesNombreArchivo(e, '', 'png'));
    }
    /* Queda en el registro como "generado"; se marca publicado desde el panel */
    const fila = await API.redes.registrar({ producto_id: e.producto.id, formato: e.formato, estilo: e.estilo, gancho: e.gancho });
    e.registro = [fila, ...(e.registro || [])];
    contenidoRedesPintarAviso();
    showToast('Listo: quedó en el registro de Redes. Márcalo como publicado cuando lo subas.', 'ok');
    if (document.getElementById('view-redes')?.classList.contains('active')) cargarPanelRedes();
  } catch (err) {
    showToast(err.message || 'No se pudo descargar', 'err');
  } finally {
    if (boton) { boton.disabled = false; boton.textContent = textoBoton; }
  }
}

async function contenidoRedesCopiarTexto() {
  const el = document.getElementById('contenidoRedesTexto');
  if (!el) return;
  try { await navigator.clipboard.writeText(el.value); showToast('Texto copiado', 'ok'); }
  catch (_) { el.select(); showToast('Selecciónalo y cópialo con Ctrl+C', 'err'); }
}

/* ---------- Panel "Redes sociales" ---------- */

async function cargarPanelRedes() {
  const resumen = document.getElementById('redesResumen');
  const tabla = document.getElementById('redesRegistroBody');
  const sugeridos = document.getElementById('redesSugeridos');
  if (resumen) resumen.innerHTML = '<span class="texto-apagado">Cargando…</span>';
  if (!Array.isArray(productsList) || !productsList.length) {
    try { productsList = await API.productos.listar(); } catch (_) { /* el buscador avisa */ }
  }
  try {
    const [reg, sug] = await Promise.all([API.redes.registro(30), API.redes.sugeridos().catch(() => ({ productos: [] }))]);
    contenidoRedesRegistroCache = reg.piezas || [];
    contenidoRedesPintarResumen(resumen);
    contenidoRedesPintarRegistro(tabla);
    contenidoRedesPintarSugeridos(sugeridos, sug.productos || []);
  } catch (err) {
    if (resumen) resumen.innerHTML = `<span class="texto-error">${escHtml(err.message || 'No se pudo cargar el registro')}</span>`;
  }
}

function contenidoRedesPintarResumen(el) {
  if (!el) return;
  const reg = contenidoRedesRegistroCache;
  const hace = (d) => Date.now() - d * 86400000;
  const en = (d) => reg.filter(r => new Date(r.creado_en).getTime() >= hace(d));
  const distintos = (lista) => { const n = new Set(lista.map(r => r.producto_id)).size; return `${n} ${n === 1 ? 'producto' : 'productos'}`; };
  const porProducto = new Map();
  en(CONTENIDO_REDES_DIAS_REPETIDO).forEach(r => porProducto.set(r.producto_id, (porProducto.get(r.producto_id) || 0) + 1));
  const repetidos = [...porProducto.values()].filter(n => n >= 2).length;
  const publicadas = reg.filter(r => r.estado === 'publicado').length;
  el.innerHTML = `
    <div class="redes-cifra"><b>${en(7).length}</b><span>${en(7).length === 1 ? 'pieza' : 'piezas'} en 7 días · ${distintos(en(7))}</span></div>
    <div class="redes-cifra"><b>${reg.length}</b><span>${reg.length === 1 ? 'pieza' : 'piezas'} en 30 días · ${distintos(reg)}</span></div>
    <div class="redes-cifra"><b>${publicadas}</b><span>marcadas como publicadas</span></div>
    <div class="redes-cifra${repetidos ? ' redes-cifra-alerta' : ''}"><b>${repetidos}</b><span>productos repetidos en ${CONTENIDO_REDES_DIAS_REPETIDO} días</span></div>`;
}

function contenidoRedesPintarRegistro(tbody) {
  if (!tbody) return;
  const reg = contenidoRedesRegistroCache;
  if (!reg.length) { tbody.innerHTML = '<tr><td colspan="6" class="texto-apagado">Todavía no hay piezas. Elige un producto de arriba y crea la primera.</td></tr>'; return; }
  const texto = (lista, id) => lista.find(x => x.id === id)?.texto || id;
  tbody.innerHTML = reg.map(r => {
    const fecha = new Date(r.creado_en).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
    const red = (n, etiqueta) => `<button type="button" class="btn btn-sm ${r.redes?.includes(n) ? 'btn-primary' : 'btn-outline'}" data-redes-marcar="${r.id}" data-red="${n}" aria-pressed="${!!r.redes?.includes(n)}">${etiqueta}</button>`;
    return `<tr>
      <td>${escHtml(fecha)}</td>
      <td><button type="button" class="link-boton" data-redes-crear="${r.producto_id ?? ''}">${escHtml(r.producto_nombre)}</button></td>
      <td>${escHtml(texto(CONTENIDO_REDES_FORMATOS, r.formato))}</td>
      <td>${escHtml(texto(CONTENIDO_REDES_ESTILOS, r.estilo))}${r.gancho ? `<br><small class="texto-apagado">"${escHtml(r.gancho)}"</small>` : ''}</td>
      <td>${r.estado === 'publicado' ? `<span class="badge badge-green">Publicado ${escHtml(r.publicado_en ? String(r.publicado_en).slice(8, 10) + '-' + String(r.publicado_en).slice(5, 7) : '')}</span>` : '<span class="badge badge-gold">Descargado</span>'}</td>
      <td class="redes-acciones">${red('instagram', 'IG')} ${red('facebook', 'FB')}</td>
    </tr>`;
  }).join('');
}

function contenidoRedesPintarSugeridos(el, lista) {
  if (!el) return;
  if (!lista.length) { el.innerHTML = '<p class="texto-apagado">No hay sugeridos: todo lo que tiene foto y stock ya se mostró en los últimos 14 días.</p>'; return; }
  el.innerHTML = lista.map(p => `
    <button type="button" class="redes-sugerido" data-redes-crear="${p.id}">
      <img src="${escHtml(p.foto)}" alt="" loading="lazy">
      <span class="redes-sugerido-nombre">${escHtml(p.nombre)}</span>
      <span class="redes-sugerido-dato">${p.motivo ? escHtml(p.motivo.replace(/_/g, ' ')) + ' · ' : ''}${p.es_servicio ? 'Servicio · ' : ''}${fmtCLP(p.precio)}</span>
    </button>`).join('');
}

function contenidoRedesBuscar(texto) {
  const el = document.getElementById('redesResultados');
  if (!el) return;
  const q = String(texto || '').trim().toLowerCase();
  if (q.length < 2) { el.innerHTML = ''; return; }
  const lista = (productsList || []).filter(p => !p.archivado && (p.imagen_urls || []).length && String(p.nombre || '').toLowerCase().includes(q)).slice(0, 8);
  el.innerHTML = lista.length
    ? lista.map(p => `<button type="button" class="redes-resultado" data-redes-crear="${p.id}"><img src="${escHtml(p.imagen_urls[0])}" alt="" loading="lazy"><span>${escHtml(p.nombre)}</span><b>${fmtCLP(contenidoRedesPrecio(p).precio)}</b></button>`).join('')
    : '<p class="texto-apagado">Nada con foto que se llame así.</p>';
}

async function contenidoRedesMarcar(id, red) {
  const fila = contenidoRedesRegistroCache.find(r => String(r.id) === String(id));
  if (!fila) return;
  const redes = new Set(fila.redes || []);
  if (redes.has(red)) redes.delete(red); else redes.add(red);
  try {
    const nueva = await API.redes.marcar(id, { redes: [...redes] });
    Object.assign(fila, nueva);
    contenidoRedesPintarResumen(document.getElementById('redesResumen'));
    contenidoRedesPintarRegistro(document.getElementById('redesRegistroBody'));
  } catch (err) {
    showToast(err.message || 'No se pudo marcar', 'err');
  }
}

/* Botón de la fila de Productos (al lado del de Facebook) */
function botonContenidoRedesDeFila(p) {
  return (p.imagen_urls || []).length
    ? `<button class="btn btn-icon btn-icon-view" data-contenido-redes="${p.id}" title="Redes: crear historia, post, carrusel o reel">📣</button>`
    : '';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnCerrarContenidoRedes')?.addEventListener('click', cerrarContenidoRedes);
  document.getElementById('modalContenidoRedes')?.addEventListener('click', (ev) => { if (ev.target.id === 'modalContenidoRedes') cerrarContenidoRedes(); });
  document.getElementById('btnContenidoRedesOtra')?.addEventListener('click', contenidoRedesOtraVersion);
  document.getElementById('btnContenidoRedesDescargar')?.addEventListener('click', contenidoRedesDescargar);
  document.getElementById('btnContenidoRedesCopiar')?.addEventListener('click', contenidoRedesCopiarTexto);
  document.getElementById('contenidoRedesGancho')?.addEventListener('input', (ev) => {
    if (!contenidoRedesEstado) return;
    contenidoRedesEstado.gancho = ev.target.value.slice(0, 60);
    contenidoRedesRedibujar();
  });
  document.getElementById('contenidoRedesFormatos')?.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-formato]'); if (b) contenidoRedesCambiar('formato', b.dataset.formato);
  });
  document.getElementById('contenidoRedesEstilos')?.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-estilo]'); if (b && !b.disabled) contenidoRedesCambiar('estilo', b.dataset.estilo);
  });
  document.getElementById('contenidoRedesFotos')?.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-foto]'); if (b) contenidoRedesCambiar('iFoto', Number(b.dataset.foto));
  });
  document.getElementById('redesBuscar')?.addEventListener('input', (ev) => contenidoRedesBuscar(ev.target.value));
  document.getElementById('btnRedesRecargar')?.addEventListener('click', cargarPanelRedes);
  /* Delegado: "crear" desde sugeridos, buscador, registro y la fila de Productos; marcar IG/FB */
  document.addEventListener('click', (ev) => {
    const crear = ev.target.closest('[data-redes-crear], [data-contenido-redes]');
    if (crear) {
      const id = crear.dataset.redesCrear || crear.dataset.contenidoRedes;
      if (id) abrirContenidoRedes(id);
      return;
    }
    const marcar = ev.target.closest('[data-redes-marcar]');
    if (marcar) contenidoRedesMarcar(marcar.dataset.redesMarcar, marcar.dataset.red);
  });
});
