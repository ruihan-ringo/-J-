
import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType, Currency, PaymentMethod } from '../types';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, CURRENCY_OPTIONS, PAYMENT_METHOD_LABELS } from '../constants';
import { Plus, Save, RotateCcw, ArrowRightLeft, CreditCard } from 'lucide-react';

interface InputFormProps {
  onSave: (transaction: Transaction) => void;
  initialData?: Transaction | null;
  onCancel?: () => void;
}

const InputForm: React.FC<InputFormProps> = ({ onSave, initialData, onCancel }) => {
  const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [amount, setAmount] = useState<string>(''); // Main Amount (Foreign)
  const [cnyCost, setCnyCost] = useState<string>(''); // Cost in RMB (for Exchange/Repayment/Digital)
  const [currency, setCurrency] = useState<string>(Currency.CNY);
  const [category, setCategory] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 16));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.NONE);

  // Load initial data for editing
  useEffect(() => {
    if (initialData) {
      setType(initialData.type);
      setAmount(initialData.amount.toString());
      setCurrency(initialData.currency);
      setCategory(initialData.category);
      setDate(initialData.date);
      setPaymentMethod(initialData.paymentMethod);
      
      if (initialData.type === TransactionType.EXCHANGE || initialData.type === TransactionType.REPAYMENT || initialData.paymentMethod === PaymentMethod.DIGITAL) {
        setCnyCost(initialData.calculatedCNY.toString());
      }
    } else {
        // Reset defaults
        if (type === TransactionType.EXPENSE && currency !== Currency.CNY) {
            setPaymentMethod(PaymentMethod.CASH_DEBIT);
        }
    }
  }, [initialData]);

  // Reset logic when switching types
  useEffect(() => {
    if (initialData) return; // Don't reset if editing

    if (type === TransactionType.EXCHANGE) {
      setCurrency(Currency.USD);
      setCategory('换汇 Exchange');
      setPaymentMethod(PaymentMethod.NONE);
    } else if (type === TransactionType.REPAYMENT) {
        setCurrency(Currency.USD);
        setCategory('信用卡还款 Repayment');
        setPaymentMethod(PaymentMethod.NONE);
    } else {
       setCategory('');
    }
  }, [type, initialData]);

  // Auto-set Payment Method for Foreign Expense
  useEffect(() => {
    if (initialData) return;
    
    if (type === TransactionType.EXPENSE) {
        if (currency !== Currency.CNY) {
            // Default to Cash/Debit if foreign
            if (paymentMethod === PaymentMethod.NONE) setPaymentMethod(PaymentMethod.CASH_DEBIT);
        } else {
            setPaymentMethod(PaymentMethod.NONE);
        }
    }
  }, [currency, type, initialData, paymentMethod]);


  const getHelperText = () => {
    if (type === TransactionType.EXCHANGE) return "记录用人民币购买外币。这会增加你的外币“库存”。后续的现金消费将自动从这里扣除（按先进先出原则）。";
    if (type === TransactionType.REPAYMENT) return "记录还款操作。系统会自动查找之前未结算的信用卡账单，并根据你填写的实际还款汇率，计算那些账单的人民币成本。";
    if (currency === Currency.CNY) return null;
    
    switch (paymentMethod) {
      case PaymentMethod.CASH_DEBIT:
        return "消耗手里的外币现金。系统会自动根据你之前的换汇记录计算人民币成本 (FIFO)。";
      case PaymentMethod.DIGITAL:
        return "实时购汇消费 (如微信/支付宝)。请直接输入当时扣款的人民币金额。";
      case PaymentMethod.CREDIT_CARD:
        return "先记账，不计算人民币成本。等到还款日记录“还信用卡”时再结算。";
      default:
        return null;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;

    const amt = parseFloat(amount);
    let finalCalculatedCNY = 0;

    // Logic for CNY Cost based on inputs
    if (type === TransactionType.EXCHANGE || type === TransactionType.REPAYMENT) {
        finalCalculatedCNY = parseFloat(cnyCost);
    } else if (paymentMethod === PaymentMethod.DIGITAL) {
        finalCalculatedCNY = parseFloat(cnyCost);
    } else if (currency === Currency.CNY) {
        finalCalculatedCNY = amt;
    }
    // For CASH_DEBIT and CREDIT_CARD (Expense), calculatedCNY is handled by the backend logic (App.tsx / financeLogic)

    const newTransaction: Transaction = {
      id: initialData ? initialData.id : crypto.randomUUID(),
      type,
      amount: amt,
      currency,
      category: category,
      date,
      paymentMethod,
      calculatedCNY: finalCalculatedCNY,
      // Reset logic fields, let the recalculation engine handle them
      exchangeRemainingAmount: type === TransactionType.EXCHANGE ? amt : undefined,
      isCreditCardSettled: false,
    };

    onSave(newTransaction);
    
    if (!initialData) {
      setAmount('');
      setCnyCost('');
      if (type !== TransactionType.EXCHANGE) setCategory('');
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      {/* TABS */}
      <div className="grid grid-cols-4 gap-1 mb-6 bg-slate-100/50 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setType(TransactionType.INCOME)}
          className={`py-2 text-xs font-semibold rounded-lg transition-all ${
            type === TransactionType.INCOME ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'text-slate-500 hover:bg-white/50'
          }`}
        >
          收入 Income
        </button>
        <button
          type="button"
          onClick={() => setType(TransactionType.EXPENSE)}
          className={`py-2 text-xs font-semibold rounded-lg transition-all ${
            type === TransactionType.EXPENSE ? 'bg-rose-100 text-rose-700 shadow-sm' : 'text-slate-500 hover:bg-white/50'
          }`}
        >
          支出 Expense
        </button>
        <button
          type="button"
          onClick={() => setType(TransactionType.EXCHANGE)}
          className={`py-2 text-xs font-semibold rounded-lg transition-all ${
            type === TransactionType.EXCHANGE ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-white/50'
          }`}
        >
          换汇 Exchange
        </button>
        <button
          type="button"
          onClick={() => setType(TransactionType.REPAYMENT)}
          className={`py-2 text-xs font-semibold rounded-lg transition-all ${
            type === TransactionType.REPAYMENT ? 'bg-purple-100 text-purple-700 shadow-sm' : 'text-slate-500 hover:bg-white/50'
          }`}
        >
          还信用卡 Repay
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* === EXCHANGE / REPAYMENT LAYOUT === */}
        {(type === TransactionType.EXCHANGE || type === TransactionType.REPAYMENT) ? (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">
                            {type === TransactionType.EXCHANGE ? '消耗人民币 Cost (CNY)' : '实付人民币 Cost (CNY)'}
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-400 font-mono">¥</span>
                            <input
                                type="number"
                                step="0.01"
                                value={cnyCost}
                                onChange={(e) => setCnyCost(e.target.value)}
                                className="w-full pl-7 p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                placeholder="0.00"
                                required
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-center pt-6 text-slate-300">
                        {type === TransactionType.EXCHANGE ? <ArrowRightLeft size={20} /> : <CreditCard size={20} />}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">
                            {type === TransactionType.EXCHANGE ? '获得外币 Amount' : '还款外币 Amount'}
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                            placeholder="0.00"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">币种 Currency</label>
                        <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {CURRENCY_OPTIONS.filter(c => c !== Currency.CNY).map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg flex justify-between items-center text-xs text-slate-600">
                     <span>计算汇率:</span>
                     <span className="font-mono font-bold">
                        1 {currency} ≈ {amount && cnyCost ? (parseFloat(cnyCost) / parseFloat(amount)).toFixed(4) : '?'} CNY
                     </span>
                </div>

                 <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">日期 Date</label>
                    <input
                    type="datetime-local"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    required
                    />
                </div>
            </div>
        ) : (
            /* === INCOME / EXPENSE LAYOUT === */
            <>
                <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">金额 Amount</label>
                    <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                    placeholder="0.00"
                    required
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">币种 Currency</label>
                    <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                    {CURRENCY_OPTIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                    </select>
                </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">分类 Category</label>
                    <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                    >
                    <option value="" disabled>选择分类</option>
                    {(type === TransactionType.INCOME ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">时间 Time</label>
                    <input
                    type="datetime-local"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    required
                    />
                </div>
                </div>

                {/* EXPENSE: Payment Method Selection */}
                {type === TransactionType.EXPENSE && currency !== Currency.CNY && (
                <div className="bg-indigo-50 p-4 rounded-xl space-y-3 border border-indigo-100 animate-in fade-in">
                    <div>
                    <label className="block text-xs font-medium text-indigo-800 mb-1">
                        支付方式 Payment Method
                    </label>
                    <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                        className="w-full p-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-indigo-900"
                    >
                        {Object.entries(PAYMENT_METHOD_LABELS).filter(([k]) => k !== PaymentMethod.NONE).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                        ))}
                    </select>
                    </div>

                    {/* Logic Hint specific to Payment Method */}
                    {paymentMethod === PaymentMethod.DIGITAL && (
                        <div>
                             <label className="block text-xs font-medium text-indigo-800 mb-1">
                                实付人民币 (CNY Cost)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={cnyCost}
                                onChange={(e) => setCnyCost(e.target.value)}
                                className="w-full p-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                                placeholder="输入支付宝/微信扣款金额"
                                required
                            />
                        </div>
                    )}
                </div>
                )}
            </>
        )}

        {getHelperText() && (
            <p className="text-xs text-slate-500 mt-1 italic border-l-2 border-slate-300 pl-2">
            💡 {getHelperText()}
            </p>
        )}

        <div className="pt-2 flex gap-3">
          {onCancel && (
             <button
             type="button"
             onClick={onCancel}
             className="flex-1 py-3 px-4 bg-slate-100 text-slate-600 rounded-xl font-medium hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
           >
             <RotateCcw size={18} />
             取消 Cancel
           </button>
          )}
          <button
            type="submit"
            className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
          >
            {initialData ? <Save size={18} /> : <Plus size={18} />}
            {initialData ? '保存修改 Save' : '提交 Submit'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InputForm;
