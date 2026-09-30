-- ============================================================
-- SEVELIN POS — Migración 74
-- Complemento de la 73 (servicios por equipo). Al verificar la tienda
-- aparecieron 14 servicios más (ids 299-312) publicados en "Servicios
-- Técnicos" pero con es_servicio = false: se crearon después de v62 sin
-- marcar la casilla, y por eso la 73 (que filtraba por es_servicio) no los
-- tocó. Se marcan como servicio, igual que los otros 29, y se ubican en el
-- árbol aprobado por el dueño. "Visita técnica a domicilio" no es de ningún
-- equipo: va a su propio grupo "A Domicilio". Idempotente.
-- ============================================================

insert into producto_categorias (nombre, parent_id)
select 'A Domicilio', c.id
from producto_categorias c
where c.nombre = 'Servicios Técnicos' and c.parent_id is null
on conflict (nombre) do nothing;

update productos p set
  es_servicio = true,
  categoria_web = 'Servicios Técnicos',
  subcategoria_web = v.sub,
  categoria_id = (select id from producto_categorias where nombre = v.sub)
from (values
  (299, 'PC de Escritorio'),               -- Instalación de tarjeta gráfica
  (300, 'PC de Escritorio'),               -- Pines doblados de procesador
  (301, 'PC de Escritorio'),               -- Pines de socket de placa madre
  (302, 'Formateo y Respaldo de Datos'),   -- Recuperación de datos
  (303, 'PC de Escritorio'),               -- Instalación de fuente de poder
  (304, 'PC de Escritorio'),               -- Chequeo de fuente de poder
  (305, 'Formateo y Respaldo de Datos'),   -- Chequeo de salud de disco
  (306, 'PC de Escritorio'),               -- Chequeo de memoria RAM
  (307, 'PC de Escritorio'),               -- Instalación de disco
  (308, 'PC de Escritorio'),               -- Optimización de PC gamer
  (309, 'Notebooks'),                      -- Cambio de batería de notebook
  (310, 'Notebooks'),                      -- Limpieza por derrame de líquido
  (311, 'A Domicilio'),                    -- Visita técnica a domicilio
  (312, 'Notebooks')                       -- Mantenimiento premium con PTM7950
) as v(id, sub)
where p.id = v.id
  and p.categoria_web = 'Servicios Técnicos'
  and (p.subcategoria_web is distinct from v.sub or not p.es_servicio);
