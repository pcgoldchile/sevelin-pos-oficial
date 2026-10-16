# Precios estimados de reparación de celulares con la LISTA DE PRECIOS MULTIPHONE CHILE 21.09 (iPhone, Samsung,
# Motorola, Vivo). Precio = (repuesto + 15%) + mano de obra, redondeado hacia arriba al millar.
# Uso: python cotizador_mp.py mp_lista.csv salida_base
import csv, math, re, sys, collections

COLCHON = 0.15
entrada, salida = sys.argv[1], sys.argv[2]
filas = list(csv.DictReader(open(entrada, encoding='utf-8')))

MARCAS = {'IPHONE': 'iPhone', 'SAMSUNG': 'Samsung', 'MOTO': 'Motorola', 'MOTOROLA': 'Motorola', 'VIVO': 'Vivo'}
SEC_MARCA = {'IPHONE': 'iPhone', 'APPLE': 'iPhone', 'SAMSUNG': 'Samsung', 'MOTO': 'Motorola', 'VIVO': 'Vivo'}
COLORES = r'(BLANCA|BLANCO|NEGRA|NEGRO|AZUL|ROJO|ROJA|ROSA|ROSADO|VERDE|GRIS|GOLD|DORADA|DORADO|PLATA|PLATEADO|MORADA|MORADO|VIOLETA|CELESTE|CAFE|CAFÉ|AMARILLO|AMARILLA|NARANJA|LILA|CREMA|GRAFITO|MENTA|CORAL|PURPURA|PÚRPURA|BEIGE|TITANIO|SIERRA|MEDIANOCHE|BLUE|BLACK|WHITE|GREEN|RED|PURPLE|PINK)'
RUIDO = [r'PRODUCTOS DE CALIDAD', r'PRECIOS COMPETITIVOS', r'ATENCI[ÓO]N ESPECIALIZADA', r'\bCVT-SRVI\b', r'\bORIGINAL\b',
         r'\bSIN FLEX\b', r'\bOFERTA\b', r'\bSOMOS\b', r'\bCON GANCHO\b']

def tipo_trabajo(sec):
    s = sec.upper()
    if s.startswith(('INCELL ', 'OLED ', 'ORIGINAL ', 'PANTALLAS ', 'SERIE J')): return 'Cambio de pantalla'
    if s.startswith('BATERÍAS'): return 'Cambio de batería'
    if s.startswith('FLEX DE CARGA'): return 'Cambio de puerto de carga'
    if s.startswith('PIN / CONECTOR'): return 'Cambio de pin de carga (soldado)'
    if s.startswith('TAPAS'): return 'Cambio de tapa trasera'
    if s.startswith('VIDRIO CÁMARA'): return 'Cambio de vidrio de cámara trasera'
    if s.startswith('CÁMARA TRASERA'): return 'Cambio de cámara trasera'
    if s.startswith('CÁMARA DELANTERA'): return 'Cambio de cámara frontal'
    if s.startswith('DISCO DE SONIDO'): return 'Cambio de parlante'
    if s.startswith('AURICULAR'): return 'Cambio de auricular (el de las llamadas)'
    if s.startswith('FLEX ENCENDIDO'): return 'Cambio de botón de encendido'
    if s.startswith('FLEX VOLUMEN'): return 'Cambio de botones de volumen'
    if s.startswith('HUELLA'): return 'Cambio de lector de huella'
    if s.startswith('BANDEJA SIM'): return 'Cambio de bandeja SIM'
    return None

def marca_seccion(sec):
    ult = sec.upper().split()[-1] if sec.split() else ''
    return SEC_MARCA.get(ult)

def limpiar_modelo(m):
    m = m.upper()
    for r in RUIDO: m = re.sub(r, ' ', m)
    m = re.sub(r'\b' + COLORES + r'\b', ' ', m)
    m = re.sub(r'\s*·\s*', ' · ', m)
    # Cortes de línea del PDF dentro de un modelo: "A3 4" → "A34", "A 03" → "A03"
    m = re.sub(r'\b([A-Z]\d) (\d)(?=\s|/|$)', r'\1\2', m)
    m = re.sub(r'(?<=/)\s*([A-Z]) (\d)', r'\1\2', m)
    m = re.sub(r'\b([A-Z]) (\d{2})\b', r'\1\2', m)
    m = re.sub(r'\s+', ' ', m).strip(' ·-')
    return m

