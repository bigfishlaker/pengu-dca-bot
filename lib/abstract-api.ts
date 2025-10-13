import { Hex } from 'viem';
import { DetailedTransactionOutput } from '@/types/optimistic-transactions';

const ABSTRACT_API_ENDPOINT = 'https://api.abs.xyz'; // Abstract Mainnet API

export class AbstractAPIError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AbstractAPIError';
  }
}

export async function sendRawTransactionWithDetailedOutput(
  signedTransaction: Hex
): Promise<DetailedTransactionOutput> {
  try {
    const response = await fetch(
      `${ABSTRACT_API_ENDPOINT}/unstable_sendRawTransactionWithDetailedOutput`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signedTransaction,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AbstractAPIError(
        errorData.message || 'Failed to send transaction',
        errorData.code,
        response.status
      );
    }

    const data = await response.json();
    
    return {
      transactionHash: data.transactionHash,
      blockNumber: data.blockNumber,
      gasUsed: BigInt(data.gasUsed),
      effectiveGasPrice: BigInt(data.effectiveGasPrice),
      status: data.status,
    };
  } catch (error) {
    if (error instanceof AbstractAPIError) {
      throw error;
    }
    throw new AbstractAPIError(
      'Network error: Failed to connect to Abstract API',
      'NETWORK_ERROR'
    );
  }
}

