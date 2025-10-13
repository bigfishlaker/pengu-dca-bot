"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { UNISWAP_V2_ROUTER_ABI } from "@/config/abstract-contracts";
import { parseEther, parseUnits, type Hex } from "viem";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ================================
// 🐧 CONFIGURE YOUR TOKEN HERE 🐧
// ================================

// PENGU Token on Abstract Mainnet
const TOKEN_ADDRESS = "0x9ebe3a824ca958e4b3da772d2065518f009cba62" as Hex; // PENGU
const TOKEN_NAME = "PENGU";
const TOKEN_EMOJI = "🐧";

// Other tokens you can use:
// USDC: "0x84A71ccD554Cc1b02749b35d22F684CC8ec987e1"
// USDT: "0x0709F39376dEEe2A2dfC94A58EdEb2Eb9DF012bD"

// ================================

const WETH_ADDRESS = "0x3439153EB7AF838Ad19d56E1571FBD09333C2809" as Hex; // WETH on mainnet
const UNISWAP_V2_ROUTER = "0xad1eCa41E6F772bE3cb5A48A6141f9bcc1AF9F7c" as Hex; // Uniswap V2 Router mainnet

// Token purchase range
const MIN_TOKENS = 10;
const MAX_TOKENS = 1000;
const DEFAULT_TOKENS = 10;

// ETH per 10 tokens (adjust based on actual PENGU price)
const ETH_PER_10_TOKENS = 0.001; // ~$1 for 10 PENGU at $1000 ETH

interface ClickEffect {
  id: number;
  x: number;
  y: number;
}

interface Stats {
  totalClicks: number;
  totalPenguBought: number;
  totalEthSpent: number;
  clicksPerSecond: number;
  lastClickTime: number;
}

