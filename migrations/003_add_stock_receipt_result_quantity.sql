ALTER TABLE stock_receipts
ADD COLUMN resulting_quantity integer CHECK (resulting_quantity >= 0);

WITH receipt_totals AS (
    SELECT id,
           sum(quantity_added) OVER (
               PARTITION BY vehicle_id
               ORDER BY created_at, id
           )::integer AS resulting_quantity
    FROM stock_receipts
)
UPDATE stock_receipts AS receipt
SET resulting_quantity = receipt_totals.resulting_quantity
FROM receipt_totals
WHERE receipt.id = receipt_totals.id;

ALTER TABLE stock_receipts
ALTER COLUMN resulting_quantity SET NOT NULL;
