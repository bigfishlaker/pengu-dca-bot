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
import { parseEther, parseUnits, type Hex } from "viem";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSound } from "@/hooks/use-sound";
import { useSwapQuote, type SwapQuote } from "@/hooks/use-swap-quote";
import {
  getPurchaseHistory,
  addPurchase,
  clearPurchaseHistory,
  type WalletPurchaseData,
} from "@/lib/purchase-storage";
import {
  getTopByPurchases,
  getTopByPengu,
  updateLeaderboard,
  getUserRank,
} from "@/lib/leaderboard-storage";

// ================================
// 🐧 TOKEN CONFIGURATION
// ================================

const TOKEN_ADDRESS = "0x9ebe3a824ca958e4b3da772d2065518f009cba62" as Hex; // PENGU
const TOKEN_NAME = "PENGU";
const TOKEN_EMOJI = "🐧";

const WETH_ADDRESS = "0x3439153EB7AF838Ad19d56E1571FBD09333C2809" as Hex;
const UNISWAP_V2_ROUTER = "0xad1eCa41E6F772bE3cb5A48A6141f9bcc1AF9F7c" as Hex;

// Token purchase range
const MIN_TOKENS = 10;
const MAX_TOKENS = 1000;
const DEFAULT_TOKENS = 100;

// Safety limits
const MAX_SLIPPAGE_PERCENT = 5; // 5% max slippage
const MAX_ETH_PER_TRANSACTION = 0.1; // Max 0.1 ETH per transaction
const QUOTE_EXPIRY_MS = 30000; // Quote expires after 30 seconds

// Estimated ETH per 10 tokens (just for display - real quote is fetched)
const ETH_PER_10_TOKENS = 0.0001;

