-- 105 · Animación del reel en el registro de Redes (dueño, 19-10-2026: "dame animaciones nuevas, con
-- diferentes estilos para elegir"). Solo para formato reel: clasica | impacto | suave | neon | galeria.
-- El registro la guarda para no repetir la misma animación con el mismo producto.
-- Idempotente.

alter table contenido_redes add column if not exists animacion text;
alter table contenido_redes drop constraint if exists contenido_redes_animacion_valida;
alter table contenido_redes add constraint contenido_redes_animacion_valida
  check (animacion is null or animacion in ('clasica', 'impacto', 'suave', 'neon', 'galeria'));

select count(*) as filas, count(animacion) as con_animacion from contenido_redes;
