import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AddAccountModal from './components/AddAccountModal';
import DashboardView from './pages/DashboardView';
import DataEntryView from './pages/DataEntryView';
import AccountsView from './pages/AccountsView';
import TransactionsView from './pages/TransactionsView';
import BackupsView from './pages/BackupsView';
import { api } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [accounts, setAccounts] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [selectedRange, setSelectedRange] = useState('3M');
  const [customDates, setCustomDates] = useState({
    startDate: '',
    endDate: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(true);
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);

  // Load accounts and net worth data
  const loadData = async (range = selectedRange, custom = customDates) => {
    try {
      const [accs, analytics] = await Promise.all([
        api.getAccounts(false),
        api.getNetWorthAnalytics(
          range,
          range === 'custom' ? custom.startDate : null,
          range === 'custom' ? custom.endDate : null
        )
      ]);
      setAccounts(accs);
      setAnalyticsData(analytics);
    } catch (err) {
      console.error('Error fetching finance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedRange, customDates);
  }, [selectedRange, customDates.startDate, customDates.endDate]);

  const handleRefreshPrices = async () => {
    setRefreshingPrices(true);
    try {
      await api.refreshPrices();
      await loadData(selectedRange, customDates);
    } catch (err) {
      alert('Price refresh warning: ' + (err.message || 'Check network connection'));
    } finally {
      setRefreshingPrices(false);
    }
  };

  const handleAccountCreated = async (accountPayload) => {
    await api.createAccount(accountPayload);
    await loadData(selectedRange, customDates);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Inter',sans-serif]">
      
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        netWorthSummary={analyticsData?.summary}
        onRefreshPrices={handleRefreshPrices}
        refreshingPrices={refreshingPrices}
        onOpenAddAccount={() => setIsAddAccountOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <DashboardView
            analyticsData={analyticsData}
            selectedRange={selectedRange}
            onRangeChange={setSelectedRange}
            customDates={customDates}
            onCustomDatesChange={setCustomDates}
            loading={loading}
          />
        )}

        {activeTab === 'data-entry' && (
          <DataEntryView
            onDataUpdated={() => loadData(selectedRange, customDates)}
          />
        )}

        {activeTab === 'accounts' && (
          <AccountsView
            accounts={accounts}
            onAccountUpdated={() => loadData(selectedRange, customDates)}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            accounts={accounts}
          />
        )}

        {activeTab === 'backups' && (
          <BackupsView />
        )}
      </main>

      {/* Add Account Modal */}
      <AddAccountModal
        isOpen={isAddAccountOpen}
        onClose={() => setIsAddAccountOpen(false)}
        onAccountCreated={handleAccountCreated}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Simplifi Local • Offline-First Personal Finance Tracker</span>
          <span className="font-mono text-[11px] text-slate-400">Database: D:\finance\finance.db</span>
        </div>
      </footer>

    </div>
  );
}
