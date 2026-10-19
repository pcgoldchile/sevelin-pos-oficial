// ==========================================
// PLAN-CONTENIDO.JS — Plan de contenido y aviso del robot (v168, sql/107)
// ------------------------------------------
// Dueño, 19-10-2026: "dame una notificación para saber cuándo dejar encendido el PC, y calendario
// de cómo vamos con el contenido… con fases… que resalte de las demás… para revisar y aprobar".
//   · Encabezado: "📅 Contenido" (resaltado; late cuando hay algo para aprobar o el robot corre hoy).
//   · Redes sociales → Plan de contenido: cuándo corre el robot, las fases y el calendario por día,
//     con Aprobar / Pedir cambios / Descartar / Programado / Publicado, y "➕ Pedir una pieza".
// Todas las funciones empiezan con "planContenido" (salvo cargarPlanContenido, la de la vista).
// ==========================================

const PLAN_CONTENIDO_FASES = [
  { id: 'idea', texto: '💡 Idea' },
  { id: 'preparando', texto: '🛠️ Preparando' },
  { id: 'para_aprobar', texto: '👀 Para aprobar' },
  { id: 'aprobado', texto: '✅ Aprobado' },
  { id: 'programado', texto: '🗓️ Programado' },
  { id: 'publicado', texto: '🚀 Publicado' },
];
const PLAN_CONTENIDO_TIPOS = { producto: 'Producto', servicio: 'Servicio', educativo: 'Educativo', noticia: 'Noticia', tienda: 'La tienda' };
const PLAN_CONTENIDO_FORMATOS = { historia: 'Historia', post: 'Post', carrusel: 'Carrusel', reel: 'Reel', wow: '🎬 Video wow' };
let planContenidoCache = null;
let planContenidoIntervalo = null;

document.addEventListener('pos:sesion-iniciada', () => {
  if (planContenidoIntervalo) { clearInterval(planContenidoIntervalo); planContenidoIntervalo = null; }
  if (!esAdmin()) return;
  planContenidoActualizarAviso();
  planContenidoIntervalo = setInterval(planContenidoActualizarAviso, 30 * 60 * 1000);
});

function planContenidoFechaRobot(robot) {
  if (!robot?.proxima_corrida) return null;
  const d = new Date(robot.proxima_corrida);
  return isNaN(d.getTime()) ? null : d;
}

async function planContenidoActualizarAviso() {
  const btn = document.getElementById('btnAvisoContenido');
  const texto = document.getElementById('textoAvisoContenido');
  if (!btn || !texto || !tokenActual() || !esAdmin()) return;
  try {
    const a = await API.contenido.aviso();
    const proxima = planContenidoFechaRobot(a.robot);
    const hoy = proxima && proxima.toDateString() === new Date().toDateString();
    const partes = ['📅 Contenido'];
    if (a.para_aprobar) partes.push(`${a.para_aprobar} para aprobar`);
    if (proxima) partes.push(hoy ? `PC encendido hoy ${proxima.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}` : `PC: ${proxima.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric' })} ${proxima.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`);
    texto.textContent = partes.join(' · ');
    btn.title = a.robot?.ventana_texto ? `Deja el PC encendido: ${a.robot.ventana_texto}` : 'Plan de contenido para redes';
    btn.classList.toggle('urgente', !!a.para_aprobar || !!hoy);
    btn.hidden = false;
  } catch (_) { /* sin aviso si el servidor no responde */ }
}

async function cargarPlanContenido() {
  const dias = document.getElementById('planDias');
  if (!dias) return;
  dias.innerHTML = '<p class="plan-vacio">Cargando el plan…</p>';
  try {
    planContenidoCache = await API.contenido.plan();
    planContenidoPintar();
  } catch (err) {
    dias.innerHTML = `<p class="texto-error">${escHtml(err.message || 'No se pudo cargar el plan')}</p>`;
  }
}

