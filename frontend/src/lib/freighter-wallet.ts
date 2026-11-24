import {
  getAddress,
  getNetwork,
  isConnected,
  setAllowed,
  signTransaction,
} from '@stellar/freighter-api';
import { Networks } from '@stellar/stellar-sdk';
import { getPasskeyDomainHint } from '@/lib/contract-allowlist';

export const FREIGHTER_WALLET = {
  id: 'freighter',
  name: 'Freighter',
  icon: 'https://stellar.creit.tech/wallet-icons/freighter.png',
} as const;

export const NETWORK_PASSPHRASE = Networks.TESTNET;

/**
 * The network Quid expects the wallet to be on. Overridable so the same guard
 * works against a localnet/sandbox Soroban instance during development.
 */
export function getExpectedNetwork(): Networks {
  const configured = process.env.NEXT_PUBLIC_STELLAR_NETWORK;
  if (configured === Networks.PUBLIC || configured === Networks.TESTNET) {
    return configured;
  }
  return NETWORK_PASSPHRASE;
}

/** Human label for a passphrase, e.g. "Testnet" / "Mainnet". */
export function describeNetwork(passphrase: string | undefined): string {
  switch (passphrase) {
    case Networks.TESTNET:
      return 'Testnet';
    case Networks.PUBLIC:
      return 'Mainnet';
    case Networks.FUTURENET:
      return 'Futurenet';
    default:
      return 'an unrecognized network';
  }
}

/** Thrown when a write would be signed on a network Quid is not deployed to. */
export class NetworkMismatchError extends Error {
  constructor(
    readonly actual: string,
    readonly expected: string,
  ) {
    super(
      `Wallet is on ${describeNetwork(actual)} but Quid is deployed on ${describeNetwork(expected)}. Switch networks and try again.`,
    );
    this.name = 'NetworkMismatchError';
  }
}

/**
 * Reads the wallet's current network. Freighter v6 resolves with an `error`
 * field instead of rejecting, so both paths are handled.
 */
export async function getFreighterNetwork(): Promise<string | undefined> {
  try {
    const { networkPassphrase, error } = await getNetwork();
    if (error) return undefined;
    return networkPassphrase;
  } catch {
    return undefined;
  }
}

export async function connectFreighter(): Promise<string> {
  const allowed = await setAllowed();
  if (!allowed) {
    throw new Error(
      `Freighter connection was not approved. Confirm ${getPasskeyDomainHint()} is the only domain allowed for this passkey.`
    );
  }

  const { address } = await getAddress();
  if (!address) {
    throw new Error('No Freighter address returned');
  }

  return address;
}

export async function getFreighterAddressIfConnected(): Promise<string | null> {
  const connected = await isConnected();
  if (!connected) {
    return null;
  }

  const { address } = await getAddress();
  return address || null;
}

export async function signFreighterTransaction(
  unsignedXdr: string,
  address: string,
  networkPassphrase: Networks = NETWORK_PASSPHRASE,
): Promise<string> {
  // Last line of defence before the wallet prompt. The UI disables write CTAs
  // on a mismatch, but a stale render or a direct call would still reach here.
  const actual = await getFreighterNetwork();
  if (actual && actual !== networkPassphrase) {
    throw new NetworkMismatchError(actual, networkPassphrase);
  }

  const { signedTxXdr } = await signTransaction(unsignedXdr, {
    networkPassphrase,
    address,
  });

  return signedTxXdr;
}
