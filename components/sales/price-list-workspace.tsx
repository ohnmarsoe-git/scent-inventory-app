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
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link
          href="/sales/price-list"
          className={tab === "decant" ? btnPrimaryClass : btnSecondaryClass}
          aria-current={tab === "decant" ? "page" : undefined}
        >
          Decant sizes
        </Link>
        <Link
          href="/sales/price-list?tab=full"
          className={tab === "full" ? btnPrimaryClass : btnSecondaryClass}
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
