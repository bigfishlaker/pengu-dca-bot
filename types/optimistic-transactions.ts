export interface OptimisticTransactionResponse {
  txHash: string;
  status: 'pending' | 'success' | 'failed';
  blockNumber?: number;
  gasUsed?: string;
}

export interface DetailedTransactionOutput {
  transactionHash: string;
  blockNumber: number;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
  status: 'success' | 'reverted';
}

