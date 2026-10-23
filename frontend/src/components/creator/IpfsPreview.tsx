"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  X,
} from "lucide-react";
import {
  extractIpfsCid,
  getIpfsGatewayUrl,
  getPublicIpfsGatewayUrl,
  shortenIpfsCid,
} from "@/lib/ipfs";

interface ParsedFeedbackJson {
  feedbackText?: string;
  proofUrl?: string;
  sentiment?: number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

interface IpfsPreviewProps {
  cid: string;
  textPayload?: string | null;
  className?: string;
}

export default function IpfsPreview({
  cid,
  textPayload,
  className = "",
}: IpfsPreviewProps) {
  const cleanCid = extractIpfsCid(cid);
  const primaryUrl = getIpfsGatewayUrl(cleanCid);
  const fallbackUrl = getPublicIpfsGatewayUrl(cleanCid);

  const [copied, setCopied] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [mediaType, setMediaType] = useState<"image" | "json" | "document" | "unknown">("unknown");
  const [loading, setLoading] = useState(Boolean(cleanCid));
  const [jsonData, setJsonData] = useState<ParsedFeedbackJson | null>(null);
  const [proofImageError, setProofImageError] = useState(false);

  useEffect(() => {
    if (!cleanCid) return;

    let isMounted = true;
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 4000);

    const checkContent = async () => {
      try {
        const res = await fetch(primaryUrl, {
          signal: controller.signal,
          headers: { Accept: "application/json, image/*, */*" },
        });

        if (!isMounted) return;

        const contentType = res.headers.get("content-type") || "";

        if (contentType.includes("image/")) {
          setMediaType("image");
          setLoading(false);
          return;
        }

        if (contentType.includes("application/json") || contentType.includes("text/plain")) {
          const text = await res.text();
          if (!isMounted) return;
          try {
            const parsed = JSON.parse(text) as ParsedFeedbackJson;
            if (parsed && typeof parsed === "object") {
              setJsonData(parsed);
              setMediaType("json");
              setLoading(false);
              return;
            }
          } catch {
            // Not valid JSON, treated as document/text
          }
        }

        setMediaType("document");
      } catch {
        // If gateway fetch times out or fails with CORS, fallback to document preview with direct links
        if (isMounted) {
          setMediaType("document");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const runTimer = window.setTimeout(() => void checkContent(), 0);

    return () => {
      isMounted = false;
      clearTimeout(abortTimer);
      window.clearTimeout(runTimer);
      controller.abort();
    };
  }, [cleanCid, primaryUrl]);

  if (!cleanCid) return null;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(cleanCid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const resolvedProofUrl = jsonData?.proofUrl
    ? jsonData.proofUrl.startsWith("ipfs://")
      ? getIpfsGatewayUrl(jsonData.proofUrl)
      : jsonData.proofUrl
    : null;

  return (
    <>
      <div
        className={`brutal-border bg-card/80 p-3 text-foreground transition-colors hover:border-brutal-cyan ${className}`}
      >
        {/* IPFS Header / CID Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-foreground/20 pb-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded bg-brutal-cyan/20 px-2 py-0.5 text-[11px] font-mono font-bold uppercase tracking-wider text-brutal-cyan">
              <FileText className="size-3" />
              IPFS
            </span>
            <span
              className="font-mono text-xs text-foreground/80"
              title={cleanCid}
            >
              {shortenIpfsCid(cleanCid, 8)}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
              aria-label="Copy IPFS CID"
              title="Copy full CID"
            >
              {copied ? (
                <Check className="size-3.5 text-green-400" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={primaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded border border-foreground/30 px-2 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-white/10"
              title="Open artifact on Pinata IPFS Gateway"
            >
              <span>Gateway</span>
              <ExternalLink className="size-3" />
            </a>
            <a
              href={fallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground underline"
              title="Open artifact on ipfs.io backup gateway"
            >
              ipfs.io
            </a>
          </div>
        </div>

        {/* IPFS Preview Content */}
        <div className="mt-3">
          {loading ? (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Checking IPFS preview...</span>
            </div>
          ) : mediaType === "image" ? (
            <div className="space-y-2">
              <div
                className="group relative max-h-48 cursor-pointer overflow-hidden rounded border border-foreground/30 bg-black/40"
                onClick={() => setModalOpen(true)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={primaryUrl}
                  alt={`IPFS Proof ${shortenIpfsCid(cleanCid)}`}
                  className="h-full max-h-48 w-full object-contain transition-transform duration-200 group-hover:scale-105"
                  onError={() => setMediaType("document")}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-black/80 px-3 py-1 text-xs font-semibold text-white">
                    <Eye className="size-3.5" /> Full preview
                  </span>
                </div>
              </div>
            </div>
          ) : mediaType === "json" && jsonData ? (
            <div className="space-y-2 text-xs">
              {jsonData.feedbackText && !textPayload && (
                <div className="rounded bg-black/20 p-2 border border-foreground/10">
                  <span className="font-semibold text-muted-foreground block text-[10px] uppercase">
                    Feedback Details
                  </span>
                  <p className="mt-1 text-foreground whitespace-pre-wrap">
                    {jsonData.feedbackText}
                  </p>
                </div>
              )}

              {resolvedProofUrl && !proofImageError && (
                <div className="mt-2 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Proof Attachment
                  </span>
                  <div
                    className="group relative max-h-40 max-w-sm cursor-pointer overflow-hidden rounded border border-foreground/30 bg-black/40"
                    onClick={() => setModalOpen(true)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolvedProofUrl}
                      alt="Proof Attachment"
                      className="max-h-40 w-auto object-contain transition-transform group-hover:scale-105"
                      onError={() => setProofImageError(true)}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="inline-flex items-center gap-1 rounded bg-black/80 px-2 py-0.5 text-xs text-white">
                        <Eye className="size-3" /> View Proof
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {resolvedProofUrl && proofImageError && (
                <div className="flex items-center gap-2">
                  <a
                    href={resolvedProofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-brutal-cyan hover:underline"
                  >
                    <ExternalLink className="size-3" />
                    Open attached proof ({jsonData.proofUrl})
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between rounded border border-foreground/20 bg-background/50 px-3 py-2 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ImageIcon className="size-4 text-muted-foreground" />
                <span>IPFS Content Identifier</span>
              </div>
              <a
                href={primaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-brutal-pink hover:underline"
              >
                Inspect on Gateway <ExternalLink className="size-3" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Full-size preview modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="relative max-h-[90vh] max-w-3xl overflow-hidden brutal-border brutal-shadow bg-card p-4 text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between border-b border-foreground/20 pb-2">
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="font-bold uppercase text-brutal-cyan">IPFS Proof</span>
                <span>{shortenIpfsCid(cleanCid, 10)}</span>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded p-1 hover:bg-white/10"
                aria-label="Close preview"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex max-h-[70vh] items-center justify-center overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolvedProofUrl || primaryUrl}
                alt="Full size proof"
                className="h-auto max-h-[68vh] w-auto max-w-full object-contain"
              />
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-foreground/20 pt-2 text-xs">
              <span className="font-mono text-muted-foreground">{cleanCid}</span>
              <a
                href={resolvedProofUrl || primaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-brutal-cyan hover:underline"
              >
                Open in new tab <ExternalLink className="size-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
