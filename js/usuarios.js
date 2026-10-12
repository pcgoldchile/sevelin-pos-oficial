// ==========================================
// USUARIOS.JS — Quién entra y con qué PIN (v135, sql/92)
// ------------------------------------------
// Cada persona tiene su RUT y su PIN. Solo un admin los crea y les pone o
// cambia el PIN (dueño, 11-10-2026). Hoy se usan para la app del taller
// (/taller/); el PIN general del POS sigue funcionando.
// El PIN viaja al servidor y ahí se guarda como resumen: nunca vuelve.
// ==========================================

let usuariosLista = [];

const PAPEL_TALLER_TEXTO = { DUENO: 'Dueño de Sevelin', PAPA: 'C. Patricio (el del pozo)' };

function formatoRutUsuario(valor) {
  const limpio = String(valor || '').replace(/[^0-9kK]/g, '').toUpperCase().slice(0, 9);
  if (limpio.length < 2) return limpio;
  return Number(limpio.slice(0, -1)).toLocaleString('es-CL') + '-' + limpio.slice(-1);
}

async function abrirUsuarios() {
  limpiarFormUsuario();
  document.getElementById('modalUsuarios')?.classList.add('show');
  await cargarUsuarios();
}

async function cargarUsuarios() {
  const el = document.getElementById('usuariosLista');
  if (!el) return;
  try {
    usuariosLista = await API.usuarios.listar();
    pintarUsuarios();
  } catch (err) {
    el.innerHTML = `<div class="callout-warning">${escHtml(err.message || 'No se pudieron cargar los usuarios')}</div>`;
  }
}

function pintarUsuarios() {
  const el = document.getElementById('usuariosLista');
  if (!el) return;
  const filas = usuariosLista.map(u => {
    const estado = !u.activo ? '<span class="badge badge-red">Desactivado</span>'
      : u.bloqueado ? '<span class="badge badge-gold">Bloqueado por intentos</span>'
        : '<span class="badge badge-green">Activo</span>';
    return `<tr>
      <td class="strong">${escHtml(u.nombre)}</td>
      <td>${escHtml(formatoRutUsuario(u.rut))}</td>
      <td>${u.rol === 'admin' ? '<span class="badge badge-gold">Administrador</span>' : '<span class="badge badge-blue">Trabajador</span>'}</td>
      <td>${escHtml(PAPEL_TALLER_TEXTO[u.papel_taller] || '—')}</td>
      <td>${estado}</td>
      <td class="usuarios-acciones">
        <button type="button" class="btn btn-outline btn-sm" data-usuario-editar="${Number(u.id)}">Editar</button>
        ${u.bloqueado ? `<button type="button" class="btn btn-outline btn-sm" data-usuario-desbloquear="${Number(u.id)}">Desbloquear</button>` : ''}
        <button type="button" class="btn btn-outline btn-sm" data-usuario-activo="${Number(u.id)}">${u.activo ? 'Desactivar' : 'Activar'}</button>
      </td>
    </tr>`;
  });
  el.innerHTML = `<div class="table-wrapper">
      <table class="data-table">
        <thead><tr><th>Nombre</th><th>RUT</th><th>Tipo</th><th>En el taller</th><th>Estado</th><th></th></tr></thead>
        <tbody>${filas.length ? filas.join('') : '<tr class="empty-row"><td colspan="6">Todavía no hay usuarios. Crea el primero aquí abajo.</td></tr>'}</tbody>
      </table>
    </div>`;

  const faltan = ['DUENO', 'PAPA'].filter(papel => !usuariosLista.some(u => u.activo && u.papel_taller === papel));
  const elAviso = document.getElementById('usuariosAviso');
  if (elAviso) {
    elAviso.innerHTML = usuariosLista.length && faltan.length
      ? `<div class="callout-warning">Para que la app del taller saque las cuentas falta marcar quién es: <b>${faltan.map(f => escHtml(PAPEL_TALLER_TEXTO[f])).join('</b> y <b>')}</b> (casilla "En las cuentas del taller").</div>`
      : '';
  }
}

function limpiarFormUsuario() {
  const poner = (id, valor) => { const el = document.getElementById(id); if (el) el.value = valor; };
  poner('usuarioId', '');
  poner('usuarioNombre', '');
  poner('usuarioRut', '');
  poner('usuarioRol', 'trabajador');
  poner('usuarioPapel', '');
  poner('usuarioPin', '');
  const titulo = document.getElementById('usuarioFormTitulo');
  if (titulo) titulo.textContent = 'Nuevo usuario';
  const etiquetaPin = document.getElementById('usuarioPinEtiqueta');
  if (etiquetaPin) etiquetaPin.textContent = 'PIN (4 a 8 números) *';
  const boton = document.getElementById('btnUsuarioGuardar');
  if (boton) boton.textContent = 'Crear usuario';
}

