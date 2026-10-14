// Doble en memoria de supabase-js para probar api/index.js sin tocar la base real.
// Lo usan scripts/maqueta-taller.js (la app del taller con el servidor real) y las pruebas del servidor.
// Uso:
//   const doble = require('./doble-supabase.js');
//   const { bases, rpc } = doble.instalar(rutaDelRepo);   // ANTES de require('api/index.js')
//   bases.pos.productos = [{ id: 1, ... }];               // primer createClient = POS, segundo = tienda
//   rpc.fifo_consumir = (args, base) => ({ data: null, error: null });
// Devuelve COPIAS de las filas, respeta la lista de columnas de select() y trae los filtros que usa el servidor.
const path = require('path');

const copia = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function crearCliente(base, rpcs, registro) {
  const sig = {};
  const tabla = n => (base[n] = base[n] || []);
  const sigId = n => {
    const max = tabla(n).reduce((m, f) => Math.max(m, Number(f.id) || 0), 0);
    sig[n] = Math.max(sig[n] || 0, max) + 1;
    return sig[n];
  };

  class Consulta {
    constructor(nombre) {
      this.nombre = nombre; this.op = 'select'; this.filtros = []; this.columnas = '*';
      this.devolver = true; this.modo = null; this.orden = []; this.tope = null; this.rango = null; this.opciones = {};
    }
    select(cols = '*', opciones = {}) {
      this.columnas = cols || '*'; this.opciones = opciones || {};
      if (this.op !== 'select') this.devolver = true;
      return this;
    }
    insert(filas) { this.op = 'insert'; this.filas = Array.isArray(filas) ? filas : [filas]; this.devolver = false; return this; }
    upsert(filas, opciones = {}) { this.op = 'upsert'; this.filas = Array.isArray(filas) ? filas : [filas]; this.opcionesUpsert = opciones; this.devolver = false; return this; }
    update(cambios) { this.op = 'update'; this.cambios = cambios; this.devolver = false; return this; }
    delete() { this.op = 'delete'; this.devolver = false; return this; }
    _f(fn) { this.filtros.push(fn); return this; }
    eq(c, v) { return this._f(f => f[c] === v || (f[c] != null && v != null && String(f[c]) === String(v))); }
    neq(c, v) { return this._f(f => !(f[c] === v || (f[c] != null && v != null && String(f[c]) === String(v)))); }
    overlaps(c, vs) { const s = new Set((vs || []).map(String)); return this._f(f => Array.isArray(f[c]) && f[c].some(x => s.has(String(x)))); }
    in(c, vs) { const s = new Set((vs || []).map(String)); return this._f(f => f[c] != null && s.has(String(f[c]))); }
    is(c, v) { return this._f(f => (v === null ? f[c] == null : f[c] === v)); }
    gt(c, v) { return this._f(f => f[c] != null && f[c] > v); }
    gte(c, v) { return this._f(f => f[c] != null && f[c] >= v); }
    lt(c, v) { return this._f(f => f[c] != null && f[c] < v); }
    lte(c, v) { return this._f(f => f[c] != null && f[c] <= v); }
    like(c, p) { return this.ilike(c, p, true); }
    ilike(c, p, sensible) {
      const re = new RegExp('^' + String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', sensible ? '' : 'i');
      return this._f(f => f[c] != null && re.test(String(f[c])));
    }
    not(c, op, v) {
      if (op === 'is') return this._f(f => (v === null ? f[c] != null : f[c] !== v));
      if (op === 'eq') return this.neq(c, v);
      if (op === 'in') { const s = new Set(String(v).replace(/[()]/g, '').split(',').map(x => x.trim())); return this._f(f => !s.has(String(f[c]))); }
      return this;
    }
    or() { return this; }            // no se usa en las rutas probadas: no filtra
    contains() { return this; }
    order(c, o = {}) { this.orden.push([c, o.ascending !== false]); return this; }
    limit(n) { this.tope = n; return this; }
    range(a, b) { this.rango = [a, b]; return this; }
    single() { this.modo = 'single'; return this; }
    maybeSingle() { this.modo = 'maybe'; return this; }
    then(ok, mal) {
      const ms = base.__demora ? Number(base.__demora(this.nombre, this.op)) || 0 : 0;   // para forzar carreras en una prueba
      return new Promise(listo => setTimeout(listo, ms)).then(() => this._ejecutar()).then(ok, mal);
    }

    _elegir(fila) {
      if (!this.columnas || this.columnas === '*') return copia(fila);
      const cols = String(this.columnas).split(',').map(c => c.trim()).filter(c => c && !c.includes('('));
      if (cols.includes('*')) return copia(fila);
      const r = {};
      cols.forEach(c => { const [origen, alias] = c.includes(':') ? c.split(':').reverse() : [c, c]; r[alias.trim()] = copia(fila[origen.trim()]); });
      return r;
    }
    _ejecutar() {
      const t = tabla(this.nombre);
      registro.push({ tabla: this.nombre, op: this.op });
      const falla = base.__fallar && base.__fallar(this.nombre, this.op, this);
      if (falla) return { data: null, error: { message: falla }, count: null };
      let filas;
      if (this.op === 'insert' || this.op === 'upsert') {
        filas = this.filas.map(f => {
          const nueva = copia(f);
          if (this.op === 'upsert') {
            const clave = (this.opcionesUpsert.onConflict || 'id').split(',')[0].trim();
            const previa = t.find(x => x[clave] != null && String(x[clave]) === String(nueva[clave]));
            if (previa) { Object.assign(previa, nueva); return previa; }
          }
          if (nueva.id == null) nueva.id = sigId(this.nombre);
          if (nueva.creado_en === undefined) nueva.creado_en = new Date().toISOString();
          t.push(nueva);
          return nueva;
        });
      } else {
        filas = t.filter(f => this.filtros.every(fn => fn(f)));
        if (this.op === 'update') filas.forEach(f => Object.assign(f, copia(this.cambios)));
        if (this.op === 'delete') filas.forEach(f => t.splice(t.indexOf(f), 1));
      }
      if (this.op === 'select') {
        for (const [c, asc] of this.orden.slice().reverse()) {
          filas = filas.slice().sort((a, b) => (a[c] == null ? 1 : b[c] == null ? -1 : a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1));
        }
      }
      const total = filas.length;
      if (this.rango) filas = filas.slice(this.rango[0], this.rango[1] + 1);
      if (this.tope != null) filas = filas.slice(0, this.tope);
      if (this.opciones.head) return { data: null, error: null, count: total };
      if (!this.devolver) return { data: null, error: null, count: null };
      const datos = filas.map(f => this._elegir(f));
      if (this.modo === 'single') {
        if (datos.length !== 1) return { data: null, error: { message: `single(): ${datos.length} filas en ${this.nombre}`, code: 'PGRST116' } };
        return { data: datos[0], error: null };
      }
      if (this.modo === 'maybe') {
        if (datos.length > 1) return { data: null, error: { message: `maybeSingle(): ${datos.length} filas en ${this.nombre}`, code: 'PGRST116' } };
        return { data: datos[0] || null, error: null };
      }
      return { data: datos, error: null, count: this.opciones.count ? total : null };
    }
  }

  return {
    from: nombre => new Consulta(nombre),
    rpc: (nombre, args) => Promise.resolve().then(() => {
      registro.push({ rpc: nombre, args: copia(args) });
      if (!rpcs[nombre]) return { data: null, error: { message: 'rpc sin doble: ' + nombre } };
      return rpcs[nombre](args, base) || { data: null, error: null };
    }),
    /* Archivos en base.__archivos ('bucket/ruta' => true): las pruebas ven qué se subió y qué se borró (v142). */
    storage: { from: (bucket) => ({
      upload: async (ruta) => { (base.__archivos = base.__archivos || {})[bucket + '/' + ruta] = true; return { data: { path: ruta }, error: null }; },
      remove: async (rutas) => { (rutas || []).forEach(r => { if (base.__archivos) delete base.__archivos[bucket + '/' + r]; }); return { data: [], error: null }; },
      getPublicUrl: (ruta) => ({ data: { publicUrl: 'http://doble/storage/v1/object/public/' + bucket + '/' + ruta } }), createSignedUrl: async () => ({ data: { signedUrl: 'http://doble/firmado' }, error: null }) }) }
  };
}

function instalar(repo) {
  const bases = { pos: {}, web: {} };
  const rpc = {};
  const registro = [];
  let n = 0;
  const ruta = require.resolve('@supabase/supabase-js', { paths: [repo] });
  require.cache[ruta] = {
    id: ruta, filename: ruta, loaded: true,
    exports: { createClient: () => crearCliente(n++ === 0 ? bases.pos : bases.web, rpc, registro) }
  };
  return { bases, rpc, registro };
}

/* Arranca el servidor en un puerto libre y devuelve un `pedir(metodo, ruta, cuerpo, rol)`. */
async function arrancar(repo, entorno = {}) {
  Object.assign(process.env, { NODE_ENV: 'development', JWT_SECRET: 'secreto-de-prueba', ADMIN_PIN: '9911', WORKER_PIN: '2288', SYNC_SECRET: 'sync-prueba' }, entorno);
  const app = require(path.join(repo, 'api', 'index.js'));
  const jwt = require(require.resolve('jsonwebtoken', { paths: [repo] }));
  const servidor = await new Promise(ok => { const s = app.listen(0, () => ok(s)); });
  const puerto = servidor.address().port;
  const tokenDe = datos => jwt.sign(typeof datos === 'string' ? { rol: datos } : datos, process.env.JWT_SECRET, { expiresIn: '1h' });
  async function pedir(metodo, ruta, cuerpo, quien = 'admin') {
    const r = await fetch(`http://127.0.0.1:${puerto}${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(quien ? { Authorization: 'Bearer ' + (quien.token || tokenDe(quien)) } : {}) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
    });
    let json = null;
    try { json = await r.json(); } catch (_) { /* sin cuerpo */ }
    return { estado: r.status, json };
  }
  return { pedir, tokenDe, cerrar: () => new Promise(ok => servidor.close(ok)) };
}

/* Mini marco de pruebas: cuenta y deja el detalle en un archivo. */
function probador(nombre) {
  const lineas = [];
  let ok = 0, mal = 0;
  return {
    es(descripcion, real, esperado) {
      const bien = JSON.stringify(real) === JSON.stringify(esperado);
      if (bien) ok++; else mal++;
      lineas.push(`${bien ? 'OK  ' : 'FALLA'} ${descripcion}${bien ? '' : `\n        esperado: ${JSON.stringify(esperado)}\n        real:     ${JSON.stringify(real)}`}`);
    },
    cierto(descripcion, condicion, detalle) {
      if (condicion) ok++; else mal++;
      lineas.push(`${condicion ? 'OK  ' : 'FALLA'} ${descripcion}${condicion ? '' : `\n        ${detalle === undefined ? '' : JSON.stringify(detalle)}`}`);
    },
    resumen() { return { nombre, ok, mal, texto: lineas.join('\n') }; }
  };
}

module.exports = { instalar, arrancar, probador, copia };
