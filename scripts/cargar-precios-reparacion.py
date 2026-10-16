# Arma el SQL para cargar el cotizador de reparaciones (tabla reparaciones_precios, sql/102) desde el CSV que genera
# docs/estudios-precios/2026-10-16-servicios-celulares-multiphone-calculo.py.
# Reemplaza las filas del mismo proveedor (las de una lista anterior quedan fuera).
#
# Uso:
#   python scripts/cargar-precios-reparacion.py docs/estudios-precios/2026-10-16-servicios-celulares-multiphone.csv 2026-09-21 salida.sql
#   npx supabase db query --file salida.sql --linked
import csv, sys

entrada, fecha_lista, salida = sys.argv[1], sys.argv[2], sys.argv[3]
PROVEEDOR = 'Multiphone'

def q(v):
    if v is None or v == '': return 'null'
    return "'" + str(v).replace("'", "''") + "'"

filas = list(csv.DictReader(open(entrada, encoding='utf-8')))
valores = []
for f in filas:
    valores.append('(' + ', '.join([
        q(f['marca']), q(f['equipo']), q(f['trabajo']), q(f['calidad']),
        str(int(float(f['costo_repuesto']))), str(int(float(f['mano_obra']))), str(int(float(f['precio_estimado']))),
        q(PROVEEDOR), q(fecha_lista), str(int(f['pagina_lista'])) if f.get('pagina_lista') else 'null',
        q((f.get('calidad_en_la_lista') or '')[:200]),
    ]) + ')')

sql = ['begin;',
       f"delete from reparaciones_precios where proveedor = {q(PROVEEDOR)};",
       'insert into reparaciones_precios (marca, equipo, trabajo, calidad, costo_repuesto, mano_obra, precio, proveedor, lista_fecha, pagina, detalle_lista) values',
       ',\n'.join(valores) + ';',
       'commit;',
       'select count(*) as cargadas from reparaciones_precios where proveedor = ' + q(PROVEEDOR) + ';']
open(salida, 'w', encoding='utf-8').write('\n'.join(sql) + '\n')
print(len(valores), 'filas')