function editarUsuario(id) {
  const u = usuariosLista.find(x => Number(x.id) === Number(id));
  if (!u) return;
  const poner = (campo, valor) => { const el = document.getElementById(campo); if (el) el.value = valor; };
  poner('usuarioId', u.id);
  poner('usuarioNombre', u.nombre);
  poner('usuarioRut', formatoRutUsuario(u.rut));
  poner('usuarioRol', u.rol);
  poner('usuarioPapel', u.papel_taller || '');
  poner('usuarioPin', '');
  const titulo = document.getElementById('usuarioFormTitulo');
  if (titulo) titulo.textContent = `Editar a ${u.nombre}`;
  const etiquetaPin = document.getElementById('usuarioPinEtiqueta');
  if (etiquetaPin) etiquetaPin.textContent = 'PIN nuevo (déjalo vacío para no cambiarlo)';
  const boton = document.getElementById('btnUsuarioGuardar');
  if (boton) boton.textContent = 'Guardar cambios';
  document.getElementById('usuarioNombre')?.focus();
}

async function guardarUsuario() {
  const leer = (id) => (document.getElementById(id)?.value || '').trim();
  const id = leer('usuarioId');
  const datos = { nombre: leer('usuarioNombre'), rut: leer('usuarioRut'), rol: leer('usuarioRol'), papel_taller: leer('usuarioPapel') || null };
  const pin = leer('usuarioPin');
  if (!datos.nombre || !datos.rut) return showToast('Escribe el nombre y el RUT', 'error');
  if (!id && !pin) return showToast('Ponle un PIN de 4 a 8 números', 'error');
  if (pin && !/^\d{4,8}$/.test(pin)) return showToast('El PIN son entre 4 y 8 números', 'error');
  if (pin) datos.pin = pin;

  // Si el papel del taller ya lo tiene otro, se lo quita: se avisa antes.
  const otro = datos.papel_taller ? usuariosLista.find(u => u.papel_taller === datos.papel_taller && String(u.id) !== String(id)) : null;
  if (otro && !(await ventanaConfirmar(`"${PAPEL_TALLER_TEXTO[datos.papel_taller]}" hoy es ${otro.nombre}.\n\nSi sigues, pasa a ser ${datos.nombre} y ${otro.nombre} queda como una persona más.`, { textoSi: 'Sí, cambiarlo' }))) return;

  const boton = document.getElementById('btnUsuarioGuardar');
  if (boton) boton.disabled = true;
  try {
    if (id) await API.usuarios.actualizar(id, datos);
    else await API.usuarios.crear(datos);
    showToast(id ? 'Usuario actualizado' : 'Usuario creado', 'ok');
    limpiarFormUsuario();
    await cargarUsuarios();
  } catch (err) {
    showToast(err.message || 'No se pudo guardar el usuario', 'error');
  } finally {
    if (boton) boton.disabled = false;
  }
}

async function cambiarEstadoUsuario(id) {
  const u = usuariosLista.find(x => Number(x.id) === Number(id));
  if (!u) return;
  if (u.activo && !(await ventanaConfirmar(`¿Desactivar a ${u.nombre}?\n\nDeja de entrar con su RUT y su PIN. Lo que ya registró no se pierde, y puedes activarlo de nuevo cuando quieras.`,
    { textoSi: 'Sí, desactivar', peligro: true }))) return;
  try {
    await API.usuarios.actualizar(u.id, { activo: !u.activo });
    showToast(u.activo ? 'Usuario desactivado' : 'Usuario activado', 'ok');
    await cargarUsuarios();
  } catch (err) {
    showToast(err.message || 'No se pudo cambiar', 'error');
  }
}

async function desbloquearUsuario(id) {
  try {
    await API.usuarios.actualizar(id, { desbloquear: true });
    showToast('Usuario desbloqueado', 'ok');
    await cargarUsuarios();
  } catch (err) {
    showToast(err.message || 'No se pudo desbloquear', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnUsuarios')?.addEventListener('click', abrirUsuarios);
  document.getElementById('btnUsuariosCerrar')?.addEventListener('click', () => document.getElementById('modalUsuarios')?.classList.remove('show'));
  document.getElementById('btnUsuarioLimpiar')?.addEventListener('click', limpiarFormUsuario);
  document.getElementById('btnUsuarioGuardar')?.addEventListener('click', guardarUsuario);
  document.getElementById('usuarioRut')?.addEventListener('input', (e) => { e.target.value = formatoRutUsuario(e.target.value); });
  document.getElementById('usuarioPin')?.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8); });
  document.getElementById('usuariosLista')?.addEventListener('click', (e) => {
    const boton = e.target.closest('button');
    if (!boton) return;
    if (boton.dataset.usuarioEditar) editarUsuario(boton.dataset.usuarioEditar);
    else if (boton.dataset.usuarioDesbloquear) desbloquearUsuario(boton.dataset.usuarioDesbloquear);
    else if (boton.dataset.usuarioActivo) cambiarEstadoUsuario(boton.dataset.usuarioActivo);
  });
});
