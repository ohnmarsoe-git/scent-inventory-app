-- Sales and tester pours from docs/Order Tracking_all.csv.
-- One sale per sheet order. Lines with the same order id, customer, and date
-- stay together. A blank order id on the next row joins that sale when the
-- customer (or a blank customer) and the date match. Same order id with a
-- different customer or date is a separate sale.
--
-- Customer name Tester, and the typo Teser, is not a customer and not a sale.
-- Those rows are Inventory > Tester pours (SAMPLE movements, no revenue).
--
-- Sheet names merged into one customer:
--   Ei ThaZin Aung, EI Thazin Aung, Ei Thazin Aung, Ei Tha Zin Aung -> Ei Thazin Aung
--   Khin lay -> Khin Lay
--   MA naw Muu -> Ma Naw Muu
--   May lay -> May Lay
--   MoMo -> Mo Mo
--   Thin THin -> Thin Thin
--   YuKi -> Yuki
--   Pyae L win -> Pyae L Win
-- ZMP (Yuki) stays its own customer.
--
-- Payment: Paid is collected. COD is collected only when the status is Done.
-- COD that is still Packing or Shipped stays unpaid. Pending stays unpaid.
-- KBZ Pay is mobile_wallet. Cash is cash.
-- Delivery fee is not added to the sale total (the sheet total excludes it).
-- It is a Delivery expense. Sheet Profit also subtracts that fee; sale gross
-- profit here is revenue minus liquid COGS only.
--
-- Liquid is taken out of stock when the scent has enough millilitres.
-- COGS is then the weighted-average cost. When it does not (the bottle was
-- never received), the sale is still recorded and COGS uses Rollup divided by
-- the bottle size. Stock is left unchanged. Tester pours are always recorded.
-- A tester with no liquid on hand is still a SAMPLE movement, and the note
-- says stock was not reduced.
--
-- Order date blank: not guessed. The sale date or pour date is 2026-01-01,
-- and the note says the sheet date was blank. Those rows show in January.
--
-- Not imported (no sell price and no status, or no size and no quantity):
--   OD034 BD Present, Replica beach Walk
--   OD036 JLO Still EDP Batch-2, no customer
--   OD037 Phoe Thar, Julitte has a gun
--   OD062 Thant Zin Oo, Replica beach Walk (delivery fee 5,500 was on this row)
--   Armaf CDN EDP with no customer, size, or quantity
--   Armaf CDN EDP 5ml with no customer, date, or price
--   Ma Moe Thu, Gucci Floral gorgeous gardenia, no quantity or price
--
-- Safe to run again: each sheet row is keyed by [ot:N].

DO $ot$
DECLARE
  r record;
  v_anchor integer;
  v_open_anchor integer := NULL;
  v_open_customer text := NULL;
  v_open_date date := NULL;
  v_open_order text := NULL;
  v_open_kind text := NULL;
  v_attach boolean;
  v_unknown constant date := DATE '2026-01-01';
  v_customer_id uuid;
  v_customer text;
  v_order_id text;
  v_sale_date date;
  v_date_blank boolean;
  v_status text;
  v_payment text;
  v_method_label text;
  v_pay_method payment_method;
  v_collected boolean;
  v_fee numeric;
  v_service text;
  v_sheet_notes text;
  v_issue text;
  v_sheet_names text;
  v_keys text;
  v_notes text;
  v_sale_id uuid;
  v_sale_number text;
  v_subtotal numeric;
  v_cogs numeric;
  v_perfume_id uuid;
  v_brand text;
  v_perfume text;
  v_bottle numeric;
  v_item_id uuid;
  v_on_hand numeric;
  v_ml numeric;
  v_cost_per_ml numeric;
  v_deducted boolean;
  v_unit_cogs numeric;
  v_line_cogs numeric;
  v_line_total numeric;
  v_price numeric;
  v_sale_item_id uuid;
  v_description text;
  v_size_label text;
  v_stock_notes text;
  v_moved timestamptz;
  v_label text;
  v_cat_id uuid;
  v_sale_count integer := 0;
  v_tester_count integer := 0;
