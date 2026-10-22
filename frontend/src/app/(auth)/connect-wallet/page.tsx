'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check } from 'lucide-react';
import type { SupportedWallet } from '@/context/WalletProvider';
import { useWallet } from '@/context/WalletProvider';
import { ONBOARDING_ROUTES } from '@/lib/onboarding';
import NetworkMismatchBanner from '@/components/wallet/NetworkMismatchBanner';
import { describeNetwork } from '@/lib/freighter-wallet';
import QuidLogo from '@/components/brand/QuidLogo';
import { brutalBtnPrimary } from '@/lib/brutalist-classes';

export default function ConnectWalletPage() {
  const {
    connect,
    connected,
    publicKey,
    walletName,
    getAvailableWallets,
    isNetworkMismatch,
    expectedNetwork,
  } = useWallet();
  const [availableWallets, setAvailableWallets] = useState<SupportedWallet[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Issue #332: AuthGuard sends unauthenticated users here with
  // `?returnTo=<path>` so they land back where they started instead of
  // always restarting at account selection. Only ever an in-app path.
  const rawReturnTo = searchParams.get('returnTo');
  const returnTo =
    rawReturnTo && rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//')
      ? rawReturnTo
      : null;
  const nextRoute = returnTo || ONBOARDING_ROUTES.accountType;

  useEffect(() => {
    const listAvailableWallets = async () => {
      const list = await getAvailableWallets();
      setAvailableWallets(list);
    };

    void listAvailableWallets();
  }, [getAvailableWallets]);

  const handleWalletSelect = async () => {
    if (connected) {
      router.push(nextRoute);
      return;
    }

    setIsConnecting(true);
    try {
      const address = await connect();
      if (address) {
        router.push(nextRoute);
      }
    } catch (error) {
      console.error('Wallet connection failed:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const shortAddress = publicKey
    ? `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`
    : '';

  return (
    <div className="min-h-screen brutal-grid-bg text-foreground grid place-items-center px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <QuidLogo width={140} height={44} />

        <div className="text-center">
          <h1 className="text-3xl font-black uppercase tracking-tight">
            Connect a wallet
          </h1>
          <p className="mt-3 text-sm font-medium text-muted-foreground">
            Choose a wallet to continue signing up. More options will be added
            soon.
          </p>
          {connected && (
            <p className="mt-3 text-sm font-bold text-foreground">
              Connected to {walletName} ({shortAddress})
            </p>
          )}
        </div>

        <NetworkMismatchBanner />

        <div className="brutal-border brutal-shadow-lg w-full bg-card p-4">
          <div className="flex flex-col gap-3">
            {availableWallets.map((wallet) => {
              const isActive = connected && walletName === wallet.name;

              return (
                <button
                  key={wallet.id}
                  type="button"
                  disabled={isConnecting}
                  className={`flex min-h-11 w-full cursor-pointer items-center justify-between brutal-border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    isActive
                      ? 'bg-brutal-lime'
                      : 'bg-background hover:bg-brutal-cyan/40'
                  }`}
                  onClick={handleWalletSelect}
                >
                  <div className="flex items-center gap-3">
                    <Image
                      src={wallet.icon}
                      alt={wallet.name}
                      width={25}
                      height={25}
                      unoptimized
                    />
                    <span className="font-bold">{wallet.name}</span>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {isActive ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-foreground" />
                        Connected
                      </>
                    ) : isConnecting ? (
                      'Connecting...'
                    ) : (
                      'Connect →'
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 border-t-[3px] border-foreground pt-4">
            <p className="text-center text-xs font-medium text-muted-foreground">
              By connecting your wallet, you agree to our{' '}
              <Link href="/terms" className="font-bold text-foreground underline">
                Terms and Conditions
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="font-bold text-foreground underline">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>

        {connected && (
          <button
            type="button"
            disabled={isNetworkMismatch}
            onClick={() => router.push(nextRoute)}
            className={`${brutalBtnPrimary} disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_0_#0a0a0a]`}
            title={
              isNetworkMismatch
                ? `Switch your wallet to ${describeNetwork(expectedNetwork)} to continue`
                : undefined
            }
          >
            {isNetworkMismatch
              ? 'Wrong network — switch to continue'
              : 'Continue to account selection'}
          </button>
        )}
      </div>
    </div>
  );
}
