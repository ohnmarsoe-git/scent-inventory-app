-- Tester paper was seeded at MMK 4,000 each (sheet unit cost).
-- The real cost per strip is MMK 40. Stock average was still 4,000 after the
-- master form was edited, and that average is what margin uses.

UPDATE consumables
SET
  cost_per_unit_mmk = 40,
  purchase_price_mmk = 40 * quantity_purchased
WHERE name = 'Tester paper';

UPDATE inventory_items AS item
SET avg_unit_cost_mmk = 40
FROM consumables AS consumable
WHERE item.consumable_id = consumable.id
  AND item.item_type = 'CONSUMABLE'
  AND consumable.name = 'Tester paper';

UPDATE inventory_movements AS movement
SET
  unit_cost_mmk = 40,
  total_cost_mmk = round(movement.quantity * 40, 2)
FROM inventory_items AS item
JOIN consumables AS consumable ON consumable.id = item.consumable_id
WHERE movement.inventory_item_id = item.id
  AND consumable.name = 'Tester paper'
  AND movement.notes LIKE '%bottle-stock:09%';
