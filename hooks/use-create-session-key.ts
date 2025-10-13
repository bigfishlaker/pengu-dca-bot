"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { storeSessionKey, type StoredSessionData } from "@/lib/session-storage-utils";
import { SESSION_EXPIRATION_MS } from "@/config/session-key-policies";
import { toast } from "sonner";

export function useCreateSessionKey() {
  const { address } = useAccount();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      // Generate a new private key for the session
      const sessionPrivateKey = generatePrivateKey();
      const sessionAccount = privateKeyToAccount(sessionPrivateKey);

      const now = Date.now();
      const sessionData: StoredSessionData = {
        privateKey: sessionPrivateKey,
        address: sessionAccount.address,
        expiresAt: now + SESSION_EXPIRATION_MS,
        createdAt: now,
      };

      // Store encrypted session data
      await storeSessionKey(sessionData, address);

      return sessionData;
    },
    onSuccess: () => {
      // Invalidate and refetch session key query
      queryClient.invalidateQueries({ queryKey: ["session-key", address] });
      toast.success("Session key created! You can now click rapidly without wallet popups! 🚀");
    },
    onError: (error) => {
      console.error("Failed to create session key:", error);
      toast.error("Failed to create session key");
    },
  });
}

