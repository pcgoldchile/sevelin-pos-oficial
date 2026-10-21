-- Desbloqueo de cuenta Google: 1 solo servicio + notas por modelo (dueño, 20/21-10-2026)
begin;

-- 1. El #290 pasa a ser EL servicio. Mismo precio ($10.000, sin cambio). Su descripción vieja era la nota
--    del método del A02s ("BIT 7 FRP CABLE EDL CHIMERA"): se mueve a la nota de ese modelo (punto 3).
update productos set
  nombre = 'Desbloqueo de Cuenta Google (FRP)',
  descripcion = '<p>✨ Servicio para recuperar el acceso a tu celular cuando quedó bloqueado por la verificación de cuenta de Google (FRP), para que puedas configurarlo y usarlo con normalidad.</p><h3>✨ Características principales</h3><ul><li>Solución para el bloqueo de cuenta de Google (FRP)</li><li>Restablece el acceso completo al sistema del teléfono</li><li>Permite asociar una nueva cuenta de Google personal</li><li>El proceso depende de la marca y el modelo: se confirma al revisar el equipo</li><li>Realizado por personal técnico</li></ul>',
  descripcion_web = '<p>✨ Servicio para recuperar el acceso a tu celular cuando quedó bloqueado por la verificación de cuenta de Google (FRP), para que puedas configurarlo y usarlo con normalidad.</p><h3>✨ Características principales</h3><ul><li>Solución para el bloqueo de cuenta de Google (FRP)</li><li>Restablece el acceso completo al sistema del teléfono</li><li>Permite asociar una nueva cuenta de Google personal</li><li>El proceso depende de la marca y el modelo: se confirma al revisar el equipo</li><li>Realizado por personal técnico</li></ul>',
  nota_interna = 'Servicio único de desbloqueo de cuenta Google desde el 21-10-2026 (antes eran uno por modelo: #314 y #410, archivados). Cómo se hace en cada modelo: Servicio Técnico → Cotizaciones aproximadas.'
where id = 290;

-- 2. Los de un solo modelo quedan archivados (no se borran: su historial de ventas sigue igual).
update productos set archivado = true,
  nota_interna = 'Archivado por Claude el 21-10-2026: ahora hay un solo servicio de desbloqueo (#290). El modelo y el método quedaron en Cotizaciones aproximadas.'
where id in (314, 410);

-- 3. Una nota por marca y modelo, con lo que ya se sabe (ventas reales del POS).
insert into cotizaciones_referencia (equipo, trabajo, precio, nota, actualizado_por)
select v.equipo, 'Desbloqueo de cuenta Google (FRP)', v.precio, v.nota, 'claude'
from (values
  ('Samsung A02s (A025M)', 10000, 'Método: BIT 7 FRP, cable EDL, Chimera.' || chr(10) || 'Cobrado $10.000 el 15-09-2026 (venta #214).'),
  ('Samsung M12', 10000, 'Cobrado $10.000 el 18-10-2026 (venta #296).' || chr(10) || 'Método: falta anotar.'),
  ('Xiaomi Redmi Note 13 4G (23129RA5FL)', 0, 'Todavía no se cobra ninguno.' || chr(10) || 'Método: falta anotar.'),
  ('Huawei (modelo sin anotar)', 8000, 'Cobrado $8.000 el 28-08-2026 (venta #139, "Huawei FRP").' || chr(10) || 'Falta el modelo y el método.'),
  ('Samsung (modelo sin anotar)', 20000, 'Formateo + desbloqueo. Cobrado $20.000 el 23-08-2026 (venta #126, "Formateo Samsung FRP").' || chr(10) || 'Falta el modelo y el método.')
) as v(equipo, precio, nota)
where not exists (select 1 from cotizaciones_referencia c where c.equipo = v.equipo and c.trabajo = 'Desbloqueo de cuenta Google (FRP)');

select id, nombre, precio_unitario, archivado from productos where id in (290, 314, 410) order by id;
select id, equipo, precio from cotizaciones_referencia order by id;
commit;
