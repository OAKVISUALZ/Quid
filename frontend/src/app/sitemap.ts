import type { MetadataRoute } from "next";
import { fetchPublicMissions, isIndexableMission } from "@/lib/missions-api";
import { getAbsoluteUrl } from "@/lib/site-url";

export const revalidate = 3600;

const STATIC_ROUTES = [
  { path: "/", priority: 1 },
  { path: "/leaderboard", priority: 0.8 },
  { path: "/privacy", priority: 0.4 },
  { path: "/terms", priority: 0.4 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map(({ path, priority }) => ({
    url: getAbsoluteUrl(path),
    lastModified: now,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority,
  }));

  try {
    const missions = await fetchPublicMissions({ limit: 100, sort: "newest" });
    for (const mission of missions.filter(isIndexableMission)) {
      entries.push({
        url: getAbsoluteUrl(`/missions/${encodeURIComponent(mission.id)}`),
        lastModified: new Date(mission.updatedAt || mission.createdAt),
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  } catch {
    return entries;
  }

  return entries;
}
