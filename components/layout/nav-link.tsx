"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type NavLinkProps = ComponentProps<typeof Link>;

function PendingDot() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      className="absolute right-2 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-current opacity-80 lg:right-3"
      aria-hidden
    />
  );
}

export function NavLink({ className, children, ...props }: NavLinkProps) {
  return (
    <Link {...props} className={cn("relative", className)}>
      {children}
      <PendingDot />
    </Link>
  );
}
