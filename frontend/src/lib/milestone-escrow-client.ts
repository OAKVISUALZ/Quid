import {
  Contract,
  Address,
  nativeToScVal,
  scValToNative,
  TransactionBuilder,
  rpc,
  Horizon,
  Networks,
  xdr,
} from "@stellar/stellar-sdk";
import { signFreighterTransaction, NETWORK_PASSPHRASE } from "@/lib/freighter-wallet";
import { ContractInvokeError, describeSorobanFailure } from "@/lib/soroban-client";

/**
 * Issue #340: frontend client for `quid-milestone-escrow`.
 *
 * `NEXT_PUBLIC_QUID_MILESTONE_ID` is a placeholder until issue #284 ("Deploy
 * quid-milestone-escrow to testnet") lands — see frontend/.env.example. The
 * entrypoints wired here (`create_program` / `add_milestone` /
 * `approve_milestone` / `cancel_program`, plus the `get_program` /
 * `get_milestone` getters) match
 * quid-contract/contracts/quid-milestone-escrow/src/lib.rs.
 */

const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";
const MILESTONE_CONTRACT_ID =
  process.env.NEXT_PUBLIC_QUID_MILESTONE_ID ||
  "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

export type ProgramStatus = "Draft" | "Active" | "Completed" | "Cancelled";
export type MilestoneStatus = "Pending" | "Approved" | "Paid" | "Released" | "Cancelled";

/** u64 ids decode to plain strings (see `decodeU64`/`str`) but also accept a number/bigint from a caller that has one in hand. */
export type ContractId = string | number | bigint;

export interface OnChainProgram {
  id: string;
  sponsor: string;
  recipient: string;
  reviewer?: string;
  token: string;
  totalAmount: string;
  allocatedAmount: string;
  releasedAmount: string;
  milestoneCount: number;
  metadataCid?: string;
  createdAt: string;
  status: ProgramStatus;
}

export interface OnChainMilestone {
  id: string;
  programId: string;
  title: string;
  amount: string;
  dueAt: string;
  metadataCid: string;
  status: MilestoneStatus;
}

export interface CreateProgramParams {
  sponsorAddress: string;
  recipientAddress: string;
  tokenAddress: string;
  totalAmount: number | bigint;
  reviewerAddress?: string;
  metadataCid?: string;
}

export interface AddMilestoneParams {
  /** The connected wallet, which must be the program's sponsor to sign. */
  sponsorAddress: string;
  programId: ContractId;
  title: string;
  amount: number | bigint;
  /** Unix seconds. */
  dueAt: number | bigint;
  metadataCid?: string;
}

export interface ApproveMilestoneParams {
  /** Program sponsor or assigned reviewer — the contract checks either. */
  approverAddress: string;
  programId: ContractId;
  milestoneId: ContractId;
}

export interface CancelProgramParams {
  sponsorAddress: string;
  programId: ContractId;
}

export interface MilestoneEscrowReceipt {
  success: boolean;
  txHash: string;
}

export interface CreateProgramReceipt extends MilestoneEscrowReceipt {
  programId?: string;
}

export interface AddMilestoneReceipt extends MilestoneEscrowReceipt {
  milestoneId?: string;
}

function getServers() {
  return {
    rpcServer: new rpc.Server(RPC_URL),
    horizonServer: new Horizon.Server(HORIZON_URL),
  };
}

function optionScVal(value: string | undefined, type: "address" | "string") {
  if (!value) return nativeToScVal(null);
  return type === "address" ? new Address(value).toScVal() : nativeToScVal(value, { type: "string" });
}

/**
 * Shared simulate -> sign -> send -> poll tail for every write entrypoint.
 * Mirrors the flow in `soroban-client.ts`'s `payoutParticipantToContract`
 * (simulate first so contract errors surface before a signing prompt; no
 * "simulated/demo" fallback, since silently reporting success on a fund
 * movement would be worse than an error).
 */
