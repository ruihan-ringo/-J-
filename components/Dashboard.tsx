import React, { useState, useMemo } from 'react';
import { DashboardStats, Transaction, Currency, TransactionType, PaymentMethod } from '../types';
import { Sparkles, Loader2, Calendar, TrendingUp, TrendingDown, CreditCard, Banknote } from 'lucide-react';
import { analyzeSpending } from '../services/geminiService';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface DashboardProps {
  transactions: Transaction[];
  stats: DashboardStats;
}

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#3b82f6', '#14b8a6'];

const Dashboard: React.FC<DashboardProps> = ({ stats, transactions }) => {
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  
  // Date Filter State
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM

  const handleAiAnalysis = async () => {
    setLoadingAi(true);
    const result = await analyzeSpending(transactions);
    setAiAnalysis(result);
    setLoadingAi(false);
  };

  // Filter transactions for the selected month
  const monthlyTransactions = useMemo(() => {
    return transactions.filter(t => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  // Calculate Chart Data (Expense Categories)
  const chartData = useMemo(() => {
    const categoryTotals: Record<string, number> = {};

    monthlyTransactions.forEach(t => {
      if (t.type === TransactionType.EXPENSE) {
        // Only count if it has a calculated CNY value (Settled CC or Cash)
        if (t.calculatedCNY > 0) {
             categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.calculatedCNY;
        }
      }
    });

    return Object.entries(categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value); 
  }, [monthlyTransactions]);

  const monthlyExpenseCNY = monthlyTransactions
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce((sum, t) => sum + (t.calculatedCNY || 0), 0);

  const monthlyPendingCC = monthlyTransactions
    .filter(t => t.type === TransactionType.EXPENSE && t.paymentMethod === PaymentMethod.CREDIT_CARD && !t.isCreditCardSettled)
    .reduce((acc, t) => {
        acc[t.currency] = (acc[t.currency] || 0) + t.amount;
        return acc;
    }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      
      {/* 1. Global Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* RMB Card */}
        <div className="bg-slate-800 rounded-2xl p-5 text-white shadow-xl">
           <div className="flex justify-between items-start mb-4">
               <div>
                   <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">人民币 (CNY)</h3>
                   <div className="text-2xl font-mono font-bold mt-1">¥ {stats.netBalanceCNY.toFixed(2)}</div>
               </div>
               <div className="p-2 bg-slate-700 rounded-lg"><span className="text-xl">🇨🇳</span></div>
           </div>
           
           <div className="grid grid-cols-2 gap-y-3 gap-x-2 border-t border-slate-700 pt-3">
               <div>
                   <div className="text-xs text-slate-400">收入</div>
                   <div className="font-mono text-sm">¥{stats.totalIncomeCNY.toFixed(2)}</div>
               </div>
               <div>
                   <div className="text-xs text-slate-400">支出 (已结算)</div>
                   <div className="font-mono text-sm text-rose-300">¥{stats.totalExpenseCNY.toFixed(2)}</div>
               </div>
               <div className="col-span-2 text-xs text-slate-500 mt-1">
                   * 另有 ¥{stats.exchangeOutflowCNY.toFixed(2)} 已兑换为外币
               </div>
           </div>
        </div>

        {/* Foreign Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-4">
               <div>
                   <h3 className="text-slate-500 text-xs font-semibold uppercase tracking-wider">外币库存 (Cash Balance)</h3>
                   <div className="flex flex-wrap gap-2 mt-2">
                       {Object.entries(stats.netBalanceForeign).length === 0 ? (
                           <span className="text-slate-300 font-mono text-sm">0.00</span>
                       ) : (
                           Object.entries(stats.netBalanceForeign).map(([curr, val]: [string, number]) => (
                               Math.abs(val) > 0.01 && (
                                   <div key={curr} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-mono font-bold border border-blue-100">
                                       {val.toFixed(2)} {curr}
                                   </div>
                               )
                           ))
                       )}
                   </div>
               </div>
               <div className="p-2 bg-blue-50 rounded-lg"><span className="text-xl">🌍</span></div>
           </div>

           <div className="border-t border-slate-100 pt-3 space-y-2">
               <div>
                   <div className="text-xs text-slate-400 flex items-center gap-1 mb-1">
                        <CreditCard size={12} /> 待还款信用卡 (Pending)
                   </div>
                   <div className="flex flex-wrap gap-2">
                        {Object.entries(stats.totalExpenseForeignPending).length === 0 ? (
                            <span className="text-xs text-slate-300">无待还账单</span>
                        ) : (
                            Object.entries(stats.totalExpenseForeignPending).map(([curr, val]: [string, number]) => (
                                Math.abs(val) > 0.01 && (
                                    <span key={curr} className="text-xs font-mono text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">
                                        -{val.toFixed(2)} {curr}
                                    </span>
                                )
                            ))
                        )}
                   </div>
               </div>
           </div>
        </div>
      </div>

      {/* 2. Monthly Analysis Section */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Calendar size={18} className="text-indigo-600"/> 
                月度收支分析
            </h3>
            <input 
                type="month" 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-slate-600"
            />
        </div>

        <div className="flex flex-col md:flex-row gap-8">
            {/* Chart */}
            <div className="w-full md:w-1/2 h-64">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => `¥${value.toFixed(2)}`} />
                            <Legend 
                                layout="vertical" 
                                verticalAlign="middle" 
                                align="right"
                                iconType="circle"
                                wrapperStyle={{ fontSize: '12px', color: '#64748b' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-300 text-sm bg-slate-50 rounded-xl">
                        <span>本月暂无RMB结算支出</span>
                    </div>
                )}
            </div>

            {/* Monthly Stats Text */}
            <div className="w-full md:w-1/2 flex flex-col justify-center space-y-4">
                <div className="bg-slate-50 rounded-xl p-4">
                     <div className="text-sm text-slate-500 mb-1">已确认支出 (CNY Cost)</div>
                     <div className="text-2xl font-mono font-bold text-slate-700">¥{monthlyExpenseCNY.toFixed(2)}</div>
                </div>

                {/* Pending Credit Card Note */}
                {Object.keys(monthlyPendingCC).length > 0 && (
                    <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
                        <div className="text-sm text-rose-800 mb-2 flex items-center gap-1 font-semibold">
                            <CreditCard size={14}/> 本月信用卡待还
                        </div>
                        <div className="space-y-1">
                            {Object.entries(monthlyPendingCC).map(([curr, val]: [string, number]) => (
                                <div key={curr} className="flex justify-between text-xs text-rose-600 font-mono">
                                    <span>{curr}</span>
                                    <span>-{val.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-2 text-[10px] text-rose-400">
                            * 还款结算后将计入上方RMB支出
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* 3. AI Assistant */}
      <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
        <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-indigo-600" />
                <h3 className="font-semibold text-indigo-900 text-sm">极J 智能评价 (本月)</h3>
            </div>
            {!aiAnalysis && (
                <button 
                    onClick={handleAiAnalysis}
                    disabled={loadingAi}
                    className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-1"
                >
                    {loadingAi ? <Loader2 size={12} className="animate-spin" /> : '生成分析'}
                </button>
            )}
        </div>
        {aiAnalysis ? (
             <div className="text-sm text-indigo-800 leading-relaxed bg-white/50 p-3 rounded-lg animate-in fade-in">
                {aiAnalysis}
             </div>
        ) : (
            <p className="text-xs text-indigo-400">点击让 AI 基于你 {selectedMonth} 的账单给出评价。</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;