/**
 * Purchase tracking and persistence
 */

export interface Purchase {
  id: string;
  timestamp: number;
  tokenAmount: number;
  ethSpent: number;
  txHash?: string;
  pricePerToken: number;
}

export interface WalletPurchaseData {
  purchases: Purchase[];
  totalTokens: number;
  totalEthSpent: number;
  averagePrice: number;
  lastUpdated: number;
}

const STORAGE_KEY_PREFIX = "pengu_dca_";

/**
 * Get all purchases for a wallet address
 */
export function getPurchaseHistory(walletAddress: string): WalletPurchaseData {
  try {
    const key = `${STORAGE_KEY_PREFIX}${walletAddress.toLowerCase()}`;
    const stored = localStorage.getItem(key);
    
    if (!stored) {
      return {
        purchases: [],
        totalTokens: 0,
        totalEthSpent: 0,
        averagePrice: 0,
        lastUpdated: Date.now(),
      };
    }
    
    return JSON.parse(stored);
  } catch (error) {
    console.error("Failed to load purchase history:", error);
    return {
      purchases: [],
      totalTokens: 0,
      totalEthSpent: 0,
      averagePrice: 0,
      lastUpdated: Date.now(),
    };
  }
}

/**
 * Add a new purchase to history
 */
export function addPurchase(
  walletAddress: string,
  purchase: Omit<Purchase, "id">
): void {
  try {
    const data = getPurchaseHistory(walletAddress);
    
    const newPurchase: Purchase = {
      ...purchase,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
    
    data.purchases.push(newPurchase);
    data.totalTokens += purchase.tokenAmount;
    data.totalEthSpent += purchase.ethSpent;
    data.averagePrice = data.totalEthSpent / data.totalTokens;
    data.lastUpdated = Date.now();
    
    const key = `${STORAGE_KEY_PREFIX}${walletAddress.toLowerCase()}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error("Failed to save purchase:", error);
  }
}

/**
 * Clear purchase history for a wallet
 */
export function clearPurchaseHistory(walletAddress: string): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${walletAddress.toLowerCase()}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error("Failed to clear purchase history:", error);
  }
}

/**
 * Calculate P&L based on current token price
 */
export function calculatePnL(
  data: WalletPurchaseData,
  currentPriceInEth: number
): {
  currentValue: number;
  profitLoss: number;
  profitLossPercent: number;
  unrealizedPnL: number;
} {
  const currentValue = data.totalTokens * currentPriceInEth;
  const profitLoss = currentValue - data.totalEthSpent;
  const profitLossPercent = data.totalEthSpent > 0 
    ? (profitLoss / data.totalEthSpent) * 100 
    : 0;
  
  return {
    currentValue,
    profitLoss,
    profitLossPercent,
    unrealizedPnL: profitLoss,
  };
}

