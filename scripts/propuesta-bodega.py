# Propuesta de dónde guardar cada producto con stock (bodega de 9 muebles A..I x 5 repisas, 1 = abajo).
# Solo propone: el dueño acepta o rechaza cada una en el POS.
# Uso: python propuesta_bodega.py stock.json salida_base
import json, re, sys, collections

src, salida = sys.argv[1], sys.argv[2]
t = open(src, encoding='utf-8').read()
filas = json.loads(t[t.index('{'):])['rows']

def n(v):
    try: return float(v or 0)
    except: return 0.0

# Familias → mueble. Orden de izquierda a derecha, A = el más cercano al mesón (supuesto a confirmar).
MUEBLES = {
    'A': 'Cargadores y cables de carga',
    'B': 'Cables y adaptadores (video, red, poder, audio, USB)',
    'C': 'Almacenamiento, memorias y piezas chicas de PC',
    'D': 'Periféricos (mouse, teclados, joysticks, cámaras web)',
    'E': 'Audio y energía (audífonos, parlantes, power banks, pilas)',
    'F': 'Celulares, accesorios de auto y TV, herramientas',
    'G': 'Hogar chico y oficina',
    'H': 'Computación grande (monitores, PCs, gabinetes, fuentes)',
    'I': 'Hogar voluminoso (y repisa 5 = "por ordenar")',
}

def familia(p):
    nom, cat, sub = (p['nombre'] or '').lower(), (p['cat'] or ''), (p['sub'] or '')
    if cat == 'Cargadores' or sub == 'Cables USB y de Carga': return 'A'
    if cat == 'Cables y Adaptadores': return 'B'
    if cat == 'Almacenamiento' or sub in ('Memorias RAM',) or re.search(r'pasta t[ée]rmica|masilla t[ée]rmica', nom): return 'C'
    if cat == 'Periféricos': return 'D'
    if cat in ('Audio', 'Energía Portátil'): return 'E'
    if cat in ('Accesorios Móviles', 'Celulares y Smartphones', 'Herramientas') or sub == 'TV y Accesorios': return 'F'
    if cat in ('Monitores', 'Computadores') or sub in ('Gabinetes', 'Fuentes de poder', 'Placas Madre', 'Coolers y Disipadores'): return 'H'
    voluminoso = r'ventilador industrial|balanza pesa digital ba|cocinilla|parrill|tendedero|perchero|zapatero|estante met|basurero|aro de luz|anillo de luz|kit video streaming|especiero|caja de seguridad|aro luz'
    if re.search(voluminoso, nom): return 'I'
    return 'G'

# Cajas para lo chico o suelto (van dentro de una repisa)
CAJAS = [
    (r'pendrive|microsd|tarjeta de memoria|tarjeta micro', 'Pendrives y tarjetas de memoria', 'C3'),
    (r'tornillo|pasta t[ée]rmica|masilla t[ée]rmica|memoria ram', 'Piezas chicas de PC (tornillos, pasta, RAM)', 'C4'),
    (r'\bpila\b|pila de litio|pila alcalina|\b9v\b', 'Pilas', 'E3'),
    (r'adaptador (hdmi|vga)|cable adaptador (hdmi|displayport)|adaptador vga', 'Adaptadores de video', 'B3'),
    (r'adaptador otg|adaptador usb|adaptador cable sata|tarjeta de sonido usb|hub usb 3', 'Adaptadores USB', 'B4'),
    (r'^cable usb|^cable master-g', 'Cables USB de carga', 'A3'),
    (r'cable hdmi 1 metro|cable video vga|cable hdmi macho a macho 1', 'Cables HDMI y VGA cortos', 'B2'),
    (r'cable de poder', 'Cables de poder', 'B1'),
    (r'cable audio auxiliar|patch cord|fibra [óo]ptica', 'Cables de audio y fibra', 'B4'),
    (r'soporte magn[ée]tico|funda para', 'Accesorios de celular sueltos', 'F3'),
    (r'control remoto', 'Controles remotos', 'F4'),
]

def caja_de(p):
    nom = (p['nombre'] or '').lower()
    for pat, nombre, repisa in CAJAS:
        if re.search(pat, nom): return nombre, repisa
    return None, None

def medidas(p):
    dims = sorted([n(p['a']), n(p['b']), n(p['c'])], reverse=True)
    return dims, n(p['kg'])

def repisa(p, fam):
    dims, kg = medidas(p)
    lado = dims[0]
    nom = (p['nombre'] or '').lower()
    u90 = n(p['u90'])
    pesado = kg >= 1.5 or (lado >= 40 and kg >= 0.8)
    if pesado: return 1, 'pesado o grande: abajo, para no levantarlo'
    if (lado >= 30 and kg < 1.5) or re.search(r'aro de luz|anillo de luz|kit video|l[áa]mpara emergencia|raqueta', nom):
        return 5, 'liviano pero voluminoso: arriba'
    if u90 >= 3: return 3, f'se vende seguido ({int(u90)} en 90 días): a la altura de la vista'
    if n(p['stock']) >= 20: return 2, f'mucho stock ({int(n(p["stock"]))}): repisa de reserva'
    return 4, 'se vende poco: repisa alta de fácil alcance'

