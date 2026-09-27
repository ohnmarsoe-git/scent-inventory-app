"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { ActionResult } from "@/lib/actions/result";
import { btnSecondaryClass } from "@/lib/ui";

type ArchiveToggleButtonProps = {
  id: string;
  active: boolean;
  action: (id: string, isActive: boolean) => Promise<ActionResult>;
};

export function ArchiveToggleButton({
  id,
  active,
  action,
}: ArchiveToggleButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={btnSecondaryClass}
      onClick={() => {
        startTransition(async () => {
          const result = await action(id, !active);
          if (!result.ok) {
            window.alert(result.error);
            return;
          }
          router.refresh();
        });
      }}
    >
      {pending ? "…" : active ? "Archive" : "Restore"}
    </button>
  );
}
