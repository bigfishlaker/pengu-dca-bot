"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useLoginWithAbstract } from "@abstract-foundation/agw-react";
import { useBalance } from "wagmi";
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

// ── Contract addresses ────────────────────────────────────────────────────────
const TOKEN_ADDRESS = "0x9ebe3a824ca958e4b3da772d2065518f009cba62" as Hex;
const WETH_ADDRESS  = "0x3439153EB7AF838Ad19d56E1571FBD09333C2809" as Hex;
const UNISWAP_V2_ROUTER = "0xad1eCa41E6F772bE3cb5A48A6141f9bcc1AF9F7c" as Hex;

const TOKEN_NAME = "PENGU";
const MIN_TOKENS = 10;
const MAX_TOKENS = 1000;
const DEFAULT_TOKENS = 100;
const MAX_SLIPPAGE_PERCENT = 5;
const MAX_ETH_PER_TRANSACTION = 0.1;
const QUOTE_EXPIRY_MS = 30000;

type Tab = "buy" | "history";

// ── Root component ────────────────────────────────────────────────────────────
export function PenguDCABot() {
  const { address, isConnected } = useAccount();
  const { login, logout } = useLoginWithAbstract();
  const { data: balance } = useBalance({ address });
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });
  const { getQuote, isLoading: isQuoteLoading } = useSwapQuote();

  const [tab, setTab] = useState<Tab>("buy");
  const [purchaseData, setPurchaseData] = useState<WalletPurchaseData>({
    purchases: [], totalTokens: 0, totalEthSpent: 0, averagePrice: 0, lastUpdated: Date.now(),
  });
  const [tokensPerPurchase, setTokensPerPurchase] = useState(DEFAULT_TOKENS);
  const [txStartTime, setTxStartTime] = useState(0);
  const [lastPurchasedAmount, setLastPurchasedAmount] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [currentQuote, setCurrentQuote] = useState<SwapQuote | null>(null);
  const [quoteTimestamp, setQuoteTimestamp] = useState(0);

  useEffect(() => {
    if (address) setPurchaseData(getPurchaseHistory(address));
  }, [address]);

  useEffect(() => {
    if (isSuccess && txStartTime > 0 && address && lastPurchasedAmount > 0 && currentQuote) {
      const confirmTime = Date.now() - txStartTime;
      addPurchase(address, {
        timestamp: Date.now(),
        tokenAmount: lastPurchasedAmount,
        ethSpent: currentQuote.estimatedEth,
        txHash: hash,
        pricePerToken: currentQuote.pricePerToken,
      });
      const updated = getPurchaseHistory(address);
      setPurchaseData(updated);
      toast.success(`Bought ${lastPurchasedAmount.toLocaleString()} ${TOKEN_NAME}`, {
        description: `Confirmed in ${confirmTime}ms · Total: ${updated.totalTokens.toLocaleString()}`,
      });
      setTxStartTime(0); setLastPurchasedAmount(0); setCurrentQuote(null);
    }
  }, [isSuccess, txStartTime, address, hash, lastPurchasedAmount, currentQuote]);

  const handleGetQuote = useCallback(async () => {
    if (!isConnected || isPending || isConfirming || !address) return;
    try {
      const quote = await getQuote(tokensPerPurchase);
      if (!quote) { toast.error("Failed to get quote. Try again."); return; }
      if (!quote.hasLiquidity) { toast.error("Insufficient liquidity."); return; }
      if (quote.estimatedEth > MAX_ETH_PER_TRANSACTION) {
        toast.error(`Exceeds ${MAX_ETH_PER_TRANSACTION} ETH limit.`); return;
      }
      setCurrentQuote(quote); setQuoteTimestamp(Date.now()); setShowConfirmDialog(true);
    } catch (e: any) { toast.error(e.message || "Quote failed"); }
  }, [isConnected, isPending, isConfirming, address, getQuote, tokensPerPurchase]);

  const handleConfirmPurchase = useCallback(() => {
    if (!currentQuote || !address) return;
    if (Date.now() - quoteTimestamp > QUOTE_EXPIRY_MS) {
      toast.error("Quote expired. Get a fresh quote."); setShowConfirmDialog(false); return;
    }
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;
    const maxEthWithSlippage = (currentQuote.amountIn * BigInt(100 + MAX_SLIPPAGE_PERCENT)) / BigInt(100);
    setTxStartTime(Date.now()); setLastPurchasedAmount(tokensPerPurchase); setShowConfirmDialog(false);
    writeContract({
      abi: UNISWAP_V2_ROUTER_ABI,
      address: UNISWAP_V2_ROUTER,
      functionName: "swapETHForExactTokens",
      args: [currentQuote.amountOut, [WETH_ADDRESS, TOKEN_ADDRESS], address, BigInt(deadline)],
      value: maxEthWithSlippage,
    });
  }, [currentQuote, address, tokensPerPurchase, writeContract, quoteTimestamp]);

  const isBusy = isPending || isConfirming || isQuoteLoading;

  // ── Not connected ────────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-950 pt-safe-top">
        {/* iOS-style large title header */}
        <div className="px-6 pt-16 pb-4">
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-1">Abstract</p>
          <h1 className="text-4xl font-bold text-white tracking-tight">{TOKEN_NAME} DCA</h1>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5">
          <div className="w-20 h-20 rounded-3xl bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-900/50">
            <WalletIcon className="w-9 h-9 text-white" />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-white">Connect Wallet</p>
            <p className="text-sm text-slate-400 mt-1">
              Sign in with Abstract Global Wallet to start buying {TOKEN_NAME}
            </p>
          </div>
          <button
            onClick={login}
            className="w-full max-w-xs bg-blue-600 active:bg-blue-700 text-white font-semibold text-base rounded-2xl py-4 transition-colors shadow-lg shadow-blue-900/40"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  const formattedBalance = balance
    ? `${parseFloat(balance.formatted).toFixed(4)} ETH`
    : "—";

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 select-none">

      {/* ── iOS large-title nav bar ── */}
      <div className="pt-safe-top px-5 pt-14 pb-2 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest">Abstract</p>
          <h1 className="text-3xl font-bold text-white tracking-tight mt-0.5">{TOKEN_NAME} DCA</h1>
        </div>
        {/* Wallet chip */}
        <button
          onClick={logout}
          className="mt-1 flex items-center gap-2 bg-slate-800 active:bg-slate-700 rounded-full px-3 py-2 transition-colors"
        >
          <div className="w-2 h-2 rounded-full bg-green-400" />
          <span className="text-xs font-medium text-slate-300">{formattedBalance}</span>
        </button>
      </div>

      {/* ── Stats row ── */}
      {purchaseData.totalTokens > 0 && (
        <div className="px-5 pt-2 pb-1 grid grid-cols-3 gap-3">
          <IOSStatCard label="PENGU" value={purchaseData.totalTokens.toLocaleString()} />
          <IOSStatCard label="Purchases" value={purchaseData.purchases.length.toString()} />
          <IOSStatCard
            label="Avg Price"
            value={purchaseData.averagePrice > 0 ? `${(purchaseData.averagePrice * 1_000_000).toFixed(1)}µ` : "—"}
          />
        </div>
      )}

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-32">
        {tab === "buy" ? (
          <BuyPanel
            tokensPerPurchase={tokensPerPurchase}
            setTokensPerPurchase={setTokensPerPurchase}
            isBusy={isBusy}
            isPending={isPending}
            isConfirming={isConfirming}
            isQuoteLoading={isQuoteLoading}
            onBuy={handleGetQuote}
          />
        ) : (
          <HistoryPanel
            purchaseData={purchaseData}
            isBusy={isBusy}
            address={address}
            onClear={() => {
              if (address) {
                clearPurchaseHistory(address);
                setPurchaseData({ purchases: [], totalTokens: 0, totalEthSpent: 0, averagePrice: 0, lastUpdated: Date.now() });
                toast.success("History cleared");
              }
            }}
          />
        )}
      </div>

      {/* ── iOS tab bar ── */}
      <div className="fixed bottom-0 left-0 right-0 pb-safe-bottom bg-slate-950/90 backdrop-blur-xl border-t border-slate-800">
        <div className="flex">
          <TabButton
            icon={<BuyIcon />}
            label="Buy"
            active={tab === "buy"}
            onClick={() => setTab("buy")}
          />
          <TabButton
            icon={<HistoryIcon />}
            label="History"
            active={tab === "history"}
            onClick={() => setTab("history")}
            badge={purchaseData.purchases.length > 0 ? purchaseData.purchases.length : undefined}
          />
        </div>
      </div>

      {/* ── Confirm dialog ── */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="border border-slate-700 bg-slate-900 rounded-3xl mx-4 p-0 overflow-hidden">
          <div className="px-6 pt-6 pb-2">
            <DialogHeader>
              <DialogTitle className="text-white text-xl font-bold">Confirm Purchase</DialogTitle>
              <DialogDescription className="text-slate-400 text-sm">
                Review your order before confirming in your wallet
              </DialogDescription>
            </DialogHeader>
          </div>

          {currentQuote && (
            <div className="px-6 pb-2 space-y-3">
              <div className="rounded-2xl bg-slate-800 overflow-hidden divide-y divide-slate-700">
                <Row label="Buying" value={`${tokensPerPurchase.toLocaleString()} ${TOKEN_NAME}`} bold />
                <Row label="Estimated cost" value={`${currentQuote.estimatedEth.toFixed(6)} ETH`} />
                <Row label="Price per token" value={`${(currentQuote.pricePerToken * 1_000_000).toFixed(2)} µETH`} />
                <Row
                  label={`Max with ${MAX_SLIPPAGE_PERCENT}% slippage`}
                  value={`${(currentQuote.estimatedEth * (1 + MAX_SLIPPAGE_PERCENT / 100)).toFixed(6)} ETH`}
                  bold
                />
              </div>
              {currentQuote.estimatedEth > 0.01 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-amber-400 text-sm">⚠</span>
                  <p className="text-xs text-amber-300">This purchase exceeds 0.01 ETH — review carefully.</p>
                </div>
              )}
              <p className="text-xs text-slate-500 text-center">Quote valid for 30 seconds</p>
            </div>
          )}

          <DialogFooter className="px-6 pb-6 pt-2 flex gap-3">
            <button
              onClick={() => setShowConfirmDialog(false)}
              className="flex-1 py-4 rounded-2xl bg-slate-800 active:bg-slate-700 text-slate-300 font-semibold text-base transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmPurchase}
              className="flex-1 py-4 rounded-2xl bg-blue-600 active:bg-blue-700 text-white font-semibold text-base transition-colors"
            >
              Confirm
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Buy panel ─────────────────────────────────────────────────────────────────
function BuyPanel({
  tokensPerPurchase, setTokensPerPurchase, isBusy, isPending, isConfirming, isQuoteLoading, onBuy,
}: {
  tokensPerPurchase: number;
  setTokensPerPurchase: (v: number) => void;
  isBusy: boolean;
  isPending: boolean;
  isConfirming: boolean;
  isQuoteLoading: boolean;
  onBuy: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Amount card */}
      <div className="bg-slate-900 rounded-3xl p-5 border border-slate-800 space-y-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Amount</p>
        <div className="text-center py-2">
          <span className="text-6xl font-bold text-white tabular-nums">
            {tokensPerPurchase.toLocaleString()}
          </span>
          <span className="text-2xl font-semibold text-slate-400 ml-2">PENGU</span>
        </div>
        <Slider
          value={[tokensPerPurchase]}
          onValueChange={(v) => setTokensPerPurchase(v[0])}
          min={MIN_TOKENS}
          max={MAX_TOKENS}
          step={10}
          disabled={isBusy}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-slate-600">
          <span>{MIN_TOKENS}</span>
          <span>{MAX_TOKENS}</span>
        </div>
      </div>

      {/* Quick amounts */}
      <div className="grid grid-cols-4 gap-2">
        {[50, 100, 250, 500].map((amt) => (
          <button
            key={amt}
            onClick={() => setTokensPerPurchase(amt)}
            disabled={isBusy}
            className={cn(
              "py-3 rounded-2xl text-sm font-semibold transition-colors",
              tokensPerPurchase === amt
                ? "bg-blue-600 text-white"
                : "bg-slate-800 active:bg-slate-700 text-slate-400"
            )}
          >
            {amt}
          </button>
        ))}
      </div>

      {/* Info pill */}
      <div className="flex items-center justify-center gap-1.5 py-2">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
        <p className="text-xs text-slate-500">
          Max {MAX_ETH_PER_TRANSACTION} ETH · {MAX_SLIPPAGE_PERCENT}% slippage · Live Uniswap V2
        </p>
      </div>

      {/* Buy button */}
      <button
        onClick={onBuy}
        disabled={isBusy}
        className={cn(
          "w-full py-5 rounded-3xl text-lg font-bold transition-all",
          isBusy
            ? "bg-slate-800 text-slate-500 cursor-not-allowed"
            : "bg-blue-600 active:bg-blue-700 active:scale-[0.98] text-white shadow-lg shadow-blue-900/40"
        )}
      >
        {isQuoteLoading
          ? "Getting quote…"
          : isPending
          ? "Confirm in wallet…"
          : isConfirming
          ? "Confirming…"
          : `Buy ${tokensPerPurchase.toLocaleString()} PENGU`}
      </button>
    </div>
  );
}

