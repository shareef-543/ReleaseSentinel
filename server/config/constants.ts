export const CONSTANTS = {
  APP_NAME: 'ReleaseSentinel Backend API',
  VERSION: '2.0.0',
  API_PREFIX: '/api/v1',
  DEFAULT_PAGE_LIMIT: 50,
  MAX_STORED_RECORDS: 500,
  GEMINI_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/models',
  CRITICAL_MODULES: ['payment-service', 'auth-service', 'checkout-service', 'order-service'],
  RISK_THRESHOLDS: {
    LOW: 35,
    MEDIUM: 60,
    HIGH: 80,
  },
};
