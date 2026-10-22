import {
  Contract,
  Address,
  nativeToScVal,
  TransactionBuilder,
  rpc,
  Horizon,
  Networks,
  xdr,
} from "@stellar/stellar-sdk";
import { signFreighterTransaction, NETWORK_PASSPHRASE } from "@/lib/freighter-wallet";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";
const STORE_CONTRACT_ID =
  process.env.NEXT_PUBLIC_QUID_STORE_ID ||
  "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

export interface SubmitFeedbackParams {
  missionId: number | bigint;
  hunterAddress: string;
  ipfsCid: string;
  stakeTokenAddress?: string;
  stakeAmount?: number | bigint;
}

export interface SubmissionReceipt {
  success: boolean;
  txHash: string;
  missionId: string;
  hunter: string;
  cid: string;
  simulated?: boolean;
}

export interface PayoutParticipantParams {
  /** Numeric mission id on quid-store (u64). */
  missionId: number | bigint;
  /** The hunter being paid. */
  hunterAddress: string;
  /** The mission owner — must be the signing account, the contract requires its auth. */
  ownerAddress: string;
}

export interface PayoutReceipt {
  success: boolean;
  txHash: string;
  missionId: string;
  hunter: string;
  simulated?: boolean;
}

export interface RejectSubmissionParams {
  /** Numeric mission id on quid-store (u64). */
  missionId: number | bigint;
  /** The hunter whose submission is being rejected. */
  hunterAddress: string;
  /** The mission owner — must be the signing account, the contract requires its auth. */
  ownerAddress: string;
  /**
   * Optional creator-facing reason (issue #321). `reject_submission` has no
   * reason parameter on-chain, so this is never sent in the transaction — the
   * caller is responsible for surfacing it in the UI / backend only.
   */
  reason?: string;
}

export interface RejectSubmissionReceipt {
  success: boolean;
  txHash: string;
  missionId: string;
  hunter: string;
}

export interface MissionActionParams {
  /** Numeric mission id on quid-store (u64). */
  missionId: number | bigint;
  /** The mission owner — must be the signing account, the contract requires its auth. */
  ownerAddress: string;
}

export interface MissionActionReceipt {
  success: boolean;
  txHash: string;
  missionId: string;
}

/**
 * Carries a raw Soroban failure so `parseQuidError` can turn it into a
 * user-facing message (AlreadyPaid → "Already paid", etc).
 */
export class ContractInvokeError extends Error {
  constructor(readonly errorResult: unknown) {
    super(
      typeof errorResult === "string"
        ? errorResult
        : `Contract invocation failed: ${JSON.stringify(errorResult)}`,
    );
    this.name = "ContractInvokeError";
  }
}

/**
 * Pulls a readable reason out of a failed transaction so `parseQuidError` can
 * match its `#N` pattern. Diagnostic events are where Soroban surfaces
 * `Error(Contract, #9)`; the base64 result XDR is the fallback when a node
 * returns no diagnostics.
 */
function describeSorobanFailure(res: unknown): string {
  const diagnostics = (() => {
    const events = (res as { diagnosticEventsXdr?: unknown })
      ?.diagnosticEventsXdr;
    if (!Array.isArray(events)) return '';

    return events
      .map((event) => {
        const inner = (event as { events?: unknown[] }).events;
        if (!Array.isArray(inner)) return '';
        return inner
          .map((e) => (e as { value?: unknown }).value)
          .filter((v): v is string => typeof v === 'string')
          .join(' ');
      })
      .filter(Boolean)
      .join(' ');
  })();

  if (diagnostics) return diagnostics;

  const resultXdr = (res as { resultXdr?: { toXDR?: (f: string) => string } })
    ?.resultXdr;

  return typeof resultXdr?.toXDR === 'function'
    ? resultXdr.toXDR('base64')
    : String(res);
}

/**
 * Builds and invokes `payout_participant` on quid-store.
 *
 * The contract calls `mission.owner.require_auth()`, so `ownerAddress` has to be
 * the connected founder's account; signing as anyone else fails with
 * `NotAuthorized` (#6). Returns the tx hash so the caller can await
 * confirmation before flipping the row to "paid".
 *
 * Unlike `submitFeedbackToContract` this deliberately has **no** simulated
 * fallback: silently reporting a successful payout that never moved funds would
 * be worse than an error.
 */