async function signAndSend(
  callOp: ReturnType<Contract["call"]>,
  signerAddress: string,
): Promise<{ txHash: string; returnValue: unknown }> {
  const { rpcServer, horizonServer } = getServers();
  const account = await horizonServer.loadAccount(signerAddress);

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
    signerAddress,
    NETWORK_PASSPHRASE as Networks,
  );

  const txFromXdr = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const rpcForSend = rpcServer as unknown as {
    sendTransaction: (tx: unknown) => Promise<{ status: string; hash: string; errorResult?: unknown }>;
    getTransaction: (hash: string) => Promise<{ status: string; returnValue?: unknown }>;
  };

  const sendRes = await rpcForSend.sendTransaction(txFromXdr);
  if (sendRes.status === "ERROR") {
    throw new ContractInvokeError(sendRes.errorResult);
  }

  let getTxRes = await rpcForSend.getTransaction(sendRes.hash);
  let attempts = 0;
  while (getTxRes.status === "NOT_FOUND" && attempts < 15) {
    await new Promise((r) => setTimeout(r, 1000));
    getTxRes = await rpcForSend.getTransaction(sendRes.hash);
    attempts++;
  }

  if (getTxRes.status === "FAILED") {
    throw new ContractInvokeError(describeSorobanFailure(getTxRes));
  }

  return { txHash: sendRes.hash, returnValue: getTxRes.returnValue };
}

function decodeU64(value: unknown): string | undefined {
  try {
    if (value === undefined || value === null) return undefined;
    const native = scValToNative(value as never);
    return native === undefined || native === null ? undefined : String(native);
  } catch {
    return undefined;
  }
}

export async function createProgramOnContract({
  sponsorAddress,
  recipientAddress,
  tokenAddress,
  totalAmount,
  reviewerAddress,
  metadataCid,
}: CreateProgramParams): Promise<CreateProgramReceipt> {
  if (!sponsorAddress) throw new Error("Connect the sponsor wallet to create a program");
  if (!recipientAddress) throw new Error("Recipient address is required");
  if (!tokenAddress) throw new Error("Reward token is required");
  if (BigInt(totalAmount) <= BigInt(0)) throw new Error("Total amount must be greater than zero");

  const contract = new Contract(MILESTONE_CONTRACT_ID);
  const callOp = contract.call(
    "create_program",
    new Address(sponsorAddress).toScVal(),
    new Address(recipientAddress).toScVal(),
    new Address(tokenAddress).toScVal(),
    nativeToScVal(BigInt(totalAmount), { type: "i128" }),
    optionScVal(reviewerAddress, "address"),
    optionScVal(metadataCid, "string"),
  );

  const { txHash, returnValue } = await signAndSend(callOp, sponsorAddress);
  return { success: true, txHash, programId: decodeU64(returnValue) };
}

export async function addMilestoneOnContract({
  sponsorAddress,
  programId,
  title,
  amount,
  dueAt,
  metadataCid = "",
}: AddMilestoneParams): Promise<AddMilestoneReceipt> {
  if (!sponsorAddress) throw new Error("Connect the sponsor wallet to add a milestone");
  if (!title.trim()) throw new Error("Milestone title is required");
  if (BigInt(amount) <= BigInt(0)) throw new Error("Milestone amount must be greater than zero");

  const contract = new Contract(MILESTONE_CONTRACT_ID);
  const callOp = contract.call(
    "add_milestone",
    nativeToScVal(BigInt(programId), { type: "u64" }),
    nativeToScVal(title, { type: "string" }),
    nativeToScVal(BigInt(amount), { type: "i128" }),
    nativeToScVal(BigInt(dueAt), { type: "u64" }),
    nativeToScVal(metadataCid, { type: "string" }),
  );

  const { txHash, returnValue } = await signAndSend(callOp, sponsorAddress);
  return { success: true, txHash, milestoneId: decodeU64(returnValue) };
}

export async function approveMilestoneOnContract({
  approverAddress,
  programId,
  milestoneId,
}: ApproveMilestoneParams): Promise<MilestoneEscrowReceipt> {
  if (!approverAddress) throw new Error("Connect the sponsor or reviewer wallet to approve");

  const contract = new Contract(MILESTONE_CONTRACT_ID);
  const callOp = contract.call(
    "approve_milestone",
    nativeToScVal(BigInt(programId), { type: "u64" }),
    nativeToScVal(BigInt(milestoneId), { type: "u64" }),
    new Address(approverAddress).toScVal(),
  );

  const { txHash } = await signAndSend(callOp, approverAddress);
  return { success: true, txHash };
}

