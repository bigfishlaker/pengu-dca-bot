"use client";

import { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";
import { type Hex } from "viem";
import { UNISWAP_V2_ROUTER_ABI } from "@/config/abstract-contracts";

const WETH_ADDRESS = "0x3439153EB7AF838Ad19d56E1571FBD09333C2809" as Hex;
const PENGU_ADDRESS = "0x9ebe3a824ca958e4b3da772d2065518f009cba62" as Hex;
const UNISWAP_V2_ROUTER = "0xad1eCa41E6F772bE3cb5A48A6141f9bcc1AF9F7c" as Hex;

/**
 * Hook to get current PENGU price in ETH
 * Uses Uniswap V2 getAmountsOut to get real-time price
 */
export function usePenguPrice() {
  const [price, setPrice] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const publicClient = usePublicClient();

  useEffect(() => {
    async function fetchPrice() {
      if (!publicClient) return;
      
      try {
        setIsLoading(true);
        
        // Get price of 1 PENGU in WETH
        const amountIn = BigInt(1e18); // 1 PENGU with 18 decimals
        const path = [PENGU_ADDRESS, WETH_ADDRESS];
        
        const amounts = await publicClient.readContract({
          address: UNISWAP_V2_ROUTER,
          abi: UNISWAP_V2_ROUTER_ABI,
          functionName: "getAmountsOut",
          args: [amountIn, path],
        }) as bigint[];
        
        // amounts[1] is the WETH output for 1 PENGU
        const priceInWei = amounts[1];
        const priceInEth = Number(priceInWei) / 1e18;
        
        setPrice(priceInEth);
      } catch (error) {
        console.error("Failed to fetch PENGU price:", error);
        // Fallback to estimated price
        setPrice(0.0001); // ~$0.10 at $1000 ETH
      } finally {
        setIsLoading(false);
      }
    }

    fetchPrice();
    
    // Refresh price every 30 seconds
    const interval = setInterval(fetchPrice, 30000);
    
    return () => clearInterval(interval);
  }, [publicClient]);

  return { price, isLoading };
}

