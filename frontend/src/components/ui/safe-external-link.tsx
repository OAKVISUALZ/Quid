"use client";

import { useState, type AnchorHTMLAttributes, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { isUserProvidedUrl } from "@/lib/contract-allowlist";

export interface SafeExternalLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  children: ReactNode;
  untrusted?: boolean;
}

export function SafeExternalLink({
  href,
  children,
  untrusted,
  className,
  onClick,
  ...rest
}: SafeExternalLinkProps) {
  const [confirmed, setConfirmed] = useState(false);
  const needsWarning = untrusted ?? isUserProvidedUrl(href);

  if (needsWarning && !confirmed) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 rounded border border-brutal-orange bg-brutal-orange/10 px-2 py-1 text-xs text-foreground">
        <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
        <span>External link from user-provided content</span>
        <button
          type="button"
          onClick={() => setConfirmed(true)}
          className="font-bold underline"
        >
          Continue
        </button>
      </span>
    );
  }

  return (
    <a
      {...rest}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      className={className}
      onClick={onClick}
    >
      {children}
    </a>
  );
}

export default SafeExternalLink;
