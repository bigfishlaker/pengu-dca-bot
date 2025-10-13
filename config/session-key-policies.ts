import { type Hex } from "viem";
import { UNISWAP_V2_ROUTER_ABI } from "./abstract-contracts";

/**
 * Session Key Policies Configuration
 * 
 * Define which contracts and functions session keys can interact with.
 * Each policy specifies:
 * - contractAddress: The contract to allow interactions with
 * - abi: The contract's ABI
 * - functionSelectors: Specific functions the session key can call
 * - gasLimit: Maximum gas per transaction (optional)
 */

// Uniswap V2 Router address on Abstract Mainnet
const UNISWAP_V2_ROUTER_ADDRESS = "0xad1eCa41E6F772bE3cb5A48A6141f9bcc1AF9F7c" as Hex;

export const SESSION_KEY_POLICIES = [
  {
    contractAddress: UNISWAP_V2_ROUTER_ADDRESS,
    abi: UNISWAP_V2_ROUTER_ABI,
    // Allow swapETHForExactTokens function for buying exact amount of PENGU
    functionSelectors: ["swapETHForExactTokens"] as const,
    gasLimit: BigInt(500000), // 500k gas limit per transaction
  },
] as const;

// Session expiration: 24 hours from creation
export const SESSION_EXPIRATION_MS = 24 * 60 * 60 * 1000;

// Maximum value (in wei) that can be sent per transaction
export const MAX_VALUE_PER_TX = BigInt(10000000000000000); // 0.01 ETH max per tx

