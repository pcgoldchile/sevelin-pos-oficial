# RUTA — Contenido para redes con Claude Cowork + Metricool

> Escrito el 13-09-2026. Actualiza el §1.3 de `DISENO-CONTENIDO-ORGANICO.md`: ese documento descartó
> Cowork porque **no tenía cómo publicar** (sin conector de Meta). Eso cambió: **Metricool tiene un
> conector oficial (MCP remoto) que funciona en Claude Desktop y Cowork, en cualquier plan de Metricool,
> incluido el gratis**, y permite crear y programar publicaciones con imagen en Instagram y Facebook.
> La otra limitación sigue en pie: **las tareas programadas de Cowork no pueden leer carpetas del
> computador**. Por eso la ruta no depende de los repos locales, sino de URLs.

## Cómo se conectan las piezas

```
 sevelin-pos-oficial                         sevelin-tienda (sevelin.cl)
 /api/feed/catalogo.csv?token=…              ficha del producto (link de destino)
 (nombre, precio, stock, fotos, link;              ▲
  SIN costo, margen ni clientes)                   │ link con UTM
            │                                      │
            ▼                                      │
   ┌──────────────── Claude Cowork ────────────────┴──┐
   │ Proyecto "Sevelin Contenido" (instrucciones fijas)│
   │ Tarea programada: lun y jue 09:00                 │
   │  1. lee el feed                                   │
   │  2. elige 1 producto con las reglas               │
   │  3. arma imagen + texto gancho + link con UTM     │
   │  4. lo deja PROGRAMADO en Metricool a 24-48 h     │
   └───────────────────────┬──────────────────────────┘
                           ▼
                  Metricool (conector)
                           │  el dueño revisa en la app: edita, borra o deja pasar
                           ▼
          Instagram @sevelin.cl  +  Página de Facebook
```

**Regla que no cambia:** nada sale sin que el dueño lo haya podido ver. La tarea nunca publica
"ahora": programa con al menos 24 h de margen y avisa qué dejó.

## Etapa 1 — Sin tocar código (se puede hacer esta semana)

1. **Metricool** (cuenta gratis): crear la marca "Sevelin" y conectar la **Página de Facebook** y el
   **Instagram como cuenta profesional** vinculado a esa Página. El perfil personal no se conecta.
2. **Claude Desktop → Configuración → Conectores → agregar el conector de Metricool** (guía oficial en
   las fuentes). Probarlo en un chat normal: "¿qué publicaciones tengo programadas?".
3. **Cowork → nuevo proyecto "Sevelin Contenido"** con instrucciones fijas:
   - tono de Sevelin, datos fijos (WhatsApp, dirección, garantía) y los emojis permitidos;
   - reglas de elección: nunca un producto sin foto o sin stock, nunca el mismo en 60 días, 1 de cada
     3 publicaciones es un servicio técnico;
   - **reglas anti-invención** (las mismas del prompt de fichas): solo datos que estén en el feed;
   - formato del texto: gancho (1 línea) → 2-3 beneficios → precio → llamado a WhatsApp/tienda → link;
   - link siempre con `?utm_source=instagram&utm_medium=organico&utm_campaign=contenido` (o facebook).
4. **Tarea programada** en ese proyecto (lunes y jueves), que lee el feed desde su URL con token.
   El token solo abre datos que ya son públicos en la tienda (sin costos ni clientes).
5. **Imagen:** en la etapa 1 se usa la foto real del producto con el texto encima. Si el resultado de
   Cowork no se ve bien, la alternativa es una plantilla fija en Canva y que Cowork solo cambie foto,
   nombre y precio. **Esto se decide mirando las 2-3 primeras piezas, no antes.**
6. Durante 2 semanas, el dueño revisa cada pieza en Metricool y anota qué corrigió. Esas correcciones
   pasan a las instrucciones del proyecto.

**Límite a vigilar:** el plan gratis de Metricool tiene tope de publicaciones al mes. A 2 por semana
en 2 redes, revisar si alcanza antes de subir la frecuencia.

## Etapa 2 — Elegir con los datos del POS (requiere código, recién si la etapa 1 dura 4 semanas)

El feed no trae margen ni stock dormido, así que en la etapa 1 la elección es "a ojo" dentro de las
reglas. Para elegir **joyas escondidas** (margen alto, poca rotación) y **capital dormido**, el POS
tendría que exponer una lista de candidatos:

- endpoint de solo lectura en `api/index.js` (`GET /api/contenido/candidatos?token=…`) que devuelve
  **solo el id y el motivo** ("margen alto", "sin ventas en 60 días", "servicio"), **nunca el costo**;
- y registrar qué se publicó (para la regla de los 60 días y para medir ventas con la UTM).

Toca márgenes → hacerlo en Opus, con migración propia.

## Etapa 3 — Medir

- Ventas de la tienda con `utm_medium=organico` (sevelin-tienda ya guarda el pedido web).
- Mensajes de WhatsApp que citan la publicación (anotarlo en la venta del POS).
- Si a las 8 semanas no hay ni una venta ni una consulta atribuible, se baja la frecuencia o se
  apaga. Sin drama.

## Lo que esta ruta NO hace

- **No publica en Marketplace** (Meta no lo permite por API). El texto aprobado sí sirve para copiarlo
  a mano ahí, que es el canal que vende.
- **No hace video.** Los Reels quedan a mano con el guion que prepara Cowork.
- **No toca los repos ni la base de datos.** Cowork solo lee URLs y escribe en Metricool.

## Fuentes (verificadas el 13-09-2026)

- Preguntas frecuentes del MCP de Metricool: https://help.metricool.com/faqs-about-the-metricool-mcp-1i3w0
- Conectar el MCP de Metricool con Claude: https://help.metricool.com/how-to-connect-metricools-mcp-with-claude-0l84v
- Tareas programadas en Cowork: https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork
- Conectores en Cowork (remotos sí, locales no): https://www.usecarly.com/blog/claude-mcp/
