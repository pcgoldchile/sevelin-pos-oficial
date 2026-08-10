// ==========================================
// API.JS - Único punto de contacto con el backend
// ------------------------------------------
// El navegador ya NO conoce Supabase: solo llama a /api/... con el
// token JWT que entrega /api/login. Las llaves viven en el servidor.
// ==========================================

// En Vercel el backend vive en el mismo dominio, así que basta "/api".
// Para probar el frontend en local contra un backend distinto, ejecuta
// en la consola: localStorage.setItem('pos_api_base', 'http://localhost:3000/api')
const API_BASE = localStorage.getItem('pos_api_base') || '/api';

const TOKEN_KEY = 'pos_token';   // sessionStorage: se borra al cerrar la pestaña
const ROL_KEY = 'pos_rol';

function guardarSesion(token, rol) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(ROL_KEY, rol);
}
function borrarSesion() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(ROL_KEY);
}
function tokenActual() { return sessionStorage.getItem(TOKEN_KEY); }
function rolActual() { return sessionStorage.getItem(ROL_KEY); }
function esAdmin() { return rolActual() === 'admin'; }

async function apiRequest(path, { method = 'GET', body, silencioso = false } = {}) {
  const token = tokenActual();

  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (_) {
    throw new Error('No se pudo contactar el servidor. Revisa tu conexión.');
  }

  // Sesión caída: se vuelve a pedir el PIN
  if (res.status === 401 && !silencioso) {
    borrarSesion();
    if (typeof manejarSesionExpirada === 'function') manejarSesionExpirada();
    throw new Error('Tu sesión expiró. Ingresa el PIN nuevamente.');
  }

  let datos = null;
  try { datos = await res.json(); } catch (_) { datos = null; }

  if (!res.ok) throw new Error((datos && datos.error) || 'Error del servidor');
  return datos;
}

