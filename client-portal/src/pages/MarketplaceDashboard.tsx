import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Store, 
  Tag, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  TrendingUp, 
  DollarSign, 
  Download, 
  Check, 
  Save, 
  Plus, 
  Trash2,
  AlertCircle,
  Crown
} from 'lucide-react';

interface MarketplacePattern {
  id: string;
  name: string;
  gridSize: string;
  stitchCount: number;
  primaryStitchType: 'cross' | 'satin' | 'back' | 'french';
  createdAt: string;
  price: number;
  isPublic: boolean;
  downloads: number;
  earnings: number;
  previewGradient: string;
}

export const MarketplaceDashboard: React.FC = () => {

  // Mock initial patterns listed by the designer
  const [patterns, setPatterns] = useState<MarketplacePattern[]>([
    {
      id: 'enchanted-rose',
      name: 'Enchanted Rose Heart',
      gridSize: '16x16 Grid',
      stitchCount: 2200,
      primaryStitchType: 'satin',
      createdAt: '2026-06-15',
      price: 12.99,
      isPublic: true,
      downloads: 48,
      earnings: 623.52,
      previewGradient: 'from-rose-500 to-red-600',
    },
    {
      id: 'sunflower-cross',
      name: 'Sunny Sunflower Cross-Stitch',
      gridSize: '16x16 Grid',
      stitchCount: 1500,
      primaryStitchType: 'cross',
      createdAt: '2026-06-20',
      price: 8.50,
      isPublic: true,
      downloads: 32,
      earnings: 272.00,
      previewGradient: 'from-amber-400 to-yellow-600',
    },
    {
      id: 'geometric-mandala',
      name: 'Geometric Purple Mandala',
      gridSize: '32x32 Grid',
      stitchCount: 5400,
      primaryStitchType: 'back',
      createdAt: '2026-06-02',
      price: 19.99,
      isPublic: false,
      downloads: 12,
      earnings: 239.88,
      previewGradient: 'from-violet-500 to-indigo-600',
    },
    {
      id: 'forest-firs',
      name: 'Autumn Forest Pines',
      gridSize: '16x16 Grid',
      stitchCount: 1800,
      primaryStitchType: 'cross',
      createdAt: '2026-06-22',
      price: 6.99,
      isPublic: false,
      downloads: 0,
      earnings: 0.00,
      previewGradient: 'from-emerald-500 to-teal-700',
    }
  ]);

  // States for interactive forms and feedback
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // New pattern state
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('5.99');
  const [newStitchType, setNewStitchType] = useState<'cross' | 'satin' | 'back' | 'french'>('satin');
  const [newGridSize, setNewGridSize] = useState('16x16 Grid');

  // Trigger a brief flash notification
  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // Toggle Visibility Handler
  const handleToggleVisibility = (id: string) => {
    setPatterns(prev => prev.map(pattern => {
      if (pattern.id === id) {
        const nextState = !pattern.isPublic;
        showNotification(`API Simulation: "${pattern.name}" set to ${nextState ? 'PUBLIC' : 'PRIVATE'}`);
        return { ...pattern, isPublic: nextState };
      }
      return pattern;
    }));
  };

  // Price Edit Handlers
  const startEditingPrice = (id: string, currentPrice: number) => {
    setEditingPriceId(id);
    setTempPrice(currentPrice.toString());
  };

  const savePrice = (id: string) => {
    const parsedPrice = parseFloat(tempPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      alert('Please enter a valid price');
      return;
    }

    setPatterns(prev => prev.map(pattern => {
      if (pattern.id === id) {
        showNotification(`API Simulation: Price for "${pattern.name}" updated to $${parsedPrice.toFixed(2)}`);
        return { ...pattern, price: parsedPrice };
      }
      return pattern;
    }));
    setEditingPriceId(null);
  };

  // Delete Handler
  const handleDeletePattern = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove "${name}" from your portfolio?`)) {
      setPatterns(prev => prev.filter(pattern => pattern.id !== id));
      showNotification(`API Simulation: Removed "${name}" from listings`);
    }
  };

  // Add Pattern Handler
  const handleAddPattern = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const parsedPrice = parseFloat(newPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      alert('Please enter a valid price');
      return;
    }

    const gradients = [
      'from-fuchsia-500 to-purple-600',
      'from-cyan-400 to-blue-600',
      'from-orange-400 to-amber-600',
      'from-pink-500 to-rose-600'
    ];
    const randomGradient = gradients[Math.floor(Math.random() * gradients.length)];

    const newPattern: MarketplacePattern = {
      id: `pattern-${Date.now()}`,
      name: newName,
      gridSize: newGridSize,
      stitchCount: Math.floor(Math.random() * 4000) + 1200,
      primaryStitchType: newStitchType,
      createdAt: new Date().toISOString().split('T')[0],
      price: parsedPrice,
      isPublic: true,
      downloads: 0,
      earnings: 0.00,
      previewGradient: randomGradient
    };

    setPatterns(prev => [newPattern, ...prev]);
    setIsAddModalOpen(false);
    setNewName('');
    showNotification(`API Simulation: Created and listed "${newName}" successfully!`);
  };

  // Calculated Stats
  const totalEarnings = patterns.reduce((sum, p) => sum + p.earnings, 0);
  const totalDownloads = patterns.reduce((sum, p) => sum + p.downloads, 0);
  const activeListingsCount = patterns.filter(p => p.isPublic).length;
  const platformFee = totalEarnings * 0.15; // 15% commission as in business plan
  const netEarnings = totalEarnings - platformFee;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-12">
      {/* Header */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 sticky top-0 backdrop-blur-md z-30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                to="/dashboard" 
                className="text-slate-400 hover:text-white transition-colors p-1.5 hover:bg-slate-800/60 rounded-lg flex items-center gap-1.5 text-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-blush-500" />
              <span className="font-extrabold tracking-tight text-md text-white">Creator <span className="text-blush-500">Marketplace</span></span>
              <span className="bg-brand-500/20 text-blush-400 text-[10px] font-extrabold px-2 py-0.5 rounded border border-blush-500/30">ALPHA</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blush-950 via-slate-900 to-indigo-950 border border-slate-800 p-8 md:p-10 mb-8 shadow-xl">
          <div className="relative z-10 max-w-2xl">
            <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Designer Portfolios & Marketplace
            </h1>
            <p className="mt-4 text-base text-slate-300 leading-relaxed">
              Earn residuals by publishing your collaborative pattern grids to the StitchWise Public Catalog. 
              Set customized prices, track download counts, and manage listing statuses in real-time.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-blush-500 hover:bg-blush-600 px-4 py-2 text-sm font-bold text-white shadow transition-all focus:outline-none"
              >
                <Plus className="h-4 w-4" />
                List New Pattern
              </button>
              <div className="flex items-center gap-2 text-xs font-semibold text-blush-400 bg-blush-500/10 rounded-lg border border-blush-500/20 px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                15% platform commission applies to public sales as per platform guidelines.
              </div>
            </div>
          </div>
          <div className="absolute top-0 right-0 h-full w-1/3 opacity-10 bg-radial-gradient from-brand-500 to-transparent pointer-events-none" />
        </div>

        {/* Notifications Bar */}
        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold flex items-center gap-3 animate-fade-in shadow-md">
            <Check className="h-5 w-5 shrink-0 bg-emerald-500/20 rounded-full p-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {/* Stat 1 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700/60 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400 font-medium">Active Public Listings</span>
              <div className="p-2 bg-blush-500/10 rounded-lg border border-blush-500/20">
                <Tag className="h-4 w-4 text-blush-400" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{activeListingsCount}</span>
              <span className="text-xs text-slate-500">of {patterns.length} total</span>
            </div>
          </div>

          {/* Stat 2 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700/60 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400 font-medium">Total Downloads</span>
              <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                <Download className="h-4 w-4 text-cyan-400" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{totalDownloads}</span>
              <span className="text-xs text-cyan-500 font-bold flex items-center gap-0.5">
                <TrendingUp className="h-3 w-3" />
                +12% this wk
              </span>
            </div>
          </div>

          {/* Stat 3 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700/60 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400 font-medium">Gross Revenue</span>
              <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                <DollarSign className="h-4 w-4 text-indigo-400" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">${totalEarnings.toFixed(2)}</span>
              <span className="text-xs text-slate-500">before fees</span>
            </div>
          </div>

          {/* Stat 4 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700/60 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400 font-medium">Net Earnings (85%)</span>
              <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                <Crown className="h-4 w-4 text-emerald-400" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-400">${netEarnings.toFixed(2)}</span>
              <span className="text-xs text-slate-500">-${platformFee.toFixed(2)} fees</span>
            </div>
          </div>
        </div>

        {/* Patterns List Table / Grid */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Store className="h-5 w-5 text-blush-500" />
              Your Publicly and Privately Listed Assets
            </h2>
            <div className="text-xs text-slate-400 font-medium bg-slate-800 px-3 py-1.5 rounded-lg">
              Catalog Sync Status: <span className="text-blush-400 font-bold">State Managed Alpha</span>
            </div>
          </div>

          {patterns.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Tag className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-300">No patterns found</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
                You haven't listed any embroidery pattern designs to the marketplace yet. Paint a design in the Workshop, then add it here!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] table-auto text-left text-sm text-slate-300">
                <thead className="bg-slate-950 text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-4 px-6">Pattern Design</th>
                    <th className="py-4 px-6">Primary Stitch</th>
                    <th className="py-4 px-6">Stats</th>
                    <th className="py-4 px-6">Visibility</th>
                    <th className="py-4 px-6">Price</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {patterns.map((pattern) => {
                    const isEditingPrice = editingPriceId === pattern.id;
                    return (
                      <tr key={pattern.id} className="hover:bg-slate-800/20 transition-all duration-700">
                        {/* Title & Preview */}
                        <td className="py-4 px-6 flex items-center gap-4">
                          <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${pattern.previewGradient} flex items-center justify-center border border-white/10 shrink-0 font-extrabold text-white text-base shadow`}>
                            {pattern.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm hover:text-blush-400 cursor-pointer transition-colors">
                              {pattern.name}
                            </div>
                            <div className="text-slate-400 text-xs mt-0.5 flex items-center gap-1.5 font-semibold">
                              <span>{pattern.gridSize}</span>
                              <span className="h-1 w-1 rounded-full bg-slate-600" />
                              <span>{pattern.stitchCount.toLocaleString()} stitches</span>
                            </div>
                          </div>
                        </td>

                        {/* Stitch Type Badge */}
                        <td className="py-4 px-6">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border capitalize ${
                            pattern.primaryStitchType === 'satin' ? 'bg-blush-500/10 border-blush-500/20 text-blush-400' :
                            pattern.primaryStitchType === 'cross' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
                            pattern.primaryStitchType === 'back' ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' :
                            'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          }`}>
                            {pattern.primaryStitchType === 'satin' ? 'Satin Fill' : pattern.primaryStitchType}
                          </span>
                        </td>

                        {/* Downloads and Earnings */}
                        <td className="py-4 px-6">
                          <div className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                            <Download className="h-3 w-3 text-slate-500" />
                            <span>{pattern.downloads} dls</span>
                          </div>
                          <div className="text-[11px] text-emerald-400 font-bold mt-1 flex items-center gap-0.5">
                            <DollarSign className="h-3 w-3 shrink-0" />
                            <span>${pattern.earnings.toFixed(2)} earned</span>
                          </div>
                        </td>

                        {/* Toggle Visibility Switch */}
                        <td className="py-4 px-6">
                          <button
                            onClick={() => handleToggleVisibility(pattern.id)}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold border transition-all ${
                              pattern.isPublic 
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' 
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            {pattern.isPublic ? (
                              <>
                                <Eye className="h-3.5 w-3.5" />
                                Public
                              </>
                            ) : (
                              <>
                                <EyeOff className="h-3.5 w-3.5" />
                                Private
                              </>
                            )}
                          </button>
                        </td>

                        {/* Interactive Price Input */}
                        <td className="py-4 px-6">
                          {isEditingPrice ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-500 font-bold">$</span>
                              <input
                                type="text"
                                value={tempPrice}
                                onChange={(e) => setTempPrice(e.target.value)}
                                className="w-16 bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-blush-500 focus:outline-none rounded-md px-1.5 py-1 text-xs font-bold text-center text-white"
                              />
                              <button
                                onClick={() => savePrice(pattern.id)}
                                className="p-1 rounded-md bg-blush-500 hover:bg-blush-600 text-white transition-colors"
                                title="Save Price"
                              >
                                <Save className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="group flex items-center gap-2">
                              <span className="font-extrabold text-sm text-white">${pattern.price.toFixed(2)}</span>
                              <button
                                onClick={() => startEditingPrice(pattern.id, pattern.price)}
                                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white transition-opacity text-xs font-medium border border-slate-800 hover:border-slate-700 bg-slate-950 rounded px-1.5 py-0.5"
                              >
                                Edit
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => handleDeletePattern(pattern.id, pattern.name)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors inline-block"
                            title="Delete Listing"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Listing Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl animate-scale-up">
            <h3 className="text-xl font-extrabold text-white mb-2 flex items-center gap-2">
              <Store className="h-5 w-5 text-blush-500" />
              List Pattern on Marketplace
            </h3>
            <p className="text-slate-400 text-xs mb-6 leading-relaxed">
              Fill in the parameters below to catalog your active stitch file. High-fidelity patterns with satin auto-fills generate larger download yields.
            </p>

            <form onSubmit={handleAddPattern} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Pattern Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Vintage Winter Snowflake"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blush-500 focus:outline-none rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Grid Size</label>
                  <select
                    value={newGridSize}
                    onChange={(e) => setNewGridSize(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blush-500 focus:outline-none rounded-lg px-3 py-2 text-sm text-white font-medium"
                  >
                    <option value="16x16 Grid">16x16 Grid</option>
                    <option value="32x32 Grid">32x32 Grid</option>
                    <option value="64x64 Grid">64x64 Grid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Stitch Style</label>
                  <select
                    value={newStitchType}
                    onChange={(e) => setNewStitchType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blush-500 focus:outline-none rounded-lg px-3 py-2 text-sm text-white font-medium capitalize"
                  >
                    <option value="satin">Satin Fill</option>
                    <option value="cross">Cross Stitch</option>
                    <option value="back">Back Stitch</option>
                    <option value="french">French Knot</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Price (USD)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-bold">$</div>
                  <input
                    type="text"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="5.99"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blush-500 focus:outline-none rounded-lg pl-8 pr-3 py-2 text-sm text-white font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 rounded-lg border border-slate-800 hover:bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white transition-all focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-blush-500 hover:bg-blush-600 px-4 py-2 text-sm font-extrabold text-white transition-all focus:outline-none shadow-md"
                >
                  Submit Listing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
