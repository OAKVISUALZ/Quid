'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/context/WalletProvider';
import { ONBOARDING_ROUTES } from '@/lib/onboarding';

/**
 * Issue #326: `/missions` used to render a static "Coming Soon" placeholder.
 * The live mission board now lives at `/hunter/mission-board`
 * (`GET /missions`-backed), so this route forwards there instead of
 * duplicating it.
 */
export default function MissionsPage() {
  const { connected } = useWallet();
  const router = useRouter();

  useEffect(() => {
    if (!connected) {
      router.replace(ONBOARDING_ROUTES.signUp);
      return;
    }
    router.replace('/hunter/mission-board');
  }, [connected, router]);

  return null;
}
