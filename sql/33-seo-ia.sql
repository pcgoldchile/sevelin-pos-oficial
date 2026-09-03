-- SEO con IA: título y meta-descripción para Google, aparte del nombre y
-- la Descripción que ve el cliente en la ficha.
-- ------------------------------------------------------------
-- NULL en cualquiera de las dos = sevelin-tienda sigue armando el título y
-- la meta-descripción automáticamente a partir del nombre y la Descripción
-- (comportamiento de siempre, ver generateMetadata en
-- sevelin-tienda/src/app/productos/[sku]/page.tsx) — no rompe nada de lo
-- que ya está publicado.
--
-- Se llenan a mano desde el modal de producto, o con el botón
-- "✨ Generar con IA" (POST /api/productos/generar-seo, llama a Gemini con
-- el nombre + la Descripción REAL ya escrita — nunca inventa specs nuevas,
-- ver CLAUDE.md). El admin revisa el resultado antes de guardar, como
-- cualquier otro campo del formulario.
ALTER TABLE productos ADD COLUMN IF NOT EXISTS meta_titulo_web text;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS meta_descripcion_web text;
