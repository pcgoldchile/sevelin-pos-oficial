/* ============================================================
   QUÉ LE FALTA A CADA PRODUCTO (dueño, 21-09-2026)
   ------------------------------------------------------------
   "Me gustaría que el diseño e información pudiera ser desplegable, ya
   que me pierdo rápido con tanta información, e ir poniendo advertencias
   o notificaciones si algo falta o está incompleto […] e igualmente que
   se activen las notificaciones de la pestaña principal del POS."

   Tres piezas que comparten UNA sola definición de "completo":

     1. Las tarjetas del editor se pliegan. Al abrir un producto queda
        desplegado lo que necesita atención y plegado lo que está bien,
        así la pantalla larga deja de serlo.
     2. Arriba del editor, la lista de lo que falta. Cada línea abre su
        sección y pone el foco en el campo.
     3. Un botón en el header con los productos del catálogo a los que
        les falta algo, para corregirlos al entrar al POS.

   LAS REGLAS NO VIVEN ACÁ. Vienen del servidor (GET /api/productos/reglas,
   ver REGLAS_PRODUCTO en api/index.js) y acá solo se evalúan sobre el
   formulario abierto. Si estuvieran escritas en los dos lados, el día que
   cambie una el aviso del header y el del editor dirían cosas distintas.
   ============================================================ */

const INTERVALO_FICHAS_MS = 30 * 60 * 1000;   // cambia cuando él edita, no solo
let intervaloFichas = null;
let reglasProducto = [];
let fichasIncompletasCache = null;
let filtroFichas = '';

/* Cómo leer del formulario abierto cada campo que las reglas miran. El
   servidor evalúa lo mismo sobre la fila de la base: acá se arma un
   "producto" con lo que hay en pantalla, que puede tener cambios todavía
   sin guardar — y justamente por eso el aviso es útil antes de guardar. */
function productoDelFormulario() {
  const val = (id) => document.getElementById(id)?.value ?? '';
  const chk = (id) => !!document.getElementById(id)?.checked;
  const fotos = (typeof fotosActivas === 'function') ? (fotosActivas() || []) : [];

  return {
    stock: Number(val('prodStock')) || 0,
    costo_unitario: Number(val('prodCosto')) || 0,
    precio_unitario: Number(val('prodPrecio')) || 0,
    precio_a_consultar: chk('prodPrecioAConsultar'),
    peso_kg: (typeof pesoKgDelFormulario === 'function') ? pesoKgDelFormulario() : Number(val('prodPeso')) || 0,
    alto_cm: Number(val('prodAlto')) || 0,
    ancho_cm: Number(val('prodAncho')) || 0,
    profundidad_cm: Number(val('prodProfundidad')) || 0,
    imagen_urls: fotos.filter(Boolean),
    descripcion: val('prodDescripcion'),
    descripcion_web: val('prodDescripcion'),
    categoria_id: document.getElementById('popFotosCategoria')?.value || null,
    categoria_web: '',
    publicado_web: chk('prodPublicadoWeb'),
    es_servicio: chk('prodEsServicio'),
    es_repuesto: chk('prodEsRepuesto'),
    stock_ilimitado: chk('prodStockIlimitado')
  };
}

/* La misma evaluación que hace el servidor, pero sobre el formulario. Las
   condiciones se describen en la regla como texto (campo/comparación) para
   no tener que reescribir acá las funciones que allá no se pueden serializar. */
const EVALUADORES = {
  costo: {
    aplica: p => !p.es_servicio && !p.es_repuesto && !p.stock_ilimitado && p.stock > 0,
    falta: p => p.costo_unitario === 0,
    foco: 'prodCosto'
  },
  precio: {
    aplica: p => !p.precio_a_consultar,
    falta: p => p.precio_unitario === 0,
    foco: 'prodPrecio'
  },
  foto: {
    aplica: p => p.publicado_web,
    falta: p => p.imagen_urls.length === 0,
    foco: 'prodFotoInput'
  },
  medidas: {
    aplica: p => !p.es_servicio && !p.stock_ilimitado && p.stock > 0,
    falta: p => !(p.peso_kg > 0) || !(p.alto_cm > 0) || !(p.ancho_cm > 0) || !(p.profundidad_cm > 0),
    foco: 'prodPeso'
  },
  descripcion: {
    aplica: p => p.publicado_web,
    falta: p => !String(p.descripcion || '').replace(/<[^>]*>/g, '').trim(),
    foco: null
  },
  categoria: {
    aplica: p => p.publicado_web,
    falta: p => !p.categoria_id && !String(p.categoria_web || '').trim(),
    foco: 'popFotosCategoria'
  }
};

