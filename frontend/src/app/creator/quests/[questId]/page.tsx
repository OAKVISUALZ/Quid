'use client'
import { use } from "react";
import { useQuestData } from "@/app/hooks/useQuestData";
import CreatorQuestDetail from "@/features/creators/CreatorQuestDetail";

export default function QuestDetailPage({ params }: { params: Promise<{ questId: string }> }) {
  const { questId } = use(params);
  const { quest, submissions, loading, error, isForbidden, submissionsError, refetch } = useQuestData(questId);

  return (
    <CreatorQuestDetail
      quest={quest}
      questId={questId}
      isActive={quest?.status === 'active'}
      submissions={submissions}
      loading={loading}
      error={error}
      isForbidden={isForbidden}
      submissionsError={submissionsError}
      onRetry={refetch}
    />
  );
}
