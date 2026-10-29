# Propuesta de bodega versión 3 (29-10-2026). Solo propone: el dueño acepta o rechaza cada una en el POS.
# Uso: python -I scripts/propuesta-bodega-v3.py stock.json salida_base
#
# Lo que pidió el dueño (29-10-2026):
#  - "tratando de mantener los productos como tal iban en su cajón o caja": lo que ya tenía propuesta (v2, 16-10)
#    se queda en el mismo lugar y la misma caja. Solo se mueve lo que él dijo que va apilado.
#  - Percheros, zapateros, tendederos, estantes armables y gabinetes van APILADOS en el piso, no en estantes.
#  - Mueble nuevo (J, otro estante de Mercado Libre, mismas medidas) para lo que no cabe.
#  - Vitrina del local (V1..V5, mismas medidas que los estantes) y mini vitrina de 6 espacios (M1..M6):
#    una unidad de muestra. Es un segundo lugar del producto: el resto sigue en la bodega.
import json, re, sys, collections

src, salida = sys.argv[1], sys.argv[2]
t = open(src, encoding='utf-8').read()
filas = json.loads(t[t.index('{'):])['rows']

def n(v):
    try: return float(v or 0)
    except: return 0.0

MUEBLES = {
    'A': 'Cargadores y cables de carga',
    'B': 'Cables y adaptadores (video, red, poder, audio, USB)',
    'C': 'Computación: PCs, fuentes, almacenamiento y piezas de PC',
    'D': 'Periféricos (mouse, teclados, controles, cámaras web) e iluminación para streaming',
    'E': 'Audio y energía (audífonos, parlantes, power banks, pilas)',
    'F': 'Celulares, accesorios de auto y TV (F1, F2 y F5 libres: repuestos de celular)',
    'G': 'Hogar, cocina, oficina y juguetes',
    'H': 'Monitores nuevos (con caja)',
    'I': 'Monitores reacondicionados',
    'J': 'NUEVO · Herramientas e iluminación',
    'P': 'Piso, apilado (armables de hogar, gabinetes y ventiladores grandes)',
}

# 1) Lo que se mueve aunque ya tenía lugar: va apilado en el piso.
AL_PISO = [
    (r'perchero|zapatero|estante met[áa]lico|organizador estante|tendedero', 'P1', None, 'se arma: apilado en el piso (pedido del dueño)'),
    (r'^gabinete', 'P2', None, 'gabinete de PC: caja grande, apilado en el piso'),
    (r'ventilador industrial', 'P3', None, 'muy voluminoso: apilado en el piso'),
]

