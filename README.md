# Bitcoin Unspent Transaction Output (UTXO) Selector Service for wallet software

## Description

In the Bitcoin ecosystem, a user's balance isn't stored as a single figure but is represented by multiple UTXOs (Unspent Transaction Outputs) scattered across the blockchain. These UTXOs represent indivisible chunks of Bitcoin associated with a user's address. When making transactions, users need to use these UTXOs as inputs, similar to how you'd use physical coins and banknotes to make a purchase. The challenge lies in choosing the right combination of UTXOs to satisfy a particular amount, without overspending (since UTXOs are indivisible). This service provides a solution to that challenge by automating the UTXO selection process.

## Problem Statement

When making a transaction, the wallet software has to decide which UTXOs to spend in order to cover the transaction amount, similar to how a shopper selects coins and banknotes to cover a purchase. This process is non-trivial due to the indivisible nature of UTXOs.

The task is to implement a UTXO selection strategy that:

<b>Strategy Zero</b>: It looks for an exact match or combination of UTXOs that equals the purchase amount.

<b>First Strategy</b>: Tries to combine smaller UTXOs to satisfy the purchase amount. This is analogous to a shopper trying to pay using as many coins as possible before resorting to banknotes.

<b>Second Strategy</b>: If the first strategy fails, it looks for the smallest UTXO that is larger than the purchase amount. This is similar to a shopper paying with a larger banknote when they don't have enough coins.

The service fetches UTXO data from an external source (https://blockchain.info/unspent?active=address) and then applies the aforementioned strategies to select the optimal UTXOs for the desired transaction amount.

## Solution and explanation

The endpoint `/api/prepare-unspent-outputs` accepts an `address` and `amount` as query parameters. It returns a list of UTXOs for the given address that satisfy the purchase amount using the predefined strategies.

Separated the logic of the 3 strategies into separate functions:

- **For strategy 0 - `findExactMatch`** function I’ve used Dynamic Programming which is a method used for solving complex problems by breaking them into simpler subproblems and storing the results of each subproblem to avoid solving it again in the future.An array **`dpTable`** is created with a size of **`targetAmount + 1`** and filled initially with nulls. Each element in this array will represent the smallest set of unspent transactions (UTXOs) that exactly adds up to the index value. For example, **`dpTable[5]`** will store the optimal set of UTXOs that sums up to 5.The base case **`dpTable[0] = []`** is set, which means an amount of 0 can be achieved by selecting no transactions at all.A nested loop is run where for each UTXO, it checks for every amount from **`targetAmount`** down to the value of the UTXO. If it's possible to get an amount **`currentValue - currentUtxoValue`** by using previous UTXOs (**`remainingValueSet !== null`**), it creates a new set by adding the current UTXO to the remainingValueSet. This new set is then compared to the current set at **`dpTable[currentValue]`**. If there's no set yet or if the new set is smaller (meaning it uses fewer UTXOs), the new set replaces the current set.After the loops, **`dpTable[targetAmount]`** contains the optimal set of UTXOs for the target amount, or null if it's not possible to get that amount exactly.This way, the function finds an exact set of UTXOs that matches the target amount (if such a set exists), while minimizing the number of UTXOs used. This is done by using the results of smaller problems (smaller amounts) while solving larger ones (larger amounts).
- If strategy 0 fails ( no exact match was found ), we try **strategy 1** - **`findSmallestUtxos`** This function is trying to find a combination of UTXOs that add up to the target amount or more by starting from the smallest UTXOs first. This is done by filtering out all UTXOs that are larger than the target amount, and then adding the smallest UTXOs to the **`smallestUtxos`** array until their total value meets or exceeds the target amount. If such a combination of UTXOs is found, it's returned; otherwise, null is returned.
- If the above two strategies do not yield a result, the function **`findLargerUtxo`** tries to find the smallest UTXO that is still larger than the target amount. This is a straightforward linear search: it goes through each UTXO and checks if its value is larger than the target amount. As soon as such a UTXO is found, it is returned as a single-element array. If no such UTXO is found, null is returned indicating that the wallet doesn't have enough funds.

## Examples

- **Strategy Zero Succeeds**

  Given UTXOs: [3, 8, 6, 9, 1]
  Purchase Amount: 6
  Result: [6]

- **Strategy Zero fails, First Strategy Succeeds**

  Given UTXOs: [3, 8, 6, 9, 1]
  Purchase Amount: 4
  Result: [1, 3]

- **First Strategy Fails, Second Strategy Succeeds:**

  Given UTXOs: [3, 8, 6, 9, 1]
  Purchase Amount: 5
  Result: [6]

- **All Strategies Fail:**

  Given UTXOs: [3, 8, 6, 9, 1]
  Purchase Amount: 28
  Result: 'Not enough funds' error.

## Testing

After implementing the solution, you can test its accuracy by executing:

```
npm run test
```

## Purpose

This tool aims to simplify the often complex and non-intuitive process of UTXO selection for Bitcoin transactions. By implementing intelligent strategies for UTXO aggregation, it ensures efficient transaction creation, reducing costs and maximizing user control over their transaction outputs. This service abstracts away the intricacies of UTXO management, making the process of transaction creation more user-friendly and efficient.
