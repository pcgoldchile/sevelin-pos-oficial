# Genera la propuesta de precios estimados de reparación de celulares.
# Costos: LifeMax Store (lifemaxstore.cl/products.json), leídos el 15-10-2026, IVA incluido.
# Competencia: My Phone Express (MPX, Providencia) y ClinicCel (CC, Providencia), leídos el 15-10-2026.
import csv, math, sys

COLCHON = 0.15          # flete a Arica + variación de precio del repuesto
FECHA = '2026-10-15'

MO = {  # mano de obra con IVA, por trabajo y nivel
    'PANT_AND_BASICA': 20000, 'PANT_AND_OLED': 25000, 'PANT_AND_ALTA': 35000,
    'PANT_IP_A': 20000, 'PANT_IP_A_OLED': 25000, 'PANT_IP_B': 30000, 'PANT_IP_C': 40000, 'PANT_IP_D': 50000,
    'BAT_AND': 15000, 'BAT_IP_0': 10000, 'BAT_IP_A': 15000, 'BAT_IP_B': 18000, 'BAT_IP_C': 20000,
    'PUERTO_AND': 15000, 'PUERTO_IP_A': 20000, 'PUERTO_IP_B': 25000,
    'TAPA_AND': 10000, 'VIDRIO_CAM': 10000,
}

def precio(costo, nivel):
    return int(math.ceil((costo * (1 + COLCHON) + MO[nivel]) / 1000.0) * 1000)

filas = []  # marca, equipo, trabajo, calidad, costo, nivel, estimado(bool), mpx, cc
def f(marca, equipo, trabajo, calidad, costo, nivel, est=False, mpx=None, cc=None):
    filas.append(dict(marca=marca, equipo=equipo, trabajo=trabajo, calidad=calidad, costo=costo,
                      nivel=nivel, estimado=est, mpx=mpx, cc=cc))

P, B, C, T, V = 'Cambio de pantalla', 'Cambio de batería', 'Cambio de puerto de carga', 'Cambio de tapa trasera', 'Cambio de vidrio de cámara trasera'

