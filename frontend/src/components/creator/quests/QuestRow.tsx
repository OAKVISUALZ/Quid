import Image from "next/image";
import Link from "next/link";
import { Copy, SquarePen, Trash2 } from "lucide-react";
import stellarIcon from "../../../../public/quest-detail/stellar-icon.png";
import QuestRowMenu from "./QuestRowMenu";
import type { QuestRowData } from "./types";

const TAG_STYLES: Record<QuestRowData["tagVariant"], string> = {
  active: "bg-[#8B5CF6]/20 text-foreground",
  draft: "bg-white/10 text-muted-foreground",
  completed: "bg-emerald-500/15 text-emerald-400",
};

const PRIMARY_ACTION: Record<
  QuestRowData["tab"],
  { label: string; href: (id: string) => string }
> = {
  active: {
    label: "Review responses",
    href: (id) => `/creator/quests/${id}`,
  },
  drafted: {
    label: "Resume draft",
    href: (id) => `/creator/quests/new?resume=true&draftId=${encodeURIComponent(id)}`,
  },
  completed: {
    label: "View quest",
    href: (id) => `/creator/quests/${id}`,
  },
};

export default function QuestRow({ quest }: { quest: QuestRowData }) {
  const primaryAction = PRIMARY_ACTION[quest.tab];

  const menuOptions =
    quest.tab === "completed"
      ? null
      : quest.tab === "drafted"
        ? [
            { label: "Resume draft", icon: SquarePen },
            { label: "Duplicate quest", icon: Copy },
            { label: "Delete draft", icon: Trash2, danger: true },
          ]
        : [
            { label: "View quest", icon: SquarePen },
            { label: "Duplicate quest", icon: Copy },
            { label: "Cancel quest", icon: Trash2, danger: true },
          ];

  return (
    <div className="flex items-start gap-4 py-4 sm:items-center">
      <Link
        href={
          quest.tab === "drafted"
            ? `/creator/quests/new?resume=true&draftId=${encodeURIComponent(quest.id)}`
            : `/creator/quests/${quest.id}`
        }
        className="flex min-w-0 flex-1 items-start gap-4  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] sm:items-center"
      >
        <Image
          src="/namelogo.png"
          alt=""
          width={56}
          height={56}
          className="size-12 shrink-0  object-cover sm:size-14"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">
              {quest.title}
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${TAG_STYLES[quest.tagVariant]}`}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {quest.tagLabel}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {quest.category} • {quest.tagLabel}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Image
                src={stellarIcon}
                alt=""
                width={14}
                height={14}
                className="h-3.5 w-3.5"
              />
              <span className="font-medium text-muted-foreground">
                {quest.pool} XLM
              </span>{" "}
              Pool
            </span>
            <span className="flex items-center gap-1.5">
              <Image
                src={stellarIcon}
                alt=""
                width={14}
                height={14}
                className="h-3.5 w-3.5"
              />
              <span className="font-medium text-muted-foreground">
                {quest.perWinner} XLM
              </span>{" "}
              Per winner
            </span>
            <span>{quest.responses} responses</span>
            <span>{quest.meta}</span>
          </div>
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={primaryAction.href(quest.id)}
          className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-white/5"
        >
          {primaryAction.label}
        </Link>
        {menuOptions ? <QuestRowMenu options={menuOptions} /> : null}
      </div>
    </div>
  );
}
