/**
 * Helpers for IPFS content addressing, gateway resolution, and previews.
 */

export const DEFAULT_IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs";
export const FALLBACK_IPFS_GATEWAY = "https://ipfs.io/ipfs";

/**
 * Normalizes a raw CID or ipfs:// URI into a clean CID string.
 */
export function extractIpfsCid(value: string | null | undefined): string {
  if (!value) return "";
  let trimmed = value.trim();
  if (trimmed.startsWith("ipfs://")) {
    trimmed = trimmed.replace(/^ipfs:\/\//i, "");
  } else if (trimmed.startsWith("ipfs/")) {
    trimmed = trimmed.replace(/^ipfs\//i, "");
  }
  return trimmed;
}

/**
 * Builds an HTTP gateway URL for an IPFS CID or URI.
 */
export function getIpfsGatewayUrl(
  cidOrUri: string | null | undefined,
  gatewayBase?: string,
): string {
  const cid = extractIpfsCid(cidOrUri);
  if (!cid) return "";

  const base = (
    gatewayBase ||
    process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL ||
    DEFAULT_IPFS_GATEWAY
  ).replace(/\/+$/, "");

  return `${base}/${cid}`;
}

/**
 * Builds a fallback public IPFS gateway URL using ipfs.io.
 */
export function getPublicIpfsGatewayUrl(
  cidOrUri: string | null | undefined,
): string {
  return getIpfsGatewayUrl(cidOrUri, FALLBACK_IPFS_GATEWAY);
}

/**
 * Shortens a CID for compact display (e.g., QmX123...89ab).
 */
export function shortenIpfsCid(
  cidOrUri: string | null | undefined,
  chars = 6,
): string {
  const cid = extractIpfsCid(cidOrUri);
  if (!cid) return "";
  if (cid.length <= chars * 2 + 3) return cid;
  return `${cid.slice(0, chars)}…${cid.slice(-chars)}`;
}

/**
 * Checks whether a string conforms to CIDv0 or CIDv1 patterns.
 */
export function isValidIpfsCid(value: string | null | undefined): boolean {
  const cid = extractIpfsCid(value);
  if (!cid) return false;
  // CIDv0 (base58 starts with Qm, 46 chars) or CIDv1 (base32 starts with b, 50+ chars)
  return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})$/i.test(cid);
}