# ---------- iPhone: pantallas (nivel A = 7 a 11, B = 12-13, C = 14-15, D = 16-17)
ip_pant = [
  ('iPhone 7', [('LCD', 11250, 'PANT_IP_A')]),
  ('iPhone 8 / SE 2020 / SE 2022', [('LCD', 10000, 'PANT_IP_A')]),
  ('iPhone 8 Plus', [('LCD', 12500, 'PANT_IP_A')]),
  ('iPhone X', [('Incell', 18750, 'PANT_IP_A', 45000), ('OLED', 32500, 'PANT_IP_A_OLED', 65000)]),
  ('iPhone XR', [('Incell', 17500, 'PANT_IP_A', 40000), ('LCD calidad original', 20000, 'PANT_IP_A', 50000)]),
  ('iPhone XS', [('Incell', 17500, 'PANT_IP_A', 45000), ('OLED', 36250, 'PANT_IP_A_OLED', 65000)]),
  ('iPhone XS Max', [('Incell', 21250, 'PANT_IP_A', 65000), ('OLED', 42500, 'PANT_IP_A_OLED', 90000)]),
  ('iPhone 11', [('Incell', 17500, 'PANT_IP_A', 45000), ('LCD calidad original', 20000, 'PANT_IP_A', 50000)]),
  ('iPhone 11 Pro', [('Incell', 21250, 'PANT_IP_A', 75000), ('OLED', 36250, 'PANT_IP_A_OLED', 95000)]),
  ('iPhone 11 Pro Max', [('Incell', 22500, 'PANT_IP_A', 75000), ('OLED', 47500, 'PANT_IP_A_OLED', 95000)]),
  ('iPhone 12 / 12 Pro', [('Incell', 18750, 'PANT_IP_B', 80000), ('OLED', 43750, 'PANT_IP_B', 95000)]),
  ('iPhone 12 mini', [('Incell', 23750, 'PANT_IP_B', 85000), ('OLED', 67500, 'PANT_IP_B', 110000)]),
  ('iPhone 12 Pro Max', [('Incell', 25000, 'PANT_IP_B'), ('OLED', 58750, 'PANT_IP_B')]),
  ('iPhone 13', [('Incell', 21250, 'PANT_IP_B', 85000), ('OLED', 52500, 'PANT_IP_B', 120000)]),
  ('iPhone 13 mini', [('Incell', 22500, 'PANT_IP_B', 95000), ('OLED', 71250, 'PANT_IP_B', 130000)]),
  ('iPhone 13 Pro', [('Incell', 30000, 'PANT_IP_B'), ('OLED', 56250, 'PANT_IP_B', 130000)]),
  ('iPhone 13 Pro Max', [('Incell', 27500, 'PANT_IP_B'), ('OLED', 61250, 'PANT_IP_B', 150000)]),
  ('iPhone 14', [('Incell', 28750, 'PANT_IP_C'), ('OLED', 50000, 'PANT_IP_C', 130000)]),
  ('iPhone 14 Plus', [('Incell', 30000, 'PANT_IP_C'), ('OLED', 72500, 'PANT_IP_C')]),
  ('iPhone 14 Pro', [('Incell', 33750, 'PANT_IP_C'), ('OLED', 68750, 'PANT_IP_C', 240000)]),
  ('iPhone 14 Pro Max', [('Incell', 33750, 'PANT_IP_C'), ('OLED', 62500, 'PANT_IP_C', 250000)]),
  ('iPhone 15', [('Incell', 25000, 'PANT_IP_C'), ('OLED', 58750, 'PANT_IP_C', 200000)]),
  ('iPhone 15 Plus', [('Incell', 26250, 'PANT_IP_C'), ('OLED', 60000, 'PANT_IP_C')]),
  ('iPhone 15 Pro', [('Incell', 36250, 'PANT_IP_C'), ('OLED', 60000, 'PANT_IP_C', 250000)]),
  ('iPhone 15 Pro Max', [('Incell', 27500, 'PANT_IP_C'), ('OLED', 65000, 'PANT_IP_C', 260000)]),
  ('iPhone 16e', [('OLED', 55000, 'PANT_IP_D')]),
  ('iPhone 16', [('OLED', 61250, 'PANT_IP_D')]),
  ('iPhone 16 Plus', [('OLED', 61250, 'PANT_IP_D')]),
  ('iPhone 16 Pro', [('OLED', 77500, 'PANT_IP_D')]),
  ('iPhone 16 Pro Max', [('OLED', 80000, 'PANT_IP_D')]),
  ('iPhone 17 Pro', [('OLED', 112500, 'PANT_IP_D')]),
  ('iPhone 17 Pro Max', [('OLED', 103750, 'PANT_IP_D')]),
]
# ClinicCel "OLED SOFT" (comparable con nuestro OLED)
cc_oled = {'iPhone X': 65000, 'iPhone XS': 75000, 'iPhone XS Max': 85000, 'iPhone XR': 45000, 'iPhone 11': 55000,
           'iPhone 11 Pro': 85000, 'iPhone 11 Pro Max': 85000, 'iPhone 12 mini': 110000, 'iPhone 12 / 12 Pro': 95000,
           'iPhone 12 Pro Max': 150000, 'iPhone 13': 95000, 'iPhone 13 Pro': 115000, 'iPhone 13 Pro Max': 145000,
           'iPhone 14': 125000, 'iPhone 14 Plus': 125000, 'iPhone 14 Pro': 140000, 'iPhone 14 Pro Max': 140000,
           'iPhone 15': 165000, 'iPhone 15 Plus': 170000, 'iPhone 15 Pro': 170000, 'iPhone 15 Pro Max': 170000,
           'iPhone 16': 170000, 'iPhone 16 Plus': 190000, 'iPhone 16 Pro': 190000, 'iPhone 16 Pro Max': 190000,
           'iPhone 17 Pro': 260000, 'iPhone 17 Pro Max': 260000}
for eq, ops in ip_pant:
    for o in ops:
        cal, costo, niv = o[0], o[1], o[2]
        mpx = o[3] if len(o) > 3 else None
        cc = cc_oled.get(eq) if cal in ('OLED', 'LCD calidad original') else None
        f('iPhone', eq, P, cal, costo, niv, mpx=mpx, cc=cc)

