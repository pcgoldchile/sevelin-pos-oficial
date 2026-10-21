// ==========================================
// COTIZADOR-CELULARES.JS — Servicio Técnico → "📱 Cotizador celulares" (sql/102, v157)
// ------------------------------------------
// Pedido del dueño (15 y 16-10-2026): cotizar cambios de pantalla y otros
// repuestos de iPhone, Samsung, Motorola y Vivo con un precio ESTIMADO
// (repuesto de Multiphone + 15% + mano de obra), en el POS y en la app del
// taller. Hoy hacen pantallas y puertos de carga; iPhone "de a poco". Por eso
// el filtro arranca en "Pantalla y puerto de carga".
// El costo y la mano de obra solo los ve el admin (los manda el servidor).
// ==========================================

let cotizadorCelularesFilas = [];
let cotizadorCelularesReloj = null;

const TRABAJOS_COTIZADOR_CELULARES = [
  'Cambio de pantalla', 'Cambio de batería', 'Cambio de puerto de carga', 'Cambio de pin de carga (soldado)',
  'Cambio de tapa trasera', 'Cambio de carcasa completa (chasis)', 'Cambio de vidrio de cámara trasera',
  'Cambio de cámara trasera', 'Cambio de cámara frontal', 'Cambio de parlante', 'Cambio de auricular (el de las llamadas)',
  'Cambio de botón de encendido', 'Cambio de botones de volumen', 'Cambio de lector de huella', 'Cambio de bandeja SIM',
];

document.addEventListener('DOMContentLoaded', () => {
  const elTrabajo = document.getElementById('cotCelTrabajo');
  if (elTrabajo) {
    elTrabajo.innerHTML = '<option value="principales">Pantalla y puerto de carga</option><option value="todos">Todos los trabajos</option>'
      + TRABAJOS_COTIZADOR_CELULARES.map(t => `<option value="${escHtml(t)}">${escHtml(t)}</option>`).join('');
  }
  const programar = () => { clearTimeout(cotizadorCelularesReloj); cotizadorCelularesReloj = setTimeout(buscarCotizadorCelulares, 300); };
  document.getElementById('cotCelBuscar')?.addEventListener('input', programar);
  document.getElementById('cotCelMarca')?.addEventListener('change', buscarCotizadorCelulares);
  elTrabajo?.addEventListener('change', buscarCotizadorCelulares);
  document.getElementById('cotCelResultados')?.addEventListener('click', (e) => {
    const boton = e.target.closest('[data-cotcel-copiar]');
    if (boton) copiarCotizacionCelular(boton.dataset.cotcelCopiar, boton);
  });
  // mostrarPanelTaller (js/atajos.js) avisa al entrar a la pestaña: el cursor queda en el buscador
  document.addEventListener('pos:subtab-taller', (e) => {
    if (e.detail?.panel === 'cotizador-celulares') setTimeout(() => document.getElementById('cotCelBuscar')?.focus(), 50);
  });
});

async function buscarCotizadorCelulares() {
  const cont = document.getElementById('cotCelResultados');
  if (!cont) return;
  const q = (document.getElementById('cotCelBuscar')?.value || '').trim();
  const marca = document.getElementById('cotCelMarca')?.value || '';
  const trabajo = document.getElementById('cotCelTrabajo')?.value || 'principales';
  if (q.length < 2 && !marca) {
    cotizadorCelularesFilas = [];
    cont.innerHTML = '<p class="modal-hint">Escribe el modelo del celular, por ejemplo <b>A05</b>, <b>iPhone 13</b> o <b>G24</b>.</p>';
    return;
  }
  cont.innerHTML = '<p class="modal-hint">Buscando…</p>';
  try {
    const r = await API.cotizadorCelulares.buscar({ q, marca, trabajo });
    cotizadorCelularesFilas = r.filas || [];
    cotizadorCelularesAviso = r.aviso || '';
  } catch (err) {
    cont.innerHTML = `<p class="modal-hint">${escHtml(err.message || 'No se pudo buscar')}</p>`;
    return;
  }
  pintarCotizadorCelulares();
}

// v170: "No encontré exacto…" o "la lista no trae Redmi" (lo manda el servidor).
let cotizadorCelularesAviso = '';

