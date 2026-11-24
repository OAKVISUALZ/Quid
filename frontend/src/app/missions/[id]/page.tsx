import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import {
  fetchPublicMission,
  getMissionVisibility,
  isIndexableMission,
} from "@/lib/missions-api";
import { getAbsoluteUrl } from "@/lib/site-url";

export const revalidate = 3600;

interface MissionPageProps {
  params: Promise<{ id: string }>;
}

async function loadMission(id: string) {
  try {
    const mission = await fetchPublicMission(id);
    if (!mission || !isIndexableMission(mission)) return null;
    return mission;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: MissionPageProps): Promise<Metadata> {
  const { id } = await params;
  const mission = await loadMission(id);
  const url = getAbsoluteUrl(`/missions/${encodeURIComponent(id)}`);

  if (!mission) {
    return {
      title: "Mission unavailable | Quid",
      robots: { index: false, follow: false },
      alternates: { canonical: url },
    };
  }

  return {
    title: `${mission.title} | Quid missions`,
    description:
      mission.aiSummary ||
      "Join a public on-chain QA and UX testing mission on Quid.",
    alternates: { canonical: url },
    openGraph: {
      title: mission.title,
      description: mission.aiSummary || "Public Quid testing mission",
      url,
      type: "article",
      siteName: "Quid",
    },
    robots: { index: true, follow: true },
  };
}

export default async function MissionDetailPage({ params }: MissionPageProps) {
  const { id } = await params;
  const mission = await loadMission(id);

  if (!mission) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-2xl font-black uppercase">Mission unavailable</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This mission is private, unlisted, or no longer accepting reports.
        </p>
        <Link
          href="/leaderboard"
          className="mt-6 inline-block border-2 border-foreground bg-brutal-yellow px-4 py-2 text-sm font-bold"
        >
          View public activity
        </Link>
      </main>
    );
  }

  const url = getAbsoluteUrl(`/missions/${encodeURIComponent(mission.id)}`);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Quid", item: getAbsoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: "Leaderboard", item: getAbsoluteUrl("/leaderboard") },
          { "@type": "ListItem", position: 3, name: mission.title, item: url },
        ],
      },
      {
        "@type": "JobPosting",
        title: mission.title,
        description: mission.aiSummary || "On-chain QA and UX testing mission.",
        datePosted: mission.createdAt,
        employmentType: "PART_TIME",
        hiringOrganization: {
          "@type": "Organization",
          name: mission.owner?.displayName || "Quid creator",
        },
        jobLocation: {
          "@type": "Place",
          address: { "@type": "PostalAddress", addressLocality: "Remote" },
        },
        applicantLocationRequirements: { "@type": "Country", name: "Any" },
      },
    ],
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <JsonLd value={structuredData} />
      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-muted-foreground">
        <Link href="/" className="underline">Home</Link>
        <span aria-hidden="true"> / </span>
        <Link href="/leaderboard" className="underline">Leaderboard</Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{mission.title}</span>
      </nav>

      <article className="brutal-border brutal-shadow bg-card p-6">
        <p className="text-xs font-black uppercase tracking-widest text-brutal-pink">
          {mission.status} · {getMissionVisibility(mission)}
        </p>
        <h1 className="mt-2 text-3xl font-black uppercase">{mission.title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {mission.aiSummary || "No public summary has been provided for this mission."}
        </p>
        <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="border-2 border-foreground p-3">
            <dt className="text-xs uppercase text-muted-foreground">Reward</dt>
            <dd className="mt-1 font-bold">{mission.rewardAmount} {mission.rewardToken}</dd>
          </div>
          <div className="border-2 border-foreground p-3">
            <dt className="text-xs uppercase text-muted-foreground">Participants</dt>
            <dd className="mt-1 font-bold">{mission.participantsCount} / {mission.maxParticipants}</dd>
          </div>
          <div className="border-2 border-foreground p-3">
            <dt className="text-xs uppercase text-muted-foreground">Reports</dt>
            <dd className="mt-1 font-bold">{mission._count?.submissions ?? 0}</dd>
          </div>
        </dl>
        <Link
          href="/connect-wallet"
          className="mt-8 inline-block border-2 border-foreground bg-brutal-yellow px-5 py-3 text-sm font-bold"
        >
          Connect wallet to join
        </Link>
      </article>
    </main>
  );
}