# 2) Productos nuevos (sin propuesta v2). Cajas: se reutilizan las mismas de la v2 cuando la familia calza.
NUEVOS = [
    # Cables y adaptadores
    (r'cable de poder tr[ée]bol', 'B1', 'Cables de poder', 'mismo cajón que los otros cables de poder'),
    (r'adaptador de enchufe', 'B1', 'Adaptadores de enchufe', 'chico y con mucho stock: caja nueva junto a los cables de poder'),
    (r'alargador el[ée]ctrico', 'B1', None, 'junto a los cables de poder'),
    (r'copla hdmi|mini displayport a vga|displayport macho a hdmi', 'B3', 'Adaptadores de video', 'misma caja de adaptadores de video'),
    (r'switch hdmi|splitter hdmi', 'B3', None, 'junto a los adaptadores de video'),
    (r'alargador de audio|splitter adaptador jack|audio p10|plug 3,5 mm a 6,5|rca 3 a 3|splitter de audio', 'B4', 'Cables de audio y fibra', 'misma caja de cables de audio'),
    (r'hub usb-c|antena wifi usb|extensi[óo]n usb|usb a-b para impresora|cable mini usb', 'B4', 'Adaptadores USB', 'misma caja de adaptadores USB'),
    (r'cable de red utp cat6.*(30|40|50) m', 'B5', None, 'cables de red largos: arriba, livianos'),
    (r'^cable usb tipo c a tipo c 2 m|^cable usb-c a lightning|adaptador usb-c a lightning', 'A3', 'Cables USB de carga', 'misma caja de cables de carga'),
    (r'splitter sata|molex a pcie', 'C4', 'Piezas chicas de PC (tornillos, pasta, RAM)', 'cable interno de PC: cajoncito junto a las piezas chicas'),
    # Cargadores y energía
    (r'fuente( de poder)? transformador|^transformador 12 v', 'A4', None, 'transformadores junto a los cargadores universales'),
    (r'power bank pocket', 'E3', None, 'junto a los otros power banks'),
    (r'cargador de auto', 'F3', None, 'accesorios de auto'),
    (r'soporte (de )?celular', 'F3', 'Accesorios de celular sueltos', 'misma caja de accesorios de celular'),
    # Computación y monitores
    (r'^cooler cpu|base ventilador notebook|soporte ajustable de aluminio para notebook', 'C5', None, 'livianos de notebook y PC: arriba'),
    (r'monitor samsung syncmaster', 'I2', None, 'monitor usado de 1 unidad'),
    (r'master-g mgmg2442|^master-g .*monitor', 'H3', None, 'monitores nuevos que faltaban por cargar (H3 libre)'),
    # Periféricos
    (r'^control |^cbc mando|gamepad|cargador doble para 2 controles', 'D3', None, 'mismo lugar que los otros controles'),
    (r'gomita para an[áa]logo', 'D3', 'Repuestos de control', 'chico: caja junto a los controles'),
    (r'mouse pad', 'D4', None, 'enrollados, junto a los mouse'),
    (r'kit gamer|monster games', 'D5', None, 'combos de teclado y mouse: misma repisa'),
    (r'presentador inal[áa]mbrico', 'D4', None, 'junto a los mouse'),
    # Audio
    (r'aud[íi]fonos? inal[áa]mbricos? bluetooth|micr[óo]fono de solapa', 'E4', None, 'junto a los audífonos'),
    (r'^parlantes para pc', 'E2', None, 'junto a los parlantes'),
    # Herramientas e iluminación → mueble J nuevo
    (r'set de 30 destornilladores|llave (tigre|universal|ajustable)|pistola de silicona|l[áa]piz grabador|pie de metro|cinta tapagotera|cepillo limpiador de cadena', 'J3', None, 'herramientas que más salen: a la altura de la vista'),
    (r'tester|mult[íi]metro|probador|detector de voltaje|termostato|crimpeadora', 'J4', 'Medición y redes', 'medición y redes: caja rotulada'),
    (r'soldadora de pl[áa]stico|soplador|sopladora|lubricante', 'J2', None, 'herramientas medianas'),
    (r'l[áa]mpara solar 100 led|foco proyector|foco solar port[áa]til', 'J1', None, 'iluminación de exterior: muchas cajas, abajo'),
    (r'plaf[óo]n|panel plaf[óo]n|soquete|foco par led|kit 3 focos|guirnalda', 'J2', None, 'iluminación de casa y fiestas'),
    (r'aro de luz|linterna|luz led recargable usb para bicicleta|l[áa]mpara de emergencia', 'J5', None, 'livianos y voluminosos: arriba'),
    # Hogar → G (se libera G5, que tenía los armables)
    (r'calefactor|caloventor', 'G1', None, 'climatización: bultos, abajo'),
    (r'wafflera|batidor espumador|dispensador de agua|llave calentador|plancha a vapor|kit ducha bidet', 'G2', None, 'cocina y casa: junto a las cocinillas'),
    (r'guante de nitrilo|mascarilla desechable|m[áa]scara t[ée]rmica|ox[íi]metro|cepillo a vapor|term[óo]metro higr[óo]metro|balanza digital gramera', 'G3', 'Cuidado y limpieza', 'chicos y muchos: caja rotulada'),
    (r'rollo de papel adhesivo|marcador permanente|pizarra de corcho', 'G3', 'Insumos de oficina', 'insumos de oficina: caja rotulada'),
    (r'peluche|squishy|pyraminx|juego de cartas|pizarra m[áa]gica|tablero m[áa]gico|juego de dardos', 'G4', 'Juguetes y peluches', 'juguetes: caja rotulada (una unidad va a la vitrina)'),
    (r'c[áa]mara de vigilancia|timbre inal[áa]mbrico|candado de cable|inflador de globos', 'G4', None, 'hogar y seguridad'),
    (r'soporte tv|repisa plegable para poner sobre la tv|soporte de pared para guitarra|lona de repuesto', 'G5', None, 'planos o livianos: arriba (G5 quedó libre al bajar los armables al piso)'),
]

