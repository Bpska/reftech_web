/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import { FormEvent, useState } from 'react';
import { ArrowLeft, LockKeyhole, UserRound } from 'lucide-react';
import { BrandMark } from '@/shared/components/BrandMark';

// REQ-TAL-009: TRANSPORTER is a transport company's login to the transporter portal.
type LoginType = 'EMPLOYEE' | 'PARTNER' | 'TRANSPORTER';

interface LoginResponse {
  token: string;
  userId?: number;
  username?: string;
  tenantId?: number;
  partnerId?: number | null;
  role?: string;
  roleCode?: string;
  loginType?: LoginType;
  userType?: LoginType;
  employeeId?: number | null;
  baseRole?: string;
  mustChangePassword?: boolean;
  passwordExpired?: boolean;
  passwordDaysLeft?: number | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
}

export function LoginPage() {
  const requested = new URLSearchParams(window.location.search).get('type');

  const [kind, setKind] = useState<LoginType>(
    requested === 'PARTNER' ? 'PARTNER' : requested === 'TRANSPORTER' ? 'TRANSPORTER' : 'EMPLOYEE'
  );

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  /*
   * API URL must come from .env.
   *
   * Example:
   * VITE_API_URL=http://localhost:8080
   *
   * Production:
   * VITE_API_URL=https://api.reftech.in
   */
  const apiUrl = import.meta.env.VITE_API_URL;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiUrl) {
      setMessage(
        'VITE_API_URL is not configured. Please check the .env file.'
      );
      return;
    }

    const form = new FormData(event.currentTarget);

    const username = String(form.get('username') ?? '').trim();
    const password = String(form.get('password') ?? '');

    if (!username || !password) {
      setMessage('Please enter username and password.');
      return;
    }

    setLoading(true);
    setMessage('Signing in...');

    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          username,
          password,
          loginType: kind,
        }),
      });

      if (!response.ok) {
        // DEF-018: show the server's message, not the raw JSON text
        const errorText = await response.text();
        let text = errorText;
        try { text = JSON.parse(errorText).message || errorText; } catch { /* plain text */ }
        throw new Error(
          text || `Login failed (${response.status})`
        );
      }

      const data: LoginResponse = await response.json();

      const normalizedUser = {
        ...data,
        firstName: String(data.firstName ?? '').trim(),
        lastName: String(data.lastName ?? '').trim(),
        fullName: [data.firstName, data.lastName]
          .map(value => String(value ?? '').trim())
          .filter(Boolean)
          .join(' '),
      };

      localStorage.setItem('reftech_token', data.token);
      localStorage.setItem('reftech_user', JSON.stringify(normalizedUser));

      // REQ-TRP-006: a driver login goes to the driver page; every office page answers 403 for it.
      // REQ-TAL-009: a transporter login goes to the transporter portal, which uses only its own API.
      const signedInRole = String(data.role || '').replace('ROLE_', '').toUpperCase();
      // REQ-HR-002: a password set by HR or Admin, or one that is too old, is changed before anything else.
      if (data.mustChangePassword || data.passwordExpired) { window.location.href = '/account/password?reason=' + (data.passwordExpired ? 'expired' : 'first'); return; }
      window.location.href = signedInRole === 'DRIVER' ? '/driver' : signedInRole === 'TRANSPORTER' ? '/transporter' : '/dashboard';
    } catch (error) {
      console.error('RefTech login failed:', error);

      if (error instanceof Error) {
        setMessage(error.message);
      } else {
        setMessage('Login failed');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-app min-h-screen bg-frost-950 md:grid md:grid-cols-2">

      {/* --------------------------------------------------
          LEFT SIDE - REFTECH IMAGE
      -------------------------------------------------- */}

      <section className="relative hidden overflow-hidden md:block">

        <img
          src="/media/reftech_truck.jpeg"
          alt="RefTech refrigerated truck"
          className="absolute inset-0 h-full w-full object-cover"
        />

        <div className="absolute inset-0 bg-linear-to-r from-frost-950/30 to-frost-950/80" />

      </section>


      {/* --------------------------------------------------
          RIGHT SIDE - LOGIN
      -------------------------------------------------- */}

      <section className="flex items-center justify-center p-6">

        <div className="w-full max-w-md">

          {/* Back */}

          <a
            href="/"
            className="mb-10 inline-flex items-center gap-2 text-sm text-white/70 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />

            Back to website
          </a>


          {/* Logo */}

          <BrandMark dark/>


          {/* --------------------------------------------------
              LOGIN TYPE
          -------------------------------------------------- */}

          <div className="mt-8 grid grid-cols-3 rounded-xl bg-white/10 p-1">

            <button
              type="button"
              onClick={() => {
                setKind('EMPLOYEE');
                setMessage('');
              }}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                kind === 'EMPLOYEE'
                  ? 'bg-white text-frost-950'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Employee
            </button>

            <button
              type="button"
              onClick={() => {
                setKind('PARTNER');
                setMessage('');
              }}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                kind === 'PARTNER'
                  ? 'bg-white text-frost-950'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              Partner
            </button>

            <button
              type="button"
              onClick={() => {
                setKind('TRANSPORTER');
                setMessage('');
              }}
              className={`rounded-lg px-2 py-2.5 text-sm font-semibold leading-tight transition ${
                kind === 'TRANSPORTER'
                  ? 'bg-white text-frost-950'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              {/* Label only: the login type stays TRANSPORTER (outside truck companies RefTech hires trucks from, REQ-TAL-009). */}
              Hired Truck/<wbr />Transporter Login
            </button>

          </div>


          {/* --------------------------------------------------
              LOGIN FORM
          -------------------------------------------------- */}

          <form
            onSubmit={submit}
            className="mt-6 space-y-4"
          >

            {/* USERNAME */}

            <label className="block text-sm text-white/80">

              Username

              <div className="mt-2 flex items-center rounded-xl border border-slate-300 bg-white px-4 focus-within:border-frost-500 focus-within:ring-2 focus-within:ring-frost-500/20">

                <UserRound className="h-4 w-4 shrink-0 text-slate-500" />

                <input
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="Enter username"
                  className="
                    w-full
                    bg-white
                    px-3
                    py-3
                    text-base
                    font-medium
                    text-slate-900
                    caret-slate-900
                    placeholder:text-slate-400
                    outline-none
                  "
                />

              </div>

            </label>


            {/* PASSWORD */}

            <label className="block text-sm text-white/80">

              Password

              <div className="mt-2 flex items-center rounded-xl border border-slate-300 bg-white px-4 focus-within:border-frost-500 focus-within:ring-2 focus-within:ring-frost-500/20">

                <LockKeyhole className="h-4 w-4 shrink-0 text-slate-500" />

                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Enter password"
                  className="
                    w-full
                    bg-white
                    px-3
                    py-3
                    text-base
                    font-medium
                    text-slate-900
                    caret-slate-900
                    placeholder:text-slate-400
                    outline-none
                  "
                />

              </div>

            </label>


            {/* SIGN IN */}

            <button
              type="submit"
              disabled={loading}
              className="
                w-full
                rounded-xl
                bg-frost-500
                py-3
                font-semibold
                text-white
                transition
                hover:bg-frost-400
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>


            {/* REQ-HR-002: a code by email to set a new password */}
            <a href="/forgot-password" className="block text-center text-sm font-semibold text-white/80 underline hover:text-white">Forgot password?</a>

            {/* MESSAGE */}

            {message && (
              <p className="rounded-lg bg-white/10 p-3 text-sm text-white/80">
                {message}
              </p>
            )}

          </form>

        </div>

      </section>

    </main>
  );
}