export type QuestType = "product-testing" | "community-participation";

export interface BasicsData {
  questType: QuestType;
  title: string;
  description: string;
  completionDuration: string;
  participantLimit: number;
  visibility: "public" | "private";
}

export interface EligibilityData {
  whoCanParticipate: string;
  maxSubmissionsPerParticipant: number;
  eligibleRegions: string;
  previousWinnersCanParticipate: boolean;
  additionalRequirement: string;
}

export type TaskResponseType = "paragraph" | "short-answer" | "upload" | "link";

export interface TaskBlock {
  id: string;
  responseType: TaskResponseType;
  title: string;
  instruction: string;
  required: boolean;
}

export interface RewardsData {
  rewardMethod: string;
  totalRewardBudget: number;
  numberOfWinners: number;
}

export interface ScheduleData {
  publishOption: "immediately" | "scheduled";
  startDateTime: string;
  closingDateTime: string;
  timeZone: string;
  winnerAnnouncement: string;
  autoCloseWhenFull: boolean;
}

export interface QuestWizardData {
  basics: BasicsData;
  eligibility: EligibilityData;
  tasks: TaskBlock[];
  rewards: RewardsData;
  schedule: ScheduleData;
}

export type WizardStepKey =
  | "basics"
  | "eligibility"
  | "tasks"
  | "rewards"
  | "schedule"
  | "review";

export const WIZARD_STEPS: { key: WizardStepKey; label: string }[] = [
  { key: "basics", label: "Basics" },
  { key: "eligibility", label: "Eligibility" },
  { key: "tasks", label: "Tasks" },
  { key: "rewards", label: "Rewards" },
  { key: "schedule", label: "Schedule" },
  { key: "review", label: "Review & publish" },
];

export const AVAILABLE_WALLET_BALANCE = 1240;
export const PLATFORM_FEE_RATE = 0.00375;
export const NETWORK_FEE_ESTIMATE = 0.1;

let taskIdCounter = 0;
export function createTaskBlock(overrides: Partial<TaskBlock> = {}): TaskBlock {
  taskIdCounter += 1;
  return {
    id: `task-${Date.now()}-${taskIdCounter}`,
    responseType: "paragraph",
    title: "",
    instruction: "",
    required: false,
    ...overrides,
  };
}

export function createDefaultWizardData(): QuestWizardData {
  const now = new Date();
  const inOneWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return {
    basics: {
      questType: "product-testing",
      title: "",
      description: "",
      completionDuration: "10 mins",
      participantLimit: 100,
      visibility: "public",
    },
    eligibility: {
      whoCanParticipate: "Anyone with an eligible account",
      maxSubmissionsPerParticipant: 1,
      eligibleRegions: "All",
      previousWinnersCanParticipate: false,
      additionalRequirement: "",
    },
    tasks: [
      createTaskBlock({ responseType: "paragraph" }),
      createTaskBlock({ responseType: "upload" }),
    ],
    rewards: {
      rewardMethod: "Selected winners",
      totalRewardBudget: 640,
      numberOfWinners: 64,
    },
    schedule: {
      publishOption: "immediately",
      startDateTime: toDateTimeLocal(now),
      closingDateTime: toDateTimeLocal(inOneWeek),
      timeZone: "UTC",
      winnerAnnouncement: toDateTimeLocal(inOneWeek),
      autoCloseWhenFull: false,
    },
  };
}

export function toDateTimeLocal(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDateTime(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function rewardCalculations(rewards: RewardsData) {
  const platformFee = rewards.totalRewardBudget * PLATFORM_FEE_RATE;
  const networkFee = NETWORK_FEE_ESTIMATE;
  const totalRequired = rewards.totalRewardBudget + platformFee + networkFee;
  const remaining = AVAILABLE_WALLET_BALANCE - totalRequired;
  const rewardPerWinner =
    rewards.numberOfWinners > 0
      ? rewards.totalRewardBudget / rewards.numberOfWinners
      : 0;

  return {
    platformFee,
    networkFee,
    totalRequired,
    remaining,
    rewardPerWinner,
  };
}

/**
 * Issue #329: Restores wizard form fields from a saved backend draft.
 */
export function restoreWizardDataFromDraft(
  draftData: unknown,
  draftTitle?: string,
): { data: QuestWizardData; currentIndex: number; maxReachedIndex: number } {
  const defaultData = createDefaultWizardData();
  if (!draftData || typeof draftData !== "object") {
    if (draftTitle) {
      defaultData.basics.title = draftTitle;
    }
    return { data: defaultData, currentIndex: 0, maxReachedIndex: 0 };
  }

  const raw = draftData as Record<string, unknown>;
  const rawWizard = (raw._wizardState && typeof raw._wizardState === "object"
    ? raw._wizardState
    : {}) as Record<string, unknown>;
  const rawBasics = (raw.basics && typeof raw.basics === "object"
    ? raw.basics
    : {}) as Record<string, unknown>;
  const rawEligibility = (raw.eligibility && typeof raw.eligibility === "object"
    ? raw.eligibility
    : {}) as Record<string, unknown>;
  const rawRewards = (raw.rewards && typeof raw.rewards === "object"
    ? raw.rewards
    : {}) as Record<string, unknown>;
  const rawSchedule = (raw.schedule && typeof raw.schedule === "object"
    ? raw.schedule
    : {}) as Record<string, unknown>;

  const restored: QuestWizardData = {
    basics: {
      ...defaultData.basics,
      ...(rawBasics as Partial<QuestWizardData["basics"]>),
      title:
        typeof rawBasics.title === "string"
          ? rawBasics.title
          : draftTitle || defaultData.basics.title,
    },
    eligibility: {
      ...defaultData.eligibility,
      ...(rawEligibility as Partial<QuestWizardData["eligibility"]>),
    },
    tasks:
      Array.isArray(raw.tasks) && raw.tasks.length > 0
        ? raw.tasks.map((t) =>
            createTaskBlock(
              t && typeof t === "object" ? (t as Partial<TaskBlock>) : {},
            ),
          )
        : defaultData.tasks,
    rewards: {
      ...defaultData.rewards,
      ...(rawRewards as Partial<QuestWizardData["rewards"]>),
    },
    schedule: {
      ...defaultData.schedule,
      ...(rawSchedule as Partial<QuestWizardData["schedule"]>),
    },
  };

  const currentIndex =
    typeof rawWizard.currentIndex === "number" ? rawWizard.currentIndex : 0;
  const maxReachedIndex =
    typeof rawWizard.maxReachedIndex === "number"
      ? rawWizard.maxReachedIndex
      : currentIndex;

  return {
    data: restored,
    currentIndex: Math.min(Math.max(0, currentIndex), WIZARD_STEPS.length - 1),
    maxReachedIndex: Math.min(
      Math.max(0, maxReachedIndex),
      WIZARD_STEPS.length - 1,
    ),
  };
}

