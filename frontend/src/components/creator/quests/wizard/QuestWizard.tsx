"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, FileText, Loader2, X } from "lucide-react";
import WizardStepper from "./WizardStepper";
import WizardFooter from "./WizardFooter";
import ParticipantPreviewModal from "./ParticipantPreviewModal";
import BasicsStep, { isBasicsStepValid } from "./steps/BasicsStep";
import EligibilityStep, { isEligibilityStepValid } from "./steps/EligibilityStep";
import TasksStep, { isTasksStepValid } from "./steps/TasksStep";
import RewardsStep, { isRewardsStepValid } from "./steps/RewardsStep";
import ScheduleStep, { isScheduleStepValid } from "./steps/ScheduleStep";
import ReviewStep from "./steps/ReviewStep";
import {
  WIZARD_STEPS,
  createDefaultWizardData,
  restoreWizardDataFromDraft,
  type QuestWizardData,
} from "./types";
import { toast } from "@/context/ToastContext";
import { useWallet } from "@/context/WalletProvider";
import {
  fetchLatestMissionDraft,
  publishMissionDraft,
  saveMissionDraft,
  type MissionDraft,
  type PublishDraftPayload,
} from "@/lib/creator-api";

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug || `quest-${Date.now()}`;
}

function getRelativeTime(value: string): string {
  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (elapsedSeconds < 60) return "just now";
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m ago`;
  if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)}h ago`;
  return `${Math.floor(elapsedSeconds / 86400)}d ago`;
}

