/**
 * Issue #344 – QuidError → human-readable UI string mapping.
 *
 * Error codes are defined in:
 *   quid-contract/contracts/quid-store/src/error.rs
 *
 * The numeric codes come from the Soroban contract error enum and are
 * surfaced in failed transaction result bodies.  The frontend parses the
 * error code from the transaction result and maps it to a user-facing
 * message using this module.
 */

export type QuidErrorCode =
  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20
  | 21 | 22 | 23 | 24 | 25;

export interface QuidErrorInfo {
  /** Short label shown in toasts / inline banners */
  title: string;
  /** Extended explanation shown in modal error state */
  description: string;
  /** Whether the user can reasonably retry the same action */
  retryable: boolean;
}

/** Maps every QuidError variant to a user-facing message. */
export const QUID_ERROR_MAP: Record<QuidErrorCode, QuidErrorInfo> = {
  /** MissionNotFound = 1 */
  1: {
    title: 'Quest not found',
    description: 'The quest you are trying to interact with no longer exists on-chain.',
    retryable: false,
  },
  /** MissionClosed = 2 – covers PAUSED / CANCELLED / COMPLETED */
  2: {
    title: 'Quest is closed',
    description: 'This quest has been paused or closed by the founder. New submissions are not accepted.',
    retryable: false,
  },
  /** MissionFull = 3 – capacity error */
  3: {
    title: 'Quest is full',
    description: 'The maximum number of hunters has been reached for this quest. Try a different one.',
    retryable: false,
  },
  /** AlreadySubmitted = 4 */
  4: {
    title: 'Already submitted',
    description: 'You have already submitted feedback for this quest. Each hunter may submit once.',
    retryable: false,
  },
  /** InsufficientFunds = 5 */
  5: {
    title: 'Insufficient funds',
    description: 'Your wallet does not have enough XLM to cover the refundable stake and transaction fees.',
    retryable: true,
  },
  /** NotAuthorized = 6 */
  6: {
    title: 'Not authorized',
    description: 'You are not authorized to perform this action. Only the quest founder can approve or reject.',
    retryable: false,
  },
  /** NegativeReward = 7 */
  7: {
    title: 'Invalid reward amount',
    description: 'The reward amount must be a positive number.',
    retryable: true,
  },
  /** InvalidState = 8 – generic state machine violation */
  8: {
    title: 'Invalid quest state',
    description: 'This action cannot be performed while the quest is in its current state.',
    retryable: false,
  },
  /** AlreadyPaid = 9 */
  9: {
    title: 'Already paid',
    description: 'This submission has already been paid out. The reward cannot be sent twice.',
    retryable: false,
  },
  /** MissionNotOpen = 10 – submit blocked because mission is PAUSED */
  10: {
    title: 'Quest is paused',
    description: 'The founder has paused this quest. Submissions are temporarily blocked.',
    retryable: false,
  },
  /** SubmissionNotFound = 11 */
  11: {
    title: 'Submission not found',
    description: 'The submission you are trying to approve or reject no longer exists.',
    retryable: false,
  },
  /** NotPending = 12 – double-approve / double-reject */
  12: {
    title: 'Submission already reviewed',
    description: 'This submission has already been approved or rejected and cannot be changed.',
    retryable: false,
  },
  /** InvalidAmount = 13 */
  13: {
    title: 'Invalid amount',
    description: 'The amount entered is invalid. Please check the value and try again.',
    retryable: true,
  },
  /** TreasuryNotSet = 14 */
  14: {
    title: 'Contract configuration error',
    description: 'The protocol treasury address has not been configured. Contact the Quid team.',
    retryable: false,
  },
  /** StakeNotFound = 15 */
  15: {
    title: 'Stake not found',
    description: 'No stake record was found for this submission. The stake may have already been refunded.',
    retryable: false,
  },
  /** InsufficientAssetBalance = 16 */
  16: {
    title: 'Insufficient asset balance',
    description: 'The reward token balance is too low to complete the payout. Check the escrow balance.',
    retryable: false,
  },
  /** FeeCollectorNotSet = 17 */
  17: {
    title: 'Contract configuration error',
    description: 'The fee collector address has not been configured. Contact the Quid team.',
    retryable: false,
  },
  /** StakingPoolNotSet = 18 */
  18: {
    title: 'Contract configuration error',
    description: 'The staking pool address has not been configured. Contact the Quid team.',
    retryable: false,
  },
  /** HunterBanned = 19 */
  19: {
    title: 'Hunter banned',
    description: 'This wallet is banned or muted and cannot submit feedback to this quest.',
    retryable: false,
  },
  /** ModerationRegistryNotSet = 20 */
  20: {
    title: 'Contract configuration error',
    description: 'The moderation registry address has not been configured. Contact the Quid team.',
    retryable: false,
  },
  /** AlreadyRejected = 21 — issue #321 */
  21: {
    title: 'Already rejected',
    description: 'This submission has already been rejected and its stake already refunded.',
    retryable: false,
  },
  /** ExpiryInThePast = 22 */
  22: {
    title: 'Invalid deadline',
    description: 'The quest deadline must be in the future.',
    retryable: true,
  },
  /** MissionExpired = 23 */
  23: {
    title: 'Quest expired',
    description: 'This quest’s deadline has passed and it no longer accepts submissions.',
    retryable: false,
  },
  /** MissionNotExpired = 24 */
  24: {
    title: 'Quest not expired',
    description: 'This quest has not reached its deadline yet, so its escrow cannot be reclaimed.',
    retryable: false,
  },
  /** ReputationNotSet = 25 */
  25: {
    title: 'Contract configuration error',
    description: 'The reputation registry address has not been configured. Contact the Quid team.',
    retryable: false,
  },
};

