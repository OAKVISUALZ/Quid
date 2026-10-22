"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Plus } from "lucide-react";
import { useWallet } from "@/context/WalletProvider";
import NetworkMismatchBanner from "@/components/wallet/NetworkMismatchBanner";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonList } from "@/components/ui/skeleton-list";
import { Button } from "@/components/ui/button";
import { toast } from "@/context/ToastContext";
import { parseMilestoneEscrowError } from "@/lib/errorMap";
import {
  addKnownProgramId,
  addMilestoneOnContract,
  approveMilestoneOnContract,
  cancelProgramOnContract,
  createProgramOnContract,
  getKnownProgramIds,
  getMilestoneOnContract,
  getProgramOnContract,
  type OnChainMilestone,
  type OnChainProgram,
} from "@/lib/milestone-escrow-client";

/**
 * Issue #340: milestone escrow creator UI — create programs, add milestones,
 * approve payouts, cancel programs — against `quid-milestone-escrow`.
 *
 * `NEXT_PUBLIC_QUID_MILESTONE_ID` is a placeholder until issue #284 lands;
 * see frontend/.env.example. There is also no backend indexer for this
 * contract yet, so "my programs" is a client-side pointer list
 * (localStorage, per wallet) of program ids this UI has created — each is
 * still re-read from the contract itself on every load, never trusted as a
 * cache. See `getKnownProgramIds` in milestone-escrow-client.ts.
 */

const XLM_DECIMALS = 10_000_000;

const DEFAULT_TOKEN =
  process.env.NEXT_PUBLIC_REWARD_TOKEN_XLM || process.env.NEXT_PUBLIC_NATIVE_TOKEN_ID || "";

interface ProgramWithMilestones {
  program: OnChainProgram;
  milestones: OnChainMilestone[];
}

