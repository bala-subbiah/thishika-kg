import { useState } from "react";
import { shortlistUrl } from "./useShortlist";

export default function ShareButton({ ids }: { ids: string[] }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = shortlistUrl(ids);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this shortlist link:", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button type="button" className="share-btn" onClick={copy}>
      {copied ? "Link copied ✓" : "Share shortlist"}
    </button>
  );
}
