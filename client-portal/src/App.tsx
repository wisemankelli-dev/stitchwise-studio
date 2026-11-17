import { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { SubmitProject } from './pages/SubmitProject';
import { Designer } from './pages/Designer';
import { Dashboard } from './pages/Dashboard';
import { Pricing } from './pages/Pricing';
import { ProjectDetail } from './pages/ProjectDetail';
import { FloralThemeShowcase } from './pages/FloralThemeShowcase';
import { CollageStudio } from './pages/CollageStudio';
import { CommunityShowcase } from './pages/CommunityShowcase';
import { QuiltBlockStudio } from './pages/QuiltBlockStudio';
import { PatternLibrary } from './pages/PatternLibrary';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Refunds, Terms, Privacy, Contact } from './pages/Policies';
import { PolicyLinks } from './components/PolicyLinks';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Scissors, Heart, Sparkles, ShieldCheck, LayoutDashboard, CreditCard, Flower2, Camera, Grid3X3, LogIn, UserPlus, LogOut, User, ShoppingBag, Menu, X } from 'lucide-react';
import { FloralDivider, DecorativeFlower } from './components/DecorativeSVGs';

/**
 * Inner app content that has access to auth context.
 * Separated so the header/nav can react to auth state.
 */
function AppContent() {
  const { currentUser, isAuthenticated, logout } = useAuth();
  /** Phone/tablet nav: the desktop row needs ~1250px, so it collapses below xl. */
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Any navigation closes the panel, so a tap never leaves it open behind the page.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex flex-col min-h-screen text-slate-800 bg-gradient-to-b from-white via-blush-50/30 to-white">
      
      {/* ===== GLOBAL FLORAL PATTERN WATERMARK ===== */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.02]">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="global-floral" x="0" y="0" width="160" height="160" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="12" fill="#f472b6" />
              <circle cx="30" cy="30" r="6" fill="#f9a8d4" />
              <circle cx="80" cy="80" r="16" fill="#f472b6" />
              <circle cx="80" cy="80" r="8" fill="#f9a8d4" />
              <circle cx="130" cy="30" r="12" fill="#f472b6" />
              <circle cx="130" cy="30" r="6" fill="#f9a8d4" />
              <circle cx="30" cy="130" r="10" fill="#f472b6" />
              <circle cx="130" cy="130" r="10" fill="#f472b6" />
              <path d="M75 75 L85 85 M85 75 L75 85" stroke="#f472b6" strokeWidth="1.5" opacity="0.4" />
              <path d="M125 25 L135 35 M135 25 L125 35" stroke="#f472b6" strokeWidth="1.5" opacity="0.4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#global-floral)" />
        </svg>
      </div>

      {/* ===== NAVIGATION HEADER ===== */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-blush-100 shadow-sm shadow-blush-100/20">
        {/* Subtle top accent line */}
        <div className="h-0.5 bg-gradient-to-r from-blush-300 via-blush-500 to-blush-300" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex items-center justify-between gap-3 h-16">

            {/* Logo / Brand with image */}
            <Link to="/" className="flex items-center gap-2 sm:gap-3 min-w-0 group">
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-blush-200/40 rounded-full blur-sm group-hover:bg-blush-300/50 transition-colors duration-300" />
                <img
                  src="/logo.png"
                  alt="StitchWise Studio"
                  className="relative h-9 w-9 rounded-full object-cover ring-2 ring-white shadow-md group-hover:ring-blush-200 transition-all duration-300"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold tracking-tight text-sm sm:text-base leading-tight whitespace-nowrap">
                  StitchWise <span className="text-blush-500">Studio</span>
                </span>
                <span className="text-[9px] text-blush-400 tracking-wider uppercase font-semibold whitespace-nowrap">Create. Stitch. Inspire.</span>
              </div>
            </Link>

            {/* === DESKTOP NAV (xl and up — the row needs ~1250px) === */}
            <nav className="hidden xl:flex items-center gap-x-4 2xl:gap-x-6">
              {/* === CORE DESIGN TOOLS (primary) === */}
              <Link to="/designer" className="flex items-center gap-1.5 rounded-lg bg-blush-50/70 px-3 py-1.5 text-sm font-semibold text-blush-700 hover:bg-blush-100 hover:text-blush-800 transition-all duration-200 border border-blush-200/40">
                <Sparkles className="h-4 w-4 text-blush-500" />
                Pattern Designer
              </Link>
              <Link to="/collage" className="flex items-center gap-1.5 rounded-lg bg-blush-50/70 px-3 py-1.5 text-sm font-semibold text-blush-700 hover:bg-blush-100 hover:text-blush-800 transition-all duration-200 border border-blush-200/40">
                <Scissors className="h-4 w-4 text-blush-500" />
                Collage Studio
              </Link>
              <Link to="/quilt-block" className="flex items-center gap-1.5 rounded-lg bg-blush-50/70 px-3 py-1.5 text-sm font-semibold text-blush-700 hover:bg-blush-100 hover:text-blush-800 transition-all duration-200 border border-blush-200/40">
                <Grid3X3 className="h-4 w-4 text-blush-500" />
                Quilt Blocks
              </Link>

              {/* === SECONDARY LINKS === */}
              <div className="h-5 w-px bg-slate-200 mx-1"></div>
              <Link to="/pricing" className="text-sm font-medium text-slate-400 hover:text-blush-500 transition-colors flex items-center gap-1.5 whitespace-nowrap">
                <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                Plans &amp; Pricing
              </Link>
              <Link to="/patterns" className="text-sm font-medium text-slate-400 hover:text-blush-500 transition-colors flex items-center gap-1.5 whitespace-nowrap">
                <ShoppingBag className="h-3.5 w-3.5 text-slate-400" />
                Pattern Shop
              </Link>
              <Link to="/dashboard" className="text-sm font-medium text-slate-500 hover:text-blush-600 transition-colors flex items-center gap-1.5 whitespace-nowrap">
                <LayoutDashboard className="h-4 w-4 text-blush-400" />
                Dashboard
              </Link>
              <Link to="/showcase" className="text-sm font-medium text-slate-400 hover:text-blush-500 transition-colors flex items-center gap-1.5 whitespace-nowrap">
                <Camera className="h-3.5 w-3.5 text-slate-400" />
                Showcase
              </Link>

              {/* === AUTH LINKS === */}
              <div className="h-5 w-px bg-slate-200 mx-1"></div>

              {isAuthenticated ? (
                <>
                  {/* User indicator */}
                  <span className="flex items-center gap-1.5 text-sm font-medium text-slate-600 whitespace-nowrap">
                    <User className="h-4 w-4 text-blush-400" />
                    <span className="hidden 2xl:inline">{currentUser?.name || 'Crafter'}</span>
                  </span>
                  <button
                    onClick={logout}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden 2xl:inline">Logout</span>
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-blush-600 hover:text-blush-700 hover:bg-blush-50 transition-all duration-200">
                    <LogIn className="h-4 w-4" />
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    className="rounded-xl bg-gradient-to-r from-blush-500 to-blush-400 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blush-200/40 hover:shadow-lg hover:shadow-blush-300/40 hover:from-blush-600 hover:to-blush-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blush-400 whitespace-nowrap"
                  >
                    <span className="flex items-center gap-1.5">
                      <UserPlus className="h-4 w-4" />
                      Sign Up
                    </span>
                  </Link>
                </>
              )}

              {/* === CTA BUTTON === */}
              <Link
                to="/submit-project"
                className="rounded-xl bg-gradient-to-r from-blush-500 to-blush-400 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blush-200/40 hover:shadow-lg hover:shadow-blush-300/40 hover:from-blush-600 hover:to-blush-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blush-400 whitespace-nowrap"
              >
                Custom Request
              </Link>
            </nav>

            {/* === PHONE / TABLET: hamburger === */}
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="xl:hidden shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-xl border border-blush-200/70 bg-blush-50/70 text-blush-700 hover:bg-blush-100 transition-colors"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

          </div>
        </div>

        {/* === PHONE / TABLET: collapsible panel === */}
        {menuOpen && (
          <div id="mobile-nav" className="xl:hidden border-t border-blush-100 bg-white/95 backdrop-blur-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-1">
              <Link to="/designer" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-blush-700 hover:bg-blush-50">
                <Sparkles className="h-4 w-4 text-blush-500" /> Pattern Designer
              </Link>
              <Link to="/collage" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-blush-700 hover:bg-blush-50">
                <Scissors className="h-4 w-4 text-blush-500" /> Collage Studio
              </Link>
              <Link to="/quilt-block" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-blush-700 hover:bg-blush-50">
                <Grid3X3 className="h-4 w-4 text-blush-500" /> Quilt Blocks
              </Link>
              <div className="h-px bg-blush-100 my-2" />
              <Link to="/patterns" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-blush-50">
                <ShoppingBag className="h-4 w-4 text-slate-400" /> Pattern Shop
              </Link>
              <Link to="/pricing" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-blush-50">
                <CreditCard className="h-4 w-4 text-slate-400" /> Plans &amp; Pricing
              </Link>
              <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-blush-50">
                <LayoutDashboard className="h-4 w-4 text-slate-400" /> Dashboard
              </Link>
              <Link to="/showcase" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-blush-50">
                <Camera className="h-4 w-4 text-slate-400" /> Showcase
              </Link>
              <Link to="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-blush-50">
                <Heart className="h-4 w-4 text-slate-400" /> Home
              </Link>

              <div className="h-px bg-blush-100 my-2" />
              <div className="flex flex-col gap-2 pb-1">
                {isAuthenticated ? (
                  <>
                    <span className="flex items-center gap-2 px-3 py-1 text-sm font-medium text-slate-600">
                      <User className="h-4 w-4 text-blush-400" /> {currentUser?.name || 'Crafter'}
                    </span>
                    <button
                      onClick={() => { logout(); setMenuOpen(false); }}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-blush-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-blush-50"
                    >
                      <LogOut className="h-4 w-4" /> Logout
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setMenuOpen(false)} className="flex items-center justify-center gap-1.5 rounded-xl border border-blush-200 px-4 py-2.5 text-sm font-semibold text-blush-700 hover:bg-blush-50">
                      <LogIn className="h-4 w-4" /> Login
                    </Link>
                    <Link to="/signup" onClick={() => setMenuOpen(false)} className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blush-500 to-blush-400 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blush-200/40">
                      <UserPlus className="h-4 w-4" /> Sign Up
                    </Link>
                  </>
                )}
                <Link to="/submit-project" onClick={() => setMenuOpen(false)} className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blush-500 to-blush-400 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blush-200/40">
                  Custom Request
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ===== PAGE CONTENT ===== */}
      <main className="flex-grow relative z-10">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/submit-project" element={<SubmitProject />} />
          <Route path="/designer" element={
            <ProtectedRoute><Designer /></ProtectedRoute>
          } />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/patterns" element={<PatternLibrary />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/floral-theme" element={<FloralThemeShowcase />} />
          <Route path="/showcase" element={<CommunityShowcase />} />
          <Route path="/quilt-block" element={<QuiltBlockStudio />} />
          <Route path="/collage" element={<CollageStudio />} />

          {/* ===== PUBLIC POLICY PAGES (no login required) ===== */}
          <Route path="/refunds" element={<Refunds />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="relative z-10 bg-gradient-to-t from-blush-50/80 to-white/80 backdrop-blur-sm border-t border-blush-100 text-slate-500 pt-16 pb-8">
        {/* Decorative top divider */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blush-300 to-transparent" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 items-start border-b border-blush-100 pb-10 mb-8">
            
            {/* Brand column */}
            <div className="flex flex-col gap-3 md:col-span-1">
              <Link to="/" className="flex items-center gap-2 group">
                <img
                  src="/logo.png"
                  alt="StitchWise Studio"
                  className="h-9 w-9 rounded-full object-cover ring-2 ring-white shadow-md"
                />
                <span className="text-slate-800 font-bold text-base">StitchWise Studio</span>
              </Link>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                A premium platform for embroidery pattern-making, collage quilting, quilt block design, and a thriving creator marketplace.
              </p>
              <div className="flex items-center gap-2 text-blush-300 mt-1">
                <Flower2 className="h-4 w-4" />
                <span className="text-[10px] italic">Handmade with love for crafters</span>
              </div>
            </div>

            {/* Navigation links */}
            <div className="md:col-span-2">
              <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
                <Link to="/designer" className="text-blush-500 hover:text-blush-600 transition-colors font-medium">Pattern Designer</Link>
                <Link to="/collage" className="text-blush-500 hover:text-blush-600 transition-colors font-medium">Collage Studio</Link>
                <Link to="/quilt-block" className="text-blush-500 hover:text-blush-600 transition-colors font-medium">Quilt Blocks</Link>
                <Link to="/" className="text-slate-400 hover:text-blush-600 transition-colors">Home</Link>
                <Link to="/login" className="text-slate-400 hover:text-blush-600 transition-colors">Login</Link>
                <Link to="/signup" className="text-slate-400 hover:text-blush-600 transition-colors">Sign Up</Link>
                <Link to="/pricing" className="text-slate-400 hover:text-blush-600 transition-colors">Plans & Pricing</Link>
                <Link to="/dashboard" className="text-slate-400 hover:text-blush-600 transition-colors">Dashboard</Link>
                <Link to="/showcase" className="text-slate-400 hover:text-blush-600 transition-colors">Showcase</Link>
                <Link to="/submit-project" className="text-slate-400 hover:text-blush-600 transition-colors">Custom Request</Link>
              </div>
              <div className="mt-4">
                <FloralDivider />
              </div>
            </div>

            {/* Trust badges */}
            <div className="flex flex-col gap-3 md:items-end">
              <div className="flex items-center gap-2 text-xs">
                <Heart className="h-4 w-4 text-blush-400" />
                <span className="text-slate-400">Handmade with Love</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <ShieldCheck className="h-4 w-4 text-blush-400" />
                <span className="text-slate-400">100% Perfect Patterns</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <DecorativeFlower size={16} />
                <span className="text-slate-400">Creator Approved</span>
              </div>
            </div>

          </div>

          {/* Bottom bar */}
          <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 gap-4">
            <p>&copy; {new Date().getFullYear()} StitchWise Studio. All rights reserved.</p>
            <div className="flex items-center gap-3">
              <span className="font-bold text-blush-500">Create.</span>
              <span className="text-blush-300">Stitch.</span>
              <span className="font-bold text-blush-500">Inspire.</span>
              <span className="mx-1 text-blush-200">|</span>
              <span className="flex items-center gap-1">
                Ref: <span className="font-mono text-blush-400">Owner Vision Verified</span>
              </span>
            </div>
          </div>

          {/* Policy links — on every public page */}
          <PolicyLinks className="mt-6" />
        </div>
      </footer>

    </div>
  );
}

/**
 * Main application component — feminine floral aesthetic with logo and rich backgrounds.
 *
 * Wrapped with AuthProvider so all components can access auth state.
 * AuthContent is split out so the header/nav can react to isAuthenticated.
 */
function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