const API = {
  base: API_BASE,

  login: (pin) => apiRequest('/login', { method: 'POST', body: { pin }, silencioso: true }),
  me: () => apiRequest('/me', { silencioso: true }),

  productos: {
    listar: () => apiRequest('/productos'),
    crear: (p) => apiRequest('/productos', { method: 'POST', body: p }),
    actualizar: (id, p) => apiRequest(`/productos/${id}`, { method: 'PUT', body: p }),
    eliminar: (id) => apiRequest(`/productos/${id}`, { method: 'DELETE' }),
    // Operaciones masivas: exigen reconfirmar el PIN de administrador
    eliminarTodos: (pin) => apiRequest('/productos/todos', { method: 'DELETE', body: { pin } }),
    eliminarLote: (ids, pin) => apiRequest('/productos/eliminar-lote', { method: 'POST', body: { ids, pin } }),

    /* Importación masiva. Exige el PIN de administrador y un modo:
         'omitir'     → deja intactos los productos que ya existen
         'actualizar' → sobrescribe datos y stock de los que ya existen  */
    importar: (productos, modo, pin) =>
      apiRequest('/productos/bulk', { method: 'POST', body: { productos, modo, pin } }),

    /* Búsqueda exacta por código para el escáner de cámara.
       El backend prueba código de barras, luego SKU y luego número de serie.
       silencioso: un 404 aquí es un resultado normal ("no existe"), no un
       error de sesión que deba cerrar la pantalla. */
    buscarPorCodigo: (codigo) =>
      apiRequest(`/productos/buscar?codigo=${encodeURIComponent(codigo)}`, { silencioso: true }),

    // Capas de costo (PEPS / FIFO)
    listarLotes: (id) => apiRequest(`/productos/${id}/lotes`),
    crearLote: (id, lote) => apiRequest(`/productos/${id}/lotes`, { method: 'POST', body: lote }),
    eliminarLote_capa: (id, loteId) => apiRequest(`/productos/${id}/lotes/${loteId}`, { method: 'DELETE' })
  },

  ventas: {
    listar: (desde, hasta, estado) => {
      const q = new URLSearchParams();
      if (desde) q.set('desde', desde);
      if (hasta) q.set('hasta', hasta);
      if (estado) q.set('estado', estado);
      const cadena = q.toString();
      return apiRequest('/ventas' + (cadena ? `?${cadena}` : ''));
    },
    // `pagos` solo se manda en cobros mixtos; el backend lo revalida
    registrarPago: (id, metodo, pagos) => apiRequest(`/ventas/${id}/pago`, {
      method: 'POST', body: { metodo_pago_final: metodo, pagos: pagos || null }
    }),
    // Cambia solo el tipo de DTE (edición rápida desde el Historial)
    cambiarDTE: (id, tipo) => apiRequest(`/ventas/${id}/dte`, { method: 'POST', body: { tipo_dte: tipo } }),
    importar: (ventas) => apiRequest('/ventas/importar', { method: 'POST', body: { ventas } }),
    detalle: (id) => apiRequest(`/ventas/${id}`),
    crear: (venta) => apiRequest('/ventas', { method: 'POST', body: venta }),
    actualizar: (id, cambios) => apiRequest(`/ventas/${id}`, { method: 'PUT', body: cambios }),
    eliminar: (id) => apiRequest(`/ventas/${id}`, { method: 'DELETE' }),
    eliminarPeriodo: (desde, hasta, pin) => apiRequest(`/ventas?desde=${desde}&hasta=${hasta}`, { method: 'DELETE', body: { pin } }),
    eliminarTodo: (pin) => apiRequest('/ventas?todo=true', { method: 'DELETE', body: { pin } }),
    // Devuelve el stock de los productos antes de borrar
    eliminarLote: (ids, pin) => apiRequest('/ventas/eliminar-lote', { method: 'POST', body: { ids, pin } })
  },

  compras: {
    listar: (filtros = {}) => {
      const q = new URLSearchParams();
      Object.entries(filtros).forEach(([k, v]) => { if (v) q.set(k, v); });
      const cadena = q.toString();
      return apiRequest('/compras' + (cadena ? `?${cadena}` : ''));
    },
    crear: (c) => apiRequest('/compras', { method: 'POST', body: c }),
    actualizar: (id, c) => apiRequest(`/compras/${id}`, { method: 'PUT', body: c }),
    eliminar: (id) => apiRequest(`/compras/${id}`, { method: 'DELETE' }),
    eliminarLote: (ids, pin) => apiRequest('/compras/eliminar-lote', { method: 'POST', body: { ids, pin } }),
    subirArchivo: (nombre, tipo, base64) => apiRequest('/compras/archivo', { method: 'POST', body: { nombre, tipo, base64 } }),

    // Clasificaciones dinámicas de gastos
    listarClasificaciones: (incluirInactivas) =>
      apiRequest('/compras/clasificaciones' + (incluirInactivas ? '?incluir_inactivas=true' : '')),
    crearClasificacion: (nombre, descripcion) =>
      apiRequest('/compras/clasificaciones', { method: 'POST', body: { nombre, descripcion } }),
    actualizarClasificacion: (id, cambios) =>
      apiRequest(`/compras/clasificaciones/${id}`, { method: 'PUT', body: cambios }),
    eliminarClasificacion: (id) =>
      apiRequest(`/compras/clasificaciones/${id}`, { method: 'DELETE' })
  },

  mermas: {
    listar: (desde, hasta) => {
      const q = new URLSearchParams();
      if (desde) q.set('desde', desde);
      if (hasta) q.set('hasta', hasta);
      const cadena = q.toString();
      return apiRequest('/mermas' + (cadena ? `?${cadena}` : ''));
    },
    registrar: (datos) => apiRequest('/mermas', { method: 'POST', body: datos })
  },

  repuestos: {
    listar: (filtros = {}) => {
      const q = new URLSearchParams();
      Object.entries(filtros).forEach(([k, v]) => { if (v) q.set(k, v); });
      const cadena = q.toString();
      return apiRequest('/repuestos' + (cadena ? `?${cadena}` : ''));
    },
    crear: (r) => apiRequest('/repuestos', { method: 'POST', body: r }),
    actualizar: (id, r) => apiRequest(`/repuestos/${id}`, { method: 'PUT', body: r }),
    eliminar: (id) => apiRequest(`/repuestos/${id}`, { method: 'DELETE' }),

    // Catálogo administrable de Área/Tipo y Categoría Base
    listarAreas: () => apiRequest('/repuestos/areas'),
    crearArea: (nombre) => apiRequest('/repuestos/areas', { method: 'POST', body: { nombre } }),
    renombrarArea: (id, nombre) => apiRequest(`/repuestos/areas/${id}`, { method: 'PUT', body: { nombre } }),
    eliminarArea: (id) => apiRequest(`/repuestos/areas/${id}`, { method: 'DELETE' }),

    listarCategorias: () => apiRequest('/repuestos/categorias'),
    crearCategoria: (nombre) => apiRequest('/repuestos/categorias', { method: 'POST', body: { nombre } }),
    renombrarCategoria: (id, nombre) => apiRequest(`/repuestos/categorias/${id}`, { method: 'PUT', body: { nombre } }),
    eliminarCategoria: (id) => apiRequest(`/repuestos/categorias/${id}`, { method: 'DELETE' })
  },

  encargos: {
    listar: (estado) => apiRequest('/encargos' + (estado ? `?estado=${encodeURIComponent(estado)}` : '')),
    detalle: (id) => apiRequest(`/encargos/${id}`),
    crear: (e) => apiRequest('/encargos', { method: 'POST', body: e }),
    actualizar: (id, e) => apiRequest(`/encargos/${id}`, { method: 'PUT', body: e }),
    abonar: (id, datos) => apiRequest(`/encargos/${id}/abono`, { method: 'POST', body: datos }),
    eliminar: (id) => apiRequest(`/encargos/${id}`, { method: 'DELETE' })
  },

  ot: {
    listar: (estado, buscar) => {
      const q = new URLSearchParams();
      if (estado) q.set('estado', estado);
      if (buscar) q.set('buscar', buscar);
      const cadena = q.toString();
      return apiRequest('/ot' + (cadena ? `?${cadena}` : ''));
    },
    detalle: (id) => apiRequest(`/ot/${id}`),
    crear: (ot) => apiRequest('/ot', { method: 'POST', body: ot }),
    actualizar: (id, ot) => apiRequest(`/ot/${id}`, { method: 'PUT', body: ot }),
    entregar: (id, datos) => apiRequest(`/ot/${id}/entrega`, { method: 'POST', body: datos }),
    // Repuestos y mano de obra asignados a la orden
    listarRepuestos: (id) => apiRequest(`/ot/${id}/repuestos`),
    agregarRepuesto: (id, item) => apiRequest(`/ot/${id}/repuestos`, { method: 'POST', body: item }),
    quitarRepuesto: (otId, id) => apiRequest(`/ot/${otId}/repuestos/${id}`, { method: 'DELETE' }),
    eliminar: (id) => apiRequest(`/ot/${id}`, { method: 'DELETE' })
  }
};
