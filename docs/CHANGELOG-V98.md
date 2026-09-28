# v98 — Preguntas de diagnóstico para copiar (y editar) desde el Check-In

**Fecha:** 28-09-2026
**Migración:** `sql/70-textos-editables.sql` (aplicada con la CLI el 28-09-2026, verificada: RLS activo,
0 políticas, 10 preguntas cargadas). Tabla nueva `textos_editables`.
**Pedido del dueño:** *"Botón 'Copiar preguntas de diagnóstico' junto a 'Copiar datos para WhatsApp' del
Check-In, que copie este texto tal cual [...] Enumera las preguntas para que ellos solamente respondan
según el número de la pregunta. ¿En lo posible que yo en un futuro pueda editar estas preguntas?"*

---

## 1. Qué hace

- **🩺 Copiar preguntas de diagnóstico** (Check-In, paso 1, al lado de "Copiar datos para WhatsApp"):
  copia al instante el texto listo para pegar en WhatsApp. Lo usan admin y trabajador.
- **✏️ (solo admin)**: abre "Preguntas de diagnóstico" con tres campos (texto de arriba, preguntas
  una por línea, texto de abajo), una **vista previa idéntica a lo que se copia**, "↺ Originales" y
  Guardar. Se aplica al tiro en todos los equipos al iniciar sesión.

## 2. El texto

Las 10 preguntas del dueño, **tal cual**, numeradas 1 a 10. Dos agregados mínimos, editables:
- **Una línea arriba:** "Para revisar tu equipo, respóndenos con el número de cada pregunta:" — es lo
  que hace que el cliente responda por número, que era el objetivo.
- La última línea ("Si tiene clave o PIN…") quedó como **cierre sin número**: no es una pregunta.
  Se corrigió una tilde: "pedirtela" → "pedírtela".

## 3. Por qué así

- **Los números no se guardan:** se guarda la lista y el POS numera al copiar. Al agregar, quitar o
  reordenar nunca quedan saltos. Si alguien escribe "3) …" a mano, el número se limpia (en el
  navegador y en el servidor).
- **Tabla genérica** (`clave → contenido jsonb`): el POS no tenía dónde guardar textos editables. Sirve
  para las próximas plantillas sin otra migración. La API **solo acepta claves conocidas**
  (`TEXTOS_EDITABLES`) y valida la forma de cada una: 1 a 30 preguntas de hasta 300 letras,
  encabezado y cierre de hasta 500.
- **Se leen al iniciar sesión y quedan en memoria:** el portapapeles del navegador puede rechazar una
  copia que espera al servidor, así que el botón no consulta nada al hacer clic. Si la base no
  responde, se usan las originales (las mismas que carga sql/70).
- La migración **no pisa** lo que el dueño ya haya editado (`on conflict do nothing`).
- `copiarPlantillaWhatsApp` se partió en `copiarTextoParaWhatsApp(texto, mensaje)`, que usan los dos
  botones (mismos tres respaldos de siempre).

Endpoints: `GET /api/textos/:clave` (admin y trabajador), `PUT /api/textos/:clave` (solo admin).

## 4. Cómo se probó

- **Backend (doble de Supabase), 9 casos:** trabajador lee → 200 · clave desconocida → 404 ·
  trabajador edita → 403 · admin guarda → 200, sin números escritos a mano, espacios de más ni líneas
  vacías · sin preguntas → 400 · más de 30 → 400 · clave desconocida no se crea.
- **Maqueta (admin):** se cargan al iniciar sesión, copiar entrega el texto numerado, el lápiz abre el
  modal, "Originales" + una pregunta escrita como "11) …" → vista previa con "11. …", guardar cierra y
  el siguiente copiar trae las 11. La vista previa es idéntica a lo copiado.
- **Base real:** la migración (RLS y las 10 preguntas verificadas con una consulta).
