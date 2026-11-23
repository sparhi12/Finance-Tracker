import React, { useState } from 'react';
import { X, Building2, CreditCard, Landmark, LineChart } from 'lucide-react';

export default function AddAccountModal({ isOpen, onClose, onAccountCreated }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('CASH');
  const [institution, setInstitution] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !institution.trim()) {
      setError('Please provide both account name and institution');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onAccountCreated({
        name: name.trim(),
        type,
        institution: institution.trim(),
        is_active: true
      });
      setName('');
      setInstitution('');
      setType('CASH');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const accountTypes = [
    { id: 'CASH', label: 'Cash & Banking', desc: 'Checking, High-Yield Savings, Money Market', icon: Landmark },
    { id: 'BROKERAGE', label: 'Brokerage & Investments', desc: 'Taxable, IRA, 401(k), Equity Portfolios', icon: LineChart },
    { id: 'CREDIT', label: 'Credit & Debt', desc: 'Credit Cards, Lines of Credit, Auto Loans', icon: CreditCard }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-teal-600" />
            <h3 className="font-semibold text-slate-900 text-base">Add New Account</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Account Type Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Account Type
            </label>
            <div className="space-y-2">
              {accountTypes.map((t) => {
                const Icon = t.icon;
                const isSelected = type === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id)}
                    className={`w-full flex items-start space-x-3 p-3 rounded-lg border text-left transition ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50/50 ring-1 ring-teal-500'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mt-0.5 ${isSelected ? 'text-teal-600' : 'text-slate-400'}`} />
                    <div>
                      <div className={`text-sm font-semibold ${isSelected ? 'text-teal-900' : 'text-slate-800'}`}>
                        {t.label}
                      </div>
                      <div className="text-xs text-slate-500">{t.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Institution */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Financial Institution
            </label>
            <input
              type="text"
              placeholder="e.g. Vanguard, Chase, Marcus, Fidelity"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              required
            />
          </div>

          {/* Account Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Account Name / Nickname
            </label>
            <input
              type="text"
              placeholder="e.g. Primary Checking, Taxable Brokerage, Sapphire Card"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              required
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Create Account'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
