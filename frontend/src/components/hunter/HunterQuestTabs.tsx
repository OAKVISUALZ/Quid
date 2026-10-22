"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { BriefcaseBusiness, ChevronLeft, ChevronRight, Send } from "lucide-react";
import SubmitFeedbackModal from "@/components/hunter/SubmitFeedbackModal";
import { PendingBadge } from "@/components/ui/PendingBadge";
import { EmptyState } from "@/components/ui/empty-state";
import { usePendingTx } from "@/app/hooks/usePendingTx";
import { useWallet } from "@/context/WalletProvider";
import { getApiBaseUrl } from "@/lib/api-base";
import type { SubmissionReceipt } from "@/lib/soroban-client";

type QuestStatus = "Submitted" | "Reviewing" | "Open";
type QuestTab = "for-you" | "all-quest" | "my-quest";

interface Quest {
  id: string;
  brand: string;
  title: string;
  icon: string;
  responses?: string;
  due: string;
  reward: string;
  status?: QuestStatus;
  /**
   * Issue #322: true once the founder has paused the mission on-chain
   * (`pause_mission`). Blocks the "Submit Feedback" CTA without touching an
   * already-submitted entry's status.
   */
  isPaused?: boolean;
}

const tabs: Array<{ id: QuestTab; label: string; count?: number }> = [
  { id: "for-you", label: "For You" },
  { id: "all-quest", label: "All Quest" },
  { id: "my-quest", label: "My Quest", count: 2 },
];

const forYouQuests: Quest[] = [
  {
    id: "ruze-1",
    brand: "Ruze.stellar",
    title: "Download and test the latest Ruze.stellar 2.0",
    icon: "/dashboard/brand1.svg",
    responses: "24 Response",
    due: "Due in 6d",
    reward: "640 XLM",
  },
  {
    id: "catbulk-1",
    brand: "CatBulk",
    title: "Test our new game and leave feedback",
    icon: "/dashboard/brand2.svg",
    responses: "3 Response",
    due: "Due in 6d",
    reward: "1500 XLM",
  },
  {
    id: "mizu-1",
    brand: "Mizu",
    title: "Criticize our new feature at Mizu",
    icon: "/dashboard/brand3.svg",
    responses: "12 Response",
    due: "Due in 6d",
    reward: "730 XLM",
  },
  {
    id: "tradebot-1",
    brand: "TradeBot",
    title: "Download and try the latest TradeBot",
    icon: "/dashboard/brand4.svg",
    responses: "31 Response",
    due: "Due in 6d",
    reward: "3000 XLM",
  },
];

const allQuests: Quest[] = [
  ...forYouQuests.slice(0, 2),
  {
    ...forYouQuests[0],
    id: "ruze-2",
    title: "Download and test the latest Ruze.stellar 2.1",
  },
  {
    ...forYouQuests[0],
    id: "ruze-3",
    title: "Audit the Ruze onboarding checklist",
  },
  {
    ...forYouQuests[2],
    id: "mizu-2",
    title: "Criticize the new Mizu rewards flow",
  },
  {
    ...forYouQuests[1],
    id: "catbulk-2",
    title: "Try CatBulk multiplayer and report bugs",
  },
  {
    ...forYouQuests[1],
    id: "catbulk-3",
    title: "Rate CatBulk character controls",
  },
  {
    ...forYouQuests[3],
    id: "tradebot-2",
    title: "Compare TradeBot alerts with your workflow",
  },
  {
    ...forYouQuests[2],
    id: "mizu-3",
    title: "Review Mizu wallet connection states",
  },
  {
    ...forYouQuests[2],
    id: "mizu-4",
    title: "Score the Mizu dashboard copy",
  },
];

const myQuests: Quest[] = [
  {
    ...forYouQuests[0],
    id: "my-ruze-1",
    responses: undefined,
    status: "Submitted",
  },
  {
    ...forYouQuests[1],
    id: "my-catbulk-1",
    responses: undefined,
    due: "Expired 3d ago",
    status: "Reviewing",
  },
  {
    ...forYouQuests[2],
    id: "my-mizu-1",
    responses: undefined,
    due: "Expired 5d ago",
    status: "Reviewing",
  },
];

