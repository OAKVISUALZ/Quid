import { getApiBaseUrl } from "@/lib/api-base";

/**
 * Issue #326: public (unauthenticated) `GET /missions` list client, shared by
 * the hunter mission board and the `/missions` route.
 */

export type MissionApiStatus = "OPEN" | "STARTED" | "PAUSED" | "COMPLETED" | "CANCELLED";

export interface PublicMission {
  id: string;
  title: string;
  metadata: unknown;
  rewardToken: string;
  rewardAmount: string;
  maxParticipants: number;
  participantsCount: number;
  status: MissionApiStatus;
  aiSummary: string;
  onChainId: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: { address: string; displayName: string | null };
  _count?: { submissions?: number };
}

export interface ListMissionsParams {
  status?: MissionApiStatus;
  sort?: "newest" | "oldest";
  limit?: number;
}

export async function fetchPublicMissions(
  params: ListMissionsParams = {},
): Promise<PublicMission[]> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.sort) query.set("sort", params.sort);
  if (params.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  const response = await fetch(`${getApiBaseUrl()}/missions${qs ? `?${qs}` : ""}`);

  if (!response.ok) {
    throw new Error(`Unable to load missions (${response.status})`);
  }

  return (await response.json()) as PublicMission[];
}
