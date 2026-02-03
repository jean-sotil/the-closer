/**
 * Account Lockout Hook
 *
 * Tracks failed login attempts and enforces account lockout
 * to prevent brute force attacks.
 */

import { useState, useEffect } from 'react';
import { ACCOUNT_LOCKOUT_CONFIG } from '../config/security';

interface LockoutState {
  attempts: number;
  lockedUntil: number | null;
  firstAttempt: number;
}

const STORAGE_KEY = 'auth_lockout';

/**
 * Get lockout state from localStorage
 */
function getLockoutState(email: string): LockoutState {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}:${email}`);
    if (!stored) {
      return { attempts: 0, lockedUntil: null, firstAttempt: Date.now() };
    }
    return JSON.parse(stored);
  } catch {
    return { attempts: 0, lockedUntil: null, firstAttempt: Date.now() };
  }
}

/**
 * Save lockout state to localStorage
 */
function saveLockoutState(email: string, state: LockoutState): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}:${email}`, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear lockout state
 */
function clearLockoutState(email: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEY}:${email}`);
  } catch {
    // Ignore storage errors
  }
}

export function useAccountLockout(email: string) {
  const [lockoutState, setLockoutState] = useState<LockoutState>(() =>
    getLockoutState(email)
  );

  // Check if account is currently locked
  const isLocked = (): boolean => {
    if (!lockoutState.lockedUntil) return false;

    const now = Date.now();
    if (now >= lockoutState.lockedUntil) {
      // Lockout expired, reset state
      const newState = { attempts: 0, lockedUntil: null, firstAttempt: now };
      setLockoutState(newState);
      saveLockoutState(email, newState);
      return false;
    }

    return true;
  };

  // Get remaining lockout time in seconds
  const getRemainingLockoutTime = (): number => {
    if (!lockoutState.lockedUntil) return 0;
    const remaining = Math.max(0, lockoutState.lockedUntil - Date.now());
    return Math.ceil(remaining / 1000);
  };

  // Record a failed login attempt
  const recordFailedAttempt = (): void => {
    const now = Date.now();
    let newState = { ...lockoutState };

    // Reset attempts if window has expired
    if (now - newState.firstAttempt > ACCOUNT_LOCKOUT_CONFIG.resetAttemptsAfterMs) {
      newState = { attempts: 1, lockedUntil: null, firstAttempt: now };
    } else {
      newState.attempts++;
    }

    // Lock account if max attempts reached
    if (newState.attempts >= ACCOUNT_LOCKOUT_CONFIG.maxFailedAttempts) {
      newState.lockedUntil = now + ACCOUNT_LOCKOUT_CONFIG.lockoutDurationMs;
    }

    setLockoutState(newState);
    saveLockoutState(email, newState);
  };

  // Record a successful login (clears lockout)
  const recordSuccessfulLogin = (): void => {
    clearLockoutState(email);
    setLockoutState({ attempts: 0, lockedUntil: null, firstAttempt: Date.now() });
  };

  // Get remaining attempts before lockout
  const getRemainingAttempts = (): number => {
    return Math.max(
      0,
      ACCOUNT_LOCKOUT_CONFIG.maxFailedAttempts - lockoutState.attempts
    );
  };

  // Auto-update lockout state when timer expires
  useEffect(() => {
    if (!lockoutState.lockedUntil) return;

    const remaining = lockoutState.lockedUntil - Date.now();
    if (remaining <= 0) {
      const newState = { attempts: 0, lockedUntil: null, firstAttempt: Date.now() };
      setLockoutState(newState);
      saveLockoutState(email, newState);
      return;
    }

    const timeout = setTimeout(() => {
      const newState = { attempts: 0, lockedUntil: null, firstAttempt: Date.now() };
      setLockoutState(newState);
      saveLockoutState(email, newState);
    }, remaining);

    return () => clearTimeout(timeout);
  }, [lockoutState.lockedUntil, email]);

  return {
    isLocked: isLocked(),
    remainingAttempts: getRemainingAttempts(),
    remainingLockoutTime: getRemainingLockoutTime(),
    recordFailedAttempt,
    recordSuccessfulLogin,
  };
}
