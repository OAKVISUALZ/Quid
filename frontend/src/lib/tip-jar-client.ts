import {
  Contract,
  Address,
  nativeToScVal,
  scValToNative,
  TransactionBuilder,
  rpc,
  Horizon,
  Networks,
} from "@stellar/stellar-sdk";
import { signFreighterTransaction, NETWORK_PASSPHRASE } from "@/lib/freighter-wallet";
import { ContractInvokeError, describeSorobanFailure } from "@/lib/soroban-client";

/**
 * Issue #341: frontend client for `quid-tip-jar`
 * (quid-contract/contracts/quid-tip-jar/src/lib.rs). The contract is a pure
 * pass-through (tipper -> hunter token transfer) and is not yet deployed to
 * testnet as of this PR — see frontend/.env.example for
 * `NEXT_PUBLIC_QUID_TIP_JAR_ID`.
 */

const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";
const TIP_JAR_CONTRACT_ID =
  process.env.NEXT_PUBLIC_QUID_TIP_JAR_ID ||
  "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

export interface SendTipParams {
  tipperAddress: string;
  hunterAddress: string;
  tokenAddress: string;
  /** Token base units (i128), e.g. 1 XLM = 10_000_000 (7 decimals). */
  amount: number | bigint;
  missionId: number | bigint;
  /** Optional free-text/IPFS-CID note. Empty string when there is none. */
  memoCid?: string;
}

export interface TipReceipt {
  success: boolean;
  txHash: string;
}

export async function sendTipToContract({
  tipperAddress,
  hunterAddress,
  tokenAddress,
  amount,
  missionId,
  memoCid = "",
}: SendTipParams): Promise<TipReceipt> {
  if (!tipperAddress) {
    throw new Error("Connect your wallet to send a tip");
  }
  if (!hunterAddress) {
    throw new Error("Hunter address is required");
  }
  if (tipperAddress === hunterAddress) {
    throw new Error("You cannot tip yourself");
  }
  if (!tokenAddress) {
    throw new Error("Reward token is required");
  }
  if (BigInt(amount) <= BigInt(0)) {
    throw new Error("Tip amount must be greater than zero");
  }

  const rpcServer = new rpc.Server(RPC_URL);
  const horizonServer = new Horizon.Server(HORIZON_URL);

  try {
    const account = await horizonServer.loadAccount(tipperAddress);
    const contract = new Contract(TIP_JAR_CONTRACT_ID);

    const callOp = contract.call(
      "tip",
      new Address(tipperAddress).toScVal(),
      new Address(hunterAddress).toScVal(),
      new Address(tokenAddress).toScVal(),
      nativeToScVal(BigInt(amount), { type: "i128" }),
      nativeToScVal(BigInt(missionId), { type: "u64" }),
      nativeToScVal(memoCid, { type: "string" }),
    );

    const tx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(callOp)
      .setTimeout(180)
      .build();

    const simResult = await rpcServer.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(simResult)) {
      throw new ContractInvokeError(simResult);
    }

    const txToSign = rpc.assembleTransaction(tx, simResult).build();
    const signedXdr = await signFreighterTransaction(
      txToSign.toXDR(),
      tipperAddress,
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

    return { success: true, txHash: sendRes.hash };
  } catch (error: unknown) {
    if (error instanceof ContractInvokeError || error instanceof Error) {
      throw error;
    }
    throw new Error(
      `Tip failed: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

/**
 * Issue #341: there is no backend indexer for per-tip history yet, so this
 * reads the contract's own running total for the mission
 * (`get_mission_tip_total`) as the best available stand-in. A full itemized
 * tip history needs an indexer endpoint that does not exist yet — see the PR
 * description.
 */
export async function getMissionTipTotal(
  missionId: number | bigint,
  readerAddress: string,
): Promise<bigint> {
  const rpcServer = new rpc.Server(RPC_URL);
  const horizonServer = new Horizon.Server(HORIZON_URL);

  const account = await horizonServer.loadAccount(readerAddress);
  const contract = new Contract(TIP_JAR_CONTRACT_ID);
  const callOp = contract.call(
    "get_mission_tip_total",
    nativeToScVal(BigInt(missionId), { type: "u64" }),
  );

  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(callOp)
    .setTimeout(180)
    .build();

  const simResult = await rpcServer.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(simResult)) {
    throw new ContractInvokeError(simResult);
  }

  const retval = simResult.result?.retval;
  if (!retval) return BigInt(0);

  const native = scValToNative(retval);
  return typeof native === "bigint" ? native : BigInt(native as number);
}
