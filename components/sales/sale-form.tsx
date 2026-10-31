"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { findOrCreateCustomerByName } from "@/lib/actions/customers";
import { createSale, updateSale } from "@/lib/actions/sales";
import { allocateBundleUnitPrices } from "@/lib/domain/bundles";
import {
  SALE_SIZES,
  resolveSellPrice,
  resolveFullSizePrice,
  quoteCogs,
  marginRate,
  formatMargin,
  packagingCostForSize,
  capExtraForSize,
  type CapExtras,
  type PackagingCosts,
} from "@/lib/domain/pricing";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  fieldClass,
  formatMmk,
  labelClass,
} from "@/lib/ui";
import {
  createSaleOrderSchema,
  updateSaleOrderSchema,
  PAYMENT_METHOD_LABELS,
} from "@/lib/validations/sales";

export type CustomerOption = { id: string; name: string };

export type BottleOption = {
  perfume_id: string;
  label: string;
  ml_on_hand: number;
  cost_per_ml: number;
  bottle_size_ml: number;
};

export type BundleOption = {
  id: string;
  name: string;
  size_ml: number;
  sale_price_mmk: number;
  items: Array<{ perfume_id: string; quantity: number }>;
};

export type SaleFormInitialLine = {
  perfume_id: string;
  size_ml: number;
  quantity: number;
  unit_sale_price_mmk: number;
  line_discount_mmk?: number;
  with_cap?: boolean;
};

type SaleFormProps = {
  mode?: "create" | "edit";
  saleId?: string;
  customers: CustomerOption[];
  bottles: BottleOption[];
  /** key: perfumeId:sizeMl */
  prices: Record<string, number>;
  packaging: PackagingCosts;
  caps: CapExtras;
  bundles?: BundleOption[];
  initialCustomerId?: string | null;
  initialCustomerName?: string;
  initialSaleDate?: string;
  initialDiscountMmk?: number;
  initialNotes?: string | null;
  initialLines?: SaleFormInitialLine[];
};

type Line = {
  perfume_id: string;
  size_ml: number;
  quantity: number;
  unit_sale_price_mmk: number;
  line_discount_mmk: number;
  price_touched: boolean;
  sell_all: boolean;
  full_bottle: boolean;
  with_cap: boolean;
  from_bundle?: string | null;
};

const chipBase =
  "inline-flex min-h-9 flex-col items-center justify-center gap-0.5 border px-2.5 py-1.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45";
const chipIdle =
  `${chipBase} border-[var(--stroke)] bg-[var(--canvas)] text-[var(--ink-soft)] hover:border-[var(--ink)] hover:text-[var(--ink)]`;
