import { Link } from 'react-router-dom';

/**
 * The site's policy links — one small line in the footer of every public page:
 *
 *     Refunds · Terms · Privacy · Contact
 *
 * The pages themselves live in `pages/Policies.tsx` and are public (no
 * ProtectedRoute). `__tests__/policyPages.test.tsx` fails if a link, a page or a
 * route goes missing, or if the footer stops rendering this line.
 */
export const POLICY_LINKS = [
  { label: 'Refunds', to: '/refunds' },
  { label: 'Terms', to: '/terms' },
  { label: 'Privacy', to: '/privacy' },
  { label: 'Contact', to: '/contact' },
] as const;

export const PolicyLinks: React.FC<{ className?: string }> = ({ className = '' }) => (
  <nav
    aria-label="Site policies"
    className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs ${className}`}
  >
    {POLICY_LINKS.map((link, index) => (
      <span key={link.to} className="flex items-center gap-2">
        {index > 0 && (
          <span aria-hidden="true" className="text-blush-200">
            ·
          </span>
        )}
        <Link to={link.to} className="text-slate-400 hover:text-blush-600 transition-colors">
          {link.label}
        </Link>
      </span>
    ))}
  </nav>
);
