import { encryptData, decryptData } from "./session-encryption-utils";

const SESSION_STORAGE_KEY = "abstract_session_key";

export interface StoredSessionData {
  privateKey: string;
  address: string;
  expiresAt: number;
  createdAt: number;
}

export async function storeSessionKey(
  sessionData: StoredSessionData,
  walletAddress: string
): Promise<void> {
  try {
    const encrypted = await encryptData(
      JSON.stringify(sessionData),
      walletAddress
    );
    localStorage.setItem(`${SESSION_STORAGE_KEY}_${walletAddress}`, encrypted);
  } catch (error) {
    console.error("Failed to store session key:", error);
    throw new Error("Failed to store session key");
  }
}

export async function getStoredSessionKey(
  walletAddress: string
): Promise<StoredSessionData | null> {
  try {
    const encrypted = localStorage.getItem(
      `${SESSION_STORAGE_KEY}_${walletAddress}`
    );
    
    if (!encrypted) {
      return null;
    }
    
    const decrypted = await decryptData(encrypted, walletAddress);
    const data = JSON.parse(decrypted) as StoredSessionData;
    
    // Check if session is expired
    if (Date.now() > data.expiresAt) {
      await clearStoredSessionKey(walletAddress);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error("Failed to retrieve session key:", error);
    return null;
  }
}

export async function clearStoredSessionKey(
  walletAddress: string
): Promise<void> {
  try {
    localStorage.removeItem(`${SESSION_STORAGE_KEY}_${walletAddress}`);
  } catch (error) {
    console.error("Failed to clear session key:", error);
  }
}