# Reglas puntuales (van antes que la regla general) para repartir los muebles que quedarían repletos
PUNTUALES = [
    (r'^cargador de pared usb carga r[áa]pida 33w power delivery', 'A1', 'mucho stock (reserva): cajas cerradas abajo'),
    (r'^monitor .*(19"|19 )', 'H2', 'monitor de 19": segunda repisa'),
    (r'^monitor', 'H1', 'monitor grande: abajo, no se apila alto'),
    (r'reacondicionado|computador|^pc hp|^gabinete', 'H3', 'PC o gabinete: a media altura, se levanta con las dos manos'),
    (r'^fuente de poder|^xpg pylon|^placa madre', 'H4', 'fuentes y placas: cajas medianas'),
    (r'^ventilador gamer|^disipador', 'H5', 'livianos: arriba'),
    (r'ventilador industrial', 'I1', 'muy grande: abajo (si no cabe, en el piso junto al mueble I)'),
    (r'balanza pesa digital ba|cocinilla|^starlux', 'I2', 'pesado: abajo'),
    (r'parrill|especiero|caja de seguridad|basurero', 'I3', 'mediano'),
    (r'aro de luz|anillo de luz|aro luz|kit video streaming|perchero|zapatero|estante met|tendedero', 'I4', 'liviano y voluminoso: arriba'),
    (r'^parlante', 'E2', 'parlantes: abajo, son voluminosos'),
    (r'power bank|bater[íi]a externa|bater[íi]a port[áa]til|magsafe', 'E3', 'power banks: a la altura de la vista, se venden seguido'),
    (r'aud[íi]fono', 'E4', 'audífonos'),
    (r'kit solar', 'E5', 'liviano y voluminoso: arriba'),
    (r'^cable hdmi (a hdmi 5|15)|^cable displayport a displayport|^capturadora', 'B5', 'cables largos y livianos: arriba'),
    (r'balanza|selladora|mini impresora', 'G2', 'medianos'),
    (r'kit de limpieza|cinta|rollo', 'G3', 'insumos de oficina y limpieza'),
    (r'l[áa]mpara emergencia|raqueta', 'G5', 'largos y livianos: arriba'),
]

propuestas = []
for p in filas:
    fam = familia(p)
    caja, rep_caja = caja_de(p)
    nom = (p['nombre'] or '').lower()
    puntual = next(((lug, mot) for pat, lug, mot in PUNTUALES if re.search(pat, nom)), None)
    if caja:
        lugar = rep_caja
        motivo = 'chico o suelto: en caja rotulada'
    elif puntual:
        lugar, motivo = puntual
    else:
        r, motivo = repisa(p, fam)
        lugar = f'{fam}{r}'
    propuestas.append(dict(id=int(p['id']), nombre=p['nombre'], stock=int(n(p['stock'])), u90=int(n(p['u90'])),
                           lugar=lugar, caja=caja, motivo=motivo, actual=p['lugares'] or '', fam=lugar[0]))

# Resumen por repisa
por_lugar = collections.defaultdict(list)
for x in propuestas: por_lugar[x['lugar']].append(x)

with open(salida + '.json', 'w', encoding='utf-8') as fh:
    json.dump([{k: x[k] for k in ('id', 'lugar', 'caja', 'motivo')} for x in propuestas], fh, ensure_ascii=False)

md = []
for m in 'ABCDEFGHI':
    md.append(f'\n### Mueble {m} · {MUEBLES[m]}\n')
    for r in (5, 4, 3, 2, 1):
        lug = f'{m}{r}'
        xs = por_lugar.get(lug, [])
        if not xs:
            if m == 'I' and r == 5: md.append(f'- **{lug}** · Por ordenar: lo que llegue y no tenga lugar todavía.')
            continue
        unidades = sum(x['stock'] for x in xs)
        md.append(f'- **{lug}** ({len(xs)} productos, {unidades} unidades)')
        cajas = collections.defaultdict(list)
        sueltos = []
        for x in sorted(xs, key=lambda x: -x['stock']):
            (cajas[x['caja']] if x['caja'] else sueltos).append(x)
        for c, cx in cajas.items():
            md.append(f'  - 📦 **Caja "{c}"**: ' + '; '.join(f"{x['nombre']} ({x['stock']})" for x in cx))
        for x in sueltos:
            ya = f" — hoy en {x['actual']}" if x['actual'] else ''
            md.append(f"  - {x['nombre']} ({x['stock']}){ya}")
open(salida + '.md', 'w', encoding='utf-8').write('\n'.join(md) + '\n')

print(len(propuestas), 'propuestas')
print('cajas:', collections.Counter(x['caja'] for x in propuestas if x['caja']))
print('por mueble:', sorted(collections.Counter(x['fam'] for x in propuestas).items()))
print('por repisa:', sorted((k, len(v), sum(x['stock'] for x in v)) for k, v in por_lugar.items()))
