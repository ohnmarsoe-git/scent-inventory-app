"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { primaryNav, type NavItem } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";

function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  if (
    href !== "/inventory" &&
    href !== "/purchasing" &&
    href !== "/sales" &&
    href !== "/expenses" &&
    href !== "/reports" &&
    pathname.startsWith(`${href}/`)
  ) {
    return true;
  }
  return false;
}

function isSectionActive(pathname: string, root: NavItem, children: NavItem[]) {
  if (pathname === root.href || pathname.startsWith(`${root.href}/`)) return true;
  return children.some(
    (child) =>
      pathname === child.href || pathname.startsWith(`${child.href}/`),
  );
}

type NavBlock =
  | { type: "link"; item: NavItem }
  | { type: "section"; root: NavItem; children: NavItem[] };

function buildNav(items: NavItem[]): NavBlock[] {
  const blocks: NavBlock[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    if (item.group) continue;

    const children: NavItem[] = [];
    for (let j = i + 1; j < items.length; j++) {
      const next = items[j]!;
      if (!next.group) break;
      if (next.group === item.label) children.push(next);
      else break;
    }

    if (children.length) blocks.push({ type: "section", root: item, children });
    else blocks.push({ type: "link", item });
  }
  return blocks;
}

export function Sidebar() {
  const pathname = usePathname();
  const blocks = buildNav(primaryNav);

  return (
    <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-[var(--stroke)] lg:bg-[var(--surface)]">
      <div className="border-b border-[var(--stroke)] px-5 py-6">
        <p className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--ink)]">
          Scent Syntax
        </p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Inventory &amp; Profit
        </p>
      </div>
      <nav className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        {blocks.map((block) => {
          if (block.type === "link") {
            const active = isNavActive(pathname, block.item.href);
            return (
              <Link
                key={block.item.href}
                href={block.item.href}
                className={cn(
                  "block rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "btn-nav-active"
                    : "text-[var(--ink)] hover:bg-[var(--surface-2)]",
                )}
              >
                {block.item.label}
              </Link>
            );
          }

          const sectionActive = isSectionActive(
            pathname,
            block.root,
            block.children,
          );

          return (
            <div key={block.root.href} className="space-y-0.5">
              <Link
                href={block.root.href}
                className={cn(
                  "block rounded-md px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors",
                  sectionActive
                    ? "text-[var(--accent)]"
                    : "text-[var(--muted)] hover:text-[var(--ink)]",
                )}
              >
                {block.root.label}
              </Link>
              {block.children.map((child) => {
                const active = isNavActive(pathname, child.href);
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      "block rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "btn-nav-active font-medium"
                        : "text-[var(--ink-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]",
                    )}
                  >
                    {child.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
