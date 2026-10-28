/* ============================================================
   🕒 HORARIO DE ATENCIÓN (28-10-2026, pedido del dueño)
   ------------------------------------------------------------
   El dueño cambia el horario aquí y sevelin.cl lo muestra solo (pie de página, contacto,
   preguntas frecuentes, checkout, correos y avisos de retiro). Lo que no se puede cambiar
   desde el código va en "Dónde más cambiarlo", con la fecha en que marcó cada lugar.
   Servidor: GET/PUT /api/horario y PUT /api/horario/verificado (api/index.js).
   ============================================================ */

const CANALES_HORARIO_POS = [
  { id: 'google', nombre: 'Google (Maps y búsqueda)', url: 'https://www.google.com/search?q=Sevelin+Arica',
    pasos: 'Abre el link → en "Tu negocio en Google" toca "Editar perfil" → "Horario" → cambia y guarda.' },
  { id: 'facebook', nombre: 'Página de Facebook', url: 'https://www.facebook.com/',
    pasos: 'Cambia a tu Página "Sevelin Arica" → Configuración → Información de la página → Horario.' },
  { id: 'instagram', nombre: 'Instagram @sevelin.cl', url: 'https://www.instagram.com/sevelin.cl/',
    pasos: 'Editar perfil → Biografía: pega el texto corto de abajo.' },
  { id: 'whatsapp', nombre: 'WhatsApp Business', url: '',
    pasos: 'En el celular: Herramientas para la empresa → Perfil de empresa → Horario. Revisa también el mensaje de ausencia.' },
  { id: 'impresos', nombre: 'Carteles y tarjetas impresas', url: '',
    pasos: 'Cartel de la puerta y tarjetas de presentación: si dicen otro horario, se reimprimen.' }
];

let datosHorario = null;   // lo que devolvió GET /api/horario

const dosDigitosHorario = (h) => `${String(h).padStart(2, '0')}:00`;

