-- ============================================================
-- SEVELIN POS — Migración 73
-- Servicios técnicos agrupados por EQUIPO (dueño, 30-09-2026: "que en los
-- servicios técnicos subcategorices más ... las mantenciones y limpiezas
-- para computador, notebook, celular"). Árbol aprobado por él el mismo día.
--
-- Antes eran 3 grupos por TIPO (Mantenimiento y Limpieza / Diagnóstico y
-- Reparación / Formateo y Respaldo de Datos), que mezclaban un mando de PS4
-- con un PC gamer. El cliente llega pensando en SU equipo.
--
--   PC de Escritorio           limpieza, mantención, tarjeta de video,
--                              diagnóstico, arranque y video, BIOS, ensamblado
--   Notebooks                  mantención, RAM, bisagras
--   Formateo y Respaldo de Datos   (se mantiene: sirve para PC y notebook)
--   Celulares                  pantalla, puerto de carga, limpieza de puerto,
--                              desbloqueo de cuenta Google (no publicados)
--   Consolas y Mandos          PS3/PS4/PS5, mandos, HDMI, diagnóstico
--   Impresoras                 mantención
--
-- Mismo mecanismo que la migración 29: se actualizan subcategoria_web,
-- categoria_web y categoria_id en `productos`, que es lo que sincroniza el
-- trigger hacia la tienda. Por id (varios servicios no tienen SKU).
-- Las dos subcategorías que quedan vacías se borran solo si de verdad no
-- queda ningún producto apuntándolas. Idempotente.
-- ============================================================

insert into producto_categorias (nombre, parent_id)
select v.nombre, c.id
from (values ('PC de Escritorio'), ('Notebooks'), ('Celulares'), ('Consolas y Mandos'), ('Impresoras')) as v(nombre)
join producto_categorias c on c.nombre = 'Servicios Técnicos' and c.parent_id is null
on conflict (nombre) do nothing;

update productos p set
  categoria_web = 'Servicios Técnicos',
  subcategoria_web = v.sub,
  categoria_id = (select id from producto_categorias where nombre = v.sub)
from (values
  -- PC de Escritorio
  (86, 'PC de Escritorio'), (89, 'PC de Escritorio'), (278, 'PC de Escritorio'),
  (118, 'PC de Escritorio'), (117, 'PC de Escritorio'), (178, 'PC de Escritorio'),
  (91, 'PC de Escritorio'), (90, 'PC de Escritorio'),
  -- Notebooks
  (88, 'Notebooks'), (227, 'Notebooks'), (276, 'Notebooks'),
  -- Formateo y Respaldo de Datos (sin cambios, se deja explícito)
  (136, 'Formateo y Respaldo de Datos'), (93, 'Formateo y Respaldo de Datos'), (92, 'Formateo y Respaldo de Datos'),
  -- Celulares
  (275, 'Celulares'), (274, 'Celulares'), (112, 'Celulares'), (290, 'Celulares'), (314, 'Celulares'),
  -- Consolas y Mandos
  (266, 'Consolas y Mandos'), (265, 'Consolas y Mandos'), (277, 'Consolas y Mandos'),
  (269, 'Consolas y Mandos'), (272, 'Consolas y Mandos'), (271, 'Consolas y Mandos'),
  (270, 'Consolas y Mandos'), (267, 'Consolas y Mandos'), (268, 'Consolas y Mandos'),
  -- Impresoras
  (273, 'Impresoras')
) as v(id, sub)
where p.id = v.id and p.es_servicio
  and p.subcategoria_web is distinct from v.sub;

delete from producto_categorias c
where c.nombre in ('Mantenimiento y Limpieza', 'Diagnóstico y Reparación')
  and not exists (select 1 from productos p where p.categoria_id = c.id);

-- VERIFICACIÓN
--   select subcategoria_web, count(*) from productos
--    where es_servicio and not coalesce(archivado,false) group by 1 order by 1;
