import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Home } from './pages/Home';
import { SubmitProject } from './pages/SubmitProject';
import { Designer } from './pages/Designer';
import { Dashboard } from './pages/Dashboard';
import { Scissors, Heart, Sparkles, ShieldCheck, LayoutDashboard } from 'lucide-react';

/**
 * Main application component setting up routing, layout, and global styling.
 */
function App() {
  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900">
        
        {/* Navigation Header */}
        <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              
              {/* Logo / Brand */}
              <Link to="/" className="flex items-center gap-2 text-white hover:text-brand-400 transition-colors">
                <Scissors className="h-6 w-6 text-brand-500 -rotate-45" />
                <span className="font-extrabold tracking-tight text-lg">StitchWise <span className="text-brand-500">Studio</span></span>
              </Link>
              
              {/* Navigation Links */}
              <nav className="flex items-center gap-x-8">
                <Link to="/" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                  Home
                </Link>
                <Link to="/dashboard" className="text-sm font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1.5">
                  <LayoutDashboard className="h-4 w-4 text-brand-500" />
                  Dashboard
                </Link>
                <Link to="/designer" className="text-sm font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-brand-500" />
                  Pattern Designer
                </Link>
                <Link
                  to="/submit-project"
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-500 transition-all focus:outline-none focus:ring-2 focus:ring-brand-500"
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
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-slate-950 text-slate-400 border-t border-slate-900 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center border-b border-slate-900 pb-8 mb-8">
              
              <div className="flex flex-col gap-2">
                <span className="text-white font-bold text-base flex items-center gap-2">
                  <Scissors className="h-5 w-5 text-brand-500 -rotate-45" />
                  StitchWise Studio
                </span>
                <p className="text-xs text-slate-400 max-w-xs">
                  A premium SaaS platform for embroidery pattern-making, digital management, and a thriving creator marketplace.
                </p>
              </div>

              <div className="flex gap-x-6 justify-start md:justify-center text-sm">
                <Link to="/" className="hover:text-white transition-colors">Home</Link>
                <Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
                <Link to="/designer" className="hover:text-white transition-colors">Pattern Designer</Link>
                <Link to="/submit-project" className="hover:text-white transition-colors">Custom Request</Link>
              </div>

              <div className="flex items-center gap-3 text-xs md:justify-end text-slate-400">
                <div className="flex items-center gap-1">
                  <Heart className="h-4 w-4 text-brand-500" />
                  <span>Handmade with Love</span>
                </div>
                <div className="flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4 text-brand-500" />
                  <span>100% Perfect Patterns</span>
                </div>
              </div>

            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-4">
              <p>&copy; {new Date().getFullYear()} StitchWise Studio. All rights reserved.</p>
              <p className="flex items-center gap-1">
                Ref: <span className="font-mono text-slate-400">Owner Vision Verified</span>
              </p>
            </div>
          </div>
        </footer>

      </div>
    </Router>
  );
}

export default App;