# ---------- iPhone: baterías (12 en adelante: "autoprogramable sin alerta" según el proveedor)
cc_bat = {'iPhone 7': 20000, 'iPhone 8 / SE 2020': 25000, 'iPhone 8 Plus': 25000, 'iPhone X': 35000, 'iPhone XR': 45000,
          'iPhone XS': 45000, 'iPhone XS Max': 45000, 'iPhone SE 2022': 45000, 'iPhone 11': 55000, 'iPhone 11 Pro': 55000,
          'iPhone 11 Pro Max': 55000, 'iPhone 12 / 12 Pro': 68000, 'iPhone 12 mini': 68000, 'iPhone 12 Pro Max': 70000,
          'iPhone 13': 75000, 'iPhone 13 mini': 75000, 'iPhone 13 Pro': 80000, 'iPhone 13 Pro Max': 80000,
          'iPhone 14': 75000, 'iPhone 14 Plus': 75000, 'iPhone 14 Pro': 80000, 'iPhone 14 Pro Max': 80000,
          'iPhone 15': 95000, 'iPhone 15 Plus': 95000, 'iPhone 15 Pro': 95000, 'iPhone 15 Pro Max': 95000}
mpx_bat = {'iPhone X': 39990, 'iPhone XR': 39990, 'iPhone XS': 39990, 'iPhone 11': 45000, 'iPhone 11 Pro': 45000,
           'iPhone 11 Pro Max': 45000, 'iPhone 12 / 12 Pro': 67990, 'iPhone 12 Pro Max': 74990, 'iPhone 13': 71990,
           'iPhone 13 Pro': 72990, 'iPhone 13 Pro Max': 89900, 'iPhone 14': 89990, 'iPhone 14 Plus': 89990, 'iPhone 14 Pro': 89990}
ip_bat = [
  ('iPhone 7', 'Compatible', 8750, 'BAT_IP_0'), ('iPhone 8 / SE 2020', 'Compatible', 8750, 'BAT_IP_0'),
  ('iPhone 8 Plus', 'Compatible', 10000, 'BAT_IP_0'), ('iPhone SE 2022', 'Alta duración', 14990, 'BAT_IP_A'),
  ('iPhone X', 'Alta duración', 14990, 'BAT_IP_A'), ('iPhone XR', 'Alta duración', 13990, 'BAT_IP_A'),
  ('iPhone XS', 'Alta duración', 14990, 'BAT_IP_A'), ('iPhone XS Max', 'Alta duración', 14990, 'BAT_IP_A'),
  ('iPhone 11', 'Alta duración', 14990, 'BAT_IP_A'), ('iPhone 11 Pro', 'Alta duración', 16990, 'BAT_IP_A'),
  ('iPhone 11 Pro Max', 'Alta duración', 17990, 'BAT_IP_A'),
  ('iPhone 12 / 12 Pro', 'Sin aviso de batería', 17500, 'BAT_IP_B'), ('iPhone 12 mini', 'Sin aviso de batería', 21250, 'BAT_IP_B'),
  ('iPhone 12 Pro Max', 'Sin aviso de batería', 22500, 'BAT_IP_B'), ('iPhone 13', 'Sin aviso de batería', 16250, 'BAT_IP_B'),
  ('iPhone 13 mini', 'Sin aviso de batería', 17500, 'BAT_IP_B'), ('iPhone 13 Pro', 'Sin aviso de batería', 21250, 'BAT_IP_B'),
  ('iPhone 13 Pro Max', 'Sin aviso de batería', 23750, 'BAT_IP_B'),
  ('iPhone 14', 'Sin aviso de batería', 21250, 'BAT_IP_C'), ('iPhone 14 Plus', 'Sin aviso de batería', 22500, 'BAT_IP_C'),
  ('iPhone 14 Pro', 'Sin aviso de batería', 23750, 'BAT_IP_C'), ('iPhone 14 Pro Max', 'Sin aviso de batería', 26250, 'BAT_IP_C'),
  ('iPhone 15', 'Sin aviso de batería', 23750, 'BAT_IP_C'), ('iPhone 15 Plus', 'Sin aviso de batería', 25000, 'BAT_IP_C'),
  ('iPhone 15 Pro', 'Sin aviso de batería', 27500, 'BAT_IP_C'), ('iPhone 15 Pro Max', 'Sin aviso de batería', 30000, 'BAT_IP_C'),
]
for eq, cal, costo, niv in ip_bat:
    f('iPhone', eq, B, cal, costo, niv, mpx=mpx_bat.get(eq), cc=cc_bat.get(eq))

