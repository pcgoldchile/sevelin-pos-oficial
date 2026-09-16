-- 54 · Envío: cuánto le cobré al cliente y cuánto demoró el viaje
-- ===============================================================
-- EL PROBLEMA (dueño, 16-09-2026)
-- "Le dije $3.000 al cliente, pero a la final la app me hizo pagar $3.500".
-- Esos $500 los puso el dueño de su bolsillo y hoy NO se ven en ninguna
-- parte: la tabla `envios` (sql/50) guarda un solo monto, el costo real,
-- que se va entero a gasto "Envíos / Despachos". La plata que salió está
-- bien contada; lo que falta es la otra mitad —lo que entró por ese envío—
-- para poder restar y ver la pérdida.
--
-- POR QUÉ NO SE REGISTRA COMO MERMA NI COMO GASTO APARTE
-- Porque los $3.500 YA están contados como gasto. Si además se anotaran
-- $500 de merma, esos $500 quedarían contados dos veces y el resultado del
-- mes saldría peor de lo que es. La diferencia es un dato DERIVADO
-- (cobrado − costo), no un movimiento de plata nuevo. Se calcula, se
-- muestra y se suma en los informes, pero no se asienta.
--
-- `cobrado_cliente` es NULL a propósito cuando no se anotó: un 0 querría
-- decir "envío regalado" y haría ver una pérdida que quizás no existe.
-- Solo las filas con un valor anotado entran al cálculo de pérdida.
--
-- `duracion_min` es el tiempo REAL que demoró el viaje (dueño eligió el
-- real, no el prometido). Con los km ya guardados permite saber qué
-- sectores salen caros en tiempo y no solo en plata.
--
-- Idempotente.

alter table envios
  add column if not exists cobrado_cliente numeric null check (cobrado_cliente is null or cobrado_cliente >= 0);

alter table envios
  add column if not exists duracion_min integer null check (duracion_min is null or (duracion_min >= 0 and duracion_min <= 1440));

comment on column envios.cobrado_cliente is
  'Lo que se le cobró al cliente por el despacho. NULL = no se anotó (distinto de 0, que es "envío regalado"). La pérdida del despacho es costo - cobrado_cliente, y es un dato DERIVADO: no se asienta como gasto porque el costo ya está completo en compras (sql/54).';

comment on column envios.duracion_min is
  'Minutos reales que demoró el viaje, anotados a mano. Con km permite ver qué sectores son caros en tiempo (sql/54).';

-- Para el resumen del paso de entrega: cuánto se lleva puesto de su bolsillo
-- en los últimos envíos. Sin índice esto hace scan completo de una tabla que
-- crece una fila por despacho.
create index if not exists envios_cobrado_idx
  on envios (creado_en desc) where cobrado_cliente is not null;