export function PenguDCABot() {
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Sound effects
  const { playSuccess, toggleSound, isEnabled } = useSound();

  // Swap quote hook
  const { getQuote, isLoading: isQuoteLoading } = useSwapQuote();

  // Purchase tracking
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
  const [isCelebrating, setIsCelebrating] = useState(false);
  
  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [currentQuote, setCurrentQuote] = useState<SwapQuote | null>(null);
  const [quoteTimestamp, setQuoteTimestamp] = useState<number>(0);
  
  // Leaderboard state
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [topClickers, setTopClickers] = useState(getTopByPurchases(10));
  const [topRollers, setTopRollers] = useState(getTopByPengu(10));
  const [userRank, setUserRank] = useState({ purchasesRank: 0, penguRank: 0 });

  // Load purchase history and leaderboard when wallet connects
  useEffect(() => {
    if (address) {
      const data = getPurchaseHistory(address);
      setPurchaseData(data);
      
      // Update leaderboard with current data
      updateLeaderboard(address, data.purchases.length, data.totalTokens);
      setTopClickers(getTopByPurchases(10));
      setTopRollers(getTopByPengu(10));
      setUserRank(getUserRank(address));
    }
  }, [address]);

  // Handle successful transactions
  useEffect(() => {
    if (isSuccess && txStartTime > 0 && address && lastPurchasedAmount > 0 && currentQuote) {
      const confirmTime = Date.now() - txStartTime;
      const ethSpent = currentQuote.estimatedEth;
      const pricePerToken = currentQuote.pricePerToken;

      // Add to purchase history
      addPurchase(address, {
        timestamp: Date.now(),
        tokenAmount: lastPurchasedAmount,
        ethSpent,
        txHash: hash,
        pricePerToken,
      });

      // Reload data
      const updatedData = getPurchaseHistory(address);
      setPurchaseData(updatedData);

      // Update leaderboard
      updateLeaderboard(address, updatedData.purchases.length, updatedData.totalTokens);
      setTopClickers(getTopByPurchases(10));
      setTopRollers(getTopByPengu(10));
      setUserRank(getUserRank(address));

      // Trigger celebration mode with sound
      setIsCelebrating(true);
      playSuccess();

      // Turn off celebrations after audio finishes (700ms)
      setTimeout(() => setIsCelebrating(false), 700);

      toast.success(`${TOKEN_EMOJI} Bought ${lastPurchasedAmount} ${TOKEN_NAME} in ${confirmTime}ms!`, {
        description: `Total: ${updatedData.totalTokens.toLocaleString()} PENGU`,
      });

      setTxStartTime(0);
      setLastPurchasedAmount(0);
      setCurrentQuote(null);
    }
  }, [isSuccess, txStartTime, address, hash, lastPurchasedAmount, playSuccess, currentQuote]);

  // Step 1: Get quote and show confirmation
  const handleGetQuote = useCallback(async () => {
    if (!isConnected || isPending || isConfirming || !address) return;

    try {
      const quote = await getQuote(tokensPerPurchase);
      
      if (!quote) {
        toast.error("Failed to get price quote. Please try again.");
        return;
      }

      // Safety check #6: Liquidity check
      if (!quote.hasLiquidity) {
        toast.error("Insufficient liquidity for this trade size!");
        return;
      }

      // Safety check #4: Max spend limit
      if (quote.estimatedEth > MAX_ETH_PER_TRANSACTION) {
        toast.error(`Trade exceeds max limit of ${MAX_ETH_PER_TRANSACTION} ETH!`);
        return;
      }

      setCurrentQuote(quote);
      setQuoteTimestamp(Date.now());
      setShowConfirmDialog(true);
    } catch (error: any) {
      // Safety check #5: Better error handling
      console.error("Quote error:", error);
      toast.error(error.message || "Failed to get quote");
    }
  }, [isConnected, isPending, isConfirming, address, getQuote, tokensPerPurchase]);

  // Step 2: Execute confirmed transaction
  const handleConfirmPurchase = useCallback(() => {
    if (!currentQuote || !address) return;

    // Check if quote is stale
    if (Date.now() - quoteTimestamp > QUOTE_EXPIRY_MS) {
      toast.error("Quote expired. Please get a new quote.");
      setShowConfirmDialog(false);
      return;
    }

    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
    const path = [WETH_ADDRESS, TOKEN_ADDRESS];

    // Safety check #1: Add slippage protection (5%)
    const slippageMultiplier = 1 + (MAX_SLIPPAGE_PERCENT / 100);
    const maxEthWithSlippage = currentQuote.amountIn * BigInt(Math.floor(slippageMultiplier * 100)) / 100n;

    setTxStartTime(Date.now());
    setLastPurchasedAmount(tokensPerPurchase);
    setShowConfirmDialog(false);

    // Execute transaction with safety limits
    writeContract({
      abi: UNISWAP_V2_ROUTER_ABI,
      address: UNISWAP_V2_ROUTER,
      functionName: "swapETHForExactTokens",
      args: [
        currentQuote.amountOut, // Exact amount of PENGU to receive
        path,
        address,
        BigInt(deadline),
      ],
      value: maxEthWithSlippage, // Max ETH with slippage protection
    });
  }, [currentQuote, address, tokensPerPurchase, writeContract, quoteTimestamp]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-4 border-pink-400 bg-white/90 shadow-2xl mx-4 relative">
        <div className="absolute -top-4 -left-4 text-3xl">⭐</div>
        <div className="absolute -top-4 -right-4 text-3xl">✨</div>
        <div className="absolute -bottom-4 -left-4 text-3xl">💕</div>
        <div className="absolute -bottom-4 -right-4 text-3xl">🌸</div>
        
        <div className="text-7xl">🐧</div>
        <h2 className="text-xl font-black bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
          ♡ Connect Wallet ♡
        </h2>
        <p className="text-sm text-purple-600 font-bold text-center">
          ゆっくりしていってね！<br/>Start your PENGU DCA ★
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 p-4 max-w-5xl mx-auto">
      {/* Compressed Header */}
      <div className="text-center space-y-1 relative p-4 rounded-2xl bg-white/90 backdrop-blur-sm border-4 border-pink-400 shadow-2xl transform hover:rotate-1 transition-transform">
        {/* Decorations - only animate on celebration */}
        <div className={cn("absolute -top-4 -left-4 text-4xl transition-transform", isCelebrating && "animate-spin")}>🌸</div>
        <div className={cn("absolute -top-4 -right-4 text-4xl transition-transform", isCelebrating && "animate-spin")}>🌸</div>
        <div className={cn("absolute -bottom-4 -left-4 text-4xl", isCelebrating && "animate-bounce")}>💕</div>
        <div className={cn("absolute -bottom-4 -right-4 text-4xl", isCelebrating && "animate-bounce")}>💕</div>
        <div className={cn("absolute top-1/2 -left-6 text-3xl", isCelebrating && "animate-pulse")}>✨</div>
        <div className={cn("absolute top-1/2 -right-6 text-3xl", isCelebrating && "animate-pulse")}>✨</div>
        
        <h1 className={cn(
          "text-4xl md:text-5xl font-black bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent drop-shadow-lg",
          isCelebrating && "animate-pulse"
        )}>
          ～★ PENGU DCA BOT 🐧 ★～
        </h1>
        <p className="text-base text-purple-600 font-black">
          ゆっくりしていってね！♡ DCA ♡
        </p>
        
        {/* Sound Toggle - cute style */}
        <Button
          variant="outline"
          size="sm"
          onClick={toggleSound}
          className="absolute top-2 right-2 bg-pink-100 hover:bg-pink-200 border-2 border-pink-300 rounded-full transition-all"
          title={isEnabled ? "Mute sounds" : "Unmute sounds"}
        >
          <span className="text-xl">{isEnabled ? "🔊" : "🔇"}</span>
        </Button>
      </div>

      {/* Stats Dashboard */}
      <div className="w-full max-w-2xl space-y-2 -mt-2">
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            label="Total PENGU"
            value={purchaseData.totalTokens.toLocaleString()}
            icon="🐧"
            highlight={purchaseData.totalTokens > 0}
            isCelebrating={isCelebrating}
          />
          <StatCard
            label="Total Purchases"
            value={purchaseData.purchases.length.toString()}
            icon="📈"
            isCelebrating={isCelebrating}
          />
        </div>
        
        {/* Leaderboard Button */}
        <Button
          onClick={() => setShowLeaderboard(!showLeaderboard)}
          variant="outline"
          className="w-full border-3 border-yellow-400 bg-gradient-to-r from-yellow-100 to-orange-100 hover:from-yellow-200 hover:to-orange-200 font-black text-purple-600"
        >
          <span className="text-xl mr-2">🏆</span>
          {showLeaderboard ? "Hide Leaderboard" : "Show Leaderboard"}
          <span className="text-xl ml-2">🏆</span>
        </Button>
      </div>

      {/* Leaderboard Display */}
      {showLeaderboard && (
        <div className="w-full max-w-2xl space-y-3 -mt-2">
          {/* User's Rank */}
          {address && (userRank.purchasesRank > 0 || userRank.penguRank > 0) && (
            <div className="p-3 rounded-xl bg-gradient-to-r from-yellow-100 to-orange-100 border-3 border-yellow-400 text-center">
              <p className="text-sm font-black text-purple-600">
                ★ Your Ranks: #{userRank.purchasesRank || "?"} Most Clicks | #{userRank.penguRank || "?"} High Roller ★
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Most Clicks Leaderboard */}
            <div className="p-4 rounded-2xl border-4 border-pink-400 bg-white/95 shadow-xl">
              <h3 className="text-lg font-black text-center bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent mb-3">
                👆 Most Clicks 👆
              </h3>
              <div className="space-y-2">
                {topClickers.slice(0, 5).map((entry, idx) => (
                  <div
                    key={entry.address}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg",
                      idx === 0 && "bg-yellow-100 border-2 border-yellow-400",
                      idx === 1 && "bg-gray-100 border-2 border-gray-400",
                      idx === 2 && "bg-orange-100 border-2 border-orange-400",
                      idx > 2 && "bg-purple-50 border border-purple-200",
                      entry.address.toLowerCase() === address?.toLowerCase() && "ring-2 ring-pink-400"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                      </span>
                      <span className="text-xs font-bold text-purple-600 font-mono">
                        {entry.displayName}
                      </span>
                    </div>
                    <span className="text-sm font-black text-pink-600">
                      {entry.totalPurchases} clicks
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* High Rollers Leaderboard */}
            <div className="p-4 rounded-2xl border-4 border-purple-400 bg-white/95 shadow-xl">
              <h3 className="text-lg font-black text-center bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-3">
                💎 High Rollers 💎
              </h3>
              <div className="space-y-2">
                {topRollers.slice(0, 5).map((entry, idx) => (
                  <div
                    key={entry.address}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg",
                      idx === 0 && "bg-yellow-100 border-2 border-yellow-400",
                      idx === 1 && "bg-gray-100 border-2 border-gray-400",
                      idx === 2 && "bg-orange-100 border-2 border-orange-400",
                      idx > 2 && "bg-pink-50 border border-pink-200",
                      entry.address.toLowerCase() === address?.toLowerCase() && "ring-2 ring-purple-400"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                      </span>
                      <span className="text-xs font-bold text-purple-600 font-mono">
                        {entry.displayName}
                      </span>
                    </div>
                    <span className="text-sm font-black text-purple-600">
                      {entry.totalPengu.toLocaleString()} 🐧
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Controls */}
      <div className="relative w-full max-w-2xl space-y-3 p-4 rounded-2xl border-4 border-pink-400 bg-white/95 backdrop-blur-md shadow-2xl -mt-2 transform hover:-rotate-1 transition-transform">
        {/* Decorations - only animate on celebration */}
        <div className={cn("absolute -top-5 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full border-4 border-pink-400", isCelebrating && "animate-bounce")}>
          <span className="text-3xl">🎀</span>
        </div>
        <div className={cn("absolute -top-3 left-10 text-2xl", isCelebrating && "animate-spin")}>⭐</div>
        <div className={cn("absolute -top-3 right-10 text-2xl", isCelebrating && "animate-spin")}>⭐</div>
        <div className={cn("absolute top-1/2 -left-4 text-3xl", isCelebrating && "animate-pulse")}>💫</div>
        <div className={cn("absolute top-1/2 -right-4 text-3xl", isCelebrating && "animate-pulse")}>💫</div>
        
        <h3 className={cn(
          "text-xl font-black text-center bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent pt-6",
          isCelebrating && "animate-pulse"
        )}>
          ★✧ Make Purchase ✧★
        </h3>
        
        {/* Token Slider */}
        <div className="space-y-2 p-3 rounded-xl bg-gradient-to-br from-pink-50 to-purple-50 border-2 border-purple-300">
          <div className="flex justify-between items-center">
            <label className="text-sm font-black text-purple-600">Tokens ♡</label>
            <span className={cn(
              "text-2xl font-black bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent",
              isCelebrating && "animate-pulse"
            )}>
              {tokensPerPurchase} 🐧
            </span>
          </div>
          <Slider
            value={[tokensPerPurchase]}
            onValueChange={(value) => setTokensPerPurchase(value[0])}
            min={MIN_TOKENS}
            max={MAX_TOKENS}
            step={10}
            className="w-full"
            disabled={isPending || isConfirming}
          />
          <div className="flex justify-between text-xs font-bold text-purple-500">
            <span>✧{MIN_TOKENS}</span>
            <span className="text-center text-pink-500">
              ~{((tokensPerPurchase / 10) * ETH_PER_10_TOKENS).toFixed(4)} ETH
            </span>
            <span>{MAX_TOKENS}✧</span>
          </div>
        </div>

        {/* Buy Button */}
        <Button
          onClick={handleGetQuote}
          disabled={isPending || isConfirming || isQuoteLoading}
          className={cn(
            "relative w-full text-xl font-black py-6 rounded-xl overflow-hidden border-4 border-pink-500",
            "bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400",
            "hover:from-pink-500 hover:via-purple-500 hover:to-blue-500",
            "shadow-2xl hover:shadow-pink-500/50",
            "transition-all duration-200 hover:scale-110 hover:rotate-2",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:rotate-0",
            "text-white drop-shadow-2xl",
            isCelebrating && "animate-pulse"
          )}
        >
          {/* Sparkles - only on celebration */}
          <div className={cn("absolute top-1 left-2 text-2xl", isCelebrating && "animate-spin")}>✨</div>
          <div className={cn("absolute top-1 right-2 text-2xl", isCelebrating && "animate-spin")}>✨</div>
          <div className={cn("absolute bottom-1 left-1/4 text-xl", isCelebrating && "animate-bounce")}>⭐</div>
          <div className={cn("absolute bottom-1 right-1/4 text-xl", isCelebrating && "animate-bounce")}>⭐</div>
          
          <span className="relative z-10">
            {isQuoteLoading ? (
              <span className="animate-pulse">♡ Getting Price... 💫</span>
            ) : isPending ? (
              <span>♡♡ Signing... ✍️ ♡♡</span>
            ) : isConfirming ? (
              <span className="animate-bounce">★ Buying PENGU... 🚀 ★</span>
            ) : (
              `★✧♡ Buy ${tokensPerPurchase} PENGU 🐧 ♡✧★`
            )}
          </span>
        </Button>

        {/* Clear History */}
        {purchaseData.purchases.length > 0 && (
          <Button
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
                toast.success("History cleared ♡");
              }
            }}
            variant="outline"
            size="sm"
            className="w-full border-2 border-purple-400 hover:bg-purple-100 text-purple-700 font-black text-xs"
            disabled={isPending || isConfirming}
          >
            ✕ Clear ✕
          </Button>
        )}
      </div>

      {/* Purchase History */}
      {purchaseData.purchases.length > 0 && (
        <div className="w-full space-y-2 -mt-2">
          <h3 className={cn(
            "text-xl font-black text-center bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent relative",
            isCelebrating && "animate-pulse"
          )}>
            <span className={cn("absolute -left-8", isCelebrating && "animate-spin")}>💫</span>
            ♡★ Purchase History ★♡
            <span className={cn("absolute -right-8", isCelebrating && "animate-spin")}>💫</span>
          </h3>
          <div className="rounded-xl border-4 border-purple-400 bg-white/95 backdrop-blur-sm overflow-hidden shadow-2xl transform hover:scale-102 transition-transform">
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gradient-to-r from-pink-200 to-purple-200 sticky top-0 border-b-2 border-pink-400">
                  <tr>
                    <th className="p-2 text-left font-black text-purple-700">Date ♡</th>
                    <th className="p-2 text-right font-black text-purple-700">Amount 🐧</th>
                    <th className="p-2 text-right font-black text-purple-700">ETH 💎</th>
                    <th className="p-2 text-right font-black text-purple-700">Price ✧</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseData.purchases.slice().reverse().map((purchase, idx) => (
                    <tr key={purchase.id} className={cn(
                      "border-t border-purple-200 hover:bg-pink-100 transition-colors",
                      idx % 2 === 0 ? "bg-white" : "bg-purple-50/50"
                    )}>
                      <td className="p-2 text-xs font-semibold text-purple-600">
                        {new Date(purchase.timestamp).toLocaleDateString()} {new Date(purchase.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </td>
                      <td className="p-2 text-right font-black text-pink-600">
                        {purchase.tokenAmount.toLocaleString()}
                      </td>
                      <td className="p-2 text-right font-bold text-purple-600">
                        {purchase.ethSpent.toFixed(4)}
                      </td>
                      <td className="p-2 text-right font-semibold text-purple-500">
                        {(purchase.pricePerToken * 1000000).toFixed(1)}µ
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className={cn(
            "text-center text-xs font-black text-purple-600",
            isCelebrating && "animate-pulse"
          )}>
            ★✧♡ Total: {purchaseData.purchases.length} ♡✧★
          </p>
        </div>
      )}

      {/* Donation Footer - Milady style */}
      <div className="w-full max-w-2xl mt-4 p-4 rounded-2xl border-3 border-pink-300 bg-white/80 backdrop-blur-sm shadow-lg text-center relative">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-3xl">💝</div>
        <p className="text-sm font-bold text-purple-600 mb-2">
          ♡ Enjoying the bot? Support the dev! ♡
        </p>
        <a
          href="https://portal.abs.xyz/profile/0xe77c0bA7f9Ef40A018B48Ce37731195726254Df7"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-2 rounded-full border-3 border-pink-400 bg-gradient-to-r from-pink-100 to-purple-100 hover:from-pink-200 hover:to-purple-200 transition-all hover:scale-105 shadow-md"
        >
          <span className="text-2xl">💕</span>
          <span className="font-black bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
            Donate via AGW
          </span>
          <span className="text-lg">✨</span>
        </a>
        <p className="text-xs text-purple-500 mt-2 font-semibold">
          ★ Thank you for your support! ★
        </p>
      </div>

      {/* Confirmation Dialog - Safety Check #3 */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="border-4 border-pink-400 bg-white/95 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent text-center">
              ♡ Confirm Purchase ♡
            </DialogTitle>
            <DialogDescription className="text-center text-purple-600 font-semibold">
              Please review your purchase details
            </DialogDescription>
          </DialogHeader>

          {currentQuote && (
            <div className="space-y-4 py-4">
              {/* Purchase Details */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-pink-50 to-purple-50 border-2 border-purple-300 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-purple-600">You&apos;re Buying:</span>
                  <span className="text-xl font-black text-pink-600">
                    {tokensPerPurchase} PENGU 🐧
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-purple-600">Estimated Cost:</span>
                  <span className="text-lg font-bold text-purple-600">
                    {currentQuote.estimatedEth.toFixed(6)} ETH
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-purple-600">Price per Token:</span>
                  <span className="text-sm font-semibold text-purple-500">
                    {(currentQuote.pricePerToken * 1000000).toFixed(2)} µETH
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t-2 border-purple-200">
                  <span className="text-sm font-bold text-purple-600">Max w/ Slippage ({MAX_SLIPPAGE_PERCENT}%):</span>
                  <span className="text-lg font-black text-pink-600">
                    {(currentQuote.estimatedEth * (1 + MAX_SLIPPAGE_PERCENT / 100)).toFixed(6)} ETH
                  </span>
                </div>
              </div>

              {/* Warning if expensive */}
              {currentQuote.estimatedEth > 0.01 && (
                <div className="p-3 rounded-lg bg-yellow-100 border-2 border-yellow-400">
                  <p className="text-sm font-bold text-yellow-700 text-center">
                    ⚠️ This purchase will cost more than 0.01 ETH!
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="flex-1 border-2 border-purple-300 hover:bg-purple-50 font-bold"
            >
              ✕ Cancel
            </Button>
            <Button
              onClick={handleConfirmPurchase}
              className="flex-1 bg-gradient-to-r from-pink-400 to-purple-400 hover:from-pink-500 hover:to-purple-500 text-white font-black border-2 border-pink-500"
            >
              ✓ Confirm Purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight = false,
  isCelebrating = false,
}: {
  label: string;
  value: string;
  icon: string;
  highlight?: boolean;
  isCelebrating?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative group p-3 rounded-xl border-4 bg-white/95 backdrop-blur-sm shadow-xl transition-all duration-200",
        "hover:shadow-2xl hover:scale-110 hover:-translate-y-1 hover:rotate-2",
        highlight 
          ? "border-pink-500 bg-gradient-to-br from-pink-100 to-purple-100" 
          : "border-purple-400 hover:border-pink-400",
        isCelebrating && highlight && "animate-pulse"
      )}
    >
      {/* MAXIMUM decorations - only on celebration */}
      <div className={cn(
        "absolute -top-3 -right-3 text-3xl opacity-0 transition-opacity",
        isCelebrating ? "opacity-100 animate-spin" : "group-hover:opacity-100"
      )}>✨</div>
      <div className={cn(
        "absolute -top-3 -left-3 text-2xl opacity-0 transition-opacity",
        isCelebrating ? "opacity-100 animate-bounce" : "group-hover:opacity-100"
      )}>⭐</div>
      
      <div className={cn(
        "text-4xl mb-1 transition-transform duration-200 drop-shadow-lg",
        isCelebrating ? "animate-bounce" : "group-hover:scale-125"
      )}>{icon}</div>
      <div className="text-2xl font-black bg-gradient-to-br from-pink-500 to-purple-500 bg-clip-text text-transparent">{value}</div>
      <div className="text-xs text-purple-700 font-black mt-1">{label}</div>
      
      {/* Milady card bottom border - THICKER */}
      <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 rounded-b-lg" />
    </div>
  );
}

