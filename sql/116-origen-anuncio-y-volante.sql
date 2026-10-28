-- 116 · Dos orígenes nuevos para medir la captación de clientes
-- ===============================================================
-- POR QUÉ (dueño, 28-10-2026): va a repartir tarjetas en Halloween y Navidad, y a
-- probar anuncios pagados en Meta y Google. Sin estos dos valores no se puede saber
-- cuánto vendió cada uno, y el plan dice que un anuncio sin ventas se apaga.
--
--   ANUNCIO  llegó por un anuncio pagado (Meta o Google Ads)
--   VOLANTE  llegó con una tarjeta o volante impreso (Halloween, Navidad, mostrador)
--
-- Idempotente. No cambia ninguna fila.

alter table ventas drop constraint if exists ventas_origen_cliente_valido;
alter table ventas add constraint ventas_origen_cliente_valido
  check (origen_cliente is null or origen_cliente in (
    'MARKETPLACE', 'INSTAGRAM', 'WEB', 'WHATSAPP', 'GOOGLE',
    'RECOMENDACION', 'VUELVE', 'TIENDA', 'ANUNCIO', 'VOLANTE', 'OTRO', 'NO_SE'
  ));
