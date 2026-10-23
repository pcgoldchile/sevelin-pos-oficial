/* ============================================================
   SERVICIOS Y PRODUCTOS "POR EQUIPO" EN LA CAJA (v176, sql/111)
   ------------------------------------------------------------
   Dueño, 22-10-2026: "servicios que abarquen muchas marcas y modelos, para
   no crear servicio de cada modelo y marca, y que al momento de agregar ese
   servicio se me permita clasificar de qué marca y modelo era, y aparte que
   el costo igual varía mucho… lo mismo para láminas, centros de carga, etc."

   Un producto con "📱 Va por equipo" (productos.pide_equipo) no entra directo
   al carrito: primero esta ventana pregunta
     · la marca (botones, primero las que más se venden; "Otra" para escribir),
     · el modelo (con las sugerencias de lo ya vendido de esa marca),
     · el precio y el costo de ESTA venta (la ficha no cambia).
   La línea queda "Cambio de Pantalla · Samsung A15" y guarda la marca y el
   modelo aparte (venta_items.equipo_marca / equipo_modelo) para contar.

   Mismo patrón que pedirNumeroSerie (js/pos.js): la ventana se arma al abrirla
   y se destruye al cerrarla. Va después de pos.js.
   ============================================================ */

// Lo que eligió la ventana; agregarItemAlCarrito() (js/pos.js) lo toma una sola vez
let equipoVentaListo = null;
let equipoVentaFrecuentes = null;   // { marcas: [{ marca, veces, modelos: [] }] } o null si no cargó

const EQUIPO_MARCAS_BASE = {
  celular: ['Samsung', 'Xiaomi', 'Motorola', 'iPhone', 'Huawei', 'Oppo', 'Vivo', 'Honor', 'Realme', 'Nokia', 'ZTE', 'Tecno'],
  computador: ['HP', 'Lenovo', 'Asus', 'Acer', 'Dell', 'Samsung', 'MacBook', 'MSI', 'Huawei', 'Toshiba'],
  consola: ['PlayStation', 'Xbox', 'Nintendo']
};

/* Qué familia de marcas mostrar primero, por el nombre y la categoría del producto. */
function equipoVentaFamilia(producto) {
  const texto = `${producto?.nombre || ''} ${producto?.categoria_web || ''} ${producto?.subcategoria_web || ''}`.toLowerCase();
  if (/ps3|ps4|ps5|playstation|consola|mando|dualshock|xbox|nintendo/.test(texto)) return 'consola';
  if (/notebook|laptop|computador|\bpc\b|torre|escritorio|monitor|placa|bios|tarjeta de video/.test(texto)) return 'computador';
  return 'celular';
}

async function equipoVentaCargarFrecuentes() {
  if (equipoVentaFrecuentes) return equipoVentaFrecuentes;
  try {
    equipoVentaFrecuentes = await API.ventas.equiposFrecuentes();
  } catch (_) {
    equipoVentaFrecuentes = { marcas: [] };   // sin sugerencias, la ventana funciona igual
  }
  return equipoVentaFrecuentes;
}

/* Las marcas de los botones: las más vendidas de esta familia primero, después las de siempre. */
function equipoVentaMarcas(familia) {
  const base = EQUIPO_MARCAS_BASE[familia] || EQUIPO_MARCAS_BASE.celular;
  const todasBase = new Set(Object.values(EQUIPO_MARCAS_BASE).flat().map(m => m.toLowerCase()));
  const frecuentes = (equipoVentaFrecuentes?.marcas || [])
    .map(m => m.marca)
    // Una marca vendida que no es de ninguna lista también sale (alguien la escribió en "Otra")
    .filter(m => base.some(b => b.toLowerCase() === m.toLowerCase()) || !todasBase.has(m.toLowerCase()));
  const vistas = new Set();
  return [...frecuentes, ...base].filter(m => {
    const k = m.toLowerCase();
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  }).slice(0, 12);
}

function equipoVentaModelos(marca) {
  const m = (equipoVentaFrecuentes?.marcas || []).find(x => x.marca.toLowerCase() === String(marca || '').toLowerCase());
  return m ? m.modelos : [];
}

/* Abre la ventana y, si se confirma, agrega la línea al carrito. */
async function equipoVentaPedirYAgregar(producto) {
  await equipoVentaCargarFrecuentes();
  const datos = await equipoVentaVentana(producto);
  if (!datos) { if (typeof limpiarFormularioItem === 'function') limpiarFormularioItem(); enfocarBuscador(); return; }
  const elPrecio = document.getElementById('itemPrecio');
  if (elPrecio) elPrecio.value = String(datos.precio);
  equipoVentaListo = datos;
  agregarItemAlCarrito();
}