# ---------- iPhone: puerto (flex) de carga
cc_puerto = {'iPhone X': 35000, 'iPhone XR': 35000, 'iPhone XS': 35000, 'iPhone XS Max': 45000, 'iPhone 11': 45000,
             'iPhone 11 Pro Max': 55000, 'iPhone 12': 55000, 'iPhone 12 Pro / 12 Pro Max': 65000, 'iPhone 13 / 13 Pro': 65000,
             'iPhone SE 2020': 35000}
for eq, costo, niv in [('iPhone 7', 3690, 'PUERTO_IP_A'), ('iPhone 8', 3750, 'PUERTO_IP_A'), ('iPhone 8 Plus', 3690, 'PUERTO_IP_A'),
                       ('iPhone SE 2020', 3750, 'PUERTO_IP_A'), ('iPhone X', 3690, 'PUERTO_IP_A'), ('iPhone XR', 3750, 'PUERTO_IP_A'),
                       ('iPhone XS', 6150, 'PUERTO_IP_A'), ('iPhone XS Max', 6150, 'PUERTO_IP_A'), ('iPhone 11', 3750, 'PUERTO_IP_A'),
                       ('iPhone 11 Pro Max', 24600, 'PUERTO_IP_A'), ('iPhone 12', 5000, 'PUERTO_IP_B'),
                       ('iPhone 12 Pro / 12 Pro Max', 24600, 'PUERTO_IP_B'), ('iPhone 13 / 13 Pro', 6250, 'PUERTO_IP_B')]:
    f('iPhone', eq, C, 'Flex compatible', costo, niv, cc=cc_puerto.get(eq))

# ---------- iPhone: vidrio de cámara trasera (todos cuestan ~$2.500)
f('iPhone', 'iPhone X a 15 Pro Max (todos)', V, 'Con adhesivo', 2500, 'VIDRIO_CAM')

