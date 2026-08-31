-- ============================================================
-- SEVELIN POS — Migración 29
-- Revisión completa de subcategorías del catálogo web (90 productos
-- publicados, solo 1 tenía subcategoría antes de esto: "Fuentes de poder").
-- Criterio: solo se creó una subcategoría donde había 2+ productos con un
-- tipo claramente distinguible dentro de su categoría (ej. "Cables de Red"
-- dentro de "Cables y Adaptadores", pedido explícito del dueño) — categorías
-- con pocos productos o sin un grupo homogéneo se dejaron sin subcategoría
-- (Accesorios Móviles, Herramientas, Monitores, y lo que queda de Hogar y
-- Estilo de Vida tras sacar los 3 productos mal categorizados, ver abajo).
--
-- De paso se corrigieron 5 productos con la CATEGORÍA (no solo subcategoría)
-- equivocada — se notaron al revisar la lista completa:
--   - Memoria RAM Hiksemi 8GB DDR4: "Hogar y Estilo de Vida" → "Componentes PC"
--   - SSD Crucial E100 480GB: "Hogar y Estilo de Vida" → "Almacenamiento"
--   - Teclado Gamer Dblue K44: "Hogar y Estilo de Vida" → "Periféricos"
--   - Ventilador Gamer RGB 120mm (fan de gabinete): "Periféricos" → "Componentes PC"
--   - Servicio de Actualización de BIOS/Firmware: "Componentes PC" → "Servicios Técnicos"
--
-- Se actualizan categoria_web/subcategoria_web/categoria_id directo en
-- `productos` (no solo producto_categorias): son los 3 campos que lee
-- guardarProducto() del modal y los que sincroniza el trigger
-- notificar_sync_tienda() (sql/22) hacia productos_web — actualizar solo
-- producto_categorias no habría cambiado nada visible hasta la próxima vez
-- que alguien abriera y guardara el producto a mano.
-- ============================================================

-- --------------------------------------------------------------
-- 1. Nuevas subcategorías (producto_categorias.nombre es UNIQUE global,
--    no solo por padre — se revisaron los 12 nombres nuevos contra las
--    12 categorías de nivel superior y la subcategoría ya existente,
--    ninguno choca).
-- --------------------------------------------------------------
insert into producto_categorias (nombre, parent_id)
select v.nombre, c.id
from (values
  ('Pendrives', 'Almacenamiento'),
  ('SSD', 'Almacenamiento'),
  ('Audífonos', 'Audio'),
  ('Parlantes', 'Audio'),
  ('Cables de Red', 'Cables y Adaptadores'),
  ('Adaptadores y Cables de Video', 'Cables y Adaptadores'),
  ('Adaptadores USB', 'Cables y Adaptadores'),
  ('Coolers y Disipadores', 'Componentes PC'),
  ('Gabinetes', 'Componentes PC'),
  ('Baterías MagSafe', 'Energía Portátil'),
  ('Mouse', 'Periféricos'),
  ('Mandos y Joystick', 'Periféricos'),
  ('Teclados', 'Periféricos'),
  ('Mantenimiento y Limpieza', 'Servicios Técnicos'),
  ('Formateo y Respaldo de Datos', 'Servicios Técnicos'),
  ('Diagnóstico y Reparación', 'Servicios Técnicos')
) as v(nombre, categoria_padre)
join producto_categorias c on c.nombre = v.categoria_padre and c.parent_id is null
on conflict (nombre) do nothing;

-- --------------------------------------------------------------
-- 2. Corrección de categoría (5 productos mal categorizados) — se ponen
--    en su categoría correcta ANTES del paso 3, para que ahí les toque su
--    subcategoría junto con sus pares reales.
-- --------------------------------------------------------------
update productos set
  categoria_web = 'Componentes PC',
  subcategoria_web = null,
  categoria_id = (select id from producto_categorias where nombre = 'Componentes PC' and parent_id is null)
where sku = 'hiksemi-armor-hsc408u32e2'; -- Memoria RAM Hiksemi Armor 8GB DDR4

update productos set
  categoria_web = 'Almacenamiento',
  categoria_id = (select id from producto_categorias where nombre = 'Almacenamiento' and parent_id is null)
where sku = 'crucial-e100-480-gb-ct480e100ssd8'; -- SSD Crucial E100 480GB (subcategoría "SSD" en el paso 3)

update productos set
  categoria_web = 'Periféricos',
  categoria_id = (select id from producto_categorias where nombre = 'Periféricos' and parent_id is null)
where sku = 'dblue-gaming-keyboard-k44-15pzq'; -- Teclado Gamer Dblue K44 (subcategoría "Teclados" en el paso 3)

