"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Wallet,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Droplets,
  ArrowDownToLine,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { useWallet } from "@/app/hooks/useWallet";
import { SafeExternalLink } from "@/components/ui/safe-external-link";



function formatXlm(value: string | null): string {
  if (value === null) return "0";
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString("en-US", { maximumFractionDigits: 7 });
}

function truncateKey(key: string): string {
  if (key.length <= 8) return key;
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const sec = Math.floor((Date.now() - then) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-US");
}

export default function WalletPage() {
  const {
    publicKey,
    isConnected,
    xlm,
    usdc,
    transactions,
    funded,
    loading,
    error,
    refreshBalances,
    fundWithFriendbot,
    funding,
  } = useWallet();

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  if (!isConnected || !publicKey) {
    return (
      <div className="text-foreground">
        <WalletPageToolbar onRefresh={refreshBalances} loading={loading} />
        <div className="px-5 py-8 sm:px-8 lg:px-12">
          <div className="max-w-md mx-auto mt-16 brutal-border brutal-shadow bg-card border border-foreground  p-8 text-center">
            <Wallet className="w-12 h-12 text-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">No wallet connected</h2>
            <p className="text-sm text-[#8C86B8] mb-6">
              Connect a Stellar wallet to view your balances and address.
            </p>
            <Link
              href="/connect-wallet"
              className="inline-flex items-center justify-center min-h-11 brutal-border brutal-shadow bg-brutal-pink hover:translate-x-[-1px] hover:translate-y-[-1px] text-foreground font-semibold px-6 py-2.5  transition-colors"
            >
              Connect Wallet
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-foreground">
      <WalletPageToolbar onRefresh={refreshBalances} loading={loading} />

      <div className="space-y-6 px-5 py-6 sm:px-8 lg:px-12">
        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-300  px-4 py-3 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Unfunded testnet account → Friendbot */}
        {!loading && !funded && (
          <div className="brutal-border brutal-shadow bg-card border border-yellow-500/30  p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-400 shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Account not funded</h3>
                <p className="text-sm text-[#8C86B8] mb-4">
                  This account does not exist on the network yet. Fund it with
                  Friendbot to get free testnet XLM.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={fundWithFriendbot}
                    disabled={funding}
                    className="flex items-center justify-center gap-2 min-h-11 brutal-border brutal-shadow bg-brutal-pink hover:translate-x-[-1px] hover:translate-y-[-1px] text-foreground font-semibold px-5 py-2.5  transition-colors disabled:opacity-50"
                  >
                    <Droplets
                      className={`w-4 h-4 ${funding ? "animate-pulse" : ""}`}
                    />
                    {funding ? "Funding..." : "Fund with Friendbot"}
                  </button>
                  <SafeExternalLink
                    href={`https://lab.stellar.org/account/fund?addr=${publicKey}`}
                    untrusted={false}
                    className="flex items-center justify-center gap-2 min-h-11 border border-foreground hover:brutal-border bg-background text-foreground font-medium px-5 py-2.5  transition-colors"
                  >
                    Open Stellar Laboratory
                    <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  </SafeExternalLink>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Wallet Balance card — real on-chain balances only */}
        <div className=" border border-foreground bg-gradient-to-br from-[#1A1330] to-[#141026] p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-foreground mb-3">
                <Wallet className="w-5 h-5" />
                <span className="text-sm font-medium">Horizon Balances</span>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <div className="flex items-center gap-2">
                  <Image
                    src="/stellarlogo.png"
                    alt="XLM"
                    width={24}
                    height={24}
                  />
                  {loading ? (
                    <span className="inline-block h-6 w-28 bg-[#241B4A] rounded animate-pulse" />
                  ) : (
                    <span className="text-2xl sm:text-3xl font-bold tabular-nums">
                      {formatXlm(xlm)}
                    </span>
                  )}
                  <span className="text-sm text-[#8C86B8] font-medium">XLM</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-green-400 text-xs font-bold">$</span>
                  </div>
                  {loading ? (
                    <span className="inline-block h-6 w-24 bg-[#241B4A] rounded animate-pulse" />
                  ) : usdc !== null ? (
                    <>
                      <span className="text-2xl sm:text-3xl font-bold tabular-nums">
                        {formatXlm(usdc)}
                      </span>
                      <span className="text-sm text-[#8C86B8] font-medium">USDC</span>
                    </>
                  ) : (
                    <span className="text-sm text-[#8C86B8]">No USDC trustline</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                disabled
                title="Coming soon — withdrawals are not yet available"
                className="flex items-center justify-center gap-2 min-h-11 brutal-border brutal-shadow bg-brutal-pink/50 text-muted-foreground font-semibold px-5 py-2.5  cursor-not-allowed"
              >
                <ArrowDownToLine className="w-4 h-4" />
                Withdraw Funds
                <span className="text-[10px] uppercase tracking-wider bg-[#1A1330] px-1.5 py-0.5 rounded">Coming soon</span>
              </button>
              {!loading && funded && (
                <button
                  onClick={fundWithFriendbot}
                  disabled={funding}
                  className="flex items-center justify-center gap-2 min-h-11 border border-foreground hover:brutal-border bg-background text-foreground font-semibold px-5 py-2.5  transition-colors disabled:opacity-50"
                >
                  <Droplets className={`w-4 h-4 ${funding ? "animate-pulse" : ""}`} />
                  {funding ? "Funding..." : "Fund with Friendbot"}
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 text-xs text-[#6B6494]">
            All displayed balances reflect real on-chain data from the Stellar network.
          </div>
        </div>

        {/* Transactions + Withdrawal method */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Transactions */}
          <div className="lg:col-span-2">
            <h2 className="text-base font-semibold mb-4">Recent Transactions</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-[#8C86B8] border-b border-foreground">
                    <th className="font-medium py-3 pr-4">Type</th>
                    <th className="font-medium py-3 pr-4">From / To</th>
                    <th className="font-medium py-3 pr-4">Amount</th>
                    <th className="font-medium py-3 pr-4">Status</th>
                    <th className="font-medium py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr
                        key={i}
                        className="border-b border-foreground/60 last:border-0"
                      >
                        <td colSpan={5} className="py-4">
                          <span className="block h-5 w-full bg-[#241B4A] rounded animate-pulse" />
                        </td>
                      </tr>
                    ))
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-10 text-center text-[#8C86B8]"
                      >
                        No transactions yet.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="border-b border-foreground/60 last:border-0"
                      >
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`flex items-center justify-center w-7 h-7 rounded-md ${
                                tx.direction === "in"
                                  ? "bg-green-500/15 text-green-400"
                                  : "bg-orange-500/15 text-orange-400"
                              }`}
                            >
                              {tx.direction === "in" ? (
                                <ArrowDownLeft className="w-4 h-4" />
                              ) : (
                                <ArrowUpRight className="w-4 h-4" />
                              )}
                            </span>
                            <span
                              className={
                                tx.direction === "in"
                                  ? "text-green-400"
                                  : "text-orange-400"
                              }
                            >
                              {tx.direction === "in" ? "Received" : "Sent"}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 pr-4 max-w-[200px]">
                          <SafeExternalLink
                            href={`https://stellar.expert/explorer/testnet/account/${tx.counterparty}`}
                            untrusted={false}
                            title={tx.counterparty}
                            className="block truncate font-mono text-xs text-foreground hover:text-foreground"
                          >
                            {truncateKey(tx.counterparty)}
                          </SafeExternalLink>
                        </td>
                        <td
                          className={`py-4 pr-4 whitespace-nowrap tabular-nums ${
                            tx.direction === "in"
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          {tx.direction === "in" ? "+" : "-"}
                          {formatXlm(tx.amount)} {tx.assetCode}
                        </td>
                        <td className="py-4 pr-4">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-xs ${
                              tx.successful
                                ? "bg-green-500/15 text-green-400"
                                : "bg-red-500/15 text-red-400"
                            }`}
                          >
                            {tx.successful ? "Successful" : "Failed"}
                          </span>
                        </td>
                        <td className="py-4 whitespace-nowrap text-[#8C86B8]">
                          {timeAgo(tx.date)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Withdrawal Method */}
          <div className="lg:col-span-1">
            <h2 className="text-base font-semibold mb-4">Withdrawal Method</h2>
            <div className="brutal-border brutal-shadow bg-card border border-foreground  p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex items-center justify-center w-9 h-9  brutal-border bg-background shrink-0">
                    <Wallet className="w-5 h-5 text-foreground" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      Stellar Wallet 1 (XLM)
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="font-mono text-xs text-[#8C86B8]"
                        title={publicKey}
                      >
                        {truncateKey(publicKey)}
                      </span>
                      <button
                        onClick={handleCopy}
                        aria-label="Copy wallet address"
                        className="text-[#8C86B8] hover:text-foreground transition-colors"
                      >
                        {copied ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  disabled
                  title="Coming soon"
                  className="flex items-center gap-1 text-sm text-[#6B6494] cursor-not-allowed shrink-0"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  <span className="hidden sm:inline">Withdraw</span>
                  <span className="text-[10px] uppercase tracking-wider bg-[#1A1330] px-1 py-0.5 rounded">Soon</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WalletPageToolbar({
  onRefresh,
  loading,
}: {
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-foreground/30 px-5 py-5 sm:px-8 lg:px-12">
      <h1 className="text-xl font-semibold sm:text-2xl">Wallet</h1>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        aria-label="Refresh balances"
        className="flex min-h-9 min-w-9 items-center justify-center  transition-colors hover:bg-white/5 disabled:opacity-50"
      >
        <RefreshCw
          className={`size-5 text-muted-foreground ${loading ? "animate-spin" : ""}`}
        />
      </button>
    </div>
  );
}