# 3) Vitrina del local (una unidad de muestra) y mini vitrina de 6 espacios. Criterio: lo que se compra
#    "por impulso" en el mostrador, que deja buena utilidad y del que hay más de una unidad.
VITRINA = [
    # V5 arriba: livianos y llamativos
    (r'^aro de luz led 31 cm', 'V5'), (r'^kit video streaming', 'V5'), (r'l[áa]mpara led astronauta', 'V5'),
    (r'mini impresora port[áa]til', 'V5'), (r'pizarra m[áa]gica lcd', 'V5'),
    # V4 a la altura de la vista: lo gamer que más se muestra
    (r'^combo teclado y mouse rgb ab-d335', 'V4'), (r'monster games', 'V4'), (r'^mouse urbano labs', 'V4'),
    (r'aud[íi]fono gamer executiner', 'V4'), (r'aud[íi]fonos inal[áa]mbricos bluetooth 5.0 gamer p47', 'V4'),
    # V3: consolas y controles (lo que más pide el niño que entra)
    (r'control inal[áa]mbrico color negro con luces', 'V3'), (r'control inal[áa]mbrico color blanco', 'V3'),
    (r'gamepad inal[áa]mbrico n-sl', 'V3'), (r'cargador doble para 2 controles', 'V3'), (r'peluche cappuccino', 'V3'),
    (r'llavero peluche sanrio', 'V3'),
    # V2: energía y audio
    (r'linkon 20.000', 'V2'), (r'master-g 20.000 mah 65w', 'V2'), (r'magsafe 10.000', 'V2'), (r'^parlantes gamer rgb', 'V2'),
    # V1 abajo: lo grande
    (r'parlante karaoke master-g mgluxor', 'V1'), (r'c[áa]mara de vigilancia ip', 'V1'), (r'base ventilador notebook gamer n191', 'V1'),
    # Mini vitrina (junto a la caja): un producto por espacio
    (r'master-g 30.000', 'M1'), (r'sony wh-ch520', 'M2'), (r'^pendrive kingston datatraveler exodia 128', 'M3'),
    (r'magsafe 5.000', 'M4'), (r'^cargador de pared usb carga r[áa]pida 33w power delivery', 'M5'), (r'^mouse inal[áa]mbrico recargable', 'M6'),
]
NOMBRE_VITRINA = {**{f'V{i}': f'Vitrina del local, repisa {i}' for i in range(1, 6)}, **{f'M{i}': f'Mini vitrina, espacio {i}' for i in range(1, 7)}}

def primero(reglas, nom):
    for r in reglas:
        if re.search(r[0], nom): return r
    return None

