import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { signIn } from '../lib/auth';
import {
  validateLoginForm,
  parseAuthError,
  saveRememberMe,
  clearRememberMe,
  getRememberedEmail,
  checkRateLimit,
  recordLoginAttempt,
  clearLoginAttempts
} from '../lib/authUtils';

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [rateLimitError, setRateLimitError] = useState('');

  useEffect(() => {
    const rememberedEmail = getRememberedEmail();
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  function handleEmailChange(value: string) {
    setEmail(value);
    setFieldErrors(prev => ({ ...prev, email: '' }));
    setError('');
    setRateLimitError('');
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    setFieldErrors(prev => ({ ...prev, password: '' }));
    setError('');
    setRateLimitError('');
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setRateLimitError('');

    const validation = validateLoginForm(email, password);
    if (!validation.valid) {
      setFieldErrors(validation.errors);
      return;
    }

    const { allowed, remainingTime } = checkRateLimit();
    if (!allowed) {
      setRateLimitError(
        `Too many login attempts. Please try again in ${remainingTime} seconds.`
      );
      return;
    }

    setLoading(true);

    try {
      const result = await signIn(email, password);

      if (result.success) {
        clearLoginAttempts();

        if (rememberMe) {
          saveRememberMe(email);
        } else {
          clearRememberMe();
        }

        navigate('/dashboard');
      } else {
        recordLoginAttempt();
        const errorMessage = parseAuthError(result.error);
        setError(errorMessage);
      }
    } catch (err) {
      recordLoginAttempt();
      setError('An unexpected error occurred. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <img
              src="/Image_logo.png"
              alt="Image Skinn & Hair"
              className="h-20 mx-auto mb-4"
            />
            <h1 className="text-3xl font-bold text-gray-900">Image Skinn & Hair</h1>
            <p className="text-gray-600 mt-2 text-sm">Salon Management Portal</p>
          </div>

          {/* Error Messages */}
          {rateLimitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
              {rateLimitError}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="Enter your email"
                  disabled={loading}
                  autoComplete="email"
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition disabled:bg-gray-100 ${
                    fieldErrors.email ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
              </div>
              {fieldErrors.email && (
                <p className="text-red-600 text-sm mt-1">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-sm text-teal-600 hover:text-teal-700 font-medium transition"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  autoComplete="current-password"
                  className={`w-full pl-10 pr-12 py-2.5 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition disabled:bg-gray-100 ${
                    fieldErrors.password ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="text-red-600 text-sm mt-1">{fieldErrors.password}</p>
              )}
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-2 focus:ring-teal-500 cursor-pointer disabled:opacity-50"
              />
              <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-700 cursor-pointer">
                Remember this device
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 rounded-lg shadow-lg shadow-teal-600/25 hover:shadow-xl hover:shadow-teal-600/30 transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Authorized access only
            </p>
          </div>
        </div>

        {/* Security Footer */}
        <div className="mt-6 text-center text-xs text-gray-400">
          <p>&copy; {new Date().getFullYear()} Image Skinn & Hair. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
