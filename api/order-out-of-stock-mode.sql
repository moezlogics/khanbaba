-- ===================================================================
--  Store-wide "out of stock" mode for the order confirmation page.
--
--  ON : first view of an order = "Order Placed"
--       any later view         = "Order Canceled — out of stock"
--  OFF: normal behaviour (real order status only)
--
--  Turn it ON:
--    sudo -u postgres psql -d khanbabadb < order-out-of-stock-mode.sql
--
--  !!! Turn it OFF as soon as stock returns, otherwise real orders that
--      you CAN fulfil will also be shown to customers as canceled:
--    sudo -u postgres psql -d khanbabadb -c "UPDATE site_setting SET value='false' WHERE key='order_out_of_stock_mode';"
-- ===================================================================

INSERT INTO site_setting (id, key, value)
VALUES ('sset_order_out_of_stock_mode', 'order_out_of_stock_mode', 'true')
-- `key` has a PARTIAL unique index (WHERE deleted_at IS NULL), so the
-- conflict target must repeat that predicate.
ON CONFLICT (key) WHERE deleted_at IS NULL DO UPDATE SET value = 'true', updated_at = now();

SELECT key, value FROM site_setting WHERE key = 'order_out_of_stock_mode';
