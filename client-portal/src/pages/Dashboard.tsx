import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, Clock, ArrowRight, ShieldCheck, Heart, Sparkles, FolderHeart, CreditCard, Crown, ShoppingBag, Star, Flower2 } from 'lucide-react';
import { Project, MarketplaceListing, api } from '../services/api';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTier, setActiveTier] = useState<string>('Hobbyist');
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [marketplaceListings, setMarketplaceListings] = useState<MarketplaceListing[]>([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const profile = await api.getUserProfile();
        setActiveTier(profile.subscriptionTier);

        const projList = await api.getProjects();
        setProjects(projList);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchMarketplace = async () => {
      try {
        setMarketplaceLoading(true);
        const listings = await api.getMarketplaceListings();
        setMarketplaceListings(listings.slice(0, 4));
      } catch (err) {
        console.error('Error fetching marketplace listings:', err);
      } finally {
        setMarketplaceLoading(false);
      }
    };

    fetchData();
    fetchMarketplace();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-floral-soft min-h-screen py-12 px-6 lg:px-8 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-blush-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-blush-600">Loading your crafting canvas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-floral-soft min-h-screen py-12 px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Dashboard Header */}
        <div className="md:flex md:items-center md:justify-between mb-10 pb-6 border-b border-blush-100">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-slate-800 sm:text-3xl sm:truncate flex items-center gap-2">
              <LayoutDashboard className="h-7 w-7 text-blush-500" />
              Crafter Dashboard
            </h2>
            <p className="mt-1 text-sm text-blush-600/70">
              Access your digital patterns, track your personal designs.
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              onClick={() => navigate('/designer')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blush-500 hover:bg-blush-600 transition-colors focus:outline-none hover:shadow-blush"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              New AI Pattern
            </button>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Content Area - Left 8 columns */}
          <div className="lg:col-span-8 space-y-12">
            
            {/* My Personal Projects Section */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <FolderHeart className="h-5 w-5 text-blush-500" />
                  My Patterns
                </h3>
                <span className="inline-flex items-center rounded-full bg-blush-50 px-2.5 py-0.5 text-xs font-medium text-blush-700">
                  {projects.length} created
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {projects.map((project) => (
                  <div 
                    key={project.id} 
                    className="bg-white rounded-2xl border border-blush-100 shadow-petal overflow-hidden hover:shadow-blush transition-all duration-200 flex flex-col h-full"
                  >
                    <div className={`h-2.5 bg-gradient-to-r ${project.previewColor}`} />
                    
                    <div className="p-6 flex-grow flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blush-50 text-blush-700">
                            {project.gridSize}
                          </span>
                          <span className="text-xs text-blush-400 font-medium flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {project.lastUpdated}
                          </span>
                        </div>

                        <Link to={`/projects/${project.id}`} className="hover:text-blush-600 transition-colors">
                          <h4 className="text-base font-bold text-slate-800 line-clamp-1 mb-1">{project.name}</h4>
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                          <span className="text-base">👑</span>
                          <span>Owner: <strong className="text-slate-700 font-semibold">{project.owner}</strong></span>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-blush-50 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <span className="inline-flex items-center rounded-full bg-blush-50 px-2 py-0.5 text-[10px] font-medium text-blush-700">
                            {project.gridSize}
                          </span>
                        </div>
                        
                        <Link
                          to={`/projects/${project.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-blush-700 bg-blush-50 hover:bg-blush-100 border border-blush-200 transition-colors"
                        >
                          Open Editor
                          <ArrowRight className="h-3.5 w-3.5 text-blush-500" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Marketplace Section */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-blush-500" />
                  Marketplace
                </h3>
                <Link to="/pricing" className="text-xs font-semibold text-blush-600 hover:text-blush-700 transition-colors flex items-center gap-1">
                  View All <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {marketplaceLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 border-2 border-blush-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : marketplaceListings.length === 0 ? (
                <div className="bg-white rounded-2xl border border-blush-100 p-8 text-center">
                  <ShoppingBag className="h-8 w-8 text-blush-300 mx-auto mb-3" />
                  <p className="text-sm text-blush-600/70">No marketplace listings available yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {marketplaceListings.map((listing) => (
                    <div 
                      key={listing.id} 
                      className="bg-white rounded-2xl border border-blush-100 shadow-petal overflow-hidden hover:shadow-blush transition-all duration-200 flex flex-col h-full"
                    >
                      <div className="h-2.5 bg-gradient-to-r from-blush-400 to-blush-300" />
                      <div className="p-5 flex-grow flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blush-50 text-blush-700">
                              <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                              {listing.rating}
                            </span>
                            <span className="text-[10px] text-blush-400 font-medium">
                              {listing.salesCount} sold
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-800 line-clamp-1 mb-1">{listing.title}</h4>
                          <p className="text-xs text-slate-500 line-clamp-2 mb-2">{listing.description}</p>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {listing.tags.slice(0, 2).map((tag) => (
                              <span key={tag} className="inline-flex items-center rounded-full bg-blush-50 px-2 py-0.5 text-[10px] font-medium text-blush-700">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-blush-50">
                          <div className="flex items-baseline gap-1">
                            <span className="text-base font-extrabold text-blush-700">${listing.price.toFixed(2)}</span>
                          </div>
                          <span className="text-[10px] text-blush-400">by {listing.designerName}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Sidebar - Right 4 columns */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Active Subscription Tier Card */}
            <div className="bg-white rounded-3xl p-6 border border-blush-100 shadow-petal relative overflow-hidden">
              <div className="absolute top-0 right-0 h-24 w-24 bg-gradient-to-bl from-blush-100 to-transparent rounded-bl-full pointer-events-none" />
              
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-4">
                <CreditCard className="h-4 w-4 text-blush-500" />
                Subscription Plan
              </h3>

              {activeTier === 'Hobbyist' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Current Tier</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-blush-50 px-2.5 py-0.5 text-xs font-extrabold text-blush-700 ring-1 ring-inset ring-blush-200">
                      Hobbyist (Free)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    You are currently using our basic free tools, limited to a 16x16 grid canvas, standard DMC color palettes, and PDF hand embroidery exports.
                  </p>
                  <div className="bg-rose-50 rounded-2xl p-4 border border-rose-100/50">
                    <h4 className="text-xs font-bold text-rose-800 flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-rose-500 animate-pulse" />
                      Unlock AI Pattern Digitizer
                    </h4>
                    <p className="text-[10px] text-rose-700 leading-relaxed mt-1">
                      Upgrade to **Pro Crafter** to access unlimited AI generations, thread usage estimation, and machine files (.DST, .PES, .EXP) export!
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/pricing')}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blush-500 hover:bg-blush-600 shadow-sm hover:shadow-blush hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    View Plans & Upgrade
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : activeTier === 'Pro Crafter' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Current Tier</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-extrabold text-amber-700 ring-1 ring-inset ring-amber-600/10 animate-pulse">
                      <Crown className="h-3 w-3 text-amber-500" />
                      Pro Crafter
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    ✓ **Premium Features Active**: You have unlimited AI pattern generations, domestic and commercial machine exports (.PES, .DST, .EXP), thread usage estimators, and solo designer workspaces!
                  </p>
                  <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100/50 flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-emerald-800">100% Active</h4>
                      <p className="text-[10px] text-emerald-700">Billing active at $19/mo (or $15/mo annually)</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/pricing')}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-blush-700 bg-blush-50 hover:bg-blush-100 border border-blush-200 transition-all active:scale-95"
                  >
                    Manage Subscription
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Current Tier</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-extrabold text-indigo-700 ring-1 ring-inset ring-indigo-600/10">
                      <Crown className="h-3 w-3 text-indigo-500" />
                      Design Studio
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    ✓ **Commercial Studio active**: Full commercial use licenses, high priority AI queue, bulk image-to-stitch processing, up to 5 team seats, and developer API access are unlocked.
                  </p>
                  <button
                    onClick={() => navigate('/pricing')}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-blush-700 bg-blush-50 hover:bg-blush-100 border border-blush-200 transition-all active:scale-95"
                  >
                    Manage Subscription
                  </button>
                </div>
              )}
            </div>

            {/* Quick Stats / Info Widget - Light pink version */}
            <div className="bg-gradient-to-br from-white via-blush-50 to-blush-100 rounded-3xl p-6 shadow-petal border border-blush-100 relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.08),transparent)] pointer-events-none" />
              
              <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2 mb-4">
                <Heart className="h-5 w-5 text-blush-500 animate-pulse" />
                My Studio
              </h3>
              
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Design and refine your personal embroidery patterns with precision tools. Fine-tune every stitch layout, thread selection, and style in your private workspace.
              </p>

              <div className="space-y-3 mt-6">
                <div className="flex items-center gap-3 p-3 bg-white/70 rounded-xl border border-blush-100">
                  <div className="h-8 w-8 rounded-lg bg-blush-100 text-blush-500 flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-700">Create New Pattern</h4>
                    <p className="text-[10px] text-slate-500">Design custom motifs from images or scratch</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-white/70 rounded-xl border border-blush-100">
                  <div className="h-8 w-8 rounded-lg bg-blush-100 text-blush-500 flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-700">Drag & Drop Layers</h4>
                    <p className="text-[10px] text-slate-500">Organize fabric pieces on your digital canvas</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-white/70 rounded-xl border border-blush-100">
                  <div className="h-8 w-8 rounded-lg bg-blush-100 text-blush-500 flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-700">Export & Share</h4>
                    <p className="text-[10px] text-slate-500">Download your finished design as a pattern file</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quality Standard Banner */}
            <div className="bg-white rounded-3xl p-6 border border-blush-100 shadow-petal">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mb-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                StitchWise Certified
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                All patterns on the StitchWise platform are validated to prevent overlaps and guarantee compatibility with industrial machines (.DST) and domestic home loops (.PES).
              </p>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
