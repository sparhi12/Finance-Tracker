import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShieldAlert, 
  PieChart as PieIcon, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  Info,
  CheckCircle2,
  Sparkles,
  Landmark,
  LineChart,
  CreditCard,
  ChevronRight
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

export default function DashboardView({ 
  analyticsData, 
  selectedRange, 
  onRangeChange, 
  customDates, 
  onCustomDatesChange,
  onNavigateToAccount,
  loading 
}) {
  const [chartMetric, setChartMetric] = useState('net_worth'); // 'net_worth' | 'assets_vs_liab'

  const ranges = ['1M', '3M', 'YTD', '1Y', 'ALL', 'custom'];

  const formatCurrency = (val, maxDecimals = 0) => {
    if (val === undefined || val === null) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: maxDecimals,
      minimumFractionDigits: maxDecimals
    }).format(val);
  };

  const formatShortCurrency = (val) => {
    if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}k`;
    return `$${val}`;
  };

  const summary = analyticsData?.summary || {};
  const attribution = analyticsData?.attribution || {};
  const history = analyticsData?.daily_history || [];
  const accounts = analyticsData?.accounts || [];
  const assetAlloc = summary.asset_allocation || {
    cash: { amount: 0, percent: 0 },
    equities: { amount: 0, percent: 0 },
    debt: { amount: 0, percent: 0 }
  };

  const currentNW = summary.current_net_worth ?? 0;
  const startNW = summary.start_net_worth ?? 0;
  const periodChgDollars = summary.period_change_dollars ?? 0;
  const periodChgPercent = summary.period_change_percent ?? 0;
  const periodPct = periodChgPercent;
  const isPositive = periodChgDollars >= 0;

  // Latest balance map from end of history
  const latestDaily = history.length > 0 ? history[history.length - 1] : null;
  const latestAccBalances = latestDaily?.account_balances || {};

  // Group accounts by category
  const cashAccounts = accounts.filter(a => a.type === 'CASH');
  const brokerageAccounts = accounts.filter(a => a.type === 'BROKERAGE');
  const creditAccounts = accounts.filter(a => a.type === 'CREDIT');

  const totalCash = cashAccounts.reduce((sum, a) => sum + (latestAccBalances[a.id] || 0), 0);
  const totalBrokerage = brokerageAccounts.reduce((sum, a) => sum + (latestAccBalances[a.id] || 0), 0);
  const totalCreditDebt = creditAccounts.reduce((sum, a) => sum + Math.abs(latestAccBalances[a.id] || 0), 0);

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-800 text-xs space-y-1.5 min-w-[200px]">
          <div className="font-semibold text-slate-300 pb-1 border-b border-slate-800 flex items-center justify-between">
            <span>{label}</span>
            <span className="text-[10px] text-slate-400">Daily Close</span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-teal-400 font-medium">Net Worth:</span>
            <span className="font-bold text-sm text-white">{formatCurrency(dataPoint.net_worth, 2)}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>Total Assets:</span>
            <span className="font-semibold">{formatCurrency(dataPoint.total_assets, 2)}</span>
          </div>
          <div className="flex justify-between items-center text-slate-300">
            <span>Total Liabilities:</span>
            <span className="font-semibold text-rose-400">{formatCurrency(dataPoint.total_liabilities, 2)}</span>
          </div>
          <div className="pt-1.5 border-t border-slate-800 flex justify-between text-[11px] text-slate-400">
            <span>Cash: {formatCurrency(dataPoint.cash_assets, 0)}</span>
            <span>Equities: {formatCurrency(dataPoint.equity_assets, 0)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      
      {/* Top Controls: Range Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Net Worth Overview</h1>
          <p className="text-xs text-slate-500">
            Daily historical reconstruction with live and cached market prices
          </p>
        </div>

        {/* Range Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                selectedRange === r
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {r === 'custom' ? 'Custom' : r}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Pickers if selected */}
      {selectedRange === 'custom' && (
        <div className="flex flex-wrap items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-200 text-xs">
          <Calendar className="w-4 h-4 text-teal-600" />
          <span className="font-semibold text-slate-700">Custom Date Range:</span>
          <div className="flex items-center space-x-2">
            <label className="text-slate-500">From:</label>
            <input
              type="date"
              value={customDates.startDate}
              onChange={(e) => onCustomDatesChange({ ...customDates, startDate: e.target.value })}
              className="px-2.5 py-1 border border-slate-200 rounded-md focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-slate-500">To:</label>
            <input
              type="date"
              value={customDates.endDate}
              onChange={(e) => onCustomDatesChange({ ...customDates, endDate: e.target.value })}
              className="px-2.5 py-1 border border-slate-200 rounded-md focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>
      )}

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Net Worth Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            <span>Current Net Worth</span>
            <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatCurrency(currentNW)}
          </div>
          <div className="mt-2 flex items-center space-x-2">
            <span className={`inline-flex items-center space-x-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
              isPositive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              <span>{isPositive ? '+' : ''}{formatCurrency(periodChgDollars)} ({isPositive ? '+' : ''}{periodPct}%)</span>
            </span>
            <span className="text-[11px] text-slate-400">in {selectedRange}</span>
          </div>
        </div>

        {/* Total Assets Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            <span>Total Assets</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatCurrency(summary.total_assets ?? 0)}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span>Cash: {formatCurrency(assetAlloc.cash.amount, 0)}</span>
            <span>Equities: {formatCurrency(assetAlloc.equities.amount, 0)}</span>
          </div>
        </div>

        {/* Total Liabilities / Debt Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            <span>Total Liabilities</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight text-rose-600">
            {formatCurrency(summary.total_liabilities ?? 0)}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Debt-to-Asset: {summary.total_assets ? ((summary.total_liabilities / summary.total_assets) * 100).toFixed(1) : 0}%
          </div>
        </div>

        {/* Asset Allocation Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              <span>Asset Allocation</span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <PieIcon className="w-4 h-4" />
              </div>
            </div>
            
            {/* Visual allocation bar */}
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex my-2">
              <div 
                className="bg-teal-500 transition-all duration-300" 
                style={{ width: `${assetAlloc.cash.percent}%` }}
                title={`Cash: ${assetAlloc.cash.percent}%`}
              />
              <div 
                className="bg-blue-600 transition-all duration-300" 
                style={{ width: `${assetAlloc.equities.percent}%` }}
                title={`Equities: ${assetAlloc.equities.percent}%`}
              />
              <div 
                className="bg-rose-500 transition-all duration-300" 
                style={{ width: `${assetAlloc.debt.percent}%` }}
                title={`Debt: ${assetAlloc.debt.percent}%`}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium pt-1">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-teal-500 inline-block" />
              <span>Cash {assetAlloc.cash.percent}%</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
              <span>Equities {assetAlloc.equities.percent}%</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              <span>Debt {assetAlloc.debt.percent}%</span>
            </span>
          </div>
        </div>

      </div>

      {/* 2-COLUMN MAIN CONTENT: Left Charts & Attribution, Right Net Worth Per Account Side Column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Main Net Worth Time-Series Chart & Attribution */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Chart */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">Net Worth History</h2>
                <p className="text-xs text-slate-500">
                  Valuation reconstructed daily with cached closing prices
                </p>
              </div>

              <div className="flex items-center space-x-2 text-xs">
                <button
                  onClick={() => setChartMetric('net_worth')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    chartMetric === 'net_worth'
                      ? 'bg-teal-50 text-teal-700 border border-teal-200'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Net Worth
                </button>
                <button
                  onClick={() => setChartMetric('assets_vs_liab')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    chartMetric === 'assets_vs_liab'
                      ? 'bg-teal-50 text-teal-700 border border-teal-200'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Assets vs. Debt
                </button>
              </div>
            </div>

            {/* Chart Canvas */}
            <div className="h-72 w-full pt-2">
              {history.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d9488" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="assetsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="liabGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#e11d48" stopOpacity={0.0}/>
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
                      tickFormatter={formatShortCurrency}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    
                    {chartMetric === 'net_worth' ? (
                      <Area
                        type="monotone"
                        dataKey="net_worth"
                        stroke="#0d9488"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#netWorthGrad)"
                      />
                    ) : (
                      <>
                        <Area
                          type="monotone"
                          dataKey="total_assets"
                          stroke="#2563eb"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#assetsGrad)"
                        />
                        <Area
                          type="monotone"
                          dataKey="total_liabilities"
                          stroke="#e11d48"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#liabGrad)"
                        />
                      </>
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  No historical data available for this range
                </div>
              )}
            </div>
          </div>

          {/* Period Change Attribution */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-teal-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Period Change Attribution</h3>
                  <p className="text-xs text-slate-500">
                    Mathematical decomposition of net worth movement in selected period ({selectedRange})
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Reconciled: {formatCurrency(attribution.total_attributed ?? 0)}</span>
              </div>
            </div>

            {/* Attribution Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Market Movement</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    Equities
                  </span>
                </div>
                <div className={`text-xl font-extrabold ${
                  (attribution.market_price_movement ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {(attribution.market_price_movement ?? 0) >= 0 ? '+' : ''}
                  {formatCurrency(attribution.market_price_movement ?? 0)}
                </div>
                <p className="text-[11px] text-slate-500">Appreciation / depreciation from market price changes</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Share Additions</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-teal-50 text-teal-700 border border-teal-200">
                    Capital Invested
                  </span>
                </div>
                <div className={`text-xl font-extrabold ${
                  (attribution.net_share_additions ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {(attribution.net_share_additions ?? 0) >= 0 ? '+' : ''}
                  {formatCurrency(attribution.net_share_additions ?? 0)}
                </div>
                <p className="text-[11px] text-slate-500">Net new shares purchased or transferred</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cash Changes</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Banking
                  </span>
                </div>
                <div className={`text-xl font-extrabold ${
                  (attribution.cash_balance_changes ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {(attribution.cash_balance_changes ?? 0) >= 0 ? '+' : ''}
                  {formatCurrency(attribution.cash_balance_changes ?? 0)}
                </div>
                <p className="text-[11px] text-slate-500">Net savings deposits & uninvested cash shifts</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Debt Changes</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    Credit
                  </span>
                </div>
                <div className={`text-xl font-extrabold ${
                  (attribution.credit_balance_changes ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {(attribution.credit_balance_changes ?? 0) >= 0 ? '+' : ''}
                  {formatCurrency(attribution.credit_balance_changes ?? 0)}
                </div>
                <p className="text-[11px] text-slate-500">
                  {(attribution.credit_balance_changes ?? 0) >= 0 ? 'Debt reduction increased net worth' : 'Increased debt balance'}
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Right 1 Col: NET WORTH PER ACCOUNT SIDE COLUMN */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Net Worth by Account</h3>
                <p className="text-[11px] text-slate-500">Click any account to update entries</p>
              </div>
              <span className="text-xs font-bold text-teal-700">{formatCurrency(currentNW)}</span>
            </div>

            <div className="p-4 space-y-5">
              
              {/* Cash Accounts Group */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider pb-1.5 border-b border-slate-100">
                  <span className="flex items-center space-x-1">
                    <Landmark className="w-3.5 h-3.5 text-teal-600 inline" />
                    <span>Cash & Banking</span>
                  </span>
                  <span className="text-slate-900 font-extrabold">{formatCurrency(totalCash)}</span>
                </div>
                <div className="divide-y divide-slate-50 pt-1">
                  {cashAccounts.length === 0 ? (
                    <div className="py-2 text-[11px] text-slate-400">No cash accounts.</div>
                  ) : (
                    cashAccounts.map(a => {
                      const bal = latestAccBalances[a.id] || 0;
                      return (
                        <button
                          key={a.id}
                          onClick={() => onNavigateToAccount && onNavigateToAccount(a.id)}
                          className="w-full py-2 flex items-center justify-between text-left group hover:bg-slate-50 px-1.5 rounded transition"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="text-xs font-semibold text-slate-800 group-hover:text-teal-700 truncate">{a.name}</div>
                            <div className="text-[10px] text-slate-400 truncate">{a.institution}</div>
                          </div>
                          <div className="text-right shrink-0 flex items-center space-x-1">
                            <span className="text-xs font-bold text-slate-900">{formatCurrency(bal)}</span>
                            <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-teal-600" />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Brokerage Accounts Group */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider pb-1.5 border-b border-slate-100">
                  <span className="flex items-center space-x-1">
                    <LineChart className="w-3.5 h-3.5 text-blue-600 inline" />
                    <span>Brokerage & Equities</span>
                  </span>
                  <span className="text-slate-900 font-extrabold">{formatCurrency(totalBrokerage)}</span>
                </div>
                <div className="divide-y divide-slate-50 pt-1">
                  {brokerageAccounts.length === 0 ? (
                    <div className="py-2 text-[11px] text-slate-400">No brokerage accounts.</div>
                  ) : (
                    brokerageAccounts.map(a => {
                      const bal = latestAccBalances[a.id] || 0;
                      return (
                        <button
                          key={a.id}
                          onClick={() => onNavigateToAccount && onNavigateToAccount(a.id)}
                          className="w-full py-2 flex items-center justify-between text-left group hover:bg-slate-50 px-1.5 rounded transition"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="text-xs font-semibold text-slate-800 group-hover:text-blue-700 truncate">{a.name}</div>
                            <div className="text-[10px] text-slate-400 truncate">{a.institution}</div>
                          </div>
                          <div className="text-right shrink-0 flex items-center space-x-1">
                            <span className="text-xs font-bold text-slate-900">{formatCurrency(bal)}</span>
                            <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-blue-600" />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Credit Accounts Group */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider pb-1.5 border-b border-slate-100">
                  <span className="flex items-center space-x-1">
                    <CreditCard className="w-3.5 h-3.5 text-rose-600 inline" />
                    <span>Liabilities & Credit</span>
                  </span>
                  <span className="text-rose-600 font-extrabold">-{formatCurrency(totalCreditDebt)}</span>
                </div>
                <div className="divide-y divide-slate-50 pt-1">
                  {creditAccounts.length === 0 ? (
                    <div className="py-2 text-[11px] text-slate-400">No credit accounts.</div>
                  ) : (
                    creditAccounts.map(a => {
                      const rawBal = latestAccBalances[a.id] || 0;
                      const debtVal = Math.abs(rawBal);
                      return (
                        <button
                          key={a.id}
                          onClick={() => onNavigateToAccount && onNavigateToAccount(a.id)}
                          className="w-full py-2 flex items-center justify-between text-left group hover:bg-slate-50 px-1.5 rounded transition"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="text-xs font-semibold text-slate-800 group-hover:text-rose-700 truncate">{a.name}</div>
                            <div className="text-[10px] text-slate-400 truncate">{a.institution}</div>
                          </div>
                          <div className="text-right shrink-0 flex items-center space-x-1">
                            <span className="text-xs font-bold text-rose-600">-{formatCurrency(debtVal)}</span>
                            <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-rose-600" />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
