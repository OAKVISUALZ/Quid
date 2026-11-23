"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import WizardStepper from "./WizardStepper";
import WizardFooter from "./WizardFooter";
import ParticipantPreviewModal from "./ParticipantPreviewModal";
import BasicsStep, { isBasicsStepValid } from "./steps/BasicsStep";
import EligibilityStep, { isEligibilityStepValid } from "./steps/EligibilityStep";
import TasksStep, { isTasksStepValid } from "./steps/TasksStep";
import RewardsStep, { isRewardsStepValid } from "./steps/RewardsStep";
import ScheduleStep, { isScheduleStepValid } from "./steps/ScheduleStep";
import ReviewStep from "./steps/ReviewStep";
import { WIZARD_STEPS, createDefaultWizardData, type QuestWizardData } from "./types";
import { toast } from "@/context/ToastContext";
import { creatorApiFetch } from "@/lib/creator-api";
import { useWallet } from "@/context/WalletProvider";
import { createMission } from "@/lib/soroban/quid-store";
import { uploadMissionMetadataToIpfs } from "@/lib/upload-api";

interface PublishedMission {
  questId: string | null;
  missionId: string;
  txHash: string;
  warning?: string;
}

interface SavedDraft {
  id: string;
}

function rewardAmountToStroops(amount: number): bigint {
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > Number.MAX_SAFE_INTEGER
  ) {
    throw new Error("Enter a positive reward amount.");
  }
  const [whole, fraction = ""] = amount.toFixed(7).split(".");
  return BigInt(whole) * BigInt(10_000_000) + BigInt(fraction.padEnd(7, "0"));
}

