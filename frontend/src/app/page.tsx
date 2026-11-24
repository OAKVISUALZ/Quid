import {
  HeroSection,
  FeatureHighlights,
  MoreFeatures,
  OpportunitiesSection,
  HowItWorksSection,
  RoadmapSection,
  FAQSection,
  BusinessCTASection,
  Footer,
} from "@/features/landing";
import { JsonLd } from "@/components/seo/json-ld";

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "Quid",
      url: "https://quid.app",
      description:
        "On-chain verified QA and UX testing for Stellar and Soroban builders.",
    },
    {
      "@type": "WebSite",
      name: "Quid",
      url: "https://quid.app",
      potentialAction: {
        "@type": "SearchAction",
        target: "https://quid.app/leaderboard?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function Home() {
  return (
    <div className="min-h-screen text-foreground brutal-grid-bg">
      <JsonLd value={structuredData} />
      <main>
        <HeroSection />
        <FeatureHighlights />
        <MoreFeatures />
        <OpportunitiesSection />
        <HowItWorksSection />
        <RoadmapSection />
        <FAQSection />
        <BusinessCTASection />
        <Footer />
      </main>
    </div>
  );
}