export function PenguClicker() {
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Game stats
  const [stats, setStats] = useState<Stats>({
    totalClicks: 0,
    totalPenguBought: 0,
    totalEthSpent: 0,
    clicksPerSecond: 0,
    lastClickTime: 0,
  });

  const [clickEffects, setClickEffects] = useState<ClickEffect[]>([]);
  const [combo, setCombo] = useState(0);
  const [showPulse, setShowPulse] = useState(false);
  const [clickTimes, setClickTimes] = useState<number[]>([]);
  const [txStartTime, setTxStartTime] = useState<number>(0);
  const [tokensPerClick, setTokensPerClick] = useState<number>(DEFAULT_TOKENS);

  // Handle successful regular transactions
  useEffect(() => {
    if (isSuccess && txStartTime > 0) {
      const confirmTime = Date.now() - txStartTime;
      const maxEthSpent = (tokensPerClick / 10) * ETH_PER_10_TOKENS;
      setStats((prev) => ({
        ...prev,
        totalPenguBought: prev.totalPenguBought + tokensPerClick,
        totalEthSpent: prev.totalEthSpent + maxEthSpent, // Approximate (actual amount may be less)
      }));
      
      toast.success(`${TOKEN_EMOJI} +${tokensPerClick} ${TOKEN_NAME} in ${confirmTime}ms!`, {
        description: `Combo: x${combo}`,
      });
      setTxStartTime(0);
    }
  }, [isSuccess, txStartTime, combo, tokensPerClick]);


  // Calculate clicks per second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const recentClicks = clickTimes.filter((time) => now - time < 1000);
      setClickTimes(recentClicks);
      setStats((prev) => ({
        ...prev,
        clicksPerSecond: recentClicks.length,
      }));
    }, 100);

    return () => clearInterval(interval);
  }, [clickTimes]);

  // Reset combo after 3 seconds of inactivity
  useEffect(() => {
    if (combo > 0) {
      const timeout = setTimeout(() => {
        setCombo(0);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [combo, stats.lastClickTime]);

  const handlePenguClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const isProcessing = isPending || isConfirming;
      if (!isConnected || isProcessing) return;

      const now = Date.now();
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Add visual effect
      const effectId = Date.now();
      setClickEffects((prev) => [...prev, { id: effectId, x, y }]);
      setTimeout(() => {
        setClickEffects((prev) => prev.filter((effect) => effect.id !== effectId));
      }, 1000);

      // Update stats
      setStats((prev) => ({
        ...prev,
        totalClicks: prev.totalClicks + 1,
        lastClickTime: now,
      }));

      setClickTimes((prev) => [...prev, now]);
      setCombo((prev) => prev + 1);
      setShowPulse(true);
      setTimeout(() => setShowPulse(false), 300);

      // Execute the swap - Buy exact amount of PENGU tokens
      const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes
      const path = [WETH_ADDRESS, TOKEN_ADDRESS];
      
      // Amount of tokens to buy (with 18 decimals)
      const amountOut = parseUnits(tokensPerClick.toString(), 18);
      
      // Maximum ETH to spend (proportional to token amount)
      const maxEth = (tokensPerClick / 10) * ETH_PER_10_TOKENS;
      const maxEthAmount = parseEther(maxEth.toFixed(6));

      setTxStartTime(Date.now());

      // Execute transaction
      writeContract({
        abi: UNISWAP_V2_ROUTER_ABI,
        address: UNISWAP_V2_ROUTER,
        functionName: "swapETHForExactTokens",
        args: [
          amountOut, // Exact amount of PENGU to receive
          path,
          address!,
          BigInt(deadline),
        ],
        value: maxEthAmount, // Maximum ETH willing to spend
      });
    },
    [isConnected, isPending, isConfirming, address, writeContract, tokensPerClick]
  );

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <div className="text-8xl animate-bounce">🐧</div>
        <h2 className="text-2xl font-bold">Connect Wallet to Play</h2>
        <p className="text-muted-foreground">
          Start clicking to ape into {TOKEN_NAME}!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8 p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-5xl font-black bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
          PENGU CLICKER 🐧
        </h1>
        <p className="text-muted-foreground">
          Click to buy {tokensPerClick} {TOKEN_NAME} tokens per click!
        </p>
      </div>

      {/* Token Amount Slider */}
      <div className="w-full max-w-md space-y-4 p-6 rounded-lg border bg-card">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">Tokens Per Click</label>
            <span className="text-2xl font-bold text-primary">{tokensPerClick} 🐧</span>
          </div>
          <Slider
            value={[tokensPerClick]}
            onValueChange={(value) => setTokensPerClick(value[0])}
            min={MIN_TOKENS}
            max={MAX_TOKENS}
            step={10}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{MIN_TOKENS} tokens</span>
            <span className="text-center">
              ~{((tokensPerClick / 10) * ETH_PER_10_TOKENS).toFixed(4)} ETH max
            </span>
            <span>{MAX_TOKENS} tokens</span>
          </div>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
        <StatCard
          label="Total Clicks"
          value={stats.totalClicks.toLocaleString()}
          icon="👆"
        />
        <StatCard
          label={`${TOKEN_NAME} Tokens`}
          value={stats.totalPenguBought.toLocaleString()}
          icon="🐧"
        />
        <StatCard
          label="ETH Spent"
          value={stats.totalEthSpent.toFixed(4)}
          icon="💎"
        />
        <StatCard
          label="Clicks/sec"
          value={stats.clicksPerSecond.toString()}
          icon="⚡"
          highlight={stats.clicksPerSecond > 5}
        />
      </div>

      {/* Combo Counter */}
      {combo > 0 && (
        <div
          className={cn(
            "text-4xl font-black text-yellow-500 animate-pulse",
            combo > 10 && "text-5xl text-orange-500",
            combo > 20 && "text-6xl text-red-500"
          )}
        >
          COMBO: x{combo}
          {combo > 10 && " 🔥"}
          {combo > 20 && " 💥"}
        </div>
      )}

      {/* Main Click Button */}
      <div className="relative">
        <Button
          onClick={handlePenguClick}
          disabled={isPending || isConfirming}
          className={cn(
            "text-9xl w-64 h-64 rounded-full",
            "bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 hover:shadow-purple-500/50",
            "hover:scale-110 active:scale-95 transition-all duration-200",
            "shadow-2xl",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            showPulse && "animate-ping"
          )}
        >
          {isPending || isConfirming ? "⏳" : "🐧"}
        </Button>

        {/* Click Effects */}
        {clickEffects.map((effect) => (
          <div
            key={effect.id}
            className="absolute text-4xl font-bold text-yellow-400 pointer-events-none animate-float-up"
            style={{
              left: effect.x,
              top: effect.y,
              animation: "float-up 1s ease-out forwards",
            }}
          >
            +{TOKEN_NAME}
          </div>
        ))}
      </div>

      {/* Status Text */}
      <div className="text-center">
        {isPending ? (
          <p className="text-xl font-semibold text-purple-500 animate-pulse">
            Signing transaction... ✍️
          </p>
        ) : isConfirming ? (
          <p className="text-xl font-semibold text-blue-500 animate-pulse">
            Buying {TOKEN_NAME}... 🚀
          </p>
        ) : (
          <p className="text-muted-foreground">
            Click the PENGU to ape in! 🐧⚡
          </p>
        )}
      </div>

      {/* Achievements */}
      <div className="w-full space-y-2">
        <h3 className="text-xl font-bold text-center">Achievements</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Achievement
            unlocked={stats.totalClicks >= 10}
            icon="🎯"
            name="First Steps"
            description="10 clicks"
          />
          <Achievement
            unlocked={stats.totalClicks >= 100}
            icon="💪"
            name="APE Mode"
            description="100 clicks"
          />
          <Achievement
            unlocked={combo >= 10}
            icon="🔥"
            name="Combo Master"
            description="10x combo"
          />
          <Achievement
            unlocked={stats.clicksPerSecond >= 5}
            icon="⚡"
            name="Speed Demon"
            description="5 clicks/sec"
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes float-up {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-100px) scale(1.5);
          }
        }
      `}</style>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "p-4 rounded-lg border bg-card text-card-foreground shadow-sm",
        highlight && "border-yellow-500 bg-yellow-500/10 animate-pulse"
      )}
    >
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Achievement({
  unlocked,
  icon,
  name,
  description,
}: {
  unlocked: boolean;
  icon: string;
  name: string;
  description: string;
}) {
  return (
    <div
      className={cn(
        "p-3 rounded-lg border text-center transition-all",
        unlocked
          ? "bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500"
          : "bg-muted/50 border-muted opacity-50 grayscale"
      )}
    >
      <div className="text-3xl mb-1">{icon}</div>
      <div className="text-sm font-bold">{name}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
    </div>
  );
}

