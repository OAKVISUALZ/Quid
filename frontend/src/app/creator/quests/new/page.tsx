"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import QuestsHub from "@/components/creator/quests/QuestsHub";
import QuestWizard from "@/components/creator/quests/wizard/QuestWizard";
import PublishSuccess from "@/components/creator/quests/wizard/PublishSuccess";

function CreateQuestWizardContainer({
  onPublish,
}: {
  onPublish: (id: string) => void;
}) {
  const searchParams = useSearchParams();
  const initialResume = searchParams.get("resume") === "true";
  const initialDraftId = searchParams.get("draftId") || undefined;

  return (
    <QuestWizard
      onPublish={onPublish}
      initialResume={initialResume}
      initialDraftId={initialDraftId}
    />
  );
}

export default function CreateQuestPage() {
  const router = useRouter();
  const [publishedQuestId, setPublishedQuestId] = useState<string | null>(null);

  if (publishedQuestId) {
    return <PublishSuccess questId={publishedQuestId} />;
  }

  return (
    <>
      <div className="h-[calc(100vh-5rem)] overflow-y-auto px-5 py-4 sm:px-8 sm:py-6 lg:px-12">
        <QuestsHub />
      </div>

      <div className="fixed inset-0 z-50">
        <button
          type="button"
          aria-label="Close quest creator"
          onClick={() => router.push("/creator/quests")}
          className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"
        />

        <div className="absolute inset-y-0 right-0 w-full border-l border-foreground/30 bg-background brutal-grid-bg shadow-2xl sm:w-[45%]">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center p-6 text-xs uppercase tracking-wider text-muted-foreground">
                Loading draft wizard...
              </div>
            }
          >
            <CreateQuestWizardContainer onPublish={setPublishedQuestId} />
          </Suspense>
        </div>
      </div>
    </>
  );
}
