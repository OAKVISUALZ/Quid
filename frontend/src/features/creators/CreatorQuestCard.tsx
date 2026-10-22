import React from "react";
import Image from "next/image";
import Link from "next/link";
import briefcaseIcon from "../../../public/quest-detail/briefcase-icon.png";
import stellarIcon from "../../../public/quest-detail/stellar-icon.png";

interface CreatorQuestCardProps {
  id?: string;
  title: string;
  /** Issue #325: free-text category from mission metadata, not a fixed set. */
  category: string;
  budget: string;
  dueDate: string;
  submissionCount: {
    current: number;
    total: number;
  };
  brand?: string;
  icon?: string;
}

export const CreatorQuestCard: React.FC<CreatorQuestCardProps> = ({
  id,
  title,
  category,
  budget,
  dueDate,
  submissionCount,
  brand = "Ruze.stellar",
  icon = "/namelogo.png",
}) => {
  const content = (
    <article className="grid gap-5 brutal-border brutal-shadow bg-card p-4 sm:grid-cols-[96px_1fr_auto] sm:items-center">
      <Image
        src={icon}
        alt=""
        width={96}
        height={96}
        className="size-20 brutal-border object-cover sm:size-24"
      />
      <div className="min-w-0">
        <h2 className="truncate text-xl font-black uppercase tracking-tight text-foreground transition-colors group-hover:text-brutal-violet sm:text-2xl">
          {title}
        </h2>
        <p className="mt-2 text-muted-foreground">{brand}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-2">
            <Image
              src={briefcaseIcon}
              alt=""
              width={14}
              height={14}
              className="h-3.5 w-3.5"
            />
            {category} Quest
          </span>
          <span className="flex items-center gap-2">
            <Image
              src={stellarIcon}
              alt=""
              width={14}
              height={14}
              className="h-3.5 w-3.5"
            />
            {budget}
          </span>
          <span>{dueDate}</span>
        </div>
      </div>
      <div className="text-3xl font-black text-foreground">
        {submissionCount.current}
        <span className="text-muted-foreground"> / {submissionCount.total}</span>
      </div>
    </article>
  );

  if (id) {
    return (
      <Link href={`/creator/quests/${id}`} className="group block">
        {content}
      </Link>
    );
  }

  return <div className="group">{content}</div>;
};
