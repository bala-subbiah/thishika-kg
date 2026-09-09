import { useCallback, useEffect, useState } from "react";

const KEY = "kg-shortlist";

function load(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function parseImport(): string[] {
  const p = new URLSearchParams(window.location.search).get("shortlist");
  return p ? p.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

function clearImportParam() {
  const u = new URL(window.location.href);
  u.searchParams.delete("shortlist");
  history.replaceState(null, "", u);
}

/** Device-local shortlist, transferable/shareable via ?shortlist=id1,id2 */
export function useShortlist() {
  const [ids, setIds] = useState<string[]>(load);
  const [importIds, setImportIds] = useState<string[]>(parseImport);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      /* private mode etc. — shortlist just won't persist */
    }
  }, [ids]);

  const toggle = useCallback((id: string) => {
    setIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }, []);

  const acceptImport = useCallback(() => {
    setIds((cur) => [...new Set([...cur, ...importIds])]);
    setImportIds([]);
    clearImportParam();
  }, [importIds]);

  const dismissImport = useCallback(() => {
    setImportIds([]);
    clearImportParam();
  }, []);

  return { ids, toggle, importIds, acceptImport, dismissImport };
}

export function shortlistUrl(ids: string[]): string {
  return `${location.origin}${location.pathname}?shortlist=${ids.join(",")}`;
}
