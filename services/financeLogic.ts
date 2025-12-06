
import { Transaction, TransactionType, PaymentMethod, Currency } from "../types";

/**
 * Recalculates the entire financial history.
 * 1. Resets all Cash/Debit expenses to 0 CNY.
 * 2. Builds pools from Exchanges.
 * 3. Re-runs Cash expenses through FIFO logic.
 * 4. Re-runs Repayments to settle Credit Card expenses.
 */
export const recalculateFinancials = (transactions: Transaction[]): Transaction[] => {
    // 1. Sort by Date Ascending (Critical for FIFO)
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 2. State Tracking
    // Exchange Pools: currency -> list of { id, rate, remaining }
    const exchangePools: Record<string, { id: string; rate: number; remaining: number }[]> = {};

    // Helper to get rate for a currency amount
    const consumeFromPool = (currency: string, amount: number): number => {
        if (!exchangePools[currency]) exchangePools[currency] = [];
        let remainingToDeduct = amount;
        let totalCNYCost = 0;

        // Iterate through pools (FIFO)
        for (const pool of exchangePools[currency]) {
            if (remainingToDeduct <= 0) break;
            if (pool.remaining <= 0) continue;

            const deduct = Math.min(pool.remaining, remainingToDeduct);
            totalCNYCost += deduct * pool.rate;
            pool.remaining -= deduct;
            remainingToDeduct -= deduct;
        }

        // If ran out of pool, assume 0 cost (or could error, but for now 0 to avoid crash)
        // In reality this means user spent money they didn't record exchanging.
        return totalCNYCost;
    };

    // 3. Process each transaction
    const processed = sorted.map(tx => {
        // Deep copy to avoid mutating original immediately
        const t = { ...tx }; 

        // A. Handle Exchange (Add to Pool)
        if (t.type === TransactionType.EXCHANGE) {
            const rate = t.amount > 0 ? t.calculatedCNY / t.amount : 0;
            if (!exchangePools[t.currency]) exchangePools[t.currency] = [];
            exchangePools[t.currency].push({
                id: t.id,
                rate: rate,
                remaining: t.amount // Initialize remaining
            });
            // Also update the transaction record's internal state for debugging (optional)
            t.exchangeRemainingAmount = t.amount; 
        }

        // B. Handle Cash/Debit Expense (Consume from Pool)
        else if (t.type === TransactionType.EXPENSE && t.paymentMethod === PaymentMethod.CASH_DEBIT) {
            if (t.currency !== Currency.CNY) {
                t.calculatedCNY = consumeFromPool(t.currency, t.amount);
            } else {
                t.calculatedCNY = t.amount;
            }
        }

        // C. Handle Credit Card Expense (Reset Settlement)
        else if (t.type === TransactionType.EXPENSE && t.paymentMethod === PaymentMethod.CREDIT_CARD) {
            // Initially, pending. calculatedCNY is 0 unless settled.
            // We reset it here because we are re-playing history.
            // Settlement happens in step D.
            t.calculatedCNY = 0; 
            t.isCreditCardSettled = false;
        }
        
        // D. Handle Repayment (Settle Past Credit Cards)
        else if (t.type === TransactionType.REPAYMENT) {
            const rate = t.amount > 0 ? t.calculatedCNY / t.amount : 0;
            let remainingRepayment = t.amount;

            // Find PREVIOUS, UNSETTLED Credit Card expenses of this currency
            // We must iterate through the `processed` array we are building right now
            // But since `map` builds a new array, we look at the ones processed so far? 
            // Actually, we can just look at `processed` array being built if we used a for-loop.
            // Since we are using map, we can't see the modified versions of previous items easily.
            // FIX: Don't use map. Use for-loop to build the result array.
        }

        return t;
    });

    // Re-implement Loop for Step 3 to handle the Repayment look-back correctly
    const finalResult: Transaction[] = [];
    
    // Reset Pools for the actual loop
    for (const k in exchangePools) delete exchangePools[k];

    for (const tx of sorted) {
        const t = { ...tx };

        if (t.type === TransactionType.EXCHANGE) {
            const rate = t.amount > 0 ? t.calculatedCNY / t.amount : 0;
            if (!exchangePools[t.currency]) exchangePools[t.currency] = [];
            exchangePools[t.currency].push({ id: t.id, rate, remaining: t.amount });
            t.exchangeRemainingAmount = t.amount;
        } 
        else if (t.type === TransactionType.EXPENSE && t.paymentMethod === PaymentMethod.CASH_DEBIT) {
             if (t.currency !== Currency.CNY) {
                t.calculatedCNY = consumeFromPool(t.currency, t.amount);
            } else {
                t.calculatedCNY = t.amount;
            }
        }
        else if (t.type === TransactionType.EXPENSE && t.paymentMethod === PaymentMethod.CREDIT_CARD) {
            t.calculatedCNY = 0;
            t.isCreditCardSettled = false;
            t.settledDate = undefined;
        }
        else if (t.type === TransactionType.REPAYMENT) {
            const rate = t.amount > 0 ? t.calculatedCNY / t.amount : 0;
            let amountToSettle = t.amount;

            // Look back at `finalResult` for unsettle CC expenses
            for (let i = 0; i < finalResult.length; i++) {
                const prev = finalResult[i];
                if (amountToSettle <= 0) break;

                if (prev.type === TransactionType.EXPENSE && 
                    prev.paymentMethod === PaymentMethod.CREDIT_CARD && 
                    prev.currency === t.currency && 
                    !prev.isCreditCardSettled) {
                    
                    // Settle this transaction
                    // Assuming user pays off full bills usually, or partial.
                    // If partial repayment, it gets complex. 
                    // Prompt says: "Assumption: Repay 30,000, find bills... calculate RMB".
                    // We will settle bills fully until repayment amount runs out.
                    
                    // However, a single transaction can't be partially settled easily without splitting.
                    // For MVP simplicity: We settle the WHOLE transaction if `amountToSettle >= prev.amount`.
                    // If `amountToSettle < prev.amount`, we settle the proportion? 
                    // Let's assume full settlement for simplicity or proportional value?
                    // Prompt example: "Pay 30000... Calculate... fill in RMB value". 
                    // It implies we apply the rate to the expenses.
                    
                    // Let's apply rate to the WHOLE expense, but only if we have enough repayment money?
                    // Or does Repayment just determine the rate for *ALL* pending bills?
                    // Prompt says: "Trigger repayment... clear the bills (assume user clears all)."
                    // OK, if "assume user clears all", we just take all pending bills before this date and apply the rate.
                    
                    // WAIT: "Examples: Repay 3w, spent 1500 CNY (Rate 0.05). Find 3 bills of 1w each. Calculate 1w*0.05=500."
                    // This implies the Repayment Amount (3w) matches the Bills (3w). 
                    // What if Repayment is larger or smaller? 
                    // Let's use the RATE from the repayment to settle ALL pending bills up to that point in time.
                    
                    prev.calculatedCNY = prev.amount * rate;
                    prev.isCreditCardSettled = true;
                    prev.settledDate = t.date;
                    
                    amountToSettle -= prev.amount;
                }
            }
        }

        finalResult.push(t);
    }

    return finalResult;
};
