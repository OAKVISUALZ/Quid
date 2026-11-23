"use client";

import { useEffect, useState } from "react";

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

function isValidCid(value: string): boolean {
  return /^[A-Za-z0-9]+$/.test(value);
}

function formatPreview(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const text = [record.feedbackText, record.text, record.feedback, record.content]
      .find((part): part is string => typeof part === "string" && part.trim().length > 0);
    return text ?? JSON.stringify(value, null, 2);
  }
  return String(value ?? "");
}

export default function IpfsSubmissionPreview({
  cid,
  textPayload,
}: {
  cid?: string;
  textPayload?: string;
}) {
  const [preview, setPreview] = useState(textPayload ?? "");
  const [loading, setLoading] = useState(false);
  const validCid = Boolean(cid && isValidCid(cid));
  const gatewayUrl = validCid ? `${IPFS_GATEWAY}${cid}` : null;

  useEffect(() => {
    if (textPayload || !gatewayUrl) return;
    const controller = new AbortController();
    setLoading(true);

    void fetch(gatewayUrl, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("IPFS preview unavailable");
        const body = await response.text();
        if (body.length > 150_000) throw new Error("Preview is too large to display");
        try {
          return formatPreview(JSON.parse(body));
        } catch {
          return body;
        }
      })
      .then((body) => setPreview(body))
      .catch(() => {
        if (!controller.signal.aborted) setPreview("");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [gatewayUrl, textPayload]);

  return (
    <div className="mt-2 rounded-md border border-white/10 bg-black/20 p-3">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Submission preview</p>
      {preview ? (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-sans text-sm text-foreground">{preview}</pre>
      ) : (
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading IPFS preview…" : "No text preview is available."}
        </p>
      )}
      {gatewayUrl ? (
        <a href={gatewayUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-brutal-cyan underline">
          View original on IPFS · {cid}
        </a>
      ) : cid ? (
        <p className="mt-2 break-all text-xs text-muted-foreground">IPFS CID: {cid}</p>
      ) : null}
    </div>
  );
}
