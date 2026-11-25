/**
 * The signed-in member's profile must survive a reload.
 *
 * WHY THIS EXISTS
 * Measured on the live site (11-25): after logging in and reloading, localStorage
 * held only `stitchwise_token`, `stitchwise_active_user_id` and
 * `stitchwise_tier` — never a profile. `loadUserFromStorage()` therefore fell
 * back to the placeholder `{ name: 'Crafting User', email: '' }`, so:
 *   - the member saw a made-up name and a blank email everywhere, and
 *   - the pricing page's `prefilled_email` had nothing to put on the Stripe
 *     payment link (both links went out with no query string).
 *
 * The login/signup response is `{ userId, email, name, tier }` (backend
 * src/infrastructure/routes/auth.ts) — NOT the app's `User` shape — and the JWT
 * payload carries `userId`, `email` and `tier`. These pins cover both.
 *
 * Hermetic: the api module is mocked, localStorage is jsdom's, no network.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import {
  AuthProvider,
  useAuth,
  PROFILE_KEY,
  decodeJwtPayload,
  loadUserFromStorage,
} from '../contexts/AuthContext';

const apiMock = vi.hoisted(() => ({
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('../services/api', () => ({
  api: apiMock,
  // Same mapping as the real services/api.ts (PRO → "Pro Crafter", etc.).
  mapBackendTier: (tier: unknown) => {
    const raw = typeof tier === 'string' ? tier.trim().toUpperCase().replace(/[\s-]+/g, '_') : '';
    if (raw === 'PRO' || raw === 'PRO_CRAFTER') return 'Pro Crafter';
    if (raw === 'STUDIO' || raw === 'DESIGN_STUDIO') return 'Design Studio';
    return 'Hobbyist';
  },
}));

/** Build a JWT-shaped token whose payload is the given object. */
function makeToken(payload: Record<string, unknown>): string {
  const b64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `mock-header.${b64}.mock-signature`;
}

function Probe() {
  const { currentUser, login, signup, logout } = useAuth();
  return (
    <div>
      <span data-testid="name">{currentUser?.name ?? '—'}</span>
      <span data-testid="email">{currentUser?.email ?? '—'}</span>
      <span data-testid="id">{currentUser?.id ?? '—'}</span>
      <span data-testid="tier">{currentUser?.subscriptionTier ?? '—'}</span>
      <button onClick={() => void login('buyer@example.com', 'pw')}>login</button>
      <button onClick={() => void signup('Kelli Wise', 'buyer@example.com', 'pw')}>signup</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

function renderApp() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

const stored = () => ({
  profile: localStorage.getItem(PROFILE_KEY),
  userId: localStorage.getItem('stitchwise_active_user_id'),
  tier: localStorage.getItem('stitchwise_tier'),
});

describe('AuthContext — the signed-in profile persists', () => {
  beforeEach(() => {
    localStorage.clear();
    apiMock.login.mockReset();
    apiMock.signup.mockReset();
    apiMock.logout.mockReset();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  /** The real api.login/signup store the token themselves; mirror that here. */
  function mockAuthCall(which: 'login' | 'signup', tier: string) {
    const token = makeToken({ userId: 'usr-1', email: 'buyer@example.com', tier });
    const response = {
      success: true,
      token,
      // Exactly what POST /api/auth/login and /api/auth/signup return.
      user: { userId: 'usr-1', email: 'buyer@example.com', name: 'Kelli Wise', tier },
    };
    const impl = async () => {
      localStorage.setItem('stitchwise_token', token);
      return response;
    };
    if (which === 'login') apiMock.login.mockImplementation(impl);
    else apiMock.signup.mockImplementation(impl);
    return response;
  }

  it('persists the profile at login, in the app User shape, from the backend response', async () => {
    mockAuthCall('login', 'PRO');

    renderApp();
    fireEvent.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('Kelli Wise'));
    expect(screen.getByTestId('email').textContent).toBe('buyer@example.com');
    expect(screen.getByTestId('id').textContent).toBe('usr-1');
    expect(screen.getByTestId('tier').textContent).toBe('Pro Crafter');

    const s = stored();
    expect(s.profile).toBeTruthy();
    const profile = JSON.parse(s.profile as string);
    expect(profile).toMatchObject({
      id: 'usr-1',
      name: 'Kelli Wise',
      email: 'buyer@example.com',
      subscriptionTier: 'Pro Crafter',
    });
    // The keys other screens read must not be the string "undefined".
    expect(s.userId).toBe('usr-1');
    expect(s.tier).toBe('Pro Crafter');
  });

  it('shows the member their own name and email after a reload', async () => {
    mockAuthCall('login', 'PRO');

    renderApp();
    fireEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('Kelli Wise'));

    // Reload: a brand-new provider reads only what is in storage.
    cleanup();
    renderApp();

    await waitFor(() => expect(screen.getByTestId('email').textContent).toBe('buyer@example.com'));
    expect(screen.getByTestId('name').textContent).toBe('Kelli Wise');
    expect(screen.getByTestId('tier').textContent).toBe('Pro Crafter');
  });

  it('falls back to the JWT payload when no profile was ever stored', () => {
    // The exact live state measured on 11-25: a token and nothing useful else.
    localStorage.setItem('stitchwise_token', makeToken({ userId: 'usr-9', email: 'kelli@example.com', tier: 'STUDIO' }));
    localStorage.setItem('stitchwise_active_user_id', 'undefined');
    localStorage.setItem('stitchwise_tier', 'undefined');

    const user = loadUserFromStorage();

    expect(user).not.toBeNull();
    expect(user!.email).toBe('kelli@example.com');
    expect(user!.id).toBe('usr-9');
    expect(user!.subscriptionTier).toBe('Design Studio');
    expect(user!.name).not.toBe('Crafting User');
  });

  it('survives a corrupt stored profile and still has the email from the JWT', () => {
    localStorage.setItem('stitchwise_token', makeToken({ userId: 'usr-9', email: 'kelli@example.com', tier: 'HOBBYIST' }));
    localStorage.setItem(PROFILE_KEY, '{not json');

    const user = loadUserFromStorage();

    expect(user!.email).toBe('kelli@example.com');
    expect(user!.id).toBe('usr-9');
  });

  it('persists the profile at signup too', async () => {
    mockAuthCall('signup', 'HOBBYIST');

    renderApp();
    fireEvent.click(screen.getByText('signup'));

    await waitFor(() => expect(screen.getByTestId('name').textContent).toBe('Kelli Wise'));
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) as string);
    expect(profile.email).toBe('buyer@example.com');
    expect(profile.id).toBe('usr-1');
    expect(stored().tier).toBe('Hobbyist');
  });

  it('clears the stored profile on logout', async () => {
    localStorage.setItem('stitchwise_token', makeToken({ userId: 'usr-1', email: 'buyer@example.com', tier: 'PRO' }));
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ id: 'usr-1', name: 'Kelli Wise', email: 'buyer@example.com' }));

    renderApp();
    await waitFor(() => expect(screen.getByTestId('email').textContent).toBe('buyer@example.com'));

    fireEvent.click(screen.getByText('logout'));

    expect(localStorage.getItem(PROFILE_KEY)).toBeNull();
    expect(screen.getByTestId('email').textContent).toBe('—');
  });

  it('decodeJwtPayload returns null for junk instead of throwing', () => {
    expect(decodeJwtPayload(null)).toBeNull();
    expect(decodeJwtPayload('not-a-token')).toBeNull();
    expect(decodeJwtPayload('a.%%%.c')).toBeNull();
  });
});