async function cargarReglasProducto() {
  if (reglasProducto.length) return reglasProducto;
  try {
    reglasProducto = await API.productos.reglasCompletitud() || [];
  } catch (err) {
    console.error('No se pudieron cargar las reglas de producto:', err.message || err);
    reglasProducto = [];
  }
  return reglasProducto;
}

// ============================================================
// 1. Plegar y desplegar las tarjetas del editor
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  /* Un solo listener para todas las tarjetas: se delega en el contenedor
     porque las tarjetas no cambian, pero sí lo hace su contenido. */
  document.getElementById('view-producto-editor')?.addEventListener('click', (e) => {
    const cab = e.target.closest('.card-plegable > .card-head');
    // Un clic en un botón de la cabecera (ej. "📷 Para Instagram") no pliega
    if (!cab || e.target.closest('button, a, input, select, label')) return;
    cab.parentElement.classList.toggle('plegada');
  });

  document.getElementById('resumenCompletitudLista')?.addEventListener('click', (e) => {
    const fila = e.target.closest('[data-ir-a]');
    if (fila) irASeccion(fila.dataset.irA, fila.dataset.foco || null);
  });
  document.getElementById('btnAbrirTodo')?.addEventListener('click', () => plegarTodasLasSecciones(false));
  document.getElementById('btnPlegarTodo')?.addEventListener('click', () => plegarTodasLasSecciones(true));

  // El aviso se recalcula mientras escribe, no solo al guardar
  const disparadores = ['prodCosto', 'prodPrecio', 'prodStock', 'prodPeso', 'prodAlto', 'prodAncho',
    'prodProfundidad', 'prodPesoUnidad', 'popFotosCategoria'];
  disparadores.forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener('input', revisarCompletitudProducto);
    el?.addEventListener('change', revisarCompletitudProducto);
  });
  ['prodPublicadoWeb', 'prodEsServicio', 'prodEsRepuesto', 'prodStockIlimitado', 'prodPrecioAConsultar']
    .forEach(id => document.getElementById(id)?.addEventListener('change', revisarCompletitudProducto));

  document.getElementById('btnFichasIncompletas')?.addEventListener('click', abrirModalFichasIncompletas);
  document.getElementById('btnCerrarFichasIncompletas')?.addEventListener('click', () => cerrarModal('modalFichasIncompletas'));
  document.getElementById('fichasIncompletasFiltros')?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filtro-falta]');
    if (!chip) return;
    filtroFichas = chip.dataset.filtroFalta === filtroFichas ? '' : chip.dataset.filtroFalta;
    pintarFichasIncompletas();
  });
  document.getElementById('fichasIncompletasLista')?.addEventListener('click', (e) => {
    const fila = e.target.closest('[data-abrir-producto]');
    if (!fila) return;
    cerrarModal('modalFichasIncompletas');
    abrirProductoDesdeAviso(Number(fila.dataset.abrirProducto));
  });
});

function plegarTodasLasSecciones(plegar) {
  document.querySelectorAll('#view-producto-editor .card-plegable')
    .forEach(c => c.classList.toggle('plegada', plegar));
}

function irASeccion(seccion, foco) {
  const card = document.querySelector(`#view-producto-editor [data-seccion="${seccion}"]`);
  if (!card) return;
  card.classList.remove('plegada');
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('seccion-destacada');
  setTimeout(() => card.classList.remove('seccion-destacada'), 1600);
  if (foco) setTimeout(() => document.getElementById(foco)?.focus(), 350);
}

// ============================================================
// 2. El aviso dentro del editor
// ============================================================

/* Se llama al abrir un producto y cada vez que cambia algo que una regla
   mira. Deja plegado lo que está bien y abierto lo que falta. */
