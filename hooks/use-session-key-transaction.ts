"use client";

import { useMutation } from "@tanstack/react-query";
import { useAccount, useWalletClient } from "wagmi";
import { type Abi, type Hex, encodeFunctionData } from "viem";
import { useSessionKey } from "./use-session-key";

interface SessionKeyTransactionParams<TAbi extends Abi = Abi> {
  abi: TAbi;
  address: Hex;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

/**
 * For now, this falls back to regular wallet transactions
 * since Abstract's session key system requires proper AGW integration
 * with session key validators and policies registered on-chain.
 * 
 * This provides the same interface but uses the regular wallet client.
 */
export function useSessionKeyTransaction() {
  const { address: userAddress } = useAccount();
  const { data: sessionData } = useSessionKey();
  const { data: walletClient } = useWalletClient();

  return useMutation({
    mutationFn: async <TAbi extends Abi>({
      abi,
      address,
      functionName,
      args = [],
      value,
    }: SessionKeyTransactionParams<TAbi>) => {
      if (!userAddress) {
        throw new Error("Wallet not connected");
      }

      if (!sessionData) {
        throw new Error("No active session key. Please create one first.");
      }

      if (Date.now() > sessionData.expiresAt) {
        throw new Error("Session key expired. Please create a new one.");
      }

      if (!walletClient) {
        throw new Error("Wallet client not available");
      }

      // Encode the function call
      const data = encodeFunctionData({
        abi,
        functionName: functionName as any,
        args: args as any,
      });

      // For now, use regular wallet transaction
      // In production, this would use Abstract's session key validator
      const hash = await walletClient.sendTransaction({
        to: address,
        data,
        value: value || BigInt(0),
        account: userAddress,
      });

      return { hash };
    },
  });
}

