"use client";

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import avatar from '../../../public/avatar.png';

interface ResponsePreviewProps {
  id: string;
  respondentName: string;
  respondentAvatar?: string;
  questTitle: string;
  timeSinceSubmission: string;
}

export const ResponsePreview: React.FC<ResponsePreviewProps> = ({
  respondentName,
  respondentAvatar,
  questTitle,
  timeSinceSubmission,
}) => {
  const router = useRouter();

  return (
    <div
      onClick={() => router.push('/creator/responses')}
      className="flex items-center p-2 sm:p-3 hover:bg-[#1a1a2e]/50 transition-colors cursor-pointer group rounded"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          router.push('/creator/responses');
        }
      }}
    >
      <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <Image
            src={respondentAvatar || avatar}
            alt={respondentName}
            width={40}
            height={40}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover ring-2 ring-purple-500/20 group-hover:ring-purple-500/40 transition-all"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-foreground font-medium text-xs sm:text-sm group-hover:text-brutal-violet transition-colors">
              {respondentName}
            </p>
            <span className="text-foreground text-xs whitespace-nowrap flex-shrink-0">{timeSinceSubmission}</span>
          </div>
          <p className="text-foreground text-xs truncate mt-0.5">
            {questTitle}
          </p>
        </div>
      </div>
    </div>
  );
};
