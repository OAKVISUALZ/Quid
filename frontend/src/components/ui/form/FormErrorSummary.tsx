"use client";

import { useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";

export interface FormErrorSummaryProps {
  errors: string[];
  title?: string;
}

export function FormErrorSummary({
  errors,
  title = "Fix the following before continuing",
}: FormErrorSummaryProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, [errors]);

  if (errors.length === 0) return null;

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="alert"
      aria-live="assertive"
      className="mb-4 border-[3px] border-brutal-pink bg-brutal-pink/10 p-4 text-foreground outline-none"
    >
      <div className="flex items-center gap-2 text-sm font-bold">
        <AlertCircle className="size-4" aria-hidden="true" />
        {title}
      </div>
      <ul className="mt-2 list-inside list-disc text-sm text-muted-foreground">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}

export default FormErrorSummary;