function revisarCompletitudProducto(opciones) {
  const panel = document.getElementById('resumenCompletitud');
  const lista = document.getElementById('resumenCompletitudLista');
  const titulo = document.getElementById('resumenCompletitudTitulo');
  if (!panel || !lista || !reglasProducto.length) return [];

  const p = productoDelFormulario();
  const faltantes = [];
  const estadoPorSeccion = {};

  for (const regla of reglasProducto) {
    const ev = EVALUADORES[regla.clave];
    if (!ev) continue;
    const aplica = ev.aplica(p);
    const falta = aplica && ev.falta(p);
    if (falta) {
      faltantes.push({ ...regla, foco: ev.foco });
      const previo = estadoPorSeccion[regla.seccion];
      // Una sección con algo crítico se muestra crítica, aunque tenga más cosas
      estadoPorSeccion[regla.seccion] = (previo === 'critico' || regla.gravedad === 'critico') ? 'critico' : 'pendiente';
    } else if (aplica && !estadoPorSeccion[regla.seccion]) {
      estadoPorSeccion[regla.seccion] = 'ok';
    }
  }

  // Las chapitas de cada tarjeta
  document.querySelectorAll('#view-producto-editor .estado-seccion').forEach(chip => {
    const estado = estadoPorSeccion[chip.dataset.estado];
    chip.className = 'estado-seccion';
    if (!estado) { chip.textContent = ''; return; }
    if (estado === 'ok') { chip.textContent = '✔️'; chip.classList.add('estado-ok'); chip.title = 'Completo'; return; }
    chip.textContent = estado === 'critico' ? '⚠️ falta algo' : 'falta algo';
    chip.classList.add(estado === 'critico' ? 'estado-critico' : 'estado-pendiente');
    chip.title = 'Le falta información';
  });

  if (!faltantes.length) {
    panel.hidden = true;
    lista.innerHTML = '';
  } else {
    panel.hidden = false;
    const criticos = faltantes.filter(f => f.gravedad === 'critico').length;
    titulo.textContent = criticos
      ? `⚠️ Le faltan ${faltantes.length} cosa(s), ${criticos} importante(s)`
      : `Le faltan ${faltantes.length} cosa(s) por completar`;
    lista.innerHTML = faltantes.map(f => `
      <button type="button" class="falta-fila ${f.gravedad === 'critico' ? 'falta-critica' : ''}"
              data-ir-a="${escHtml(f.seccion)}" data-foco="${escHtml(f.foco || '')}">
        <span class="falta-titulo">${f.gravedad === 'critico' ? '⚠️' : '•'} ${escHtml(f.titulo)}</span>
        <small>${escHtml(f.porque)}</small>
      </button>`).join('');
  }

  /* Al ABRIR un producto: se pliega todo lo que está bien y se deja abierto
     lo que falta. Después no se vuelve a tocar el plegado — si él abrió una
     tarjeta a mano, que se quede como la dejó. */
  if (opciones?.plegarSegunEstado) {
    document.querySelectorAll('#view-producto-editor .card-plegable').forEach(card => {
      const estado = estadoPorSeccion[card.dataset.seccion];
      const esBasico = card.dataset.seccion === 'basico';
      card.classList.toggle('plegada', !esBasico && estado !== 'critico' && estado !== 'pendiente');
    });
  }

  return faltantes;
}

// ============================================================
// 3. El aviso del header
// ============================================================

document.addEventListener('pos:sesion-iniciada', () => {
  if (intervaloFichas) { clearInterval(intervaloFichas); intervaloFichas = null; }
  if (!esAdmin()) return;
  cargarReglasProducto();
  actualizarAvisoFichas();
  intervaloFichas = setInterval(actualizarAvisoFichas, INTERVALO_FICHAS_MS);
});