update productos set
  categoria_web = 'Componentes PC',
  categoria_id = (select id from producto_categorias where nombre = 'Componentes PC' and parent_id is null)
where sku = 'XD'; -- Ventilador Gamer RGB 120mm para Gabinete (subcategoría "Coolers y Disipadores" en el paso 3)

update productos set
  categoria_web = 'Servicios Técnicos',
  categoria_id = (select id from producto_categorias where nombre = 'Servicios Técnicos' and parent_id is null)
where sku = 'servicio-de-actualizacion-de-bios-firmware-para-placa-madre-biv3i'; -- (subcategoría "Diagnóstico y Reparación" en el paso 3)

-- --------------------------------------------------------------
-- 3. Asignación de subcategoría (categoria_web sin cambios salvo donde el
--    paso 2 ya la corrigió arriba).
-- --------------------------------------------------------------

-- Almacenamiento → Pendrives
update productos set
  subcategoria_web = 'Pendrives',
  categoria_id = (select id from producto_categorias where nombre = 'Pendrives')
where sku in (
  'pendrive-kingston-datatraveler-128gb-usb-3-2-dt70-tipo-c-1y2kg',
  'pendrive-kingston-datatraveler-64gb-usb-3-2-dt70-tipo-c-1rulk',
  'memoria-usb-kingston-datatraveler-exodia-128gb-usb-3-2-blanco-nw0hn',
  'pendrive-kingston-datatraveler-exodia-de-64gb-usb-3-2-negro-6vodg'
);

-- Almacenamiento → SSD
update productos set
  subcategoria_web = 'SSD',
  categoria_id = (select id from producto_categorias where nombre = 'SSD')
where sku in ('kingston-nv3-1-tb-snv3s-1000g', 'crucial-e100-480-gb-ct480e100ssd8');

-- Audio → Audífonos
update productos set
  subcategoria_web = 'Audífonos',
  categoria_id = (select id from producto_categorias where nombre = 'Audífonos')
where sku in ('AUD-M10-NEGRO', 'audifono-gamer-dgx-ghost-con-microfono-y-luz-led-roja-12ef1', 'audifonos-inalambricos-orejas-de-gato-rgb', 'JIRV31783');

-- Audio → Parlantes
update productos set
  subcategoria_web = 'Parlantes',
  categoria_id = (select id from producto_categorias where nombre = 'Parlantes')
where sku in ('parlante-inalambrico-bluetooth-portatil-masterg-1udz2', 'parlantes-gamer-rgb-usb-para-pc-5rpim');

-- Cables y Adaptadores → Cables de Red (pedido explícito del dueño)
update productos set
  subcategoria_web = 'Cables de Red',
  categoria_id = (select id from producto_categorias where nombre = 'Cables de Red')
where sku in ('UTVK69702', 'cable-red-utp-cat6e-rj45-15-metros-lan-cable-1u147');

-- Cables y Adaptadores → Adaptadores y Cables de Video
update productos set
  subcategoria_web = 'Adaptadores y Cables de Video',
  categoria_id = (select id from producto_categorias where nombre = 'Adaptadores y Cables de Video')
where sku in ('adaptador-hdmi-a-vga-43wbg', 'RYZS05640', 'cable-hdmi-macho-a-vga-macho-vx52a', 'CABLE-DP-DP-4K-2K');

-- Cables y Adaptadores → Adaptadores USB
update productos set
  subcategoria_web = 'Adaptadores USB',
  categoria_id = (select id from producto_categorias where nombre = 'Adaptadores USB')
where sku in ('otg-usb-c-vl6tx', 'hub-adaptador-usb-tipo-c-8-en-1-hdmi-4k-rj45-usb-sd-xkidk');

-- Componentes PC → Coolers y Disipadores (incluye el ventilador recategorizado en el paso 2)
update productos set
  subcategoria_web = 'Coolers y Disipadores',
  categoria_id = (select id from producto_categorias where nombre = 'Coolers y Disipadores')
where sku in ('cooler-cpu-newgen-twin-vortex-black-argb-7qmc3', 'DIFL15083', 'XD');

-- Componentes PC → Fuentes de poder (ya existía, se completan las 5 que faltaban)
update productos set
  subcategoria_web = 'Fuentes de poder',
  categoria_id = (select id from producto_categorias where nombre = 'Fuentes de poder')
where sku in (
  'fuente-de-poder-650w-certificada-80-bronce-msi-mag-a650bn-atx-1tcuz',
  'fuente-de-poder-aigo-at650-atx-650w-80-plus-bronze',
  'fuente-de-poder-atx-kronos-700w-certificada-80-plus-bronze',
  'fuente-de-poder-atx-kronos-750w-certificada-80-plus-bronze',
  'gigabyte-gp-p750bs-750-w',
  '123'
);

