import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Home } from './pages/Home';
import { SubmitProject } from './pages/SubmitProject';
import { Designer } from './pages/Designer';
import { Dashboard } from './pages/Dashboard';
import { Pricing } from './pages/Pricing';
import { ProjectDetail } from './pages/ProjectDetail';
import { FloralThemeShowcase } from './pages/FloralThemeShowcase';
import { FeaturedGallery } from './pages/FeaturedGallery';
import { CollageStudio } from './pages/CollageStudio';
import { CommunityShowcase } from './pages/CommunityShowcase';
import { Scissors, Heart, Sparkles, ShieldCheck, LayoutDashboard, CreditCard, Flower2, Image, Camera } from 'lucide-react';

/**
 * Main application component setting up routing, layout, and global styling.
 */
function App() {
  return (
    <Router>
      <div className="flex flex-col min-h-screen text-slate-800 floral-bg-pattern">
        
        {/* Navigation Header - Floral Theme */}
        <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-blush-100 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              
              {/* Logo / Brand */}
              <Link to="/" className="flex items-center gap-2 text-slate-800 hover:text-blush-600 transition-colors">
                <Scissors className="h-6 w-6 text-blush-500 -rotate-45" />
                <span className="font-extrabold tracking-tight text-lg">StitchWise <span className="text-blush-500">Studio</span></span>
              </Link>
              
              {/* Navigation Links */}
              <nav className="flex items-center gap-x-8">
                <Link to="/" className="text-sm font-medium text-slate-500 hover:text-blush-600 transition-colors">
                  Home
                </Link>
                <Link to="/dashboard" className="text-sm font-medium text-slate-500 hover:text-blush-600 transition-colors flex items-center gap-1.5">
                  <LayoutDashboard className="h-4 w-4 text-blush-400" />
                  Dashboard
                </Link>
                <Link to="/designer" className="text-sm font-medium text-slate-500 hover:text-blush-600 transition-colors flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-blush-400" />
                  Pattern Designer
                </Link>
                <Link to="/pricing" className="text-sm font-medium text-slate-500 hover:text-blush-600 transition-colors flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4 text-blush-400" />
                  Plans & Pricing
                </Link>
                <Link to="/showcase" className="text-sm font-medium text-slate-500 hover:text-blush-600 transition-colors flex items-center gap-1.5">
                  <Camera className="h-4 w-4 text-blush-400" />
                  Showcase
                </Link>
                <Link to="/gallery" className="text-sm font-medium text-slate-500 hover:text-blush-600 transition-colors flex items-center gap-1.5">
                  <Image className="h-4 w-4 text-blush-400" />
                  Gallery
                </Link>
                <Link
                  to="/submit-project"
                  className="rounded-xl bg-blush-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blush-600 hover:shadow-blush transition-all focus:outline-none focus:ring-2 focus:ring-blush-400"
                >
                  Custom Request
                </Link>
              </nav>

            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/submit-project" element={<SubmitProject />} />
            <Route path="/designer" element={<Designer />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/floral-theme" element={<FloralThemeShowcase />} />
            <Route path="/gallery" element={<FeaturedGallery />} />
            <Route path="/showcase" element={<CommunityShowcase />} />
            <Route path="/collage" element={<CollageStudio />} />
          </Routes>
        </main>

        {/* Footer - Floral Theme */}
        <footer className="bg-white/80 backdrop-blur-sm border-t border-blush-100 text-slate-500 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center border-b border-blush-100 pb-8 mb-8">
              
              <div className="flex flex-col gap-2">
                <span className="text-slate-800 font-bold text-base flex items-center gap-2">
                  <Scissors className="h-5 w-5 text-blush-500 -rotate-45" />
                  StitchWise Studio
                </span>
                <p className="text-xs text-slate-400 max-w-xs">
                  A premium SaaS platform for embroidery pattern-making, digital management, and a thriving creator marketplace.
                </p>
              </div>

              <div className="flex gap-x-6 justify-start md:justify-center text-sm">
                <Link to="/" className="text-slate-400 hover:text-blush-600 transition-colors">Home</Link>
                <Link to="/dashboard" className="text-slate-400 hover:text-blush-600 transition-colors">Dashboard</Link>
                <Link to="/designer" className="text-slate-400 hover:text-blush-600 transition-colors">Pattern Designer</Link>
                <Link to="/showcase" className="text-slate-400 hover:text-blush-600 transition-colors">Showcase</Link>
                <Link to="/pricing" className="text-slate-400 hover:text-blush-600 transition-colors">Plans & Pricing</Link>
                <Link to="/submit-project" className="text-slate-400 hover:text-blush-600 transition-colors">Custom Request</Link>
              </div>

              <div className="flex items-center gap-3 text-xs md:justify-end text-slate-400">
                <div className="flex items-center gap-1">
                  <Heart className="h-4 w-4 text-blush-400" />
                  <span>Handmade with Love</span>
                </div>
                <div className="flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4 text-blush-400" />
                  <span>100% Perfect Patterns</span>
                </div>
              </div>

            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 gap-4">
              <p>&copy; {new Date().getFullYear()} StitchWise Studio. All rights reserved.</p>
              <div className="flex items-center gap-2">
                <span className="font-bold text-blush-500">Create.</span>
                <span className="text-blush-300">Stitch.</span>
                <span className="font-bold text-blush-500">Inspire.</span>
                <span className="mx-2 text-blush-200">|</span>
                <span className="flex items-center gap-1">
                  Ref: <span className="font-mono text-blush-400">Owner Vision Verified</span>
                </span>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </Router>
  );
}

export default App;