function equiposCotizadorCelulares() {
  const grupos = new Map();
  for (const f of cotizadorCelularesFilas) {
    if (!grupos.has(f.equipo)) grupos.set(f.equipo, { equipo: f.equipo, marca: f.marca, filas: [] });
    grupos.get(f.equipo).filas.push(f);
  }
  return [...grupos.values()];
}

function pintarCotizadorCelulares() {
  const cont = document.getElementById('cotCelResultados');
  if (!cont) return;
  const equipos = equiposCotizadorCelulares();
  const aviso = cotizadorCelularesAviso ? `<p class="modal-hint" style="color:#b45309;"><b>⚠️ ${escHtml(cotizadorCelularesAviso)}</b></p>` : '';
  if (!equipos.length) {
    if (aviso) { cont.innerHTML = aviso + '<p class="modal-hint">Si no está, cotízalo con Multiphone.</p>'; return; }
    cont.innerHTML = '<p class="modal-hint">No encontré ese modelo con ese trabajo. Prueba con menos palabras (por ejemplo solo <b>A15</b>) o elige "Todos los trabajos". Si no está, cotízalo con Multiphone.</p>';
    return;
  }
  const admin = esAdmin();
  const lista = cotizadorCelularesFilas[0];
  const fecha = lista?.lista_fecha ? fechaCorta(lista.lista_fecha) : '';
  cont.innerHTML = aviso + `<p class="modal-hint">${equipos.length} equipo${equipos.length === 1 ? '' : 's'} · repuestos de ${escHtml(lista?.proveedor || 'Multiphone')}${fecha ? ` (lista del ${escHtml(fecha)})` : ''}, con IVA. Precio aproximado.</p>`
    + equipos.map((g, i) => `
      <div class="cotcel-equipo">
        <div class="cotcel-cabeza">
          <b>${escHtml(g.equipo)}</b>
          ${g.marca === 'iPhone' ? '<span class="cotcel-aviso" title="Requiere práctica: se integra de a poco">🍏 iPhone: de a poco</span>' : ''}
          <button type="button" class="btn btn-outline btn-sm" data-cotcel-copiar="${i}">📋 Copiar para WhatsApp</button>
        </div>
        <table class="data-table cotcel-tabla">
          <tbody>${g.filas.map(f => `<tr>
            <td>${escHtml(f.trabajo)}</td>
            <td><small class="modal-hint" style="margin:0;">${escHtml(f.calidad || '')}</small></td>
            <td class="num strong">${fmtCLP(f.precio)}</td>
            ${admin ? `<td class="num"><small class="modal-hint" style="margin:0;" title="Repuesto + mano de obra (el 15% del repuesto es por envío y alzas)">${fmtCLP(f.costo_repuesto)} + ${fmtCLP(f.mano_obra)}</small></td>` : ''}
          </tr>`).join('')}</tbody>
        </table>
      </div>`).join('');
}

function textoWhatsappCotizacion(grupo) {
  // La calidad se nombra si hay más de una opción para el mismo trabajo, o si no es la de siempre
  const opciones = (t) => grupo.filas.filter(x => x.trabajo === t).length;
  const lineas = grupo.filas.map(f => `• ${f.trabajo}${f.calidad && (opciones(f.trabajo) > 1 || !['Original', 'Normal', 'Compatible'].includes(f.calidad)) ? ` (${f.calidad})` : ''}: ${fmtCLP(f.precio)} aprox.`);
  return `📱 *${grupo.equipo}*\n${lineas.join('\n')}\n\nEl valor es aproximado: el repuesto puede cambiar de precio según el día en que se encargue. Te confirmamos el valor final al revisar el equipo.`;
}

async function copiarCotizacionCelular(indice, boton) {
  const grupo = equiposCotizadorCelulares()[Number(indice)];
  if (!grupo) return;
  const texto = textoWhatsappCotizacion(grupo);
  try {
    await navigator.clipboard.writeText(texto);
  } catch (_) {
    const area = document.createElement('textarea');
    area.value = texto;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  showToast('Copiado: pégalo en WhatsApp', 'ok');
  if (boton) { boton.textContent = '✓ Copiado'; setTimeout(() => { boton.textContent = '📋 Copiar para WhatsApp'; }, 1800); }
}
