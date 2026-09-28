-- 70 · Textos editables desde el POS: preguntas de diagnóstico (v98, 28-09-2026)
-- ==============================================================================
-- EL PEDIDO (dueño, 28-09-2026)
-- Botón "Copiar preguntas de diagnóstico" junto a "Copiar datos para WhatsApp"
-- en el Check-In, con las preguntas numeradas "para que ellos solamente
-- respondan según el número", y "que yo en un futuro pueda editar estas
-- preguntas".
--
-- POR QUÉ UNA TABLA GENÉRICA
-- El POS no tenía ningún lugar para textos que el dueño cambie sin tocar
-- código. Una fila por texto (clave → contenido jsonb) sirve para este y para
-- los próximos (plantillas de WhatsApp, avisos) sin otra migración. La API solo
-- acepta las claves que conoce, y valida la forma de cada una.
--
-- Las preguntas se guardan como LISTA, sin número: el número lo pone el POS al
-- copiar, así al agregar, quitar o reordenar nunca quedan saltos.
--
-- Idempotente: si la fila ya existe (el dueño ya la editó), NO se pisa.
-- Tabla nueva → RLS activo sin políticas (solo la service_role).

create table if not exists textos_editables (
  clave text primary key,
  contenido jsonb not null,
  actualizado_en timestamptz not null default now()
);

alter table textos_editables enable row level security;

comment on table textos_editables is
  'Textos que el dueño edita desde el POS sin tocar código (clave → contenido). La API valida la forma de cada clave.';

insert into textos_editables (clave, contenido) values (
  'preguntas_diagnostico',
  jsonb_build_object(
    'encabezado', 'Para revisar tu equipo, respóndenos con el número de cada pregunta:',
    'preguntas', jsonb_build_array(
      '¿Qué equipo es? (marca y modelo, si lo sabes)',
      '¿Qué problema tiene? Lo que ves o escuchas: no enciende, se apaga solo, se calienta, pantalla azul, ruidos, lentitud…',
      '¿Desde cuándo pasa? ¿Empezó de a poco o de un momento a otro?',
      '¿Pasó algo justo antes? (golpe, caída, líquido, corte de luz, actualización o programa nuevo)',
      '¿Pasa siempre o a ratos? ¿Con algo en particular? (al jugar, al cargar, al abrir un programa)',
      '¿Lo han abierto o reparado antes? ¿Dónde y qué le hicieron?',
      '¿Le han cambiado o agregado piezas? (disco, RAM, pantalla, batería, fuente)',
      '¿Notas alguna otra falla, o hay algo más que quieras que revisemos de paso?',
      '¿Tiene fotos o documentos importantes adentro? ¿Tienes respaldo?',
      '¿Lo traerás con cargador u otros accesorios?'
    ),
    'cierre', 'Si tiene clave o PIN, tenla a mano para pedírtela, solo si hace falta para probarlo. ¡Gracias!'
  )
) on conflict (clave) do nothing;