const chipActive =
  `${chipBase} border-[var(--ink)] bg-[var(--ink)] text-white`;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatMl(ml: number) {
  const rounded = Math.round(ml * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function priceFor(
  bottle: BottleOption | undefined,
  size: number,
  prices: Record<string, number>,
) {
  if (!bottle) return 0;
  return resolveSellPrice({
    label: bottle.label,
    sizeMl: size,
    costPerMl: bottle.cost_per_ml,
    saved: prices[`${bottle.perfume_id}:${size}`],
  }).price;
}

function fullSizeQuoteFor(
  bottle: BottleOption | undefined,
  prices: Record<string, number>,
) {
  if (!bottle || !(bottle.bottle_size_ml > 0)) return null;
  return resolveFullSizePrice({
    label: bottle.label,
    costPerMl: bottle.cost_per_ml,
    bottleSizeMl: bottle.bottle_size_ml,
    saved: prices[`${bottle.perfume_id}:${bottle.bottle_size_ml}`],
  });
}

function priceWithCap(
  bottle: BottleOption | undefined,
  size: number,
  prices: Record<string, number>,
  withCap: boolean,
  caps: CapExtras,
) {
  const base = priceFor(bottle, size, prices);
  if (!withCap) return base;
  return base + capExtraForSize(caps, size);
}

function blankLine(bottles: BottleOption[], prices: Record<string, number>): Line {
  const bottle = bottles[0];
  const left = bottle?.ml_on_hand ?? 0;
  const sellAll = left > 0 && left < 10;
  const size = sellAll ? left : 10;
  return {
    perfume_id: bottle?.perfume_id ?? "",
    size_ml: size,
    quantity: 1,
    unit_sale_price_mmk: priceFor(bottle, size, prices),
    line_discount_mmk: 0,
    price_touched: false,
    sell_all: sellAll,
    full_bottle: false,
    with_cap: false,
    from_bundle: null,
  };
}

function lineGross(line: Pick<Line, "quantity" | "unit_sale_price_mmk">) {
  return (Number(line.quantity) || 0) * (Number(line.unit_sale_price_mmk) || 0);
}

function lineNet(line: Line) {
  return Math.max(
    0,
    Math.round((lineGross(line) - (Number(line.line_discount_mmk) || 0)) * 100) /
      100,
  );
}

export function SaleForm({
  mode = "create",
  saleId,
  customers,
  bottles,
  prices,
  packaging,
  caps,
  bundles = [],
  initialCustomerId = null,
  initialCustomerName = "",
  initialSaleDate,
  initialDiscountMmk = 0,
  initialNotes = "",
  initialLines,
}: SaleFormProps) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [customerList, setCustomerList] = useState(customers);
  const [customerQuery, setCustomerQuery] = useState(initialCustomerName);
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [openSuggest, setOpenSuggest] = useState(false);
  const [saleDate, setSaleDate] = useState(initialSaleDate || todayIso());
  const [orderDiscount, setOrderDiscount] = useState(Number(initialDiscountMmk) || 0);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [payNow, setPayNow] = useState(!isEdit);
  const [method, setMethod] = useState<
    "cash" | "bank_transfer" | "mobile_wallet" | "card" | "other"
  >("mobile_wallet");
  const [bundleId, setBundleId] = useState(bundles[0]?.id ?? "");
  const [bundleQty, setBundleQty] = useState(1);
  const [lines, setLines] = useState<Line[]>(() => {
    if (initialLines?.length) {
      return initialLines.map((line) => {
        const bottle = bottles.find((b) => b.perfume_id === line.perfume_id);
        const size = Number(line.size_ml) || 10;
        const left = bottle?.ml_on_hand ?? 0;
        const sellAll =
          !line.with_cap &&
          left > 0 &&
          Math.abs(left - size) < 0.011 &&
          !(bottle && bottle.bottle_size_ml > 0 && Math.abs(bottle.bottle_size_ml - size) < 0.011);
        const fullBottle = Boolean(
          bottle &&
            bottle.bottle_size_ml > 0 &&
            Math.abs(bottle.bottle_size_ml - size) < 0.011 &&
            !line.with_cap,
        );
        return {
          perfume_id: line.perfume_id,
          size_ml: size,
          quantity: Number(line.quantity) || 1,
          unit_sale_price_mmk: Number(line.unit_sale_price_mmk) || 0,
          line_discount_mmk: Number(line.line_discount_mmk) || 0,
          price_touched: true,
          sell_all: sellAll,
          full_bottle: fullBottle,
          with_cap: Boolean(line.with_cap),
          from_bundle: null,
        };
      });
    }
    return [blankLine(bottles, prices)];
  });
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const suggestions = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    const list = q
      ? customerList.filter((c) => c.name.toLowerCase().includes(q))
      : customerList;
    return list.slice(0, 6);
  }, [customerQuery, customerList]);

  const gross = lines.reduce((sum, line) => sum + lineGross(line), 0);
  const lineDiscountTotal = lines.reduce(
    (sum, line) => sum + (Number(line.line_discount_mmk) || 0),
    0,
  );
  const subtotal = Math.max(
    0,
    Math.round((gross - lineDiscountTotal) * 100) / 100,
  );
  const total = Math.max(
    0,
    Math.round((subtotal - (Number(orderDiscount) || 0)) * 100) / 100,
  );
  const totalMl = lines.reduce(
    (sum, line) => sum + (Number(line.size_ml) || 0) * (Number(line.quantity) || 0),
    0,
  );

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function applyBundle() {
    const bundle = bundles.find((b) => b.id === bundleId);
    if (!bundle) {
      setError("Select a bundle set.");
      return;
    }
    if (!bundle.items.length) {
      setError("That bundle has no perfumes yet.");
      return;
    }

    const missing: string[] = [];
    const short: string[] = [];
    for (const item of bundle.items) {
      const bottle = bottles.find((b) => b.perfume_id === item.perfume_id);
      if (!bottle) {
        missing.push(item.perfume_id);
        continue;
      }
      const need =
        Math.round(bundle.size_ml * item.quantity * bundleQty * 100) / 100;
      if (need > Math.round(bottle.ml_on_hand * 100) / 100) {
        short.push(
          `${bottle.label} (need ${need} ml, have ${bottle.ml_on_hand} ml)`,
        );
      }
    }
    if (missing.length) {
      setError(
        "Some scents in this bundle have no liquid on hand. Receive stock first, or edit the bundle.",
      );
      return;
    }
    if (short.length) {
      setError(`Not enough liquid: ${short.join("; ")}`);
      return;
    }

    const weights = bundle.items.map((item) => {
      const bottle = bottles.find((b) => b.perfume_id === item.perfume_id);
      return priceFor(bottle, bundle.size_ml, prices);
    });
    const unitPrices = allocateBundleUnitPrices(
      bundle.sale_price_mmk,
      weights,
    );
    const qty = Math.max(1, Math.trunc(bundleQty) || 1);
    const newLines: Line[] = bundle.items.map((item, index) => ({
      perfume_id: item.perfume_id,
      size_ml: bundle.size_ml,
      quantity: item.quantity * qty,
      unit_sale_price_mmk: unitPrices[index] ?? 0,
      line_discount_mmk: 0,
      price_touched: true,
      sell_all: false,
      full_bottle: false,
      with_cap: false,
      from_bundle: bundle.name,
    }));

    setError(null);
    setLines((prev) => {
      const onlyDefault =
        prev.length === 1 &&
        !prev[0]?.price_touched &&
        !prev[0]?.sell_all &&
        !prev[0]?.full_bottle &&
        !prev[0]?.from_bundle &&
        (prev[0]?.quantity ?? 1) === 1;
      return onlyDefault ? newLines : [...prev, ...newLines];
    });
  }

  function changeScent(index: number, perfumeId: string) {
    const bottle = bottles.find((b) => b.perfume_id === perfumeId);
    const line = lines[index];
    const sellAll = Boolean(line?.sell_all);
    const full = Boolean(line?.full_bottle) && !sellAll;
    const fullQuote = bottle ? fullSizeQuoteFor(bottle, prices) : null;
    const size = sellAll
      ? (bottle?.ml_on_hand ?? 0)
      : full && fullQuote
        ? fullQuote.sizeMl
        : (line?.size_ml ?? 10);
    const autoPrice =
      full && fullQuote
        ? fullQuote.price
        : priceWithCap(bottle, size, prices, Boolean(line?.with_cap) && !full, caps);
    updateLine(index, {
      perfume_id: perfumeId,
      sell_all: sellAll,
      full_bottle: full,
      with_cap: Boolean(line?.with_cap) && !full,
      size_ml: size,
      quantity: sellAll || full ? 1 : (line?.quantity ?? 1),
      unit_sale_price_mmk: line?.price_touched
        ? line.unit_sale_price_mmk
        : autoPrice,
      from_bundle: null,
    });
  }

  function changeSize(index: number, size: number) {
    const line = lines[index];
    const bottle = bottles.find((b) => b.perfume_id === line?.perfume_id);
    updateLine(index, {
      sell_all: false,
      full_bottle: false,
      size_ml: size,
      unit_sale_price_mmk: line?.price_touched
        ? line.unit_sale_price_mmk
        : priceWithCap(bottle, size, prices, Boolean(line?.with_cap), caps),
      from_bundle: null,
    });
  }

  function sellAllLeft(index: number) {
    const line = lines[index];
    const bottle = bottles.find((b) => b.perfume_id === line?.perfume_id);
    if (!bottle || bottle.ml_on_hand <= 0) return;
    const size = Math.round(bottle.ml_on_hand * 100) / 100;
    updateLine(index, {
      sell_all: true,
      full_bottle: false,
      size_ml: size,
      quantity: 1,
      unit_sale_price_mmk: line?.price_touched
        ? line.unit_sale_price_mmk
        : priceWithCap(bottle, size, prices, Boolean(line?.with_cap), caps),
    });
  }

  function sellFullBottle(index: number) {
    const line = lines[index];
    const bottle = bottles.find((b) => b.perfume_id === line?.perfume_id);
    if (!bottle) return;
    const quote = fullSizeQuoteFor(bottle, prices);
    if (!quote || quote.sizeMl <= 0 || bottle.ml_on_hand + 0.01 < quote.sizeMl)
      return;
    updateLine(index, {
      sell_all: false,
      full_bottle: true,
      with_cap: false,
      size_ml: quote.sizeMl,
      quantity: 1,
      unit_sale_price_mmk: line?.price_touched
        ? line.unit_sale_price_mmk
        : quote.price,
    });
  }

  function toggleCap(index: number) {
    const line = lines[index];
    if (!line || line.full_bottle) return;
    const extra = capExtraForSize(caps, line.size_ml);
    if (extra <= 0) return;
    const next = !line.with_cap;
    const bottle = bottles.find((b) => b.perfume_id === line.perfume_id);
    updateLine(index, {
      with_cap: next,
      unit_sale_price_mmk: line.price_touched
        ? Math.max(0, line.unit_sale_price_mmk + (next ? extra : -extra))
        : priceWithCap(bottle, line.size_ml, prices, next, caps),
    });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    let resolvedCustomer = customerId || null;
    const typed = customerQuery.trim();
    if (typed && !resolvedCustomer) {
      const saved = await findOrCreateCustomerByName(typed);
      if (!saved.ok) {
        setError(saved.error);
        setSaving(false);
        return;
      }
      resolvedCustomer = saved.id ?? null;
      if (saved.id && saved.name) {
        setCustomerList((prev) =>
          prev.some((c) => c.id === saved.id)
            ? prev
            : [...prev, { id: saved.id!, name: saved.name! }],
        );
      }
    }

    for (const line of lines) {
      const bottle = bottles.find((b) => b.perfume_id === line.perfume_id);
      if (!bottle) {
        setError("Select a scent.");
        setSaving(false);
        return;
      }
      const need = Math.round(line.size_ml * line.quantity * 100) / 100;
      const onHand = Math.round(bottle.ml_on_hand * 100) / 100;
      if (need > onHand) {
        setError(
          `${bottle.label} has ${onHand} ml left, this line needs ${need} ml.`,
        );
        setSaving(false);
        return;
      }
      if ((Number(line.line_discount_mmk) || 0) > lineGross(line) + 0.001) {
        setError(`${bottle.label}: line discount cannot exceed the line price.`);
        setSaving(false);
        return;
      }
    }

    if ((Number(orderDiscount) || 0) > subtotal + 0.001) {
      setError("Order discount cannot exceed the subtotal.");
      setSaving(false);
      return;
    }

    const linePayload = lines.map((line) => ({
      perfume_id: line.perfume_id,
      size_ml: Math.round(line.size_ml * 100) / 100,
      quantity: line.quantity,
      unit_sale_price_mmk: line.unit_sale_price_mmk,
      line_discount_mmk: Number(line.line_discount_mmk) || 0,
      with_cap: line.with_cap && !line.full_bottle,
      cap_extra_mmk:
        line.with_cap && !line.full_bottle
          ? capExtraForSize(caps, line.size_ml)
          : 0,
    }));

    if (isEdit) {
      if (!saleId) {
        setError("Missing sale id.");
        setSaving(false);
        return;
      }
      const parsed = updateSaleOrderSchema.safeParse({
        sale_id: saleId,
        customer_id: resolvedCustomer,
        sale_date: saleDate,
        discount_mmk: Number(orderDiscount) || 0,
        notes: notes.trim() || null,
        lines: linePayload,
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Check the form");
        setSaving(false);
        return;
      }
      const result = await updateSale(parsed.data);
      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        return;
      }
      router.push(`/sales/orders/${saleId}`);
      router.refresh();
      return;
    }

    const parsed = createSaleOrderSchema.safeParse({
      customer_id: resolvedCustomer,
      sale_date: saleDate,
      discount_mmk: Number(orderDiscount) || 0,
      notes: notes.trim() || null,
      lines: linePayload,
      pay_now: payNow,
      payment_method: method,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the form");
      setSaving(false);
      return;
    }

    const result = await createSale(parsed.data);
    if (!result.ok) {
      setError(result.error);
      setSaving(false);
      return;
    }
    router.push(`/sales/orders/${result.id}`);
    router.refresh();
  }

  if (!bottles.length) {
    return (
      <p className="border border-[var(--stroke)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
        No bottle liquid on hand. Receive a purchase first, then sell from that
        bottle. You do not need to decant ahead of time.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 pb-28">
      <section className="border border-[var(--stroke)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <div className="relative space-y-1.5">
            <span className={labelClass}>Customer</span>
            <input
              className={fieldClass}
              placeholder="Type a name, or leave blank for walk-in"
              autoComplete="off"
              value={customerQuery}
              onChange={(e) => {
                setCustomerQuery(e.target.value);
                setCustomerId("");
                setOpenSuggest(true);
              }}
              onFocus={() => setOpenSuggest(true)}
              onBlur={() => {
                blurTimer.current = setTimeout(() => setOpenSuggest(false), 150);
              }}
            />
            {openSuggest && (suggestions.length > 0 || customerQuery.trim()) ? (
              <div className="absolute z-20 mt-1 w-full border border-[var(--stroke)] bg-[var(--surface)] shadow-[0_12px_28px_rgba(20,22,26,0.08)]">
                {suggestions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="block w-full px-3 py-2.5 text-left text-sm hover:bg-[var(--canvas)]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setCustomerId(c.id);
                      setCustomerQuery(c.name);
                      setOpenSuggest(false);
                    }}
                  >
                    {c.name}
                  </button>
                ))}
                {customerQuery.trim() &&
                !suggestions.some(
                  (c) =>
                    c.name.toLowerCase() === customerQuery.trim().toLowerCase(),
                ) ? (
                  <p className="border-t border-[var(--stroke)] px-3 py-2 text-xs text-[var(--muted)]">
                    New customer “{customerQuery.trim()}” is saved with the sale.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <label className="block space-y-1.5">
            <span className={labelClass}>Date</span>
            <input
              type="date"
              className={fieldClass}
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
            />
          </label>
        </div>
      </section>

      {bundles.length > 0 ? (
        <section className="border border-[var(--stroke)] bg-[var(--surface)] p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <span className={labelClass}>Bundle set</span>
              <select
                className={fieldClass}
                value={bundleId}
                onChange={(e) => setBundleId(e.target.value)}
              >
                {bundles.map((bundle) => (
                  <option key={bundle.id} value={bundle.id}>
                    {bundle.name} · {bundle.size_ml}ml × {bundle.items.length} ·{" "}
                    {formatMmk(bundle.sale_price_mmk)}
                  </option>
                ))}
              </select>
            </div>
            <label className="w-24 space-y-1.5">
              <span className={labelClass}>Sets</span>
              <input
                type="number"
                min="1"
                step="1"
                className={fieldClass}
                value={bundleQty}
                onChange={(e) =>
                  setBundleQty(
                    Math.max(1, Math.trunc(Number(e.target.value) || 1)),
                  )
                }
              />
            </label>
            <button
              type="button"
              className={btnSecondaryClass}
              onClick={applyBundle}
            >
              Add set
            </button>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            Lines · {lines.length}
          </h2>
          <p className="text-xs tabular-nums text-[var(--muted)]">
            {formatMl(totalMl)} ml poured
          </p>
        </div>

        <div className="space-y-3">
          {lines.map((line, index) => {
            const bottle = bottles.find((b) => b.perfume_id === line.perfume_id);
            const need = line.size_ml * (line.quantity || 0);
            const fullQuote = fullSizeQuoteFor(bottle, prices);
            const canSellFull = Boolean(
              bottle &&
                fullQuote &&
                fullQuote.sizeMl > 0 &&
                bottle.ml_on_hand + 0.01 >= fullQuote.sizeMl,
            );
            const capExtra =
              line.with_cap && !line.full_bottle
                ? capExtraForSize(caps, line.size_ml)
                : 0;
            const pack =
              bottle && !line.full_bottle && !line.sell_all
                ? packagingCostForSize(packaging, line.size_ml)
                : null;
            const cogs = bottle
              ? line.full_bottle
                ? (fullQuote?.cogs ?? 0)
                : line.sell_all
                  ? quoteCogs(bottle.cost_per_ml, line.size_ml, true) + capExtra
                  : pack == null
                    ? capExtra
                    : quoteCogs(bottle.cost_per_ml, line.size_ml, false, pack) +
                      capExtra
              : 0;
            const margin =
              !line.full_bottle && !line.sell_all && pack == null
                ? null
                : marginRate(line.unit_sale_price_mmk, cogs);
            const lineTotal = lineNet(line);
            const shortStock =
              Boolean(bottle) &&
              Math.round(need * 100) / 100 >
                Math.round((bottle?.ml_on_hand ?? 0) * 100) / 100;

            return (
              <article
                key={index}
                className="border border-[var(--stroke)] bg-[var(--surface)]"
              >
                <div className="flex flex-wrap items-center gap-2 border-b border-[var(--stroke)] px-4 py-3">
                  <span className="w-7 shrink-0 text-xs tabular-nums text-[var(--muted)]">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <select
                      className={`${fieldClass} border-0 bg-transparent px-0 py-1`}
                      value={line.perfume_id}
                      onChange={(e) => changeScent(index, e.target.value)}
                      aria-label={`Scent for line ${index + 1}`}
                    >
                      {bottles.map((b) => (
                        <option key={b.perfume_id} value={b.perfume_id}>
                          {b.label} · {b.ml_on_hand} ml
                        </option>
                      ))}
                    </select>
                    {line.from_bundle ? (
                      <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">
                        From {line.from_bundle}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-right text-sm font-medium tabular-nums">
                    {formatMmk(lineTotal)}
                  </p>
                  {lines.length > 1 ? (
                    <button
                      type="button"
                      className="text-sm text-[var(--danger)]"
                      onClick={() =>
                        setLines((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <div className="space-y-3 px-4 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {SALE_SIZES.map((size) => {
                      const active =
                        !line.sell_all &&
                        !line.full_bottle &&
                        line.size_ml === size;
                      const quote = priceFor(bottle, size, prices);
                      const tooBig = Boolean(bottle && size > bottle.ml_on_hand);
                      return (
                        <button
                          key={size}
                          type="button"
                          disabled={tooBig}
                          className={active ? chipActive : chipIdle}
                          onClick={() => changeSize(index, size)}
                        >
                          <span className="font-medium">{size}ml</span>
                          <span
                            className={`text-[11px] tabular-nums ${
                              active ? "text-white/80" : "text-[var(--muted)]"
                            }`}
                          >
                            {tooBig
                              ? "Short"
                              : quote > 0
                                ? formatMmk(quote)
                                : "—"}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {!line.full_bottle &&
                    capExtraForSize(caps, line.size_ml) > 0 ? (
                      <button
                        type="button"
                        className={line.with_cap ? chipActive : chipIdle}
                        onClick={() => toggleCap(index)}
                      >
                        <span className="font-medium">Cap</span>
                        <span
                          className={`text-[11px] tabular-nums ${
                            line.with_cap ? "text-white/80" : "text-[var(--muted)]"
                          }`}
                        >
                          +{formatMmk(capExtraForSize(caps, line.size_ml))}
                        </span>
                      </button>
                    ) : null}
                    {bottle && bottle.ml_on_hand > 0 ? (
                      <button
                        type="button"
                        className={line.sell_all ? chipActive : chipIdle}
                        onClick={() => sellAllLeft(index)}
                      >
                        <span className="font-medium">
                          All left · {formatMl(bottle.ml_on_hand)}ml
                        </span>
                        <span
                          className={`text-[11px] tabular-nums ${
                            line.sell_all ? "text-white/80" : "text-[var(--muted)]"
                          }`}
                        >
                          {formatMmk(
                            priceFor(bottle, bottle.ml_on_hand, prices),
                          ) || "Set price"}
                        </span>
                      </button>
                    ) : null}
                    {fullQuote ? (
                      <button
                        type="button"
                        disabled={!canSellFull}
                        className={line.full_bottle ? chipActive : chipIdle}
                        onClick={() => sellFullBottle(index)}
                      >
                        <span className="font-medium">
                          Full
                          {fullQuote.sizeMl > 0
                            ? ` · ${formatMl(fullQuote.sizeMl)}ml`
                            : ""}
                        </span>
                        <span
                          className={`text-[11px] tabular-nums ${
                            line.full_bottle
                              ? "text-white/80"
                              : "text-[var(--muted)]"
                          }`}
                        >
                          {canSellFull
                            ? formatMmk(fullQuote.price)
                            : "Opened"}
                        </span>
                      </button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:items-end">
                    <label className="block space-y-1.5">
                      <span className={labelClass}>Qty</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className={fieldClass}
                        disabled={line.sell_all || line.full_bottle}
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(index, {
                            quantity: Math.max(
                              1,
                              Math.trunc(Number(e.target.value) || 1),
                            ),
                          })
                        }
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className={labelClass}>Unit price</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className={fieldClass}
                        value={line.unit_sale_price_mmk || ""}
                        placeholder="Sell price"
                        onChange={(e) =>
                          updateLine(index, {
                            unit_sale_price_mmk: Number(e.target.value) || 0,
                            price_touched: true,
                          })
                        }
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className={labelClass}>Item discount</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className={fieldClass}
                        value={line.line_discount_mmk || ""}
                        placeholder="0"
                        onChange={(e) =>
                          updateLine(index, {
                            line_discount_mmk: Math.max(
                              0,
                              Number(e.target.value) || 0,
                            ),
                          })
                        }
                      />
                    </label>
                    <p className="col-span-2 text-xs tabular-nums text-[var(--muted)] sm:col-span-1 sm:pb-2.5">
                      {!line.full_bottle && !line.sell_all && pack == null
                        ? "No bottle cost"
                        : `Margin ${formatMargin(margin)}${
                            cogs > 0 ? ` · ${formatMmk(cogs)}` : ""
                          }`}
                      {line.line_discount_mmk > 0
                        ? ` · −${formatMmk(line.line_discount_mmk)}`
                        : ""}
                    </p>
                  </div>

                  <p
                    className={`text-xs ${
                      shortStock ? "text-[var(--danger)]" : "text-[var(--muted)]"
                    }`}
                  >
                    Uses {formatMl(need)} ml
                    {bottle ? ` of ${formatMl(bottle.ml_on_hand)} ml on hand` : ""}
                    {line.sell_all
                      ? " · leftover"
                      : line.full_bottle
                        ? " · full bottle"
                        : line.with_cap
                          ? " · with cap"
                          : ""}
                    .
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        <button
          type="button"
          className={btnSecondaryClass}
          onClick={() =>
            setLines((prev) => [...prev, blankLine(bottles, prices)])
          }
        >
          Add scent
        </button>
      </section>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <section className="border border-[var(--stroke)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className={labelClass}>Order discount</span>
            <input
              type="number"
              min="0"
              step="1"
              className={fieldClass}
              value={orderDiscount || ""}
              placeholder="0"
              onChange={(e) =>
                setOrderDiscount(Math.max(0, Number(e.target.value) || 0))
              }
            />
          </label>
          <label className="block space-y-1.5">
            <span className={labelClass}>Notes</span>
            <input
              className={fieldClass}
              value={notes}
              placeholder="Optional"
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-3 space-y-1 text-sm">
          <p className="flex justify-between gap-4 tabular-nums text-[var(--muted)]">
            <span>Lines</span>
            <span>{formatMmk(gross)}</span>
          </p>
          {lineDiscountTotal > 0 ? (
            <p className="flex justify-between gap-4 tabular-nums text-[var(--muted)]">
              <span>Item discounts</span>
              <span>−{formatMmk(lineDiscountTotal)}</span>
            </p>
          ) : null}
          <p className="flex justify-between gap-4 tabular-nums text-[var(--muted)]">
            <span>Subtotal</span>
            <span>{formatMmk(subtotal)}</span>
          </p>
          {orderDiscount > 0 ? (
            <p className="flex justify-between gap-4 tabular-nums text-[var(--muted)]">
              <span>Order discount</span>
              <span>−{formatMmk(orderDiscount)}</span>
            </p>
          ) : null}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--stroke)] bg-[var(--surface)]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
                Total
              </p>
              <p className="font-[family-name:var(--font-display)] text-2xl tabular-nums leading-none">
                {formatMmk(total)}
              </p>
            </div>
            {!isEdit ? (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={payNow}
                    onChange={(e) => setPayNow(e.target.checked)}
                  />
                  Paid now
                </label>
                {payNow ? (
                  <select
                    className={`${fieldClass} w-auto min-w-[9rem] py-2`}
                    value={method}
                    onChange={(e) => setMethod(e.target.value as typeof method)}
                    aria-label="Payment method"
                  >
                    {Object.entries(PAYMENT_METHOD_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                ) : (
                  <p className="text-xs text-[var(--muted)]">Unpaid / COD</p>
                )}
              </>
            ) : (
              <p className="text-xs text-[var(--muted)]">
                Payments stay as recorded. Balance updates after save.
              </p>
            )}
          </div>
          <button
            type="submit"
            className={`${btnPrimaryClass} w-full sm:w-auto`}
            disabled={saving}
          >
            {saving
              ? "Saving…"
              : isEdit
                ? "Save changes"
                : "Confirm order"}
          </button>
        </div>
      </div>
    </form>
  );
}