export default function QuestWizard({
  onPublish,
  initialResume = false,
  initialDraftId,
}: {
  onPublish: (questId: string) => void;
  initialResume?: boolean;
  initialDraftId?: string;
}) {
  const router = useRouter();
  const { publicKey } = useWallet();

  const [data, setDataState] = useState<QuestWizardData>(() =>
    createDefaultWizardData(),
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [maxReachedIndex, setMaxReachedIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  // Issue #329: draft management state
  const [draftId, setDraftId] = useState<string | null>(initialDraftId || null);
  const [availableDraft, setAvailableDraft] = useState<MissionDraft | null>(null);
  const [saved, setSaved] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resume a draft and load all fields back into the wizard
  const resumeDraft = useCallback((draft: MissionDraft) => {
    const restored = restoreWizardDataFromDraft(draft.data, draft.title);
    setDataState(restored.data);
    setCurrentIndex(restored.currentIndex);
    setMaxReachedIndex(restored.maxReachedIndex);
    setDraftId(draft.id);
    setAvailableDraft(null);
    setSaved(true);
    toast.info("Draft loaded", {
      description: `Resumed "${draft.title}".`,
    });
  }, []);

  // Check for existing backend draft on load
  useEffect(() => {
    if (!publicKey) return;

    let isMounted = true;
    const checkDraft = async () => {
      try {
        const draft = await fetchLatestMissionDraft(publicKey);
        if (!isMounted || !draft) return;

        if (initialResume) {
          resumeDraft(draft);
        } else {
          setAvailableDraft(draft);
        }
      } catch (err) {
        console.warn("[Quid] Could not check latest draft:", err);
      }
    };

    void checkDraft();
    return () => {
      isMounted = false;
    };
  }, [publicKey, initialResume, resumeDraft]);

  // Set data and trigger auto-save debounce
  function setData(updater: (prev: QuestWizardData) => QuestWizardData) {
    setDataState(updater);
    setSaved(false);
  }

  // Auto-save debounce effect (saves to POST /missions/drafts under JWT user)
  useEffect(() => {
    if (!publicKey || saved) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      if (!data.basics.title.trim() && currentIndex === 0) {
        setSaved(true);
        return;
      }

      try {
        const dto = {
          title: data.basics.title.trim() || "Untitled Quest Draft",
          data: {
            ...data,
            _wizardState: {
              currentIndex,
              maxReachedIndex,
            },
          },
        };
        const res = await saveMissionDraft(dto, publicKey);
        setDraftId(res.id);
        setSaved(true);
      } catch {
        // Auto-save silent fallback
      }
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [data, currentIndex, maxReachedIndex, publicKey, saved]);

  const stepValid = [
    isBasicsStepValid(data.basics),
    isEligibilityStepValid(),
    isTasksStepValid(data.tasks),
    isRewardsStepValid(data.rewards),
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

  // Publish flow connecting draft to publish mission API
  async function handleContinue() {
    if (!stepValid) return;

    if (isLastStep) {
      setIsPublishing(true);
      try {
        let activeDraftId = draftId;

        // If no draft ID saved yet, persist it first so backend has the draft record
        if (!activeDraftId && publicKey) {
          const dto = {
            title: data.basics.title.trim() || "Untitled Quest",
            data: {
              ...data,
              _wizardState: { currentIndex, maxReachedIndex },
            },
          };
          const savedDraft = await saveMissionDraft(dto, publicKey);
          activeDraftId = savedDraft.id;
          setDraftId(savedDraft.id);
        }

        // Publish draft via POST /missions/drafts/:draftId/publish
        if (activeDraftId && publicKey) {
          const rewardPerWinner =
            data.rewards.numberOfWinners > 0
              ? String(
                  Math.floor(
                    (data.rewards.totalRewardBudget /
                      data.rewards.numberOfWinners) *
                      10_000_000,
                  ),
                )
              : "10000000";

          const publishPayload: PublishDraftPayload = {
            onChainId: (Date.now() % 1000000).toString(),
            descriptionCid: "bafkreiquiddescription" + Date.now(),
            rewardToken:
              process.env.NEXT_PUBLIC_REWARD_TOKEN_XLM ||
              "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
            rewardAmount: rewardPerWinner,
            maxParticipants:
              data.rewards.numberOfWinners ||
              data.basics.participantLimit ||
              10,
            metadata: {
              questType: data.basics.questType,
              category: "General",
              tasks: data.tasks,
              eligibility: data.eligibility,
              schedule: data.schedule,
              pool: data.rewards.totalRewardBudget,
            },
            aiSummary: data.basics.description || data.basics.title,
          };

          const published = await publishMissionDraft(
            activeDraftId,
            publishPayload,
            publicKey,
          );

          toast.success("Quest created and published!", {
            description: `"${data.basics.title || "Quest"}" is now live.`,
          });
          onPublish(published.id);
          return;
        }

        // Local fallback when wallet not connected
        const slug = slugify(data.basics.title);
        toast.success("Quest created successfully!", {
          description: `"${data.basics.title || "Quest"}" has been published.`,
        });
        onPublish(slug);
      } catch (err) {
        toast.error("Publishing failed", {
          description:
            err instanceof Error ? err.message : "Unable to publish quest",
        });
      } finally {
        setIsPublishing(false);
      }
      return;
    }

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);
    setMaxReachedIndex((max) => Math.max(max, nextIndex));
  }

  // Explicit Save as Draft action
  async function handleSaveDraft() {
    if (!publicKey) {
      toast.error("Wallet required", {
        description: "Connect your founder wallet to save drafts.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const dto = {
        title: data.basics.title.trim() || "Untitled Quest Draft",
        data: {
          ...data,
          _wizardState: {
            currentIndex,
            maxReachedIndex,
          },
        },
      };

      const savedDraft = await saveMissionDraft(dto, publicKey);
      setDraftId(savedDraft.id);
      setSaved(true);
      setAvailableDraft(null);

      toast.success("Draft saved successfully!", {
        description: `Draft "${savedDraft.title}" has been saved.`,
      });

      router.push("/creator/quests");
    } catch (err) {
      toast.error("Failed to save draft", {
        description:
          err instanceof Error ? err.message : "Unable to save draft",
      });
    } finally {
      setIsSaving(false);
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
        {isSaving ? (
          <span className="flex items-center gap-1.5 text-sm text-foreground/50">
            <Loader2 className="size-3.5 animate-spin" />
            Saving draft…
          </span>
        ) : saved ? (
          <span className="flex items-center gap-1.5 text-sm text-emerald-400">
            <Check className="size-4" />
            Saved
          </span>
        ) : (
          <span className="text-sm text-foreground/30">Saving…</span>
        )}
      </div>

      {/* Issue #329: Resume draft banner */}
      {availableDraft && (
        <div className="mx-6 mb-3 flex flex-wrap items-center justify-between gap-2 brutal-border bg-brutal-yellow/20 p-3 text-xs text-foreground">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-amber-300 flex-shrink-0" />
            <span>
              Resume saved draft: <strong>{availableDraft.title}</strong>{" "}
              <span className="text-muted-foreground">
                (saved {getRelativeTime(availableDraft.updatedAt)})
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => resumeDraft(availableDraft)}
              className="cursor-pointer brutal-border bg-brutal-pink px-2.5 py-1 text-xs font-bold uppercase text-foreground hover:translate-x-[-1px] hover:translate-y-[-1px]"
            >
              Resume Draft
            </button>
            <button
              type="button"
              onClick={() => setAvailableDraft(null)}
              className="cursor-pointer p-1 text-muted-foreground hover:text-foreground"
              title="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      <div className="px-6">
        <h1 className="mb-4 text-xl font-semibold text-foreground">
          {data.basics.title || "Create a quest"}
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
              setData((prev) => ({
                ...prev,
                basics: { ...prev.basics, ...patch },
              }))
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
            onChange={(patch) =>
              setData((prev) => ({
                ...prev,
                rewards: { ...prev.rewards, ...patch },
              }))
            }
          />
        ) : null}
        {currentIndex === 4 ? (
          <ScheduleStep
            data={data.schedule}
            onChange={(patch) =>
              setData((prev) => ({
                ...prev,
                schedule: { ...prev.schedule, ...patch },
              }))
            }
          />
        ) : null}
        {currentIndex === 5 ? <ReviewStep data={data} /> : null}
      </div>

      <WizardFooter
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
        canContinue={stepValid && !isPublishing}
        onBack={handleBack}
        onPreview={() => setShowPreview(true)}
        onSaveDraft={handleSaveDraft}
        onContinue={handleContinue}
      />

      {showPreview ? (
        <ParticipantPreviewModal
          data={data}
          onClose={() => setShowPreview(false)}
        />
      ) : null}
    </div>
  );
}
