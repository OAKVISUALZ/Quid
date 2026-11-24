export const PLACEHOLDER_CONTRACT_ID =
  "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

export class UntrustedContractError extends Error {
  constructor(readonly contractId: string, readonly contractLabel: string) {
    super(
      `Refusing to sign: ${contractLabel} is not an allowlisted contract for this deployment (${contractId}).`
    );
    this.name = "UntrustedContractError";
  }
}

export function isKnownContract(contractId?: string | null): boolean {
  if (!contractId) return false;
  const normalized = contractId.trim();
  if (!normalized || normalized === PLACEHOLDER_CONTRACT_ID) return false;
  if (normalized.startsWith("CAAAAAAAAAAAAAAA")) return false;
  return /^C[A-Z2-7]{55}$/.test(normalized);
}

export function assertKnownContract(
  contractId: string | undefined,
  contractLabel: string
): string {
  if (!isKnownContract(contractId)) {
    throw new UntrustedContractError(contractId || "unset", contractLabel);
  }
  return contractId as string;
}

export function getPasskeyDomainHint(): string {
  if (process.env.NEXT_PUBLIC_PASSKEY_DOMAIN_HINT) {
    return process.env.NEXT_PUBLIC_PASSKEY_DOMAIN_HINT;
  }
  if (typeof window !== "undefined") return window.location.host;
  return "this Quid deployment";
}

export function isUserProvidedUrl(href: string): boolean {
  try {
    const url = new URL(href, "https://localhost");
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
