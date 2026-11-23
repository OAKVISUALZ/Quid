"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useWallet } from "@/context/WalletProvider";
import { creatorApiFetch } from "@/lib/creator-api";
import IpfsSubmissionPreview from "@/features/creators/IpfsSubmissionPreview";

type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAID";

interface Mission {
  id: string;
  title: string;
  _count?: { submissions?: number };
}

interface Submission {
  id: string;
  hunterAddress: string;
  textPayload: string | null;
  ipfsCid: string;
  status: SubmissionStatus;
  createdAt: string;
  hunter?: { address: string; displayName: string | null };
}

interface QueueEntry {
  mission: Mission;
  submission: Submission;
}

function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 5)}…${address.slice(-5)}` : address;
}

export default function CreatorResponsesPage() {
  const { publicKey } = useWallet();
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadResponses = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    setError(null);
    try {
      const missionsResponse = await creatorApiFetch("/missions/me", publicKey);
      if (!missionsResponse.ok) throw new Error(`Unable to load missions (${missionsResponse.status}).`);
      const missions = (await missionsResponse.json()) as Mission[];
      const submissionsByMission = await Promise.all(
        missions
          .filter((mission) => (mission._count?.submissions ?? 0) > 0)
          .map(async (mission) => {
            const response = await creatorApiFetch(`/missions/${encodeURIComponent(mission.id)}/submissions`, publicKey);
            if (response.status === 403) throw new Error(`Access to submissions for “${mission.title}” was denied.`);
            if (!response.ok) throw new Error(`Unable to load submissions for “${mission.title}” (${response.status}).`);
            const submissions = (await response.json()) as Submission[];
            return submissions.map((submission) => ({ mission, submission }));
          }),
      );
      setEntries(submissionsByMission.flat());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load creator responses.");
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    void loadResponses();
  }, [loadResponses]);

  const pendingCount = entries.filter(({ submission }) => submission.status === "PENDING").length;

  return (
    <section className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-foreground">Creator responses</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review submissions across your missions.</p>
        </div>
        <span className="rounded-full border border-white/15 px-3 py-1 text-sm text-foreground">{pendingCount} awaiting review</span>
      </header>

      {loading ? (
        <div role="status" className="space-y-3">
          {[1, 2, 3].map((item) => <div key={item} className="h-32 animate-pulse rounded-lg border border-white/10 bg-white/5" />)}
          <span className="sr-only">Loading responses…</span>
        </div>
      ) : error ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-red-500/30 p-8 text-center">
          <AlertCircle className="size-6 text-red-400" />
          <p className="text-sm text-red-200">{error}</p>
          <button type="button" onClick={() => void loadResponses()} className="inline-flex items-center gap-2 rounded-md border border-white/15 px-3 py-2 text-sm text-foreground hover:bg-white/5">
            <RefreshCw className="size-4" /> Try again
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-white/10 p-8 text-center text-sm text-muted-foreground">No submissions yet. New responses will appear here.</div>
      ) : (
        <div className="space-y-4">
          {[...entries]
            .sort((a, b) => new Date(b.submission.createdAt).getTime() - new Date(a.submission.createdAt).getTime())
            .map(({ mission, submission }) => (
              <article key={submission.id} className="rounded-lg border border-white/10 bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/creator/quests/${mission.id}`} className="font-semibold text-foreground underline decoration-white/20 underline-offset-4 hover:decoration-brutal-cyan">{mission.title}</Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {submission.hunter?.displayName || shortAddress(submission.hunter?.address ?? submission.hunterAddress)}
                      {" · "}{new Date(submission.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/15 px-2.5 py-1 text-xs font-medium text-foreground">{submission.status.toLowerCase()}</span>
                </div>
                <IpfsSubmissionPreview cid={submission.ipfsCid} textPayload={submission.textPayload ?? undefined} />
              </article>
            ))}
        </div>
      )}
    </section>
  );
}
