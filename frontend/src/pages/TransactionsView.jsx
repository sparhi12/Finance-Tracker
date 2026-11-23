import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  Plus, 
  Upload, 
  Search, 
  Filter, 
  Trash2, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import { api } from '../services/api';

export default function TransactionsView({ accounts }) {
  const [transactions, setTransactions] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importAccountId, setImportAccountId] = useState(accounts[0]?.id || '');
  const [importFile, setImportFile] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  // Add Form state
  const [newTx, setNewTx] = useState({
    account_id: accounts[0]?.id || '',
    date: new Date().toISOString().split('T')[0],
    merchant: '',
    amount: '',
    category: 'Groceries',
    is_transfer: false,
    note: ''
  });

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedAccountId) params.account_id = selectedAccountId;
      if (search) params.search = search;
      const data = await api.getTransactions(params);
      setTransactions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [selectedAccountId, search]);

  const handleCreateTx = async (e) => {
    e.preventDefault();
    try {
      await api.createTransaction({
        ...newTx,
        account_id: parseInt(newTx.account_id),
        amount: parseFloat(newTx.amount)
      });
      setShowAddModal(false);
      setNewTx({
        account_id: accounts[0]?.id || '',
        date: new Date().toISOString().split('T')[0],
        merchant: '',
        amount: '',
        category: 'Groceries',
        is_transfer: false,
        note: ''
      });
      loadTransactions();
      setStatusMessage('Transaction added successfully!');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      alert(err.message || 'Failed to create transaction');
    }
  };

  const handleDeleteTx = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await api.deleteTransaction(id);
      loadTransactions();
    } catch (err) {
      alert(err.message || 'Failed to delete transaction');
    }
  };

  const handleImportCsv = async (e) => {
    e.preventDefault();
    if (!importFile || !importAccountId) {
      alert('Please select both an account and a CSV file');
      return;
    }
    try {
      const res = await api.importTransactionsCsv(importAccountId, importFile);
      setShowImportModal(false);
      setImportFile(null);
      loadTransactions();
      setStatusMessage(res.message || 'CSV imported successfully!');
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to import CSV');
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2
    }).format(val);
  };

  const accountMap = {};
  accounts.forEach(a => { accountMap[a.id] = a.name; });

  return (
    <div className="space-y-6">
      
      {/* Header & Action Controls */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Transactions & Statement Import</h1>
          <p className="text-xs text-slate-500">
            Log manual transactions or import bank and credit card CSV statements
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition"
          >
            <Upload className="w-3.5 h-3.5 text-teal-600" />
            <span>Import CSV</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-xs">
        {/* Account Filter */}
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 font-medium"
          >
            <option value="">All Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.institution})</option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search merchant or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/70 text-slate-500 font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Account</th>
                <th className="py-3 px-4">Merchant / Payee</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No transactions found. Click "Add Transaction" or "Import CSV" to start.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => {
                  const isOutflow = t.amount < 0;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-4 font-medium text-slate-600">{t.date}</td>
                      <td className="py-3 px-4 text-slate-500 font-medium">{accountMap[t.account_id] || `#${t.account_id}`}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{t.merchant}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium text-[11px]">
                          {t.category}
                        </span>
                      </td>
                      <td className={`py-3 px-4 font-bold text-right ${isOutflow ? 'text-slate-900' : 'text-emerald-600'}`}>
                        {formatCurrency(t.amount)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteTx(t.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                          title="Delete transaction"
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

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="font-bold text-slate-900 text-base mb-4">Add Manual Transaction</h3>
            <form onSubmit={handleCreateTx} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account</label>
                <select
                  value={newTx.account_id}
                  onChange={(e) => setNewTx({ ...newTx, account_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  required
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.institution})</option>
                  ))}
                </select>
              </div>

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
                  placeholder="e.g. Trader Joe's, Paycheck, Shell Gas"
                  value={newTx.merchant}
                  onChange={(e) => setNewTx({ ...newTx, merchant: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Amount ($) — Use negative for expenses (e.g. -45.50), positive for income
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
                  placeholder="e.g. Groceries, Utilities, Salary, Travel"
                  value={newTx.category}
                  onChange={(e) => setNewTx({ ...newTx, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="font-bold text-slate-900 text-base mb-2">Import Statement CSV</h3>
            <p className="text-xs text-slate-500 mb-4">
              Upload a standard bank or credit card CSV file. Columns Date, Merchant/Payee, and Amount will be mapped automatically.
            </p>
            <form onSubmit={handleImportCsv} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Account</label>
                <select
                  value={importAccountId}
                  onChange={(e) => setImportAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                  required
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.institution})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">CSV File</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setImportFile(e.target.files[0])}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
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
