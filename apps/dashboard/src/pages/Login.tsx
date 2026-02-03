import { useState, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { LogIn, Mail, Lock, AlertCircle, Loader2, ShieldAlert } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useAccountLockout } from "../hooks/useAccountLockout";
import { getSafeErrorMessage, RateLimitError } from "../api/secureApi";

export function Login(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Account lockout tracking
  const lockout = useAccountLockout(email);

  // Get the redirect path from location state, default to home
  const from = (location.state as { from?: string })?.from ?? "/";

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      // Check if account is locked
      if (lockout.isLocked) {
        const minutes = Math.ceil(lockout.remainingLockoutTime / 60);
        setError(
          `Account temporarily locked due to too many failed attempts. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`
        );
        return;
      }

      setIsLoading(true);

      try {
        await signIn(email, password);
        lockout.recordSuccessfulLogin();
        navigate(from, { replace: true });
      } catch (err) {
        // Record failed attempt for lockout tracking
        lockout.recordFailedAttempt();

        // Show user-friendly error message
        const message = getSafeErrorMessage(err);

        // Add remaining attempts warning if not a rate limit error
        if (!(err instanceof RateLimitError) && lockout.remainingAttempts > 0) {
          setError(
            `${message}\n\n${lockout.remainingAttempts} attempt${lockout.remainingAttempts !== 1 ? 's' : ''} remaining before account lockout.`
          );
        } else {
          setError(message);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, signIn, navigate, from, lockout]
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary-600">The Closer</h1>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Or{" "}
            <Link
              to="/signup"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              create a new account
            </Link>
          </p>
        </div>

        {/* Form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {/* Account locked warning */}
          {lockout.isLocked && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold">Account Temporarily Locked</p>
                <p>Too many failed login attempts. Try again in {Math.ceil(lockout.remainingLockoutTime / 60)} minute{Math.ceil(lockout.remainingLockoutTime / 60) !== 1 ? 's' : ''}.</p>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && !lockout.isLocked && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm whitespace-pre-line">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Email field */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email address
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          {/* Remember me & Forgot password */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label
                htmlFor="remember-me"
                className="ml-2 block text-sm text-gray-700"
              >
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <Link
                to="/forgot-password"
                className="font-medium text-primary-600 hover:text-primary-500"
              >
                Forgot your password?
              </Link>
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading || lockout.isLocked}
            className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <LogIn className="w-5 h-5 mr-2" />
                Sign in
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
