export const environment = {
  production: true,
  apiUrl: 'https://tu-dominio.com/api',
  appName: 'Sistema de Inventarios',
  appVersion: '1.0.0',
  defaultLanguage: 'es',
  supportedLanguages: ['es', 'en'],
  pagination: {
    defaultPageSize: 10,
    pageSizeOptions: [5, 10, 25, 50, 100]
  },
  dateFormat: 'dd/MM/yyyy',
  currency: 'USD',
  timezone: 'America/New_York',
  features: {
    darkMode: true,
    notifications: true,
    offline: true,
    pwa: true
  },
  auth: {
    tokenKey: 'auth_token',
    refreshTokenKey: 'refresh_token',
    userKey: 'user_data',
    tokenExpiryKey: 'token_expiry'
  },
  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    maxFiles: 5
  },
  charts: {
    colors: [
      '#3f51b5',
      '#ff4081',
      '#4caf50',
      '#ff9800',
      '#9c27b0',
      '#00bcd4',
      '#795548',
      '#607d8b'
    ]
  }
};
