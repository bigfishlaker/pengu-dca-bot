"use client";

import { useState } from "react";
import { usePublicClient } from "wagmi";
import { type Hex, parseUnits } from "viem";
import { UNISWAP_V2_ROUTER_ABI } from "@/config/abstract-contracts";

const WETH_ADDRESS = "0x3439153EB7AF838Ad19d56E1571FBD09333C2809" as Hex;
const PENGU_ADDRESS = "0x9ebe3a824ca958e4b3da772d2065518f009cba62" as Hex;
const UNISWAP_V2_ROUTER = "0xad1eCa41E6F772bE3cb5A48A6141f9bcc1AF9F7c" as Hex;

export interface SwapQuote {
  amountIn: bigint;
  amountOut: bigint;
  pricePerToken: number;
  estimatedEth: number;
  hasLiquidity: boolean;
}

/**
 * Get real-time swap quote from Uniswap
 */
export function useSwapQuote() {
  const publicClient = usePublicClient();
  const [isLoading, setIsLoading] = useState(false);

  const getQuote = async (tokenAmount: number): Promise<SwapQuote | null> => {
    if (!publicClient) {
      throw new Error("Public client not available");
    }

    try {
      setIsLoading(true);

      // Amount of tokens to buy (with 18 decimals)
      const amountOut = parseUnits(tokenAmount.toString(), 18);
      const path = [WETH_ADDRESS, PENGU_ADDRESS];

      // Get required ETH amount from Uniswap
      const amounts = await publicClient.readContract({
        address: UNISWAP_V2_ROUTER,
        abi: UNISWAP_V2_ROUTER_ABI,
        functionName: "getAmountsIn",
        args: [amountOut, path],
      }) as bigint[];

      // amounts[0] is the required WETH input
      const requiredEth = amounts[0];
      const ethAmount = Number(requiredEth) / 1e18;
      const pricePerToken = ethAmount / tokenAmount;

      // Check if we have a reasonable quote (has liquidity)
      const hasLiquidity = requiredEth > BigInt(0) && requiredEth < parseUnits("1", 18); // Less than 1 ETH

      return {
        amountIn: requiredEth,
        amountOut,
        pricePerToken,
        estimatedEth: ethAmount,
        hasLiquidity,
      };
    } catch (error) {
      console.error("Failed to get swap quote:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { getQuote, isLoading };
}