def bonito(m, marca):
    t = m.title()
    t = re.sub(r'\bIphone\b', 'iPhone', t)
    t = t.replace('Moto ', 'Moto ').replace('Big Glass', 'big glass').replace('Small Glass', 'small glass')
    t = re.sub(r'(\d)G\b', r'\1G', t)
    t = re.sub(r'\b(\d+)G(?=\s|$)', r'\1G', t)
    t = re.sub(r'\bSe\b', 'SE', t); t = re.sub(r'\bXr\b', 'XR', t); t = re.sub(r'\bXs\b', 'XS', t)
    t = re.sub(r'\bA(\d+)s\b', r'A\1s', t)
    t = t.replace('/', ' / ').replace('  ', ' ')
    return re.sub(r'\s+', ' ', t).strip()

def clase_pantalla(sec, cal):
    s, c = sec.upper(), cal.upper()
    if 'TIANMA' in c: return 'LCD'
    if s.startswith('INCELL') or c.startswith('INCELL'): return 'Incell'
    if s.startswith('OLED') or 'OLED' in c: return 'OLED'
    if 'ORIGINAL 100%' in c: return 'Original 100%'
    if s.startswith('ORIGINAL') or 'ORIGINAL' in c: return 'Original'
    if 'ALTERNATIVA' in c: return 'Alternativa'
    return 'Compatible'

def gen_iphone(m):
    x = re.search(r'IPHONE\s*(SE|XS|XR|X|\d+)', m.upper())
    if not x: return None
    g = x.group(1)
    if g in ('SE',): return 8
    if g in ('X', 'XR', 'XS'): return 10
    return int(g)

def mano_obra(trabajo, marca, modelo, clase):
    ip = marca == 'iPhone'
    g = gen_iphone(modelo) if ip else None
    M = modelo.upper()
    alta = (not ip) and bool(re.search(r'\b(S\d{1,2}|NOTE|EDGE|Z FLIP|Z FOLD|FOLD|FLIP|RAZR)\b', M))
    if trabajo == 'Cambio de pantalla':
        if ip:
            if g is None or g <= 11: return 25000 if clase.startswith('OLED') or 'Original 100%' == clase else 20000
            if g <= 13: return 30000
            if g <= 15: return 40000
            return 50000
        if alta: return 35000
        return 25000 if clase == 'OLED' else 20000
    if trabajo == 'Cambio de batería':
        if ip:
            if g is None or g <= 8: return 10000
            if g <= 11: return 15000
            if g <= 13: return 18000
            return 20000
        return 15000
    if trabajo == 'Cambio de puerto de carga':
        if ip: return 20000 if (g or 0) <= 11 else 25000
        return 15000
    if trabajo == 'Cambio de pin de carga (soldado)': return 20000
    if trabajo == 'Cambio de tapa trasera':
        return 25000 if ip else 10000
    if trabajo == 'Cambio de carcasa completa (chasis)': return 40000
    if trabajo == 'Cambio de vidrio de cámara trasera': return 10000
    if trabajo in ('Cambio de cámara trasera', 'Cambio de cámara frontal'): return 20000 if ip else 15000
    if trabajo in ('Cambio de parlante', 'Cambio de lector de huella'): return 15000
    if trabajo == 'Cambio de auricular (el de las llamadas)': return 20000 if ip else 15000
    if trabajo in ('Cambio de botón de encendido', 'Cambio de botones de volumen'): return 25000 if ip else 15000
    if trabajo == 'Cambio de bandeja SIM': return 3000
    return 15000

def tapa_iphone_removible(modelo):
    M = modelo.upper()
    g = gen_iphone(M)
    if g is None: return False
    if g == 14: return 'PRO' not in M
    return g >= 15

