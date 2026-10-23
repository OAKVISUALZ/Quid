import {
  ApiSessionExpiredError,
  apiFetch,
  getSession,
  hasApiSession,
  getStoredSession,
  clearStoredSession,
} from "@/lib/api/client";

/**
 * Issue #324: creator-facing API helper. The SEP-10 flow, token store and
 * 401 handling now live in src/lib/api/client.ts; this module is a thin
 * compatibility layer keeping the existing caller surface:
 *   - isApiConfigured() / hasApiSession() (used by user-api and onboarding)
 *   - creatorApiFetch(path, address, init) with lazy registration for the
 *     first authenticated call.
 */

export { hasApiSession };
export { ApiSessionExpiredError };

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
 * Issue #329: Types and helpers for saving, resuming, and publishing mission drafts.
 */

export interface MissionDraftDto {
  title: string;
  data: unknown;
}

export interface MissionDraft {
  id: string;
  ownerAddress: string;
  title: string;
  data: unknown;
  publishedAt: string | null;
  publishedMissionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublishDraftPayload {
  onChainId: string;
  descriptionCid: string;
  metadataCid?: string;
  metadata?: Record<string, unknown>;
  rewardToken: string;
  rewardAmount: string;
  maxParticipants: number;
  aiSummary?: string;
}

/**
 * Saves or updates a mission draft under the authenticated user (JWT) via POST /missions/drafts.
 */
export async function saveMissionDraft(
  dto: MissionDraftDto,
  address: string,
): Promise<MissionDraft> {
  const response = await creatorApiFetch("/missions/drafts", address, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dto),
  });

  if (!response.ok) {
    throw new Error(`Failed to save draft (${response.status})`);
  }

  return (await response.json()) as MissionDraft;
}

/**
 * Fetches the most recent unpublished draft for the authenticated user via GET /missions/drafts/me.
 * Returns null if no active draft is found (404).
 */
export async function fetchLatestMissionDraft(
  address: string,
): Promise<MissionDraft | null> {
  const response = await creatorApiFetch("/missions/drafts/me", address);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load draft (${response.status})`);
  }

  return (await response.json()) as MissionDraft;
}

/**
 * Publishes an owned draft via POST /missions/drafts/:draftId/publish after on-chain creation.
 */
export async function publishMissionDraft(
  draftId: string,
  payload: PublishDraftPayload,
  address: string,
): Promise<{ id: string; [key: string]: unknown }> {
  const response = await creatorApiFetch(
    `/missions/drafts/${draftId}/publish`,
    address,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to publish draft (${response.status})`);
  }

  return (await response.json()) as { id: string; [key: string]: unknown };
}
