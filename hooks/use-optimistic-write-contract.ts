"use client";

import { useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { Abi, encodeFunctionData, Hex } from 'viem';
import { sendRawTransactionWithDetailedOutput } from '@/lib/abstract-api';
import { toast } from 'sonner';

interface WriteContractParams<TAbi extends Abi = Abi> {
  abi: TAbi;
  address: Hex;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
  onSuccess?: (data: { hash: Hex }, startTime: number) => void;
  onError?: (error: Error) => void;
}

export function useOptimisticWriteContract() {
  const [isPending, setIsPending] = useState(false);
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();

  const writeContract = async <TAbi extends Abi>({
    abi,
    address: contractAddress,
    functionName,
    args = [],
    value,
    onSuccess,
    onError,
  }: WriteContractParams<TAbi>) => {
    if (!walletClient || !address) {
      const error = new Error('Wallet not connected');
      onError?.(error);
      toast.error('Please connect your wallet');
      return;
    }

    setIsPending(true);
    const startTime = Date.now();

    try {
      // Encode the function call
      const data = encodeFunctionData({
        abi,
        functionName,
        args,
      } as any);

      // Prepare the transaction
      const request = await walletClient.prepareTransactionRequest({
        to: contractAddress,
        data,
        value: value || BigInt(0),
        account: address,
      });

      // Sign the transaction
      const signedTransaction = await walletClient.signTransaction(request);

      // Send with optimistic execution
      const result = await sendRawTransactionWithDetailedOutput(signedTransaction);

      if (result.status === 'success') {
        onSuccess?.({ hash: result.transactionHash as Hex }, startTime);
        toast.success(`Transaction confirmed in ${Date.now() - startTime}ms`);
      } else {
        throw new Error('Transaction reverted');
      }
    } catch (error) {
      console.error('Transaction error:', error);
      const err = error instanceof Error ? error : new Error('Transaction failed');
      onError?.(err);
      toast.error(err.message);
    } finally {
      setIsPending(false);
    }
  };

  return {
    writeContract,
    isPending,
  };
}