function equipoVentaVentana(producto) {
  return new Promise((resolve) => {
    document.getElementById('modalEquipoVenta')?.remove();
    const familia = equipoVentaFamilia(producto);
    const marcas = equipoVentaMarcas(familia);
    const precioLista = Math.round(Number(producto.precio_unitario) || 0);
    const costoFicha = Math.round(Number(producto.costo_unitario) || 0);
    const admin = esAdmin();
    const ejemplo = familia === 'consola' ? 'Ej: PS4 Slim, PS5' : familia === 'computador' ? 'Ej: Pavilion 15, IdeaPad 3' : 'Ej: A15, Redmi Note 13, 11 Pro';

    const cont = document.createElement('div');
    cont.id = 'modalEquipoVenta';
    cont.className = 'modal-overlay show';
    cont.innerHTML = `
      <div class="modal-box equipo-venta" role="dialog" aria-modal="true" aria-labelledby="equipoVentaTitulo">
        <div class="modal-sn-cabecera">
          ${miniaturaProducto(producto, 52)}
          <div>
            <h2 id="equipoVentaTitulo">¿Para qué equipo?</h2>
            <p class="modal-hint">${escHtml(producto.nombre || '')}</p>
          </div>
        </div>
        <p class="etiqueta-pos">Marca</p>
        <div class="equipo-venta-marcas" role="group" aria-label="Marca">
          ${marcas.map(m => `<button type="button" class="equipo-venta-marca" data-marca="${escHtml(m)}">${escHtml(m)}</button>`).join('')}
          <button type="button" class="equipo-venta-marca otra" data-marca-otra>✏️ Otra</button>
        </div>
        <input type="text" class="campo-pos equipo-venta-otra" data-campo="marca-otra" maxlength="40" placeholder="Escribe la marca" hidden autocomplete="off">
        <label class="etiqueta-pos" for="equipoVentaModelo">Modelo</label>
        <input type="text" id="equipoVentaModelo" class="campo-pos" maxlength="60" placeholder="${escHtml(ejemplo)}" autocomplete="off" list="equipoVentaModelos">
        <datalist id="equipoVentaModelos"></datalist>
        <div class="equipo-venta-montos">
          <div>
            <label class="etiqueta-pos" for="equipoVentaPrecio">Precio a cobrar</label>
            <input type="text" id="equipoVentaPrecio" class="campo-pos" inputmode="numeric" value="${precioLista || ''}" autocomplete="off">
          </div>
          <div>
            <label class="etiqueta-pos" for="equipoVentaCosto">Costo de esta venta <small>(repuesto o insumo)</small></label>
            <input type="text" id="equipoVentaCosto" class="campo-pos" inputmode="numeric" value="${admin && costoFicha ? costoFicha : ''}" placeholder="0" autocomplete="off">
          </div>
        </div>
        <p class="equipo-venta-resumen" data-resumen></p>
        <p class="equipo-venta-error" data-error role="alert" hidden></p>
        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" data-cerrar-modal>Cancelar</button>
          <button type="button" class="btn btn-primary" data-equipo-ok>Agregar al carrito</button>
        </div>
      </div>`;
    document.body.appendChild(cont);

    let marca = '';
    const elOtra = cont.querySelector('[data-campo="marca-otra"]');
    const elModelo = cont.querySelector('#equipoVentaModelo');
    const elLista = cont.querySelector('#equipoVentaModelos');
    const elPrecio = cont.querySelector('#equipoVentaPrecio');
    const elCosto = cont.querySelector('#equipoVentaCosto');
    const elResumen = cont.querySelector('[data-resumen]');
    const elError = cont.querySelector('[data-error]');
    const pesos = (el) => Math.round(Number(String(el.value || '').replace(/[^\d]/g, '')) || 0);

    function pintar() {
      cont.querySelectorAll('[data-marca]').forEach(b => b.classList.toggle('activo', b.dataset.marca === marca));
      elLista.innerHTML = equipoVentaModelos(marca).map(m => `<option value="${escHtml(m)}"></option>`).join('');
      const precio = pesos(elPrecio), costo = pesos(elCosto);
      const nombreEquipo = [marca, elModelo.value.trim()].filter(Boolean).join(' ');
      elResumen.textContent = nombreEquipo
        ? `${nombreEquipo} · ${fmtCLP(precio)}${admin && costo > 0 && precio >= costo ? ` · te queda ${fmtCLP(precio - costo)}` : ''}`
        : 'Elige la marca y escribe el modelo.';
    }
    function error(texto) { elError.textContent = texto; elError.hidden = !texto; }
    function cerrar(valor) { cont.remove(); resolve(valor); }

    function confirmar() {
      const m = marca || elOtra.value.trim();
      const precio = pesos(elPrecio), costo = pesos(elCosto);
      if (!m) { error('Elige la marca (o "Otra" y escríbela).'); return; }
      if (!(precio > 0)) { error('Escribe el precio a cobrar.'); elPrecio.focus(); return; }
      if (costo > 0 && precio < costo) { error(`Nunca se vende bajo el costo: el costo es ${fmtCLP(costo)}.`); elPrecio.focus(); return; }
      cerrar({ marca: m.slice(0, 40), modelo: elModelo.value.trim().slice(0, 60), precio, costo });
    }

    // Esc lo resuelve atajos.js pulsando el botón data-cerrar-modal
    cont.addEventListener('click', (e) => {
      if (e.target === cont || e.target.closest('[data-cerrar-modal]')) { cerrar(null); return; }
      const b = e.target.closest('[data-marca]');
      if (b) {
        marca = b.dataset.marca; elOtra.hidden = true; elOtra.value = ''; error(''); pintar();
        setTimeout(() => elModelo.focus(), 20);
        return;
      }
      if (e.target.closest('[data-marca-otra]')) { marca = ''; elOtra.hidden = false; pintar(); elOtra.focus(); return; }
      if (e.target.closest('[data-equipo-ok]')) confirmar();
    });
    elOtra.addEventListener('input', () => { error(''); pintar(); });
    [elModelo, elPrecio, elCosto].forEach(el => el.addEventListener('input', () => { error(''); pintar(); }));
    cont.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.target.closest('button')) return;
      e.preventDefault();
      confirmar();
    });
    pintar();
    setTimeout(() => cont.querySelector('[data-marca]')?.focus(), 50);
  });
}