# ---------- Samsung: pantallas
sam_p = [
  ('Galaxy A02 / A02s / A03 / A03s', 'LCD', 10000, 'PANT_AND_BASICA', 40000), ('Galaxy A04 / A04s', 'LCD', 11250, 'PANT_AND_BASICA', 40000),
  ('Galaxy A04e', 'LCD', 13990, 'PANT_AND_BASICA', 40000), ('Galaxy A05', 'LCD', 10000, 'PANT_AND_BASICA', 40000),
  ('Galaxy A06', 'LCD', 12500, 'PANT_AND_BASICA', 45000), ('Galaxy A07', 'LCD', 11250, 'PANT_AND_BASICA', 45000),
  ('Galaxy A10', 'LCD', 11250, 'PANT_AND_BASICA'), ('Galaxy A11', 'LCD', 13990, 'PANT_AND_BASICA'),
  ('Galaxy A12', 'LCD', 11250, 'PANT_AND_BASICA', 45000), ('Galaxy A13 4G', 'LCD', 11250, 'PANT_AND_BASICA', 45000),
  ('Galaxy A13 5G', 'LCD', 13750, 'PANT_AND_BASICA', 45000), ('Galaxy A14 4G', 'LCD', 13750, 'PANT_AND_BASICA'),
  ('Galaxy A14 5G', 'LCD', 14990, 'PANT_AND_BASICA'), ('Galaxy A20s', 'LCD', 11250, 'PANT_AND_BASICA', 45000),
  ('Galaxy A21s', 'LCD', 11250, 'PANT_AND_BASICA', 45000), ('Galaxy A22 5G', 'LCD', 15000, 'PANT_AND_BASICA', 45000),
  ('Galaxy A23', 'LCD', 11250, 'PANT_AND_BASICA'), ('Galaxy A32 5G', 'LCD', 16990, 'PANT_AND_BASICA'),
  ('Galaxy M12', 'LCD', 16990, 'PANT_AND_BASICA'),
  ('Galaxy A20', 'Incell', 11250, 'PANT_AND_BASICA'), ('Galaxy A20', 'OLED', 28750, 'PANT_AND_OLED', 55000),
  ('Galaxy A30', 'Incell', 12500, 'PANT_AND_BASICA'), ('Galaxy A30', 'OLED', 35000, 'PANT_AND_OLED'),
  ('Galaxy A30s', 'Incell', 15000, 'PANT_AND_BASICA'), ('Galaxy A30s', 'OLED', 33750, 'PANT_AND_OLED'),
  ('Galaxy A50', 'Incell', 15000, 'PANT_AND_BASICA'), ('Galaxy A50', 'OLED', 32500, 'PANT_AND_OLED'),
  ('Galaxy A51', 'Incell', 13750, 'PANT_AND_BASICA'), ('Galaxy A51', 'OLED', 37500, 'PANT_AND_OLED'),
  ('Galaxy A70', 'Incell', 12500, 'PANT_AND_BASICA'), ('Galaxy A70', 'OLED', 37500, 'PANT_AND_OLED'),
  ('Galaxy A71', 'Incell', 17990, 'PANT_AND_BASICA'), ('Galaxy A71', 'OLED', 40000, 'PANT_AND_OLED'),
  ('Galaxy A15', 'OLED', 42500, 'PANT_AND_OLED'), ('Galaxy A22 4G', 'OLED', 35000, 'PANT_AND_OLED', 75000),
  ('Galaxy A24', 'OLED', 34990, 'PANT_AND_OLED'), ('Galaxy A25', 'OLED', 36990, 'PANT_AND_OLED'),
  ('Galaxy A31', 'OLED', 33750, 'PANT_AND_OLED'), ('Galaxy A32 4G', 'OLED', 33750, 'PANT_AND_OLED'),
  ('Galaxy A33', 'OLED', 40000, 'PANT_AND_OLED'), ('Galaxy A34', 'OLED', 47500, 'PANT_AND_OLED'),
  ('Galaxy A35', 'OLED', 46250, 'PANT_AND_OLED'), ('Galaxy A52', 'OLED', 36990, 'PANT_AND_OLED'),
  ('Galaxy A52s', 'OLED', 40000, 'PANT_AND_OLED'), ('Galaxy A53', 'OLED', 49990, 'PANT_AND_OLED'),
  ('Galaxy A54', 'OLED', 39990, 'PANT_AND_OLED'), ('Galaxy A55', 'OLED', 37500, 'PANT_AND_OLED'),
  ('Galaxy A56', 'Incell', 46250, 'PANT_AND_OLED'), ('Galaxy A72', 'OLED', 42990, 'PANT_AND_OLED'),
  ('Galaxy A73', 'OLED', 43750, 'PANT_AND_OLED'),
  ('Galaxy S20 FE', 'OLED', 38750, 'PANT_AND_ALTA', 175000), ('Galaxy S21 FE', 'OLED', 47500, 'PANT_AND_ALTA', 230000),
  ('Galaxy S21 Plus', 'OLED', 86250, 'PANT_AND_ALTA', 250000), ('Galaxy S21 Ultra', 'OLED', 103750, 'PANT_AND_ALTA', 320000),
  ('Galaxy S22 Ultra', 'OLED', 102500, 'PANT_AND_ALTA', 380000), ('Galaxy S23 FE', 'OLED', 41990, 'PANT_AND_ALTA', 190000),
  ('Galaxy S23 Ultra', 'OLED', 108750, 'PANT_AND_ALTA', 390000), ('Galaxy Note 20', 'OLED', 81250, 'PANT_AND_ALTA'),
  ('Galaxy Note 20 Ultra', 'OLED', 97500, 'PANT_AND_ALTA'),
]
for o in sam_p:
    f('Samsung', o[0], P, o[1], o[2], o[3], mpx=o[4] if len(o) > 4 else None)