function planContenidoPintar() {
  const d = planContenidoCache;
  if (!d) return;
  const r = d.robot || {};
  const proxima = planContenidoFechaRobot(r);
  document.getElementById('planRobot').innerHTML = `
    <div>🖥️ <b>Deja el PC de la tienda encendido:</b> <b class="plan-ventana">${escHtml(r.ventana_texto || 'todavía sin programar')}</b></div>
    ${proxima ? `<div>Próxima corrida del robot: ${escHtml(proxima.toLocaleString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }))}</div>` : ''}
    ${r.ultima_corrida ? `<div class="texto-apagado">Última vez: ${escHtml(new Date(r.ultima_corrida).toLocaleString('es-CL', { hourCycle: 'h23', dateStyle: 'short', timeStyle: 'short' }))}${r.ultimo_resumen ? ` · ${escHtml(r.ultimo_resumen)}` : ''}</div>` : ''}
    ${r.uso_claude ? `<div class="texto-apagado">Uso de Claude: ${escHtml(r.uso_claude)}</div>` : ''}`;
  const resumen = d.resumen || {};
  document.getElementById('planFases').innerHTML = PLAN_CONTENIDO_FASES.map(f =>
    `<li class="${resumen[f.id] ? 'activa' : ''}">${f.texto}<b>${resumen[f.id] || 0}</b></li>`).join('');

  const porDia = new Map();
  (d.piezas || []).filter(p => p.estado !== 'descartado').forEach(p => {
    if (!porDia.has(p.fecha)) porDia.set(p.fecha, []);
    porDia.get(p.fecha).push(p);
  });
  const hoy = todayISO();
  const html = [...porDia.entries()].map(([fecha, piezas]) => {
    const f = new Date(`${fecha}T12:00:00`);
    const nombre = fecha === hoy ? 'Hoy' : f.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
    return `<section class="plan-dia"><h4>${escHtml(nombre)}<small>${piezas.length} ${piezas.length === 1 ? 'pieza' : 'piezas'}</small></h4>
      <div class="plan-piezas">${piezas.map(planContenidoTarjeta).join('')}</div></section>`;
  }).join('');
  document.getElementById('planDias').innerHTML = html || '<p class="plan-vacio">Todavía no hay nada en el calendario. El robot lo llena en su próxima corrida, o pide algo con "➕ Pedir una pieza".</p>';
}

function planContenidoTarjeta(p) {
  const fase = PLAN_CONTENIDO_FASES.find(f => f.id === p.estado)?.texto || p.estado;
  const medios = (Array.isArray(p.archivos) ? p.archivos : []).map(a => /\.(mp4|webm|mov)$/i.test(a.url || '')
    ? `<video src="${escHtml(a.url)}" controls muted playsinline preload="metadata"></video>`
    : `<a href="${escHtml(a.url)}" target="_blank" rel="noopener"><img src="${escHtml(a.url)}" alt="" loading="lazy"></a>`).join('');
  const fuentes = (Array.isArray(p.fuentes) ? p.fuentes : []).map(f => `<a href="${escHtml(f.url)}" target="_blank" rel="noopener">${escHtml(f.titulo || 'Fuente')}</a>`).join(' · ');
  const boton = (accion, texto, clase = 'btn-outline') => `<button type="button" class="btn btn-sm ${clase}" data-plan-accion="${accion}" data-plan-id="${p.id}">${texto}</button>`;
  let acciones = '';
  if (p.estado === 'para_aprobar') acciones = boton('aprobar', '✅ Aprobar', 'btn-primary') + boton('cambios', '✏️ Pedir cambios') + boton('descartar', 'Descartar');
  else if (p.estado === 'aprobado') acciones = boton('programado', '🗓️ Ya está programado') + boton('publicado', '🚀 Ya se publicó');
  else if (p.estado === 'programado') acciones = boton('publicado', '🚀 Ya se publicó');
  else if (p.estado === 'idea' || p.estado === 'preparando') acciones = boton('descartar', 'Descartar');
  return `<article class="plan-pieza ${escHtml(p.estado)}">
    <div><span class="badge badge-blue">${escHtml(PLAN_CONTENIDO_FORMATOS[p.formato] || p.formato)}</span> <span class="badge">${escHtml(PLAN_CONTENIDO_TIPOS[p.tipo] || p.tipo)}</span> <span class="badge badge-gold">${escHtml(fase)}</span></div>
    <div class="plan-pieza-tema">${escHtml(p.tema)}</div>
    ${medios ? `<div class="plan-pieza-medios">${medios}</div>` : ''}
    ${p.texto ? `<div class="plan-pieza-texto">${escHtml(p.texto)}</div>` : ''}
    ${fuentes ? `<div class="texto-apagado" style="font-size:12px">Fuentes: ${fuentes}</div>` : ''}
    ${p.nota_dueno ? `<div class="texto-apagado" style="font-size:12px">📝 ${escHtml(p.nota_dueno)}</div>` : ''}
    ${acciones ? `<div class="plan-pieza-acciones">${acciones}</div>` : ''}
  </article>`;
}

