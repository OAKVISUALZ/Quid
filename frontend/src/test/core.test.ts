import { describe, expect, it } from "vitest";
import {
  isKnownContract,
  PLACEHOLDER_CONTRACT_ID,
} from "@/lib/contract-allowlist";
import { getMissionVisibility, isIndexableMission } from "@/lib/missions-api";
import { rewardCalculations } from "@/components/creator/quests/wizard/types";

const VALID_CONTRACT_ID = `CB${"A".repeat(54)}`;

function mission(visibility: string) {
  return {
    id: "mission-1",
    title: "Public mission",
    metadata: { visibility },
    rewardToken: "XLM",
    rewardAmount: "10",
    maxParticipants: 10,
    participantsCount: 0,
    status: "OPEN" as const,
    aiSummary: "",
    onChainId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("contract allowlist", () => {
  it("rejects placeholder contract ids", () => {
    expect(isKnownContract(PLACEHOLDER_CONTRACT_ID)).toBe(false);
  });

  it("accepts configured contract ids", () => {
    expect(isKnownContract(VALID_CONTRACT_ID)).toBe(true);
  });
});

describe("mission visibility", () => {
  it("keeps public missions indexable", () => {
    expect(getMissionVisibility(mission("public"))).toBe("public");
    expect(isIndexableMission(mission("public"))).toBe(true);
  });

  it("excludes private and unlisted missions", () => {
    expect(isIndexableMission(mission("private"))).toBe(false);
    expect(isIndexableMission(mission("unlisted"))).toBe(false);
  });
});

describe("reward calculations", () => {
  it("computes fees and per-winner rewards", () => {
    const result = rewardCalculations({
      rewardMethod: "Selected winners",
      totalRewardBudget: 100,
      numberOfWinners: 10,
    });
    expect(result.platformFee).toBeCloseTo(0.375);
    expect(result.rewardPerWinner).toBe(10);
    expect(result.totalRequired).toBeCloseTo(100.475);
  });
});
