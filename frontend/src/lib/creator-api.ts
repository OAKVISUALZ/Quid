import {
  ApiSessionExpiredError,
  apiFetch,
  getSession,
  hasApiSession,
  getStoredSession,
  clearStoredSession,
} from "@/lib/api/client";

/**
 * Issue #324 / #328: creator-facing API helper.
 * The SEP-10 flow, token store and 401 handling live in src/lib/api/client.ts;
 * this module provides typed creator helpers for missions and submission reviews.
 */

export { hasApiSession };
export { ApiSessionExpiredError };

export class CreatorApiForbiddenError extends Error {
  constructor(
    message = "You are not authorized to view submissions for this mission",
  ) {
    super(message);
    this.name = "CreatorApiForbiddenError";
  }
}

export interface CreatorSubmissionHunter {
  address: string;
  displayName: string | null;
}

export interface CreatorSubmission {
  id: string;
  missionId: string;
  hunterAddress: string;
  ipfsCid: string;
  textPayload: string | null;
  sentiment: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID";
  rejectionReason: string | null;
  txHash: string | null;
  chainConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
  hunter?: CreatorSubmissionHunter;
}

export function isApiConfigured(): boolean {
  // Explicit localhost URL pointing at a dead port should still allow fallback.
  if (process.env.NEXT_PUBLIC_API_URL) return true;
  if (typeof window !== "undefined") return true;
  return false;
}

export async function creatorApiFetch(
  path: string,
  address: string,
  init: RequestInit = {},
): Promise<Response> {
  // Lazy registration: the first authenticated call silently signs in so
  // callers do not have to think about the wallet challenge.
  if (!getStoredSession(address)) {
    await getSession(address);
  }

  return apiFetch(path, { address, init });
}

/** Issue #331: drop the token for a wallet without a full disconnect. */
export function clearApiSession(address: string): void {
  clearStoredSession(address);
}

/**
 * Issue #328: Fetches submissions for a creator's mission (owner-gated).
 * Throws CreatorApiForbiddenError on 403.
 */
export async function fetchMissionSubmissions(
  missionId: string,
  ownerAddress: string,
): Promise<CreatorSubmission[]> {
  const response = await creatorApiFetch(
    `/missions/${missionId}/submissions`,
    ownerAddress,
  );
  if (!response.ok) {
    if (response.status === 403) {
      throw new CreatorApiForbiddenError();
    }
    throw new Error(`Unable to load submissions (${response.status})`);
  }
  return (await response.json()) as CreatorSubmission[];
}

/**
 * Approves a submission via backend API.
 */
export async function approveSubmissionApi(
  missionId: string,
  submissionId: string,
  ownerAddress: string,
): Promise<unknown> {
  const response = await creatorApiFetch(
    `/missions/${missionId}/submissions/${submissionId}/approve`,
    ownerAddress,
    { method: "POST" },
  );
  if (!response.ok) {
    if (response.status === 403) {
      throw new CreatorApiForbiddenError(
        "You are not authorized to approve submissions for this mission",
      );
    }
    throw new Error(`Failed to approve submission (${response.status})`);
  }
  return response.json();
}

/**
 * Rejects a submission via backend API with an optional reason.
 */
export async function rejectSubmissionApi(
  missionId: string,
  submissionId: string,
  ownerAddress: string,
  reason?: string,
): Promise<unknown> {
  const response = await creatorApiFetch(
    `/missions/${missionId}/submissions/${submissionId}/reject`,
    ownerAddress,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
  if (!response.ok) {
    if (response.status === 403) {
      throw new CreatorApiForbiddenError(
        "You are not authorized to reject submissions for this mission",
      );
    }
    throw new Error(`Failed to reject submission (${response.status})`);
  }
  return response.json();
}
