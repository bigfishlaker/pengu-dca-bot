"use client";

import { Button } from "@/components/ui/button";
import { useAccount } from "wagmi";
import { useHasActiveSession } from "@/hooks/use-session-key";
import { useCreateSessionKey } from "@/hooks/use-create-session-key";
import { useRevokeSessionKey } from "@/hooks/use-revoke-session-key";
import { ConnectWalletButton } from "@/components/connect-wallet-button";

export function SessionKeyButton() {
  const { isConnected } = useAccount();
  const { hasActiveSession, isLoading, sessionData } = useHasActiveSession();
  const createSessionMutation = useCreateSessionKey();
  const { revokeSession, isPending: isRevoking } = useRevokeSessionKey();

  // Show connect wallet if not connected
  if (!isConnected) {
    return <ConnectWalletButton />;
  }

  // Show loading state
  if (isLoading) {
    return (
      <Button disabled className="w-full">
        Checking session...
      </Button>
    );
  }

  // Show session info and revoke button if active
  if (hasActiveSession && sessionData) {
    const expiresIn = Math.floor((sessionData.expiresAt - Date.now()) / 1000 / 60);
    
    return (
      <div className="space-y-2 w-full">
        <div className="text-sm text-center text-muted-foreground">
          🔓 Rapid-fire mode active! (Expires in {expiresIn}m)
        </div>
        <Button
          onClick={() => revokeSession()}
          disabled={isRevoking}
          variant="outline"
          size="sm"
          className="w-full"
        >
          {isRevoking ? "Revoking..." : "Revoke Session"}
        </Button>
      </div>
    );
  }

  // Show create session button
  return (
    <Button
      onClick={() => createSessionMutation.mutate()}
      disabled={createSessionMutation.isPending}
      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
    >
      {createSessionMutation.isPending
        ? "Creating Session..."
        : "🔓 Enable Rapid-Fire Mode"}
    </Button>
  );
}

