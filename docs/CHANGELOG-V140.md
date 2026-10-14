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

## v141 (14-10-2026, mismo día): cámara, ventana al escanear y lugar escrito
El dueño probó en su celular: "no me deja enfocar o cambiar la cámara, parece que se ocupa la 0,5x en vez de la 1x";
pidió una ventana al escanear ("no se ve bien la opción de guardar") y poder escribir el cajón.
- **Cámara:** pedir solo "cámara trasera" hace que muchos Android abran la gran angular (0,5x), que no enfoca de cerca.
  Ahora, con el permiso dado, se lee la lista de cámaras traseras y se abre la principal (la de número más bajo en
  "camera2 0, facing back"). Botón "🔄 Cambiar cámara (1 de 3)" que pasa a la siguiente y **queda guardada en ese
  teléfono**. Enfoque continuo si la cámara lo permite, tocar la imagen vuelve a enfocar, y barra "🔍 Acercar" (zoom)
  si la cámara lo trae. Resolución pedida: 1920×1080.
- **Ventana al escanear:** nombre, categoría, stock, "📍 Está en: …" (o "Todavía no tiene lugar") y un campo para
  escribir dónde se guarda, con "Guardar", "Ver ficha" y "📷 Escanear otro". El campo trae puesto el último lugar usado
  (para ordenar una repisa entera: escanear, Guardar, escanear otro).
- **Lugar escrito** también en la ficha del producto. Si el lugar no existe se crea ("b3" = "B3"), con sugerencias de
  los lugares que ya hay.
- Probado en la maqueta con cámaras simuladas (gran angular, principal y tele): abre la principal, cambia y recuerda,
  aplica enfoque y zoom, y la ventana guarda en un lugar existente y en uno nuevo. **No probado en un teléfono real.**
