/**
 * Simple encryption utilities for session key storage
 * Uses Web Crypto API for secure encryption/decryption
 */

// Generate a key from the wallet address for encryption
async function deriveKey(walletAddress: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const data = encoder.encode(walletAddress);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  
  return crypto.subtle.importKey(
    "raw",
    hashBuffer,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptData(
  data: string,
  walletAddress: string
): Promise<string> {
  const key = await deriveKey(walletAddress);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    dataBuffer
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);
  
  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

export async function decryptData(
  encryptedData: string,
  walletAddress: string
): Promise<string> {
  const key = await deriveKey(walletAddress);
  
  // Decode from base64
  const combined = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));
  
  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

