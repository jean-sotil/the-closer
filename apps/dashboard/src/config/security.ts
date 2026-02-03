/**
 * Security Configuration
 *
 * Centralized security settings for The Closer dashboard.
 * Implements OWASP security best practices.
 */

// Allowed origins for CORS
export const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  // Add production domains here
  import.meta.env['VITE_APP_URL'],
].filter(Boolean) as string[];

// Content Security Policy directives
export const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "'unsafe-inline'", // Required for Vite HMR in development
    "'unsafe-eval'", // Required for Vite in development
  ],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:", "https:", "blob:"],
  fontSrc: ["'self'", "data:"],
  connectSrc: [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://api.mailgun.net",
  ],
  frameSrc: ["'none'"],
  objectSrc: ["'none'"],
  upgradeInsecureRequests: import.meta.env.MODE === 'production' ? [] : null,
};

// Security headers configuration
export const SECURITY_HEADERS = {
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',

  // Prevent MIME sniffing
  'X-Content-Type-Options': 'nosniff',

  // Enable XSS protection
  'X-XSS-Protection': '1; mode=block',

  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions policy
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',

  // HSTS (Strict Transport Security)
  ...(import.meta.env.MODE === 'production' && {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  }),
};

// Rate limiting configuration
export const RATE_LIMIT_CONFIG = {
  // Global rate limit
  global: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window
  },

  // Auth endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    skipSuccessfulRequests: false,
  },

  // API endpoints
  api: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
  },

  // Email sending
  email: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // 100 emails per hour
  },
};

// Password validation rules
export const PASSWORD_RULES = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

// Password strength regex
export const PASSWORD_REGEX = new RegExp(
  `^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[${PASSWORD_RULES.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}])[A-Za-z\\d${PASSWORD_RULES.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]{${PASSWORD_RULES.minLength},${PASSWORD_RULES.maxLength}}$`
);

// Account lockout configuration
export const ACCOUNT_LOCKOUT_CONFIG = {
  maxFailedAttempts: 5,
  lockoutDurationMs: 15 * 60 * 1000, // 15 minutes
  resetAttemptsAfterMs: 60 * 60 * 1000, // 1 hour
};

// Session configuration
export const SESSION_CONFIG = {
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  refreshThreshold: 30 * 60 * 1000, // Refresh if < 30 minutes remaining
  absoluteTimeout: 7 * 24 * 60 * 60 * 1000, // 7 days absolute maximum
};

// CSRF token configuration
export const CSRF_CONFIG = {
  tokenLength: 32,
  cookieName: 'XSRF-TOKEN',
  headerName: 'X-XSRF-TOKEN',
  cookieOptions: {
    httpOnly: true,
    secure: import.meta.env.MODE === 'production',
    sameSite: 'strict' as const,
    maxAge: SESSION_CONFIG.maxAge,
  },
};

// Input validation patterns
export const VALIDATION_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[\d\s\-()]+$/,
  url: /^https?:\/\/.+/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
};

// Sensitive data patterns (for logging sanitization)
export const SENSITIVE_PATTERNS = {
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  password: /password|pwd|passwd/gi,
  apiKey: /api[_-]?key|bearer|token/gi,
};

/**
 * Sanitize error messages to remove sensitive data
 */
export function sanitizeErrorMessage(message: string): string {
  let sanitized = message;

  Object.entries(SENSITIVE_PATTERNS).forEach(([_type, pattern]) => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });

  return sanitized;
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < PASSWORD_RULES.minLength) {
    errors.push(`Password must be at least ${PASSWORD_RULES.minLength} characters`);
  }

  if (password.length > PASSWORD_RULES.maxLength) {
    errors.push(`Password must not exceed ${PASSWORD_RULES.maxLength} characters`);
  }

  if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_RULES.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (PASSWORD_RULES.requireSpecialChars) {
    const specialCharRegex = new RegExp(`[${PASSWORD_RULES.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`);
    if (!specialCharRegex.test(password)) {
      errors.push(`Password must contain at least one special character (${PASSWORD_RULES.specialChars})`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}
