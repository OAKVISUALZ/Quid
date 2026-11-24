import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileText, ShieldCheck, Wallet } from 'lucide-react';
import QuidLogo from '@/components/brand/QuidLogo';
import { Footer } from '@/features/landing';
import { brutalBtnPrimary } from '@/lib/brutalist-classes';
import { SafeExternalLink } from '@/components/ui/safe-external-link';

export const metadata: Metadata = {
  title: 'Terms and Conditions | Quid',
  description:
    'Terms of Service and Conditions for using Quid, connecting Stellar wallets, and participating in feedback missions.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background brutal-grid-bg text-foreground">
      {/* Top Navigation */}
      <header className="border-b-[3px] border-foreground bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link href="/" aria-label="Go to Quid home">
              <QuidLogo />
            </Link>
            <div className="hidden h-6 w-[2px] bg-foreground md:block" />
            <nav className="hidden items-center gap-4 text-xs font-bold uppercase tracking-wider sm:flex">
              <Link
                href="/terms"
                className="border-b-2 border-foreground pb-0.5 text-foreground"
              >
                Terms of Service
              </Link>
              <Link
                href="/privacy"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacy Policy
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back Home</span>
            </Link>
            <Link
              href="/connect-wallet"
              className="brutal-border brutal-shadow inline-flex items-center gap-2 bg-brutal-yellow px-4 py-2 text-xs font-black uppercase tracking-wide text-foreground transition hover:translate-x-[-1px] hover:translate-y-[-1px]"
            >
              <Wallet className="h-4 w-4" />
              <span>Connect Wallet</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Page Header */}
        <div className="mb-10">
          <div className="mb-4 inline-flex items-center gap-2 brutal-border bg-brutal-cyan px-3 py-1 text-xs font-black uppercase tracking-widest text-foreground">
            <FileText className="h-3.5 w-3.5" />
            <span>Legal Documentation</span>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight sm:text-5xl">
            Terms and Conditions
          </h1>
          <p className="mt-3 text-base font-medium text-muted-foreground sm:text-lg">
            Last Updated: September 2026 • Effective upon connecting your wallet or accessing Quid
          </p>
        </div>

        {/* Quick Consent Notice Box */}
        <div className="mb-12 brutal-border brutal-shadow-lg bg-brutal-yellow/20 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="brutal-border bg-brutal-yellow p-2">
              <ShieldCheck className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight text-foreground sm:text-xl">
                Wallet Consent & Non-Custodial Agreement
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                By connecting your Stellar wallet (such as Freighter) or interacting with Quid
                smart contracts, you explicitly acknowledge and consent to our non-custodial
                architecture. Quid does not custody private keys, hold your assets, or have the
                ability to reverse on-chain transactions. All mission escrows, reviews, and
                token distributions execute via Soroban smart contracts on the Stellar network.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  href="/privacy"
                  className="text-xs font-bold uppercase underline underline-offset-4 hover:text-brutal-violet transition-colors"
                >
                  Read Privacy Policy →
                </Link>
                <span className="text-xs text-muted-foreground">•</span>
                <Link
                  href="/connect-wallet"
                  className="text-xs font-bold uppercase underline underline-offset-4 hover:text-brutal-violet transition-colors"
                >
                  Return to Wallet Connection →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Legal Body Sections */}
        <div className="space-y-10 brutal-border brutal-shadow-lg bg-card p-6 sm:p-10 text-foreground">
          {/* Section 1 */}
          <section className="space-y-3">
            <h3 className="text-xl font-black uppercase tracking-tight">
              1. Acceptance of Terms
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              These Terms and Conditions (&quot;Terms&quot;) constitute a legally binding agreement
              between you (&quot;User&quot;, &quot;you&quot;, or &quot;your&quot;) and Quid
              (&quot;Quid&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). By accessing
              our website, connecting your digital asset wallet, or interacting with any Quid smart
              contracts or protocols, you agree to be bound by these Terms. If you do not agree
              with any part of these Terms, you must immediately disconnect your wallet and cease
              all use of Quid.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h3 className="text-xl font-black uppercase tracking-tight">
              2. Platform Overview & Ecosystem Roles
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Quid is a decentralized user feedback and testing platform designed for the Stellar
              ecosystem. The platform bridges two primary roles:
            </p>
            <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground pl-2">
              <li>
                <strong className="text-foreground">Creators:</strong> Project creators
                who publish missions, define testing criteria, escrow bounty rewards (in USDC or
                XLM), review community submissions, and approve payouts.
              </li>
              <li>
                <strong className="text-foreground">Hunters (Contributors / Earners):</strong> Users
                who test Stellar decentralized applications, provide insightful product feedback,
                submit proof of completion, and earn rewards upon verified approval.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h3 className="text-xl font-black uppercase tracking-tight">
              3. Non-Custodial Architecture & Wallet Security
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Quid operates strictly on a non-custodial model:
            </p>
            <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground pl-2">
              <li>
                We do not have access to, nor do we store, your private keys, seed phrases, or
                wallet credentials.
              </li>
              <li>
                You are solely responsible for safeguarding your wallet credentials and maintaining
                adequate security measures on your personal devices.
              </li>
              <li>
                Any transaction authorized through your connected wallet is irreversible once
                confirmed on the Stellar ledger. Quid cannot recover lost funds or reverse transactions.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h3 className="text-xl font-black uppercase tracking-tight">
              4. Soroban Smart Contracts & On-Chain Escrows
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Bounties, reputation tracking, and dispute procedures are governed by autonomous
              Soroban smart contracts deployed to the Stellar network. By utilizing these features:
            </p>
            <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground pl-2">
              <li>
                Creators agree to escrow agreed-upon bounty sums prior to mission launch. Escrowed
                funds are unlocked and disbursed according to smart contract rules upon milestone
                approval.
              </li>
              <li>
                Hunters agree that rewards are contingent upon meeting the explicit criteria defined
                by the creator. Submitting low-quality, automated, or fraudulent feedback may result
                in submission rejection and impact your on-chain reputation score.
              </li>
              <li>
                Users assume all risks associated with blockchain network congestion, fee
                fluctuations, protocol upgrades, and potential smart contract vulnerabilities.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h3 className="text-xl font-black uppercase tracking-tight">
              5. Submission Standards & Intellectual Property
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              When submitting feedback, bug reports, recordings, or documentation on Quid:
            </p>
            <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground pl-2">
              <li>
                You represent and warrant that your submission is your own original work and does
                not infringe on any third-party intellectual property or privacy rights.
              </li>
              <li>
                You grant the creator of the tested application a perpetual, worldwide,
                royalty-free license to use, review, implement, and reproduce the feedback for product
                enhancement.
              </li>
              <li>
                Uploaded content may be anchored to decentralized storage networks (such as IPFS)
                where content identifiers (CIDs) are immutable and publicly accessible.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h3 className="text-xl font-black uppercase tracking-tight">
              6. Prohibited Activities
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Users agree not to engage in any of the following prohibited behaviors:
            </p>
            <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground pl-2">
              <li>
                Deploying bots, scripts, or automated mechanisms to farm bounties or manipulate
                reputation scores (Sybil attacks).
              </li>
              <li>
                Attempting to exploit, decompile, or compromise Quid smart contracts or backend
                infrastructure.
              </li>
              <li>
                Submitting malicious URLs, payloads, trojans, or illicit content in feedback proof
                uploads.
              </li>
              <li>
                Using the platform in violation of any applicable international sanctions, laws, or
                regulations.
              </li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h3 className="text-xl font-black uppercase tracking-tight">
              7. Disclaimers & Limitation of Liability
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              THE QUID PLATFORM, SERVICES, AND SMART CONTRACTS ARE PROVIDED ON AN &quot;AS IS&quot;
              AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
              IMPLIED. TO THE FULLEST EXTENT PERMISSIBLE UNDER APPLICABLE LAW, QUID DISCLAIMS ALL
              WARRANTIES, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
              NON-INFRINGEMENT. QUID SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR
              CONSEQUENTIAL DAMAGES ARISING FROM WALLET TRANSACTIONS, SMART CONTRACT EXECUTION,
              TOKEN VOLATILITY, OR UNAUTHORIZED ACCOUNT ACCESS.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h3 className="text-xl font-black uppercase tracking-tight">
              8. Modifications to Terms
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We reserve the right to revise or update these Terms at any time to reflect protocol
              evolutions, regulatory requirements, or service improvements. Changes are effective
              immediately upon posting to this URL. Your continued interaction with Quid after any
              update signifies your agreement to the revised Terms.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h3 className="text-xl font-black uppercase tracking-tight">
              9. Contact & Inquiries
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              If you have any questions or require clarification regarding these Terms and
              Conditions, please join our community forum or contact us through our official
              GitHub repository at{' '}
              <SafeExternalLink
                href="https://github.com/Quid-proquo/Quid"
                untrusted={false}
                className="font-bold underline text-foreground hover:text-brutal-pink transition-colors"
              >
                github.com/Quid-proquo/Quid
              </SafeExternalLink>
              .
            </p>
          </section>
        </div>

        {/* Bottom CTA Block */}
        <div className="mt-12 brutal-border brutal-shadow-lg bg-card p-6 text-center sm:p-8">
          <h3 className="text-xl font-black uppercase tracking-tight sm:text-2xl">
            Ready to participate in Quid?
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Connect your wallet to start testing top Stellar applications and earning rewards.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Link href="/connect-wallet" className={brutalBtnPrimary}>
              Connect Wallet Now
            </Link>
            <Link
              href="/privacy"
              className="brutal-border brutal-shadow bg-background px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-foreground transition hover:bg-muted"
            >
              View Privacy Policy
            </Link>
          </div>
        </div>
      </main>

      {/* Shared Footer */}
      <Footer />
    </div>
  );
}
