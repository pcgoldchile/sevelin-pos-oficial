// ==========================================
// TALLER SEVELIN — app del celular (v135, sql/92)
// ------------------------------------------
// Registro paso a paso de cada servicio técnico. Habla con el mismo
// servidor del POS (/api/taller/...): lo que se anota aquí queda en la
// base de Sevelin al momento. Página aparte del POS: no comparte sus
// scripts, por eso trae sus propios ayudantes.
// Todo dato escrito por una persona pasa por esc() antes de ir al HTML.
// ==========================================
(() => {
  'use strict';

  const CLAVE_TOKEN = 'taller_token';
  const CLAVE_RUT = 'taller_rut';
  const EQUIPOS = [
    { id: 'CELULAR', nombre: 'Celular', icono: '📱' },
    { id: 'COMPUTADOR', nombre: 'Computador', icono: '💻' },
    { id: 'OTRO', nombre: 'Otro', icono: '🎮' }
  ];
  const MEDIOS = [{ id: 'EFECTIVO', nombre: 'Efectivo' }, { id: 'TRANSFERENCIA', nombre: 'Transferencia' }, { id: 'TARJETA', nombre: 'Tarjeta' }];
  const VIAJES = [1000, 2000, 3000, 5000];
  const NOMBRE_PASO = { equipo: 'Equipo', repuestos: 'Repuesto', costos: 'Costo', viaje: 'Viaje', manos: 'Quién lo hizo', cobro: 'Cobro', resumen: 'Revisar' };

  const leer = (clave) => { try { return localStorage.getItem(clave); } catch (_) { return null; } };
  const guardar = (clave, valor) => { try { valor === null ? localStorage.removeItem(clave) : localStorage.setItem(clave, valor); } catch (_) { /* modo privado */ } };

  const S = {
    vista: 'cargando', pestana: 'pendientes', token: leer(CLAVE_TOKEN), errorLogin: '',
    yo: null, admin: false, personas: [], duenoId: null, papaId: null, catalogo: [], modelos: [], hoy: '',
    trabajos: [], cargandoLista: false, cuentas: null, mesCuentas: null,
    borrador: null, paso: 0, editando: null, errorPaso: '', guardando: false,
    detalle: null, cobro: null
  };

  const $app = document.getElementById('app');
  const $capa = document.getElementById('capaVentana');
  const $aviso = document.getElementById('aviso');

  /* ---------- Ayudantes ---------- */
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plata = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CL');
  const soloNumeros = (v) => String(v ?? '').replace(/\D/g, '');
  const aNumero = (v) => { const d = soloNumeros(v); return d ? Number(d) : null; };
  const conPuntos = (v) => { const d = soloNumeros(v); return d ? Number(d).toLocaleString('es-CL') : ''; };
  const mismo = (a, b) => a != null && b != null && Number(a) === Number(b);
  function formatoRut(v) {
    const limpio = String(v || '').replace(/[^0-9kK]/g, '').toUpperCase().slice(0, 9);
    if (limpio.length < 2) return limpio;
    return Number(limpio.slice(0, -1)).toLocaleString('es-CL') + '-' + limpio.slice(-1);
  }
  function fechaCorta(v) {
    if (!v) return '';
    const d = new Date(String(v).length === 10 ? v + 'T12:00:00' : v);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
  }
  function nombreMes(mes) {
    const [a, m] = mes.split('-').map(Number);
    const texto = new Date(a, m - 1, 15).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }
  const persona = (id) => S.personas.find(p => mismo(p.id, id)) || null;
  const nombre = (id) => (persona(id) ? persona(id).nombre : 'Alguien');
  const equipo = (id) => EQUIPOS.find(e => e.id === id) || EQUIPOS[2];
  const nombrePapa = () => (S.papaId ? nombre(S.papaId) : 'C. Patricio');
  /* El dueño y C. Patricio primero: son los que casi siempre ponen la plata. */
  function personasEnOrden() {
    const peso = (p) => (mismo(p.id, S.duenoId) ? 0 : mismo(p.id, S.papaId) ? 1 : 2);
    return S.personas.filter(p => p.activo !== false).sort((a, b) => peso(a) - peso(b) || a.id - b.id);
  }
  const lista = (tipo, eq) => S.catalogo.filter(c => c.tipo === tipo && (tipo !== 'REPUESTO' || c.equipo === eq));

  /* ---------- Servidor ---------- */
  async function pedir(ruta, { metodo = 'GET', cuerpo } = {}) {
    let res;
    try {
      res = await fetch('/api' + ruta, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
      });
    } catch (_) {
      throw new Error('No hay conexión. Revisa la señal e intenta de nuevo.');
    }
    let datos = null;
    try { datos = await res.json(); } catch (_) { datos = null; }
    if (res.status === 401 && ruta !== '/login') {
      cerrarSesion('Tu sesión terminó. Entra de nuevo.');
      throw new Error('Tu sesión terminó. Entra de nuevo.');
    }
    if (!res.ok) throw new Error((datos && datos.error) || 'No se pudo completar. Intenta de nuevo.');
    return datos;
  }

  /* ---------- Ventanas propias y avisos (nunca las del navegador) ---------- */
  let cerrarVentana = null;
  function ventana({ titulo, texto = '', campo = null, si = 'Aceptar', no = 'Cancelar', peligro = false }) {
    return new Promise(resolver => {
      $capa.innerHTML = `<div class="ventana" role="dialog" aria-modal="true">
        <h2>${esc(titulo)}</h2>${texto ? `<p>${esc(texto)}</p>` : ''}
        ${campo ? `<input class="campo" id="ventanaCampo" maxlength="${campo.tope || 60}" placeholder="${esc(campo.ejemplo || '')}" value="${esc(campo.valor || '')}"
          ${campo.plata ? 'inputmode="numeric"' : ''} autocomplete="off">` : ''}
        <div class="botones">
          ${no ? `<button type="button" class="btn-secundario" data-v="no">${esc(no)}</button>` : ''}
          <button type="button" class="${peligro ? 'btn-peligro' : 'btn-principal'}" data-v="si">${esc(si)}</button>
        </div></div>`;
      $capa.hidden = false;
      const $campo = document.getElementById('ventanaCampo');
      if ($campo) {
        if (campo.plata) $campo.addEventListener('input', () => { $campo.value = conPuntos($campo.value); });
        setTimeout(() => $campo.focus(), 50);
      }
      cerrarVentana = (acepto) => {
        cerrarVentana = null;
        const valor = $campo ? $campo.value.trim() : true;
        $capa.hidden = true;
        $capa.innerHTML = '';
        resolver(acepto ? valor : (campo ? null : false));
      };
    });
  }
  $capa.addEventListener('click', (e) => {
    if (!cerrarVentana) return;
    const boton = e.target.closest('[data-v]');
    if (boton) cerrarVentana(boton.dataset.v === 'si');
    else if (e.target === $capa) cerrarVentana(false);
  });
  $capa.addEventListener('keydown', (e) => { if (e.key === 'Enter' && cerrarVentana && e.target.id === 'ventanaCampo') cerrarVentana(true); });

  let relojAviso = null;
  function aviso(texto, mal = false) {
    $aviso.textContent = texto;
    $aviso.className = 'aviso' + (mal ? ' mal' : '');
    $aviso.hidden = false;
    clearTimeout(relojAviso);
    relojAviso = setTimeout(() => { $aviso.hidden = true; }, mal ? 4200 : 2600);
  }

  /* ---------- Las cuentas de un trabajo (espejo de cuentasDeTrabajoTaller en api/index.js) ----------
     Solo para mostrar el adelanto antes de guardar: lo que vale es lo que responde el servidor. */
  function cuentasDe(t, repuestos) {
    const puesto = new Map();
    const sumar = (quien, monto) => { if (quien && monto > 0) puesto.set(Number(quien), (puesto.get(Number(quien)) || 0) + monto); };
    let costoRepuestos = 0;
    repuestos.forEach(r => { const c = Math.round(Number(r.costo) || 0); costoRepuestos += c; sumar(r.pagado_por, c); });
    const viaje = Math.round(Number(t.viaje_monto) || 0);
    sumar(t.viaje_pagado_por, viaje);
    const dueno = Number(t.dueno_id);
    const porOtros = [...puesto].filter(([q]) => q !== dueno).reduce((a, [, m]) => a + m, 0);
    const r = { costo_repuestos: costoRepuestos, costo_viaje: viaje, costo_total: costoRepuestos + viaje, puesto_por_otros: porOtros,
      ganancia: null, aporte_pozo: 0, en_mano_del_dueno: 0, deudas: [], por_devolver: [] };
    if (t.estado !== 'COBRADO') {
      r.por_devolver = [...puesto].filter(([q]) => q !== dueno).map(([a, monto]) => ({ a, monto }));
      return r;
    }
    const cobrado = Math.round(Number(t.cobrado_monto) || 0);
    const recibio = Number(t.cobrado_recibio);
    const enLaApp = t.cobrado_donde !== 'CAJA_POS';
    r.ganancia = cobrado - r.costo_total;
    const deber = (de, a, monto, motivo) => { if (de !== a && monto > 0) r.deudas.push({ de, a, monto, motivo }); };
    puesto.forEach((monto, quien) => { if (quien !== dueno && quien !== recibio) deber(recibio, quien, monto, 'PUSO'); });
    const parte = cobrado - porOtros;
    if (recibio === dueno) {
      if (t.va_al_pozo && enLaApp) { r.aporte_pozo = Math.max(0, parte); r.en_mano_del_dueno = r.aporte_pozo; }
    } else if (parte < 0) deber(dueno, recibio, -parte, 'FALTO');
    else if (t.va_al_pozo) { if (enLaApp) r.aporte_pozo = parte; }
    else deber(recibio, dueno, parte, 'COBRO');
    return r;
  }

  function frasesDeCuentas(t, c) {
    const frases = [];
    (c.deudas || []).forEach(d => {
      const motivo = d.motivo === 'PUSO' ? 'es el repuesto o la bencina que puso'
        : d.motivo === 'COBRO' ? 'es lo cobrado, menos lo que él mismo puso'
          : 'se cobró menos de lo que se puso';
      frases.push(`<div class="cuenta"><b>${plata(d.monto)}</b><br>${esc(nombre(d.de))} le devuelve a ${esc(nombre(d.a))}: ${motivo}.</div>`);
    });
    (c.por_devolver || []).forEach(p => frases.push(
      `<div class="cuenta ambar">Cuando se cobre, hay que devolverle <b>${plata(p.monto)}</b> a ${esc(nombre(p.a))}: es el repuesto o la bencina que puso.</div>`));
    if (t.estado === 'COBRADO' && !(c.deudas || []).length) frases.push('<div class="cuenta verde">Cuentas claras: por este trabajo nadie le debe a nadie.</div>');
    if (c.ganancia !== null && c.ganancia !== undefined) {
      frases.push(`<div class="cuenta gris">Ganancia del trabajo: <b>${plata(c.ganancia)}</b><br>Cobrado ${plata(t.cobrado_monto)} menos ${plata(c.costo_total)} en repuestos y viaje.</div>`);
    }
    if (S.admin && t.va_al_pozo && t.estado === 'COBRADO') {
      frases.push(t.cobrado_donde === 'CAJA_POS'
        ? '<div class="cuenta gris">Se cobró en la caja del POS: lo que va al pozo se decide ahí, la app no lo suma.</div>'
        : `<div class="cuenta gris">Al pozo de ${esc(nombrePapa())}: <b>${plata(c.aporte_pozo)}</b>${c.en_mano_del_dueno > 0 ? ' (ya los tiene él)' : c.aporte_pozo > 0 ? ' (los tiene Sevelin: se le entregan)' : ''}.</div>`);
    }
    return frases.join('');
  }

  /* ---------- Sesión ---------- */
  function cerrarSesion(mensaje = '') {
    S.token = null;
    guardar(CLAVE_TOKEN, null);
    Object.assign(S, { vista: 'login', errorLogin: mensaje, yo: null, borrador: null, detalle: null, cobro: null, cuentas: null });
    if (cerrarVentana) cerrarVentana(false);
    pintar();
  }

  async function entrar(rut, pin) {
    const datos = await pedir('/login', { metodo: 'POST', cuerpo: { rut, pin } });
    S.token = datos.token;
    guardar(CLAVE_TOKEN, datos.token);
    guardar(CLAVE_RUT, formatoRut(rut));
    await abrir();
  }

  async function abrir() {
    const d = await pedir('/taller/inicio');
    if (!d.yo) { cerrarSesion('Entra con tu RUT y tu PIN: así queda anotado quién registró cada trabajo.'); return; }
    Object.assign(S, {
      yo: d.yo, admin: !!d.admin, personas: d.personas || [], duenoId: d.dueno_id, papaId: d.papa_id,
      catalogo: d.catalogo || [], modelos: d.modelos || [], hoy: d.hoy, mesCuentas: String(d.hoy).slice(0, 7), vista: 'inicio', errorLogin: ''
    });
    pintar();
    cargarLista();
  }

  async function cargarLista() {
    if (S.pestana === 'cuentas') return cargarCuentas();
    S.cargandoLista = true;
    pintar();
    try {
      S.trabajos = await pedir('/taller/trabajos?ver=' + S.pestana);
    } catch (err) {
      aviso(err.message, true);
    }
    S.cargandoLista = false;
    pintar();
  }

  async function cargarCuentas() {
    S.cuentas = null;
    pintar();
    try {
      S.cuentas = await pedir('/taller/cuentas?mes=' + S.mesCuentas);
    } catch (err) {
      aviso(err.message, true);
    }
    pintar();
  }

  /* ---------- Borrador del asistente ---------- */
  function borradorNuevo() {
    return {
      equipo_tipo: null, equipo_modelo: '', cliente: '', nota: '',
      // Si lo registra C. Patricio, lo normal es que el trabajo sea suyo.
      es_del_papa: !!S.papaId && mismo(S.yo.id, S.papaId),
      sin_repuesto: false, repuestos: [],
      viaje: null, viaje_otro: '', viaje_pagado_por: null,
      desarmo_id: null, instalo_id: null, probo_id: null,
      cobrado: null, precio_acordado: '', monto: '', medio: null, recibio: null, en_caja: false, venta_numero: ''
    };
  }
  function borradorDesde(t) {
    const viaje = Number(t.viaje_monto) || 0;
    return {
      equipo_tipo: t.equipo_tipo, equipo_modelo: t.equipo_modelo, cliente: t.cliente || '', nota: t.nota || '', es_del_papa: !!t.va_al_pozo,
      sin_repuesto: !t.repuestos.length,
      repuestos: t.repuestos.map(r => ({ nombre: r.nombre, calidad: r.calidad || null, origen: r.origen, costo: conPuntos(r.costo) || '0', lugar: r.lugar || '', pagado_por: r.pagado_por })),
      viaje: viaje === 0 ? 'SIN' : VIAJES.includes(viaje) ? viaje : 'OTRO', viaje_otro: VIAJES.includes(viaje) ? '' : conPuntos(viaje), viaje_pagado_por: t.viaje_pagado_por,
      desarmo_id: t.desarmo_id, instalo_id: t.instalo_id, probo_id: t.probo_id,
      cobrado: t.estado === 'COBRADO', precio_acordado: conPuntos(t.precio_acordado),
      monto: t.cobrado_monto === null || t.cobrado_monto === undefined ? '' : (conPuntos(t.cobrado_monto) || '0'),
      medio: t.cobrado_medio || null, recibio: t.cobrado_recibio || null, en_caja: t.cobrado_donde === 'CAJA_POS', venta_numero: t.venta_numero || ''
    };
  }
  function pasosDe(b) {
    const pasos = ['equipo', 'repuestos'];
    if (b.repuestos.length) pasos.push('costos');
    if (b.repuestos.some(r => r.origen === 'COMPRA')) pasos.push('viaje');
    pasos.push('manos', 'cobro', 'resumen');
    return pasos;
  }
  const montoViaje = (b) => (b.viaje === 'OTRO' ? (aNumero(b.viaje_otro) || 0) : typeof b.viaje === 'number' ? b.viaje : 0);
  const hayCompra = (b) => b.repuestos.some(r => r.origen === 'COMPRA');
  const tienePantalla = (b) => b.repuestos.some(r => /pantalla/i.test(r.nombre));

  /* Lo que falta para pasar al paso siguiente (o null si está completo). */
  function faltaEnPaso(paso, b) {
    if (paso === 'equipo') {
      if (!b.equipo_tipo) return 'Elige qué equipo es.';
      if (!b.equipo_modelo.trim()) return 'Escribe la marca y el modelo.';
    }
    if (paso === 'repuestos') {
      if (!b.sin_repuesto && !b.repuestos.length) return 'Elige el repuesto, o marca "Sin repuesto".';
      const pantalla = b.repuestos.find(r => /pantalla/i.test(r.nombre) && !r.calidad);
      if (pantalla) return 'Elige la calidad de la pantalla.';
    }
    if (paso === 'costos') {
      for (const r of b.repuestos) {
        if (!r.origen) return `${r.nombre}: ¿lo teníamos o se fue a comprar?`;
        if (r.costo === '' || aNumero(r.costo) === null) return `${r.nombre}: escribe cuánto costó (si no costó nada, pon 0).`;
        if (aNumero(r.costo) > 0 && !r.pagado_por) return `${r.nombre}: ¿quién puso la plata?`;
      }
    }
    if (paso === 'viaje') {
      if (b.viaje === null) return 'Elige cuánto salió el viaje, o "Sin viaje".';
      if (b.viaje === 'OTRO' && !aNumero(b.viaje_otro)) return 'Escribe cuánto salió el viaje.';
      if (montoViaje(b) > 0 && !b.viaje_pagado_por) return '¿Quién puso la bencina?';
    }
    if (paso === 'cobro') return faltaEnCobro(b);
    return null;
  }
  function faltaEnCobro(b) {
    if (b.cobrado === null) return 'Elige si ya se cobró o queda pendiente de entrega.';
    if (!b.cobrado) return null;
    if (b.monto === '' || aNumero(b.monto) === null) return 'Escribe cuánto se cobró.';
    if (!b.medio) return 'Elige cómo pagó el cliente.';
    if (!b.en_caja && !b.recibio) return '¿Quién recibió la plata?';
    return null;
  }

  const cobroDe = (b) => ({ monto: aNumero(b.monto), medio: b.medio, donde: b.en_caja ? 'CAJA_POS' : 'APP', recibio: b.en_caja ? null : b.recibio, venta_numero: b.en_caja ? b.venta_numero.trim() : '' });
  function cuerpoDe(b) {
    const viaje = hayCompra(b) ? montoViaje(b) : 0;
    return {
      equipo_tipo: b.equipo_tipo, equipo_modelo: b.equipo_modelo.trim(), cliente: b.cliente.trim(), nota: b.nota.trim(), es_del_papa: b.es_del_papa,
      repuestos: b.repuestos.map(r => ({ nombre: r.nombre, calidad: r.calidad, origen: r.origen, costo: aNumero(r.costo) || 0, lugar: r.origen === 'COMPRA' ? r.lugar.trim() : '', pagado_por: r.pagado_por })),
      viaje_monto: viaje, viaje_pagado_por: viaje > 0 ? b.viaje_pagado_por : null,
      desarmo_id: b.desarmo_id, instalo_id: b.instalo_id, probo_id: b.probo_id,
      precio_acordado: b.cobrado ? null : aNumero(b.precio_acordado)
    };
  }
  /* El borrador convertido en un trabajo, para adelantar las cuentas en pantalla. */
  function trabajoDeBorrador(b) {
    const c = cuerpoDe(b);
    return {
      trabajo: {
        dueno_id: b.es_del_papa ? S.papaId : S.duenoId, va_al_pozo: b.es_del_papa, viaje_monto: c.viaje_monto, viaje_pagado_por: c.viaje_pagado_por,
        estado: b.cobrado ? 'COBRADO' : 'PENDIENTE', cobrado_monto: aNumero(b.monto) || 0, cobrado_donde: b.en_caja ? 'CAJA_POS' : 'APP',
        cobrado_recibio: b.en_caja ? S.duenoId : b.recibio
      },
      repuestos: c.repuestos.map(r => ({ ...r, pagado_por: r.pagado_por || (r.origen === 'STOCK' ? S.duenoId : null) }))
    };
  }

  /* ---------- Piezas de pantalla ---------- */
  const barra = (titulo, { atras = false, derecha = '' } = {}) => `<header class="barra">
      ${atras ? '<button type="button" class="barra-btn" data-a="volver" aria-label="Volver">‹ Volver</button>' : '<img src="icono-192.png" alt="">'}
      <div class="barra-titulo">${esc(titulo)}</div>${derecha}</header>`;
  const opcion = (accion, valor, texto, activa, extra = '', clase = '') =>
    `<button type="button" class="op ${clase}${activa ? ' on' : ''}" data-a="${accion}" data-v="${esc(valor)}" ${extra} aria-pressed="${activa ? 'true' : 'false'}">${texto}</button>`;
  const opcionesPersona = (accion, elegido, extra = '') => `<div class="fila">${personasEnOrden().map(p =>
    opcion(accion, p.id, esc(p.nombre), mismo(p.id, elegido), extra)).join('')}</div>`;
  const campoPlata = (campo, valor, extra = '', ejemplo = '0') => `<div class="campo-plata"><span>$</span>
      <input class="campo" inputmode="numeric" autocomplete="off" data-c="${campo}" data-plata="1" ${extra} value="${esc(valor)}" placeholder="${ejemplo}"></div>`;

  function vistaLogin() {
    return `<div class="ingreso">
      <img src="icono-192.png" alt="">
      <h1>Taller Sevelin</h1>
      <p class="sub">Entra con tu RUT y tu PIN</p>
      <form data-form="login" autocomplete="off" novalidate>
        <label for="rut">RUT</label>
        <input id="rut" inputmode="text" autocapitalize="characters" autocomplete="username" placeholder="12.345.678-9" value="${esc(leer(CLAVE_RUT) || '')}">
        <label for="pin">PIN</label>
        <input id="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="current-password" placeholder="••••">
        ${S.errorLogin ? `<div class="error" role="alert">${esc(S.errorLogin)}</div>` : ''}
        <button type="submit" class="btn-principal" id="btnEntrar">Entrar</button>
      </form>
      <p class="pie">El RUT queda recordado en este teléfono. El PIN no.</p>
    </div>`;
  }

  function tarjetaTrabajo(t) {
    const eq = equipo(t.equipo_tipo);
    const reps = (t.repuestos || []).map(r => r.nombre + (r.calidad ? ' ' + r.calidad : '')).join(', ') || 'Sin repuesto';
    const marcas = [];
    marcas.push(t.estado === 'COBRADO' ? '<span class="marca verde">Cobrado</span>' : '<span class="marca ambar">Pendiente de entrega</span>');
    if (t.va_al_pozo) marcas.push(`<span class="marca azul">De ${esc(nombrePapa())}</span>`);
    let monto = '';
    if (!t.limitado) {
      (t.cuentas.deudas || []).forEach(d => marcas.push(`<span class="marca rojo">${esc(nombre(d.de))} devuelve ${plata(d.monto)}</span>`));
      (t.cuentas.por_devolver || []).forEach(p => marcas.push(`<span class="marca">Al cobrar: ${plata(p.monto)} a ${esc(nombre(p.a))}</span>`));
      if (t.estado === 'COBRADO') monto = `<div class="trabajo-plata">${plata(t.cobrado_monto)}<small>cobrado</small></div>`;
      else if (t.precio_acordado !== null && t.precio_acordado !== undefined) monto = `<div class="trabajo-plata">${plata(t.precio_acordado)}<small>acordado</small></div>`;
    }
    return `<button type="button" class="tarjeta trabajo" data-a="abrir" data-v="${Number(t.id)}">
      <div class="trabajo-cabeza">
        <div class="trabajo-icono" aria-hidden="true">${eq.icono}</div>
        <div><div class="trabajo-modelo">${esc(t.equipo_modelo)}</div>
          <div class="trabajo-linea">${esc(reps)}</div>
          <div class="trabajo-linea">#${Number(t.id)} · ${esc(nombre(t.registrado_por))} · ${fechaCorta(t.creado_en)}</div></div>
        ${monto}
      </div>
      <div class="marcas">${marcas.join('')}</div>
    </button>`;
  }

  function vistaInicio() {
    const faltaPapel = !S.duenoId || (S.admin && !S.papaId)
      ? `<div class="nota-suave">${S.admin
        ? `Falta decir en el POS quién es ${!S.duenoId ? 'el dueño de Sevelin' : 'C. Patricio'}: botón Usuarios, casilla "En las cuentas del taller". Sin eso no se pueden sacar las cuentas.`
        : 'Todavía no se puede registrar: falta que el administrador diga en el POS quién es el dueño de Sevelin.'}</div>` : '';
    let contenido;
    if (S.pestana === 'cuentas') contenido = vistaCuentas();
    else if (S.cargandoLista && !S.trabajos.length) contenido = '<p class="cargando">Cargando…</p>';
    else if (!S.trabajos.length) {
      contenido = S.pestana === 'pendientes'
        ? '<div class="vacio"><b>Nada pendiente de entrega</b>Cuando registres un trabajo sin cobrar, aparece aquí.</div>'
        : '<div class="vacio"><b>Todavía no hay trabajos cobrados</b>Los que se cobren quedan aquí.</div>';
    } else contenido = S.trabajos.map(tarjetaTrabajo).join('');

    return barra('Taller Sevelin', { derecha: `<span class="barra-quien">${esc(S.yo.nombre)}</span><button type="button" class="barra-btn" data-a="salir">Salir</button>` }) +
      `<main class="cuerpo">
        <button type="button" class="btn-principal" data-a="nuevo">＋ Nuevo trabajo</button>
        ${faltaPapel}
        <div class="pestanas" role="tablist">
          <button type="button" role="tab" class="${S.pestana === 'pendientes' ? 'on' : ''}" data-a="pestana" data-v="pendientes">Pendientes</button>
          <button type="button" role="tab" class="${S.pestana === 'cobrados' ? 'on' : ''}" data-a="pestana" data-v="cobrados">Cobrados</button>
          ${S.admin ? `<button type="button" role="tab" class="${S.pestana === 'cuentas' ? 'on' : ''}" data-a="pestana" data-v="cuentas">Cuentas</button>` : ''}
        </div>
        ${contenido}
      </main>`;
  }

  /* ---------- Asistente ---------- */
  function pasoEquipo(b) {
    const recientes = S.modelos.filter(m => m.equipo === b.equipo_tipo).slice(0, 8);
    return `<h1 class="paso-titulo">¿Qué equipo es?</h1>
      <div class="fila">${EQUIPOS.map(e => opcion('equipo', e.id, `<span aria-hidden="true">${e.icono}</span>${e.nombre}`, b.equipo_tipo === e.id, '', 'grande')).join('')}</div>
      <p class="pregunta">Marca y modelo</p>
      <input class="campo" data-c="equipo_modelo" maxlength="80" autocomplete="off" autocapitalize="words" placeholder="Samsung A07" value="${esc(b.equipo_modelo)}">
      ${recientes.length ? `<div class="fila" style="margin-top:8px">${recientes.map(m => opcion('modelo', m.modelo, esc(m.modelo), b.equipo_modelo === m.modelo)).join('')}</div>` : ''}
      ${S.papaId ? `<p class="pregunta">¿De quién es el trabajo?</p>
      <button type="button" class="casilla${b.es_del_papa ? ' on' : ''}" data-a="delpapa" role="checkbox" aria-checked="${b.es_del_papa ? 'true' : 'false'}">
        <i>${b.es_del_papa ? '✓' : ''}</i><span><b>Es de ${esc(nombrePapa())}</b><small>${b.es_del_papa ? 'La ganancia es de él.' : 'Sin marcar: el trabajo es de Sevelin.'}</small></span></button>` : ''}
      <p class="pregunta">Cliente o nota <small>(opcional)</small></p>
      <input class="campo" data-c="cliente" maxlength="80" autocomplete="off" placeholder="Nombre del cliente o un dato para ubicarlo" value="${esc(b.cliente)}">`;
  }

  function pasoRepuestos(b) {
    const opciones = lista('REPUESTO', b.equipo_tipo);
    const elegidos = new Set(b.repuestos.map(r => r.nombre));
    const extras = b.repuestos.filter(r => !opciones.some(o => o.nombre === r.nombre));
    const pantallas = b.repuestos.map((r, i) => ({ r, i })).filter(x => /pantalla/i.test(x.r.nombre));
    const calidades = lista('CALIDAD_PANTALLA');
    return `<h1 class="paso-titulo">¿Qué repuesto lleva?</h1>
      <p class="paso-ayuda">Puedes marcar más de uno.</p>
      <div class="fila">
        ${opciones.map(o => opcion('repuesto', o.nombre, esc(o.nombre), elegidos.has(o.nombre))).join('')}
        ${extras.map(r => opcion('repuesto', r.nombre, esc(r.nombre), true)).join('')}
        ${opcion('otrorepuesto', '', '＋ Otro', false, '', 'punteada')}
        ${opcion('sinrepuesto', '', 'Sin repuesto', b.sin_repuesto)}
      </div>
      ${pantallas.map(({ r, i }) => `<p class="pregunta">Calidad de la pantalla</p>
        <div class="fila">${calidades.map(c => opcion('calidad', c.nombre, esc(c.nombre), r.calidad === c.nombre, `data-i="${i}"`)).join('')}
          ${r.calidad && !calidades.some(c => c.nombre === r.calidad) ? opcion('calidad', r.calidad, esc(r.calidad), true, `data-i="${i}"`) : ''}
          ${opcion('otracalidad', '', '＋ Otra', false, `data-i="${i}"`, 'punteada')}</div>`).join('')}`;
  }

  function pasoCostos(b) {
    const lugares = lista('LUGAR');
    return `<h1 class="paso-titulo">¿De dónde salió y cuánto costó?</h1>
      ${b.repuestos.map((r, i) => {
        const dato = `data-i="${i}"`;
        const lugarEscrito = r.lugar && !lugares.some(l => l.nombre === r.lugar) ? r.lugar : '';
        return `<div class="bloque">
          <h3>${esc(r.nombre)}${r.calidad ? ` <small>${esc(r.calidad)}</small>` : ''}</h3>
          <div class="fila" style="margin-top:10px">
            ${opcion('origen', 'STOCK', 'Lo teníamos', r.origen === 'STOCK', dato, 'ancha')}
            ${opcion('origen', 'COMPRA', 'Se fue a comprar', r.origen === 'COMPRA', dato, 'ancha')}
          </div>
          ${r.origen ? `<p class="pregunta">${r.origen === 'STOCK' ? 'Cuánto nos había costado' : 'Cuánto costó'}</p>
            ${campoPlata('costo', r.costo, dato)}` : ''}
          ${r.origen === 'COMPRA' ? `<p class="pregunta">Dónde se compró <small>(opcional)</small></p>
            ${lugares.length ? `<div class="fila" style="margin-bottom:8px">${lugares.map(l => opcion('lugar', l.nombre, esc(l.nombre), r.lugar === l.nombre, dato)).join('')}</div>` : ''}
            <input class="campo" data-c="lugar" ${dato} maxlength="60" autocomplete="off" placeholder="${lugares.length ? 'Otro lugar' : 'Nombre del local'}" value="${esc(lugarEscrito)}">` : ''}
          ${r.origen ? `<p class="pregunta">${r.origen === 'STOCK' ? 'De quién era el repuesto' : 'Quién puso la plata'}</p>
            ${opcionesPersona('pago', r.pagado_por || (r.origen === 'STOCK' ? S.duenoId : null), dato)}` : ''}
        </div>`;
      }).join('')}`;
  }

  function pasoViaje(b) {
    return `<h1 class="paso-titulo">¿Cuánto salió el viaje?</h1>
      <p class="paso-ayuda">Ida y vuelta en auto para ir a buscar el repuesto.</p>
      <div class="fila">
        ${opcion('viaje', 'SIN', 'Sin viaje', b.viaje === 'SIN')}
        ${VIAJES.map(v => opcion('viaje', v, plata(v), b.viaje === v)).join('')}
        ${opcion('viaje', 'OTRO', 'Otro monto', b.viaje === 'OTRO')}
      </div>
      ${b.viaje === 'OTRO' ? `<p class="pregunta">Monto del viaje</p>${campoPlata('viaje_otro', b.viaje_otro)}` : ''}
      ${b.viaje !== null && b.viaje !== 'SIN' ? `<p class="pregunta">Quién puso la bencina</p>${opcionesPersona('viajepago', b.viaje_pagado_por)}` : ''}`;
  }

  function pasoManos(b) {
    const conPantalla = tienePantalla(b);
    const filas = [
      ['desarmo_id', 'Quién desarmó el equipo'],
      ['instalo_id', conPantalla ? 'Quién instaló la pantalla' : b.repuestos.length ? 'Quién instaló el repuesto' : 'Quién hizo el trabajo'],
      ['probo_id', conPantalla ? 'Quién probó la pantalla' : 'Quién probó el equipo']
    ];
    return `<h1 class="paso-titulo">¿Quién lo hizo?</h1>
      <p class="paso-ayuda">Si falta alguno, se puede dejar sin marcar.</p>
      <button type="button" class="btn-secundario btn-chico" data-a="todoyo">Lo hice todo yo</button>
      ${filas.map(([campo, texto]) => `<p class="pregunta">${texto}</p>${opcionesPersona('mano', b[campo], `data-campo="${campo}"`)}`).join('')}`;
  }

  function bloqueCobro(b) {
    const sevelin = S.duenoId ? `Sevelin (${esc(nombre(S.duenoId))})` : 'Sevelin';
    return `<p class="pregunta">Cuánto se cobró</p>${campoPlata('monto', b.monto, '', '25.000')}
      <p class="pregunta">Cómo pagó</p>
      <div class="fila">${MEDIOS.map(m => opcion('medio', m.id, m.nombre, b.medio === m.id, '', 'ancha')).join('')}</div>
      <p class="pregunta">Dónde se cobró</p>
      <button type="button" class="casilla${b.en_caja ? ' on' : ''}" data-a="encaja" role="checkbox" aria-checked="${b.en_caja ? 'true' : 'false'}">
        <i>${b.en_caja ? '✓' : ''}</i><span><b>Se pasó por la caja del POS</b><small>${b.en_caja ? 'La venta queda en el POS; aquí solo se anota.' : 'Sin marcar: se cobró aquí, en la app.'}</small></span></button>
      ${b.en_caja ? `<p class="pregunta">N° de la venta en el POS <small>(opcional)</small></p>
        <input class="campo" data-c="venta_numero" maxlength="20" inputmode="numeric" autocomplete="off" placeholder="412" value="${esc(b.venta_numero)}">`
        : `<p class="pregunta">Quién recibió la plata</p>
        <div class="fila">
          ${S.duenoId ? opcion('recibio', S.duenoId, sevelin, mismo(b.recibio, S.duenoId), '', 'ancha') : ''}
          ${S.papaId ? opcion('recibio', S.papaId, esc(nombrePapa()), mismo(b.recibio, S.papaId), '', 'ancha') : ''}
        </div>`}`;
  }

  function pasoCobro(b) {
    return `<h1 class="paso-titulo">¿Ya se cobró?</h1>
      <div class="fila">
        ${opcion('cobrado', 'no', 'Pendiente de entrega', b.cobrado === false, '', 'ancha')}
        ${opcion('cobrado', 'si', 'Ya se cobró', b.cobrado === true, '', 'ancha')}
      </div>
      ${b.cobrado === false ? `<p class="pregunta">Precio acordado con el cliente <small>(opcional)</small></p>${campoPlata('precio_acordado', b.precio_acordado, '', '25.000')}` : ''}
      ${b.cobrado === true ? bloqueCobro(b) : ''}`;
  }

  function resumenDeBorrador(b) {
    const { trabajo, repuestos } = trabajoDeBorrador(b);
    const c = cuentasDe(trabajo, repuestos);
    const eq = equipo(b.equipo_tipo);
    const viaje = hayCompra(b) ? montoViaje(b) : 0;
    const quien = (id) => (id ? esc(nombre(id)) : 'Sin anotar');
    return `<div class="tarjeta">
        <div class="dato"><span>Equipo</span><span>${eq.icono} ${esc(b.equipo_modelo)}</span></div>
        <div class="dato"><span>El trabajo es de</span><span>${b.es_del_papa ? esc(nombrePapa()) : 'Sevelin'}</span></div>
        ${b.cliente.trim() ? `<div class="dato"><span>Cliente o nota</span><span>${esc(b.cliente)}</span></div>` : ''}
      </div>
      <p class="seccion">Repuestos</p>
      <div class="tarjeta">
        ${repuestos.length ? repuestos.map(r => `<div class="dato"><span>${esc(r.nombre)}${r.calidad ? ' · ' + esc(r.calidad) : ''}<br>
          <small>${r.origen === 'STOCK' ? 'Lo teníamos' : 'Se compró' + (r.lugar ? ' en ' + esc(r.lugar) : '')}${r.pagado_por ? ' · ' + (r.origen === 'STOCK' ? 'era de ' : 'puso ') + esc(nombre(r.pagado_por)) : ''}</small></span>
          <span>${plata(r.costo)}</span></div>`).join('') : '<div class="dato"><span>Sin repuesto</span><span>Solo mano de obra</span></div>'}
        ${viaje > 0 ? `<div class="dato"><span>Viaje ida y vuelta<br><small>puso ${esc(nombre(b.viaje_pagado_por))}</small></span><span>${plata(viaje)}</span></div>` : ''}
      </div>
      <p class="seccion">Quién lo hizo</p>
      <div class="tarjeta">
        <div class="dato"><span>Desarmó</span><span>${quien(b.desarmo_id)}</span></div>
        <div class="dato"><span>Instaló</span><span>${quien(b.instalo_id)}</span></div>
        <div class="dato"><span>Probó</span><span>${quien(b.probo_id)}</span></div>
      </div>
      <p class="seccion">Cobro</p>
      <div class="tarjeta">
        ${b.cobrado ? `<div class="dato"><span>Cobrado</span><span>${plata(aNumero(b.monto))} · ${esc((MEDIOS.find(m => m.id === b.medio) || {}).nombre || '')}</span></div>
          <div class="dato"><span>${b.en_caja ? 'Dónde' : 'Recibió la plata'}</span><span>${b.en_caja ? 'Caja del POS' : mismo(b.recibio, S.duenoId) ? 'Sevelin' : esc(nombre(b.recibio))}</span></div>`
          : `<div class="dato"><span>Estado</span><span>Pendiente de entrega</span></div>
          ${aNumero(b.precio_acordado) !== null ? `<div class="dato"><span>Precio acordado</span><span>${plata(aNumero(b.precio_acordado))}</span></div>` : ''}`}
      </div>
      <p class="seccion">Cuentas</p>
      ${frasesDeCuentas({ ...trabajo, cobrado_monto: aNumero(b.monto) || 0 }, c) || '<div class="cuenta gris">Nadie puso plata por otro en este trabajo.</div>'}`;
  }

  function vistaAsistente() {
    const b = S.borrador;
    const pasos = pasosDe(b);
    if (S.paso >= pasos.length) S.paso = pasos.length - 1;
    const paso = pasos[S.paso];
    const cuerpo = paso === 'equipo' ? pasoEquipo(b) : paso === 'repuestos' ? pasoRepuestos(b) : paso === 'costos' ? pasoCostos(b)
      : paso === 'viaje' ? pasoViaje(b) : paso === 'manos' ? pasoManos(b) : paso === 'cobro' ? pasoCobro(b)
        : `<h1 class="paso-titulo">Revisa y guarda</h1>${resumenDeBorrador(b)}`;
    const ultimo = S.paso === pasos.length - 1;
    return barra(S.editando ? `Corregir trabajo #${S.editando.id}` : 'Nuevo trabajo', { atras: true, derecha: `<span class="barra-quien">${NOMBRE_PASO[paso]}</span>` }) +
      `<main class="cuerpo">
        <div class="pasos" aria-hidden="true">${pasos.map((_p, i) => `<i class="${i <= S.paso ? 'hecho' : ''}"></i>`).join('')}</div>
        ${cuerpo}
        ${S.errorPaso ? `<div class="error-paso" role="alert">${esc(S.errorPaso)}</div>` : ''}
      </main>
      <div class="pie-fijo"><div class="dentro">
        ${S.paso > 0 ? '<button type="button" class="btn-secundario" data-a="atras">Atrás</button>' : ''}
        <button type="button" class="btn-principal" data-a="${ultimo ? 'guardar' : 'siguiente'}" ${S.guardando ? 'disabled' : ''}>${ultimo ? (S.guardando ? 'Guardando…' : 'Guardar trabajo') : 'Siguiente'}</button>
      </div></div>`;
  }

  /* ---------- Detalle de un trabajo ---------- */
  function vistaDetalle() {
    const t = S.detalle;
    if (!t) return barra('Trabajo', { atras: true }) + '<main class="cuerpo"><p class="cargando">Cargando…</p></main>';
    const eq = equipo(t.equipo_tipo);
    if (t.limitado) {
      return barra(`Trabajo #${t.id}`, { atras: true }) + `<main class="cuerpo">
        <div class="tarjeta">
          <div class="dato"><span>Equipo</span><span>${eq.icono} ${esc(t.equipo_modelo)}</span></div>
          <div class="dato"><span>Repuestos</span><span>${esc((t.repuestos || []).map(r => r.nombre + (r.calidad ? ' ' + r.calidad : '')).join(', ') || 'Sin repuesto')}</span></div>
          <div class="dato"><span>Registró</span><span>${esc(nombre(t.registrado_por))}</span></div>
          <div class="dato"><span>Estado</span><span>${t.estado === 'COBRADO' ? 'Cobrado' : 'Pendiente de entrega'}</span></div>
        </div>
        <div class="cuenta gris">El detalle de la plata lo ve quien participó en el trabajo y el administrador.</div>
      </main>
      ${t.estado === 'PENDIENTE' ? '<div class="pie-fijo"><div class="dentro"><button type="button" class="btn-principal" data-a="cobrar">Entregar y cobrar</button></div></div>' : ''}`;
    }
    const quien = (id) => (id ? esc(nombre(id)) : 'Sin anotar');
    const medio = (MEDIOS.find(m => m.id === t.cobrado_medio) || {}).nombre || '';
    const acciones = { CREADO: 'Lo registró', EDITADO: 'Lo corrigió', COBRADO: 'Lo cobró', ANULADO: 'Lo anuló' };
    const botones = [];
    if (t.puede_editar && t.estado !== 'ANULADO') botones.push('<button type="button" class="btn-secundario" data-a="corregir">Corregir</button>');
    if (t.estado === 'PENDIENTE') botones.push('<button type="button" class="btn-principal" data-a="cobrar">Entregar y cobrar</button>');
    return barra(`Trabajo #${t.id}`, { atras: true }) + `<main class="cuerpo">
      <div class="tarjeta">
        <div class="dato"><span>Equipo</span><span>${eq.icono} ${esc(t.equipo_modelo)}</span></div>
        <div class="dato"><span>El trabajo es de</span><span>${t.va_al_pozo ? esc(nombrePapa()) : 'Sevelin'}</span></div>
        ${t.cliente ? `<div class="dato"><span>Cliente o nota</span><span>${esc(t.cliente)}</span></div>` : ''}
        <div class="dato"><span>Registró</span><span>${esc(nombre(t.registrado_por))} · ${fechaCorta(t.creado_en)}</span></div>
      </div>
      <p class="seccion">Repuestos</p>
      <div class="tarjeta">
        ${t.repuestos.length ? t.repuestos.map(r => `<div class="dato"><span>${esc(r.nombre)}${r.calidad ? ' · ' + esc(r.calidad) : ''}<br>
          <small>${r.origen === 'STOCK' ? 'Lo teníamos' : 'Se compró' + (r.lugar ? ' en ' + esc(r.lugar) : '')}${r.pagado_por ? ' · ' + (r.origen === 'STOCK' ? 'era de ' : 'puso ') + esc(nombre(r.pagado_por)) : ''}</small></span>
          <span>${plata(r.costo)}</span></div>`).join('') : '<div class="dato"><span>Sin repuesto</span><span>Solo mano de obra</span></div>'}
        ${t.viaje_monto > 0 ? `<div class="dato"><span>Viaje ida y vuelta<br><small>puso ${esc(nombre(t.viaje_pagado_por))}</small></span><span>${plata(t.viaje_monto)}</span></div>` : ''}
      </div>
      <p class="seccion">Quién lo hizo</p>
      <div class="tarjeta">
        <div class="dato"><span>Desarmó</span><span>${quien(t.desarmo_id)}</span></div>
        <div class="dato"><span>Instaló</span><span>${quien(t.instalo_id)}</span></div>
        <div class="dato"><span>Probó</span><span>${quien(t.probo_id)}</span></div>
      </div>
      <p class="seccion">Cobro</p>
      <div class="tarjeta">
        ${t.estado === 'COBRADO' ? `<div class="dato"><span>Cobrado</span><span>${plata(t.cobrado_monto)} · ${esc(medio)}</span></div>
          <div class="dato"><span>${t.cobrado_donde === 'CAJA_POS' ? 'Dónde' : 'Recibió la plata'}</span><span>${t.cobrado_donde === 'CAJA_POS' ? 'Caja del POS' + (t.venta_numero ? ' · venta ' + esc(t.venta_numero) : '') : mismo(t.cobrado_recibio, S.duenoId) ? 'Sevelin' : esc(nombre(t.cobrado_recibio))}</span></div>
          <div class="dato"><span>Fecha</span><span>${fechaCorta(t.cobrado_fecha)} · cobró ${esc(nombre(t.cobrado_por))}</span></div>`
          : t.estado === 'ANULADO' ? `<div class="dato"><span>Estado</span><span>Anulado</span></div><div class="dato"><span>Motivo</span><span>${esc(t.anulado_motivo || '')}</span></div>`
            : `<div class="dato"><span>Estado</span><span>Pendiente de entrega</span></div>
          ${t.precio_acordado !== null && t.precio_acordado !== undefined ? `<div class="dato"><span>Precio acordado</span><span>${plata(t.precio_acordado)}</span></div>` : ''}`}
      </div>
      ${t.estado !== 'ANULADO' ? `<p class="seccion">Cuentas</p>${frasesDeCuentas(t, t.cuentas) || '<div class="cuenta gris">Nadie puso plata por otro en este trabajo.</div>'}` : ''}
      ${(t.historial || []).length ? `<p class="seccion">Historial</p><div class="tarjeta">${t.historial.map(h =>
        `<div class="dato"><span>${acciones[h.accion] || esc(h.accion)}</span><span>${esc(h.usuario_nombre || '')} · ${fechaCorta(h.creado_en)}</span></div>`).join('')}</div>` : ''}
      ${S.admin && t.estado !== 'ANULADO' ? '<p style="text-align:center;margin-top:18px"><button type="button" class="btn-enlace" data-a="anular" style="color:var(--rojo)">Anular este trabajo</button></p>' : ''}
    </main>
    ${botones.length ? `<div class="pie-fijo"><div class="dentro">${botones.join('')}</div></div>` : ''}`;
  }

  /* Cómo quedan las cuentas con el cobro que se está escribiendo. */
  function adelantoDeCobro() {
    const t = S.detalle, b = S.cobro;
    if (t.limitado || faltaEnCobro(b)) return '';
    const trabajo = { ...t, estado: 'COBRADO', cobrado_monto: aNumero(b.monto) || 0, cobrado_donde: b.en_caja ? 'CAJA_POS' : 'APP', cobrado_recibio: b.en_caja ? S.duenoId : b.recibio };
    return `<p class="seccion">Cuentas</p>${frasesDeCuentas(trabajo, cuentasDe(trabajo, t.repuestos))}`;
  }

  function vistaCobrar() {
    const t = S.detalle, b = S.cobro;
    return barra(`Cobrar trabajo #${t.id}`, { atras: true }) + `<main class="cuerpo">
      <h1 class="paso-titulo">${equipo(t.equipo_tipo).icono} ${esc(t.equipo_modelo)}</h1>
      ${!t.limitado && t.precio_acordado !== null && t.precio_acordado !== undefined ? `<p class="paso-ayuda">Precio acordado: ${plata(t.precio_acordado)}</p>` : ''}
      ${bloqueCobro(b)}
      <div id="adelantoCobro">${adelantoDeCobro()}</div>
      ${S.errorPaso ? `<div class="error-paso" role="alert">${esc(S.errorPaso)}</div>` : ''}
    </main>
    <div class="pie-fijo"><div class="dentro">
      <button type="button" class="btn-principal" data-a="confirmarcobro" ${S.guardando ? 'disabled' : ''}>${S.guardando ? 'Guardando…' : 'Confirmar cobro'}</button>
    </div></div>`;
  }

  /* ---------- Cuentas (solo admin) ---------- */
  function vistaCuentas() {
    const c = S.cuentas;
    if (!c) return '<p class="cargando">Sacando las cuentas…</p>';
    const m = c.del_mes;
    const saldos = c.saldos.length ? c.saldos.map(s => `<div class="cuenta">
        <b>${plata(s.monto)}</b><br>${esc(nombre(s.de))} le debe a ${esc(nombre(s.a))}
        <div style="margin-top:8px"><button type="button" class="btn-secundario btn-chico" data-a="devolucion" data-de="${Number(s.de)}" data-para="${Number(s.a)}" data-monto="${Number(s.monto)}">Anotar devolución</button></div>
      </div>`).join('') : '<div class="cuenta verde">Cuentas claras: nadie le debe a nadie.</div>';
    return `<p class="seccion" style="margin-top:4px">Hoy, entre todos los trabajos cobrados</p>
      ${saldos}
      ${c.sin_cobrar.map(s => `<div class="cuenta ambar">En trabajos sin cobrar, ${esc(nombre(s.a))} tiene puestos <b>${plata(s.monto)}</b>. Se devuelven cuando se cobren.</div>`).join('')}
      <p class="seccion">El mes</p>
      <div class="mes">
        <button type="button" data-a="mes" data-v="-1" aria-label="Mes anterior">‹</button><b>${esc(nombreMes(c.mes))}</b>
        <button type="button" data-a="mes" data-v="1" aria-label="Mes siguiente" ${c.mes >= String(c.hoy).slice(0, 7) ? 'disabled' : ''}>›</button>
      </div>
      <div class="numeros">
        <div class="numero"><small>Trabajos cobrados</small><b>${m.trabajos}</b></div>
        <div class="numero"><small>Cobrado</small><b>${plata(m.cobrado)}</b></div>
        <div class="numero"><small>Repuestos</small><b>${plata(m.costo_repuestos)}</b></div>
        <div class="numero"><small>Viajes</small><b>${plata(m.costo_viaje)}</b></div>
        <div class="numero"><small>Ganancia</small><b>${plata(m.ganancia)}</b></div>
        <div class="numero"><small>Al pozo de ${esc(nombrePapa())}</small><b>${plata(m.aporte_pozo)}</b></div>
      </div>
      <p class="trabajo-linea" style="margin:8px 2px">${m.de_patricio} de ${esc(nombrePapa())} · ${m.de_sevelin} de Sevelin</p>
      ${c.puesto_mes.length ? `<p class="seccion">Quién puso plata este mes</p><div class="tarjeta">${c.puesto_mes.map(p =>
        `<div class="dato"><span>${esc(nombre(p.persona_id))}<br><small>repuestos ${plata(p.repuestos)} · bencina ${plata(p.viaje)}</small></span><span>${plata(p.repuestos + p.viaje)}</span></div>`).join('')}</div>` : ''}
      ${c.hecho_mes.length ? `<p class="seccion">Quién hizo qué este mes</p><div class="tarjeta">${c.hecho_mes.map(h =>
        `<div class="dato"><span>${esc(nombre(h.persona_id))}</span><span>desarmó ${h.desarmo} · instaló ${h.instalo} · probó ${h.probo}</span></div>`).join('')}</div>` : ''}
      ${c.movimientos.length ? `<p class="seccion">De dónde sale cada deuda del mes</p><div class="tarjeta">${c.movimientos.map(x =>
        `<div class="dato"><span>#${Number(x.trabajo_id)} ${esc(x.equipo_modelo)}<br><small>${esc(nombre(x.de))} → ${esc(nombre(x.a))} · ${fechaCorta(x.fecha)}</small></span><span>${plata(x.monto)}</span></div>`).join('')}</div>` : ''}
      ${c.pagos.length ? `<p class="seccion">Devoluciones anotadas</p><div class="tarjeta">${c.pagos.map(p =>
        `<div class="dato"><span>${esc(nombre(p.de_usuario))} → ${esc(nombre(p.a_usuario))}<br><small>${fechaCorta(p.fecha)}${p.nota ? ' · ' + esc(p.nota) : ''}</small>
          <br><button type="button" class="btn-enlace" data-a="anularpago" data-v="${Number(p.id)}" style="padding:2px 0;color:var(--rojo)">Anular</button></span><span>${plata(p.monto)}</span></div>`).join('')}</div>` : ''}`;
  }

  function pintar() {
    if (S.vista === 'login') $app.innerHTML = vistaLogin();
    else if (S.vista === 'inicio') $app.innerHTML = vistaInicio();
    else if (S.vista === 'asistente') $app.innerHTML = vistaAsistente();
    else if (S.vista === 'detalle') $app.innerHTML = vistaDetalle();
    else if (S.vista === 'cobrar') $app.innerHTML = vistaCobrar();
    else if (S.vista === 'sinred') {
      $app.innerHTML = `<div class="vacio" style="padding-top:90px"><b>No se pudo abrir el taller</b>${esc(S.errorLogin)}
        <p><button type="button" class="btn-principal" data-a="reintentar">Reintentar</button></p></div>`;
    } else $app.innerHTML = '<p class="cargando">Abriendo el taller…</p>';
  }
  const arriba = () => window.scrollTo(0, 0);

  /* ---------- Acciones ---------- */
  async function abrirTrabajo(id) {
    Object.assign(S, { vista: 'detalle', detalle: null });
    pintar();
    arriba();
    try {
      S.detalle = await pedir('/taller/trabajos/' + id);
    } catch (err) {
      aviso(err.message, true);
      S.vista = 'inicio';
    }
    pintar();
  }

  async function volver() {
    if (S.vista === 'asistente') {
      const tocado = S.paso > 0 || S.borrador.equipo_tipo || S.borrador.equipo_modelo;
      if (tocado && !(await ventana({ titulo: '¿Salir sin guardar?', texto: 'Se pierde lo que llevas anotado de este trabajo.', si: 'Salir', no: 'Seguir anotando', peligro: true }))) return;
      const vuelveA = S.editando;
      Object.assign(S, { borrador: null, editando: null, errorPaso: '', vista: vuelveA ? 'detalle' : 'inicio' });
    } else if (S.vista === 'cobrar') {
      Object.assign(S, { vista: 'detalle', cobro: null, errorPaso: '' });
    } else {
      Object.assign(S, { vista: 'inicio', detalle: null });
      cargarLista();
    }
    pintar();
    arriba();
  }

  async function guardarTrabajo() {
    const b = S.borrador;
    for (const paso of pasosDe(b)) {
      const falta = faltaEnPaso(paso, b);
      if (falta) { S.paso = pasosDe(b).indexOf(paso); S.errorPaso = falta; pintar(); return; }
    }
    S.guardando = true; S.errorPaso = '';
    pintar();
    try {
      const cuerpo = cuerpoDe(b);
      let guardado;
      if (!S.editando) {
        guardado = await pedir('/taller/trabajos', { metodo: 'POST', cuerpo: { ...cuerpo, cobro: b.cobrado ? cobroDe(b) : undefined } });
      } else if (S.editando.estado === 'COBRADO') {
        guardado = await pedir('/taller/trabajos/' + S.editando.id, { metodo: 'PUT', cuerpo: { ...cuerpo, cobro: cobroDe(b) } });
      } else {
        guardado = await pedir('/taller/trabajos/' + S.editando.id, { metodo: 'PUT', cuerpo });
        if (b.cobrado) guardado = await pedir('/taller/trabajos/' + S.editando.id + '/cobrar', { metodo: 'POST', cuerpo: cobroDe(b) });
      }
      const modelo = { equipo: cuerpo.equipo_tipo, modelo: cuerpo.equipo_modelo };
      if (!S.modelos.some(m => m.equipo === modelo.equipo && m.modelo === modelo.modelo)) S.modelos.unshift(modelo);
      cuerpo.repuestos.forEach(r => { if (r.lugar && !lista('LUGAR').some(l => l.nombre === r.lugar)) S.catalogo.push({ id: 0, tipo: 'LUGAR', equipo: null, nombre: r.lugar }); });
      Object.assign(S, { borrador: null, editando: null, guardando: false });
      aviso('Trabajo guardado');
      await abrirTrabajo(guardado.id);
    } catch (err) {
      S.guardando = false;
      S.errorPaso = err.message;
      pintar();
    }
  }

  async function confirmarCobro() {
    const falta = faltaEnCobro(S.cobro);
    if (falta) { S.errorPaso = falta; pintar(); return; }
    S.guardando = true; S.errorPaso = '';
    pintar();
    try {
      await pedir('/taller/trabajos/' + S.detalle.id + '/cobrar', { metodo: 'POST', cuerpo: cobroDe(S.cobro) });
      const id = S.detalle.id;
      Object.assign(S, { cobro: null, guardando: false });
      aviso('Cobro anotado');
      await abrirTrabajo(id);
    } catch (err) {
      S.guardando = false;
      S.errorPaso = err.message;
      pintar();
    }
  }

  async function agregarALista(tipo, titulo, ejemplo) {
    const texto = await ventana({ titulo, campo: { ejemplo, tope: 60 }, si: 'Agregar' });
    if (!texto) return null;
    try {
      const nuevo = await pedir('/taller/catalogo', { metodo: 'POST', cuerpo: { tipo, nombre: texto, equipo: tipo === 'REPUESTO' ? S.borrador.equipo_tipo : null } });
      if (!S.catalogo.some(c => mismo(c.id, nuevo.id))) S.catalogo.push(nuevo);
      return nuevo.nombre;
    } catch (err) {
      aviso(err.message, true);
      return null;
    }
  }

  const ACCIONES = {
    salir: async () => { if (await ventana({ titulo: '¿Salir del taller?', texto: 'Para volver vas a escribir tu PIN.', si: 'Salir', no: 'Quedarme' })) cerrarSesion(); },
    nuevo: () => { Object.assign(S, { vista: 'asistente', borrador: borradorNuevo(), paso: 0, editando: null, errorPaso: '' }); pintar(); arriba(); },
    pestana: (v) => { S.pestana = v; S.trabajos = []; pintar(); cargarLista(); },
    abrir: (v) => abrirTrabajo(Number(v)),
    volver,
    atras: () => { S.paso = Math.max(0, S.paso - 1); S.errorPaso = ''; pintar(); arriba(); },
    siguiente: () => {
      const b = S.borrador, pasos = pasosDe(b);
      const falta = faltaEnPaso(pasos[S.paso], b);
      if (falta) { S.errorPaso = falta; pintar(); return; }
      S.errorPaso = '';
      S.paso = Math.min(pasosDe(b).length - 1, S.paso + 1);
      pintar(); arriba();
    },
    guardar: guardarTrabajo,

    equipo: (v) => {
      const b = S.borrador;
      if (b.equipo_tipo !== v) { b.equipo_tipo = v; b.repuestos = []; b.sin_repuesto = false; }
    },
    modelo: (v) => { S.borrador.equipo_modelo = v; },
    delpapa: () => { S.borrador.es_del_papa = !S.borrador.es_del_papa; },
    repuesto: (v) => {
      const b = S.borrador, i = b.repuestos.findIndex(r => r.nombre === v);
      if (i >= 0) b.repuestos.splice(i, 1);
      else { b.repuestos.push({ nombre: v, calidad: null, origen: null, costo: '', lugar: '', pagado_por: null }); b.sin_repuesto = false; }
    },
    sinrepuesto: () => { const b = S.borrador; b.sin_repuesto = !b.sin_repuesto; if (b.sin_repuesto) b.repuestos = []; },
    otrorepuesto: async () => {
      const b = S.borrador;
      const nuevo = await agregarALista('REPUESTO', '¿Qué repuesto es?', 'Flex de carga');
      if (nuevo && !b.repuestos.some(r => r.nombre === nuevo)) { b.repuestos.push({ nombre: nuevo, calidad: null, origen: null, costo: '', lugar: '', pagado_por: null }); b.sin_repuesto = false; }
    },
    calidad: (v, d) => { const r = S.borrador.repuestos[Number(d.i)]; if (r) r.calidad = r.calidad === v ? null : v; },
    otracalidad: async (_v, d) => {
      const r = S.borrador.repuestos[Number(d.i)];
      const nueva = await agregarALista('CALIDAD_PANTALLA', '¿Qué calidad de pantalla es?', 'AMOLED con marco');
      if (nueva && r) r.calidad = nueva;
    },
    origen: (v, d) => {
      const r = S.borrador.repuestos[Number(d.i)];
      if (!r) return;
      r.origen = v;
      // Lo que estaba en stock era de Sevelin, salvo que digan otra cosa. Si después resulta
      // que se compró, esa marca puesta sola se borra: quién puso la plata hay que decirlo.
      if (v === 'STOCK') { r.lugar = ''; if (!r.pagado_por) { r.pagado_por = S.duenoId; r.puestoSolo = true; } }
      else if (r.puestoSolo) { r.pagado_por = null; r.puestoSolo = false; }
    },
    lugar: (v, d) => { const r = S.borrador.repuestos[Number(d.i)]; if (r) r.lugar = r.lugar === v ? '' : v; },
    pago: (v, d) => { const r = S.borrador.repuestos[Number(d.i)]; if (r) { r.pagado_por = Number(v); r.puestoSolo = false; } },
    viaje: (v) => { S.borrador.viaje = v === 'SIN' || v === 'OTRO' ? v : Number(v); },
    viajepago: (v) => { S.borrador.viaje_pagado_por = Number(v); },
    mano: (v, d) => { const b = S.borrador; b[d.campo] = mismo(b[d.campo], v) ? null : Number(v); },
    todoyo: () => { const b = S.borrador; b.desarmo_id = b.instalo_id = b.probo_id = S.yo.id; },
    cobrado: (v) => { S.borrador.cobrado = v === 'si'; },
    medio: (v) => { (S.vista === 'cobrar' ? S.cobro : S.borrador).medio = v; },
    recibio: (v) => { (S.vista === 'cobrar' ? S.cobro : S.borrador).recibio = Number(v); },
    encaja: () => { const b = S.vista === 'cobrar' ? S.cobro : S.borrador; b.en_caja = !b.en_caja; },

    cobrar: () => {
      const t = S.detalle;
      S.cobro = { monto: !t.limitado && t.precio_acordado ? conPuntos(t.precio_acordado) : '', medio: null, recibio: null, en_caja: false, venta_numero: '', cobrado: true };
      Object.assign(S, { vista: 'cobrar', errorPaso: '' });
      pintar(); arriba();
      return false;
    },
    confirmarcobro: confirmarCobro,
    corregir: () => {
      Object.assign(S, { vista: 'asistente', borrador: borradorDesde(S.detalle), paso: 0, editando: { id: S.detalle.id, estado: S.detalle.estado }, errorPaso: '' });
      pintar(); arriba();
      return false;
    },
    anular: async () => {
      const motivo = await ventana({ titulo: '¿Anular este trabajo?', texto: 'Sale de las cuentas. Escribe por qué se anula.', campo: { ejemplo: 'El cliente se arrepintió', tope: 200 }, si: 'Anular', no: 'No anular', peligro: true });
      if (motivo === null) return false;
      if (!motivo) { aviso('Escribe por qué se anula', true); return false; }
      try {
        await pedir('/taller/trabajos/' + S.detalle.id + '/anular', { metodo: 'POST', cuerpo: { motivo } });
        aviso('Trabajo anulado');
        Object.assign(S, { vista: 'inicio', detalle: null });
        cargarLista();
      } catch (err) { aviso(err.message, true); }
      return false;
    },

    mes: (v) => {
      const [a, m] = S.mesCuentas.split('-').map(Number);
      const d = new Date(a, m - 1 + Number(v), 1);
      S.mesCuentas = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      cargarCuentas();
      return false;
    },
    devolucion: async (_v, d) => {
      const texto = await ventana({
        titulo: 'Anotar devolución', texto: `${nombre(d.de)} le devuelve plata a ${nombre(d.para)}. ¿Cuánto le devolvió?`,
        campo: { valor: conPuntos(d.monto), plata: true, tope: 12 }, si: 'Anotar'
      });
      const monto = aNumero(texto);
      if (texto === null) return false;
      if (!monto) { aviso('Escribe cuánto devolvió', true); return false; }
      try {
        await pedir('/taller/pagos', { metodo: 'POST', cuerpo: { de_usuario: Number(d.de), a_usuario: Number(d.para), monto } });
        aviso('Devolución anotada');
        cargarCuentas();
      } catch (err) { aviso(err.message, true); }
      return false;
    },
    anularpago: async (v) => {
      if (!(await ventana({ titulo: '¿Anular esta devolución?', texto: 'El saldo vuelve a como estaba antes de anotarla.', si: 'Anular', no: 'No anular', peligro: true }))) return false;
      try {
        await pedir('/taller/pagos/' + Number(v), { metodo: 'DELETE' });
        aviso('Devolución anulada');
        cargarCuentas();
      } catch (err) { aviso(err.message, true); }
      return false;
    }
  };
  /* Las que pintan por su cuenta (o no cambian nada a la vista) no repintan al terminar. */
  const NO_REPINTAR = new Set(['salir', 'nuevo', 'pestana', 'abrir', 'volver', 'atras', 'siguiente', 'guardar', 'confirmarcobro']);

  $app.addEventListener('click', async (e) => {
    const boton = e.target.closest('[data-a]');
    if (!boton || boton.disabled) return;
    const accion = ACCIONES[boton.dataset.a];
    if (!accion) return;
    const resultado = await accion(boton.dataset.v, boton.dataset);
    if (!NO_REPINTAR.has(boton.dataset.a) && resultado !== false) { S.errorPaso = ''; pintar(); }
  });

  /* Lo que se escribe va directo al borrador, sin repintar (para no perder el cursor). */
  $app.addEventListener('input', (e) => {
    const campo = e.target.dataset.c;
    if (e.target.id === 'rut') { e.target.value = formatoRut(e.target.value); return; }
    if (e.target.id === 'pin') { e.target.value = soloNumeros(e.target.value).slice(0, 8); return; }
    if (!campo) return;
    if (e.target.dataset.plata) e.target.value = conPuntos(e.target.value);
    const destino = S.vista === 'cobrar' ? S.cobro : S.borrador;
    if (!destino) return;
    if (e.target.dataset.i !== undefined) { const r = destino.repuestos[Number(e.target.dataset.i)]; if (r) r[campo] = e.target.value; }
    else destino[campo] = e.target.value;
    // El adelanto de las cuentas sigue al monto sin repintar la pantalla (repintar aquí se comería el toque siguiente).
    const $adelanto = S.vista === 'cobrar' ? document.getElementById('adelantoCobro') : null;
    if ($adelanto) $adelanto.innerHTML = adelantoDeCobro();
  });

  $app.addEventListener('submit', async (e) => {
    if (e.target.dataset.form !== 'login') return;
    e.preventDefault();
    const rut = document.getElementById('rut').value.trim();
    const pin = document.getElementById('pin').value.trim();
    if (!rut || !pin) { S.errorLogin = 'Escribe tu RUT y tu PIN.'; pintar(); return; }
    const $boton = document.getElementById('btnEntrar');
    $boton.disabled = true;
    $boton.textContent = 'Entrando…';
    guardar(CLAVE_RUT, formatoRut(rut));
    try {
      await entrar(rut, pin);
    } catch (err) {
      S.errorLogin = err.message;
      if (S.vista !== 'login') S.vista = 'login';
      pintar();
      const $pin = document.getElementById('pin');
      if ($pin) $pin.focus();
    }
  });

  /* ---------- Arranque ---------- */
  async function arrancar() {
    if (!S.token) { S.vista = 'login'; pintar(); return; }
    S.vista = 'cargando';
    pintar();
    try {
      await abrir();
    } catch (err) {
      // Sin señal no se bota la sesión: se ofrece reintentar. Si la sesión venció, pedir() ya mandó al ingreso.
      if (S.vista !== 'login') { S.vista = 'sinred'; S.errorLogin = err.message; pintar(); }
    }
  }
  ACCIONES.reintentar = () => { arrancar(); return false; };
  arrancar();
})();
