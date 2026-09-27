-- RCV-2026-00023 was received on 04/04/2026 (Myanmar).

UPDATE purchase_receipts
SET received_at = '2026-04-04T00:00:00+06:30'::timestamptz
WHERE receipt_number = 'RCV-2026-00023';

UPDATE inventory_movements AS movement
SET moved_at = '2026-04-04T00:00:00+06:30'::timestamptz
FROM purchase_receipts AS receipt
WHERE movement.purchase_receipt_id = receipt.id
  AND receipt.receipt_number = 'RCV-2026-00023';
