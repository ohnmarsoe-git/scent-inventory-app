# Costing Method — Scent Syntax

**Selected method:** Weighted Average Cost (WAC)  
**Base currency:** MMK  
**Config key:** `app_settings.costing_method = 'WEIGHTED_AVERAGE'`

Do not mix costing methods. Sale COGS is locked on the inventory movement at sale time.

---

## Perfume liquid (per ml)

On each `PURCHASE_RECEIPT` that increases perfume liquid stock:

```
new_avg = (old_qty_ml * old_avg + received_ml * receipt_unit_cost_mmk)
          / (old_qty_ml + received_ml)
```

`receipt_unit_cost_mmk` = allocated line cost in MMK ÷ ml received  
(include proportional share of PO shipping and other purchase costs).

Stored on `inventory_items.avg_unit_cost_mmk` where `item_type = 'PERFUME_LIQUID'`.

---

## Decant unit COGS

```
perfume_portion = size_ml * liquid_avg_cost_per_ml
+ sum(consumable unit costs used per unit)
= decant_unit_cogs_mmk
```

When new decant units merge into an existing same-size SKU, apply WAC again on that decant `inventory_item`.

---

## Full-bottle sale COGS

```
cogs = bottle_size_ml * liquid_avg_cost_per_ml
```

---

## Sale line profit

```
revenue      = (sale_price - line_discount) * quantity
cogs         = quantity * unit_cost_mmk_at_sale   # from inventory_movement
gross_profit = revenue - cogs
```

---

## Future change

To switch to FIFO/lot costing later:

1. Add lot / batch tables linked to receipt lines.
2. Change RPCs that create SALE movements to consume lots.
3. Update `app_settings.costing_method` and this document.
4. Do not rewrite historical `inventory_movements` cost fields.