export async function cancelProgramOnContract({
  sponsorAddress,
  programId,
}: CancelProgramParams): Promise<MilestoneEscrowReceipt> {
  if (!sponsorAddress) throw new Error("Connect the sponsor wallet to cancel this program");

  const contract = new Contract(MILESTONE_CONTRACT_ID);
  const callOp = contract.call(
    "cancel_program",
    nativeToScVal(BigInt(programId), { type: "u64" }),
    new Address(sponsorAddress).toScVal(),
  );

  const { txHash } = await signAndSend(callOp, sponsorAddress);
  return { success: true, txHash };
}

/**
 * Read-only simulate (no signature prompt): `readerAddress` only supplies a
 * funded account for the transaction envelope's sequence number.
 */
async function simulateRead(
  method: string,
  args: xdr.ScVal[],
  readerAddress: string,
): Promise<unknown> {
  const { rpcServer, horizonServer } = getServers();
  const account = await horizonServer.loadAccount(readerAddress);
  const contract = new Contract(MILESTONE_CONTRACT_ID);
  const callOp = contract.call(method, ...args);

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
  return retval ? scValToNative(retval) : undefined;
}

function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "object" && "toString" in (value as object)
    ? String(value)
    : String(value);
}

/**
 * NOTE: field names below mirror the Rust struct's snake_case field names
 * (`quid-contract/contracts/quid-milestone-escrow/src/types.rs`), since
 * Soroban structs serialize with their declared field symbols. Verify this
 * against the real deployment once #284 lands — this has not been exercised
 * against a live instance yet.
 */
export async function getProgramOnContract(
  programId: ContractId,
  readerAddress: string,
): Promise<OnChainProgram> {
  const raw = (await simulateRead(
    "get_program",
    [nativeToScVal(BigInt(programId), { type: "u64" })],
    readerAddress,
  )) as Record<string, unknown>;

  return {
    id: str(raw.id),
    sponsor: str(raw.sponsor),
    recipient: str(raw.recipient),
    reviewer: raw.reviewer ? str(raw.reviewer) : undefined,
    token: str(raw.token),
    totalAmount: str(raw.total_amount),
    allocatedAmount: str(raw.allocated_amount),
    releasedAmount: str(raw.released_amount),
    milestoneCount: Number(raw.milestone_count ?? 0),
    metadataCid: raw.metadata_cid ? str(raw.metadata_cid) : undefined,
    createdAt: str(raw.created_at),
    status: str(raw.status) as ProgramStatus,
  };
}

export async function getMilestoneOnContract(
  programId: ContractId,
  milestoneId: ContractId,
  readerAddress: string,
): Promise<OnChainMilestone> {
  const raw = (await simulateRead(
    "get_milestone",
    [
      nativeToScVal(BigInt(programId), { type: "u64" }),
      nativeToScVal(BigInt(milestoneId), { type: "u64" }),
    ],
    readerAddress,
  )) as Record<string, unknown>;

  return {
    id: str(raw.id),
    programId: str(raw.program_id),
    title: str(raw.title),
    amount: str(raw.amount),
    dueAt: str(raw.due_at),
    metadataCid: str(raw.metadata_cid),
    status: str(raw.status) as MilestoneStatus,
  };
}

export async function getProgramCountOnContract(readerAddress: string): Promise<number> {
  const raw = await simulateRead("get_program_count", [], readerAddress);
  return Number(raw ?? 0);
}

/**
 * The contract has no "list programs by sponsor" entrypoint and there is no
 * backend indexer for quid-milestone-escrow yet, so the set of program ids a
 * sponsor has created is tracked client-side, per wallet. Each id is still
 * verified against the contract itself (`getProgramOnContract`) before being
 * shown — this is only a pointer, not a source of truth.
 */
function knownProgramsKey(sponsorAddress: string): string {
  return `quid_milestone_programs_${sponsorAddress}`;
}

export function getKnownProgramIds(sponsorAddress: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(knownProgramsKey(sponsorAddress));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function addKnownProgramId(sponsorAddress: string, programId: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getKnownProgramIds(sponsorAddress);
    if (existing.includes(programId)) return;
    localStorage.setItem(
      knownProgramsKey(sponsorAddress),
      JSON.stringify([...existing, programId]),
    );
  } catch {
    // localStorage full/blocked - the program still exists on-chain, it just
    // will not auto-populate this list next load.
  }
}
