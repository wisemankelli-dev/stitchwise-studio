import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { User, Mail, Lock, ArrowRight, Scissors, AlertCircle, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

export const Signup: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Determine where to redirect after successful signup
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await api.signup(name, email, password);
      if (res.success) {
        // Redirect to dashboard or requested page
        navigate(from, { replace: true });
        // Force header update
        window.dispatchEvent(new Event('auth-change'));
      } else {
        setError(res.error || 'Registration failed. Email may already exist.');
      }
    } catch (err) {
      console.error('Signup error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="flex items-center gap-2 p-3 bg-slate-900 rounded-2xl shadow-lg border border-slate-800">
            <Scissors className="h-8 w-8 text-brand-500 -rotate-45" />
            <span className="font-extrabold tracking-tight text-white text-xl">StitchWise <span className="text-brand-500">Studio</span></span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          Or{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-500 transition-colors">
            sign in to your existing workspace
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl border border-slate-100 sm:rounded-3xl sm:px-10">
          
          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 flex items-start gap-3 text-sm text-red-600">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">Registration Issue</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10 block w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm transition-all bg-slate-50/50"
                  placeholder="e.g. Elena Crafter"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 block w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm transition-all bg-slate-50/50"
                  placeholder="e.g. elena@stitchwise.studio"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 block w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm transition-all bg-slate-50/50"
                  placeholder="At least 6 characters"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="confirm-password"
                  name="confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 block w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm transition-all bg-slate-50/50"
                  placeholder="Re-enter your password"
                />
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  required
                  className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-slate-300 rounded"
                  defaultChecked
                />
              </div>
              <div className="ml-2 text-xs text-slate-500 leading-normal">
                I agree to the StitchWise{' '}
                <span className="font-semibold text-slate-700 hover:underline cursor-pointer">Terms of Service</span>{' '}
                and{' '}
                <span className="font-semibold text-slate-700 hover:underline cursor-pointer">Privacy Policy</span>.
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 px-5 py-3 border border-transparent rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-500 shadow-md hover:shadow-lg transition-all focus:outline-none disabled:bg-slate-300 disabled:shadow-none"
              >
                {isLoading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Create Free Account <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="flex gap-2.5 text-xs text-slate-500">
              <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                By registering, you automatically receive access to our <span className="font-semibold text-slate-700">Hobbyist Tier</span>, allowing 16x16 grid design, standard DMC palettes, and infinite hand embroidery PDF exports.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
