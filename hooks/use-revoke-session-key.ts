"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { clearStoredSessionKey } from "@/lib/session-storage-utils";
import { toast } from "sonner";

export function useRevokeSessionKey() {
  const { address } = useAccount();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!address) {
        throw new Error("Wallet not connected");
      }

      await clearStoredSessionKey(address);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-key", address] });
      toast.success("Session key revoked");
    },
    onError: (error) => {
      console.error("Failed to revoke session key:", error);
      toast.error("Failed to revoke session key");
    },
  });

  return {
    revokeSession: mutation.mutate,
    isPending: mutation.isPending,
  };
}

