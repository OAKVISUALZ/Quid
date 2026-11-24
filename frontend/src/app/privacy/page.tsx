import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Lock, ShieldCheck, Wallet } from 'lucide-react';
import QuidLogo from '@/components/brand/QuidLogo';
import { Footer } from '@/features/landing';
import { brutalBtnPrimary } from '@/lib/brutalist-classes';
import { SafeExternalLink } from '@/components/ui/safe-external-link';

export const metadata: Metadata = {
  title: 'Privacy Policy | Quid',
  description:
    'Privacy Policy for Quid users, explaining how public wallet addresses, on-chain records, and feedback proofs are handled.',
};

export default function PrivacyPage() {
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
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                href="/privacy"
                className="border-b-2 border-foreground pb-0.5 text-foreground"
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
          <div className="mb-4 inline-flex items-center gap-2 brutal-border bg-brutal-lime px-3 py-1 text-xs font-black uppercase tracking-widest text-foreground">
            <Lock className="h-3.5 w-3.5" />
            <span>Data Protection & Privacy</span>
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight sm:text-5xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-base font-medium text-muted-foreground sm:text-lg">
            Last Updated: September 2026 • Transparency and data control for the decentralized web
          </p>
        </div>

        {/* Quick Consent Notice Box */}
        <div className="mb-12 brutal-border brutal-shadow-lg bg-brutal-cyan/20 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="brutal-border bg-brutal-cyan p-2">
              <ShieldCheck className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight text-foreground sm:text-xl">
                Wallet Privacy & Blockchain Transparency Notice
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Connecting your wallet shares your public Stellar address with Quid to allow you to
                create or submit missions. We do not collect passwords, private keys, or personal
                identity numbers. Please be aware that public blockchain transactions, contract
                calls, and escrow payouts on the Stellar network are publicly visible and permanently
                immutable.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link
                  href="/terms"
                  className="text-xs font-bold uppercase underline underline-offset-4 hover:text-brutal-pink transition-colors"
                >
                  Read Terms of Service →
                </Link>
                <span className="text-xs text-muted-foreground">•</span>
                <Link
                  href="/connect-wallet"
                  className="text-xs font-bold uppercase underline underline-offset-4 hover:text-brutal-pink transition-colors"
                >
                  Return to Wallet Connection →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Body Sections */}
        <div className="space-y-10 brutal-border brutal-shadow-lg bg-card p-6 sm:p-10 text-foreground">
          {/* Section 1 */}
          <section className="space-y-3">
            <h3 className="text-xl font-black uppercase tracking-tight">
              1. Overview & Commitment to Privacy
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              At Quid, we believe in user autonomy, decentralization, and privacy by design. We do
              not engage in selling user data or predatory behavioral ad tracking. This Privacy
              Policy details what data is collected, how it is utilized, and your rights when
              interacting with the Quid platform, connecting a non-custodial wallet, or submitting
              product feedback.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h3 className="text-xl font-black uppercase tracking-tight">
              2. Information We Process
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Depending on how you interact with Quid, we may process the following types of
              information:
            </p>
            <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground pl-2">
              <li>
                <strong className="text-foreground">Public Stellar Wallet Address:</strong> When
                you connect your wallet (e.g. Freighter), your public key (e.g., G...) is read to
                authenticate your session, match submissions, and route escrow payouts.
              </li>
              <li>
                <strong className="text-foreground">Mission Submissions & Feedback:</strong> Responses,
                ratings, bug reports, and survey answers you provide during testing missions.
              </li>
              <li>
                <strong className="text-foreground">Proof Files & Attachments:</strong> Screenshots,
                screen recordings, or diagnostic logs uploaded to demonstrate mission completion.
              </li>
              <li>
                <strong className="text-foreground">Technical & Diagnostic Logs:</strong> Standard
                server access logs, browser user-agent strings, and error telemetry to maintain system
                reliability and debug integration issues.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h3 className="text-xl font-black uppercase tracking-tight">
              3. How We Use Processed Data
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We process information solely for the following legitimate purposes:
            </p>
            <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground pl-2">
              <li>
                To provide and operate the decentralized mission board and reward distribution
                system.
              </li>
              <li>
                To enable creators to review hunter feedback and approve milestone payouts.
              </li>
              <li>
                To prevent fraud, automated bot farming, and Sybil attacks on the platform.
              </li>
              <li>
                To interact with Soroban smart contracts for on-chain reputation calculations.
              </li>
              <li>
                To diagnose bugs, optimize page loading performance, and improve the user
                experience.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h3 className="text-xl font-black uppercase tracking-tight">
              4. Blockchain Transparency & Ledger Immutability
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Please understand that blockchain systems are public ledgers by design. Any
              transaction you sign with your wallet—including escrow funding, contract invocations,
              and reward claims—becomes public knowledge on the Stellar blockchain. Quid does not
              control and cannot edit, redact, or delete data recorded on the Stellar ledger.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h3 className="text-xl font-black uppercase tracking-tight">
              5. Decentralized Storage & Third Parties
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Quid utilizes modern decentralized and Web3 infrastructure:
            </p>
            <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground pl-2">
              <li>
                <strong className="text-foreground">IPFS (InterPlanetary File System):</strong>{' '}
                Feedback proof blobs and mission submissions may be pinned to IPFS, resulting in a
                publicly verifiable Content Identifier (CID).
              </li>
              <li>
                <strong className="text-foreground">Wallet Providers:</strong> Wallet extensions
                (such as Freighter) operate under their own privacy policies and terms. We encourage
                you to review their security documentation.
              </li>
              <li>
                <strong className="text-foreground">Stellar Horizon & RPC:</strong> Network calls
                to query account balances and submit transactions route through Stellar Horizon and
                Soroban RPC nodes.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h3 className="text-xl font-black uppercase tracking-tight">
              6. Data Control, Disconnection & Your Rights
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              You maintain control over your engagement with Quid:
            </p>
            <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground pl-2">
              <li>
                You can disconnect your wallet at any time via the wallet connection button or your
                wallet extension settings.
              </li>
              <li>
                You can clear your cached account role and local preferences stored in your
                browser&apos;s localStorage at any time.
              </li>
              <li>
                You have the right to request information regarding any off-chain data retained by
                Quid servers in accordance with applicable data privacy laws (such as GDPR).
              </li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h3 className="text-xl font-black uppercase tracking-tight">
              7. Cookies & Local Storage
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Quid does not use third-party advertising cookies or cross-site tracking beacons. We
              use browser localStorage solely for operational preferences, such as caching your
              selected platform role (&quot;creator&quot; or &quot;hunter&quot;) and maintaining
              active session state across pages.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h3 className="text-xl font-black uppercase tracking-tight">
              8. Security Best Practices
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We employ strict security practices, including TLS/HTTPS encryption in transit,
              defense-in-depth API protection, and rigorous smart contract checks. However, no
              internet or blockchain transmission is completely immune to security threats. You
              should never share your wallet private keys with anyone claiming to represent Quid.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h3 className="text-xl font-black uppercase tracking-tight">
              9. Updates to Policy
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We may update this Privacy Policy from time to time. Any modifications will be
              reflected on this page with an updated &quot;Last Updated&quot; timestamp. We encourage
              users to review this page periodically.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <h3 className="text-xl font-black uppercase tracking-tight">
              10. Contact Us
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              For any questions regarding this Privacy Policy or your data, please contact our team
              via our open-source GitHub repository at{' '}
              <SafeExternalLink
                href="https://github.com/Quid-proquo/Quid"
                untrusted={false}
                className="font-bold underline text-foreground hover:text-brutal-cyan transition-colors"
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
            Have questions before connecting?
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Review our terms or connect your wallet to start participating in the Quid ecosystem.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Link href="/connect-wallet" className={brutalBtnPrimary}>
              Connect Wallet
            </Link>
            <Link
              href="/terms"
              className="brutal-border brutal-shadow bg-background px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-foreground transition hover:bg-muted"
            >
              View Terms of Service
            </Link>
          </div>
        </div>
      </main>

      {/* Shared Footer */}
      <Footer />
    </div>
  );
}