# ---------- Samsung: baterías (EST = sin precio publicado, costo estimado por gama)
EST_BAT = 12990
for eq, costo, est in [('Galaxy A01', 11990, 0), ('Galaxy A02 / A04s / A21s / A22 4G', 12990, 0), ('Galaxy A10', 7990, 0),
                       ('Galaxy A10s / A20s', 12990, 0), ('Galaxy A11', 12990, 0), ('Galaxy A12 / A13 4G', 10000, 0),
                       ('Galaxy A13 5G', 12990, 0), ('Galaxy A14 4G / 5G', 12990, 0), ('Galaxy A20 / A30', 10990, 0),
                       ('Galaxy A22 5G', 13990, 0), ('Galaxy A23 5G / A73', 10000, 0), ('Galaxy A32 / A42 / A72', 12990, 0),
                       ('Galaxy A33 / A53', 13990, 0), ('Galaxy A34 / A54', 12990, 0), ('Galaxy A51', 11990, 0),
                       ('Galaxy A52 / S20 FE', 16990, 0), ('Galaxy S21 FE', 10000, 0), ('Galaxy S21 Ultra', 10000, 0),
                       ('Galaxy S23 Ultra', 11250, 0), ('Galaxy S24 Ultra', 13990, 0), ('Galaxy Note 20 Ultra', 13990, 0),
                       ('Galaxy A05 / A05s / A06', EST_BAT, 1), ('Galaxy A15 / A25', EST_BAT, 1), ('Galaxy A35 / A55', EST_BAT, 1),
                       ('Galaxy A24', EST_BAT, 1)]:
    f('Samsung', eq, B, 'Alta duración', costo, 'BAT_AND', est=bool(est))

# ---------- Samsung: puerto de carga (placa/flex de carga)
EST_FLEX = 4920
for eq, costo, est in [('Galaxy A01', 6150, 0), ('Galaxy A02 / A02s / A03', 3690, 0), ('Galaxy A03s', 4920, 0), ('Galaxy A04 / A04s', 3750, 0),
                       ('Galaxy A10', 4920, 0), ('Galaxy A10s', 3750, 0), ('Galaxy A11 / A12 / A13 4G', 3690, 0), ('Galaxy A13 5G', 7380, 0),
                       ('Galaxy A20 / A20s / A21s', 3690, 0), ('Galaxy A22 4G / 5G', 3750, 0), ('Galaxy A23', 3690, 0), ('Galaxy A30', 6150, 0),
                       ('Galaxy A30s / A50', 3690, 0), ('Galaxy A31 / A51', 3750, 0), ('Galaxy A32 4G', 3690, 0), ('Galaxy A32 5G', 7380, 0),
                       ('Galaxy A33', 3750, 0), ('Galaxy A50s / A71', 6150, 0), ('Galaxy A52 / A72', 11070, 0), ('Galaxy A52s / A73', 8750, 0),
                       ('Galaxy A70', 3750, 0), ('Galaxy S20 FE', 5000, 0), ('Galaxy S21 FE', 8610, 0), ('Galaxy S21 / S22', 8750, 0),
                       ('Galaxy S22 Ultra', 20910, 0),
                       ('Galaxy A05 / A05s / A06', EST_FLEX, 1), ('Galaxy A14 / A15 / A25', EST_FLEX, 1), ('Galaxy A34 / A35 / A54 / A55', EST_FLEX, 1)]:
    f('Samsung', eq, C, 'Placa de carga', costo, 'PUERTO_AND', est=bool(est))

# ---------- Samsung: tapa trasera
for eq, costo in [('Galaxy A10', 2460), ('Galaxy A20', 4920), ('Galaxy A20s / A30s / A31 / A50 / A51 / A70', 3690)]:
    f('Samsung', eq, T, 'Compatible', costo, 'TAPA_AND')

