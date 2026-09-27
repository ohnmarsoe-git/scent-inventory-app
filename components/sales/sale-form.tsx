"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { findOrCreateCustomerByName } from "@/lib/actions/customers";
import { createSale } from "@/lib/actions/sales";
import { SALE_SIZES, resolveSellPrice, fullBottleQuote, quoteCogs, marginRate, formatMargin, packagingCostForSize, capExtraForSize, type CapExtras, type PackagingCosts } from "@/lib/domain/pricing";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  fieldClass,
  formatMmk,
  labelClass,
} from "@/lib/ui";
import {
  createSaleOrderSchema,
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

type SaleFormProps = {
  customers: CustomerOption[];
  bottles: BottleOption[];
  /** key: perfumeId:sizeMl */
  prices: Record<string, number>;
  packaging: PackagingCosts;
  caps: CapExtras;
};

type Line = {
  perfume_id: string;
  size_ml: number;
  quantity: number;
  unit_sale_price_mmk: number;
  price_touched: boolean;
  sell_all: boolean;
  full_bottle: boolean;
  with_cap: boolean;
};

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
    price_touched: false,
    sell_all: sellAll,
    full_bottle: false,
    with_cap: false,
  };
}

export function SaleForm({ customers, bottles, prices, packaging, caps }: SaleFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [customerList, setCustomerList] = useState(customers);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [openSuggest, setOpenSuggest] = useState(false);
  const [payNow, setPayNow] = useState(true);
  const [method, setMethod] = useState<
    "cash" | "bank_transfer" | "mobile_wallet" | "card" | "other"
  >("mobile_wallet");
  const [lines, setLines] = useState<Line[]>(() => [
    blankLine(bottles, prices),
  ]);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const suggestions = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    const list = q
      ? customerList.filter((c) => c.name.toLowerCase().includes(q))
      : customerList;
    return list.slice(0, 6);
  }, [customerQuery, customerList]);

  const total = lines.reduce(
    (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unit_sale_price_mmk) || 0),
    0,
  );

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function changeScent(index: number, perfumeId: string) {
    const bottle = bottles.find((b) => b.perfume_id === perfumeId);
    const line = lines[index];
    const sellAll = Boolean(line?.sell_all);
    const full = Boolean(line?.full_bottle) && !sellAll;
    const fullQuote = bottle
      ? fullBottleQuote({
          label: bottle.label,
          costPerMl: bottle.cost_per_ml,
          bottleSizeMl: bottle.bottle_size_ml,
        })
      : null;
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
    const quote = fullBottleQuote({
      label: bottle.label,
      costPerMl: bottle.cost_per_ml,
      bottleSizeMl: bottle.bottle_size_ml,
    });
    if (quote.sizeMl <= 0 || bottle.ml_on_hand + 0.01 < quote.sizeMl) return;
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
    }

    const parsed = createSaleOrderSchema.safeParse({
      customer_id: resolvedCustomer,
      sale_date: todayIso(),
      lines: lines.map((line) => ({
        perfume_id: line.perfume_id,
        size_ml: Math.round(line.size_ml * 100) / 100,
        quantity: line.quantity,
        unit_sale_price_mmk: line.unit_sale_price_mmk,
        with_cap: line.with_cap && !line.full_bottle,
        cap_extra_mmk:
          line.with_cap && !line.full_bottle
            ? capExtraForSize(caps, line.size_ml)
            : 0,
      })),
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
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="relative space-y-1.5">
        <span className={labelClass}>Customer</span>
        <input
          className={fieldClass}
          placeholder="Type a name, or leave blank"
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
          <div className="absolute z-20 mt-1 w-full border border-[var(--stroke)] bg-[var(--surface)]">
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
              (c) => c.name.toLowerCase() === customerQuery.trim().toLowerCase(),
            ) ? (
              <p className="border-t border-[var(--stroke)] px-3 py-2 text-xs text-[var(--muted)]">
                New customer “{customerQuery.trim()}” is saved with the sale.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {lines.map((line, index) => {
        const bottle = bottles.find((b) => b.perfume_id === line.perfume_id);
        const need = line.size_ml * (line.quantity || 0);
        const fullQuote = bottle
          ? fullBottleQuote({
              label: bottle.label,
              costPerMl: bottle.cost_per_ml,
              bottleSizeMl: bottle.bottle_size_ml,
            })
          : null;
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
        return (
          <section
            key={index}
            className="space-y-4 border border-[var(--stroke)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {lines.length > 1 ? `Item ${index + 1}` : "Order"}
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

            <label className="block space-y-1.5">
              <span className={labelClass}>Scent</span>
              <select
                className={fieldClass}
                value={line.perfume_id}
                onChange={(e) => changeScent(index, e.target.value)}
              >
                {bottles.map((b) => (
                  <option key={b.perfume_id} value={b.perfume_id}>
                    {b.label} · {b.ml_on_hand} ml
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-1.5">
              <span className={labelClass}>Size and price</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SALE_SIZES.map((size) => {
                  const active = !line.sell_all && !line.full_bottle && line.size_ml === size;
                  const quote = priceFor(bottle, size, prices);
                  const tooBig = Boolean(bottle && size > bottle.ml_on_hand);
                  const pack = packagingCostForSize(packaging, size);
                  const margin =
                    bottle && quote > 0 && bottle.cost_per_ml > 0
                      ? pack == null
                        ? "No bottle cost"
                        : formatMargin(
                            marginRate(
                              quote,
                              quoteCogs(bottle.cost_per_ml, size, false, pack),
                            ),
                          )
                      : "";
                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={tooBig}
                      className={
                        active
                          ? "btn-primary w-full flex-col gap-0.5 px-2 py-2"
                          : "btn-secondary w-full flex-col gap-0.5 px-2 py-2"
                      }
                      style={{ flexDirection: "column", width: "100%" }}
                      onClick={() => changeSize(index, size)}
                    >
                      <span>{size}ml</span>
                      <span className="text-xs font-normal tabular-nums">
                        {tooBig
                          ? "Not enough"
                          : quote > 0
                            ? `${formatMmk(quote)}${margin ? ` · ${margin}` : ""}`
                            : "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {!line.full_bottle ? (
                <button
                  type="button"
                  disabled={capExtraForSize(caps, line.size_ml) <= 0}
                  className={
                    line.with_cap
                      ? "btn-primary mt-2 w-full flex-col gap-0.5 px-2 py-2"
                      : "btn-secondary mt-2 w-full flex-col gap-0.5 px-2 py-2"
                  }
                  style={{ flexDirection: "column", width: "100%" }}
                  onClick={() => toggleCap(index)}
                >
                  <span>Cap bottle</span>
                  <span className="text-xs font-normal tabular-nums">
                    {capExtraForSize(caps, line.size_ml) > 0
                      ? `+ ${formatMmk(capExtraForSize(caps, line.size_ml))}`
                      : "No cap cost for this size"}
                  </span>
                </button>
              ) : null}
              {bottle && bottle.ml_on_hand > 0 ? (
                <button
                  type="button"
                  className={
                    line.sell_all
                      ? "btn-primary mt-2 w-full flex-col gap-0.5 px-2 py-2"
                      : "btn-secondary mt-2 w-full flex-col gap-0.5 px-2 py-2"
                  }
                  style={{ flexDirection: "column", width: "100%" }}
                  onClick={() => sellAllLeft(index)}
                >
                  <span>All left · {formatMl(bottle.ml_on_hand)}ml</span>
                  <span className="text-xs font-normal tabular-nums">
                    {formatMmk(priceFor(bottle, bottle.ml_on_hand, prices)) || "Set price"}
                  </span>
                </button>
              ) : null}
              {fullQuote ? (
                <button
                  type="button"
                  disabled={!canSellFull}
                  className={
                    line.full_bottle
                      ? "btn-primary mt-2 w-full flex-col gap-0.5 px-2 py-2"
                      : "btn-secondary mt-2 w-full flex-col gap-0.5 px-2 py-2"
                  }
                  style={{ flexDirection: "column", width: "100%" }}
                  onClick={() => sellFullBottle(index)}
                >
                  <span>
                    Full bottle
                    {fullQuote.sizeMl > 0 ? ` · ${formatMl(fullQuote.sizeMl)}ml` : ""}
                  </span>
                  <span className="text-xs font-normal tabular-nums">
                    {canSellFull
                      ? `${formatMmk(fullQuote.price)} · ${formatMargin(fullQuote.margin)}`
                      : "Opened — not a full bottle"}
                  </span>
                </button>
              ) : null}
            </div>

            <div className="border border-[var(--stroke)] bg-[var(--canvas)] px-3 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                Sell price
              </p>
              <p className="mt-1 text-2xl font-medium tabular-nums">
                {line.unit_sale_price_mmk > 0
                  ? formatMmk(line.unit_sale_price_mmk)
                  : "—"}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {line.full_bottle
                  ? `Full bottle ${formatMl(line.size_ml)}ml.`
                  : line.sell_all
                    ? `All ${formatMl(line.size_ml)}ml left.`
                    : `${formatMl(line.size_ml)}ml`}
                {line.quantity > 1
                  ? ` × ${line.quantity} = ${formatMmk(
                      line.unit_sale_price_mmk * line.quantity,
                    )}`
                  : ""}
              </p>
              <p className="mt-1 text-sm tabular-nums">
                {!line.full_bottle && !line.sell_all && pack == null
                  ? "No bottle cost"
                  : `Margin ${formatMargin(margin)}${
                      cogs > 0 ? ` · cost ${formatMmk(cogs)}` : ""
                    }`}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {line.full_bottle
                  ? fullQuote?.fromSheet
                    ? "Full-bottle market price. Margin is sell price against the perfume in the bottle."
                    : "Not on the full-bottle list. Suggested at 35% margin, rounded to 1,000."
                  : line.sell_all
                    ? "Leftover price is scaled between the nearest market sizes. Margin uses liquid cost only."
                    : line.with_cap
                      ? "Market price plus the cap-bottle extra from Consumables."
                      : "Margin uses perfume, the current bottle cost, and other consumables. It changes when you buy more."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                      quantity: Math.max(1, Math.trunc(Number(e.target.value) || 1)),
                    })
                  }
                />
              </label>
              <label className="block space-y-1.5">
                <span className={labelClass}>Change price</span>
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
            </div>
            <p className="text-xs text-[var(--muted)]">
              Uses {need} ml
              {bottle ? ` of ${bottle.ml_on_hand} ml` : ""}.{" "}
              {line.unit_sale_price_mmk > 0
                ? "Price is filled from the market list. Edit it only for this order."
                : "No market price for this size yet."}
            </p>
          </section>
        );
      })}

      <button
        type="button"
        className={btnSecondaryClass}
        onClick={() => setLines((prev) => [...prev, blankLine(bottles, prices)])}
      >
        Add another scent
      </button>

      <section className="space-y-3 border border-[var(--stroke)] bg-[var(--surface)] p-4">
        <p className="flex justify-between text-sm">
          <span className="text-[var(--muted)]">Total</span>
          <span className="font-medium tabular-nums">{formatMmk(total)}</span>
        </p>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={payNow}
            onChange={(e) => setPayNow(e.target.checked)}
          />
          Paid now
        </label>
        {payNow ? (
          <label className="block space-y-1.5">
            <span className={labelClass}>How</span>
            <select
              className={fieldClass}
              value={method}
              onChange={(e) =>
                setMethod(e.target.value as typeof method)
              }
            >
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-xs text-[var(--muted)]">
            Left unpaid (COD or pay later). Record the payment on the sale when
            it arrives.
          </p>
        )}
      </section>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className={btnPrimaryClass} disabled={saving}>
        {saving ? "Saving…" : "Confirm order"}
      </button>
    </form>
  );
}
