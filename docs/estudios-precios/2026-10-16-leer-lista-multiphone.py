# Lee la "LISTA DE PRECIOS MULTIPHONE CHILE 21.09" (PDF) a filas: pagina, seccion, modelo, calidad, precio.
# Cada página tiene secciones (título tamaño ~11.5 a lo ancho) y bajo cada una hasta 3 tablas lado a lado
# (MODELO / CALIDAD / PRECIO). El tipo de dato se distingue por tamaño de letra: modelo ~7.0, calidad ~5.9,
# precio ~6.4 y empieza con "$".
import sys, csv, re
import pymupdf

pdf, salida = sys.argv[1], sys.argv[2]
doc = pymupdf.open(pdf)
filas = []
for npag, pag in enumerate(doc, start=1):
    lineas = []
    for b in pag.get_text('dict')['blocks']:
        for l in b.get('lines', []):
            t = ' '.join(s['text'] for s in l['spans']).strip()
            if not t: continue
            x0, y0, x1, y1 = l['bbox']
            lineas.append(dict(t=t, x=x0, y=(y0 + y1) / 2, size=round(max(s['size'] for s in l['spans']), 1)))
    titulos = sorted([l for l in lineas if l['size'] >= 10], key=lambda l: l['y'])
    def seccion(y):
        t = [s for s in titulos if s['y'] < y]
        return re.sub(r'\s*—\s*CONTINUACI[ÓO]N', '', t[-1]['t']).strip() if t else ''
    # Cabeceras MODELO por sección: dos secciones de la misma página pueden tener tablas de distinto ancho
    cab_sec = {}
    for l in lineas:
        if l['t'] == 'MODELO': cab_sec.setdefault(seccion(l['y']), set()).add(round(l['x']))
    if not cab_sec: continue
    def grupo(x, y):
        g = sorted(c for c in cab_sec.get(seccion(y), ()) if c <= x + 3)
        return g[-1] if g else None
    precios = [l for l in lineas if l['t'].startswith('$') and 6.0 <= l['size'] <= 6.8]
    textos = [l for l in lineas if not l['t'].startswith('$') and l['size'] < 7.6 and l['t'] not in ('MODELO', 'CALIDAD', 'PRECIO') and not l['t'].startswith('[[')]
    filas_pag = {id(p): dict(p=p, modelo=[], calidad=[]) for p in precios}
    for l in textos:
        g = grupo(l['x'], l['y'])
        if g is None: continue
        sec = seccion(l['y'])
        cand = [p for p in precios if seccion(p['y']) == sec and grupo(p['x'], p['y']) == g]
        if not cand: continue
        p = min(cand, key=lambda p: abs(p['y'] - l['y']))
        if abs(p['y'] - l['y']) > 22: continue
        col = 'modelo' if l['x'] < g + 60 else 'calidad'
        filas_pag[id(p)][col].append(l)
    for r in filas_pag.values():
        p = r['p']
        modelo = ' '.join(l['t'] for l in sorted(r['modelo'], key=lambda l: l['y']))
        calidad = ' '.join(l['t'] for l in sorted(r['calidad'], key=lambda l: l['y']))
        precio = int(re.sub(r'[^0-9]', '', p['t']) or 0)
        filas.append([npag, seccion(p['y']), modelo.strip(), re.sub(r'\s*·\s*$', '', calidad.replace(' · ', ' · ').strip()), precio, round(p['x']), round(p['y'])])

filas.sort(key=lambda f: (f[0], f[5], f[6]))
with open(salida, 'w', newline='', encoding='utf-8') as fh:
    w = csv.writer(fh)
    w.writerow(['pagina', 'seccion', 'modelo', 'calidad', 'precio'])
    for f in filas: w.writerow(f[:5])
print(len(filas), 'filas')
import collections
c = collections.Counter(f[1] for f in filas)
for k, v in c.most_common(): print(v, k)
print('sin modelo:', sum(1 for f in filas if not f[2]))
