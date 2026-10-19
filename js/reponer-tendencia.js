/* ============================================================
   "🔥 REPONER" (v162, dueño 18-10-2026)
   ------------------------------------------------------------
   "Si algo en tendencia le está quedando poco stock, para reponer a tiempo."
   Botón del encabezado que se enciende solo cuando hay algo: productos que se
   mueven en sevelin.cl (Destacados, muy vistos esta semana o que se venden) con
   3 o menos en stock. La regla vive en el servidor (GET /api/pos/reponer-tendencia).
   Lo que ya está "por llegar" se lista aparte y no prende el aviso.
   ============================================================ */

const INTERVALO_REPONER_MS = 30 * 60 * 1000;
let intervaloReponer = null;
let reponerTendenciaCache = null;

document.addEventListener('pos:sesion-iniciada', () => {
  if (intervaloReponer) { clearInterval(intervaloReponer); intervaloReponer = null; }
  if (!esAdmin()) return;
  actualizarAvisoReponer();
  intervaloReponer = setInterval(actualizarAvisoReponer, INTERVALO_REPONER_MS);
});

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnReponerTendencia')?.addEventListener('click', abrirModalReponer);
  document.getElementById('btnCerrarReponerTendencia')?.addEventListener('click', () =>
    document.getElementById('modalReponerTendencia')?.classList.remove('show'));
  document.getElementById('reponerTendenciaBody')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-reponer-abrir]');
    if (!b) return;
    document.getElementById('modalReponerTendencia')?.classList.remove('show');
    if (typeof abrirProductoDesdeAviso === 'function') abrirProductoDesdeAviso(b.dataset.reponerAbrir);
  });
});

async function actualizarAvisoReponer() {
  const btn = document.getElementById('btnReponerTendencia');
  const texto = document.getElementById('textoReponerTendencia');
  if (!btn || !texto || !tokenActual() || !esAdmin()) return;
  try {
    reponerTendenciaCache = await API.reponerTendencia.obtener();
    const total = Number(reponerTendenciaCache?.total) || 0;
    if (!total) { btn.hidden = true; return; }
    texto.textContent = `🔥 Reponer ${total}`;
    btn.title = `${total} producto(s) que se mueven en la tienda y tienen poco stock`;
    btn.hidden = false;
  } catch (err) {
    console.error('Error al revisar lo que hay que reponer:', err.message || err);
  }
}

function abrirModalReponer() {
  const cuerpo = document.getElementById('reponerTendenciaBody');
  const lista = reponerTendenciaCache?.productos || [];
  if (cuerpo) {
    cuerpo.innerHTML = lista.length
      ? lista.map(p => `
        <tr${p.ya_viene ? ' style="opacity:.6"' : ''}>
          <td>${escHtml(p.nombre)}
            <small class="fila-meta">${escHtml(p.motivos.join(' · '))}${p.ya_viene ? ` · 🚚 vienen ${p.stock_por_llegar}` : ''}</small></td>
          <td class="num"><strong>${p.stock}</strong></td>
          <td class="num">${p.vistas_7d}</td>
          <td class="num">${p.vendidos_30d}</td>
          <td><button type="button" class="btn btn-outline btn-sm" data-reponer-abrir="${escHtml(String(p.id))}">Abrir</button></td>
        </tr>`).join('')
      : '<tr class="empty-row"><td colspan="5">Nada que reponer por ahora.</td></tr>';
  }
  document.getElementById('modalReponerTendencia')?.classList.add('show');
}
