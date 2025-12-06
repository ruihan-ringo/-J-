
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, PaymentMethod } from '../types';
import { Edit2, Trash2, CreditCard, Banknote, Smartphone, ArrowRightLeft, CheckCircle2, Clock } from 'lucide-react';

interface TransactionListProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, onEdit, onDelete }) => {
  const [filterType, setFilterType] = useState<string>('ALL');

  const filteredData = useMemo(() => {
    let data = transactions;
    if (filterType !== 'ALL') {
        data = transactions.filter(t => t.type === filterType);
    }
    // Sort descending by date
    return [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, filterType]);

  const getPaymentIcon = (method: PaymentMethod, type: TransactionType) => {
    if (type === TransactionType.EXCHANGE) return <ArrowRightLeft size={14} className="text-blue-500" />;
    if (type === TransactionType.REPAYMENT) return <CheckCircle2 size={14} className="text-purple-500" />;
    
    switch (method) {
      case PaymentMethod.CASH_DEBIT: return <Banknote size={14} className="text-amber-600" />;
      case PaymentMethod.DIGITAL: return <Smartphone size={14} className="text-blue-600" />;
      case PaymentMethod.CREDIT_CARD: return <CreditCard size={14} className="text-rose-600" />;
      default: return null;
    }
  };

  const getAmountColor = (type: TransactionType) => {
      switch (type) {
          case TransactionType.INCOME: return 'text-emerald-600';
          case TransactionType.EXPENSE: return 'text-slate-700';
          case TransactionType.EXCHANGE: return 'text-blue-600';
          case TransactionType.REPAYMENT: return 'text-purple-600';
          default: return 'text-slate-700';
      }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <h3 className="font-semibold text-slate-700">账单明细 Details</h3>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="ALL">全部 All</option>
          <option value={TransactionType.INCOME}>收入 Income</option>
          <option value={TransactionType.EXPENSE}>支出 Expense</option>
          <option value={TransactionType.EXCHANGE}>换汇 Exchange</option>
          <option value={TransactionType.REPAYMENT}>还款 Repayment</option>
        </select>
      </div>

      <div className="overflow-y-auto flex-1 p-0">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="py-3 px-4 text-xs font-semibold text-slate-500">日期</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate-500">分类/用途</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 text-right">变动金额</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 text-right">RMB成本</th>
              <th className="py-3 px-4 text-xs font-semibold text-slate-500 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredData.length === 0 ? (
                <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-sm">暂无数据</td>
                </tr>
            ) : filteredData.map((tx) => (
              <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors group">
                <td className="py-3 px-4 text-xs text-slate-600">
                  <div className="font-medium">{tx.date.split('T')[0]}</div>
                  <div className="text-slate-400 scale-90 origin-left">{tx.date.split('T')[1]}</div>
                </td>
                <td className="py-3 px-4">
                  <div className="text-sm font-medium text-slate-800">{tx.category}</div>
                  <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    {getPaymentIcon(tx.paymentMethod, tx.type)}
                    {tx.type === TransactionType.EXCHANGE && <span>购汇 (Rate: {(tx.calculatedCNY/tx.amount).toFixed(4)})</span>}
                    {tx.type === TransactionType.REPAYMENT && <span>还款结算</span>}
                    {tx.paymentMethod === PaymentMethod.CREDIT_CARD && !tx.isCreditCardSettled && (
                        <span className="text-rose-400 flex items-center gap-1"><Clock size={10}/> 待还款</span>
                    )}
                    {tx.paymentMethod === PaymentMethod.CREDIT_CARD && tx.isCreditCardSettled && (
                        <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 size={10}/> 已结算</span>
                    )}
                  </div>
                </td>
                <td className={`py-3 px-4 text-sm font-mono text-right ${getAmountColor(tx.type)}`}>
                  {tx.type === TransactionType.EXPENSE && '-'}
                  {tx.type === TransactionType.EXCHANGE && '+'}
                  {tx.type === TransactionType.REPAYMENT && '-'}
                  {tx.amount.toFixed(2)} <span className="text-xs text-slate-400">{tx.currency}</span>
                </td>
                <td className="py-3 px-4 text-sm font-mono text-slate-500 text-right">
                  {/* RMB Cost Display Logic */}
                  {tx.type === TransactionType.EXPENSE && tx.paymentMethod === PaymentMethod.CREDIT_CARD && !tx.isCreditCardSettled ? (
                      <span className="text-slate-300">--</span>
                  ) : (
                      <>
                        {tx.type === TransactionType.EXCHANGE && '-'}
                        ¥{tx.calculatedCNY?.toFixed(2)}
                      </>
                  )}
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(tx)} className="p-1.5 hover:bg-indigo-50 rounded-md text-indigo-600">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => onDelete(tx.id)} className="p-1.5 hover:bg-rose-50 rounded-md text-rose-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionList;