async function planContenidoAccion(id, accion) {
  let nota = null;
  if (accion === 'cambios') {
    const campo = document.createElement('input');
    /* Sin prompt(): se usa un campo dentro de la tarjeta */
    const tarjeta = document.querySelector(`[data-plan-id="${id}"]`)?.closest('.plan-pieza');
    if (tarjeta && !tarjeta.querySelector('.plan-nota')) {
      campo.className = 'campo-pos plan-nota';
      campo.placeholder = '¿Qué le cambio? (Enter para enviar)';
      campo.maxLength = 500;
      tarjeta.appendChild(campo);
      campo.focus();
      campo.addEventListener('keydown', async (ev) => {
        if (ev.key !== 'Enter' || !campo.value.trim()) return;
        await planContenidoEnviar(id, 'cambios', campo.value.trim());
      });
    }
    return;
  }
  await planContenidoEnviar(id, accion, nota);
}

async function planContenidoEnviar(id, accion, nota) {
  try {
    await API.contenido.accion(id, accion, nota);
    showToast(accion === 'aprobar' ? 'Aprobada: el robot la deja programada' : accion === 'cambios' ? 'Listo: el robot la rehace con tu nota' : 'Listo', 'ok');
    await cargarPlanContenido();
    planContenidoActualizarAviso();
  } catch (err) {
    showToast(err.message || 'No se pudo', 'err');
  }
}

async function planContenidoPedir() {
  try {
    await API.contenido.pedir({
      formato: document.getElementById('planPedirFormato').value,
      tipo: document.getElementById('planPedirTipo').value,
      fecha: document.getElementById('planPedirFecha').value || null,
      tema: document.getElementById('planPedirTema').value,
      nota: document.getElementById('planPedirNota').value,
    });
    document.getElementById('planPedir').hidden = true;
    ['planPedirTema', 'planPedirNota'].forEach(i => { document.getElementById(i).value = ''; });
    showToast('Pedido: el robot lo arma en su próxima corrida', 'ok');
    await cargarPlanContenido();
    planContenidoActualizarAviso();
  } catch (err) {
    showToast(err.message || 'No se pudo pedir', 'err');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnAvisoContenido')?.addEventListener('click', () => {
    if (typeof activarVista === 'function') activarVista('view-redes');
    setTimeout(() => document.getElementById('planContenidoCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
  });
  document.getElementById('btnPlanPedir')?.addEventListener('click', () => {
    const caja = document.getElementById('planPedir');
    caja.hidden = !caja.hidden;
    if (!caja.hidden) { document.getElementById('planPedirFecha').value = todayISO(); document.getElementById('planPedirTema').focus(); }
  });
  document.getElementById('btnPlanPedirCancelar')?.addEventListener('click', () => { document.getElementById('planPedir').hidden = true; });
  document.getElementById('btnPlanPedirGuardar')?.addEventListener('click', planContenidoPedir);
  document.getElementById('planDias')?.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-plan-accion]');
    if (b) planContenidoAccion(b.dataset.planId, b.dataset.planAccion);
  });
});
