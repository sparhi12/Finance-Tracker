import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Landmark, 
  LineChart, 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight,
  PieChart as PieIcon,
  Calendar,
  Trash2,
  Edit2,
  RefreshCw
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { api } from '../services/api';

export default function AccountsView({ accounts, onAccountUpdated }) {
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || null);
  const [selectedRange, setSelectedRange] = useState('3M');
  const [accountData, setAccountData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ranges = ['1M', '3M', 'YTD', '1Y', 'ALL'];

  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts]);

  const loadAccountDetails = async (accId, range) => {
    if (!accId) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.getAccountAnalytics(accId, range);
      setAccountData(data);
    } catch (err) {
      setError(err.message || 'Failed to load account analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAccountId) {
      loadAccountDetails(selectedAccountId, selectedRange);
    }
  }, [selectedAccountId, selectedRange]);

  const formatCurrency = (val, maxDecimals = 0) => {
    if (val === undefined || val === null) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: maxDecimals,
      minimumFractionDigits: maxDecimals
    }).format(val);
  };

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  const isPositive = (accountData?.period_change_dollars ?? 0) >= 0;

  const getAccountIcon = (type) => {
    if (type === 'CASH') return Landmark;
    if (type === 'BROKERAGE') return LineChart;
    return CreditCard;
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedAccount?.name}? All snapshots and history will be permanently deleted.`)) {
      return;
    }
    try {
      await api.deleteAccount(selectedAccountId);
      onAccountUpdated();
      const nextAcc = accounts.find(a => a.id !== selectedAccountId);
      setSelectedAccountId(nextAcc ? nextAcc.id : null);
    } catch (err) {
      alert(err.message || 'Failed to delete account');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      
      {/* Left Column: Account Selector List */}
      <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="font-bold text-slate-900 text-sm">Your Accounts</h2>
          <p className="text-xs text-slate-500">Select an account to view performance</p>
        </div>

        <div className="divide-y divide-slate-100 overflow-y-auto max-h-[600px]">
          {accounts.map((acc) => {
            const Icon = getAccountIcon(acc.type);
            const isSelected = acc.id === selectedAccountId;
            const bal = acc.latest_balance ?? 0;
            const isDebt = acc.type === 'CREDIT';

            return (
              <button
                key={acc.id}
                onClick={() => setSelectedAccountId(acc.id)}
                className={`w-full p-3.5 text-left flex items-start space-x-3 transition ${
                  isSelected
                    ? 'bg-teal-50/60 border-l-4 border-teal-600'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className={`p-2 rounded-lg mt-0.5 shrink-0 ${
                  acc.type === 'CASH' ? 'bg-teal-50 text-teal-600' :
                  acc.type === 'BROKERAGE' ? 'bg-blue-50 text-blue-600' :
                  'bg-rose-50 text-rose-600'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 text-xs truncate">{acc.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{acc.institution}</div>
                  <div className={`text-xs font-bold mt-1 ${isDebt ? 'text-rose-600' : 'text-slate-900'}`}>
                    {formatCurrency(bal, 2)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Account Detail & Analytics */}
      <div className="lg:col-span-3 space-y-6">
        {selectedAccount && accountData ? (
          <>
            {/* Header & Controls */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{selectedAccount.name}</h1>
                  <span className="text-[11px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full">
                    {selectedAccount.type}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Institution: <span className="font-medium text-slate-700">{selectedAccount.institution}</span>
                </div>
              </div>

              {/* Range & Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  {ranges.map((r) => (
                    <button
                      key={r}
                      onClick={() => setSelectedRange(r)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                        selectedRange === r ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleDeleteAccount}
                  title="Delete this account"
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[11px] font-semibold uppercase text-slate-500 mb-1">Current Balance</div>
                <div className="text-xl font-extrabold text-slate-900">
                  {formatCurrency(accountData.current_balance, 2)}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[11px] font-semibold uppercase text-slate-500 mb-1">Period Change</div>
                <div className={`text-xl font-extrabold flex items-center ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isPositive ? '+' : ''}{formatCurrency(accountData.period_change_dollars, 2)}
                </div>
                <div className={`text-[10px] font-semibold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isPositive ? '+' : ''}{accountData.period_change_percent}%
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[11px] font-semibold uppercase text-slate-500 mb-1">Period High</div>
                <div className="text-xl font-extrabold text-slate-900">
                  {formatCurrency(accountData.period_high, 2)}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-[11px] font-semibold uppercase text-slate-500 mb-1">Period Low</div>
                <div className="text-xl font-extrabold text-slate-900">
                  {formatCurrency(accountData.period_low, 2)}
                </div>
              </div>
            </div>

            {/* Balance History Chart */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <h2 className="text-sm font-bold text-slate-900">Balance History ({selectedRange})</h2>
              <div className="h-64 w-full">
                {accountData.daily_history?.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={accountData.daily_history}>
                      <defs>
                        <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0d9488" stopOpacity={0.35}/>
                          <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="date" 
                        tickLine={false} 
                        axisLine={{ stroke: '#e2e8f0' }} 
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        tickFormatter={(val) => {
                          const d = new Date(val);
                          return `${d.getMonth() + 1}/${d.getDate()}`;
                        }}
                        minTickGap={25}
                      />
                      <YAxis 
                        tickLine={false} 
                        axisLine={false} 
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        tickFormatter={(v) => `$${v}`}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip 
                        formatter={(val) => [formatCurrency(val, 2), 'Balance']}
                        labelFormatter={(lbl) => `Date: ${lbl}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="balance"
                        stroke="#0d9488"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#accGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    No balance history found
                  </div>
                )}
              </div>
            </div>

            {/* Brokerage Specific Breakdown: Per-Ticker Market Value, Weight %, Cash vs Equity Split */}
            {selectedAccount.type === 'BROKERAGE' && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Holdings Breakdown & Portfolio Weights</h3>
                    <p className="text-xs text-slate-500">Live marks based on latest closing prices</p>
                  </div>

                  {/* Cash vs Equity Split Pill */}
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="px-2.5 py-1 rounded-md bg-teal-50 text-teal-700 font-semibold border border-teal-200">
                      Cash: {accountData.cash_equity_split?.cash_percent}% ({formatCurrency(accountData.cash_equity_split?.cash_amount, 2)})
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                      Equities: {accountData.cash_equity_split?.equity_percent}% ({formatCurrency(accountData.cash_equity_split?.equity_amount, 2)})
                    </span>
                  </div>
                </div>

                {/* Holdings Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 font-medium border-b border-slate-200">
                        <th className="pb-2">Asset / Ticker</th>
                        <th className="pb-2">Type</th>
                        <th className="pb-2">Shares</th>
                        <th className="pb-2">Price ($)</th>
                        <th className="pb-2">Market Value ($)</th>
                        <th className="pb-2">Weight (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {accountData.holdings_breakdown?.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 font-bold text-slate-900">{item.ticker}</td>
                          <td className="py-2.5 text-slate-500">{item.asset_type}</td>
                          <td className="py-2.5 font-medium">{item.shares}</td>
                          <td className="py-2.5 text-slate-500">${item.price.toFixed(2)}</td>
                          <td className="py-2.5 font-bold text-slate-900">{formatCurrency(item.market_value, 2)}</td>
                          <td className="py-2.5">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-slate-700">{item.weight_percent}%</span>
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-teal-600 rounded-full" 
                                  style={{ width: `${item.weight_percent}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
            {loading ? 'Loading account analytics...' : 'Select an account to view details'}
          </div>
        )}
      </div>

    </div>
  );
}