async function actualizarAvisoFichas() {
  const btn = document.getElementById('btnFichasIncompletas');
  const texto = document.getElementById('textoFichasIncompletas');
  if (!btn || !texto || !tokenActual() || !esAdmin()) return;

  try {
    fichasIncompletasCache = await API.productos.incompletos();
    if (Array.isArray(fichasIncompletasCache?.reglas) && fichasIncompletasCache.reglas.length) {
      reglasProducto = fichasIncompletasCache.reglas;
    }
    const total = Number(fichasIncompletasCache?.total) || 0;
    if (!total) { btn.hidden = true; return; }

    const criticos = Number(fichasIncompletasCache?.criticos) || 0;
    texto.textContent = `${total} por completar`;
    btn.classList.toggle('fichas-criticas', criticos > 0);
    btn.title = criticos
      ? `${criticos} producto(s) con algo importante sin cargar (costo, precio o foto)`
      : `${total} producto(s) con información pendiente`;
    btn.hidden = false;
  } catch (err) {
    console.error('Error al revisar las fichas de producto:', err.message || err);
  }
}

function abrirModalFichasIncompletas() {
  if (!fichasIncompletasCache) return;
  filtroFichas = '';
  pintarFichasIncompletas();
  document.getElementById('modalFichasIncompletas')?.classList.add('show');
}

function pintarFichasIncompletas() {
  const cont = document.getElementById('fichasIncompletasLista');
  const resumen = document.getElementById('fichasIncompletasResumen');
  const filtros = document.getElementById('fichasIncompletasFiltros');
  const d = fichasIncompletasCache;
  if (!cont || !d) return;

  const reglaDe = (clave) => (reglasProducto.find(r => r.clave === clave) || { titulo: clave, gravedad: 'pendiente' });

  if (resumen) {
    resumen.textContent = `${d.total} de ${d.revisados} productos vivos tienen algo sin cargar`
      + (d.criticos ? ` · ${d.criticos} con algo importante (costo, precio o foto).` : '.');
  }

  if (filtros) {
    const claves = Object.keys(d.porFalta || {})
      .sort((a, b) => (d.porFalta[b] - d.porFalta[a]));
    filtros.innerHTML = `<button class="chip ${filtroFichas ? '' : 'active'}" data-filtro-falta="">Todos (${d.total})</button>`
      + claves.map(c => `<button class="chip ${filtroFichas === c ? 'active' : ''}" data-filtro-falta="${escHtml(c)}">${escHtml(reglaDe(c).titulo)} (${d.porFalta[c]})</button>`).join('');
  }

  const lista = (d.productos || []).filter(p => !filtroFichas || p.faltan.includes(filtroFichas));
  if (!lista.length) {
    cont.innerHTML = '<p class="modal-hint">Nada por acá.</p>';
    return;
  }

  cont.innerHTML = lista.map(p => `
    <div class="agotado-fila">
      <div class="agotado-cabecera">
        <div class="agotado-datos">
          <strong>${escHtml(p.nombre || 'Sin nombre')}</strong>
          <small>${p.sku ? escHtml(p.sku) + ' · ' : ''}stock ${num(p.stock)}${p.publicado_web ? ' · 🌐 publicado' : ''}</small>
          <small>${p.faltan.map(c => {
            const r = reglaDe(c);
            return `<span class="falta-chip ${r.gravedad === 'critico' ? 'falta-chip-critica' : ''}">${escHtml(r.titulo)}</span>`;
          }).join(' ')}</small>
        </div>
      </div>
      <div class="agotado-acciones">
        <button class="btn btn-outline btn-sm" data-abrir-producto="${p.id}">✏️ Completar ahora</button>
      </div>
    </div>`).join('');
}

/* Abre el editor de ese producto. Se busca en el catálogo ya cargado; si
   todavía no está (sesión recién iniciada), se fuerza una carga. */
async function abrirProductoDesdeAviso(id) {
  if (typeof activarVista === 'function') activarVista('view-productos');
  try {
    if (typeof cargarProductos === 'function' &&
        (typeof productsList === 'undefined' || !productsList.length)) {
      await cargarProductos(true);
    }
    const p = (typeof productsList !== 'undefined')
      ? productsList.find(x => String(x.id) === String(id)) : null;
    if (!p) { showToast('No se encontró ese producto en el catálogo', 'err'); return; }
    if (typeof abrirModalProducto === 'function') abrirModalProducto(p);
  } catch (err) {
    showToast(err.message || 'No se pudo abrir el producto', 'err');
  }
}