-- Componentes PC → Gabinetes
update productos set
  subcategoria_web = 'Gabinetes',
  categoria_id = (select id from producto_categorias where nombre = 'Gabinetes')
where sku in (
  'gabinete-gamer-darkflash-m305-panel-vidrio-3fan-argb-matx-white',
  'gabinete-kronos-evesky-pink-atx-vidrio-templado-usb-3-0',
  'gabinete-newgen-entry-matx-black-con-3-fans-frgb-n5dqe'
);

-- Energía Portátil → Baterías MagSafe
update productos set
  subcategoria_web = 'Baterías MagSafe',
  categoria_id = (select id from producto_categorias where nombre = 'Baterías MagSafe')
where sku in (
  'bateria-portatil-magsafe-10-000-mah-compatible-con-iphone-y-android-usb-c-h25eu',
  'bateria-portatil-magsafe-5-000-mah-compatible-con-iphone-y-android-7gunn'
);

-- Periféricos → Mouse
update productos set
  subcategoria_web = 'Mouse',
  categoria_id = (select id from producto_categorias where nombre = 'Mouse')
where sku in (
  'mouse-gamer-reptilex-rx0047-ergonomico-7-botones-usb-800-2400dpi-11k7s',
  'mouse-gamer-rgb',
  'mouse-gamer-rgb-707775-cinco-tech',
  'mouse-inalambrico-recargable-usb-c-silencioso-dual-bluetooth',
  'mouse-rgb-307812-cinco-tech',
  'mouse-urbano-labs-gamer-pro-con-luces-rgb-3-botones-negro1'
);

-- Periféricos → Mandos y Joystick
update productos set
  subcategoria_web = 'Mandos y Joystick',
  categoria_id = (select id from producto_categorias where nombre = 'Mandos y Joystick')
where sku in ('control-mando-joystick-usb-para-pc-ps3-1x5gk', 'RCWU85442');

-- Periféricos → Teclados (incluye el Dblue K44 recategorizado en el paso 2)
update productos set
  subcategoria_web = 'Teclados',
  categoria_id = (select id from producto_categorias where nombre = 'Teclados')
where sku in ('teclado-gamer-rgb', 'dblue-gaming-keyboard-k44-15pzq');

-- Servicios Técnicos → Mantenimiento y Limpieza
update productos set
  subcategoria_web = 'Mantenimiento y Limpieza',
  categoria_id = (select id from producto_categorias where nombre = 'Mantenimiento y Limpieza')
where sku in (
  'servicio-de-limpieza-basica-de-pc-remocion-de-polvo-1bhwi',
  'servicio-de-mantenimiento-preventivo-para-notebook-laptop-gamer-w7nka',
  'servicio-de-mantenimiento-preventivo-para-pc-gamer-desktop-torre-1l2ll',
  'limpieza-profesional-de-puerto-de-carga-1tf6u'
);

-- Servicios Técnicos → Formateo y Respaldo de Datos
update productos set
  subcategoria_web = 'Formateo y Respaldo de Datos',
  categoria_id = (select id from producto_categorias where nombre = 'Formateo y Respaldo de Datos')
where sku in (
  'formateo-completo-y-optimizacion-de-pc-notebook-sin-respaldo-24mm3',
  'servicio-de-formateo-optimizacion-y-respaldo-de-datos-4m128',
  'servicio-de-clonacion-de-disco-y-migracion-exacta-de-sistema-4fdht'
);

-- Servicios Técnicos → Diagnóstico y Reparación (incluye el servicio de BIOS recategorizado en el paso 2)
update productos set
  subcategoria_web = 'Diagnóstico y Reparación',
  categoria_id = (select id from producto_categorias where nombre = 'Diagnóstico y Reparación')
where sku in (
  'diagnostico-de-computador-gfppg',
  'servicio-integral-diagnostico-reparacion-de-arranque-y-video-r5ra7',
  'servicio-de-reprogramacion-de-bios-por-microelectronica-wduy8',
  'servicio-de-actualizacion-de-bios-firmware-para-placa-madre-biv3i'
);

-- ============================================================
-- VERIFICACIÓN
--   select categoria_web, subcategoria_web, count(*)
--     from productos where publicado_web = true
--     group by categoria_web, subcategoria_web
--     order by categoria_web, subcategoria_web nulls first;
--   -- Cruzar contra sevelin-tienda: la sincronización es automática (trigger
--   -- de sql/22), pero productos_web puede tardar unos segundos en reflejar
--   -- el cambio si pg_net está con cola.
-- ============================================================
