"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { ActionResult } from "@/lib/actions/result";
import { btnPrimaryClass, btnSecondaryClass } from "@/lib/ui";

type Props = {
  id: string;
  action: (id: string) => Promise<ActionResult>;
  label: string;
  confirmMessage?: string;
  variant?: "primary" | "secondary";
};

export function PoStatusButton({
  id,
  action,
  label,
  confirmMessage,
  variant = "secondary",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={variant === "primary" ? btnPrimaryClass : btnSecondaryClass}
      onClick={() => {
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        startTransition(async () => {
          const result = await action(id);
          if (!result.ok) {
            window.alert(result.error);
            return;
          }
          router.refresh();
        });
      }}
    >
      {pending ? "…" : label}
    </button>
  );
}
