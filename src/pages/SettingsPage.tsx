import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, User, Shield, Mail, Lock, Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { signOut } from '../lib/auth';

function PasswordStrengthIndicator({ password }: { password: string }) {
  const getStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strength = getStrength(password);
  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-teal-500', 'bg-green-500'];

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i < strength ? colors[strength - 1] : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs ${
        strength <= 1 ? 'text-red-600' :
        strength === 2 ? 'text-orange-600' :
        strength === 3 ? 'text-yellow-600' :
        strength === 4 ? 'text-teal-600' :
        'text-green-600'
      }`}>
        {labels[strength - 1] || 'Too short'}
      </p>
    </div>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'account' | 'security'>('profile');

  const [emailForm, setEmailForm] = useState({ newEmail: '', currentPassword: '' });
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setEmailMessage(null);

    if (!emailForm.newEmail.trim()) {
      setEmailMessage({ type: 'error', text: 'New email is required' });
      return;
    }

    if (emailForm.newEmail === user?.email) {
      setEmailMessage({ type: 'error', text: 'New email must be different from current' });
      return;
    }

    if (!emailForm.currentPassword) {
      setEmailMessage({ type: 'error', text: 'Current password is required to change email' });
      return;
    }

    setEmailLoading(true);

    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user!.email,
        password: emailForm.currentPassword
      });

      if (reauthError) {
        setEmailMessage({ type: 'error', text: 'Current password is incorrect' });
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        email: emailForm.newEmail
      });

      if (updateError) {
        setEmailMessage({ type: 'error', text: updateError.message });
        return;
      }

      const { error: dbError } = await supabase
        .from('users')
        .update({ email: emailForm.newEmail, updated_at: new Date().toISOString() })
        .eq('id', user!.id);

      if (dbError) {
        setEmailMessage({ type: 'error', text: 'Failed to update email in database' });
        return;
      }

      setEmailMessage({ type: 'success', text: 'Email updated. You will be signed out for security.' });
      setEmailForm({ newEmail: '', currentPassword: '' });

      setTimeout(async () => {
        await signOut();
        navigate('/login');
      }, 2000);
    } catch {
      setEmailMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setEmailLoading(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);

    if (!passwordForm.currentPassword) {
      setPasswordMessage({ type: 'error', text: 'Current password is required' });
      return;
    }

    if (!passwordForm.newPassword) {
      setPasswordMessage({ type: 'error', text: 'New password is required' });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    setPasswordLoading(true);

    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user!.email,
        password: passwordForm.currentPassword
      });

      if (reauthError) {
        setPasswordMessage({ type: 'error', text: 'Current password is incorrect' });
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      });

      if (updateError) {
        setPasswordMessage({ type: 'error', text: updateError.message });
        return;
      }

      setPasswordMessage({ type: 'success', text: 'Password updated successfully' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch {
      setPasswordMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setPasswordLoading(false);
    }
  }

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'account' as const, label: 'Account', icon: Mail },
    { id: 'security' as const, label: 'Security', icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/Image_logo.png" alt="Image Skinn & Hair" className="h-10" />
            <h1 className="text-xl font-bold text-gray-900">Settings</h1>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronLeft className="w-6 h-6 text-gray-600" />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Sidebar Tabs */}
          <div className="sm:w-56 flex-shrink-0">
            <nav className="flex sm:flex-col gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 w-full text-left ${
                    activeTab === tab.id
                      ? 'bg-teal-50 text-teal-700 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <tab.icon className="w-5 h-5" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {activeTab === 'profile' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900">Profile Information</h2>
                  <p className="text-sm text-gray-500 mt-1">Your personal details and role</p>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-5 mb-8">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                      {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{user?.name}</h3>
                      <p className="text-gray-500">{user?.email}</p>
                      <span className="inline-block mt-1 px-3 py-0.5 bg-teal-100 text-teal-800 text-xs font-semibold rounded-full capitalize">
                        {user?.role}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Full Name</p>
                      <p className="text-gray-900 font-medium">{user?.name}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Email</p>
                      <p className="text-gray-900 font-medium">{user?.email}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Phone</p>
                      <p className="text-gray-900 font-medium">{user?.phone}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Role</p>
                      <p className="text-gray-900 font-medium capitalize">{user?.role}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'account' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900">Account Settings</h2>
                  <p className="text-sm text-gray-500 mt-1">Update your email address</p>
                </div>
                <div className="p-6">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">Important</p>
                        <p className="text-sm text-amber-700 mt-1">Changing your email will sign you out. You will need to log in with your new email address.</p>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleEmailChange} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Current Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input
                          type="email"
                          value={user?.email || ''}
                          disabled
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">New Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input
                          type="email"
                          value={emailForm.newEmail}
                          onChange={(e) => setEmailForm(prev => ({ ...prev, newEmail: e.target.value }))}
                          placeholder="Enter new email address"
                          disabled={emailLoading}
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition disabled:bg-gray-100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={emailForm.currentPassword}
                          onChange={(e) => setEmailForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                          placeholder="Confirm your current password"
                          disabled={emailLoading}
                          className="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition disabled:bg-gray-100"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                        >
                          {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {emailMessage && (
                      <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                        emailMessage.type === 'success'
                          ? 'bg-green-50 border border-green-200 text-green-700'
                          : 'bg-red-50 border border-red-200 text-red-700'
                      }`}>
                        {emailMessage.type === 'success'
                          ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                          : <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        }
                        {emailMessage.text}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={emailLoading}
                      className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-lg shadow-teal-600/25 hover:shadow-xl hover:shadow-teal-600/30 transition-all duration-200 flex items-center gap-2"
                    >
                      {emailLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        'Update Email'
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900">Security Settings</h2>
                  <p className="text-sm text-gray-500 mt-1">Change your password</p>
                </div>
                <div className="p-6">
                  <form onSubmit={handlePasswordChange} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input
                          type={showCurrentPassword ? 'text' : 'password'}
                          value={passwordForm.currentPassword}
                          onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                          placeholder="Enter current password"
                          disabled={passwordLoading}
                          className="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition disabled:bg-gray-100"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                        >
                          {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                          placeholder="Enter new password"
                          disabled={passwordLoading}
                          className="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition disabled:bg-gray-100"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                        >
                          {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      <PasswordStrengthIndicator password={passwordForm.newPassword} />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={passwordForm.confirmPassword}
                          onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                          placeholder="Confirm new password"
                          disabled={passwordLoading}
                          className="w-full pl-10 pr-12 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition disabled:bg-gray-100"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                        >
                          {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                        <p className="text-red-600 text-sm mt-1">Passwords do not match</p>
                      )}
                    </div>

                    {passwordMessage && (
                      <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                        passwordMessage.type === 'success'
                          ? 'bg-green-50 border border-green-200 text-green-700'
                          : 'bg-red-50 border border-red-200 text-red-700'
                      }`}>
                        {passwordMessage.type === 'success'
                          ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                          : <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        }
                        {passwordMessage.text}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={passwordLoading || (passwordForm.newPassword !== passwordForm.confirmPassword && passwordForm.confirmPassword !== '')}
                      className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-lg shadow-teal-600/25 hover:shadow-xl hover:shadow-teal-600/30 transition-all duration-200 flex items-center gap-2"
                    >
                      {passwordLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        'Update Password'
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