# ---------- Motorola: pantallas
mot_p = [
  ('Moto E6 Play', 'LCD', 10000, 'PANT_AND_BASICA'), ('Moto E7 / E7 Power', 'LCD', 13990, 'PANT_AND_BASICA'),
  ('Moto E7i Power', 'LCD', 11250, 'PANT_AND_BASICA'), ('Moto E13', 'LCD', 13990, 'PANT_AND_BASICA'),
  ('Moto E20', 'LCD', 13990, 'PANT_AND_BASICA', 40000), ('Moto E22 / E22i', 'LCD', 11250, 'PANT_AND_BASICA'),
  ('Moto E30 / E40', 'LCD', 15990, 'PANT_AND_BASICA'), ('Moto G04', 'LCD', 13990, 'PANT_AND_BASICA'),
  ('Moto G13 / G23', 'LCD', 11250, 'PANT_AND_BASICA', 55000), ('Moto G14 / G54', 'LCD', 13750, 'PANT_AND_BASICA', 50000),
  ('Moto G20', 'LCD', 11250, 'PANT_AND_BASICA', 40000), ('Moto G24 / G24 Power', 'LCD', 11250, 'PANT_AND_BASICA', 50000),
  ('Moto G30', 'LCD', 11250, 'PANT_AND_BASICA', 40000), ('Moto G32', 'LCD', 18750, 'PANT_AND_BASICA'),
  ('Moto G34', 'LCD', 11250, 'PANT_AND_BASICA', 45000), ('Moto G35', 'LCD', 12500, 'PANT_AND_BASICA', 45000),
  ('Moto G50 5G', 'LCD', 11250, 'PANT_AND_BASICA', 45000), ('Moto G51', 'LCD', 16990, 'PANT_AND_BASICA', 45000),
  ('Moto G53', 'LCD', 15990, 'PANT_AND_BASICA'), ('Moto G60 / G40', 'LCD', 13750, 'PANT_AND_BASICA', 50000),
  ('Moto G60s', 'LCD', 13750, 'PANT_AND_BASICA', 50000), ('Moto G8 Play', 'LCD', 11250, 'PANT_AND_BASICA'),
  ('Moto G8 Power', 'LCD', 16990, 'PANT_AND_BASICA'), ('Moto G9 Play', 'LCD', 11250, 'PANT_AND_BASICA'),
  ('Moto G9 Plus', 'LCD', 14990, 'PANT_AND_BASICA'), ('Moto G9 Power', 'LCD', 15990, 'PANT_AND_BASICA'),
  ('Moto G100', 'LCD', 17990, 'PANT_AND_BASICA', 45000), ('Moto G200', 'LCD', 18750, 'PANT_AND_BASICA', 50000),
  ('Moto One Fusion', 'LCD', 11250, 'PANT_AND_BASICA'),
  ('Moto G50 4G', 'LCD', 25000, 'PANT_AND_BASICA', 70000),
  ('Moto G71 / G41 / G31', 'OLED', 37500, 'PANT_AND_OLED'), ('Moto G82', 'OLED', 55000, 'PANT_AND_OLED'),
  ('Moto G84', 'OLED', 42990, 'PANT_AND_OLED'),
  ('Motorola Edge 20 Lite', 'OLED', 57500, 'PANT_AND_ALTA'), ('Motorola Edge 30 Pro', 'Incell', 19363, 'PANT_AND_ALTA'),
  ('Motorola Edge 30 Pro', 'OLED', 53750, 'PANT_AND_ALTA', 117000), ('Motorola Edge 30 Fusion', 'OLED', 75000, 'PANT_AND_ALTA', 140000),
  ('Motorola Edge 30 Neo', 'OLED', 95000, 'PANT_AND_ALTA', 175000), ('Motorola Edge 40', 'OLED', 45000, 'PANT_AND_ALTA', 117000),
  ('Motorola Edge 40 Neo', 'OLED', 45000, 'PANT_AND_ALTA', 130000), ('Motorola Edge 50 Fusion', 'OLED', 40000, 'PANT_AND_ALTA', 117000),
  ('Motorola Edge 60 Fusion', 'OLED', 41250, 'PANT_AND_ALTA', 150000),
]
for o in mot_p:
    f('Motorola', o[0], P, o[1], o[2], o[3], mpx=o[4] if len(o) > 4 else None)

for eq, costo, est in [('Moto G50', 12990, 0), ('Moto One Vision', 12990, 0), ('Moto G7', 7490, 0), ('Moto G7 Play', 6990, 0),
                       ('Moto G04 / G24 / G34 / G54 (y otros recientes)', EST_BAT, 1)]:
    f('Motorola', eq, B, 'Alta duración', costo, 'BAT_AND', est=bool(est))
for eq, costo, est in [('Moto E7 / G9 Power / G100 / One', 3690, 0), ('Moto E7 Power / E7i / E20 / E30', 4920, 0),
                       ('Moto G30 / G50 5G / G8 Power / G9 Plus / One Fusion', 4920, 0), ('Moto G71', 3750, 0),
                       ('Moto G04 / G24 / G34 / G54 (y otros recientes)', EST_FLEX, 1)]:
    f('Motorola', eq, C, 'Placa de carga', costo, 'PUERTO_AND', est=bool(est))