BEGIN
  DROP TABLE IF EXISTS _ot;
  CREATE TEMP TABLE _ot (
    row_no integer PRIMARY KEY,
    order_id text,
    scent text,
    sheet_customer text,
    customer_name text,
    size_ml numeric,
    qty numeric,
    delivery_fee numeric,
    delivery_service text,
    sheet_notes text,
    order_date date,
    order_status text,
    payment text,
    pay_method text,
    rollup numeric,
    sell_price numeric,
    kind text NOT NULL,
    issue text,
    group_anchor integer
  ) ON COMMIT DROP;

  INSERT INTO _ot (
    row_no, order_id, scent, sheet_customer, customer_name, size_ml, qty,
    delivery_fee, delivery_service, sheet_notes, order_date, order_status,
    payment, pay_method, rollup, sell_price, kind, issue
  ) VALUES
    (1, 'OD001', 'JLO Still EDP Batch 1 (W)', 'Khin Lay', 'Khin Lay', 10, 1, 0, NULL, NULL, DATE '2026-03-30', 'Done', 'Paid', 'KBZ Pay', 170000, 24000, 'sale', NULL),
    (2, 'OD002', 'JLO Still EDP Batch 1 (W)', 'Ma Swe', 'Ma Swe', 10, 2, 0, NULL, NULL, DATE '2026-03-31', 'Done', 'Paid', 'Cash', 170000, 24000, 'sale', NULL),
    (3, 'OD004', 'JLO Still EDP Batch 1 (W)', 'Ma Naw Muu', 'Ma Naw Muu', 10, 1, 0, NULL, NULL, DATE '2026-03-31', 'Done', 'Paid', 'Cash', 170000, 24000, 'sale', NULL),
    (4, 'OD004', 'Nautica Voyage Sport (M)', 'Aung Ko', 'Aung Ko', 10, 1, 0, NULL, NULL, DATE '2026-03-31', 'Done', 'Paid', 'Cash', 140000, 22000, 'sale', NULL),
    (5, 'OD005', 'JLO Still EDP Batch 1 (W)', 'May Lwin', 'May Lwin', 10, 1, 0, NULL, NULL, DATE '2026-03-31', 'Done', 'Paid', 'KBZ Pay', 170000, 26000, 'sale', NULL),
    (6, 'OD006', 'JLO Still EDP Batch 1 (W)', 'Zin', 'Zin', 10, 2, 0, NULL, NULL, DATE '2026-03-31', 'Done', 'Paid', 'KBZ Pay', 170000, 26000, 'sale', NULL),
    (7, 'OD007', 'Armaf CDN Untold (U)', 'THZ', 'THZ', 5, 1, 0, NULL, NULL, DATE '2026-04-01', 'Done', 'Paid', 'KBZ Pay', 195000, 10000, 'sale', NULL),
    (8, 'OD008', 'D&G Light Blue EDT (W)', 'Hnin Ei', 'Hnin Ei', 5, 1, 0, NULL, NULL, DATE '2026-04-01', 'Done', 'Paid', 'Cash', 255000, 18000, 'sale', NULL),
    (9, 'OD009', 'Nautica Voyage Sport (M)', 'Tin Htoo Aung', 'Tin Htoo Aung', 5, 1, 0, NULL, NULL, DATE '2026-04-01', 'Done', 'Paid', 'Cash', 140000, 119000, 'sale', 'Decant size is 5ml and the sell price is 119,000.'),
    (10, 'OD010', 'D&G Light Blue EDT (W)', 'Naw Sal', 'Naw Sal', 5, 1, 0, NULL, NULL, DATE '2026-04-03', 'Done', 'Paid', 'Cash', 255000, 19000, 'sale', NULL),
    (11, 'OD011', 'Armaf CDN EDP (W)', 'Ei ThaZin Aung', 'Ei Thazin Aung', 10, 1, 0, NULL, NULL, DATE '2026-04-08', 'Done', 'Paid', 'KBZ Pay', 180000, 26000, 'sale', NULL),
    (12, 'OD012', 'D&G L''Imperatrice EDT (W)', 'Zin', 'Zin', 10, 1, 0, NULL, NULL, DATE '2026-04-08', 'Done', 'Paid', 'KBZ Pay', 236000, 37000, 'sale', NULL),
    (13, 'OD013', 'D&G L''Imperatrice EDT (W)', 'Ma Ame', 'Ma Ame', 10, 1, 0, NULL, NULL, DATE '2026-04-08', 'Done', 'Paid', 'KBZ Pay', 236000, 37000, 'sale', NULL),
    (14, 'OD014', 'Gucci Floral gorgeous gardenia', 'Ma Moe Thu', 'Ma Moe Thu', 10, 1, 0, NULL, NULL, DATE '2026-04-08', 'Done', 'Paid', 'KBZ Pay', 317000, 55000, 'sale', NULL),
    (15, 'OD015', 'VS Bombshell EDP (W)', 'Doru', 'Doru', 10, 1, 0, NULL, NULL, DATE '2026-04-09', 'Done', 'Paid', 'Cash', 295000, 53000, 'sale', NULL),
    (16, 'OD016', 'VS Bombshell EDP (W)', 'Khaing Hsu Yee Tun', 'Khaing Hsu Yee Tun', 10, 1, 0, NULL, NULL, DATE '2026-04-09', 'Done', 'Paid', 'KBZ Pay', 295000, 53000, 'sale', NULL),
    (17, 'OD017', 'VS Bombshell EDP (W)', 'Tin Htoo Aung', 'Tin Htoo Aung', 10, 1, 0, NULL, NULL, DATE '2026-04-10', 'Done', 'Paid', 'KBZ Pay', 295000, 53000, 'sale', NULL),
    (18, NULL, 'JLO Still EDP Batch 1 (W)', 'Tester', NULL, 3, 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, 170000, 0, 'tester', NULL),
    (19, 'OD018', 'Gucci Floral gorgeous gardenia', 'Htet', 'Htet', 10, 1, 0, NULL, NULL, DATE '2026-04-18', 'Done', 'Paid', 'KBZ Pay', 317000, 55000, 'sale', NULL),
    (20, 'OD019', 'D&G L''Imperatrice EDT (W)', 'Htet', 'Htet', 10, 1, 0, NULL, NULL, DATE '2026-04-18', 'Done', 'Paid', 'KBZ Pay', 236000, 37000, 'sale', NULL),
    (21, 'OD020', 'VS Bombshell EDP (W)', 'Htet', 'Htet', 10, 1, 0, NULL, NULL, DATE '2026-04-18', 'Done', 'Paid', 'KBZ Pay', 295000, 53000, 'sale', NULL),
    (22, 'OD022', 'CK In 2U For Her EDT (W)', 'Mo Mo', 'Mo Mo', 10, 1, 0, NULL, NULL, DATE '2026-04-11', 'Done', 'Paid', 'KBZ Pay', 150000, 26000, 'sale', NULL),
    (23, 'OD021', 'VS Bombshell EDP (W)', 'Ma Swe', 'Ma Swe', 10, 1, 0, NULL, NULL, DATE '2026-04-19', 'Done', 'Paid', 'KBZ Pay', 295000, 53000, 'sale', NULL),
    (24, 'OD023', 'VS Bombshell EDP (W)', 'Ko Nyi', 'Ko Nyi', 30, 1, 0, NULL, NULL, DATE '2026-04-19', 'Done', 'Paid', 'KBZ Pay', 295000, 140000, 'sale', NULL),
    (25, 'OD024', 'JLO Still EDP Batch 1 (W)', 'Ko Nyi', 'Ko Nyi', 10, 1, 0, NULL, NULL, DATE '2026-04-19', 'Done', 'Paid', 'KBZ Pay', 170000, 24333, 'sale', NULL),
    (26, 'OD026', 'JLO Still EDP Batch 1 (W)', 'Zin', 'Zin', 10, 1, 0, NULL, NULL, DATE '2026-04-21', 'Done', 'Paid', 'KBZ Pay', 170000, 24000, 'sale', NULL),
    (27, 'OD027', 'D&G L''Imperatrice EDT (W)', 'Khaing Su', 'Khaing Su', 5, 1, 0, NULL, NULL, DATE '2026-04-26', 'Done', 'Paid', 'Cash', 236000, 20000, 'sale', NULL),
    (28, 'OD025', 'JLO Still EDP Batch-2 (W)', 'Ko Nyi', 'Ko Nyi', 20, 1, 0, NULL, NULL, DATE '2026-04-19', 'Done', 'Paid', 'KBZ Pay', 150000, 46666, 'sale', NULL),
    (29, 'OD028', 'D&G Light Blue EDT (W)', 'Win Lwin Oo', 'Win Lwin Oo', 5, 1, 0, NULL, NULL, DATE '2026-04-28', 'Done', 'Paid', 'Cash', 255000, 19000, 'sale', NULL),
    (30, 'OD029', 'JLO Still EDP Batch-2 (W)', 'Aung Ko Ko Naing', 'Aung Ko Ko Naing', 10, 1, 0, NULL, NULL, DATE '2026-05-07', 'Done', 'Paid', 'KBZ Pay', 150000, 26000, 'sale', NULL),
    (31, 'OD030', 'JLO Still EDP Batch-2 (W)', 'Yuki', 'Yuki', 10, 1, 0, NULL, NULL, DATE '2026-06-05', 'Done', 'Paid', 'KBZ Pay', 150000, 26000, 'sale', NULL),
    (32, 'OD031', 'CK Reflection', 'MoMo', 'Mo Mo', 100, 1, 0, NULL, NULL, DATE '2026-05-09', 'Done', 'Paid', 'KBZ Pay', 139000, 170000, 'sale', NULL),
    (33, 'OD032', 'D&G L''Imperatrice EDT (W)', 'Shwe Pyi Aein', 'Shwe Pyi Aein', 10, 1, 0, NULL, NULL, DATE '2026-05-08', 'Done', 'Paid', 'Cash', 236000, 35000, 'sale', NULL),
    (34, 'OD033', 'Armaf CDN Untold (U)', 'Ma Moe', 'Ma Moe', 10, 1, 0, NULL, NULL, DATE '2026-05-08', 'Done', 'Paid', 'Cash', 195000, 10000, 'sale', NULL),
    (35, 'OD034', 'Replica beach Walk', 'BD Present', 'BD Present', 10, 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, 288000, NULL, 'skip', 'No sell price and no order status. Not imported.'),
    (36, 'OD035', 'CK In 2U For Her EDT (W)', 'Khin Kaung Sint', 'Khin Kaung Sint', 30, 1, 6000, NULL, NULL, DATE '2026-05-11', 'Done', 'Paid', 'Cash', 150000, 60000, 'sale', NULL),
    (37, 'OD036', 'JLO Still EDP Batch-2 (W)', NULL, NULL, 10, 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, 150000, NULL, 'skip', 'No sell price and no order status. Not imported.'),
    (38, 'OD037', 'Julitte has a gun (Tester)', 'Phoe Thar', 'Phoe Thar', 10, 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, 292000, NULL, 'skip', 'No sell price and no order status. Not imported.'),
    (39, 'ODO38', 'Idole EDP', 'Ma Lin', 'Ma Lin', 10, 1, 0, NULL, NULL, DATE '2026-05-17', 'Done', 'Paid', 'KBZ Pay', 430000, NULL, 'sale', 'Sell price was blank and the total is 0. Sheet status is Paid. Sheet order id is ODO38.'),
    (40, 'OD039', 'SI Intense Refill', 'YuKi', 'Yuki', 5, 1, 0, NULL, NULL, DATE '2026-05-17', 'Done', 'Paid', 'KBZ Pay', 198000, 20000, 'sale', NULL),
    (41, 'OD040', 'D&G L''Imperatrice EDT (W)', 'Yin Lay', 'Yin Lay', 30, 1, 0, NULL, NULL, DATE '2026-05-19', 'Done', 'Paid', 'KBZ Pay', 236000, 97000, 'sale', 'Decant size was blank. 97,000 is the 30ml price, so the size is stored as 30ml.'),
    (42, NULL, 'D&G L''Imperatrice EDT (W)', 'Tester', NULL, 3, 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, 236000, NULL, 'tester', NULL),
    (43, 'OD041', 'Julitte has a gun (Tester)', 'Thandar Win', 'Thandar Win', 10, 1, 1000, 'Ninja Van', NULL, DATE '2026-05-22', 'Done', 'Paid', 'KBZ Pay', 292000, 46000, 'sale', NULL),
    (44, 'OD042', 'Julitte has a gun (Tester)', 'May Thwe Ko', 'May Thwe Ko', 10, 1, 150, 'Ninja Van', NULL, DATE '2026-05-23', 'Done', 'Paid', 'KBZ Pay', 292000, 47000, 'sale', NULL),
    (45, 'OD043', 'Idole EDP', 'Phyo Pa Pa', 'Phyo Pa Pa', 10, 1, 150, 'Ninja Van', NULL, DATE '2026-05-24', 'Done', 'Paid', 'KBZ Pay', 430000, 35000, 'sale', NULL),
    (46, 'OD044', 'Idole EDP', 'Soe Soe', 'Soe Soe', 5, 1, 0, NULL, NULL, DATE '2026-05-26', 'Done', 'Paid', 'KBZ Pay', 430000, 35000, 'sale', NULL),
    (47, 'OD045', 'JLO Still EDP Batch-2 (W)', 'Soe Soe', 'Soe Soe', 10, 1, 0, NULL, NULL, DATE '2026-05-26', 'Done', 'Paid', 'Cash', 150000, 25000, 'sale', NULL),
    (48, 'OD046', 'Julitte has a gun (Tester)', 'Thaw Zin Aung', 'Thaw Zin Aung', 10, 1, 0, NULL, NULL, DATE '2026-05-26', 'Done', 'COD', 'KBZ Pay', 292000, 47000, 'sale', NULL),
    (49, 'OD047', 'Burberry Her EDP', 'Kywat', 'Kywat', 5, 1, 0, NULL, NULL, DATE '2026-05-26', 'Packing', 'COD', NULL, 387000, 27000, 'sale', NULL),
    (50, 'OD048', 'Armaf CDN EDP (W)', 'Kywat', 'Kywat', 5, 1, 0, NULL, NULL, DATE '2026-05-26', 'Packing', 'COD', NULL, 180000, 14000, 'sale', NULL),
    (51, 'OD049', 'Julitte has a gun (Tester)', 'Ma Myat Noe', 'Ma Myat Noe', 10, 1, 0, 'Ninja Van', NULL, DATE '2026-05-27', 'Done', 'COD', 'KBZ Pay', 292000, 47000, 'sale', NULL),
    (52, 'OD050', 'Idole EDP', 'Yuki', 'Yuki', 10, 1, 0, NULL, NULL, DATE '2026-05-27', 'Done', 'Paid', 'KBZ Pay', 430000, 66000, 'sale', NULL),
    (53, 'OD051', 'Julitte has a gun (Tester)', 'Doru', 'Doru', 5, 1, 0, NULL, NULL, DATE '2026-05-26', 'Done', 'Paid', 'KBZ Pay', 292000, 28000, 'sale', NULL),
    (54, 'OD051', 'Julitte has a gun (Tester)', 'Tester', NULL, 5, 1, 0, NULL, NULL, DATE '2026-05-20', 'Done', NULL, NULL, 292000, NULL, 'tester', NULL),
    (55, 'OD052', 'CK In 2U For Her EDT (W)', 'ShweKit', 'ShweKit', 10, 1, 300, NULL, NULL, NULL, 'Done', 'COD', 'KBZ Pay', 150000, 26000, 'sale', NULL),
    (56, 'OD053', 'Burberry Her EDP', 'Ei Phyu Moe', 'Ei Phyu Moe', 10, 1, 0, 'MGL', NULL, DATE '2026-05-29', 'Done', 'Paid', 'KBZ Pay', 387000, 56000, 'sale', NULL),
    (57, 'OD054', 'Julitte has a gun (Tester)', 'Khin Lay', 'Khin Lay', 10, 1, 0, 'Ninja Van', NULL, DATE '2026-05-30', 'Done', 'COD', 'KBZ Pay', 292000, 47000, 'sale', NULL),
    (58, 'OD055', 'SI Intense Refill', 'Khin lay', 'Khin Lay', 10, 1, 0, 'Ninja Van', NULL, DATE '2026-05-30', 'Done', 'COD', 'KBZ Pay', 198000, 35000, 'sale', NULL),
    (59, '0D056', 'Burberry Her EDP', 'Khin Lay', 'Khin Lay', 3, 1, 0, 'Ninja Van', NULL, DATE '2026-05-30', 'Done', 'COD', 'KBZ Pay', 387000, 17500, 'sale', 'Sheet order id is 0D056 (leading zero).'),
    (60, 'OD057', 'D&G Light Blue EDT (W)', 'Khin Lay', 'Khin Lay', 10, 1, 0, 'Ninja Van', NULL, DATE '2026-05-30', 'Done', 'Paid', 'KBZ Pay', 255000, 34500, 'sale', NULL),
    (61, 'OD058', 'Armaf CDN EDP (W)', 'San Zay Htike', 'San Zay Htike', 30, 1, 0, 'Ninja Van', NULL, DATE '2026-06-04', 'Done', 'COD', 'KBZ Pay', 180000, 72000, 'sale', NULL),
    (62, 'OD060', 'Armaf CDN EDP (W)', 'ဆုလာဒ်နှင်း', 'ဆုလာဒ်နှင်း', 10, 1, 0, 'Ninja Van', NULL, DATE '2026-06-04', 'Done', 'COD', 'KBZ Pay', 180000, 22000, 'sale', NULL),
    (63, 'OD061', 'SI Intense Refill', 'Wai Phue Eain', 'Wai Phue Eain', 30, 1, 0, 'Ninja Van', NULL, DATE '2026-06-04', 'Done', 'COD', 'KBZ Pay', 198000, 85000, 'sale', NULL),
    (64, 'OD062', 'Replica beach Walk', 'Thant Zin Oo', 'Thant Zin Oo', 10, 1, 5500, NULL, NULL, NULL, NULL, NULL, NULL, 288000, NULL, 'skip', 'No sell price and no order status. Not imported.'),
    (65, 'OD063', 'D&G Light Blue EDT (W)', 'U Myint Kywel', 'U Myint Kywel', 30, 1, 0, 'Royal Express', NULL, DATE '2026-06-04', 'Done', 'Paid', 'KBZ Pay', 255000, 100000, 'sale', NULL),
    (66, 'OD064', 'SI Intense Refill', 'U Myint Kywel', 'U Myint Kywel', 30, 1, 0, 'Royal Express', NULL, DATE '2026-06-04', 'Done', 'Paid', 'KBZ Pay', 198000, 88000, 'sale', NULL),
    (67, 'OD065', 'Gucci Floral gorgeous gardenia', 'U Myint Kywel', 'U Myint Kywel', 30, 1, 0, 'Royal Express', NULL, DATE '2026-06-04', 'Done', 'Paid', 'KBZ Pay', 317000, 135000, 'sale', NULL),
    (68, 'OD066', 'Armaf CDN EDP (W)', 'EI Thazin Aung', 'Ei Thazin Aung', 3, 1, 0, NULL, NULL, DATE '2026-05-16', 'Done', 'Paid', 'Cash', 180000, 8000, 'sale', NULL),
    (69, NULL, 'CK In 2U For Her EDT (W)', 'Ei Thazin Aung', 'Ei Thazin Aung', 3, 1, 0, NULL, NULL, DATE '2026-05-16', 'Done', 'Paid', 'Cash', 150000, 8000, 'sale', NULL),
    (70, NULL, 'JLO Still EDP Batch-2 (W)', 'Ei Thazin Aung', 'Ei Thazin Aung', 3, 1, 0, NULL, NULL, DATE '2026-05-16', 'Done', 'Paid', 'Cash', 150000, 8000, 'sale', NULL),
    (71, NULL, 'Armaf CDN EDP (W)', NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, 180000, NULL, 'skip', 'No sell price and no order status. Not imported.'),
    (72, NULL, 'Armaf CDN EDP (W)', NULL, NULL, 5, 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, 180000, NULL, 'skip', 'No sell price and no order status. Not imported.'),
    (73, 'OD067', 'Armaf CDN EDP (W)', 'မချိုချို၀င်း', 'မချိုချို၀င်း', 10, 1, 0, 'Ninja Van', NULL, DATE '2026-06-04', 'Done', 'COD', 'KBZ Pay', 180000, 22000, 'sale', NULL),
    (74, 'OD068', 'Burberry Her EDP', 'ခင်မို့မို့အောင်', 'ခင်မို့မို့အောင်', 10, 1, 0, 'Ninja Van', NULL, DATE '2026-06-05', 'Done', 'COD', 'KBZ Pay', 387000, 53000, 'sale', NULL),
    (75, 'OD069', 'Armaf CDN Untold (U)', 'Wai Yan', 'Wai Yan', 10, 1, 0, 'Ninja Van', NULL, DATE '2026-06-06', 'Done', 'COD', 'KBZ Pay', 195000, 27000, 'sale', NULL),
    (76, 'OD070', 'SI Intense Refill', 'Khaing Pwint', 'Khaing Pwint', 10, 1, 0, NULL, NULL, DATE '2026-06-12', 'Done', 'Paid', 'KBZ Pay', 198000, 35000, 'sale', NULL),
    (77, 'OD071', 'D&G Light Blue EDT (W)', 'YuKi', 'Yuki', 10, 1, 0, NULL, NULL, DATE '2026-06-12', 'Done', 'Paid', 'KBZ Pay', 255000, 38000, 'sale', NULL),
    (78, 'OD072', 'JLO Still EDP Batch-2 (W)', 'ZMP (Yuki)', 'ZMP (Yuki)', 10, 1, 0, NULL, NULL, DATE '2026-06-12', 'Done', 'Paid', 'KBZ Pay', 150000, 27000, 'sale', NULL),
    (79, 'OD073', 'Armaf CDN Untold (U)', 'Zin', 'Zin', 30, 1, 0, NULL, NULL, DATE '2026-06-15', 'Done', 'Paid', 'KBZ Pay', 195000, 78500, 'sale', NULL),
    (80, NULL, 'Versace Bright Crystal Absolu', 'Tester', NULL, 5, 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, 243000, NULL, 'tester', NULL),
    (81, 'OD074', 'Armaf CDN Untold (U)', 'May Lay', 'May Lay', 15, 1, 0, 'Ninja Van', 'မန်းလေး ကန်တော်ကြီး မြို့ပတ်လမ်း နှလုံသား ဥယျာဥ် ေရှ့
ချမ်းမြသာစည် မြို့နယ်....', DATE '2026-06-15', 'Done', 'Paid', 'KBZ Pay', 195000, 39000, 'sale', NULL),
    (82, 'OD074', 'Burberry Her EDP', 'May lay', 'May Lay', 5, 1, 0, 'Ninja Van', NULL, DATE '2026-06-15', 'Done', 'Paid', 'KBZ Pay', 387000, 27000, 'sale', NULL),
    (83, NULL, 'Armaf CDN Untold (U)', 'Tester', NULL, 15, 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, 195000, 0, 'tester', NULL),
    (84, 'OD075', 'D&G Light Blue EDT (W)', 'Htet Htet', 'Htet Htet', 5, 1, 0, 'Ninja Van', NULL, DATE '2026-06-17', 'Done', 'Paid', 'KBZ Pay', 255000, 19500, 'sale', NULL),
    (85, NULL, 'Burberry Her EDP', 'Htet Htet', 'Htet Htet', 5, 1, 0, 'Ninja Van', NULL, DATE '2026-06-19', 'Done', 'Paid', 'KBZ Pay', 387000, 27000, 'sale', NULL),
    (86, 'OD076', 'JLO Still EDP Batch-2 (W)', 'Ma Swe', 'Ma Swe', 20, 1, 0, NULL, NULL, DATE '2026-06-24', 'Done', 'Paid', 'KBZ Pay', 150000, 49000, 'sale', NULL),
    (87, 'OD077', 'D&G Light Blue EDT (W)', 'YuKi', 'Yuki', 5, 1, 0, NULL, NULL, DATE '2026-06-26', 'Done', 'Paid', 'Cash', 255000, 22000, 'sale', NULL),
    (88, 'OD078', 'Idole EDP', 'Thin THin', 'Thin Thin', 5, 1, 0, NULL, NULL, DATE '2026-06-28', 'Done', 'Paid', 'Cash', 430000, 30000, 'sale', NULL),
    (89, 'OD079', 'CK Reflection', 'Thin Thin', 'Thin Thin', 10, 1, 0, NULL, NULL, DATE '2026-06-28', 'Done', 'Paid', 'Cash', 139000, 24000, 'sale', NULL),
    (90, 'OD080', 'CK Reflection', 'Tester', NULL, 5, 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, 139000, NULL, 'tester', NULL),
    (91, 'OD082', 'MontBlanc Explorer', 'Aung Ko', 'Aung Ko', 10, 1, 0, NULL, NULL, DATE '2026-07-03', 'Done', 'Paid', 'KBZ Pay', 369000, 31500, 'sale', NULL),
    (92, 'OD083', 'MontBlanc Explorer', 'MA naw Muu', 'Ma Naw Muu', 10, 1, 0, NULL, NULL, DATE '2026-07-03', 'Done', 'Paid', 'Cash', 369000, 31500, 'sale', NULL),
    (93, 'OD084', 'MontBlanc Explorer', 'July Su', 'July Su', 10, 1, 0, 'Ninja Van', NULL, DATE '2026-07-03', 'Done', 'Paid', 'KBZ Pay', 369000, 31500, 'sale', NULL),
    (94, 'OD086', 'Idole EDP', 'Wint Darly', 'Wint Darly', 5, 1, 0, 'Ninja Van', NULL, DATE '2026-07-02', 'Done', 'Paid', 'KBZ Pay', 430000, 34000, 'sale', NULL),
    (95, 'OD087', 'Idole EDP', 'Nway', 'Nway', 10, 1, 0, NULL, NULL, DATE '2026-07-02', 'Shipped', 'COD', 'KBZ Pay', 430000, 63000, 'sale', NULL),
    (96, 'OD085', 'Idole EDP', 'July Su', 'July Su', 10, 1, 0, 'Ninja Van', NULL, DATE '2026-07-02', 'Done', 'Paid', 'KBZ Pay', 430000, 63000, 'sale', NULL),
    (97, 'OD088', 'D&G L''Imperatrice EDT (W)', 'May Lwin', 'May Lwin', 10, 1, 0, NULL, NULL, DATE '2026-07-03', 'Done', 'Paid', 'KBZ Pay', 236000, 35000, 'sale', NULL),
    (98, 'OD089', 'MontBlanc Explorer', 'Khaing Su', 'Khaing Su', 30, 1, 0, NULL, NULL, DATE '2026-07-06', 'Shipped', 'Paid', 'KBZ Pay', 369000, 84550, 'sale', NULL),
    (99, NULL, 'Versace Eros Flame', 'Tester', NULL, 2, 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, 250000, NULL, 'tester', NULL),
    (100, NULL, 'Versace Eros Energy', 'Tester', NULL, 2, 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, 250000, NULL, 'tester', NULL),
    (101, NULL, 'Issey Miyake L''Eau D''ISSEY Pour Homme', 'Tester', NULL, 2, 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, 200000, NULL, 'tester', NULL),
    (102, NULL, 'CK In 2U For Her EDT (W)', 'Tester', NULL, 2, 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, 150000, NULL, 'tester', NULL),
    (103, 'OD090', 'Versace Bright Crystal Parfum', 'Khaing Su', 'Khaing Su', 10, 1, 0, NULL, NULL, NULL, 'Shipped', 'Pending', 'KBZ Pay', 302000, 55000, 'sale', NULL),
    (104, NULL, 'Versace Bright Crystal Parfum', 'Tester', NULL, 2, 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, 302000, NULL, 'tester', NULL),
    (105, 'OD091', 'Versace Bright Crystal Absolu', 'Ei Tha Zin Aung', 'Ei Thazin Aung', 10, 1, 0, NULL, NULL, NULL, 'Done', 'Paid', NULL, 243000, 39000, 'sale', NULL),
    (106, 'OD092', 'Versace Bright Crystal Absolu', 'Khaing Su', 'Khaing Su', 10, 1, 0, NULL, NULL, NULL, 'Done', 'Paid', NULL, 243000, 38000, 'sale', NULL),
    (107, 'OD093', 'Versace Eros Flame', 'YuKi', 'Yuki', 10, 1, 0, NULL, NULL, NULL, 'Done', 'Paid', NULL, 250000, 45000, 'sale', NULL),
    (108, 'OD094', 'Burberry Her EDP', 'YuKi', 'Yuki', 10, 1, 0, NULL, NULL, NULL, 'Done', 'Paid', 'KBZ Pay', 387000, 54500, 'sale', NULL),
    (109, 'OD095', 'Burberry Sheer', 'YuKi', 'Yuki', 100, 1, 0, NULL, NULL, DATE '2026-07-31', 'Done', 'Paid', 'KBZ Pay', 240000, 240000, 'sale', NULL),
    (110, 'OD096', 'Armaf CDN Untold (U)', 'Zin', 'Zin', 10, 1, 0, NULL, NULL, DATE '2026-08-31', 'Done', 'Paid', 'KBZ Pay', 195000, 25000, 'sale', NULL),
    (111, 'OD097', 'Valentino BIR coral fantasy', 'Doru', 'Doru', 5, 1, 0, NULL, NULL, DATE '2026-08-31', 'Done', 'Paid', 'KBZ Pay', 428000, 37500, 'sale', NULL),
    (112, 'OD098', 'Versace Eros Energy', 'KTL', 'KTL', 10, 1, 0, NULL, NULL, DATE '2026-07-31', 'Done', 'Paid', 'KBZ Pay', 250000, 40000, 'sale', NULL),
    (113, NULL, 'Gucci Floral gorgeous gardenia', 'Teser', NULL, 5, 1, 0, NULL, NULL, NULL, NULL, NULL, NULL, 317000, NULL, 'tester', NULL),
    (114, NULL, 'Gucci Floral gorgeous gardenia', 'Ma Moe Thu', 'Ma Moe Thu', 10, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, 317000, NULL, 'skip', 'No sell price and no order status. Not imported.'),
    (115, 'OD099', 'Burberry Her EDP', 'Pyae L Win', 'Pyae L Win', 10, 1, 0, NULL, NULL, DATE '2026-09-08', 'Done', 'Paid', 'KBZ Pay', 387000, 53000, 'sale', NULL),
    (116, 'OD100', 'YSL Lire Refill', 'Pyae L win', 'Pyae L Win', 2, 1, 0, NULL, NULL, DATE '2026-09-08', 'Done', 'COD', 'KBZ Pay', 428000, 10000, 'sale', NULL),
    (117, NULL, 'Prada Paradoxe', NULL, NULL, 2, 1, 0, NULL, NULL, DATE '2026-09-08', 'Done', 'COD', 'KBZ Pay', 419000, 10000, 'sale', NULL),
    (118, NULL, 'Versace Bright Crystal Absolu', NULL, NULL, 2, 1, 0, NULL, NULL, DATE '2026-09-08', 'Done', 'COD', 'KBZ Pay', 243000, 10000, 'sale', NULL),
    (119, NULL, 'Idole EDP', NULL, NULL, 2, 1, 0, NULL, NULL, DATE '2026-09-08', 'Done', 'COD', 'KBZ Pay', 430000, 10000, 'sale', NULL),
    (120, NULL, 'CH Good Girl Jasmine Abs. (W)', NULL, NULL, 2, 1, 0, NULL, NULL, DATE '2026-09-08', 'Done', 'COD', 'KBZ Pay', 394000, 10000, 'sale', NULL),
    (121, 'OD101', 'Valentino BIR coral fantasy', 'Chuu', 'Chuu', 5, 1, 0, NULL, NULL, DATE '2026-09-07', 'Shipped', 'Pending', 'KBZ Pay', 428000, 36000, 'sale', NULL),
    (122, 'OD102', 'Valentino Born In Roma', 'Hsu Pyae', 'Hsu Pyae', 5, 1, 0, NULL, NULL, DATE '2026-09-07', 'Shipped', 'Paid', 'KBZ Pay', 438000, 36000, 'sale', NULL),
    (123, 'OD103', 'Prada Paradoxe', 'Hsu Pyae', 'Hsu Pyae', 5, 1, 0, NULL, NULL, DATE '2026-09-07', 'Shipped', 'Pending', 'KBZ Pay', 419000, 36000, 'sale', NULL),
    (124, 'OD104', 'Prada Paradoxe', 'Ma Moe Thu', 'Ma Moe Thu', 10, 1, 0, NULL, NULL, DATE '2026-09-07', 'Shipped', 'Pending', 'KBZ Pay', 419000, 60000, 'sale', NULL),
    (125, 'OD105', 'Gucci Floral gorgeous gardenia', 'Ma Moe Thu', 'Ma Moe Thu', 10, 1, 0, NULL, NULL, DATE '2026-09-07', 'Shipped', 'Pending', 'KBZ Pay', 317000, 52000, 'sale', NULL),
    (126, 'OD106', 'Jimmy Choo I want Choo', 'Khin Zar Ni Wint', 'Khin Zar Ni Wint', 10, 1, 0, NULL, NULL, DATE '2026-09-07', 'Done', 'COD', 'KBZ Pay', 259000, 34000, 'sale', NULL),
    (127, 'OD107', 'Prada Paradoxe', 'Khaing Hsu', 'Khaing Hsu', 10, 1, 0, NULL, NULL, DATE '2026-09-07', 'Done', 'COD', 'KBZ Pay', 419000, 60000, 'sale', NULL),
    (128, 'OD108', 'Prada Paradoxe', 'Mercy', 'Mercy', 10, 1, 0, NULL, NULL, DATE '2026-09-14', 'Done', 'COD', 'KBZ Pay', 419000, 60000, 'sale', NULL),
    (129, 'OD109', 'Prada Paradoxe', 'Moe', 'Moe', 5, 1, 0, NULL, NULL, DATE '2026-09-12', 'Done', 'COD', 'Cash', 419000, 30000, 'sale', NULL),
    (130, 'OD110', 'Gucci Floral gorgeous gardenia', 'Moe', 'Moe', 5, 1, 0, NULL, NULL, DATE '2026-09-12', 'Done', 'COD', 'Cash', 317000, 30000, 'sale', NULL),
    (131, 'OD111', 'Versace Eros Energy', 'Aung Ko', 'Aung Ko', 10, 1, 0, NULL, NULL, DATE '2026-09-17', 'Done', 'COD', 'KBZ Pay', 250000, 39000, 'sale', NULL),
    (132, 'OD102', 'Julitte has a gun (Tester)', 'Khaing Hsu', 'Khaing Hsu', 5, 1, 0, NULL, NULL, DATE '2026-09-17', 'Shipped', 'COD', 'KBZ Pay', 292000, 26000, 'sale', NULL),
    (133, 'OD103', 'Burberry Her EDP', 'Yoon Pyae Ko Ko', 'Yoon Pyae Ko Ko', 10, 1, 0, NULL, NULL, DATE '2026-09-17', 'Shipped', 'COD', 'KBZ Pay', 387000, 53000, 'sale', NULL),
    (134, 'OD104', 'D&G L''Imperatrice EDT (W)', 'Yoon Pyae Ko Ko', 'Yoon Pyae Ko Ko', 10, 1, 0, NULL, NULL, DATE '2026-09-17', 'Shipped', 'COD', 'KBZ Pay', 236000, 35000, 'sale', NULL),
    (135, 'OD105', 'D&G L''Imperatrice EDT (W)', 'Zin', 'Zin', 2.5, 1, 0, NULL, NULL, DATE '2026-09-18', 'Shipped', 'Pending', 'KBZ Pay', 236000, 10000, 'sale', NULL),
    (136, 'OD106', 'Idole EDP', NULL, NULL, 2.5, 1, 0, NULL, NULL, DATE '2026-09-18', 'Shipped', 'Pending', 'KBZ Pay', 430000, 15000, 'sale', NULL);

  FOR r IN SELECT * FROM _ot ORDER BY row_no LOOP
    IF r.kind <> 'sale' THEN
      v_open_anchor := NULL;
      v_open_kind := r.kind;
      CONTINUE;
    END IF;

    v_attach := false;
    IF v_open_anchor IS NOT NULL AND v_open_kind = 'sale' THEN
      IF r.order_id IS NOT NULL
         AND r.order_id IS NOT DISTINCT FROM v_open_order
         AND r.customer_name IS NOT DISTINCT FROM v_open_customer
         AND r.order_date IS NOT DISTINCT FROM v_open_date THEN
        v_attach := true;
      ELSIF r.order_id IS NULL
         AND r.order_date IS NOT NULL
         AND r.order_date IS NOT DISTINCT FROM v_open_date
         AND (r.customer_name IS NULL OR r.customer_name IS NOT DISTINCT FROM v_open_customer) THEN
        v_attach := true;
      END IF;
    END IF;

    IF v_attach THEN
      UPDATE _ot SET group_anchor = v_open_anchor WHERE row_no = r.row_no;
    ELSE
      v_open_anchor := r.row_no;
      v_open_customer := r.customer_name;
      v_open_date := r.order_date;
      v_open_order := r.order_id;
      v_open_kind := 'sale';
      UPDATE _ot SET group_anchor = r.row_no WHERE row_no = r.row_no;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM _ot WHERE kind = 'sale' AND group_anchor IS NULL) THEN
    RAISE EXCEPTION 'Order tracking sale row was not grouped';
  END IF;

  INSERT INTO customers (name)
  SELECT DISTINCT customer_name
  FROM _ot
  WHERE kind = 'sale' AND customer_name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM customers c WHERE lower(c.name) = lower(_ot.customer_name)
  );

  SELECT id INTO v_cat_id FROM expense_categories WHERE name = 'Delivery';
  IF v_cat_id IS NULL THEN
    RAISE EXCEPTION 'Delivery expense category not found';
  END IF;

  FOR v_anchor IN
    SELECT DISTINCT group_anchor
    FROM _ot
    WHERE kind = 'sale'
    ORDER BY group_anchor
  LOOP
    IF EXISTS (
      SELECT 1 FROM sales WHERE strpos(notes, '[ot:' || v_anchor || ']') > 0
    ) THEN
      CONTINUE;
    END IF;

    SELECT
      customer_name,
      order_id,
      order_date,
      order_date IS NULL,
      order_status,
      payment,
      pay_method
    INTO
      v_customer,
      v_order_id,
      v_sale_date,
      v_date_blank,
      v_status,
      v_payment,
      v_method_label
    FROM _ot
    WHERE row_no = v_anchor;

    SELECT COALESCE(sum(delivery_fee), 0)
    INTO v_fee
    FROM _ot
    WHERE group_anchor = v_anchor AND kind = 'sale';

    SELECT string_agg(DISTINCT delivery_service, ', ' ORDER BY delivery_service)
    INTO v_service
    FROM _ot
    WHERE group_anchor = v_anchor AND kind = 'sale' AND delivery_service IS NOT NULL;

    SELECT string_agg(sheet_notes, ' ' ORDER BY row_no)
    INTO v_sheet_notes
    FROM _ot
    WHERE group_anchor = v_anchor AND kind = 'sale' AND sheet_notes IS NOT NULL;

    SELECT string_agg(issue, ' ' ORDER BY row_no)
    INTO v_issue
    FROM _ot
    WHERE group_anchor = v_anchor AND kind = 'sale' AND issue IS NOT NULL;

    SELECT string_agg(DISTINCT sheet_customer, ', ' ORDER BY sheet_customer)
    INTO v_sheet_names
    FROM _ot
    WHERE group_anchor = v_anchor
      AND kind = 'sale'
      AND sheet_customer IS NOT NULL
      AND sheet_customer IS DISTINCT FROM customer_name;

    SELECT string_agg('[ot:' || row_no || ']', '' ORDER BY row_no)
    INTO v_keys
    FROM _ot
    WHERE group_anchor = v_anchor AND kind = 'sale';

    v_pay_method := CASE lower(COALESCE(v_method_label, ''))
      WHEN 'kbz pay' THEN 'mobile_wallet'::payment_method
      WHEN 'cash' THEN 'cash'::payment_method
      ELSE 'other'::payment_method
    END;

    v_collected := CASE
      WHEN lower(COALESCE(v_payment, '')) = 'paid' THEN true
      WHEN lower(COALESCE(v_payment, '')) = 'cod' AND lower(COALESCE(v_status, '')) = 'done' THEN true
      ELSE false
    END;

    IF v_date_blank THEN
      v_sale_date := v_unknown;
    END IF;

    v_notes := v_keys || ' Sheet order ' || COALESCE(v_order_id, '(no id)') || '.';
    IF v_status IS NOT NULL THEN
      v_notes := v_notes || ' Status: ' || v_status || '.';
    END IF;
    IF lower(COALESCE(v_payment, '')) = 'paid' THEN
      v_notes := v_notes || ' Payment: Paid'
        || CASE
             WHEN v_method_label IS NULL THEN '. Payment method was blank.'
             ELSE ' via ' || v_method_label || '.'
           END;
    ELSIF lower(COALESCE(v_payment, '')) = 'cod' THEN
      v_notes := v_notes || CASE
        WHEN v_collected THEN ' Payment: COD, collected'
        ELSE ' Payment: COD, not collected yet'
      END
      || CASE
           WHEN v_method_label IS NULL THEN '.'
           ELSE '. Method: ' || v_method_label || '.'
         END;
    ELSIF lower(COALESCE(v_payment, '')) = 'pending' THEN
      v_notes := v_notes || ' Payment: Pending'
        || CASE
             WHEN v_method_label IS NULL THEN '.'
             ELSE '. Method: ' || v_method_label || '.'
           END;
    ELSE
      v_notes := v_notes || ' Payment was blank.';
    END IF;
    IF v_service IS NOT NULL THEN
      v_notes := v_notes || ' Delivery: ' || v_service || '.';
    END IF;
    IF v_fee > 0 THEN
      v_notes := v_notes || ' Delivery fee ' || trim(to_char(v_fee, 'FM999,999,990'))
        || ' MMK is an expense, not part of the sale total.';
    END IF;
    IF v_customer IS NULL THEN
      v_notes := v_notes || ' Customer name was blank.';
    ELSIF v_sheet_names IS NOT NULL THEN
      v_notes := v_notes || ' Sheet customer: ' || v_sheet_names || '.';
    END IF;
    IF v_order_id IS NOT NULL AND (
      SELECT count(DISTINCT group_anchor)
      FROM _ot
      WHERE kind = 'sale' AND order_id = v_order_id
    ) > 1 THEN
      v_notes := v_notes || ' This sheet order id is also on another sale. They are different customers or dates, so they stay separate.';
    END IF;
    IF v_order_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM _ot WHERE kind = 'tester' AND order_id = v_order_id
    ) THEN
      v_notes := v_notes || ' A Tester row uses this same sheet order id and was recorded as a tester pour, not a line on this sale.';
    END IF;
    IF v_date_blank THEN
      v_notes := v_notes || ' Order date was blank. Not guessed. Stored on 2026-01-01.';
    END IF;
    IF v_issue IS NOT NULL THEN
      v_notes := v_notes || ' ' || v_issue;
    END IF;
    IF v_sheet_notes IS NOT NULL THEN
      v_notes := v_notes || ' Note: ' || v_sheet_notes;
    END IF;

    IF v_customer IS NOT NULL THEN
      SELECT id INTO v_customer_id
      FROM customers
      WHERE lower(name) = lower(v_customer)
      LIMIT 1;
      IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'Customer not found: %', v_customer;
      END IF;
    ELSE
      v_customer_id := NULL;
    END IF;

    v_sale_number := next_doc_number('sale');
    v_subtotal := 0;
    v_cogs := 0;
    v_stock_notes := '';

    INSERT INTO sales (
      sale_number, sale_date, customer_id, discount_mmk, notes, payment_status
    ) VALUES (
      v_sale_number, v_sale_date, v_customer_id, 0, v_notes, 'unpaid'
    )
    RETURNING id INTO v_sale_id;

    FOR r IN
      SELECT * FROM _ot
      WHERE group_anchor = v_anchor AND kind = 'sale'
      ORDER BY row_no
    LOOP
      IF r.size_ml IS NULL OR r.size_ml <= 0 OR r.qty IS NULL OR r.qty <= 0 THEN
        RAISE EXCEPTION 'Order tracking row % has no size or quantity', r.row_no;
      END IF;

      SELECT p.id, b.name, p.name, p.default_bottle_size_ml
      INTO v_perfume_id, v_brand, v_perfume, v_bottle
      FROM perfumes p
      JOIN brands b ON b.id = p.brand_id
      WHERE p.name = r.scent;

      IF v_perfume_id IS NULL THEN
        RAISE EXCEPTION 'Perfume not found for order tracking row %: %', r.row_no, r.scent;
      END IF;

      v_item_id := get_or_create_perfume_liquid_item(v_perfume_id);
      SELECT quantity_on_hand INTO v_on_hand
      FROM inventory_items
      WHERE id = v_item_id
      FOR UPDATE;

      v_ml := round(r.size_ml * r.qty, 4);
      IF v_on_hand + 0.0001 >= v_ml THEN
        v_cost_per_ml := apply_outbound_qty(v_item_id, v_ml);
        v_deducted := true;
      ELSE
        IF COALESCE(r.rollup, 0) > 0 AND COALESCE(v_bottle, 0) > 0 THEN
          v_cost_per_ml := r.rollup / v_bottle;
        ELSE
          v_cost_per_ml := 0;
        END IF;
        v_deducted := false;
        v_stock_notes := v_stock_notes || ' ' || r.scent || ' ' || trim(to_char(v_ml, 'FM999990.00'))
          || 'ml was not taken from stock (have '
          || trim(to_char(v_on_hand, 'FM999990.00'))
          || 'ml). COGS uses the sheet bottle price.';
      END IF;

      v_price := COALESCE(r.sell_price, 0);
      v_unit_cogs := round(v_cost_per_ml * r.size_ml, 2);
      v_line_cogs := round(v_unit_cogs * r.qty, 2);
      v_line_total := round(v_price * r.qty, 2);
      v_size_label := to_char(r.size_ml, 'FM999990.99');
      v_description := trim(both ' —' FROM coalesce(v_brand, '') || ' — ' || coalesce(v_perfume, 'Perfume'))
        || ' ' || v_size_label || 'ml';

      INSERT INTO sale_items (
        sale_id, inventory_item_id, product_type, perfume_id, description,
        size_ml, quantity, unit_sale_price_mmk, line_discount_mmk, line_total_mmk,
        unit_cogs_mmk, cogs_mmk, profit_mmk
      ) VALUES (
        v_sale_id, v_item_id, 'DECANT', v_perfume_id, v_description,
        r.size_ml, r.qty, v_price, 0, v_line_total,
        v_unit_cogs, v_line_cogs, round(v_line_total - v_line_cogs, 2)
      )
      RETURNING id INTO v_sale_item_id;

      IF v_deducted THEN
        v_moved := (v_sale_date::text || ' 12:00:00+06:30')::timestamptz;
        INSERT INTO inventory_movements (
          inventory_item_id, moved_at, movement_type, quantity, unit,
          unit_cost_mmk, total_cost_mmk, sale_id, sale_item_id, notes
        ) VALUES (
          v_item_id, v_moved, 'SALE', -v_ml, 'ml',
          v_cost_per_ml, -round(v_cost_per_ml * v_ml, 2),
          v_sale_id, v_sale_item_id,
          v_sale_number || ' poured ' || trim(to_char(r.qty, 'FM999990')) || ' × ' || v_size_label || 'ml'
        );
      END IF;

      v_subtotal := v_subtotal + v_line_total;
      v_cogs := v_cogs + v_line_cogs;
    END LOOP;

    IF v_stock_notes <> '' THEN
      UPDATE sales SET notes = notes || v_stock_notes WHERE id = v_sale_id;
    END IF;

    UPDATE sales
    SET
      subtotal_mmk = round(v_subtotal, 2),
      total_mmk = round(v_subtotal, 2),
      cogs_mmk = round(v_cogs, 2),
      gross_profit_mmk = round(v_subtotal - v_cogs, 2),
      paid_amount_mmk = 0,
      remaining_amount_mmk = round(v_subtotal, 2)
    WHERE id = v_sale_id;

    IF v_collected AND v_subtotal > 0 THEN
      INSERT INTO payments (
        payment_number, sale_id, customer_id, payment_date, amount_mmk,
        payment_method, notes
      ) VALUES (
        next_doc_number('payment'),
        v_sale_id,
        v_customer_id,
        v_sale_date,
        round(v_subtotal, 2),
        v_pay_method,
        CASE WHEN lower(COALESCE(v_payment, '')) = 'cod' THEN 'COD' ELSE NULL END
      );
      UPDATE sales
      SET paid_amount_mmk = round(v_subtotal, 2)
      WHERE id = v_sale_id;
    END IF;

    PERFORM refresh_sale_payment_status(v_sale_id);

    IF v_collected AND v_subtotal = 0 THEN
      UPDATE sales
      SET payment_status = 'paid', remaining_amount_mmk = 0
      WHERE id = v_sale_id;
    END IF;

    IF v_fee > 0 AND NOT EXISTS (
      SELECT 1 FROM expenses WHERE strpos(notes, '[ot-fee:' || v_anchor || ']') > 0
    ) THEN
      INSERT INTO expenses (
        expense_number, expense_date, category_id, description, amount_mmk,
        payment_method, notes
      ) VALUES (
        next_doc_number('expense'),
        v_sale_date,
        v_cat_id,
        'Delivery for sheet order ' || COALESCE(v_order_id, v_sale_number),
        round(v_fee, 2),
        v_pay_method,
        '[ot-fee:' || v_anchor || '] ' || v_sale_number
          || CASE
               WHEN v_service IS NULL THEN ''
               ELSE '. ' || v_service
             END
      );
    END IF;

    v_sale_count := v_sale_count + 1;
  END LOOP;

  FOR r IN SELECT * FROM _ot WHERE kind = 'tester' ORDER BY row_no LOOP
    IF EXISTS (
      SELECT 1 FROM inventory_movements
      WHERE movement_type = 'SAMPLE' AND strpos(notes, '[ot:' || r.row_no || ']') > 0
    ) THEN
      CONTINUE;
    END IF;

    IF r.size_ml IS NULL OR r.size_ml <= 0 OR r.qty IS NULL OR r.qty <= 0 THEN
      RAISE EXCEPTION 'Tester row % has no size or quantity', r.row_no;
    END IF;

    SELECT p.id, b.name, p.name, p.default_bottle_size_ml
    INTO v_perfume_id, v_brand, v_perfume, v_bottle
    FROM perfumes p
    JOIN brands b ON b.id = p.brand_id
    WHERE p.name = r.scent;

    IF v_perfume_id IS NULL THEN
      RAISE EXCEPTION 'Perfume not found for tester row %: %', r.row_no, r.scent;
    END IF;

    v_item_id := get_or_create_perfume_liquid_item(v_perfume_id);
    SELECT quantity_on_hand INTO v_on_hand
    FROM inventory_items
    WHERE id = v_item_id
    FOR UPDATE;

    v_ml := round(r.size_ml * r.qty, 4);
    IF v_on_hand + 0.0001 >= v_ml THEN
      v_cost_per_ml := apply_outbound_qty(v_item_id, v_ml);
      v_deducted := true;
    ELSE
      IF COALESCE(r.rollup, 0) > 0 AND COALESCE(v_bottle, 0) > 0 THEN
        v_cost_per_ml := r.rollup / v_bottle;
      ELSE
        v_cost_per_ml := 0;
      END IF;
      v_deducted := false;
    END IF;

    v_size_label := to_char(r.size_ml, 'FM999990.99');
    v_sale_date := COALESCE(r.order_date, v_unknown);
    v_moved := (v_sale_date::text || ' 12:00:00+06:30')::timestamptz;
    v_label := trim(both ' —' FROM coalesce(v_brand, '') || ' — ' || coalesce(v_perfume, 'perfume'))
      || ' tester ' || v_size_label || 'ml × ' || trim(to_char(r.qty, 'FM999990'))
      || ' · [ot:' || r.row_no || ']';
    IF lower(COALESCE(r.sheet_customer, '')) = 'teser' THEN
      v_label := v_label || ' · Sheet customer was Teser.';
    END IF;
    IF r.order_id IS NOT NULL THEN
      v_label := v_label || ' · Sheet order ' || r.order_id || '.';
    END IF;
    IF r.order_date IS NULL THEN
      v_label := v_label || ' · Pour date was blank. Not guessed. Stored on 2026-01-01.';
    END IF;
    IF NOT v_deducted THEN
      v_label := v_label || ' · On-hand was not reduced (have '
        || trim(to_char(v_on_hand, 'FM999990.00'))
        || 'ml, need ' || trim(to_char(v_ml, 'FM999990.00'))
        || 'ml). Cost uses the sheet bottle price.';
    END IF;

    INSERT INTO inventory_movements (
      inventory_item_id, moved_at, movement_type, quantity, unit,
      unit_cost_mmk, total_cost_mmk, notes
    ) VALUES (
      v_item_id, v_moved, 'SAMPLE', -v_ml, 'ml',
      v_cost_per_ml, -round(v_cost_per_ml * v_ml, 2),
      v_label
    );

    v_tester_count := v_tester_count + 1;
  END LOOP;

  RAISE NOTICE 'Order tracking import: % sales, % tester pours', v_sale_count, v_tester_count;
END;
$ot$;