export default function QuestWizard({
  onPublish,
}: {
  onPublish: (mission: PublishedMission) => void;
}) {
  const [data, setDataState] = useState<QuestWizardData>(() => createDefaultWizardData());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [maxReachedIndex, setMaxReachedIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [saved, setSaved] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { publicKey, balances } = useWallet();
  const [resuming, setResuming] = useState(false);
  const availableWalletBalance = Number(
    balances.find((balance) => balance.asset_type === "native")?.balance ?? 0,
  );

  useEffect(() => {
    if (!publicKey || typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("resume") !== "latest") return;

    let cancelled = false;
    setResuming(true);
    void creatorApiFetch("/missions/drafts/me", publicKey)
      .then(async (response) => {
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new Error(detail || `Unable to load draft (${response.status})`);
        }
        return response.json() as Promise<{ data?: unknown }>;
      })
      .then((draft) => {
        if (!cancelled && draft.data && typeof draft.data === "object") {
          setDataState(draft.data as QuestWizardData);
          setSaved(true);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Unable to resume draft.");
      })
      .finally(() => {
        if (!cancelled) setResuming(false);
      });
    return () => { cancelled = true; };
  }, [publicKey]);

  function setData(updater: (prev: QuestWizardData) => QuestWizardData) {
    setDataState(updater);
    setSaved(false);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setSaved(true), 800);
  }

  const stepValid = [
    isBasicsStepValid(data.basics),
    isEligibilityStepValid(),
    isTasksStepValid(data.tasks),
    isRewardsStepValid(data.rewards, availableWalletBalance),
    isScheduleStepValid(data.schedule),
    true,
  ][currentIndex];

  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === WIZARD_STEPS.length - 1;

  function goToStep(index: number) {
    if (index <= maxReachedIndex) setCurrentIndex(index);
  }

  function handleBack() {
    setCurrentIndex((index) => Math.max(0, index - 1));
  }

  function handleContinue() {
    if (!stepValid) return;

    if (isLastStep) {
      void publishMission();
      return;
    }

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setMaxReachedIndex((max) => Math.max(max, nextIndex));
  }

  async function saveDraftRecord(): Promise<SavedDraft> {
    if (!publicKey) throw new Error("Connect your wallet before saving a quest.");

    const response = await creatorApiFetch("/missions/drafts", publicKey, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: data.basics.title, data }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Could not save the mission draft (${response.status}): ${detail || response.statusText}`,
      );
    }

    const draft = (await response.json()) as Partial<SavedDraft>;
    if (typeof draft.id !== "string" || !draft.id) {
      throw new Error("The draft service did not return a draft id.");
    }
    return { id: draft.id };
  }

  async function handleSaveDraft() {
    try {
      await saveDraftRecord();
      toast.success("Draft saved successfully.", {
        description: `Draft "${data.basics.title || "Untitled mission"}" has been saved.`,
      });
      window.location.href = "/creator/quests";
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the mission draft.",
      );
    }
  }

  async function publishMission() {
    if (!publicKey) {
      toast.error("Connect your wallet before publishing a mission.");
      return;
    }

    if (data.basics.visibility !== "public") {
      toast.error(
        "Private missions are not supported by the on-chain marketplace yet.",
      );
      return;
    }
    if (
      data.schedule.publishOption === "scheduled" &&
      new Date(data.schedule.startDateTime).getTime() > Date.now()
    ) {
      toast.error(
        "Scheduled on-chain publishing is not supported yet. Choose publish immediately.",
      );
      return;
    }

    const rewardTokenAddress = process.env.NEXT_PUBLIC_REWARD_TOKEN_XLM;
    if (!rewardTokenAddress) {
      toast.error("The XLM reward token is not configured for this deployment.");
      return;
    }

    const closingTime = new Date(data.schedule.closingDateTime);
    if (Number.isNaN(closingTime.getTime()) || closingTime.getTime() <= Date.now()) {
      toast.error("Choose a closing date and time in the future.");
      return;
    }

    setPublishing(true);
    try {
      const draft = await saveDraftRecord();
      const metadata = {
        schemaVersion: 1,
        title: data.basics.title.trim(),
        description: data.basics.description.trim(),
        quest: data,
      };
      const descriptionCid = await uploadMissionMetadataToIpfs(
        metadata,
        publicKey,
      );
      const rewardAmount = rewardAmountToStroops(
        data.rewards.totalRewardBudget / data.rewards.numberOfWinners,
      );
      const expiresAt = BigInt(Math.floor(closingTime.getTime() / 1000));
      const chainMission = await createMission({
        ownerAddress: publicKey,
        title: data.basics.title,
        descriptionCid,
        rewardTokenAddress,
        rewardAmount,
        maxParticipants: data.rewards.numberOfWinners,
        expiresAt,
      });

      let questId: string | null = null;
      let warning: string | undefined;
      try {
        const publishResponse = await creatorApiFetch(
          `/missions/drafts/${draft.id}/publish`,
          publicKey,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              onChainId: chainMission.missionId,
              descriptionCid,
              metadataCid: descriptionCid,
              metadata,
              rewardToken: rewardTokenAddress,
              rewardAmount: rewardAmount.toString(),
              maxParticipants: data.rewards.numberOfWinners,
              minAssetToken: null,
              minAssetAmount: "0",
              expiresAt: expiresAt.toString(),
            }),
          },
        );
        if (!publishResponse.ok) {
          const detail = await publishResponse.text().catch(() => "");
          throw new Error(
            `The mission is live, but the dashboard could not be updated (${publishResponse.status}): ${detail || publishResponse.statusText}`,
          );
        }
        const published = (await publishResponse.json()) as { id: string };
        questId = published.id;
      } catch (error) {
        warning =
          error instanceof Error
            ? error.message
            : "The mission is live, but the dashboard could not be updated.";
      }

      toast.success(`Mission #${chainMission.missionId} published on Stellar.`);
      onPublish({
        questId,
        missionId: chainMission.missionId,
        txHash: chainMission.txHash,
        warning,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Mission publishing failed. No success was reported.",
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-background brutal-grid-bg">
      <div className="flex items-center justify-between px-6 py-4">
        <Link
          href="/creator/quests"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" />
          Exit creator
        </Link>
        {saved ? (
          <span className="flex items-center gap-1.5 text-sm text-emerald-400">
            <Check className="size-4" />
            Saved
          </span>
        ) : (
          <span className="text-sm text-foreground/30">Saving…</span>
        )}
      </div>

      <div className="px-6">
        <h1 className="mb-4 text-xl font-semibold text-foreground">
          {resuming ? "Loading saved draft…" : data.basics.title || "Create a mission"}
        </h1>
        <WizardStepper
          currentIndex={currentIndex}
          maxReachedIndex={maxReachedIndex}
          onStepClick={goToStep}
        />
      </div>

      <div className="mt-4 flex-1 overflow-y-auto border-t border-foreground/30 px-6 py-6">
        {currentIndex === 0 ? (
          <BasicsStep
            data={data.basics}
            onChange={(patch) =>
              setData((prev) => ({ ...prev, basics: { ...prev.basics, ...patch } }))
            }
          />
        ) : null}
        {currentIndex === 1 ? (
          <EligibilityStep
            data={data.eligibility}
            onChange={(patch) =>
              setData((prev) => ({
                ...prev,
                eligibility: { ...prev.eligibility, ...patch },
              }))
            }
          />
        ) : null}
        {currentIndex === 2 ? (
          <TasksStep
            tasks={data.tasks}
            onChange={(tasks) => setData((prev) => ({ ...prev, tasks }))}
          />
        ) : null}
        {currentIndex === 3 ? (
          <RewardsStep
            data={data.rewards}
            availableWalletBalance={availableWalletBalance}
            onChange={(patch) =>
              setData((prev) => ({ ...prev, rewards: { ...prev.rewards, ...patch } }))
            }
          />
        ) : null}
        {currentIndex === 4 ? (
          <ScheduleStep
            data={data.schedule}
            onChange={(patch) =>
              setData((prev) => ({ ...prev, schedule: { ...prev.schedule, ...patch } }))
            }
          />
        ) : null}
        {currentIndex === 5 ? <ReviewStep data={data} /> : null}
      </div>

      <WizardFooter
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
        canContinue={stepValid}
        publishing={publishing}
        onBack={handleBack}
        onPreview={() => setShowPreview(true)}
        onSaveDraft={handleSaveDraft}
        onContinue={handleContinue}
      />

      {showPreview ? (
        <ParticipantPreviewModal data={data} onClose={() => setShowPreview(false)} />
      ) : null}
    </div>
  );
}
