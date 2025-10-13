"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getStoredSessionKey, type StoredSessionData } from "@/lib/session-storage-utils";

export function useSessionKey() {
  const { address } = useAccount();

  return useQuery({
    queryKey: ["session-key", address],
    queryFn: async () => {
      if (!address) return null;
      return await getStoredSessionKey(address);
    },
    enabled: !!address,
    refetchInterval: 5000, // Check every 5 seconds for expiration
  });
}

export function useHasActiveSession() {
  const { data: sessionData, isLoading } = useSessionKey();
  return {
    hasActiveSession: !!sessionData && Date.now() < sessionData.expiresAt,
    isLoading,
    sessionData,
  };
}

