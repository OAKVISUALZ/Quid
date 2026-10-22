'use client';
import { useState, useEffect } from "react";

export type SubmissionStatus = "pending" | "approved" | "rejected";
/** Issue #322: `paused` blocks new submissions without touching escrow. */
export type QuestStatus = "active" | "paused" | "completed" | "cancelled" | "draft";

export type Quest = {
  id: string;
  title: string;
  description: string;
  reward: number;
  slots: number;
  deadline: Date;
  status: QuestStatus;
  /**
   * On-chain mission id on `quid-store` (u64) used for `payout_participant`.
   * Kept separate from the off-chain `id`, which is a UUID.
   */
  missionId?: number;
  /** Stellar address of the founder — the only account allowed to pay out. */
  ownerAddress?: string;
};

export type Submission = {
  id: string;
  user: string;
  content: string;
  status: SubmissionStatus;
  date: Date;
  /** Stellar address of the hunter, required to pay this submission. */
  hunterAddress?: string;
};

export function useQuestData(questId: string) {
  const [quest, setQuest] = useState<Quest | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Replace with actual data fetching logic
    async function fetchQuestData() {
      setLoading(true);
      // Example: fetch quest and submissions from an API
      // const questRes = await fetch(`/api/quests/${questId}`);
      // const questData = await questRes.json();
      // setQuest(questData);
      // const submissionsRes = await fetch(`/api/quests/${questId}/submissions`);
      // const submissionsData = await submissionsRes.json();
      // setSubmissions(submissionsData);
      
      setQuest({
        id: questId,
        title: "Download and test the latest Ruze.stellar 2.0",
        description: "Test the new features of Ruze.stellar 2.0 and provide detailed feedback. Complete all test scenarios and submit your findings.",
        reward: 640,
        slots: 24,
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
        status: "active",
        // Placeholders until the real data source lands; without these the
        // payout flow has no contract id / participant to act on.
        missionId: 1,
        ownerAddress: "GFOUNDEREXAMPLEADDRESS00000000000000000000000000",
      });

      setSubmissions([
        {
          id: "1",
          user: "User1",
          content: "Great product! Easy to use.",
          status: "pending",
          date: new Date(),
          hunterAddress: "GHUNTEREXAMPLEADDRESS0000000000000000000000000",
        },
      ]);
      setLoading(false);
    }
    fetchQuestData();
  }, [questId]);

  return { quest, submissions, loading };
}