// ── History panel ─────────────────────────────────────────────────────────────
function HistoryPanel({
  purchaseData, isBusy, address, onClear,
}: {
  purchaseData: WalletPurchaseData;
  isBusy: boolean;
  address?: string;
  onClear: () => void;
}) {
  if (purchaseData.purchases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center pt-24 gap-3 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center">
          <HistoryIcon className="w-6 h-6 text-slate-500" />
        </div>
        <p className="text-base font-semibold text-slate-400">No purchases yet</p>
        <p className="text-sm text-slate-600">Your PENGU purchase history will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          {purchaseData.purchases.length} purchase{purchaseData.purchases.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={onClear}
          disabled={isBusy}
          className="text-xs text-red-400 active:text-red-300 font-medium disabled:opacity-40"
        >
          Clear all
        </button>
      </div>

      <div className="space-y-2">
        {purchaseData.purchases
          .slice()
          .reverse()
          .map((p) => (
            <div
              key={p.id}
              className="bg-slate-900 rounded-2xl px-4 py-3.5 border border-slate-800 flex items-center justify-between"
            >
              <div>
                <p className="text-base font-semibold text-white">
                  {p.tokenAmount.toLocaleString()} <span className="text-slate-400 font-normal text-sm">PENGU</span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {new Date(p.timestamp).toLocaleDateString(undefined, {
                    month: "short", day: "numeric",
                  })}{" "}
                  ·{" "}
                  {new Date(p.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-300">{p.ethSpent.toFixed(4)} ETH</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {(p.pricePerToken * 1_000_000).toFixed(1)} µETH/token
                </p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────────────────
function IOSStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900 rounded-2xl px-3 py-3 border border-slate-800">
      <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-base font-bold text-white truncate">{value}</p>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={cn("text-sm text-white", bold && "font-semibold")}>{value}</span>
    </div>
  );
}

function TabButton({
  icon, label, active, onClick, badge,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 py-3 pb-safe-bottom relative"
    >
      <div className={cn("w-6 h-6 relative", active ? "text-blue-500" : "text-slate-500")}>
        {icon}
        {badge !== undefined && (
          <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-blue-600 text-[9px] font-bold text-white flex items-center justify-center px-0.5">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </div>
      <span className={cn("text-[10px] font-medium", active ? "text-blue-500" : "text-slate-500")}>
        {label}
      </span>
    </button>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 640 640" fill="currentColor" className={className}>
      <path d="M128 96C92.7 96 64 124.7 64 160L64 448C64 483.3 92.7 512 128 512L512 512C547.3 512 576 483.3 576 448L576 256C576 220.7 547.3 192 512 192L136 192C122.7 192 112 181.3 112 168C112 154.7 122.7 144 136 144L520 144C533.3 144 544 133.3 544 120C544 106.7 533.3 96 520 96L128 96zM480 320C497.7 320 512 334.3 512 352C512 369.7 497.7 384 480 384C462.3 384 448 369.7 448 352C448 334.3 462.3 320 480 320z" />
    </svg>
  );
}

function BuyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("w-6 h-6", className)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("w-6 h-6", className)}>
      <path d="M3 3h18M3 9h18M3 15h10" />
    </svg>
  );
}
