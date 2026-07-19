import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Smartphone, 
  Lock, 
  Mail, 
  User, 
  ArrowRight, 
  CheckCircle2, 
  RefreshCw, 
  ShieldCheck, 
  ArrowLeft,
  X
} from 'lucide-react';

interface AuthViewProps {
  onLoginSuccess: (user: { id: string; fullName: string; email: string; phone: string }) => void;
}


type AuthMode = 'login' | 'otp' | 'signup' | 'admin-login';

interface Country {
  code: string;
  name: string;
  flag: string;
}

const COUNTRIES: Country[] = [
  { code: '+1', name: 'United States', flag: '🇺🇸' },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+92', name: 'Pakistan', flag: '🇵🇰' },
  { code: '+91', name: 'India', flag: '🇮🇳' },
  { code: '+1', name: 'Canada', flag: '🇨🇦' },
  { code: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: '+33', name: 'France', flag: '🇫🇷' },
  { code: '+971', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+81', name: 'Japan', flag: '🇯🇵' },
  { code: '+86', name: 'China', flag: '🇨🇳' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬' },
  { code: '+55', name: 'Brazil', flag: '🇧🇷' },
  { code: '+27', name: 'South Africa', flag: '🇿🇦' },
  { code: '+39', name: 'Italy', flag: '🇮🇹' },
  { code: '+34', name: 'Spain', flag: '🇪🇸' },
  { code: '+7', name: 'Russia', flag: '🇷🇺' },
  { code: '+82', name: 'South Korea', flag: '🇰🇷' },
  { code: '+90', name: 'Turkey', flag: '🇹🇷' }
];

export default function AuthView({ onLoginSuccess }: AuthViewProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  
  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  // Admin login fields
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');

  // Country code selector states
  const [selectedCountryCode, setSelectedCountryCode] = useState('+1');
  const [lastSentPhone, setLastSentPhone] = useState('');

  // Status flags
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Simulated SMS Toast for Developer / testing convenience
  const [simulatedSms, setSimulatedSms] = useState<{ phone: string; code: string } | null>(null);

  const resetMessages = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // 1. SIGNUP Form handler
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setIsLoading(true);

    const cleanLocal = phone.replace(/[^0-9]/g, '');
    const fullPhone = selectedCountryCode + cleanLocal;

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password, phone: fullPhone })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete registration.');
      }

      setSuccessMsg(data.message || 'Signup successful! You can now log in.');
      setMode('login');
      // Keep phone text for easy login
      setPassword('');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. LOGIN INITIALIZATION Form handler (checks phone/password -> sends OTP)
  const handleLoginInit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setIsLoading(true);

    const cleanLocal = phone.replace(/[^0-9]/g, '');
    const fullPhone = selectedCountryCode + cleanLocal;

    try {
      const res = await fetch('/api/auth/login-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid phone or password.');
      }

      // Enter OTP screen
      setLastSentPhone(fullPhone);
      setMode('otp');
      setOtp('');
      
      // Setup the simulated SMS popup
      if (data.otpForTesting) {
        setSimulatedSms({ phone: fullPhone, code: data.otpForTesting });
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 3. LOGIN VERIFY Form handler (checks OTP -> completes login)
  const handleLoginVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: lastSentPhone, otp })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid or expired OTP.');
      }

      // Clear SMS Simulator
      setSimulatedSms(null);
      
      // Save session
      localStorage.setItem('outreach_user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 4. ADMIN LOGIN Form handler
  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid administrator password.');
      }

      // Save administrator session
      localStorage.setItem('outreach_user', JSON.stringify(data.admin));
      onLoginSuccess(data.admin);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] text-gray-200 flex items-center justify-center p-4 relative overflow-hidden" id="auth-view-container">
      {/* Dynamic Background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Simulated SMS push notification overlay */}
      <AnimatePresence>
        {simulatedSms && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm"
            id="sms-simulator-notification"
          >
            <div className="bg-slate-900/95 border border-indigo-500/30 backdrop-blur-md rounded-2xl p-4 shadow-2xl shadow-indigo-500/10 space-y-2 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
              <button 
                onClick={() => setSimulatedSms(null)}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X size={14} />
              </button>
              
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-500/15 flex items-center justify-center text-indigo-400">
                  <Smartphone size={16} className="animate-pulse" />
                </div>
                <div>
                  <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider font-display">💬 SMS Gate Simulator</h4>
                  <p className="text-[11px] text-gray-300">New text message received</p>
                </div>
              </div>
              
              <div className="bg-black/40 p-2.5 rounded-xl border border-white/5 flex items-center justify-between gap-4">
                <p className="text-xs text-gray-400 leading-relaxed">
                  Your Outreach Pro verification code is <strong className="text-white font-mono text-sm tracking-wide">{simulatedSms.code}</strong>. Expires in 5m.
                </p>
                <button
                  type="button"
                  onClick={() => setOtp(simulatedSms.code)}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold text-white rounded-lg transition-all shadow-md active:scale-95 shrink-0"
                >
                  Auto-fill
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-xs font-semibold">
            <Sparkles size={13} className="animate-pulse" />
            <span>Outreach Pro Co-Pilot</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight font-display">
            Personalized LinkedIn Copywriting
          </h1>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            Auto-generate high-converting outreach message templates with Gemini AI.
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-[#0A0A0B]/80 border border-white/5 backdrop-blur-xl rounded-3xl p-7 shadow-xl space-y-6">
          
          {/* Header State Titles */}
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white tracking-tight">
              {mode === 'login' && 'Sign In to Your Workspace'}
              {mode === 'otp' && 'Verify Your Mobile Phone'}
              {mode === 'signup' && 'Create Your Free Account'}
              {mode === 'admin-login' && 'Administrative Command Terminal'}
            </h2>
            <p className="text-xs text-gray-400">
              {mode === 'login' && 'Enter your phone and password to receive an OTP code.'}
              {mode === 'otp' && `We've sent a 6-digit code to your phone number.`}
              {mode === 'signup' && 'Register your details to unlock automated lead nurturing.'}
              {mode === 'admin-login' && 'Authenticate with your high-clearance system credentials.'}
            </p>
          </div>

          {/* Feedback alerts */}
          <AnimatePresence mode="wait">
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3 bg-red-500/10 border border-red-500/25 text-red-400 rounded-2xl text-xs leading-relaxed"
                id="auth-error-alert"
              >
                {errorMsg}
              </motion.div>
            )}

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-2xl text-xs flex items-center gap-2"
                id="auth-success-alert"
              >
                <CheckCircle2 size={14} className="shrink-0" />
                <span>{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form Rendering */}
          <form 
            onSubmit={
              mode === 'login' ? handleLoginInit :
              mode === 'otp' ? handleLoginVerify :
              mode === 'admin-login' ? handleAdminLoginSubmit :
              handleSignup
            } 
            className="space-y-4"
          >
            {/* SIGNUP: Full Name */}
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-gray-400">FULL NAME</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-black/40 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* SIGNUP: Email */}
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-gray-400">EMAIL ADDRESS</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@company.com"
                    className="w-full bg-black/40 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* ADMIN LOGIN: Username */}
            {mode === 'admin-login' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-gray-400">ADMIN USERNAME</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                  <input
                    type="text"
                    required
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full bg-black/40 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/40 transition-colors font-mono"
                  />
                </div>
              </div>
            )}

            {/* LOGIN / SIGNUP: Mobile Phone */}
            {mode !== 'otp' && mode !== 'admin-login' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-gray-400">MOBILE PHONE NUMBER</label>
                <div className="flex gap-2">
                  {/* Country Prefix Selector */}
                  <div className="relative shrink-0 w-28">
                    <select
                      value={selectedCountryCode}
                      onChange={(e) => setSelectedCountryCode(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 rounded-xl pl-3 pr-8 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/40 appearance-none cursor-pointer"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={`${c.flag}-${c.code}`} value={c.code} className="bg-[#0E0F12] text-white">
                          {c.flag} {c.code}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-gray-500 text-[9px]">
                      ▼
                    </div>
                  </div>

                  {/* Local Phone Input */}
                  <div className="relative flex-1">
                    <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 019-2834"
                      className="w-full bg-black/40 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-gray-500">Select country prefix and input local phone number.</p>
              </div>
            )}

            {/* LOGIN / SIGNUP: Password */}
            {mode !== 'otp' && mode !== 'admin-login' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-gray-400">PASSWORD</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black/40 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
                  />
                </div>
              </div>
            )}

            {/* ADMIN LOGIN: Password */}
            {mode === 'admin-login' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-gray-400">SECURITY PASSPHRASE</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black/40 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/40 transition-colors font-mono"
                  />
                </div>
              </div>
            )}

            {/* OTP: 6-Digit Code */}
            {mode === 'otp' && (
              <div className="space-y-3">
                <div className="text-center">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">ENTER VERIFICATION CODE</span>
                </div>
                <div className="flex justify-center">
                  <input
                    type="text"
                    maxLength={6}
                    required
                    autoFocus
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="000000"
                    className="w-48 bg-black/50 border border-indigo-500/30 rounded-2xl py-3 text-center text-xl font-bold font-mono tracking-[0.4em] text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-gray-700"
                  />
                </div>
                <p className="text-center text-[10px] text-gray-500 leading-relaxed max-w-[280px] mx-auto">
                  A verification text has been routed. Enter the 6-digit token to secure this login session.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold text-white rounded-xl transition-all shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2 cursor-pointer mt-2"
              id="auth-submit-btn"
            >
              {isLoading ? (
                <RefreshCw className="animate-spin" size={13} />
              ) : mode === 'login' ? (
                <>
                  <span>Request Verification SMS</span>
                  <ArrowRight size={13} />
                </>
              ) : mode === 'otp' ? (
                <>
                  <ShieldCheck size={14} />
                  <span>Verify Code & Enter</span>
                </>
              ) : mode === 'admin-login' ? (
                <>
                  <ShieldCheck size={14} />
                  <span>Authenticate Admin Terminal</span>
                </>
              ) : (
                <>
                  <span>Register Account</span>
                  <ArrowRight size={13} />
                </>
              )}
            </button>
          </form>

          {/* Toggle Screen Mode Links */}
          <div className="text-center pt-1 border-t border-white/5">
            {mode === 'login' && (
              <p className="text-[11px] text-gray-400">
                Don't have an account?{' '}
                <button
                  onClick={() => {
                    setMode('signup');
                    resetMessages();
                  }}
                  className="text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer bg-transparent border-none p-0"
                >
                  Create one now
                </button>
              </p>
            )}

            {mode === 'signup' && (
              <p className="text-[11px] text-gray-400">
                Already registered?{' '}
                <button
                  onClick={() => {
                    setMode('login');
                    resetMessages();
                  }}
                  className="text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer bg-transparent border-none p-0"
                >
                  Log in here
                </button>
              </p>
            )}

            {mode === 'admin-login' && (
              <p className="text-[11px] text-gray-400">
                Are you a team member?{' '}
                <button
                  onClick={() => {
                    setMode('login');
                    resetMessages();
                  }}
                  className="text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer bg-transparent border-none p-0"
                >
                  Return to User Login
                </button>
              </p>
            )}

            {mode === 'otp' && (
              <button
                onClick={() => {
                  setMode('login');
                  setSimulatedSms(null);
                  resetMessages();
                }}
                className="text-[11px] text-gray-400 hover:text-gray-300 flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
              >
                <ArrowLeft size={12} />
                <span>Back to mobile number</span>
              </button>
            )}
          </div>

        </div>

        {/* Footer Security Note */}
        <div className="text-center text-[10px] text-gray-500 space-y-1">
          <p className="flex items-center justify-center gap-1">
            <ShieldCheck size={11} className="text-indigo-500" />
            <span>Encrypted full-stack sandbox environment.</span>
          </p>
          <p>We secure logins with dynamic, randomized OTP challenges.</p>
          <button
            onClick={() => {
              setMode('admin-login');
              resetMessages();
            }}
            type="button"
            className="text-[10px] text-gray-600 hover:text-indigo-400 font-mono transition-colors border-b border-dashed border-gray-800 hover:border-indigo-500/50 pb-0.5 cursor-pointer mt-2 block w-max mx-auto"
          >
            🔐 Staff Terminal Console
          </button>
        </div>
      </div>
    </div>
  );
}