for eq, costo in [('Moto E7i / G9 Plus', 2460), ('Moto E6s / G30 / G9 Power', 4920)]:
    f('Motorola', eq, T, 'Compatible', costo, 'TAPA_AND')

# ---------- Vivo
viv_p = [
  ('Vivo Y01', 'LCD', 13990, 40000), ('Vivo Y02s', 'LCD', 11250, 40000), ('Vivo Y11s', 'LCD', 11250, 40000),
  ('Vivo Y15s', 'LCD', 10000, 40000), ('Vivo Y20 / Y20s / Y20i', 'LCD', 11250, 40000), ('Vivo Y21s', 'LCD', 10000, 40000),
  ('Vivo Y27 5G', 'LCD', 12500, 40000), ('Vivo Y30', 'LCD', 17500, 50000), ('Vivo Y36 5G', 'LCD', 12500, 40000),
  ('Vivo Y55', 'LCD', 11250, 40000), ('Vivo Y33s / Y51 / Y53s / Y76', 'LCD', 13990, 45000),
]
for eq, cal, costo, mpx in viv_p:
    f('Vivo', eq, P, cal, costo, 'PANT_AND_BASICA', mpx=mpx)
f('Vivo', 'Vivo V20', P, 'Incell', 12500, 'PANT_AND_BASICA'); f('Vivo', 'Vivo V20', P, 'OLED', 31250, 'PANT_AND_OLED')
f('Vivo', 'Vivo V21', P, 'Incell', 15990, 'PANT_AND_BASICA'); f('Vivo', 'Vivo V21', P, 'OLED', 36250, 'PANT_AND_OLED')
f('Vivo', 'Vivo V25', P, 'Compatible', 15990, 'PANT_AND_BASICA')
f('Vivo', 'Vivo (cualquier Y)', B, 'Alta duración', EST_BAT, 'BAT_AND', est=True)
f('Vivo', 'Vivo Y20 / Y20s / Y20i', C, 'Placa de carga', 4920, 'PUERTO_AND')
f('Vivo', 'Vivo (otros Y)', C, 'Placa de carga', EST_FLEX, 'PUERTO_AND', est=True)

for r in filas:
    r['mano_obra'] = MO[r['nivel']]
    r['precio'] = precio(r['costo'], r['nivel'])
    r['ganancia'] = r['precio'] - r['costo']

out = sys.argv[1]
with open(out + '.csv', 'w', newline='', encoding='utf-8') as fh:
    w = csv.writer(fh)
    w.writerow(['marca', 'equipo', 'trabajo', 'calidad', 'costo_repuesto', 'mano_obra', 'precio_estimado', 'costo_estimado_por_gama', 'santiago_myphonexpress', 'santiago_cliniccel'])
    for r in filas:
        w.writerow([r['marca'], r['equipo'], r['trabajo'], r['calidad'], r['costo'], r['mano_obra'], r['precio'], 'si' if r['estimado'] else '', r['mpx'] or '', r['cc'] or ''])

def clp(n): return '—' if n in (None, '') else '$' + f'{int(n):,}'.replace(',', '.')
md = []
for marca in ['iPhone', 'Samsung', 'Motorola', 'Vivo']:
    for trab in [P, B, C, T, V]:
        rs = [r for r in filas if r['marca'] == marca and r['trabajo'] == trab]
        if not rs: continue
        md.append(f'\n### {marca} · {trab}\n')
        md.append('| Equipo | Calidad | Repuesto | Mano de obra | **Precio estimado** | Queda (con IVA) | Santiago |')
        md.append('|---|---|---:|---:|---:|---:|---|')
        for r in rs:
            rep = clp(r['costo']) + (' *' if r['estimado'] else '')
            stgo = ' · '.join(x for x in ['MPX ' + clp(r['mpx']) if r['mpx'] else '', 'CC ' + clp(r['cc']) if r['cc'] else ''] if x) or '—'
            md.append(f"| {r['equipo']} | {r['calidad']} | {rep} | {clp(r['mano_obra'])} | **{clp(r['precio'])}** | {clp(r['ganancia'])} | {stgo} |")
open(out + '-tablas.md', 'w', encoding='utf-8').write('\n'.join(md) + '\n')
print(len(filas), 'filas')
import collections
print(collections.Counter((r['marca'], r['trabajo']) for r in filas))
