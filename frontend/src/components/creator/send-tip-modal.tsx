"use client";

import { useState } from "react";
import { sendTipToContract, type TipReceipt } from "@/lib/tip-jar-client";
import { useWallet } from "@/context/WalletProvider";
import { parseTipJarError } from "@/lib/errorMap";
import { toast } from "@/context/ToastContext";
import {
  AlertCircle,
  CheckCircle2,
  Gift,
  Loader2,
  X,
} from "lucide-react";

/** Issue #341: XLM has 7 decimal places on Stellar. */
const XLM_DECIMALS = 10_000_000;

interface SendTipModalProps {
  isOpen: boolean;
  onClose: () => void;
  missionId: number | string;
  hunterAddress: string;
  hunterName?: string;
  tokenAddress?: string;
  onSuccess?: (receipt: TipReceipt) => void;
}

type TipStep = "form" | "signing_chain" | "success" | "error";

export default function SendTipModal({
  isOpen,
  onClose,
  missionId,
  hunterAddress,
  hunterName = "this hunter",
  tokenAddress,
  onSuccess,
}: SendTipModalProps) {
  const { publicKey, isNetworkMismatch } = useWallet();

  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [step, setStep] = useState<TipStep>("form");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<TipReceipt | null>(null);

  if (!isOpen) return null;

  const defaultToken =
    tokenAddress ||
    process.env.NEXT_PUBLIC_REWARD_TOKEN_XLM ||
    process.env.NEXT_PUBLIC_NATIVE_TOKEN_ID ||
    "";

  const resetState = () => {
    setAmount("");
    setMemo("");
    setStep("form");
    setAmountError(null);
    setErrorMessage(null);
    setReceipt(null);
    onClose();
  };

  const numericMissionId =
    typeof missionId === "number" ? missionId : parseInt(String(missionId).replace(/\D/g, "") || "0", 10);

  const validateAmount = (value: string): number | null => {
    const parsed = Number(value);
    if (!value.trim() || Number.isNaN(parsed) || parsed <= 0) {
      setAmountError("Enter a tip amount greater than zero.");
      return null;
    }
    setAmountError(null);
    return parsed;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = validateAmount(amount);
    if (parsedAmount === null) return;

    if (!publicKey) {
      setErrorMessage("Connect your wallet to send a tip.");
      return;
    }
    if (isNetworkMismatch) {
      setErrorMessage("Switch your wallet to the correct network to send a tip.");
      return;
    }

    setErrorMessage(null);
    setStep("signing_chain");
    toast.loading("Sending tip on Stellar...", {
      id: "send-tip",
      description: "Please approve the transaction in Freighter wallet",
    });

    try {
      const stakeAmount = BigInt(Math.round(parsedAmount * XLM_DECIMALS));

      const tipReceipt = await sendTipToContract({
        tipperAddress: publicKey,
        hunterAddress,
        tokenAddress: defaultToken,
        amount: stakeAmount,
        missionId: numericMissionId,
        memoCid: memo.trim(),
      });

      setReceipt(tipReceipt);
      setStep("success");
      toast.success("Tip sent!", {
        id: "send-tip",
        description: `Tx ${tipReceipt.txHash.slice(0, 18)}...`,
      });
      onSuccess?.(tipReceipt);
    } catch (err: unknown) {
      const quidErr = parseTipJarError(err);
      const msg =
        quidErr.title !== "Transaction failed"
          ? quidErr.title
          : err instanceof Error
            ? err.message
            : "Tip transaction failed";
      setErrorMessage(msg);
      setStep("error");
      toast.error(msg, { id: "send-tip", description: quidErr.description });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md border border-white/15 bg-[#120F1D] p-6 text-foreground shadow-2xl">
        <div className="flex items-start justify-between border-b border-foreground/30 pb-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Send Tip
            </span>
            <h2 className="mt-1 text-xl font-bold text-foreground">
              Reward {hunterName}
            </h2>
          </div>
          <button
            onClick={resetState}
            className="p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5">
          {step === "form" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Tip amount (XLM) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.0000001"
                  required
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (amountError) validateAmount(e.target.value);
                  }}
                  placeholder="e.g. 5"
                  className="mt-2 w-full border border-white/15 bg-white/[0.04] p-3 text-sm text-foreground placeholder-white/30 focus:border-[#B78CFF] focus:outline-none"
                />
                {amountError && (
                  <p className="mt-1 text-xs text-red-400">{amountError}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground">
                  Note (optional)
                </label>
                <textarea
                  rows={2}
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Great work on this mission!"
                  className="mt-2 w-full border border-white/15 bg-white/[0.04] p-3 text-sm text-foreground placeholder-white/30 focus:border-[#B78CFF] focus:outline-none"
                />
              </div>

              {errorMessage && (
                <div className="flex items-center gap-2 border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  <AlertCircle className="size-4 shrink-0 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetState}
                  className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-white/10 hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!amount.trim()}
                  className="inline-flex items-center gap-2 bg-[linear-gradient(135deg,#9011FF_0%,#B78CFF_100%)] px-6 py-2.5 text-sm font-semibold text-foreground shadow-lg transition-transform hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Gift className="size-4" />
                  Send Tip
                </button>
              </div>
            </form>
          )}

          {step === "signing_chain" && (
            <div className="py-10 text-center space-y-4">
              <Loader2 className="mx-auto size-10 animate-spin text-foreground" />
              <h3 className="text-lg font-semibold">Sending your tip...</h3>
              <p className="max-w-md mx-auto text-sm text-muted-foreground">
                Please approve the transaction in your Freighter wallet.
              </p>
            </div>
          )}

          {step === "success" && receipt && (
            <div className="py-6 text-center space-y-4">
              <CheckCircle2 className="mx-auto size-14 text-emerald-400" />
              <h3 className="text-xl font-bold text-foreground">Tip sent successfully!</h3>
              <p className="text-sm text-foreground/75">
                {hunterName} received your tip via the <code className="text-foreground">quid-tip-jar</code> contract.
              </p>

              <div className="border border-foreground/30 brutal-border bg-background p-4 text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transaction:</span>
                  <span className="font-mono text-muted-foreground">{receipt.txHash.slice(0, 18)}...</span>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={resetState}
                  className="bg-[linear-gradient(135deg,#9011FF_0%,#B78CFF_100%)] px-8 py-2.5 text-sm font-semibold text-foreground hover:opacity-95"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="py-6 text-center space-y-4">
              <AlertCircle className="mx-auto size-12 text-red-400" />
              <h3 className="text-lg font-bold text-foreground">Tip failed</h3>
              <p className="text-sm text-red-300 max-w-md mx-auto">{errorMessage}</p>

              <div className="flex justify-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="border border-white/20 px-5 py-2 text-sm font-medium text-foreground hover:bg-white/10"
                >
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={resetState}
                  className="px-5 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
