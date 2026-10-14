# v140 · Bodega en la app del taller: escanear un producto y saber dónde está guardado (14-10-2026)

Sin migración: usa las tablas de lugares que existen desde `sql/60` (`ubicaciones` y `producto_ubicaciones`), que
hasta hoy no tenían ningún dato. Publicado.

## Qué pidió el dueño
Después de mudarse a San Rafael 896 no sabe dónde quedó cada producto. Pidió "una app donde pueda acceder a los
productos para ver dónde los voy guardando, y escanear su código de barras para saber qué categoría y en qué cajón van,
y si no tienen, agregar en qué cajón van". Algo simple. Tiene 9 muebles de 5 repisas en la bodega.

Decidió (14-10-2026): que vaya en la app del taller, como pestaña; que la usen todos los del taller; y que los lugares
se llamen por mueble y repisa, A1 a I5 (letra = mueble, número = repisa de abajo hacia arriba). Se crearon los 45.

## Qué quedó
- **Pestaña "Bodega"** en `/taller/` (para todos los usuarios con RUT y PIN):
  - **📷 Escanear código de barras:** abre la cámara trasera y lee el código solo, con el lector que trae Chrome en
    Android (`BarcodeDetector`, sin librerías: la política de seguridad del sitio no deja scripts de afuera en el
    taller). Al leerlo vibra, apaga la cámara y abre el producto. En un teléfono sin ese lector (iPhone, por ejemplo)
    avisa y se usa el buscador.
  - **Buscador:** por nombre (todas las palabras, en cualquier orden) o por código (solo números, 6 o más).
  - **Ficha del producto:** nombre, categoría › subcategoría, stock, código de barras y en qué lugares está. Los 45
    lugares en filas por mueble para tocar dónde se guarda; "＋ Lugar nuevo" para cajas ("Caja cables USB-C").
    "Sacar" quita la anotación, no el stock.
  - **Lugares:** tocar uno muestra todo lo anotado ahí, con el número de productos en cada botón.
  - **Código que no está en ningún producto:** se busca el producto por nombre y aparece "Guardar el código … en este
    producto". Así, la próxima vez se encuentra escaneando. Nunca pisa un código ya puesto ni repite el de otro
    producto (eso se cambia en la ficha del POS).
- **Servidor** (`/api/taller/bodega/...`): lugares, buscar, qué hay en un lugar, crear lugar, guardar y sacar un
  producto de un lugar, asociar código. No devuelve costo ni precio. Sin persona (PIN general del POS) solo se mira.
  El primer lugar de un producto queda como principal ("se busca primero"); si se saca, el que quede pasa a serlo.
  Mismo comportamiento que el POS, que ya muestra estos lugares en la ficha.
- Los servicios y los productos archivados no aparecen en la búsqueda.

## Cómo se probó
- 25 pruebas del servidor contra la maqueta del taller (servidor real, base en memoria): búsquedas, permisos, lugares,
  principal, código nuevo, código repetido o ya puesto.
- La pantalla en la maqueta (`taller-maqueta`), en tamaño celular: buscar, abrir, guardar en A2, ver qué hay en A2,
  código desconocido y asociarlo. El escáner se probó con una cámara y un lector simulados (lee, abre el producto y
  apaga la cámara).
- **No probado:** la cámara de un teléfono de verdad leyendo un código real. El navegador del computador no trae el
  lector.