propuestas, sin_regla = [], []
usados_vitrina = collections.Counter()
for p in filas:
    nom = (p['nombre'] or '').lower()
    lugar, caja, motivo, origen = None, None, None, ''
    piso = primero(AL_PISO, nom)
    if piso:
        lugar, caja, motivo = piso[1], piso[2], piso[3]
        origen = 'movido' if p.get('prop_lugar') else 'nuevo'
    elif p.get('prop_lugar'):
        lugar, caja, motivo, origen = p['prop_lugar'], p.get('prop_caja'), 'igual que en la propuesta del 16-10', 'igual'
    else:
        r = primero(NUEVOS, nom)
        if r: lugar, caja, motivo, origen = r[1], r[2], r[3], 'nuevo'
        else:
            lugar, caja, motivo, origen = 'E1', None, 'por ordenar: no calzó con ninguna familia', 'nuevo'
            sin_regla.append(p['nombre'])
    vit = None
    if n(p['stock']) >= 2 or re.search(r'sony wh-ch520|mouse inal[áa]mbrico recargable', nom):
        v = primero(VITRINA, nom)
        if v and not (v[1].startswith('M') and usados_vitrina[v[1]]):
            vit = v[1]; usados_vitrina[vit] += 1
    propuestas.append(dict(id=int(p['id']), nombre=p['nombre'], stock=int(n(p['stock'])), u90=int(n(p['u90'])),
                           lugar=lugar, caja=caja, motivo=motivo, origen=origen, vitrina=vit,
                           precio=int(n(p['precio'])), costo=int(n(p['costo']))))

por_lugar = collections.defaultdict(list)
for x in propuestas: por_lugar[x['lugar']].append(x)

with open(salida + '.json', 'w', encoding='utf-8') as fh:
    json.dump([{k: x[k] for k in ('id', 'lugar', 'caja', 'motivo', 'vitrina')} for x in propuestas], fh, ensure_ascii=False)

LIBRES = {'E1': 'Por ordenar: lo que llegue y todavía no tenga lugar.', 'F1': 'Libre: repuestos de celular.',
          'F2': 'Libre: repuestos de celular.', 'F5': 'Libre: repuestos de celular livianos.',
          'H4': 'Repisa de arriba: cajas livianas.', 'I3': 'Libre: monitores que faltan por cargar.', 'I4': 'Repisa de arriba: cajas livianas.'}
md = []
for m in 'ABCDEFGHIJP':
    md.append(f'\n### {"Mueble " if m != "P" else ""}{m} · {MUEBLES[m]}\n')
    rango = (1, 2, 3) if m == 'P' else (5, 4, 3, 2, 1)
    for r in rango:
        lug = f'{m}{r}'
        xs = por_lugar.get(lug, [])
        if not xs:
            if lug in LIBRES: md.append(f'- **{lug}** · {LIBRES[lug]}')
            continue
        md.append(f'- **{lug}** ({len(xs)} productos, {sum(x["stock"] for x in xs)} unidades)')
        cajas = collections.defaultdict(list); sueltos = []
        for x in sorted(xs, key=lambda x: -x['stock']):
            (cajas[x['caja']] if x['caja'] else sueltos).append(x)
        marca = lambda x: (' 🆕' if x['origen'] == 'nuevo' else ' ↪️ antes en otro lugar' if x['origen'] == 'movido' else '')
        for c, cx in cajas.items():
            md.append(f'  - 📦 **Caja "{c}"**: ' + '; '.join(f"{x['nombre']} ({x['stock']}){marca(x)}" for x in cx))
        for x in sueltos:
            md.append(f"  - {x['nombre']} ({x['stock']}){marca(x)}")

md.append('\n## Vitrina del local y mini vitrina (una unidad de muestra)\n')
vits = collections.defaultdict(list)
for x in propuestas:
    if x['vitrina']: vits[x['vitrina']].append(x)
for v in ['V5', 'V4', 'V3', 'V2', 'V1', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6']:
    xs = vits.get(v, [])
    if not xs: continue
    pesos = lambda v: f"${v:,}".replace(',', '.')
    md.append(f'- **{v} · {NOMBRE_VITRINA[v]}**: ' + '; '.join(
        f"{x['nombre']} ({pesos(x['precio'])}, stock {x['stock']})" for x in xs))
open(salida + '.md', 'w', encoding='utf-8').write('\n'.join(md) + '\n')

print(len(propuestas), 'propuestas;', collections.Counter(x['origen'] for x in propuestas))
print('sin regla (van a E1):', sin_regla)
print('por repisa:', sorted((k, len(v), sum(x['stock'] for x in v)) for k, v in por_lugar.items()))
print('vitrina:', sorted((k, len(v)) for k, v in vits.items()))
