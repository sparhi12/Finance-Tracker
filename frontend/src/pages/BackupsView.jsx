import React, { useState, useEffect } from 'react';
import { 
  Database, 
  ShieldCheck, 
  HardDrive, 
  Clock, 
  Download, 
  Plus, 
  RefreshCw, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';

export default function BackupsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadBackups = async () => {
    setLoading(true);
    try {
      const res = await api.getBackups();
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to fetch backups metadata');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    setMessage('');
    setError('');
    try {
      const res = await api.createBackup();
      setMessage(res.message || 'Backup created successfully');
      loadBackups();
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Database & Automatic Backups</h1>
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
              WAL Mode Enabled
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Local-first storage on secondary local drive with automatic pre-write snapshots
          </p>
        </div>

        <button
          onClick={handleCreateBackup}
          disabled={creating}
          className="flex items-center space-x-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>{creating ? 'Creating Snapshot...' : 'Create Snapshot Now'}</span>
        </button>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-medium flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Storage Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Primary DB */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <HardDrive className="w-4 h-4 text-teal-600" />
            <span>Primary SQLite DB</span>
          </div>
          <div className="font-mono text-xs font-bold text-slate-900 break-all bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            {data?.db_path || 'D:\\finance\\finance.db'}
          </div>
          <p className="text-[11px] text-slate-400">
            High performance WAL mode with concurrent read & write support
          </p>
        </div>

        {/* Backups Directory */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Database className="w-4 h-4 text-blue-600" />
            <span>Backup Directory</span>
          </div>
          <div className="font-mono text-xs font-bold text-slate-900 break-all bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            {data?.backup_dir || 'D:\\finance\\backups'}
          </div>
          <p className="text-[11px] text-slate-400">
            Snapshots triggered before write operations & CSV imports
          </p>
        </div>

        {/* Retention Policy */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Retention Policy</span>
          </div>
          <div className="text-sm font-bold text-slate-900 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            Retain last {data?.max_backups || 30} snapshots
          </div>
          <p className="text-[11px] text-slate-400">
            Older snapshots beyond the threshold are automatically pruned
          </p>
        </div>

      </div>

      {/* Backups List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="font-bold text-slate-900 text-sm">
            Saved Database Snapshots ({data?.backups?.length || 0})
          </h2>
          <button
            onClick={loadBackups}
            className="text-xs text-teal-600 hover:text-teal-700 font-semibold flex items-center space-x-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-medium">
                <th className="py-3 px-6">Filename</th>
                <th className="py-3 px-6">Created Timestamp</th>
                <th className="py-3 px-6">File Size</th>
                <th className="py-3 px-6 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(!data?.backups || data.backups.length === 0) ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    No snapshots created yet. Snapshots are created automatically before write operations.
                  </td>
                </tr>
              ) : (
                data.backups.map((b, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-6 font-mono font-semibold text-slate-900">{b.filename}</td>
                    <td className="py-3 px-6 text-slate-500">{new Date(b.created_at).toLocaleString()}</td>
                    <td className="py-3 px-6 text-slate-600 font-medium">{formatFileSize(b.size_bytes)}</td>
                    <td className="py-3 px-6 text-right">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-200">
                        Available
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
