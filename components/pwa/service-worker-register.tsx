"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        // Pull the v3 worker promptly so iPads drop the old HTML-caching SW.
        void registration.update();
      })
      .catch(() => {
        /* ignore registration failures in unsupported contexts */
      });
  }, []);

  return null;
}
