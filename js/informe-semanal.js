// ==========================================
// INFORME-SEMANAL.JS — Finanzas → 📅 Semanal
// ------------------------------------------
// Los 5 números del lunes, ya comparados con la semana anterior.
// Fase 7 del plan de crecimiento (docs/PLAN-CRECIMIENTO-2026.md): es lo
// que hace que todo lo medido en Inteligencia se USE, en vez de esperar
// a que alguien se acuerde de abrir un panel.
//
// TODO viene calculado y REDACTADO del servidor (GET /api/pos/informe-
// semanal), incluido el texto para copiar. Si el mensaje se armara acá,
// la pantalla y lo que se manda por WhatsApp terminarían diciendo cosas
// distintas — y quien lo lee no tendría cómo saber cuál creer.
//
// EL MARGEN SE COMPARA EN PUNTOS, NO EN PORCENTAJE. Pasar de 30% a 24%
// no es "bajó 6%", es "bajó 6 puntos" (en porcentaje sería 20%). Es la
// confusión clásica al leer márgenes y acá está resuelta de un lado.
// ==========================================

let semanalDatos = null;
let semanalFecha = null;                  // YYYY-MM-DD dentro de la semana mostrada; null = la última cerrada

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnSemanalAnterior')?.addEventListener('click', () => moverSemana(-7));
  document.getElementById('btnSemanalSiguiente')?.addEventListener('click', () => moverSemana(7));
  document.getElementById('btnSemanalCopiar')?.addEventListener('click', copiarInformeSemanal);
});

function moverSemana(dias) {
  const base = semanalDatos?.periodo?.desde;
  if (!base) return;
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  semanalFecha = d.toISOString().slice(0, 10);
  cargarInformeSemanal();
}

async function cargarInformeSemanal() {
  try {
    semanalDatos = await API.informeSemanal.obtener(semanalFecha);
    pintarInformeSemanal();
  } catch (err) {
    showToast(err.message || 'No se pudo cargar el informe semanal', 'err');
  }
}

/* Variación como texto. `null` = la semana anterior fue cero, así que no
   existe "cuánto subió": se dice sin comparación en vez de inventar un
   100% o mostrar un infinito. */
function textoVariacion(pct, etiqueta = 'vs. semana anterior') {
  if (pct === null || pct === undefined) return 'sin comparación (semana anterior en 0)';
  if (Math.abs(pct) < 0.5) return `igual que la semana anterior`;
  return `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}% ${etiqueta}`;
}

function pintarInformeSemanal() {
  const d = semanalDatos;
  if (!d) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  set('semanalPeriodo', `Semana del ${d.periodo.desde} al ${d.periodo.hasta}` +
    (d.esSemanaEnCurso ? ' · en curso, todavía no termina' : ''));

  set('semanalIngresos', fmtCLP(d.actual.ingresos));
  set('semanalIngresosVar', textoVariacion(d.cambios.ingresos));
  set('semanalUtilidad', fmtCLP(d.actual.utilidad));
  set('semanalUtilidadVar', textoVariacion(d.cambios.utilidad));
  set('semanalMargen', `${d.actual.margenPct.toFixed(1)}%`);
  set('semanalMargenVar', d.previa.ventas
    ? `${d.cambios.margenPuntos >= 0 ? '+' : ''}${d.cambios.margenPuntos.toFixed(1)} puntos vs. semana anterior`
    : 'sin comparación (semana anterior en 0)');
  set('semanalTicket', fmtCLP(d.actual.ticket));
  set('semanalTicketVar', textoVariacion(d.cambios.ticket));
  set('semanalVentas', String(d.actual.ventas));
  set('semanalVentasVar', `${textoVariacion(d.cambios.ventas)} · ${d.actual.itemsPorVenta.toFixed(2)} productos por venta`);

  if (d.web) {
    set('semanalWeb', `${d.web.visitas} visitas`);
    set('semanalWebVar', `${d.web.pedidos} pedido(s) · semana anterior: ${d.web.visitasPrevia} visitas, ${d.web.pedidosPrevia} pedido(s)`);
  } else {
    set('semanalWeb', '—');
    set('semanalWebVar', 'No se pudo leer la tienda web (el resto del informe sí es válido)');
  }

  const cajaAlertas = document.getElementById('semanalAlertas');
  if (cajaAlertas) {
    cajaAlertas.innerHTML = d.alertas.length
      ? d.alertas.map(a => `
          <div class="intel-alerta intel-alerta-${a.nivel === 'alta' ? 'alta' : 'media'}">
            <div class="intel-alerta-detalle">${a.nivel === 'alta' ? '🔴' : '🟡'} ${escHtml(a.texto)}</div>
          </div>`).join('')
      : '<p class="subtitle">Sin alertas esta semana.</p>';
  }

  const cajaTop = document.getElementById('semanalTop');
  if (cajaTop) {
    cajaTop.innerHTML = d.top.length ? `
      <h4 style="margin:0 0 6px;">Lo que más margen dejó</h4>
      <div class="tabla-scroll">
        <table class="data-table">
          <thead><tr><th>#</th><th>Producto</th><th>Unid.</th><th>Vendido</th><th>Margen</th></tr></thead>
          <tbody>
            ${d.top.map((t, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${escHtml(t.nombre || '')}</td>
                <td>${t.unidades}</td>
                <td>${fmtCLP(t.ingresos)}</td>
                <td>${fmtCLP(t.margen)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<p class="subtitle">No hubo ventas en esta semana.</p>';
  }
}

/* Copia el informe en texto. El portapapeles moderno exige contexto
   seguro (https o localhost) y puede fallar por permisos; si eso pasa,
   se cae a un textarea + execCommand, que funciona en cualquier caso.
   Un botón de copiar que a veces no copia y no dice nada es peor que no
   tenerlo. */
async function copiarInformeSemanal() {
  const texto = semanalDatos?.texto;
  if (!texto) return showToast('Todavía no hay informe cargado', 'err');
  try {
    await navigator.clipboard.writeText(texto);
    showToast('Informe copiado — pégalo donde quieras', 'ok');
  } catch (_) {
    try {
      const area = document.createElement('textarea');
      area.value = texto;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      showToast(ok ? 'Informe copiado' : 'No se pudo copiar: selecciónalo a mano', ok ? 'ok' : 'err');
    } catch (err) {
      showToast('No se pudo copiar el informe', 'err');
    }
  }
}
