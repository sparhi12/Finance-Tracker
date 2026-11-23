import React from 'react';
import { 
  TrendingUp, 
  Wallet, 
  Layers, 
  Receipt, 
  Database, 
  RefreshCw, 
  Plus,
  ShieldCheck
} from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  netWorthSummary, 
  onRefreshPrices, 
  refreshingPrices,
  onOpenAddAccount 
}) {
  const formatMoney = (val) => {
    if (val === undefined || val === null) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val);
  };

  const navItems = [
    { id: 'dashboard', label: 'Net Worth', icon: TrendingUp },
    { id: 'data-entry', label: 'Data Entry', icon: Wallet },
    { id: 'accounts', label: 'Accounts', icon: Layers },
    { id: 'transactions', label: 'Transactions', icon: Receipt },
    { id: 'backups', label: 'Backups & Storage', icon: Database },
  ];

  const nw = netWorthSummary?.current_net_worth ?? 0;
  const periodChg = netWorthSummary?.period_change_dollars ?? 0;
  const periodPct = netWorthSummary?.period_change_percent ?? 0;
  const isPositive = periodChg >= 0;

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold shadow-sm">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 text-lg tracking-tight">Simplifi</span>
                <span className="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full border border-teal-200">
                  Local
                </span>
              </div>
              <div className="flex items-center space-x-1 text-[11px] text-slate-500">
                <ShieldCheck className="w-3 h-3 text-emerald-600 inline" />
                <span>D:\finance\ • Offline Ready</span>
              </div>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-teal-50 text-teal-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Action Bar */}
          <div className="flex items-center space-x-3">
            {/* Quick Net Worth Ticker */}
            <div className="hidden lg:flex flex-col text-right pr-2 border-r border-slate-200">
              <span className="text-xs text-slate-500 font-medium">Net Worth</span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-base font-bold text-slate-900">{formatMoney(nw)}</span>
                <span className={`text-xs font-semibold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isPositive ? '+' : ''}{periodPct}%
                </span>
              </div>
            </div>

            {/* Refresh Prices Button */}
            <button
              onClick={onRefreshPrices}
              disabled={refreshingPrices}
              title="Sync latest market closing prices via yfinance"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-medium shadow-sm transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-600 ${refreshingPrices ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Prices</span>
            </button>

            {/* Add Account Button */}
            <button
              onClick={onOpenAddAccount}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Account</span>
            </button>
          </div>

        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex overflow-x-auto py-2 border-t border-slate-100 space-x-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                  isActive
                    ? 'bg-teal-50 text-teal-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