grupos = collections.defaultdict(list)
excluidas = collections.Counter()
for f in filas:
    trabajo = tipo_trabajo(f['seccion'])
    marca = marca_seccion(f['seccion'])
    if not trabajo or not marca: continue
    crudo = f['modelo']
    modelo = limpiar_modelo(crudo)
    if not re.match(r'(IPHONE|SAMSUNG|MOTO|MOTOROLA|VIVO)\b', modelo): excluidas['modelo raro'] += 1; continue
    if re.search(r'TABLET|IPAD|WATCH|\bT\d{3}\b|\bP\d{3}\b', modelo): continue
    cal = f['calidad'].upper()
    if trabajo == 'Cambio de pantalla':
        clase = clase_pantalla(f['seccion'], cal)
        if 'DIAGNÓSTICO' in f['seccion'].upper(): continue
    elif trabajo == 'Cambio de batería':
        if 'SIN FLEX' in cal or 'SIN FLEX' in crudo.upper(): continue
        clase = 'Con diagnóstico' if 'DIAGN' in cal else 'Normal'
    elif trabajo == 'Cambio de tapa trasera':
        if marca == 'iPhone':
            if 'CHASIS' in cal: trabajo = 'Cambio de carcasa completa (chasis)'; clase = 'Chasis completo'
            elif tapa_iphone_removible(modelo): clase = 'Tapa de vidrio'
            else: excluidas['tapa iPhone sin láser'] += 1; continue
        else: clase = 'Compatible'
    else:
        clase = 'Original' if 'ORIGINAL' in cal or not cal else cal.title()
    cvt = 'CVT-SRVI' in (crudo + ' ' + f['calidad']).upper()
    grupos[(marca, trabajo, modelo, clase)].append(dict(precio=int(f['precio']), cvt=cvt, pagina=f['pagina'], calidad=f['calidad']))

res = []
for (marca, trabajo, modelo, clase), ops in grupos.items():
    minimo = min(o['precio'] for o in ops)
    # Si la marca propia de Multiphone (CVT-SRVI) está al mismo precio mínimo o a menos de $1.000, se prefiere esa
    cvts = [o for o in ops if o['cvt'] and o['precio'] <= minimo + 1000]
    elegido = min(cvts or ops, key=lambda o: o['precio'])
    mo = mano_obra(trabajo, marca, modelo, clase)
    precio = int(math.ceil((elegido['precio'] * (1 + COLCHON) + mo) / 1000.0) * 1000)
    res.append(dict(marca=marca, equipo=bonito(modelo, marca), trabajo=trabajo, calidad=clase, costo=elegido['precio'],
                    mano_obra=mo, precio=precio, cvt='sí' if elegido['cvt'] else '', pagina=elegido['pagina'],
                    opciones=len(ops), detalle=elegido['calidad']))

ORDEN_T = ['Cambio de pantalla', 'Cambio de batería', 'Cambio de puerto de carga', 'Cambio de pin de carga (soldado)',
           'Cambio de tapa trasera', 'Cambio de carcasa completa (chasis)', 'Cambio de vidrio de cámara trasera',
           'Cambio de cámara trasera', 'Cambio de cámara frontal', 'Cambio de parlante', 'Cambio de auricular (el de las llamadas)',
           'Cambio de botón de encendido', 'Cambio de botones de volumen', 'Cambio de lector de huella', 'Cambio de bandeja SIM']
ORDEN_M = ['iPhone', 'Samsung', 'Motorola', 'Vivo']
def clave_modelo(e):
    nums = [int(n) for n in re.findall(r'\d+', e)] or [0]
    return (re.sub(r'\d.*', '', e), nums, e)
res.sort(key=lambda r: (ORDEN_M.index(r['marca']), ORDEN_T.index(r['trabajo']), clave_modelo(r['equipo']), r['calidad']))

with open(salida + '.csv', 'w', newline='', encoding='utf-8') as fh:
    w = csv.writer(fh)
    w.writerow(['marca', 'equipo', 'trabajo', 'calidad', 'costo_repuesto', 'mano_obra', 'precio_estimado', 'marca_cvt_srvi', 'pagina_lista', 'calidad_en_la_lista'])
    for r in res:
        w.writerow([r['marca'], r['equipo'], r['trabajo'], r['calidad'], r['costo'], r['mano_obra'], r['precio'], r['cvt'], r['pagina'], r['detalle']])

def clp(n): return '$' + f'{int(n):,}'.replace(',', '.')
md = []
for marca in ORDEN_M:
    for t in ORDEN_T[:3]:
        rs = [r for r in res if r['marca'] == marca and r['trabajo'] == t]
        if not rs: continue
        md.append(f'\n### {marca} · {t} ({len(rs)})\n')
        md.append('| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** |')
        md.append('|---|---|---:|---:|---:|')
        for r in rs:
            md.append(f"| {r['equipo']} | {r['calidad']} | {clp(r['costo'])} | {clp(r['mano_obra'])} | **{clp(r['precio'])}** |")
open(salida + '-tablas.md', 'w', encoding='utf-8').write('\n'.join(md) + '\n')
print(len(res), 'filas'); print(excluidas)
c = collections.Counter((r['marca'], r['trabajo']) for r in res)
for k in sorted(c, key=lambda k: (ORDEN_M.index(k[0]), ORDEN_T.index(k[1]))): print(c[k], k)
