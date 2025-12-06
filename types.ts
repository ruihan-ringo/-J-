
export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  EXCHANGE = 'EXCHANGE', // RMB -> Foreign
  REPAYMENT = 'REPAYMENT', // Repay Credit Card
}

export enum Currency {
  CNY = 'CNY',
  USD = 'USD',
  EUR = 'EUR',
  JPY = 'JPY',
  GBP = 'GBP',
  AUD = 'AUD',
  CAD = 'CAD',
  HKD = 'HKD',
  SGD = 'SGD',
}

export enum PaymentMethod {
  CASH_DEBIT = 'CASH_DEBIT', // Deducts from Exchange Pool (FIFO)
  CREDIT_CARD = 'CREDIT_CARD', // Pending until Repayment
  DIGITAL = 'DIGITAL',       // WeChat/Alipay (User inputs RMB cost directly)
  NONE = 'NONE',             // For CNY transactions
}

export interface Transaction {
  id: string;
  type: TransactionType;
  category: string;
  amount: number; // Foreign Amount (or RMB if CNY)
  currency: string;
  date: string; // ISO String
  description?: string;
  
  paymentMethod: PaymentMethod;
  
  // The calculated RMB cost. 
  // For Cash: Calculated via FIFO. 
  // For CC: Calculated via Repayment. 
  // For Exchange: User Input.
  calculatedCNY: number; 
  
  // Credit Card Logic
  isCreditCardSettled?: boolean; // True if repaid
  settledDate?: string; // Date of repayment

  // Exchange Logic
  // For EXCHANGE type: How much foreign currency is remaining in this pool?
  exchangeRemainingAmount?: number; 
}

export interface DashboardStats {
  totalIncomeCNY: number;
  totalIncomeForeign: Record<string, number>;
  
  totalExpenseCNY: number; // Only settled/cash expenses
  totalExpenseForeignPending: Record<string, number>; // Credit Card Pending
  
  netBalanceCNY: number;
  netBalanceForeign: Record<string, number>; // Actual Foreign Cash on hand
  
  exchangeOutflowCNY: number;
}
