import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  Landmark, 
  LineChart, 
  CreditCard, 
  Plus, 
  Trash2, 
  Save, 
  Upload, 
  Search, 
  Calendar, 
  CheckCircle, 
  AlertCircle, 
  HelpCircle,
  Building2,
  Clock,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { api } from '../services/api';

export default function DataInputView({ 
  accounts, 
  initialAccountId = null, 
  onDataUpdated, 
  onOpenAddAccount 
}) {
  const [selectedAccountId, setSelectedAccountId] = useState(
    initialAccountId || accounts[0]?.id || null
  );

  const [activeAccount, setActiveAccount] = useState(null);
  const [todayDate] = useState(new Date().toISOString().split('T')[0]);

  // Balance form state for CASH & CREDIT
  const [balanceForm, setBalanceForm] = useState({
    as_of_date: todayDate,
    balance: '',
    note: ''
  });

  // Holdings state for BROKERAGE
  const [holdingsDate, setHoldingsDate] = useState(todayDate);
  const [holdings, setHoldings] = useState([]);

  // Transactions state for this account
  const [transactions, setTransactions] = useState([]);
  const [txSearch, setTxSearch] = useState('');
  const [showAddTxModal, setShowAddTxModal] = useState(false);
  const [showImportCsvModal, setShowImportCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [newTx, setNewTx] = useState({
    date: todayDate,
    merchant: '',
    amount: '',
    category: 'General',
    is_transfer: false,
    note: ''
  });

  // Snapshot history state
  const [snapshotHistory, setSnapshotHistory] = useState([]);

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Keep selectedAccountId synced with accounts list
  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    } else if (initialAccountId) {
      setSelectedAccountId(initialAccountId);
    }
  }, [accounts, initialAccountId]);

  // Load account data when selectedAccountId changes
  const loadAccountDetails = async (accId) => {
    if (!accId) return;
    const acc = accounts.find(a => a.id === accId);
    setActiveAccount(acc || null);

    try {
      // 1. Load snapshots history
      const hist = await api.getAccountSnapshotHistory(accId);
      setSnapshotHistory(hist.snapshots || []);

      // 2. Pre-fill balance form or holdings
      if (acc?.type in { CASH: 1, CREDIT: 1 }) {
        const latestSnap = hist.snapshots?.[0];
        setBalanceForm({
          as_of_date: todayDate,
          balance: latestSnap ? (acc.type === 'CREDIT' ? Math.abs(latestSnap.balance) : latestSnap.balance) : 0,
          note: latestSnap?.note || ''
        });
      } else if (acc?.type === 'BROKERAGE') {
        const latestBrokSnap = hist.snapshots?.[0];
        if (latestBrokSnap && latestBrokSnap.holdings) {
          setHoldingsDate(todayDate);
          setHoldings(latestBrokSnap.holdings.map(h => ({
            ticker: h.ticker,
            asset_type: h.asset_type,
            shares: h.shares,
            price: 1.0,
            market_value: h.shares
          })));
        } else {
          setHoldingsDate(todayDate);
          setHoldings([
            { ticker: 'CASH', asset_type: 'CASH', shares: 0.0, price: 1.0, market_value: 0.0 }
          ]);
        }
      }

      // 3. Load transactions for this account
      loadAccountTransactions(accId);
    } catch (err) {
      console.error(err);
    }
  };

  const loadAccountTransactions = async (accId, search = txSearch) => {
    try {
      const params = { account_id: accId };
      if (search) params.search = search;
      const txs = await api.getTransactions(params);
      setTransactions(txs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedAccountId) {
      loadAccountDetails(selectedAccountId);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    if (selectedAccountId) {
      loadAccountTransactions(selectedAccountId, txSearch);
    }
  }, [txSearch]);

  const showBanner = (msg, isErr = false) => {
    if (isErr) {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(''), 4000);
    } else {
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(''), 3500);
    }
  };

  // Save Balance (Cash / Credit)
  const handleSaveBalance = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.saveBalanceSnapshot({
        account_id: selectedAccountId,
        as_of_date: balanceForm.as_of_date,
        balance: parseFloat(balanceForm.balance) || 0,
        note: balanceForm.note
      });
      showBanner(`Updated balance for ${activeAccount?.name}`);
      onDataUpdated();
      loadAccountDetails(selectedAccountId);
    } catch (err) {
      showBanner(err.message || 'Failed to save snapshot', true);
    } finally {
      setSaving(false);
    }
  };

  // Holdings functions (Brokerage)
  const handleAddHolding = () => {
    setHoldings(prev => [
      ...prev,
      { ticker: '', asset_type: 'EQUITY', shares: 0, price: 1.0, market_value: 0 }
    ]);
  };

  const handleUpdateHolding = (idx, field, value) => {
    setHoldings(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      if (field === 'shares') {
        const sh = parseFloat(value) || 0;
        copy[idx].market_value = sh * (copy[idx].price || 1.0);
      }
      return copy;
    });
  };

  const handleRemoveHolding = (idx) => {
    setHoldings(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveHoldings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cleanHoldings = holdings
        .filter(h => h.ticker && h.ticker.trim())
        .map(h => ({
          ticker: h.ticker.trim().toUpperCase(),
          asset_type: h.ticker.trim().toUpperCase() === 'CASH' ? 'CASH' : h.asset_type,
          shares: parseFloat(h.shares) || 0
        }));

      await api.saveBrokerageHoldings({
        account_id: selectedAccountId,
        as_of_date: holdingsDate,
        holdings: cleanHoldings
      });

      showBanner(`Updated holdings for ${activeAccount?.name}`);
      onDataUpdated();
      loadAccountDetails(selectedAccountId);
    } catch (err) {
      showBanner(err.message || 'Failed to save holdings', true);
    } finally {
      setSaving(false);
    }
  };

  // Create Transaction
  const handleCreateTransaction = async (e) => {
    e.preventDefault();
    try {
      await api.createTransaction({
        account_id: selectedAccountId,
        date: newTx.date,
        merchant: newTx.merchant.trim(),
        amount: parseFloat(newTx.amount) || 0,
        category: newTx.category.trim() || 'General',
        is_transfer: newTx.is_transfer,
        note: newTx.note
      });
      setShowAddTxModal(false);
      setNewTx({
        date: todayDate,
        merchant: '',
        amount: '',
        category: 'General',
        is_transfer: false,
        note: ''
      });
      showBanner('Transaction added successfully');
      loadAccountTransactions(selectedAccountId);
      onDataUpdated();
    } catch (err) {
      alert(err.message || 'Failed to add transaction');
    }
  };

  // Delete Transaction
  const handleDeleteTransaction = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await api.deleteTransaction(id);
      showBanner('Transaction deleted');
      loadAccountTransactions(selectedAccountId);
      onDataUpdated();
    } catch (err) {
      alert(err.message || 'Failed to delete transaction');
    }
  };

  // CSV Import
  const handleImportCsv = async (e) => {
    e.preventDefault();
    if (!csvFile) {
      alert('Please select a CSV file');
      return;
    }
    try {
      const res = await api.importTransactionsCsv(selectedAccountId, csvFile);
      setShowImportCsvModal(false);
      setCsvFile(null);
      showBanner(res.message || 'CSV imported successfully!');
      loadAccountTransactions(selectedAccountId);
      onDataUpdated();
    } catch (err) {
      alert(err.message || 'CSV import failed');
    }
  };

  // Delete Snapshot
  const handleDeleteSnapshot = async (dateStr) => {
    if (!window.confirm(`Delete snapshot for date ${dateStr}?`)) return;
    try {
      await api.deleteSnapshot(selectedAccountId, dateStr);
      showBanner(`Deleted snapshot for ${dateStr}`);
      onDataUpdated();
      loadAccountDetails(selectedAccountId);
    } catch (err) {
      alert(err.message || 'Failed to delete snapshot');
    }
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(val);
  };

  const getAccountIcon = (type) => {
    if (type === 'CASH') return Landmark;
    if (type === 'BROKERAGE') return LineChart;
    return CreditCard;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      
      {/* Left Column: Account Selector */}
      <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-fit">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900 text-sm">Select Account</h2>
            <p className="text-[11px] text-slate-500">Add or update entries per account</p>
          </div>
          <button
            onClick={onOpenAddAccount}
            className="p-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition"
            title="Add New Account"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
          {accounts.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No accounts found. Click + to add your first account.
            </div>
          ) : (
            accounts.map((acc) => {
              const Icon = getAccountIcon(acc.type);
              const isSelected = acc.id === selectedAccountId;
              const isCredit = acc.type === 'CREDIT';
              return (
                <button
                  key={acc.id}
                  onClick={() => setSelectedAccountId(acc.id)}
                  className={`w-full p-3.5 text-left flex items-start space-x-3 transition ${
                    isSelected
                      ? 'bg-teal-50/70 border-l-4 border-teal-600'
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
                    <div className={`text-xs font-bold mt-1 ${isCredit ? 'text-rose-600' : 'text-slate-900'}`}>
                      {formatCurrency(acc.latest_balance)}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Unified Data Input for Selected Account */}
      <div className="lg:col-span-3 space-y-6">
        
        {/* Banner feedback */}
        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center space-x-2 animate-in fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium flex items-center space-x-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {activeAccount ? (
          <>
            {/* Account Header */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{activeAccount.name}</h1>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    activeAccount.type === 'CASH' ? 'bg-teal-50 text-teal-700 border border-teal-200' :
                    activeAccount.type === 'BROKERAGE' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                    'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {activeAccount.type}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Institution: <span className="font-semibold text-slate-700">{activeAccount.institution}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-semibold text-slate-400 uppercase">Current Balance</span>
                <div className={`text-xl font-extrabold ${activeAccount.type === 'CREDIT' ? 'text-rose-600' : 'text-slate-900'}`}>
                  {formatCurrency(activeAccount.latest_balance)}
                </div>
              </div>
            </div>

            {/* SECTION 1: BALANCE / HOLDINGS INPUT */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="font-bold text-slate-900 text-sm">
                  {activeAccount.type === 'BROKERAGE' ? 'Investment Holdings & Cash Balance' : 'Account Balance Snapshot'}
                </h2>
                <span className="text-[11px] text-slate-400">
                  {activeAccount.type === 'CREDIT' ? 'Enter debt amount (auto-negated internally)' : 'Enter current account total'}
                </span>
              </div>

              {/* CASH / CREDIT FORM */}
              {activeAccount.type in { CASH: 1, CREDIT: 1 } && (
                <form onSubmit={handleSaveBalance} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">As of Date</label>
                      <input
                        type="date"
                        value={balanceForm.as_of_date}
                        onChange={(e) => setBalanceForm({ ...balanceForm, as_of_date: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                        {activeAccount.type === 'CREDIT' ? 'Current Debt ($)' : 'Current Balance ($)'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={balanceForm.balance}
                        onChange={(e) => setBalanceForm({ ...balanceForm, balance: e.target.value })}
                        className="w-full px-3 py-2 text-xs font-semibold text-slate-900 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Note (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Monthly statement check-in"
                        value={balanceForm.note}
                        onChange={(e) => setBalanceForm({ ...balanceForm, note: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center space-x-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saving ? 'Saving...' : 'Save Balance Snapshot'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* BROKERAGE HOLDINGS FORM */}
              {activeAccount.type === 'BROKERAGE' && (
                <form onSubmit={handleSaveHoldings} className="space-y-4">
                  <div className="flex items-center space-x-3 text-xs">
                    <label className="font-semibold text-slate-600">As of Date:</label>
                    <input
                      type="date"
                      value={holdingsDate}
                      onChange={(e) => setHoldingsDate(e.target.value)}
                      className="px-2.5 py-1 border border-slate-200 rounded-lg"
                      required
                    />
                  </div>

                  {/* Holdings Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 font-semibold border-b border-slate-200">
                          <th className="pb-2">Asset Type</th>
                          <th className="pb-2">Ticker Symbol</th>
                          <th className="pb-2">Shares / Amount</th>
                          <th className="pb-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {holdings.map((h, idx) => (
                          <tr key={idx}>
                            <td className="py-2">
                              <select
                                value={h.asset_type}
                                onChange={(e) => handleUpdateHolding(idx, 'asset_type', e.target.value)}
                                className="px-2 py-1 border border-slate-200 rounded text-xs bg-white"
                              >
                                <option value="EQUITY">Equity (Stock/ETF)</option>
                                <option value="CASH">Uninvested Cash</option>
                              </select>
                            </td>
                            <td className="py-2">
                              <input
                                type="text"
                                placeholder={h.asset_type === 'CASH' ? 'CASH' : 'e.g. VT, VTI, AAPL'}
                                value={h.ticker}
                                disabled={h.asset_type === 'CASH'}
                                onChange={(e) => handleUpdateHolding(idx, 'ticker', e.target.value.toUpperCase())}
                                className="w-28 px-2 py-1 border border-slate-200 rounded uppercase font-semibold text-xs"
                              />
                            </td>
                            <td className="py-2">
                              <input
                                type="number"
                                step="any"
                                placeholder="Shares"
                                value={h.shares}
                                onChange={(e) => handleUpdateHolding(idx, 'shares', e.target.value)}
                                className="w-32 px-2 py-1 border border-slate-200 rounded font-semibold text-xs"
                              />
                            </td>
                            <td className="py-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveHolding(idx)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                                title="Remove row"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handleAddHolding}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Ticker / Holding</span>
                    </button>

                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center space-x-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saving ? 'Saving...' : 'Save Holdings'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* SECTION 2: TRANSACTIONS FOR THIS ACCOUNT */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">Transactions ({transactions.length})</h2>
                  <p className="text-[11px] text-slate-500">Statement entries and cash flows for this account</p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowImportCsvModal(true)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-sm transition"
                  >
                    <Upload className="w-3.5 h-3.5 text-teal-600" />
                    <span>Import CSV</span>
                  </button>

                  <button
                    onClick={() => setShowAddTxModal(true)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Transaction</span>
                  </button>
                </div>
              </div>

              {/* Transactions search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search merchant or category..."
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* Transactions Table */}
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 font-semibold border-b border-slate-200 sticky top-0 bg-white">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Merchant / Payee</th>
                      <th className="pb-2">Category</th>
                      <th className="pb-2 text-right">Amount</th>
                      <th className="pb-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                          No transactions found for this account.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((t) => {
                        const isOutflow = t.amount < 0;
                        return (
                          <tr key={t.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 font-medium text-slate-600">{t.date}</td>
                            <td className="py-2.5 font-semibold text-slate-900">{t.merchant}</td>
                            <td className="py-2.5">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium text-[10px]">
                                {t.category}
                              </span>
                            </td>
                            <td className={`py-2.5 font-bold text-right ${isOutflow ? 'text-slate-900' : 'text-emerald-600'}`}>
                              {formatCurrency(t.amount)}
                            </td>
                            <td className="py-2.5 text-right">
                              <button
                                onClick={() => handleDeleteTransaction(t.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION 3: RECENT SNAPSHOT HISTORY */}
            {snapshotHistory.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-500">
                  Historical Balance Snapshots
                </h3>
                <div className="overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 font-semibold border-b border-slate-200">
                        <th className="pb-2">As of Date</th>
                        <th className="pb-2">Balance / Holdings Summary</th>
                        <th className="pb-2">Note</th>
                        <th className="pb-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {snapshotHistory.map((s, idx) => {
                        const d = s.as_of_date;
                        const balText = activeAccount.type === 'BROKERAGE'
                          ? `${s.holdings?.length || 0} holdings recorded`
                          : formatCurrency(s.balance);

                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2 font-semibold text-slate-800">{d}</td>
                            <td className="py-2 font-bold text-slate-900">{balText}</td>
                            <td className="py-2 text-slate-500 text-[11px]">{s.note || '—'}</td>
                            <td className="py-2 text-right">
                              <button
                                onClick={() => handleDeleteSnapshot(d)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded"
                                title="Delete snapshot"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white p-12 rounded-xl border border-slate-200 text-center text-slate-400">
            Select an account from the left column to view and update its entries.
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      {showAddTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in">
            <h3 className="font-bold text-slate-900 text-base mb-1">Add Transaction</h3>
            <p className="text-xs text-slate-500 mb-4">Adding to: <span className="font-semibold text-slate-800">{activeAccount?.name}</span></p>

            <form onSubmit={handleCreateTransaction} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={newTx.date}
                  onChange={(e) => setNewTx({ ...newTx, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Merchant / Payee</label>
                <input
                  type="text"
                  placeholder="e.g. Trader Joe's, Paycheck, Gas"
                  value={newTx.merchant}
                  onChange={(e) => setNewTx({ ...newTx, merchant: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Amount ($) — Negative for outflow/expense (e.g. -50.00), positive for inflow
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="-50.00"
                  value={newTx.amount}
                  onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <input
                  type="text"
                  placeholder="e.g. Groceries, Utilities, Salary"
                  value={newTx.category}
                  onChange={(e) => setNewTx({ ...newTx, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddTxModal(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg shadow-sm"
                >
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in">
            <h3 className="font-bold text-slate-900 text-base mb-1">Import Statement CSV</h3>
            <p className="text-xs text-slate-500 mb-4">
              Import transactions into <span className="font-semibold text-slate-800">{activeAccount?.name}</span>. Columns for Date, Payee/Merchant, and Amount will be mapped automatically.
            </p>

            <form onSubmit={handleImportCsv} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files[0])}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowImportCsvModal(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg shadow-sm"
                >
                  Start Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
