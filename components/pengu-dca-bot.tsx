"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { UNISWAP_V2_ROUTER_ABI } from "@/config/abstract-contracts";
import { type Hex } from "viem";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSwapQuote, type SwapQuote } from "@/hooks/use-swap-quote";
import {
  getPurchaseHistory,
  addPurchase,
  clearPurchaseHistory,
  type WalletPurchaseData,
} from "@/lib/purchase-storage";

// ================================
// TOKEN CONFIGURATION
// ================================

const TOKEN_ADDRESS = "0x9ebe3a824ca958e4b3da772d2065518f009cba62" as Hex;
const TOKEN_NAME = "PENGU";

const WETH_ADDRESS = "0x3439153EB7AF838Ad19d56E1571FBD09333C2809" as Hex;
const UNISWAP_V2_ROUTER = "0xad1eCa41E6F772bE3cb5A48A6141f9bcc1AF9F7c" as Hex;

// Token purchase range
const MIN_TOKENS = 10;
const MAX_TOKENS = 1000;
const DEFAULT_TOKENS = 100;

// Safety limits
const MAX_SLIPPAGE_PERCENT = 5;
const MAX_ETH_PER_TRANSACTION = 0.1;
const QUOTE_EXPIRY_MS = 30000;

export function PenguDCABot() {
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const { getQuote, isLoading: isQuoteLoading } = useSwapQuote();

  const [purchaseData, setPurchaseData] = useState<WalletPurchaseData>({
    purchases: [],
    totalTokens: 0,
    totalEthSpent: 0,
    averagePrice: 0,
    lastUpdated: Date.now(),
  });

  const [tokensPerPurchase, setTokensPerPurchase] = useState<number>(DEFAULT_TOKENS);
  const [txStartTime, setTxStartTime] = useState<number>(0);
  const [lastPurchasedAmount, setLastPurchasedAmount] = useState<number>(0);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [currentQuote, setCurrentQuote] = useState<SwapQuote | null>(null);
  const [quoteTimestamp, setQuoteTimestamp] = useState<number>(0);

  useEffect(() => {
    if (address) {
      const data = getPurchaseHistory(address);
      setPurchaseData(data);
    }
  }, [address]);

  useEffect(() => {
    if (isSuccess && txStartTime > 0 && address && lastPurchasedAmount > 0 && currentQuote) {
      const confirmTime = Date.now() - txStartTime;
      const ethSpent = currentQuote.estimatedEth;
      const pricePerToken = currentQuote.pricePerToken;

      addPurchase(address, {
        timestamp: Date.now(),
        tokenAmount: lastPurchasedAmount,
        ethSpent,
        txHash: hash,
        pricePerToken,
      });

      const updatedData = getPurchaseHistory(address);
      setPurchaseData(updatedData);

      toast.success(`Bought ${lastPurchasedAmount} ${TOKEN_NAME} in ${confirmTime}ms`, {
        description: `Total held: ${updatedData.totalTokens.toLocaleString()} ${TOKEN_NAME}`,
      });

      setTxStartTime(0);
      setLastPurchasedAmount(0);
      setCurrentQuote(null);
    }
  }, [isSuccess, txStartTime, address, hash, lastPurchasedAmount, currentQuote]);

  const handleGetQuote = useCallback(async () => {
    if (!isConnected || isPending || isConfirming || !address) return;

    try {
      const quote = await getQuote(tokensPerPurchase);

      if (!quote) {
        toast.error("Failed to get price quote. Please try again.");
        return;
      }

      if (!quote.hasLiquidity) {
        toast.error("Insufficient liquidity for this trade size.");
        return;
      }

      if (quote.estimatedEth > MAX_ETH_PER_TRANSACTION) {
        toast.error(`Trade exceeds the ${MAX_ETH_PER_TRANSACTION} ETH limit per transaction.`);
        return;
      }

      setCurrentQuote(quote);
      setQuoteTimestamp(Date.now());
      setShowConfirmDialog(true);
    } catch (error: any) {
      console.error("Quote error:", error);
      toast.error(error.message || "Failed to get quote");
    }
  }, [isConnected, isPending, isConfirming, address, getQuote, tokensPerPurchase]);

  const handleConfirmPurchase = useCallback(() => {
    if (!currentQuote || !address) return;

    if (Date.now() - quoteTimestamp > QUOTE_EXPIRY_MS) {
      toast.error("Quote expired. Please get a fresh quote.");
      setShowConfirmDialog(false);
      return;
    }

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    const path = [WETH_ADDRESS, TOKEN_ADDRESS];

    const slippageMultiplier = 1 + MAX_SLIPPAGE_PERCENT / 100;
    const maxEthWithSlippage =
      currentQuote.amountIn * BigInt(Math.floor(slippageMultiplier * 100)) / BigInt(100);

    setTxStartTime(Date.now());
    setLastPurchasedAmount(tokensPerPurchase);
    setShowConfirmDialog(false);

    writeContract({
      abi: UNISWAP_V2_ROUTER_ABI,
      address: UNISWAP_V2_ROUTER,
      functionName: "swapETHForExactTokens",
      args: [currentQuote.amountOut, path, address, BigInt(deadline)],
      value: maxEthWithSlippage,
    });
  }, [currentQuote, address, tokensPerPurchase, writeContract, quoteTimestamp]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="w-full max-w-sm p-8 rounded-2xl border border-slate-800 bg-slate-900 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto">
            <WalletIcon className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Connect your wallet</h2>
            <p className="text-sm text-slate-400 mt-1">
              Connect to start dollar-cost averaging into {TOKEN_NAME}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isbusy = isPending || isConfirming || isQuoteLoading;

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto px-4">

      {/* Page title */}
      <div className="pt-2">
        <h1 className="text-2xl font-semibold text-white">DCA into {TOKEN_NAME}</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Dollar-cost average on Abstract via Uniswap V2
        </p>
      </div>

      {/* Stats row */}
      {(purchaseData.totalTokens > 0 || purchaseData.purchases.length > 0) && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total PENGU" value={purchaseData.totalTokens.toLocaleString()} />
          <StatCard label="Purchases" value={purchaseData.purchases.length.toString()} />
          <StatCard
            label="Avg Price"
            value={
              purchaseData.averagePrice > 0
                ? `${(purchaseData.averagePrice * 1_000_000).toFixed(1)}µ`
                : "—"
            }
          />
        </div>
      )}

      {/* Buy panel */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-5">
        <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
          Place Order
        </h2>

        {/* Amount selector */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-slate-400">Amount</label>
            <span className="text-xl font-semibold text-white">
              {tokensPerPurchase.toLocaleString()}{" "}
              <span className="text-slate-400 text-base font-normal">{TOKEN_NAME}</span>
            </span>
          </div>
          <Slider
            value={[tokensPerPurchase]}
            onValueChange={(value) => setTokensPerPurchase(value[0])}
            min={MIN_TOKENS}
            max={MAX_TOKENS}
            step={10}
            className="w-full"
            disabled={isbusy}
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>{MIN_TOKENS}</span>
            <span>{MAX_TOKENS}</span>
          </div>
        </div>

        {/* Limits info */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
          <InfoIcon className="w-4 h-4 text-slate-500 shrink-0" />
          <p className="text-xs text-slate-400">
            Max {MAX_ETH_PER_TRANSACTION} ETH per transaction &middot; {MAX_SLIPPAGE_PERCENT}% max slippage &middot; Live Uniswap V2 quote
          </p>
        </div>

        {/* Buy button */}
        <Button
          onClick={handleGetQuote}
          disabled={isbusy}
          className={cn(
            "w-full h-12 text-base font-semibold rounded-xl",
            "bg-blue-600 hover:bg-blue-500 text-white",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors"
          )}
        >
          {isQuoteLoading
            ? "Fetching quote..."
            : isPending
            ? "Confirm in wallet..."
            : isConfirming
            ? "Confirming transaction..."
            : `Buy ${tokensPerPurchase.toLocaleString()} ${TOKEN_NAME}`}
        </Button>
      </div>

      {/* Purchase history */}
      {purchaseData.purchases.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-slate-800">
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">
              Purchase History
            </h2>
            <button
              onClick={() => {
                if (address && confirm("Clear all purchase history? This cannot be undone.")) {
                  clearPurchaseHistory(address);
                  setPurchaseData({
                    purchases: [],
                    totalTokens: 0,
                    totalEthSpent: 0,
                    averagePrice: 0,
                    lastUpdated: Date.now(),
                  });
                  toast.success("History cleared");
                }
              }}
              disabled={isbusy}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors disabled:opacity-40"
            >
              Clear
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-900 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    ETH
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Price
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {purchaseData.purchases
                  .slice()
                  .reverse()
                  .map((purchase) => (
                    <tr
                      key={purchase.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {new Date(purchase.timestamp).toLocaleDateString()}{" "}
                        {new Date(purchase.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-5 py-3 text-right text-white font-medium">
                        {purchase.tokenAmount.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-300">
                        {purchase.ethSpent.toFixed(4)}
                      </td>
                      <td className="px-5 py-3 text-right text-slate-400 text-xs">
                        {(purchase.pricePerToken * 1_000_000).toFixed(1)}µ
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="border border-slate-700 bg-slate-900 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white text-lg font-semibold">
              Confirm Purchase
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Review your order before confirming
            </DialogDescription>
          </DialogHeader>

          {currentQuote && (
            <div className="space-y-3 py-2">
              <div className="rounded-xl border border-slate-700 bg-slate-800 divide-y divide-slate-700">
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-sm text-slate-400">Buying</span>
                  <span className="text-base font-semibold text-white">
                    {tokensPerPurchase.toLocaleString()} {TOKEN_NAME}
                  </span>
                </div>
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-sm text-slate-400">Estimated cost</span>
                  <span className="text-sm font-medium text-white">
                    {currentQuote.estimatedEth.toFixed(6)} ETH
                  </span>
                </div>
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-sm text-slate-400">Price per token</span>
                  <span className="text-sm text-slate-300">
                    {(currentQuote.pricePerToken * 1_000_000).toFixed(2)} µETH
                  </span>
                </div>
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="text-sm text-slate-400">
                    Max with {MAX_SLIPPAGE_PERCENT}% slippage
                  </span>
                  <span className="text-sm font-semibold text-white">
                    {(currentQuote.estimatedEth * (1 + MAX_SLIPPAGE_PERCENT / 100)).toFixed(6)} ETH
                  </span>
                </div>
              </div>

              {currentQuote.estimatedEth > 0.01 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <span className="text-amber-400 mt-0.5">⚠</span>
                  <p className="text-sm text-amber-300">
                    This purchase exceeds 0.01 ETH. Please review carefully.
                  </p>
                </div>
              )}

              <p className="text-xs text-slate-500 text-center">
                Quote valid for 30 seconds
              </p>
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="flex-1 border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPurchase}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold"
            >
              Confirm Purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-semibold text-white truncate">{value}</p>
    </div>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 640"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="currentColor"
    >
      <path d="M128 96C92.7 96 64 124.7 64 160L64 448C64 483.3 92.7 512 128 512L512 512C547.3 512 576 483.3 576 448L576 256C576 220.7 547.3 192 512 192L136 192C122.7 192 112 181.3 112 168C112 154.7 122.7 144 136 144L520 144C533.3 144 544 133.3 544 120C544 106.7 533.3 96 520 96L128 96zM480 320C497.7 320 512 334.3 512 352C512 369.7 497.7 384 480 384C462.3 384 448 369.7 448 352C448 334.3 462.3 320 480 320z" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}
