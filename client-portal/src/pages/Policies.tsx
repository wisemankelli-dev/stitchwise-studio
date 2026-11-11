import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { PolicyLinks } from '../components/PolicyLinks';

/**
 * Public policy pages: /refunds, /terms, /privacy, /contact.
 *
 * Copy is owner-approved and must stay verbatim (source of truth:
 * /home/team/shared/site-policies/POLICY-COPY.md). These pages are public — they
 * are NOT behind ProtectedRoute, so anyone (including a payment reviewer who is
 * not signed in) can read them. `__tests__/policyPages.test.tsx` pins the copy,
 * the routes and the footer line.
 */

interface PolicyLayoutProps {
  title: string;
  children: ReactNode;
}

const PolicyLayout: React.FC<PolicyLayoutProps> = ({ title, children }) => (
  <div className="bg-floral-soft min-h-screen py-16 px-6 lg:px-8">
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blush-50 text-blush-700 mb-4">
          <ShieldCheck className="h-3 w-3" />
          StitchWise Studio
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-800 sm:text-5xl">{title}</h1>
      </div>

      <div className="bg-white rounded-3xl border border-blush-100 shadow-sm p-8 sm:p-10 space-y-6 text-sm text-slate-600 leading-relaxed">
        {children}
      </div>

      <PolicyLinks className="mt-8" />
    </div>
  </div>
);

interface SectionProps {
  lead?: string;
  children: ReactNode;
}

const Section: React.FC<SectionProps> = ({ lead, children }) => (
  <p>
    {lead && <strong className="font-semibold text-slate-800">{lead}</strong>} {children}
  </p>
);

export const Refunds: React.FC = () => (
  <PolicyLayout title="Refunds">
    <h2 className="text-lg font-bold text-slate-800">Digital patterns — 7 days, and you keep the file.</h2>
    <Section>
      If a pattern isn&apos;t what you expected, reply within 7 days of buying it and we&apos;ll refund you in
      full. You keep the pattern.
    </Section>
    <Section>
      Patterns are delivered to your account — nothing is posted or emailed. If a pattern you paid for never
      appears in your account, tell us and we will either fix the delivery or refund you.
    </Section>
    <Section>
      Refunds go back to the card you paid with through Stripe; how quickly it shows on your statement depends
      on your bank.
    </Section>
    <Section>
      To ask for a refund, email us at the address on the{' '}
      <a href="#/contact" className="text-blush-600 hover:text-blush-700 underline">
        Contact page
      </a>{' '}
      with the email address you used at checkout and the name of the pattern.
    </Section>
  </PolicyLayout>
);

export const Terms: React.FC = () => (
  <PolicyLayout title="Terms of Service">
    <Section lead="What we sell.">
      StitchWise Studio sells digital embroidery, quilt-block and collage patterns, and provides a
      browser-based tool for designing them. Everything is digital. Nothing is shipped.
    </Section>
    <Section lead="Receiving a pattern.">
      You do not need an account to pay. You do need one to receive a pattern: log in, or create an account,
      using the same email address you used at checkout, and the pattern appears in your account. A pattern you
      have bought stays in your account.
    </Section>
    <Section lead="Plans and allowances.">
      The Hobbyist plan is free. Paid plans are billed monthly. Each AI generation uses one unit of your
      plan&apos;s allowance, including designs the app draws itself rather than generating with AI. Current
      plans, prices and allowances are listed on the{' '}
      <a href="#/pricing" className="text-blush-600 hover:text-blush-700 underline">
        Pricing page
      </a>
      .
    </Section>
    <Section lead="Your work and your images.">
      You keep ownership of the patterns you create and the images you upload. You are responsible for having
      the right to use any image you upload — please do not upload artwork that belongs to someone else.
    </Section>
    <Section lead="Acceptable use.">
      Do not use StitchWise Studio to copy or redistribute other people&apos;s copyrighted artwork, or to
      resell our patterns as your own.
    </Section>
    <Section lead="Availability.">
      We work to keep the service running, but we do not promise uninterrupted access, and features may
      change.
    </Section>
    <Section lead="Changes.">Prices and features may change. Anything you have already bought stays yours.</Section>
  </PolicyLayout>
);

export const Privacy: React.FC = () => (
  <PolicyLayout title="Privacy">
    <Section lead="What we hold.">
      Your email address and a hashed password; the patterns and projects you save; images you upload to
      convert into a pattern; and the prompts you submit for AI generation.
    </Section>
    <Section lead="Payments.">
      Card payments are handled by Stripe. We never see or store your card number. Stripe tells us the email
      address you paid with and the amount, so we can deliver your pattern.
    </Section>
    <Section lead="Third parties.">
      We use Google&apos;s Gemini models to generate patterns from prompts and images, so those prompts and
      images are sent to Google for that purpose. We use Stripe for payments. We do not sell your personal
      information.
    </Section>
    <Section lead="Deleting your data.">
      Email us from the address on the{' '}
      <a href="#/contact" className="text-blush-600 hover:text-blush-700 underline">
        Contact page
      </a>{' '}
      and we will delete your account and the work saved in it.
    </Section>
    <Section lead="Signing in.">We store a token in your browser so you stay signed in between visits.</Section>
  </PolicyLayout>
);

export const Contact: React.FC = () => (
  <PolicyLayout title="Contact">
    <p>
      <strong className="font-semibold text-slate-800">Email:</strong>{' '}
      <a
        href="mailto:stitchwiseandco@gmail.com"
        className="text-blush-600 hover:text-blush-700 underline font-semibold"
      >
        stitchwiseandco@gmail.com
      </a>
    </p>
    <Section>
      Tell us the email address you used at checkout and what went wrong, and we will sort it out. If you are
      writing about a pattern, the pattern name helps.
    </Section>
  </PolicyLayout>
);
