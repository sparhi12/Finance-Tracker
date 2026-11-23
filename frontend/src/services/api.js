const BASE_URL = '/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errMessage = 'An error occurred';
    try {
      const err = await response.json();
      errMessage = err.detail || err.message || response.statusText;
    } catch {
      errMessage = response.statusText;
    }
    throw new Error(errMessage);
  }

  return response.json();
}

export const api = {
  // Accounts
  getAccounts: (includeInactive = false) =>
    request(`/accounts?include_inactive=${includeInactive}`),
  createAccount: (data) =>
    request('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id, data) =>
    request(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccount: (id) =>
    request(`/accounts/${id}`, { method: 'DELETE' }),
  resetAllData: () =>
    request('/accounts/reset-data', { method: 'POST' }),

  // Snapshots & Review Template
  getReviewTemplate: () =>
    request('/snapshots/review-template'),
  saveBalanceSnapshot: (data) =>
    request('/snapshots/balance', { method: 'POST', body: JSON.stringify(data) }),
  saveBrokerageHoldings: (data) =>
    request('/snapshots/holdings', { method: 'POST', body: JSON.stringify(data) }),
  submitBulkReview: (data) =>
    request('/snapshots/bulk-review', { method: 'POST', body: JSON.stringify(data) }),
  getAccountSnapshotHistory: (accountId) =>
    request(`/snapshots/history/${accountId}`),
  deleteSnapshot: (accountId, asOfDate) =>
    request(`/snapshots/${accountId}/${asOfDate}`, { method: 'DELETE' }),

  // Market Prices
  refreshPrices: (tickers = null) =>
    request('/prices/refresh', {
      method: 'POST',
      body: JSON.stringify(tickers ? { tickers } : {}),
    }),
  getLatestPrices: () =>
    request('/prices/latest'),
  getPricesStatus: () =>
    request('/prices/status'),

  // Analytics & Net Worth
  getNetWorthAnalytics: (range = '1M', startDate = null, endDate = null) => {
    let query = `?range=${range}`;
    if (startDate) query += `&start_date=${startDate}`;
    if (endDate) query += `&end_date=${endDate}`;
    return request(`/analytics/net-worth${query}`);
  },
  getAccountAnalytics: (accountId, range = '1M', startDate = null, endDate = null) => {
    let query = `?range=${range}`;
    if (startDate) query += `&start_date=${startDate}`;
    if (endDate) query += `&end_date=${endDate}`;
    return request(`/analytics/account/${accountId}${query}`);
  },

  // Transactions
  getTransactions: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/transactions${q ? `?${q}` : ''}`);
  },
  createTransaction: (data) =>
    request('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  deleteTransaction: (id) =>
    request(`/transactions/${id}`, { method: 'DELETE' }),
  importTransactionsCsv: async (accountId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/transactions/import-csv/${accountId}`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) throw new Error('CSV Import failed');
    return res.json();
  },

  // Backups
  getBackups: () =>
    request('/backups'),
  createBackup: () =>
    request('/backups/create', { method: 'POST' }),
};
