-- ============================================================
-- Pedidos por Encargo (dropshipping / retiro en tienda)
-- ------------------------------------------------------------
-- Marca en `productos` los ítems que se venden sin stock propio: al
-- confirmarse el pedido se piden al proveedor y se despachan al cliente o
-- se retiran en tienda (coordinado a mano, fuera del sistema). El trigger
-- de sync (sql/22-trigger-sync-tienda.sql) usa to_jsonb(NEW), así que esta
-- columna llega sola al webhook de sevelin-tienda sin tocar el trigger.
-- Idempotente: seguro de correr más de una vez.
-- ============================================================

ALTER TABLE productos ADD COLUMN IF NOT EXISTS es_pedido_encargo BOOLEAN NOT NULL DEFAULT FALSE;
