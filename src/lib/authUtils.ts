// Password validation
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!password) {
    errors.push('Password is required');
  } else if (password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Email validation
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Login form validation
export function validateLoginForm(email: string, password: string): {
  valid: boolean;
  errors: { email?: string; password?: string };
} {
  const errors: { email?: string; password?: string } = {};

  if (!email) {
    errors.email = 'Email is required';
  } else if (!validateEmail(email)) {
    errors.email = 'Please enter a valid email address';
  }

  if (!password) {
    errors.password = 'Password is required';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

// Parse auth error messages
export function parseAuthError(error: unknown): string {
  const errorMessage = (error as { message?: string })?.message || (error as { toString?: () => string })?.toString?.() || 'Login failed';

  if (errorMessage.includes('Invalid login credentials')) {
    return 'Incorrect email or password';
  }
  if (errorMessage.includes('User not found')) {
    return 'User not found';
  }
  if (errorMessage.includes('Email not confirmed')) {
    return 'Please verify your email address';
  }
  if (errorMessage.includes('Too many login attempts')) {
    return 'Too many login attempts. Please try again later';
  }

  return errorMessage;
}

// Session storage utilities
export function saveRememberMe(email: string): void {
  localStorage.setItem('rememberMe', 'true');
  localStorage.setItem('rememberedEmail', email);
}

export function clearRememberMe(): void {
  localStorage.removeItem('rememberMe');
  localStorage.removeItem('rememberedEmail');
}

export function getRememberedEmail(): string | null {
  const rememberMe = localStorage.getItem('rememberMe');
  return rememberMe ? localStorage.getItem('rememberedEmail') : null;
}

// Rate limiting
const LOGIN_ATTEMPTS_KEY = 'loginAttempts';
const LOGIN_ATTEMPTS_RESET_TIME = 15 * 60 * 1000; // 15 minutes

interface LoginAttempt {
  count: number;
  timestamp: number;
}

export function checkRateLimit(): { allowed: boolean; remainingTime: number } {
  const attempts = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
  if (!attempts) {
    return { allowed: true, remainingTime: 0 };
  }

  const data: LoginAttempt = JSON.parse(attempts);
  const now = Date.now();
  const timePassed = now - data.timestamp;

  if (timePassed > LOGIN_ATTEMPTS_RESET_TIME) {
    localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
    return { allowed: true, remainingTime: 0 };
  }

  if (data.count >= 5) {
    const remainingTime = Math.ceil((LOGIN_ATTEMPTS_RESET_TIME - timePassed) / 1000);
    return { allowed: false, remainingTime };
  }

  return { allowed: true, remainingTime: 0 };
}

export function recordLoginAttempt(): void {
  const attempts = localStorage.getItem(LOGIN_ATTEMPTS_KEY);

  if (!attempts) {
    const data: LoginAttempt = { count: 1, timestamp: Date.now() };
    localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(data));
  } else {
    const data: LoginAttempt = JSON.parse(attempts);
    data.count++;
    localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(data));
  }
}

export function clearLoginAttempts(): void {
  localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
}

// Session timeout utilities
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
let sessionTimeoutId: NodeJS.Timeout | null = null;

export function startSessionTimeout(onTimeout: () => void): void {
  if (sessionTimeoutId) {
    clearTimeout(sessionTimeoutId);
  }

  sessionTimeoutId = setTimeout(onTimeout, SESSION_TIMEOUT);
}

export function resetSessionTimeout(onTimeout: () => void): void {
  if (sessionTimeoutId) {
    clearTimeout(sessionTimeoutId);
  }
  startSessionTimeout(onTimeout);
}

export function clearSessionTimeout(): void {
  if (sessionTimeoutId) {
    clearTimeout(sessionTimeoutId);
  }
  sessionTimeoutId = null;
}