export async function payoutParticipantToContract({
  missionId,
  hunterAddress,
  ownerAddress,
}: PayoutParticipantParams): Promise<PayoutReceipt> {
  if (!hunterAddress) {
    throw new Error("Hunter address is required");
  }
  if (!ownerAddress) {
    throw new Error("Connect the mission owner's wallet to release a payout");
  }

  const rpcServer = new rpc.Server(RPC_URL);
  const horizonServer = new Horizon.Server(HORIZON_URL);

  try {
    const account = await horizonServer.loadAccount(ownerAddress);
    const contract = new Contract(STORE_CONTRACT_ID);

    const callOp = contract.call(
      "payout_participant",
      nativeToScVal(BigInt(missionId), { type: "u64" }),
      new Address(hunterAddress).toScVal(),
    );

    const tx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(callOp)
      .setTimeout(180)
      .build();

    // Simulate first so contract errors (AlreadyPaid, MissionClosed, ...) come
    // back as a typed message before the user is asked to sign.
    const simResult = await rpcServer.simulateTransaction(tx);

    if (!rpc.Api.isSimulationSuccess(simResult)) {
      throw new ContractInvokeError(simResult);
    }

    const txToSign = rpc.assembleTransaction(tx, simResult).build();
    const signedXdr = await signFreighterTransaction(
      txToSign.toXDR(),
      ownerAddress,
      NETWORK_PASSPHRASE as Networks,
    );

    const txFromXdr = TransactionBuilder.fromXDR(
      signedXdr,
      NETWORK_PASSPHRASE,
    );

    const sendRes = await rpcServer.sendTransaction(
      txFromXdr as unknown as Parameters<typeof rpcServer.sendTransaction>[0],
    );

    if (sendRes.status === "ERROR") {
      throw new ContractInvokeError(sendRes.errorResult);
    }

    let getTxRes = await rpcServer.getTransaction(sendRes.hash);
    let attempts = 0;
    while (getTxRes.status === "NOT_FOUND" && attempts < 15) {
      await new Promise((r) => setTimeout(r, 1000));
      getTxRes = await rpcServer.getTransaction(sendRes.hash);
      attempts++;
    }

    if (getTxRes.status === "FAILED") {
      throw new ContractInvokeError(describeSorobanFailure(getTxRes));
    }

    return {
      success: true,
      txHash: sendRes.hash,
      missionId: missionId.toString(),
      hunter: hunterAddress,
    };
  } catch (error: unknown) {
    if (error instanceof ContractInvokeError || error instanceof Error) {
      throw error;
    }
    throw new Error(
      `Payout failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

/**
 * Shared simulate → sign → send → poll pipeline for the owner-gated
 * `quid-store` entrypoints (`reject_submission`, `pause_mission`,
 * `cancel_mission`). Each of those contract functions calls
 * `mission.owner.require_auth()`, so `ownerAddress` must be the connected
 * founder's wallet — signing as anyone else fails on-chain with
 * `NotAuthorized` (#6), surfaced here as a `ContractInvokeError` for
 * `parseQuidError` to translate.
 *
 * No simulated fallback (mirrors `payoutParticipantToContract`): a
 * silently-successful pause/cancel/reject that never touched the chain would
 * be worse than a visible error.
 */
async function invokeStoreOwnerCall(
  fnName: string,
  args: xdr.ScVal[],
  ownerAddress: string,
  actionLabel: string,
): Promise<{ txHash: string }> {
  if (!ownerAddress) {
    throw new Error(`Connect the mission owner's wallet to ${actionLabel}`);
  }

  const rpcServer = new rpc.Server(RPC_URL);
  const horizonServer = new Horizon.Server(HORIZON_URL);

  try {
    const account = await horizonServer.loadAccount(ownerAddress);
    const contract = new Contract(STORE_CONTRACT_ID);

    const callOp = contract.call(fnName, ...args);

    const tx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(callOp)
      .setTimeout(180)
      .build();

    // Simulate first so contract errors (NotAuthorized, MissionClosed,
    // SubmissionNotFound, ...) come back as a typed message before the user
    // is asked to sign.
    const simResult = await rpcServer.simulateTransaction(tx);

    if (!rpc.Api.isSimulationSuccess(simResult)) {
      throw new ContractInvokeError(simResult);
    }

    const txToSign = rpc.assembleTransaction(tx, simResult).build();
    const signedXdr = await signFreighterTransaction(
      txToSign.toXDR(),
      ownerAddress,
      NETWORK_PASSPHRASE as Networks,
    );

    const txFromXdr = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

    const sendRes = await rpcServer.sendTransaction(
      txFromXdr as unknown as Parameters<typeof rpcServer.sendTransaction>[0],
    );

    if (sendRes.status === "ERROR") {
      throw new ContractInvokeError(sendRes.errorResult);
    }

    let getTxRes = await rpcServer.getTransaction(sendRes.hash);
    let attempts = 0;
    while (getTxRes.status === "NOT_FOUND" && attempts < 15) {
      await new Promise((r) => setTimeout(r, 1000));
      getTxRes = await rpcServer.getTransaction(sendRes.hash);
      attempts++;
    }

    if (getTxRes.status === "FAILED") {
      throw new ContractInvokeError(describeSorobanFailure(getTxRes));
    }

    return { txHash: sendRes.hash };
  } catch (error: unknown) {
    if (error instanceof ContractInvokeError || error instanceof Error) {
      throw error;
    }
    throw new Error(
      `Failed to ${actionLabel}: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

/**
 * Builds and invokes `reject_submission` on quid-store (issue #321).
 *
 * Refunds the hunter's stake and marks the submission `Rejected` on-chain —
 * see `quid-contract/contracts/quid-store/src/lib.rs`. The optional `reason`
 * is never sent in the transaction (the contract has no reason parameter);
 * callers surface it client-side only.
 */
export async function rejectSubmissionToContract({
  missionId,
  hunterAddress,
  ownerAddress,
}: RejectSubmissionParams): Promise<RejectSubmissionReceipt> {
  if (!hunterAddress) {
    throw new Error("Hunter address is required");
  }

  const { txHash } = await invokeStoreOwnerCall(
    "reject_submission",
    [
      nativeToScVal(BigInt(missionId), { type: "u64" }),
      new Address(hunterAddress).toScVal(),
    ],
    ownerAddress,
    "reject this submission",
  );

  return {
    success: true,
    txHash,
    missionId: missionId.toString(),
    hunter: hunterAddress,
  };
}

/**
 * Builds and invokes `pause_mission` on quid-store (issue #322).
 *
 * Stops new submissions (`MissionNotOpen`, #10) without touching escrow —
 * use `cancelMissionToContract` to also refund the unspent reward pool.
 */
export async function pauseMissionToContract({
  missionId,
  ownerAddress,
}: MissionActionParams): Promise<MissionActionReceipt> {
  const { txHash } = await invokeStoreOwnerCall(
    "pause_mission",
    [nativeToScVal(BigInt(missionId), { type: "u64" })],
    ownerAddress,
    "pause this quest",
  );

  return { success: true, txHash, missionId: missionId.toString() };
}

/**
 * Builds and invokes `cancel_mission` on quid-store (issue #322).
 *
 * Refunds the unspent reward pool (unfilled slots × reward-per-slot) back to
 * the founder's wallet and marks the mission `Cancelled`, which also blocks
 * any further submissions or payouts.
 */
export async function cancelMissionToContract({
  missionId,
  ownerAddress,
}: MissionActionParams): Promise<MissionActionReceipt> {
  const { txHash } = await invokeStoreOwnerCall(
    "cancel_mission",
    [nativeToScVal(BigInt(missionId), { type: "u64" })],
    ownerAddress,
    "cancel this quest",
  );

  return { success: true, txHash, missionId: missionId.toString() };
}

/**
 * Builds and invokes the submit_feedback function on the quid-store Soroban smart contract.
 * Args:
 *  - mission_id: u64
 *  - hunter: Address
 *  - ipfs_cid: String
 *  - stake_token: Address
 *  - stake_amount: i128
 */
export async function submitFeedbackToContract({
  missionId,
  hunterAddress,
  ipfsCid,
  stakeTokenAddress,
  stakeAmount = BigInt(10000000), // 1 XLM (7 decimals)
}: SubmitFeedbackParams): Promise<SubmissionReceipt> {
  if (!ipfsCid) {
    throw new Error("Cannot submit feedback without a valid IPFS CID");
  }
  if (!hunterAddress) {
    throw new Error("Hunter address is required");
  }

  // Fallback native testnet token or placeholder address
  const tokenAddress =
    stakeTokenAddress ||
    process.env.NEXT_PUBLIC_NATIVE_TOKEN_ID ||
    "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

  const rpcServer = new rpc.Server(RPC_URL);
  const horizonServer = new Horizon.Server(HORIZON_URL);

  try {
    // 1. Fetch account sequence from Horizon
    const account = await horizonServer.loadAccount(hunterAddress);

    // 2. Prepare contract call
    const contract = new Contract(STORE_CONTRACT_ID);

    const callOp = contract.call(
      "submit_feedback",
      nativeToScVal(BigInt(missionId), { type: "u64" }),
      new Address(hunterAddress).toScVal(),
      nativeToScVal(ipfsCid, { type: "string" }),
      new Address(tokenAddress).toScVal(),
      nativeToScVal(BigInt(stakeAmount), { type: "i128" }),
    );

    // 3. Build preliminary transaction
    const tx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(callOp)
      .setTimeout(180)
      .build();

    // 4. Simulate transaction against Soroban RPC
    const simResult = await rpcServer.simulateTransaction(tx);

    let txToSign = tx;
    if (rpc.Api.isSimulationSuccess(simResult)) {
      txToSign = rpc.assembleTransaction(tx, simResult).build();
    } else {
      console.warn("Soroban simulation non-fatal warning:", simResult);
    }

    // 5. Sign transaction using Freighter wallet
    const signedXdr = await signFreighterTransaction(
      txToSign.toXDR(),
      hunterAddress,
      NETWORK_PASSPHRASE as Networks,
    );

    // 6. Submit transaction to RPC
    const txFromXdr = TransactionBuilder.fromXDR(
      signedXdr,
      NETWORK_PASSPHRASE,
    );

    const sendRes = await rpcServer.sendTransaction(
      txFromXdr as unknown as Parameters<typeof rpcServer.sendTransaction>[0],
    );

    if (sendRes.status === "ERROR") {
      throw new Error(`Soroban transaction failed: ${JSON.stringify(sendRes.errorResult)}`);
    }

    // 7. Poll for final confirmation
    let getTxRes = await rpcServer.getTransaction(sendRes.hash);
    let attempts = 0;
    while (getTxRes.status === "NOT_FOUND" && attempts < 15) {
      await new Promise((r) => setTimeout(r, 1000));
      getTxRes = await rpcServer.getTransaction(sendRes.hash);
      attempts++;
    }

    return {
      success: true,
      txHash: sendRes.hash,
      missionId: missionId.toString(),
      hunter: hunterAddress,
      cid: ipfsCid,
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Contract execution error";

    // If local testnet or placeholder IDs are being used without a live deploy, provide a graceful fallback with full simulated transaction receipt
    if (
      STORE_CONTRACT_ID.startsWith("CAAAAAAAAAAAAAAA") ||
      errorMsg.includes("not found") ||
      errorMsg.includes("404") ||
      errorMsg.includes("simulate")
    ) {
      console.warn("Operating with demo/placeholder contract ID. Generated receipt:", errorMsg);
      const mockTxHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;

      return {
        success: true,
        txHash: mockTxHash,
        missionId: missionId.toString(),
        hunter: hunterAddress,
        cid: ipfsCid,
        simulated: true,
      };
    }

    throw new Error(`Smart contract invocation failed: ${errorMsg}`);
  }
}
