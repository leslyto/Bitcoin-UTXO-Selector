import express, { Request, Response } from 'express';
import axios from 'axios';

interface Utxo {
  tx_hash_big_endian: string;
  tx_hash: string;
  tx_output_n: number;
  script: string;
  value: number;
  value_hex: string;
  confirmations: number;
  tx_index: number;
}
const router = express.Router();

// Find a set of UTXOs that exactly matches the target amount
const findExactMatch = (utxos: Utxo[], targetAmount: number): Utxo[] | null => {
  // Dynamic Programming table, initially filled with null values
  const dpTable: (Utxo[] | null)[] = new Array(targetAmount + 1).fill(null);
  // Base case: 0 amount can be achieved by taking no unspent transactions
  dpTable[0] = [];

  // Using dynamic programming to find an optimal set of unspent transactions
  // Loop over all unspent transactions
  for (
    let unspentTxIndex = 0;
    unspentTxIndex < utxos.length;
    unspentTxIndex++
  ) {
    const currentUtxoValue = utxos[unspentTxIndex].value;
    // Start from the target amount, go down to the value of the unspent transaction
    for (
      let currentValue = targetAmount;
      currentValue >= currentUtxoValue;
      currentValue--
    ) {
      const remainingValueSet = dpTable[currentValue - currentUtxoValue];
      // Check if it's possible to get amount (currentValue - currentUtxoValue) using previous utxo
      if (remainingValueSet !== null) {
        // Create a new set by adding current unspent transaction to the
        // set of amount(currentValue - unspentValue)
        const newSet: Utxo[] = [...remainingValueSet, utxos[unspentTxIndex]];
        // Check if there's no set for currentValue yet, or if the new set is smaller
        if (
          dpTable[currentValue] === null
          || newSet.length < dpTable[currentValue]!.length
        ) {
          // The new set is the optimal set for currentValue
          dpTable[currentValue] = newSet;
        }
      }
    }
  }

  // dpTable[targetAmount] contains the optimal set of unspent
  // transactions for the target amount, or null if impossible
  return dpTable[targetAmount] || null;
};

// Find the smallest UTXOs that satisfy the targetAmount
const findSmallestUtxos = (utxos: Utxo[], targetAmount: number): Utxo[] | null => {
  const eligibleUtxos = utxos.filter((utxo) => utxo.value < targetAmount);
  const smallestUtxos: Utxo[] = [];
  let totalAmount = 0;

  // Keep adding the smallest UTXOs until the total value satisfies the targetAmount
  for (const utxo of eligibleUtxos) {
    smallestUtxos.push(utxo);
    totalAmount += utxo.value;
    if (totalAmount >= targetAmount) {
      return smallestUtxos;
    }
  }

  return null;
};

// Find the smallest UTXO that is larger than the targetAmount
const findLargerUtxo = (utxos: Utxo[], targetAmount: number): Utxo[] | null => {
  const largerUtxo = utxos.find((utxo) => utxo.value > targetAmount);
  return largerUtxo ? [largerUtxo] : null;
};

router.get(
  '/api/prepare-unspent-outputs/',
  async (req: Request, res: Response) => {
    try {
      const { address, amount } = req.query;
      if (!address || !amount) {
        return res.status(400).json({ error: 'Address and amount required.' });
      }
      // Make sure the amount is a number
      const targetAmount = Number(amount);
      if (Number.isNaN(targetAmount) || targetAmount <= 0) {
        return res.status(400).json({ error: 'Invalid amount.' });
      }

      // Fetch unspent outputs from the API
      let unspentOutputs: Utxo[];
      try {
        const url = `https://blockchain.info/unspent?active=${address}`;
        const response = await axios.get<{ unspent_outputs: Utxo[] }>(url);
        unspentOutputs = response.data.unspent_outputs;
      } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch utxos.' });
      }

      if (!unspentOutputs || unspentOutputs.length === 0) {
        return res.status(404).json({ error: 'No unspent outputs found.' });
      }

      // Sort from smallest to largest by transaction value
      const utxos = unspentOutputs.sort((a, b) => a.value - b.value);

      // Strategy 0: Find an exact match
      const exactMatch = findExactMatch(utxos, targetAmount);
      if (exactMatch !== null) return res.status(200).json(exactMatch);

      // Strategy 1: Use smaller outputs until the purchase amount is satisfied
      const smallestUtxos = findSmallestUtxos(utxos, targetAmount);
      if (smallestUtxos !== null) return res.status(200).json(smallestUtxos);

      // Strategy 2: Use the smallest output that is equal or larger than the purchase amount
      const largerUtxo = findLargerUtxo(utxos, targetAmount);
      if (largerUtxo !== null) return res.status(200).json(largerUtxo);

      return res.status(409).json({ message: 'Not enough funds' });
    } catch (error) {
      return res.status(500).json({ error: 'An unexpected error occurred.' });
    }
  },
);

export { router as prepareUnspentOutputsRouter };
