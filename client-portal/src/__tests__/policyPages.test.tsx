/**
 * Public policy pages + footer links (b149).
 *
 * WHY THIS EXISTS
 * Stripe holds the account because the site had no refund, terms, privacy or
 * contact page. The copy is owner-approved and must not be reworded, and the
 * pages must be readable WITHOUT an account (a payment reviewer is not signed
 * in). Every public page carries one small line — "Refunds · Terms · Privacy ·
 * Contact" — so the pages are always one click away.
 *
 * This test fails the build if:
 *   - any of the four pages stops existing, stops being routed, or starts
 *     requiring login;
 *   - any of the four footer links disappears;
 *   - the footer stops rendering the policy line (which is how the six public
 *     pages — Home, Pricing, Pattern Library, Collage, Login, Signup — get it);
 *   - owner-approved copy is reworded or the contact address changes.
 *
 * Hermetic: renders the pages in a MemoryRouter and reads App.tsx as text.
 * No network, no database.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Refunds, Terms, Privacy, Contact } from '../pages/Policies';
import { PolicyLinks, POLICY_LINKS } from '../components/PolicyLinks';

const appSource = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');

const renderAt = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const POLICY_PAGES = [
  { name: 'Refunds', path: '/refunds', element: <Refunds /> },
  { name: 'Terms', path: '/terms', element: <Terms /> },
  { name: 'Privacy', path: '/privacy', element: <Privacy /> },
  { name: 'Contact', path: '/contact', element: <Contact /> },
];

describe('policy pages exist and are public', () => {
  for (const page of POLICY_PAGES) {
    it(`${page.name} is routed at ${page.path} without a login gate`, () => {
      const route = new RegExp(
        `<Route\\s+path="${page.path}"\\s+element=\\{<${page.name}\\s*/>\\}`,
      );
      expect(appSource).toMatch(route);
      // Reachable without logging in: the route must not be wrapped in ProtectedRoute.
      expect(appSource).not.toMatch(new RegExp(`ProtectedRoute[^>]*>\\s*<${page.name}\\b`));
    });
  }

  it('the six public pages still exist, so the footer line reaches all of them', () => {
    for (const path of ['/', '/pricing', '/patterns', '/collage', '/login', '/signup']) {
      expect(appSource).toMatch(new RegExp(`<Route\\s+path="${path}"\\s+element=`));
    }
  });

  it('the footer — rendered outside <Routes>, so on every page — shows the policy line', () => {
    const routesClose = appSource.lastIndexOf('</Routes>');
    const footerOpen = appSource.indexOf('<footer');
    expect(routesClose).toBeGreaterThan(-1);
    expect(footerOpen).toBeGreaterThan(routesClose);

    const footerSource = appSource.slice(footerOpen, appSource.indexOf('</footer>', footerOpen));
    expect(footerSource).toContain('<PolicyLinks');
  });
});

describe('footer policy line', () => {
  it('links to all four pages in order', () => {
    renderAt(<PolicyLinks />);
    const nav = screen.getByRole('navigation', { name: 'Site policies' });
    const links = Array.from(nav.querySelectorAll('a'));
    expect(links.map((a) => a.textContent)).toEqual(['Refunds', 'Terms', 'Privacy', 'Contact']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/refunds',
      '/terms',
      '/privacy',
      '/contact',
    ]);
    expect(POLICY_LINKS).toHaveLength(4);
  });

  it('appears on every policy page too', () => {
    for (const page of POLICY_PAGES) {
      const { unmount } = renderAt(page.element);
      const links = screen
        .getByRole('navigation', { name: 'Site policies' })
        .querySelectorAll('a');
      expect(links).toHaveLength(4);
      unmount();
    }
  });
});

describe('owner-approved copy', () => {
  it('Refunds: 7 days, and you keep the file', () => {
    renderAt(<Refunds />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Refunds');
    expect(
      screen.getByText('Digital patterns — 7 days, and you keep the file.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/reply within 7 days of buying it and we'll refund you in full/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/You keep the pattern\./)).toBeInTheDocument();
  });

  it('Terms: what we sell, receiving a pattern, allowances', () => {
    renderAt(<Terms />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Terms of Service');
    expect(screen.getByText('What we sell.')).toBeInTheDocument();
    expect(screen.getByText('Receiving a pattern.')).toBeInTheDocument();
    expect(screen.getByText('Plans and allowances.')).toBeInTheDocument();
    expect(
      screen.getByText(/You do not need an account to pay\. You do need one to receive a pattern/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Changes.')).toBeInTheDocument();
  });

  it('Privacy: what we hold, Stripe, Gemini, deletion', () => {
    renderAt(<Privacy />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Privacy');
    expect(screen.getByText('What we hold.')).toBeInTheDocument();
    expect(screen.getByText('Payments.')).toBeInTheDocument();
    expect(screen.getByText(/We never see or store your card number/i)).toBeInTheDocument();
    expect(screen.getByText(/Gemini models/i)).toBeInTheDocument();
    expect(screen.getByText('Deleting your data.')).toBeInTheDocument();
  });

  it('Contact: the owner inbox', () => {
    renderAt(<Contact />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Contact');
    const mailto = screen.getByRole('link', { name: 'stitchwiseandco@gmail.com' });
    expect(mailto).toHaveAttribute('href', 'mailto:stitchwiseandco@gmail.com');
  });
});