function textoHorarioLargo(h) {
  const partes = h.tramos.map(t => `de ${dosDigitosHorario(t.desde)} a ${dosDigitosHorario(t.hasta)}`);
  const unidos = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}` : partes[0] || '';
  return `${h.dias}, ${unidos}`;
}

function textoHorarioCorto(h) {
  const dias = h.dias.replace(/lunes/i, 'Lun').replace(/domingo/i, 'dom').replace(/sábado|sabado/i, 'sáb').replace(/viernes/i, 'vie');
  return `🕒 ${dias}: ${h.tramos.map(t => `${dosDigitosHorario(t.desde)}–${dosDigitosHorario(t.hasta)}`).join(' y ')}`;
}

function opcionesHoraHorario(sel) {
  let html = '';
  for (let i = 0; i <= 24; i++) html += `<option value="${i}"${i === sel ? ' selected' : ''}>${dosDigitosHorario(i)}</option>`;
  return html;
}

/* Lo que está escrito ahora en el formulario (sin validar). */
function horarioDelFormulario() {
  const filas = [...document.querySelectorAll('#horarioTramos .horario-tramo')];
  return {
    tramos: filas.map(f => ({ desde: Number(f.querySelector('[data-desde]').value), hasta: Number(f.querySelector('[data-hasta]').value) })),
    dias: document.getElementById('horarioDias').value.trim(),
    aviso_domingo: document.getElementById('horarioAvisoDomingo').value.trim()
  };
}

/* Mismas reglas que el servidor: devuelve el error en palabras o '' si está bien. */
function errorHorario(h) {
  if (!h.tramos.length) return 'Agrega al menos un tramo.';
  let ultimo = -1;
  for (const [i, t] of h.tramos.entries()) {
    if (t.desde >= t.hasta) return `El tramo ${i + 1} termina antes de empezar.`;
    if (t.desde < ultimo) return `El tramo ${i + 1} se cruza con el anterior.`;
    ultimo = t.hasta;
  }
  if (!h.dias) return 'Escribe qué días atiendes (por ejemplo "Lunes a domingo").';
  return '';
}

function pintarTramosHorario(tramos) {
  const caja = document.getElementById('horarioTramos');
  caja.innerHTML = tramos.map((t, i) => `
    <div class="horario-tramo">
      <span class="horario-tramo-n">${i === 0 ? 'Abre' : 'Vuelve'}</span>
      <select data-desde aria-label="Desde, tramo ${i + 1}">${opcionesHoraHorario(t.desde)}</select>
      <span>a</span>
      <select data-hasta aria-label="Hasta, tramo ${i + 1}">${opcionesHoraHorario(t.hasta)}</select>
      ${tramos.length > 1 ? `<button type="button" class="btn btn-ghost btn-sm" data-quitar-tramo="${i}" title="Quitar este tramo">✕</button>` : ''}
    </div>`).join('');
  caja.querySelectorAll('select').forEach(s => s.addEventListener('change', pintarVistaHorario));
  caja.querySelectorAll('[data-quitar-tramo]').forEach(b => b.addEventListener('click', () => {
    const h = horarioDelFormulario();
    h.tramos.splice(Number(b.dataset.quitarTramo), 1);
    pintarTramosHorario(h.tramos);
    pintarVistaHorario();
  }));
  document.getElementById('btnHorarioAgregarTramo').hidden = tramos.length >= 3;
}

function pintarVistaHorario() {
  const h = horarioDelFormulario();
  const err = errorHorario(h);
  document.getElementById('horarioVista').innerHTML = err
    ? `<span class="horario-error">⚠️ ${escHtml(err)}</span>`
    : `<b>${escHtml(textoHorarioLargo(h))}</b><br><small>${escHtml(textoHorarioCorto(h))}</small>`;
  document.getElementById('btnHorarioGuardar').disabled = !!err;
}

function pintarCanalesHorario() {
  const v = datosHorario?.verificado || {};
  const h = datosHorario?.horario;
  const corto = h ? textoHorarioCorto(h) : '';
  const largo = h ? textoHorarioLargo(h) : '';
  document.getElementById('horarioCanales').innerHTML = `
    <div class="horario-canal hecho">
      <div><b>✅ Página web sevelin.cl</b><small>Se actualiza sola al guardar${datosHorario?.guardado_en ? ` · guardado el ${escHtml(new Date(datosHorario.guardado_en).toLocaleString('es-CL', { timeZone: 'America/Santiago' }))}` : ''}.</small></div>
    </div>
    ${CANALES_HORARIO_POS.map(c => `
      <div class="horario-canal${v[c.id] ? ' hecho' : ''}">
        <div>
          <b>${v[c.id] ? '✅' : '⏳'} ${escHtml(c.nombre)}</b>
          <small>${escHtml(c.pasos)}</small>
          <small class="horario-canal-estado">${v[c.id] ? `Lo marcaste el ${escHtml(v[c.id])}` : 'Falta cambiarlo'}</small>
        </div>
        <div class="horario-canal-botones">
          ${c.url ? `<a class="btn btn-outline btn-sm" href="${escHtml(c.url)}" target="_blank" rel="noopener noreferrer">Abrir</a>` : ''}
          <button type="button" class="btn btn-sm ${v[c.id] ? 'btn-ghost' : 'btn-primary'}" data-canal-horario="${escHtml(c.id)}" data-hecho="${v[c.id] ? '0' : '1'}">${v[c.id] ? 'Desmarcar' : '✓ Ya lo cambié'}</button>
        </div>
      </div>`).join('')}
    <div class="horario-copiar">
      <button type="button" class="btn btn-outline btn-sm" data-copiar-horario="${escHtml(largo)}">📋 Copiar texto largo</button>
      <button type="button" class="btn btn-outline btn-sm" data-copiar-horario="${escHtml(corto)}">📋 Copiar texto corto (Instagram)</button>
    </div>`;
  document.querySelectorAll('[data-canal-horario]').forEach(b => b.addEventListener('click', () => marcarCanalHorario(b.dataset.canalHorario, b.dataset.hecho === '1')));
  document.querySelectorAll('[data-copiar-horario]').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copiarHorario); showToast('Copiado', 'ok'); }
    catch (_) { showToast(b.dataset.copiarHorario, 'info'); }
  }));
}

async function abrirHorario() {
  if (typeof esAdmin === 'function' && !esAdmin()) return;
  const modal = document.getElementById('modalHorario');
  modal.classList.add('show');
  document.getElementById('horarioVista').textContent = 'Cargando…';
  try {
    datosHorario = await API.horario.leer();
  } catch (err) {
    showToast(err.message || 'No se pudo leer el horario de la tienda', 'err');
    return;
  }
  const h = datosHorario.horario;
  pintarTramosHorario(h.tramos);
  document.getElementById('horarioDias').value = h.dias;
  document.getElementById('horarioAvisoDomingo').value = h.aviso_domingo || '';
  pintarVistaHorario();
  pintarCanalesHorario();
}

async function guardarHorario() {
  const h = horarioDelFormulario();
  const err = errorHorario(h);
  if (err) { showToast(err, 'err'); return; }
  const btn = document.getElementById('btnHorarioGuardar');
  btn.disabled = true;
  try {
    await API.horario.guardar(h);
    showToast('Horario guardado: sevelin.cl ya lo muestra. Ahora cámbialo en los lugares de la lista.', 'ok');
    datosHorario = await API.horario.leer();
    pintarCanalesHorario();
  } catch (e) {
    showToast(e.message || 'No se pudo guardar el horario', 'err');
  } finally {
    btn.disabled = false;
  }
}

async function marcarCanalHorario(canal, hecho) {
  try {
    const r = await API.horario.marcar(canal, hecho);
    datosHorario.verificado = r.verificado || {};
    pintarCanalesHorario();
  } catch (e) {
    showToast(e.message || 'No se pudo marcar', 'err');
  }
}

function cerrarHorario() {
  document.getElementById('modalHorario')?.classList.remove('show');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnHorario')?.addEventListener('click', abrirHorario);
  document.getElementById('btnHorarioGuardar')?.addEventListener('click', guardarHorario);
  document.getElementById('btnHorarioCerrar')?.addEventListener('click', cerrarHorario);
  document.getElementById('btnHorarioAgregarTramo')?.addEventListener('click', () => {
    const h = horarioDelFormulario();
    const ultimo = h.tramos[h.tramos.length - 1];
    h.tramos.push({ desde: Math.min(23, (ultimo?.hasta ?? 9) + 1), hasta: Math.min(24, (ultimo?.hasta ?? 9) + 3) });
    pintarTramosHorario(h.tramos);
    pintarVistaHorario();
  });
  ['horarioDias', 'horarioAvisoDomingo'].forEach(id => document.getElementById(id)?.addEventListener('input', pintarVistaHorario));
  document.getElementById('modalHorario')?.addEventListener('click', (e) => { if (e.target.id === 'modalHorario') cerrarHorario(); });
});

document.addEventListener('pos:sesion-iniciada', (e) => {
  const chip = document.getElementById('btnHorario');
  if (chip) chip.hidden = e.detail?.rol !== 'admin';
});
