export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return configured.replace(/\/$/, "");
}

export function getAbsoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalized}`;
}
