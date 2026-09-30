# v101 — Pendientes: la lista del dueño y de Claude, en el POS

**Fecha:** 30-09-2026
**Migración:** `sql/72-pendientes.sql` (tabla nueva `pendientes`, RLS activo sin políticas).
**Pedido del dueño:** *"crear en el POS una notificación pero para PENDIENTES ... donde se pueda ir marcando
checklist o tú mismo los marques, para ver qué está pendiente y qué cosas ya fueron chequeadas y hechas ...
siempre digo postergo, postergo, deja pendiente eso"*.

---

## 1. Qué hay

- **Chip "Pendientes" en el encabezado** (solo admin, siempre visible para poder anotar). Cuenta solo lo
  del dueño que toca hoy: los pendientes y los postergados cuya fecha de revisión ya llegó. Rojo si alguno
  pasó su fecha límite; verde "Pendientes al día" si no hay nada.
- **Modal con cuatro pestañas:** Míos · De Claude · Postergados · Hechos. Casilla para marcar hecho,
  **Postergar** (mañana / 3 días / una semana / otra fecha) y **Descartar** (dos clics, sin `confirm()`).
  En Hechos se ve quién lo cerró (tú o Claude), cuándo y la nota de cómo se verificó; **Reabrir** lo
  devuelve.
- **El contador "Postergado N veces" se muestra a propósito**, y al postergar de nuevo el modal pregunta
  "¿Y si lo haces ahora, o lo descartas?".
- **Anotar un pendiente:** qué hay que hacer, detalle, quién (yo / Claude), fecha límite, tema y urgente.
- Nunca se borra nada: descartar guarda el historial.

## 2. Claude usa la misma tabla

Regla nueva en `CLAUDE.md` ("📋 Pendientes"): Claude lee los abiertos al empezar cada sesión, anota lo que
el dueño deja para después y marca lo que termina con `hecho_por = 'claude'` y una `nota_cierre` con la
evidencia. El dueño dio autorización permanente para escribir en esa tabla (solo en esa).

## 3. Endpoints (solo admin)

- `GET /api/pendientes` → `{ hoy, abiertos, cerrados }` (`hoy` en hora de Chile, del servidor; cerrados:
  los 40 más recientes).
- `POST /api/pendientes` → crea. Desde el POS siempre `creado_por = 'dueno'` (el cuerpo no lo decide).
- `PATCH /api/pendientes/:id` con `accion`: `hecho` · `postergar` (`revisar_el` después de hoy, suma
  `veces_postergado`) · `descartar` · `reabrir` · `editar`.

## 4. Cómo se probó

- **Backend** (`api/index.js` real con un doble en memoria de Supabase): 15 casos. Trabajador → 403;
  título corto, fecha inexistente (31-02) y responsable raro → 400; crear; postergar a hoy → 400;
  postergar dos veces suma 1 y 2; hecho con nota; hecho dos veces → 409; GET separa abiertos/cerrados;
  reabrir limpia el cierre; editar; acción desconocida → 400; id inexistente → 404.
- **Maqueta** (`pos-maqueta`, datos inventados): el chip cuenta 3 (vencido, urgente, postergado que ya
  llegó) y deja fuera el postergado a futuro; rojo por el vencido. Marcar hecho, postergar una semana,
  descartar con dos clics, reabrir y anotar uno nuevo para Claude funcionan. En celular (375 px) sin
  desborde.
- **No probado:** el SQL contra la base real antes de aplicarlo (no hay Python para `pglast` en este
  equipo); es un `create table if not exists` simple.
