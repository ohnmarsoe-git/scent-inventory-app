"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type NavMenuContextValue = {
  open: boolean;
  openMenu: () => void;
  closeMenu: () => void;
};

const NavMenuContext = createContext<NavMenuContextValue | null>(null);

export function NavMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openMenu = useCallback(() => setOpen(true), []);
  const closeMenu = useCallback(() => setOpen(false), []);
  const value = useMemo(
    () => ({ open, openMenu, closeMenu }),
    [open, openMenu, closeMenu],
  );

  return (
    <NavMenuContext.Provider value={value}>{children}</NavMenuContext.Provider>
  );
}

export function useNavMenu() {
  const ctx = useContext(NavMenuContext);
  if (!ctx) {
    throw new Error("useNavMenu must be used within NavMenuProvider");
  }
  return ctx;
}
