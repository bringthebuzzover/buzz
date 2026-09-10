import { useEffect, useState } from "react";

function readMdUp(): boolean {
  if (typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(min-width: 768px)").matches;
}

/**
 * Tailwind `md` (768px). Reads `matchMedia` on the first client render so a
 * phone does not flash the desktop table. jsdom without `matchMedia` stays
 * desktop so existing Jest suites keep the table.
 */
export function useMdUp(): boolean {
  const [mdUp, setMdUp] = useState(readMdUp);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setMdUp(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return mdUp;
}
