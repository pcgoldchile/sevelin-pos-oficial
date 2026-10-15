# v148 · ¿De dónde vino el cliente? en cada venta (15-10-2026)

Migración `sql/96-origen-cliente-en-ventas.sql` (aplicada con la CLI el 15-10-2026). Cambia `api/index.js`,
`js/config.js`, `js/pos.js`, `js/historial.js` e `index.html`.

## Qué pidió el dueño
"Falta una opción que al registrar ventas, o editar ventas, yo pueda registrar de dónde vino este cliente:
recomendación, Facebook Marketplace, IG, página web… para recolectar datos, ya que nadie o muy rara vez de la calle me
compran." Ejemplo: venta #273 (cocinilla), vino de Marketplace.

## Decisiones del dueño
- **Opcional** al cobrar (no frena la venta).
- **Lista completa:** Facebook Marketplace · Instagram · Página web (sevelin.cl) · WhatsApp · Google / Maps ·
  Recomendación de alguien · Cliente que vuelve · Pasó por la tienda · Otro · No sé.

## Qué quedó
- Columna `ventas.origen_cliente` con check de la lista; null = sin anotar. Las 254 ventas viejas quedan sin dato.
- Caja: "¿De dónde vino? (opcional)" bajo el WhatsApp del cliente; se limpia después de cada venta.
- Editar Venta: "¿De dónde vino?" junto al método de pago, para anotarlo o corregirlo después.
- Detalle de Venta: una etiqueta azul junto al cliente. Exportar historial: columna "De dónde vino".
- Ventas de sevelin.cl (`registrar-venta-web`): quedan solas como "Página web".
- Un valor fuera de la lista queda en null: nunca frena un cobro.
- La lista vive en tres lugares que deben calzar: `ORIGENES_CLIENTE` en `js/config.js`, en `api/index.js` y el check de sql/96.

## Cómo se probó
- Servidor real contra el doble de Supabase: caja con Marketplace, caja sin anotar, valor inventado (cobra igual, queda
  null), editar a Instagram, editar otra cosa (conserva), volver a sin anotar, venta web (queda WEB).
- Maqueta del POS: el selector de la caja con sus 11 opciones, Editar Venta carga y envía el valor, el Detalle muestra
  "Facebook Marketplace" y el Excel trae la columna.

## Falta (siguiente paso natural)
Un informe "¿De dónde vienen mis clientes?" (ventas y utilidad por canal, por mes). Tiene sentido cuando haya unas
semanas de datos.
