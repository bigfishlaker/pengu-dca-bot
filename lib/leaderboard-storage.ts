/**
 * Global leaderboard tracking for all users
 */

export interface LeaderboardEntry {
  address: string;
  totalPurchases: number;
  totalPengu: number;
  lastUpdated: number;
  displayName?: string;
}

const LEADERBOARD_KEY = "pengu_global_leaderboard";

/**
 * Get global leaderboard
 */
export function getLeaderboard(): LeaderboardEntry[] {
  try {
    const stored = localStorage.getItem(LEADERBOARD_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error("Failed to load leaderboard:", error);
    return [];
  }
}

/**
 * Update leaderboard entry for a wallet
 */
export function updateLeaderboard(
  address: string,
  totalPurchases: number,
  totalPengu: number
): void {
  try {
    const leaderboard = getLeaderboard();
    
    // Find existing entry or create new
    const existingIndex = leaderboard.findIndex(
      (entry) => entry.address.toLowerCase() === address.toLowerCase()
    );
    
    const entry: LeaderboardEntry = {
      address,
      totalPurchases,
      totalPengu,
      lastUpdated: Date.now(),
      displayName: `${address.slice(0, 6)}...${address.slice(-4)}`,
    };
    
    if (existingIndex >= 0) {
      leaderboard[existingIndex] = entry;
    } else {
      leaderboard.push(entry);
    }
    
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard));
  } catch (error) {
    console.error("Failed to update leaderboard:", error);
  }
}

/**
 * Get top players by purchases (most clicks)
 */
export function getTopByPurchases(limit: number = 10): LeaderboardEntry[] {
  const leaderboard = getLeaderboard();
  return leaderboard
    .sort((a, b) => b.totalPurchases - a.totalPurchases)
    .slice(0, limit);
}

/**
 * Get top players by PENGU amount (high rollers)
 */
export function getTopByPengu(limit: number = 10): LeaderboardEntry[] {
  const leaderboard = getLeaderboard();
  return leaderboard
    .sort((a, b) => b.totalPengu - a.totalPengu)
    .slice(0, limit);
}

/**
 * Get user's rank in both categories
 */
export function getUserRank(address: string): {
  purchasesRank: number;
  penguRank: number;
} {
  const leaderboard = getLeaderboard();
  
  const byPurchases = leaderboard.sort((a, b) => b.totalPurchases - a.totalPurchases);
  const byPengu = leaderboard.sort((a, b) => b.totalPengu - a.totalPengu);
  
  const purchasesRank = byPurchases.findIndex(
    (entry) => entry.address.toLowerCase() === address.toLowerCase()
  ) + 1;
  
  const penguRank = byPengu.findIndex(
    (entry) => entry.address.toLowerCase() === address.toLowerCase()
  ) + 1;
  
  return { purchasesRank, penguRank };
}

