import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Landmark, 
  LineChart, 
  CreditCard,
  Calendar,
  Sparkles,
  HelpCircle,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';

export default function DataEntryView({ onDataUpdated }) {
  const [template, setTemplate] = useState(null);
  const [globalDate, setGlobalDate] = useState(new Date().toISOString().split('T')[0]);
  const [formData, setFormData] = useState({
    cash: {},
    brokerage: {},
    credit: {}
  });
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Load review template
  const loadTemplate = async () => {
    try {
      const data = await api.getReviewTemplate();
      setTemplate(data);
      const today = data.today_date || new Date().toISOString().split('T')[0];
      setGlobalDate(today);

      // Pre-fill initial form state
      const initialCash = {};
      data.cash.forEach((acc) => {
        initialCash[acc.id] = {
          as_of_date: today,
          balance: acc.latest_balance ?? 0.0,
          note: acc.note || ''
        };
      });

      const initialBrokerage = {};
      data.brokerage.forEach((acc) => {
        initialBrokerage[acc.id] = {
          as_of_date: today,
          holdings: (acc.holdings && acc.holdings.length > 0)
            ? acc.holdings.map(h => ({ ...h }))
            : [{ ticker: 'CASH', asset_type: 'CASH', shares: 0.0, price: 1.0, market_value: 0.0 }]
        };
      });

      const initialCredit = {};
      data.credit.forEach((acc) => {
        initialCredit[acc.id] = {
          as_of_date: today,
          balance: acc.latest_balance ?? 0.0,
          note: acc.note || ''
        };
      });

      setFormData({
        cash: initialCash,
        brokerage: initialBrokerage,
        credit: initialCredit
      });
    } catch (err) {
      setErrorMessage('Failed to load accounts for data entry: ' + err.message);
    }
  };

  useEffect(() => {
    loadTemplate();
  }, []);

  const handleApplyGlobalDate = (newDate) => {
    setGlobalDate(newDate);
    setFormData((prev) => {
      const next = { ...prev };
      Object.keys(next.cash).forEach(id => { next.cash[id].as_of_date = newDate; });
      Object.keys(next.brokerage).forEach(id => { next.brokerage[id].as_of_date = newDate; });
      Object.keys(next.credit).forEach(id => { next.credit[id].as_of_date = newDate; });
      return next;
    });
  };

  // Cash / Credit field change
  const handleBalanceChange = (category, accId, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [accId]: {
          ...prev[category][accId],
          [field]: value
        }
      }
    }));
  };

  // Brokerage holdings change
  const handleBrokerageDateChange = (accId, dateVal) => {
    setFormData((prev) => ({
      ...prev,
      brokerage: {
        ...prev.brokerage,
        [accId]: {
          ...prev.brokerage[accId],
          as_of_date: dateVal
        }
      }
    }));
  };

  const handleBrokerageHoldingChange = (accId, index, field, value) => {
    setFormData((prev) => {
      const holdings = [...(prev.brokerage[accId]?.holdings || [])];
      const target = { ...holdings[index], [field]: value };
      if (field === 'shares') {
        const sh = parseFloat(value) || 0;
        target.market_value = Math.round(sh * (target.price || 1.0) * 100) / 100;
      }
      holdings[index] = target;
      return {
        ...prev,
        brokerage: {
          ...prev.brokerage,
          [accId]: {
            ...prev.brokerage[accId],
            holdings
          }
        }
      };
    });
  };

  const handleAddHolding = (accId) => {
    setFormData((prev) => {
      const holdings = [...(prev.brokerage[accId]?.holdings || [])];
      holdings.push({
        ticker: '',
        asset_type: 'EQUITY',
        shares: 0,
        price: 1.0,
        market_value: 0
      });
      return {
        ...prev,
        brokerage: {
          ...prev.brokerage,
          [accId]: {
            ...prev.brokerage[accId],
            holdings
          }
        }
      };
    });
  };

  const handleRemoveHolding = (accId, index) => {
    setFormData((prev) => {
      const holdings = [...(prev.brokerage[accId]?.holdings || [])];
      holdings.splice(index, 1);
      return {
        ...prev,
        brokerage: {
          ...prev.brokerage,
          [accId]: {
            ...prev.brokerage[accId],
            holdings
          }
        }
      };
    });
  };

  // Single Account Save
  const handleSaveSingleCashOrCredit = async (category, accId) => {
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');
    try {
      const item = formData[category][accId];
      await api.saveBalanceSnapshot({
        account_id: parseInt(accId),
        as_of_date: item.as_of_date,
        balance: parseFloat(item.balance) || 0,
        note: item.note
      });
      setSuccessMessage(`Saved snapshot for account #${accId}`);
      onDataUpdated();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save snapshot');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSingleBrokerage = async (accId) => {
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');
    try {
      const item = formData.brokerage[accId];
      const cleanHoldings = item.holdings
        .filter(h => h.ticker && h.ticker.trim())
        .map(h => ({
          ticker: h.ticker.trim().toUpperCase(),
          asset_type: h.ticker.trim().toUpperCase() === 'CASH' ? 'CASH' : h.asset_type,
          shares: parseFloat(h.shares) || 0
        }));

      await api.saveBrokerageHoldings({
        account_id: parseInt(accId),
        as_of_date: item.as_of_date,
        holdings: cleanHoldings
      });
      setSuccessMessage(`Saved holdings for brokerage account #${accId}`);
      onDataUpdated();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to save holdings');
    } finally {
      setSaving(false);
    }
  };

  // Save All (Bulk Review)
  const handleSaveAll = async () => {
    setSaving(true);
    setSuccessMessage('');
    setErrorMessage('');
    try {
      const batchItems = [];

      // Cash
      Object.keys(formData.cash).forEach((accId) => {
        const item = formData.cash[accId];
        batchItems.push({
          account_id: parseInt(accId),
          as_of_date: item.as_of_date,
          balance: parseFloat(item.balance) || 0,
          note: item.note
        });
      });

      // Credit
      Object.keys(formData.credit).forEach((accId) => {
        const item = formData.credit[accId];
        batchItems.push({
          account_id: parseInt(accId),
          as_of_date: item.as_of_date,
          balance: parseFloat(item.balance) || 0,
          note: item.note
        });
      });

      // Brokerage
      Object.keys(formData.brokerage).forEach((accId) => {
        const item = formData.brokerage[accId];
        const cleanHoldings = (item.holdings || [])
          .filter(h => h.ticker && h.ticker.trim())
          .map(h => ({
            ticker: h.ticker.trim().toUpperCase(),
            asset_type: h.ticker.trim().toUpperCase() === 'CASH' ? 'CASH' : h.asset_type,
            shares: parseFloat(h.shares) || 0
          }));
        batchItems.push({
          account_id: parseInt(accId),
          as_of_date: item.as_of_date,
          holdings: cleanHoldings
        });
      });

      await api.submitBulkReview({ items: batchItems });
      setSuccessMessage('Successfully saved all reviewed accounts!');
      onDataUpdated();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to submit bulk review');
    } finally {
      setSaving(false);
    }
  };

  if (!template) {
    return (
      <div className="p-12 text-center text-slate-500">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
        <span>Loading accounts...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Review Actions */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Frictionless Check-in & Review</h1>
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-teal-50 text-teal-700 rounded-full border border-teal-200">
              Pre-filled
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Pre-filled with latest known balances. Adjust changed numbers and click Save.
          </p>
        </div>

        {/* Global Date & Save All */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-slate-600 font-medium">Global As-Of Date:</span>
            <input
              type="date"
              value={globalDate}
              onChange={(e) => handleApplyGlobalDate(e.target.value)}
              className="bg-white px-2 py-0.5 border border-slate-200 rounded font-semibold text-slate-800"
            />
          </div>

          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center space-x-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save All Accounts'}</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMessage && (
        <div className="flex items-center space-x-2 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center space-x-2 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. Cash Accounts Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <Landmark className="w-5 h-5 text-teal-600" />
            <h2 className="font-bold text-slate-900 text-sm">Cash & Banking</h2>
            <span className="text-xs text-slate-500">({template.cash.length} accounts)</span>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {template.cash.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No cash accounts yet.</div>
          ) : (
            template.cash.map((acc) => {
              const currentItem = formData.cash[acc.id] || { as_of_date: globalDate, balance: 0, note: '' };
              return (
                <div key={acc.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition">
                  <div className="min-w-[200px]">
                    <div className="font-semibold text-slate-900 text-sm">{acc.name}</div>
                    <div className="text-xs text-slate-500">{acc.institution}</div>
                    {acc.latest_as_of_date && (
                      <div className="text-[11px] text-slate-400 mt-1">
                        Last saved: {acc.latest_as_of_date} (${acc.latest_balance?.toLocaleString()})
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* As of date */}
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase">As of Date</label>
                      <input
                        type="date"
                        value={currentItem.as_of_date}
                        onChange={(e) => handleBalanceChange('cash', acc.id, 'as_of_date', e.target.value)}
                        className="px-2.5 py-1 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-teal-500"
                      />
                    </div>

                    {/* Balance */}
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase">Balance ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentItem.balance}
                        onChange={(e) => handleBalanceChange('cash', acc.id, 'balance', e.target.value)}
                        className="w-32 px-2.5 py-1 text-xs font-semibold text-slate-900 border border-slate-200 rounded-md focus:ring-1 focus:ring-teal-500"
                      />
                    </div>

                    {/* Note */}
                    <div className="hidden lg:block">
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase">Note</label>
                      <input
                        type="text"
                        placeholder="Optional note"
                        value={currentItem.note}
                        onChange={(e) => handleBalanceChange('cash', acc.id, 'note', e.target.value)}
                        className="w-40 px-2.5 py-1 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-teal-500"
                      />
                    </div>

                    {/* Save Button */}
                    <div className="pt-3">
                      <button
                        onClick={() => handleSaveSingleCashOrCredit('cash', acc.id)}
                        disabled={saving}
                        className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-md text-xs font-semibold shadow-sm transition disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Brokerage Accounts Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <LineChart className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-900 text-sm">Brokerage & Investment Holdings</h2>
            <span className="text-xs text-slate-500">({template.brokerage.length} accounts)</span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {template.brokerage.length === 0 ? (
            <div className="text-center text-xs text-slate-400">No brokerage accounts yet.</div>
          ) : (
            template.brokerage.map((acc) => {
              const currentItem = formData.brokerage[acc.id] || { as_of_date: globalDate, holdings: [] };
              const holdings = currentItem.holdings || [];
              const totalBrokVal = holdings.reduce((sum, h) => sum + (h.market_value || 0), 0);

              return (
                <div key={acc.id} className="border border-slate-200 rounded-xl p-5 bg-slate-50/30 space-y-4">
                  {/* Brokerage Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-base">{acc.name}</span>
                        <span className="text-xs text-slate-500">({acc.institution})</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Current Account Value: <span className="font-bold text-teal-700">${totalBrokVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1.5 text-xs">
                        <label className="text-slate-500 font-medium">As of Date:</label>
                        <input
                          type="date"
                          value={currentItem.as_of_date}
                          onChange={(e) => handleBrokerageDateChange(acc.id, e.target.value)}
                          className="px-2 py-1 text-xs border border-slate-200 rounded-md bg-white focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                      <button
                        onClick={() => handleSaveSingleBrokerage(acc.id)}
                        disabled={saving}
                        className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-xs font-semibold shadow-sm transition disabled:opacity-50"
                      >
                        Save Holdings
                      </button>
                    </div>
                  </div>

                  {/* Holdings Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-slate-400 font-medium border-b border-slate-200">
                          <th className="pb-2">Asset Type</th>
                          <th className="pb-2">Ticker Symbol</th>
                          <th className="pb-2">Shares / Amount</th>
                          <th className="pb-2">Est. Price ($)</th>
                          <th className="pb-2">Market Value ($)</th>
                          <th className="pb-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {holdings.map((h, idx) => (
                          <tr key={idx} className="hover:bg-white transition">
                            <td className="py-2">
                              <select
                                value={h.asset_type}
                                onChange={(e) => handleBrokerageHoldingChange(acc.id, idx, 'asset_type', e.target.value)}
                                className="px-2 py-1 border border-slate-200 rounded bg-white text-xs"
                              >
                                <option value="EQUITY">Equity (Stock/ETF)</option>
                                <option value="CASH">Uninvested Cash</option>
                              </select>
                            </td>
                            <td className="py-2">
                              <input
                                type="text"
                                placeholder={h.asset_type === 'CASH' ? 'CASH' : 'e.g. VT, VTI'}
                                value={h.ticker}
                                disabled={h.asset_type === 'CASH'}
                                onChange={(e) => handleBrokerageHoldingChange(acc.id, idx, 'ticker', e.target.value.toUpperCase())}
                                className="w-28 px-2 py-1 border border-slate-200 rounded uppercase font-semibold text-xs"
                              />
                            </td>
                            <td className="py-2">
                              <input
                                type="number"
                                step="any"
                                placeholder="Shares"
                                value={h.shares}
                                onChange={(e) => handleBrokerageHoldingChange(acc.id, idx, 'shares', e.target.value)}
                                className="w-28 px-2 py-1 border border-slate-200 rounded font-semibold text-xs"
                              />
                            </td>
                            <td className="py-2 text-slate-500 font-medium">
                              ${(h.price ?? 1.0).toFixed(2)}
                            </td>
                            <td className="py-2 font-bold text-slate-800">
                              ${(h.market_value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 text-right">
                              <button
                                onClick={() => handleRemoveHolding(acc.id, idx)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                                title="Remove holding"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Add Holding Button */}
                  <button
                    onClick={() => handleAddHolding(acc.id)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Ticker / Holding</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Credit Accounts Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-rose-600" />
            <h2 className="font-bold text-slate-900 text-sm">Credit & Liabilities</h2>
            <span className="text-xs text-slate-500">({template.credit.length} accounts)</span>
          </div>
          <span className="text-[11px] text-slate-400 flex items-center space-x-1">
            <HelpCircle className="w-3 h-3 inline" />
            <span>Enter positive debt balance (e.g. $850) — auto-negated internally</span>
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {template.credit.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No credit accounts yet.</div>
          ) : (
            template.credit.map((acc) => {
              const currentItem = formData.credit[acc.id] || { as_of_date: globalDate, balance: 0, note: '' };
              return (
                <div key={acc.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition">
                  <div className="min-w-[200px]">
                    <div className="font-semibold text-slate-900 text-sm">{acc.name}</div>
                    <div className="text-xs text-slate-500">{acc.institution}</div>
                    {acc.latest_as_of_date && (
                      <div className="text-[11px] text-slate-400 mt-1">
                        Last saved: {acc.latest_as_of_date} (${acc.latest_balance?.toLocaleString()})
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* As of date */}
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase">As of Date</label>
                      <input
                        type="date"
                        value={currentItem.as_of_date}
                        onChange={(e) => handleBalanceChange('credit', acc.id, 'as_of_date', e.target.value)}
                        className="px-2.5 py-1 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-teal-500"
                      />
                    </div>

                    {/* Balance */}
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase">Current Debt ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentItem.balance}
                        onChange={(e) => handleBalanceChange('credit', acc.id, 'balance', e.target.value)}
                        className="w-32 px-2.5 py-1 text-xs font-semibold text-rose-600 border border-slate-200 rounded-md focus:ring-1 focus:ring-rose-500"
                      />
                    </div>

                    {/* Note */}
                    <div className="hidden lg:block">
                      <label className="block text-[10px] font-semibold text-slate-500 uppercase">Note</label>
                      <input
                        type="text"
                        placeholder="e.g. Statement balance"
                        value={currentItem.note}
                        onChange={(e) => handleBalanceChange('credit', acc.id, 'note', e.target.value)}
                        className="w-40 px-2.5 py-1 text-xs border border-slate-200 rounded-md focus:ring-1 focus:ring-teal-500"
                      />
                    </div>

                    {/* Save Button */}
                    <div className="pt-3">
                      <button
                        onClick={() => handleSaveSingleCashOrCredit('credit', acc.id)}
                        disabled={saving}
                        className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-md text-xs font-semibold shadow-sm transition disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
