"use client";

import Link from "next/link";

import { FullSizePriceList, type FullSizePerfume } from "@/components/sales/full-size-price-list";
import {
  PriceListEditor,
  type PriceListPerfume,
} from "@/components/sales/price-list-editor";
import type { PriceListSize, ToolChoice } from "@/lib/domain/pricing";
import { btnPrimaryClass, btnSecondaryClass } from "@/lib/ui";

type PriceListWorkspaceProps = {
  tab: "decant" | "full";
  perfumes: PriceListPerfume[];
  fullSizePerfumes: FullSizePerfume[];
  initialPrices: Record<string, number>;
  tools: ToolChoice[];
  initialToolIds: string[];
  initialBottles: Partial<Record<PriceListSize, number>>;
  stockBottles: Partial<Record<PriceListSize, number>>;
};

export function PriceListWorkspace({
  tab,
  perfumes,
  fullSizePerfumes,
  initialPrices,
  tools,
  initialToolIds,
  initialBottles,
  stockBottles,
}: PriceListWorkspaceProps) {
  return (
    <div className="space-y-4">
      <div className="flex overflow-hidden border border-[var(--stroke)] self-start w-fit">
        <Link
          href="/sales/price-list"
          className={
            tab === "decant"
              ? `${btnPrimaryClass} rounded-none`
              : `${btnSecondaryClass} rounded-none border-0`
          }
          aria-current={tab === "decant" ? "page" : undefined}
        >
          Decant
        </Link>
        <Link
          href="/sales/price-list?tab=full"
          className={
            tab === "full"
              ? `${btnPrimaryClass} rounded-none`
              : `${btnSecondaryClass} rounded-none border-0 border-l border-[var(--stroke)]`
          }
          aria-current={tab === "full" ? "page" : undefined}
        >
          Full size
        </Link>
      </div>

      {tab === "full" ? (
        <FullSizePriceList
          perfumes={fullSizePerfumes}
          initialPrices={initialPrices}
        />
      ) : (
        <PriceListEditor
          perfumes={perfumes}
          initialPrices={initialPrices}
          tools={tools}
          initialToolIds={initialToolIds}
          initialBottles={initialBottles}
          stockBottles={stockBottles}
        />
      )}
    </div>
  );
}