const initialQuestsByTab: Record<QuestTab, Quest[]> = {
  "for-you": forYouQuests,
  "all-quest": allQuests,
  "my-quest": myQuests,
};

const QUESTS_PER_PAGE = 5;

// Issue #324: use the shared resolver. It appends `/api` (unlike the raw env
// var, which points at the backend origin and would 404 against the prefix).
const API_URL = getApiBaseUrl();

export default function HunterQuestTabs() {
  const [activeTab, setActiveTab] = useState<QuestTab>("for-you");
  const [allQuestPage, setAllQuestPage] = useState(1);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [questsState, setQuestsState] = useState<Record<QuestTab, Quest[]>>(initialQuestsByTab);

  const { publicKey } = useWallet();
  const { isPending, addPendingTx } = usePendingTx(API_URL, publicKey);

  const quests = questsState[activeTab];
  const showPagination = activeTab === "all-quest";
  const totalPages = Math.ceil(questsState["all-quest"].length / QUESTS_PER_PAGE);
  const visibleQuests = showPagination
    ? quests.slice(
        (allQuestPage - 1) * QUESTS_PER_PAGE,
        allQuestPage * QUESTS_PER_PAGE,
      )
    : quests;

  const tabLabel = useMemo(
    () => tabs.find((tab) => tab.id === activeTab)?.label ?? "Quests",
    [activeTab],
  );

  /**
   * Issue #349: called by SubmitFeedbackModal after on-chain sign succeeds.
   * Immediately adds an optimistic "Pending" entry so the row shows the badge
   * while the indexer catches up.
   */
  const handleSubmissionSuccess = (receipt: SubmissionReceipt) => {
    if (!selectedQuest) return;

    // Register the pending tx so the badge appears right away
    addPendingTx(selectedQuest.id, receipt.txHash);

    const submittedQuest: Quest = {
      ...selectedQuest,
      id: `submitted-${selectedQuest.id}`,
      status: "Submitted",
      due: "Pending Review",
    };

    setQuestsState((prev) => ({
      ...prev,
      "my-quest": [submittedQuest, ...prev["my-quest"]],
    }));
  };

  return (
    <section aria-label={`${tabLabel} quests`}>
      <div
        className="mt-6 flex gap-8 border-b border-foreground/30 text-lg font-semibold text-muted-foreground"
        role="tablist"
        aria-label="Quest filters"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const count = tab.id === "my-quest" ? questsState["my-quest"].length : tab.count;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${tab.id}-panel`}
              className={`relative pb-4 transition-colors hover:text-foreground ${
                isActive ? "text-foreground" : ""
              }`}
              onClick={() => {
                setActiveTab(tab.id);
                setAllQuestPage(1);
              }}
            >
              {tab.label}
              {count ? (
                <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-[#1B1324]">
                  {count}
                </span>
              ) : null}
              {isActive ? (
                <span className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-[#B78CFF]" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className={showPagination ? "flex min-h-[720px] flex-col" : undefined}>
        <div id={`${activeTab}-panel`} role="tabpanel" className="mt-7 space-y-9 ">
          {visibleQuests.length === 0 ? (
            <EmptyState
              title={
                activeTab === "my-quest"
                  ? "No Active Participations"
                  : "No Quests Available"
              }
              description={
                activeTab === "my-quest"
                  ? "You haven't participated in any quests yet. Take a quest from 'For You' or 'All Quest' to start earning."
                  : "No quests are currently available in this category. Check back later."
              }
              variant="card"
              action={
                activeTab === "my-quest"
                  ? {
                      label: "Browse All Quests",
                      onClick: () => {
                        setActiveTab("all-quest");
                        setAllQuestPage(1);
                      },
                    }
                  : undefined
              }
            />
          ) : (
            visibleQuests.map((quest) => (
              <QuestRow
                key={quest.id}
                quest={quest}
                isPending={isPending(quest.id)}
                onSubmitFeedback={() => setSelectedQuest(quest)}
              />
            ))
          )}
        </div>

        {showPagination ? (
          <Pagination
            currentPage={allQuestPage}
            totalPages={totalPages}
            onPageChange={setAllQuestPage}
          />
        ) : null}
      </div>

      {selectedQuest && (
        <SubmitFeedbackModal
          isOpen={Boolean(selectedQuest)}
          quest={selectedQuest}
          onClose={() => setSelectedQuest(null)}
          onSuccess={handleSubmissionSuccess}
        />
      )}
    </section>
  );
}

function QuestRow({
  quest,
  isPending,
  onSubmitFeedback,
}: {
  quest: Quest;
  isPending: boolean;
  onSubmitFeedback: () => void;
}) {
  const isSubmitted = quest.status === "Submitted" || quest.status === "Reviewing";
  // Issue #322: a paused mission blocks *new* submissions; one already
  // submitted stays visible via the `isSubmitted` branch below.
  const isPaused = Boolean(quest.isPaused) && !isSubmitted;

  return (
    <article className="grid gap-5 sm:grid-cols-[96px_1fr_auto] sm:items-center  p-2 transition-colors hover:bg-white/[0.02]">
      <Image
        src={quest.icon}
        alt={`${quest.brand} logo`}
        width={96}
        height={96}
        className="size-20  object-cover sm:size-24"
      />
      <div className="min-w-0">
        <h2 className="truncate text-2xl font-semibold">{quest.title}</h2>
        <p className="mt-2 text-muted-foreground">{quest.brand}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <BriefcaseBusiness className="size-4" />
            Product Quest
          </span>
          {quest.responses ? <span>{quest.responses}</span> : null}
          <span>{quest.due}</span>
          {quest.status ? (
            <span
              className={
                quest.status === "Submitted"
                  ? "text-foreground"
                  : quest.status === "Reviewing"
                    ? "text-[#D8BD63]"
                    : "text-muted-foreground"
              }
            >
              {quest.status}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col sm:items-end gap-3">
        <div className="flex gap-4 text-3xl font-bold">
          <Image src="/dashboard/xlm.svg" alt="" width={38} height={38} />
          <span>{quest.reward}</span>
        </div>
        {/* Issue #349: show PendingBadge when tx is signed but indexer hasn't caught up yet */}
        {isPending ? (
          <PendingBadge />
        ) : isPaused ? (
          <span className="text-xs font-medium text-yellow-400">
            Paused by founder
          </span>
        ) : !isSubmitted ? (
          <button
            type="button"
            onClick={onSubmitFeedback}
            className="inline-flex items-center justify-center gap-2  bg-[linear-gradient(135deg,#9011FF_0%,#B78CFF_100%)] px-4 py-2 text-sm font-semibold text-foreground shadow-md transition-transform hover:opacity-95 active:scale-[0.98]"
          >
            <Send className="size-3.5" />
            Submit Feedback
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">Submission Recorded</span>
        )}
      </div>
    </article>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const goToPage = (page: number) => {
    onPageChange(Math.min(Math.max(page, 1), totalPages));
  };

  return (
    <div className="mt-auto flex flex-col items-center pt-12">
      <nav
        className="flex items-center justify-center gap-6 text-sm text-foreground"
        aria-label="All quest pages"
      >
        <button
          type="button"
          className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:text-foreground/30"
          disabled={currentPage === 1}
          onClick={() => goToPage(currentPage - 1)}
        >
          <ChevronLeft className="size-4" />
          Previous
        </button>

        {Array.from({ length: totalPages }, (_, index) => index + 1).map(
          (page) => {
            const isActive = page === currentPage;

            return (
              <button
                key={page}
                type="button"
                className={
                  isActive
                    ? "rounded-md border border-white/45 px-3 py-2"
                    : "text-muted-foreground transition-colors hover:text-foreground"
                }
                aria-current={isActive ? "page" : undefined}
                onClick={() => goToPage(page)}
              >
                {page}
              </button>
            );
          },
        )}

        <span className="text-muted-foreground">...</span>

        <button
          type="button"
          className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:text-foreground/30"
          disabled={currentPage === totalPages}
          onClick={() => goToPage(currentPage + 1)}
        >
          Next
          <ChevronRight className="size-4" />
        </button>
      </nav>
    </div>
  );
}