/**
 * Extracts a human-readable error from a Soroban transaction failure.
 *
 * @param errorResult - The raw error result string from the RPC (may contain
 *   the numeric error code, e.g. "Error(Contract, #4)" or similar).
 * @returns QuidErrorInfo if the code is recognized, or a generic fallback.
 */
export function parseQuidError(errorResult: unknown): QuidErrorInfo {
  const fallback: QuidErrorInfo = {
    title: 'Transaction failed',
    description:
      'An unexpected error occurred on-chain. Please try again or contact support.',
    retryable: true,
  };

  if (!errorResult) return fallback;

  const raw = typeof errorResult === 'string' ? errorResult : JSON.stringify(errorResult);

  // Soroban error codes appear as "Error(Contract, #N)" in result XDR decode
  const match = raw.match(/#(\d+)/);
  if (!match) return fallback;

  const code = parseInt(match[1], 10) as QuidErrorCode;
  return QUID_ERROR_MAP[code] ?? fallback;
}

/**
 * Issue #340 – error codes for `quid-milestone-escrow`
 * (quid-contract/contracts/quid-milestone-escrow/src/error.rs). A separate map
 * because the numeric codes collide with `quid-store`'s (e.g. `#1` means
 * something different in each contract) — never reuse `QUID_ERROR_MAP` here.
 */
const MILESTONE_ESCROW_ERROR_MAP: Record<number, QuidErrorInfo> = {
  1: {
    title: 'Invalid program state',
    description: 'This action cannot be performed while the program or milestone is in its current state.',
    retryable: false,
  },
  2: {
    title: 'Invalid amount',
    description: 'The amount entered is invalid, or exceeds what remains unallocated on the program.',
    retryable: true,
  },
  3: {
    title: 'Program not found',
    description: 'This escrow program does not exist on-chain.',
    retryable: false,
  },
  4: {
    title: 'Milestone not found',
    description: 'This milestone does not exist on this program.',
    retryable: false,
  },
  5: {
    title: 'Not authorized',
    description: 'Only the program sponsor or an assigned reviewer can perform this action.',
    retryable: false,
  },
  6: {
    title: 'Contract not initialized',
    description: 'The escrow contract has not been initialized with an admin yet.',
    retryable: false,
  },
  7: {
    title: 'Already initialized',
    description: 'The escrow contract already has an admin set.',
    retryable: false,
  },
};

export function parseMilestoneEscrowError(errorResult: unknown): QuidErrorInfo {
  const fallback: QuidErrorInfo = {
    title: 'Transaction failed',
    description: 'An unexpected error occurred on-chain. Please try again or contact support.',
    retryable: true,
  };

  if (!errorResult) return fallback;
  const raw = typeof errorResult === 'string' ? errorResult : JSON.stringify(errorResult);
  const match = raw.match(/#(\d+)/);
  if (!match) return fallback;

  return MILESTONE_ESCROW_ERROR_MAP[parseInt(match[1], 10)] ?? fallback;
}

/**
 * Issue #341 – error codes for `quid-tip-jar`
 * (quid-contract/contracts/quid-tip-jar/src/error.rs).
 */
const TIP_JAR_ERROR_MAP: Record<number, QuidErrorInfo> = {
  1: {
    title: 'Invalid tip amount',
    description: 'The tip amount must be greater than zero.',
    retryable: true,
  },
  2: {
    title: 'Invalid recipient',
    description: 'You cannot tip yourself. Pick a different hunter address.',
    retryable: false,
  },
};

export function parseTipJarError(errorResult: unknown): QuidErrorInfo {
  const fallback: QuidErrorInfo = {
    title: 'Transaction failed',
    description: 'An unexpected error occurred on-chain. Please try again or contact support.',
    retryable: true,
  };

  if (!errorResult) return fallback;
  const raw = typeof errorResult === 'string' ? errorResult : JSON.stringify(errorResult);
  const match = raw.match(/#(\d+)/);
  if (!match) return fallback;

  return TIP_JAR_ERROR_MAP[parseInt(match[1], 10)] ?? fallback;
}
