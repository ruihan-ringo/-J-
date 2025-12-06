
import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionType, DashboardStats, Currency, PaymentMethod } from './types';
import * as storageService from './services/storageService';
import { recalculateFinancials } from './services/financeLogic';
import InputForm from './components/InputForm';
import TransactionList from './components/TransactionList';
import Dashboard from './components/Dashboard';
import { ListPlus, PieChart } from 'lucide-react';

const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'ADD'>('DASHBOARD');

  useEffect(() => {
    // Initial Load & Recalculate to ensure consistency
    const rawData = storageService.getTransactions();
    const recalculated = recalculateFinancials(rawData);
    setTransactions(recalculated);
  }, []);

  const handleSaveTransaction = (tx: Transaction) => {
    let currentTransactions: Transaction[];
    
    // 1. Update List
    if (editingTransaction) {
      currentTransactions = transactions.map(t => t.id === tx.id ? tx : t);
    } else {
      currentTransactions = [...transactions, tx];
    }

    // 2. RECALCULATE LOGIC (FIFO & Settlements)
    // We must recalculate everything whenever a transaction is added/edited
    // because inserting a past exchange/expense affects future FIFO.
    const updated = recalculateFinancials(currentTransactions);

    // 3. Save & Set
    storageService.saveTransaction(tx); // This only saves one, we need to save ALL
    // Since storageService.saveTransaction appends, we should rewrite the whole storage here
    // to match our updated state.
    // Let's modify storageService behavior conceptually here by just overwriting the key.
    localStorage.setItem('j_tracker_transactions_v1', JSON.stringify(updated));
    
    setTransactions(updated);
    setEditingTransaction(null);
    setActiveTab('DASHBOARD'); 
  };

  const handleDeleteTransaction = (id: string) => {
    if (confirm('确定删除这条记录吗？这将触发重新计算财务历史。')) {
        const remaining = transactions.filter(t => t.id !== id);
        const updated = recalculateFinancials(remaining);
        localStorage.setItem('j_tracker_transactions_v1', JSON.stringify(updated));
        setTransactions(updated);
    }
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setActiveTab('ADD');
  };

  // Calculate Dashboard Stats
  const stats = useMemo<DashboardStats>(() => {
    const s: DashboardStats = {
      totalIncomeCNY: 0,
      totalIncomeForeign: {},
      totalExpenseCNY: 0,
      totalExpenseForeignPending: {},
      netBalanceCNY: 0,
      netBalanceForeign: {},
      exchangeOutflowCNY: 0
    };

    transactions.forEach(tx => {
      // 1. INCOME
      if (tx.type === TransactionType.INCOME) {
          if (tx.currency === Currency.CNY) {
              s.totalIncomeCNY += tx.amount;
          } else {
              s.totalIncomeForeign[tx.currency] = (s.totalIncomeForeign[tx.currency] || 0) + tx.amount;
              s.netBalanceForeign[tx.currency] = (s.netBalanceForeign[tx.currency] || 0) + tx.amount;
          }
      }
      
      // 2. EXCHANGE
      else if (tx.type === TransactionType.EXCHANGE) {
          s.exchangeOutflowCNY += tx.calculatedCNY; // RMB Spent
          // Foreign Gained
          s.netBalanceForeign[tx.currency] = (s.netBalanceForeign[tx.currency] || 0) + tx.amount;
      }

      // 3. EXPENSE
      else if (tx.type === TransactionType.EXPENSE) {
          if (tx.currency === Currency.CNY) {
              s.totalExpenseCNY += tx.amount;
          } else {
              if (tx.paymentMethod === PaymentMethod.CREDIT_CARD && !tx.isCreditCardSettled) {
                  // Pending
                  s.totalExpenseForeignPending[tx.currency] = (s.totalExpenseForeignPending[tx.currency] || 0) + tx.amount;
                  // Pending expenses do NOT reduce balance until settled? 
                  // NO, they reduce "Credit Limit" but not "Cash Balance".
                  // However, for "Net Asset" calculation, it's a liability.
                  // The prompt asks for "Foreign Balance" (Cash on hand). So CC expense doesn't touch it.
              } else {
                  // Cash/Debit OR Settled CC OR Digital
                  if (tx.paymentMethod === PaymentMethod.CASH_DEBIT) {
                      s.netBalanceForeign[tx.currency] = (s.netBalanceForeign[tx.currency] || 0) - tx.amount;
                  }
                  // If it's Settled CC, we already tracked the Repayment flow below?
                  // No, Repayment reduces balance.
                  
                  // Add to RMB Expense Total
                  s.totalExpenseCNY += (tx.calculatedCNY || 0);
              }
          }
      }

      // 4. REPAYMENT
      else if (tx.type === TransactionType.REPAYMENT) {
           // Repayment consumes foreign currency (if paying with foreign cash? No usually paying with RMB or Foreign?)
           // Prompt: "Repayment operation... calculate rate... fill bills".
           // Usually Repayment means: I use RMB to buy Foreign Currency to pay the bill OR I use RMB to pay bill directly.
           // Prompt example: "Repay 3w JPY, cost 1500 CNY".
           // This means we treat Repayment as an "Exchange" event essentially (RMB -> Bill).
           // It does NOT reduce Foreign Cash Balance (Inventory).
           
           // It does COST RMB though. 
           // BUT, we already added the cost to the *individual expenses* via `calculatedCNY` in the logic loop.
           // If we add `s.totalExpenseCNY += tx.calculatedCNY` here, we double count!
           
           // So, Repayment transaction helps us calculate costs, but the "Sum of Expenses" comes from the Expense records themselves.
           // Does Repayment reduce RMB Balance? 
           // `netBalanceCNY` = Income - Expense - Exchange.
           // The "Expense" part captures the settled CC bills.
           // So `netBalanceCNY` will be correct.
      }
    });

    // Final RMB Balance
    // Income - (Cash Expenses in RMB + Settled CC Expenses in RMB + Digital Expenses in RMB) - Exchange Costs
    // Note: `totalExpenseCNY` sums up all `calculatedCNY` from expenses.
    // `exchangeOutflowCNY` sums up RMB spent to buy foreign cash.
    s.netBalanceCNY = s.totalIncomeCNY - s.totalExpenseCNY - s.exchangeOutflowCNY;
    
    return s;
  }, [transactions]);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">J</div>
            <h1 className="text-lg font-bold text-slate-800">极J 记账助手</h1>
          </div>
          <div className="text-xs text-slate-400 font-mono hidden sm:block">
            V 2.0.0 | FIFO & Settlement
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 grid grid-cols-1 md:grid-cols-12 gap-6 pt-6">
        
        {/* Mobile Tab Switcher */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-2 flex justify-around z-40">
            <button 
                onClick={() => setActiveTab('DASHBOARD')}
                className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'DASHBOARD' ? 'text-indigo-600' : 'text-slate-400'}`}
            >
                <PieChart size={20} />
                <span className="text-[10px] mt-1">分析</span>
            </button>
            <button 
                onClick={() => {
                    setEditingTransaction(null);
                    setActiveTab('ADD');
                }}
                className={`flex flex-col items-center p-2 rounded-lg ${activeTab === 'ADD' ? 'text-indigo-600' : 'text-slate-400'}`}
            >
                <ListPlus size={20} />
                <span className="text-[10px] mt-1">记账</span>
            </button>
        </div>

        {/* Left Column: Dashboard */}
        <div className={`md:col-span-5 space-y-6 ${activeTab === 'DASHBOARD' ? 'block' : 'hidden md:block'}`}>
            <Dashboard stats={stats} transactions={transactions} />
            
            <div className="hidden md:block bg-indigo-900 rounded-2xl p-6 text-white text-center shadow-lg">
                <p className="text-indigo-200 text-sm mb-4">每一分外币，<br/>都有一笔对应的人民币成本。</p>
                <button 
                    onClick={() => {
                        setEditingTransaction(null);
                        setActiveTab('ADD');
                    }}
                    className="w-full py-3 bg-white text-indigo-900 rounded-xl font-semibold shadow-lg hover:bg-indigo-50 transition"
                >
                    + 记一笔 New
                </button>
            </div>
        </div>

        {/* Right Column: Transaction List & Input */}
        <div className={`md:col-span-7 h-[calc(100vh-120px)] flex flex-col ${activeTab === 'ADD' ? 'block' : 'hidden md:flex'}`}>
            {activeTab === 'ADD' ? (
                <div className="animate-in slide-in-from-right duration-300">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        {editingTransaction ? '编辑记录 Edit' : '新增记录 Add'}
                    </h2>
                    <InputForm 
                        onSave={handleSaveTransaction} 
                        initialData={editingTransaction}
                        onCancel={() => {
                            setEditingTransaction(null);
                            setActiveTab('DASHBOARD');
                        }}
                    />
                </div>
            ) : (
                <TransactionList 
                    transactions={transactions} 
                    onEdit={handleEditTransaction}
                    onDelete={handleDeleteTransaction}
                />
            )}
        </div>
      </main>
    </div>
  );
};

export default App;