function fromBaseUnits(value: string): string {
  const amount = Number(value || 0) / XLM_DECIMALS;
  return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatTimestamp(secondsStr: string): string {
  const seconds = Number(secondsStr);
  if (!seconds) return "—";
  return new Date(seconds * 1000).toLocaleDateString();
}

function describeError(err: unknown, fallback: string): { title: string; description: string } {
  const quidErr = parseMilestoneEscrowError(err);
  if (quidErr.title !== "Transaction failed") {
    return { title: quidErr.title, description: quidErr.description };
  }
  return {
    title: err instanceof Error ? err.message : fallback,
    description: quidErr.description,
  };
}

export default function MilestonesPage() {
  const { connected, publicKey, connect, isNetworkMismatch } = useWallet();

  const [programs, setPrograms] = useState<ProgramWithMilestones[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [tokenAddress, setTokenAddress] = useState(DEFAULT_TOKEN);
  const [totalAmount, setTotalAmount] = useState("");
  const [reviewerAddress, setReviewerAddress] = useState("");
  const [programNote, setProgramNote] = useState("");

  const [addMilestoneFor, setAddMilestoneFor] = useState<string | null>(null);
  const [milestoneTitle, setMilestoneTitle] = useState("");
  const [milestoneAmount, setMilestoneAmount] = useState("");
  const [milestoneDueDate, setMilestoneDueDate] = useState("");
  const [milestoneNote, setMilestoneNote] = useState("");
  const [addingMilestone, setAddingMilestone] = useState(false);

  const [busyAction, setBusyAction] = useState<string | null>(null);

  const loadPrograms = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    setLoadError(null);

    try {
      const ids = getKnownProgramIds(publicKey);
      const loaded = await Promise.all(
        ids.map(async (id) => {
          const program = await getProgramOnContract(id, publicKey);
          const milestoneIds = Array.from(
            { length: program.milestoneCount },
            (_, i) => i + 1,
          );
          const milestones = await Promise.all(
            milestoneIds.map((milestoneId) =>
              getMilestoneOnContract(id, milestoneId, publicKey),
            ),
          );
          return { program, milestones };
        }),
      );
      setPrograms(loaded);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Unable to load milestone programs",
      );
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadPrograms(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadPrograms]);

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;

    const parsedTotal = Number(totalAmount);
    if (!recipientAddress.trim()) {
      setCreateError("Recipient address is required.");
      return;
    }
    if (!tokenAddress.trim()) {
      setCreateError("Reward token is required.");
      return;
    }
    if (!totalAmount.trim() || Number.isNaN(parsedTotal) || parsedTotal <= 0) {
      setCreateError("Enter a total program amount greater than zero.");
      return;
    }

    setCreating(true);
    setCreateError(null);
    toast.loading("Creating program...", { id: "create-program" });

    try {
      const receipt = await createProgramOnContract({
        sponsorAddress: publicKey,
        recipientAddress: recipientAddress.trim(),
        tokenAddress: tokenAddress.trim(),
        totalAmount: BigInt(Math.round(parsedTotal * XLM_DECIMALS)),
        reviewerAddress: reviewerAddress.trim() || undefined,
        metadataCid: programNote.trim() || undefined,
      });

      if (receipt.programId) {
        addKnownProgramId(publicKey, receipt.programId);
      }

      toast.success("Program created!", {
        id: "create-program",
        description: `Tx ${receipt.txHash.slice(0, 18)}...`,
      });

      setShowCreateForm(false);
      setRecipientAddress("");
      setTotalAmount("");
      setReviewerAddress("");
      setProgramNote("");
      await loadPrograms();
    } catch (err) {
      const { title, description } = describeError(err, "Failed to create program");
      setCreateError(title);
      toast.error(title, { id: "create-program", description });
    } finally {
      setCreating(false);
    }
  };

  const handleAddMilestone = async (programId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) return;

    const parsedAmount = Number(milestoneAmount);
    if (!milestoneTitle.trim()) {
      toast.error("Milestone title is required.");
      return;
    }
    if (!milestoneAmount.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a milestone amount greater than zero.");
      return;
    }
    if (!milestoneDueDate) {
      toast.error("Pick a due date for this milestone.");
      return;
    }

    setAddingMilestone(true);
    const toastId = `add-milestone-${programId}`;
    toast.loading("Adding milestone...", { id: toastId });

    try {
      const dueAtSeconds = Math.floor(new Date(milestoneDueDate).getTime() / 1000);
      await addMilestoneOnContract({
        sponsorAddress: publicKey,
        programId,
        title: milestoneTitle.trim(),
        amount: BigInt(Math.round(parsedAmount * XLM_DECIMALS)),
        dueAt: dueAtSeconds,
        metadataCid: milestoneNote.trim(),
      });

      toast.success("Milestone added!", { id: toastId });
      setAddMilestoneFor(null);
      setMilestoneTitle("");
      setMilestoneAmount("");
      setMilestoneDueDate("");
      setMilestoneNote("");
      await loadPrograms();
    } catch (err) {
      const { title, description } = describeError(err, "Failed to add milestone");
      toast.error(title, { id: toastId, description });
    } finally {
      setAddingMilestone(false);
    }
  };

  const handleApproveMilestone = async (programId: string, milestoneId: string) => {
    if (!publicKey) return;
    const key = `approve-${programId}-${milestoneId}`;
    setBusyAction(key);
    toast.loading("Approving milestone...", { id: key });

    try {
      const receipt = await approveMilestoneOnContract({
        approverAddress: publicKey,
        programId,
        milestoneId,
      });
      toast.success("Milestone approved — reward released!", {
        id: key,
        description: `Tx ${receipt.txHash.slice(0, 18)}...`,
      });
      await loadPrograms();
    } catch (err) {
      const { title, description } = describeError(err, "Failed to approve milestone");
      toast.error(title, { id: key, description });
    } finally {
      setBusyAction(null);
    }
  };

  const handleCancelProgram = async (programId: string) => {
    if (!publicKey) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm("Cancel this program? Any unreleased funds will be refunded to you.")
    ) {
      return;
    }

    const key = `cancel-${programId}`;
    setBusyAction(key);
    toast.loading("Cancelling program...", { id: key });

    try {
      const receipt = await cancelProgramOnContract({
        sponsorAddress: publicKey,
        programId,
      });
      toast.success("Program cancelled — remaining funds refunded.", {
        id: key,
        description: `Tx ${receipt.txHash.slice(0, 18)}...`,
      });
      await loadPrograms();
    } catch (err) {
      const { title, description } = describeError(err, "Failed to cancel program");
      toast.error(title, { id: key, description });
    } finally {
      setBusyAction(null);
    }
  };

  if (!connected || !publicKey) {
    return (
      <div className="min-h-screen px-5 py-6 text-foreground sm:px-8 lg:px-12">
        <EmptyState
          title="Connect your wallet"
          description="Connect your founder wallet to create and manage milestone escrow programs."
          variant="card"
          action={{ label: "Connect wallet", onClick: () => void connect() }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-5 py-6 text-foreground sm:px-8 lg:px-12">
      <NetworkMismatchBanner />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Milestone Escrow</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fund staged, multi-milestone campaigns via{" "}
            <code className="text-foreground">quid-milestone-escrow</code>.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setShowCreateForm((prev) => !prev)}
          disabled={isNetworkMismatch}
        >
          <Plus className="mr-2 size-4" />
          New Program
        </Button>
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreateProgram}
          className="mb-8 brutal-border brutal-shadow bg-card p-4 sm:p-6 space-y-4"
        >
          <h2 className="text-lg font-bold">Create a milestone program</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">
                Recipient address <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                placeholder="G... or C..."
                className="w-full brutal-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#9011FF]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Reward token <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={tokenAddress}
                onChange={(e) => setTokenAddress(e.target.value)}
                placeholder="Token contract id"
                className="w-full brutal-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#9011FF]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Total amount (XLM) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.0000001"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="e.g. 1000"
                className="w-full brutal-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#9011FF]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Reviewer address (optional)
              </label>
              <input
                type="text"
                value={reviewerAddress}
                onChange={(e) => setReviewerAddress(e.target.value)}
                placeholder="Can also approve milestones"
                className="w-full brutal-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#9011FF]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Note (optional)</label>
            <textarea
              rows={2}
              value={programNote}
              onChange={(e) => setProgramNote(e.target.value)}
              placeholder="What this program funds"
              className="w-full brutal-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#9011FF] resize-none"
            />
          </div>

          {createError && (
            <div className="flex items-center gap-2 border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertCircle className="size-4 shrink-0 text-red-400" />
              <span>{createError}</span>
            </div>
          )}

          <div className="flex gap-3">
            <Button type="submit" loading={creating} loadingText="Creating..." disabled={isNetworkMismatch}>
              Create Program
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <SkeletonList count={2} variant="quest" />
      ) : loadError ? (
        <div className="flex flex-col items-center py-12 text-center">
          <AlertCircle className="mb-3 size-6 text-red-400" />
          <p className="text-sm text-red-300">{loadError}</p>
          <Button type="button" className="mt-4" onClick={() => void loadPrograms()}>
            Try again
          </Button>
        </div>
      ) : programs.length === 0 ? (
        <EmptyState
          title="No milestone programs yet"
          description="Create your first multi-milestone escrow program to fund staged research or feedback work."
          variant="card"
          action={{ label: "New Program", onClick: () => setShowCreateForm(true) }}
        />
      ) : (
        <div className="space-y-6">
          {programs.map(({ program, milestones }) => (
            <div key={program.id} className="brutal-border brutal-shadow bg-card p-4 sm:p-6">
              <div className="flex flex-col gap-2 border-b border-foreground/30 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold">Program #{program.id}</h3>
                  <p className="text-xs text-muted-foreground font-mono truncate max-w-xs">
                    Recipient: {program.recipient}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 text-xs font-semibold uppercase rounded-full ${
                      program.status === "Active"
                        ? "bg-green-500/20 text-green-400"
                        : program.status === "Completed"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {program.status}
                  </span>
                  {program.status === "Active" && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      loading={busyAction === `cancel-${program.id}`}
                      disabled={isNetworkMismatch || busyAction !== null}
                      onClick={() => void handleCancelProgram(program.id)}
                    >
                      Cancel Program
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase">Total</p>
                  <p className="font-semibold">{fromBaseUnits(program.totalAmount)} XLM</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase">Allocated</p>
                  <p className="font-semibold">{fromBaseUnits(program.allocatedAmount)} XLM</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase">Released</p>
                  <p className="font-semibold">{fromBaseUnits(program.releasedAmount)} XLM</p>
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-bold uppercase tracking-wide">Milestones</h4>
                  {program.status === "Active" && (
                    <button
                      type="button"
                      className="text-xs font-semibold text-[#9110FF] hover:text-[#b844ff]"
                      onClick={() =>
                        setAddMilestoneFor(addMilestoneFor === program.id ? null : program.id)
                      }
                    >
                      + Add milestone
                    </button>
                  )}
                </div>

                {addMilestoneFor === program.id && (
                  <form
                    onSubmit={(e) => void handleAddMilestone(program.id, e)}
                    className="mb-4 border border-foreground/30 p-3 space-y-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        type="text"
                        value={milestoneTitle}
                        onChange={(e) => setMilestoneTitle(e.target.value)}
                        placeholder="Milestone title"
                        className="w-full brutal-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#9011FF]"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.0000001"
                        value={milestoneAmount}
                        onChange={(e) => setMilestoneAmount(e.target.value)}
                        placeholder="Amount (XLM)"
                        className="w-full brutal-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#9011FF]"
                      />
                      <input
                        type="date"
                        value={milestoneDueDate}
                        onChange={(e) => setMilestoneDueDate(e.target.value)}
                        className="w-full brutal-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#9011FF]"
                      />
                      <input
                        type="text"
                        value={milestoneNote}
                        onChange={(e) => setMilestoneNote(e.target.value)}
                        placeholder="Note (optional)"
                        className="w-full brutal-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#9011FF]"
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button type="submit" size="sm" loading={addingMilestone} loadingText="Adding...">
                        Add Milestone
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAddMilestoneFor(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                )}

                {milestones.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No milestones added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {milestones.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="flex flex-col gap-2 border border-foreground/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-medium">{milestone.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {fromBaseUnits(milestone.amount)} XLM • Due {formatTimestamp(milestone.dueAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-1 text-xs font-semibold uppercase rounded-full ${
                              milestone.status === "Paid" || milestone.status === "Released"
                                ? "bg-green-500/20 text-green-400"
                                : milestone.status === "Cancelled"
                                  ? "bg-gray-500/20 text-gray-400"
                                  : "bg-yellow-500/20 text-yellow-400"
                            }`}
                          >
                            {milestone.status}
                          </span>
                          {milestone.status === "Pending" && program.status === "Active" && (
                            <Button
                              type="button"
                              size="sm"
                              loading={busyAction === `approve-${program.id}-${milestone.id}`}
                              disabled={isNetworkMismatch || busyAction !== null}
                              onClick={() =>
                                void handleApproveMilestone(program.id, milestone.id)
                              }
                            >
                              Approve &amp; Pay
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
