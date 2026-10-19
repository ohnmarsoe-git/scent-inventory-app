"use client";

import { NavLink } from "@/components/layout/nav-link";
import { primaryNav, type NavItem } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";

export function isNavActive(pathname: string, href: string) {
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

export type NavBlock =
  | { type: "link"; item: NavItem }
  | { type: "section"; root: NavItem; children: NavItem[] };

export function buildNav(items: NavItem[] = primaryNav): NavBlock[] {
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

type NavTreeProps = {
  pathname: string;
  onNavigate?: () => void;
  className?: string;
};

export function NavTree({ pathname, onNavigate, className }: NavTreeProps) {
  const blocks = buildNav();

  return (
    <nav className={cn("flex flex-col gap-3", className)}>
      {blocks.map((block) => {
        if (block.type === "link") {
          const active = isNavActive(pathname, block.item.href);
          return (
            <NavLink
              key={block.item.href}
              href={block.item.href}
              prefetch
              onClick={onNavigate}
              className={cn(
                "block rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "btn-nav-active"
                  : "text-[var(--ink)] hover:bg-[var(--surface-2)]",
              )}
            >
              {block.item.label}
            </NavLink>
          );
        }

        const sectionActive = isSectionActive(
          pathname,
          block.root,
          block.children,
        );

        return (
          <div key={block.root.href} className="space-y-0.5">
            <NavLink
              href={block.root.href}
              prefetch
              onClick={onNavigate}
              className={cn(
                "block rounded-md px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] transition-colors",
                sectionActive
                  ? "text-[var(--accent)]"
                  : "text-[var(--muted)] hover:text-[var(--ink)]",
              )}
            >
              {block.root.label}
            </NavLink>
            {block.children.map((child) => {
              const active = isNavActive(pathname, child.href);
              return (
                <NavLink
                  key={child.href}
                  href={child.href}
                  prefetch
                  onClick={onNavigate}
                  className={cn(
                    "block rounded-md px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "btn-nav-active font-medium"
                      : "text-[var(--ink-soft)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]",
                  )}
                >
                  {child.label}
                </NavLink>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
