import React, { useState } from 'react';
import {
  Sparkles, Heart, ShoppingBag, Users, Palette, Download,
  ArrowRight, Star, Clock, Flower2, Eye, Share2, RotateCcw
} from 'lucide-react';

/**
 * FloralThemeShowcase - A design exploration page showcasing the feminine,
 * white-and-pink floral theme applied to Marketplace and Workshop component mockups.
 *
 * This is a "look and feel" demonstration for owner vision alignment.
 */
export const FloralThemeShowcase: React.FC = () => {
  const [activeView, setActiveView] = useState<'marketplace' | 'workshop'>('marketplace');

  // --- Mock Marketplace Listings ---
  const marketplaceItems = [
    {
      id: '1',
      title: 'Spring Floral Wreath',
      designer: 'Elena Crafter',
      price: 8.99,
      rating: 4.9,
      sales: 342,
      tags: ['Floral', 'Wreath', 'Beginner'],
      gradient: 'from-blush-400 to-blush-200',
      icon: '🌸',
    },
    {
      id: '2',
      title: 'Vintage Rose Border',
      designer: 'StitchMaster Pro',
      price: 12.50,
      rating: 4.8,
      sales: 187,
      tags: ['Vintage', 'Border', 'Intermediate'],
      gradient: 'from-blush-500 to-rose-300',
      icon: '🌹',
    },
    {
      id: '3',
      title: 'Botanical Garden Sampler',
      designer: 'Dave Digitizer',
      price: 14.99,
      rating: 4.7,
      sales: 93,
      tags: ['Botanical', 'Sampler', 'Advanced'],
      gradient: 'from-blush-300 to-pink-200',
      icon: '🌿',
    },
    {
      id: '4',
      title: 'Peony Love Heart',
      designer: 'Sofia R.',
      price: 6.99,
      rating: 4.9,
      sales: 521,
      tags: ['Heart', 'Romantic', 'Quick'],
      gradient: 'from-pink-400 to-blush-300',
      icon: '🌺',
    },
  ];

  // --- Mock Workshop Collaborators ---
  const workshopCollaborators = [
    { name: 'You (César)', avatar: '👑', color: '#db2777', role: 'owner', active: true },
    { name: 'Elena Crafter', avatar: '🌸', color: '#ec4899', role: 'editor', active: true },
    { name: 'Dave Digitizer', avatar: '🐕', color: '#f472b6', role: 'editor', active: true },
    { name: 'Sofia R.', avatar: '🦉', color: '#f9a8d4', role: 'viewer', active: false },
  ];

  return (
    <div className="min-h-screen bg-floral-soft">
      {/* ===== FLORAL HERO BANNER ===== */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blush-50 via-white to-blush-100 border-b border-blush-200">
        {/* Decorative floral patterns */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23db2777' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px',
          }}
        />

        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16 sm:py-20 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Floral badge */}
            <div className="inline-flex items-center gap-x-2 rounded-full bg-blush-100/80 backdrop-blur-sm px-4 py-1.5 text-sm font-semibold leading-6 text-blush-700 ring-1 ring-inset ring-blush-300/50 mb-6 animate-fade-in-up">
              <Flower2 className="h-4 w-4 text-blush-500" />
              Floral Theme Design Exploration
            </div>

            <h1 className="floral-section-title animate-fade-in-up">
              A <span className="text-gradient-floral">Fresh, Feminine</span> Vision
            </h1>
            <p className="floral-section-subtitle animate-fade-in-up">
              Exploring a white and blush-pink palette inspired by botanical elegance. 
              This concept brings a soft, inviting feel to the StitchWise platform — 
              where every crafter's creative journey begins.
            </p>

            {/* Palette Swatches */}
            <div className="mt-10 flex justify-center gap-3 animate-fade-in-up">
              <div className="flex -space-x-1">
                {['#ffffff', '#fff5f7', '#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6', '#ec4899', '#db2777', '#be185d'].map((color, i) => (
                  <div
                    key={i}
                    className="h-8 w-8 rounded-full border-2 border-white shadow-sm hover:scale-125 transition-transform"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== VIEW TOGGLE ===== */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10">
        <div className="flex justify-center mb-12">
          <div className="inline-flex bg-white rounded-2xl p-1.5 shadow-sm border border-blush-100">
            <button
              onClick={() => setActiveView('marketplace')}
              className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
                activeView === 'marketplace'
                  ? 'bg-blush-500 text-white shadow-sm'
                  : 'text-blush-600 hover:bg-blush-50'
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              Marketplace Mockup
            </button>
            <button
              onClick={() => setActiveView('workshop')}
              className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
                activeView === 'workshop'
                  ? 'bg-blush-500 text-white shadow-sm'
                  : 'text-blush-600 hover:bg-blush-50'
              }`}
            >
              <Users className="h-4 w-4" />
              Workshop Mockup
            </button>
          </div>
        </div>

        {/* ===== MARKETPLACE MOCKUP ===== */}
        {activeView === 'marketplace' && (
          <div className="space-y-8 animate-fade-in-up">
            {/* Marketplace Header */}
            <div className="text-center mb-10">
              <h2 className="text-2xl font-extrabold text-slate-800 flex items-center justify-center gap-2">
                <ShoppingBag className="h-6 w-6 text-blush-500" />
                Designer Marketplace
              </h2>
              <p className="text-blush-600/70 mt-2 max-w-xl mx-auto">
                Browse patterns from our community of crafters. Every design hand-finished with love.
              </p>
            </div>

            {/* Search / Filter Bar (floral styled) */}
            <div className="floral-card p-4 mb-8">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Search floral patterns..."
                    className="floral-input pl-10 py-3"
                    readOnly
                  />
                  <Sparkles className="absolute left-3 top-3.5 h-4 w-4 text-blush-400" />
                </div>
                <div className="flex gap-2">
                  <select className="floral-input py-3 text-blush-700" defaultValue="" disabled>
                    <option value="">All Categories</option>
                    <option>Floral</option>
                    <option>Botanical</option>
                    <option>Romantic</option>
                  </select>
                  <button className="btn-floral-primary">
                    <Sparkles className="h-4 w-4" />
                    Search
                  </button>
                </div>
              </div>
            </div>

            {/* Marketplace Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {marketplaceItems.map((item) => (
                <div
                  key={item.id}
                  className="floral-card overflow-hidden group cursor-pointer"
                >
                  {/* Preview gradient header */}
                  <div className={`h-32 bg-gradient-to-br ${item.gradient} relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px]" />
                    <div className="absolute top-3 right-3 floral-badge bg-white/80 backdrop-blur-sm">
                      <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                      {item.rating}
                    </div>
                    <div className="absolute bottom-3 left-3 text-4xl">
                      {item.icon}
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-5">
                    <h3 className="font-bold text-slate-800 text-base mb-1 group-hover:text-blush-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-blush-500 mb-3 flex items-center gap-1">
                      by {item.designer}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {item.tags.map((tag) => (
                        <span key={tag} className="floral-tag text-[10px]">
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Price and actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-blush-100">
                      <div className="flex items-baseline gap-1">
                        <span className="text-lg font-extrabold text-blush-700">${item.price}</span>
                        <span className="text-[10px] text-blush-400">/ pattern</span>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="text-[10px] text-blush-400 flex items-center gap-0.5">
                          <Heart className="h-3 w-3" />
                          {item.sales}
                        </span>
                        <button className="p-1.5 rounded-lg bg-blush-50 text-blush-600 hover:bg-blush-100 transition-all">
                          <ShoppingBag className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* View All CTA */}
            <div className="text-center mt-10">
              <button className="btn-floral-primary inline-flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Explore Full Marketplace
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {/* Design notes */}
            <div className="floral-card p-6 mt-8 bg-gradient-to-r from-blush-50 to-white">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-blush-100 flex items-center justify-center shrink-0">
                  <Palette className="h-5 w-5 text-blush-600" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-700 text-sm">Floral Theme Applied: Marketplace</h4>
                  <p className="text-xs text-blush-600/70 mt-1 leading-relaxed">
                    White card backgrounds with blush borders, pink gradient preview headers, 
                    soft rounded corners (2rem), and blush color accents throughout. 
                    The floral palette brings warmth and approachability to pattern browsing.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== WORKSHOP MOCKUP ===== */}
        {activeView === 'workshop' && (
          <div className="space-y-8 animate-fade-in-up">
            {/* Workshop Header */}
            <div className="text-center mb-10">
              <h2 className="text-2xl font-extrabold text-slate-800 flex items-center justify-center gap-2">
                <Users className="h-6 w-6 text-blush-500" />
                Collaborative Workshop
              </h2>
              <p className="text-blush-600/70 mt-2 max-w-xl mx-auto">
                Design together in real-time. A shared digital canvas for co-creating beautiful patterns.
              </p>
            </div>

            {/* Workshop Status Banner */}
            <div className="bg-gradient-to-r from-blush-500 via-blush-400 to-pink-400 rounded-3xl p-6 md:p-8 text-white shadow-blush relative overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-30 pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-xl font-extrabold flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-white animate-ping" />
                    Spring Blossom Workshop — Live!
                  </h3>
                  <p className="text-sm text-white/80 mt-1">
                    Your canvas is synchronized. Collaborators are stitching in real-time.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button className="px-5 py-2.5 rounded-xl bg-white/20 backdrop-blur-sm text-white font-bold text-sm border border-white/30 hover:bg-white/30 transition-all">
                    <Share2 className="h-4 w-4 inline mr-1.5" />
                    Invite
                  </button>
                  <button className="px-5 py-2.5 rounded-xl bg-white text-blush-700 font-bold text-sm hover:bg-blush-50 transition-all">
                    <Download className="h-4 w-4 inline mr-1.5" />
                    Export
                  </button>
                </div>
              </div>
            </div>

            {/* Workshop Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left: Canvas Area (8 cols) */}
              <div className="lg:col-span-8">
                <div className="floral-card p-6">
                  {/* Canvas toolbar */}
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-blush-100">
                    <div>
                      <h4 className="font-bold text-slate-700 flex items-center gap-2">
                        <Palette className="h-4 w-4 text-blush-500" />
                        Embroidery Canvas — 16x16
                      </h4>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-floral-ghost text-xs py-1.5 px-3">
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Reset
                      </button>
                      <button className="btn-floral-primary text-xs py-1.5 px-3">
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Export
                      </button>
                    </div>
                  </div>

                  {/* Floral Embroidery Grid (simplified preview) */}
                  <div className="p-6 bg-gradient-to-br from-blush-50/50 to-white rounded-2xl border-2 border-dashed border-blush-200 relative overflow-hidden">
                    <div className="grid grid-cols-16 gap-1.5">
                      {Array.from({ length: 16 }).map((_, r) => (
                        <div key={r} className="flex gap-1.5">
                          {Array.from({ length: 16 }).map((_, c) => {
                            // Create a simple rose/heart pattern
                            const isPetal =
                              (r >= 4 && r <= 11 && c >= 4 && c <= 11) &&
                              (Math.hypot(r - 7.5, c - 5.5) < 2.5 ||
                               Math.hypot(r - 7.5, c - 10.5) < 2.5 ||
                               (r >= 7 && r - c <= 3 && r + c <= 19));
                            const isStem = c === 7 && r >= 11 && r <= 14;
                            return (
                              <button
                                key={c}
                                className="h-5 w-5 rounded-md border transition-all hover:scale-110"
                                style={{
                                  backgroundColor: isPetal
                                    ? ['#f9a8d4', '#f472b6', '#ec4899', '#db2777'][Math.floor(Math.random() * 4)]
                                    : isStem ? '#86efac' : '#fefcfb',
                                  borderColor: isPetal || isStem ? 'rgba(0,0,0,0.08)' : '#fce7f3',
                                }}
                              />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Collaborator cursors */}
                  <div className="mt-4 flex items-center justify-between text-xs text-blush-500">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>3 active collaborators</span>
                    </div>
                    <span className="text-blush-400">Last updated: Just now</span>
                  </div>
                </div>
              </div>

              {/* Right: Tools & Collaborators (4 cols) */}
              <div className="lg:col-span-4 space-y-6">
                {/* Color Palette */}
                <div className="floral-card p-5">
                  <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-4">
                    <Palette className="h-4 w-4 text-blush-500" />
                    Thread Box
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {['#ffffff', '#fce7f3', '#f9a8d4', '#f472b6', '#ec4899', '#db2777', '#be185d', '#86efac', '#fef3c7', '#bfdbfe'].map((c) => (
                      <button
                        key={c}
                        className="h-7 w-7 rounded-full border-2 transition-all hover:scale-110"
                        style={{
                          backgroundColor: c,
                          borderColor: c === '#ffffff' ? '#fce7f3' : 'rgba(0,0,0,0.1)',
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Stitch Styles */}
                <div className="floral-card p-5">
                  <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-4">
                    <Sparkles className="h-4 w-4 text-blush-500" />
                    Stitch Styles
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { name: 'Cross Stitch', desc: 'Traditional X' },
                      { name: 'Satin Stitch', desc: 'Glossy parallel' },
                      { name: 'Back Stitch', desc: 'Fine borders' },
                      { name: 'French Knot', desc: 'Raised details' },
                    ].map((s) => (
                      <button
                        key={s.name}
                        className="px-3 py-2 rounded-xl text-left text-xs border border-blush-100 
                                   hover:bg-blush-50 hover:border-blush-300 transition-all"
                      >
                        <div className="font-bold text-slate-700">{s.name}</div>
                        <div className="text-[10px] text-blush-500">{s.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Collaborators */}
                <div className="floral-card p-5">
                  <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-4">
                    <Users className="h-4 w-4 text-blush-500" />
                    Workshop Team
                  </h4>
                  <div className="space-y-3">
                    {workshopCollaborators.map((collab) => (
                      <div key={collab.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg">{collab.avatar}</span>
                          <div>
                            <span className="text-xs font-bold text-slate-700">{collab.name}</span>
                            <span className="text-[10px] text-blush-400 block capitalize">{collab.role}</span>
                          </div>
                        </div>
                        <span
                          className={`h-2 w-2 rounded-full ${collab.active ? 'bg-emerald-400' : 'bg-slate-300'}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Stream */}
            <div className="floral-card p-5">
              <h4 className="font-bold text-slate-700 text-sm flex items-center gap-2 mb-4">
                <Clock className="h-4 w-4 text-blush-500" />
                Activity Stream
              </h4>
              <div className="space-y-3 max-h-40 overflow-y-auto">
                {[
                  { user: '🌸 Elena', action: 'Set active stitch to Satin Stitch', time: '2m ago' },
                  { user: '🐕 Dave', action: 'Painted blush pink at (4, 5)', time: '5m ago' },
                  { user: '👑 You', action: 'Added French Knot detail at (8, 8)', time: '7m ago' },
                  { user: '🦉 Sofia', action: 'Joined the workshop', time: '12m ago' },
                ].map((log, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs text-slate-600">
                    <span className="text-sm">{log.user.split(' ')[0]}</span>
                    <div className="flex-1">
                      <p className="text-slate-700">
                        <strong>{log.user.split(' ').slice(1).join(' ')}</strong>: {log.action}
                      </p>
                      <span className="text-[10px] text-blush-400">{log.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Design notes */}
            <div className="floral-card p-6 bg-gradient-to-r from-blush-50 to-white">
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-blush-100 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-blush-600" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-700 text-sm">Floral Theme Applied: Workshop</h4>
                  <p className="text-xs text-blush-600/70 mt-1 leading-relaxed">
                    The workshop adopts a soft, inviting aesthetic with pink gradient banners, 
                    rounded floral cards, blush input styles, and delicate pink thread palette. 
                    Collaborative elements are framed with gentle borders and shadow effects.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== THEME CONFIGURATION SUMMARY ===== */}
        <div className="mt-16 floral-card-elevated p-8">
          <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2 mb-6">
            <Palette className="h-6 w-6 text-blush-500" />
            Floral Theme Configuration
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Color Palette Summary */}
            <div>
              <h4 className="text-sm font-bold text-slate-700 mb-4">🎨 Color Palette</h4>
              <div className="space-y-3">
                {[
                  { name: 'floral', label: 'Floral Scale', colors: ['#fffdfd', '#fff5f7', '#ffe4ed', '#ffccda', '#ffa3bf', '#ff7ea6', '#f25a8a', '#d63d72', '#b3255c'] },
                  { name: 'blush', label: 'Blush Scale', colors: ['#fdf2f8', '#fce7f3', '#fbcfe8', '#f9a8d4', '#f472b6', '#ec4899', '#db2777', '#be185d', '#9d174d'] },
                  { name: 'garden', label: 'Garden Backgrounds', colors: ['#ffffff', '#fefcfb', '#fff5f7', '#fff1f2', '#f8e8ef', '#f5f0f0', '#fae8ed'] },
                ].map((scale) => (
                  <div key={scale.name}>
                    <p className="text-xs font-bold text-slate-600 mb-1.5">{scale.label}</p>
                    <div className="flex gap-0.5 rounded-lg overflow-hidden">
                      {scale.colors.map((c) => (
                        <div key={c} className="h-6 flex-1" style={{ backgroundColor: c }} title={c} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Design Tokens Summary */}
            <div>
              <h4 className="text-sm font-bold text-slate-700 mb-4">📐 Design Tokens</h4>
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-20 h-8 rounded-floral bg-blush-100 border border-blush-200" />
                  <div>
                    <span className="font-bold text-slate-700">Border Radius: Floral</span>
                    <p className="text-blush-500">2rem (32px) rounded corners</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-8 rounded-xl bg-blush-100 shadow-blush border border-blush-200" />
                  <div>
                    <span className="font-bold text-slate-700">Shadow: Blush</span>
                    <p className="text-blush-500">Soft pink-tinted shadows</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gradient-floral font-bold text-lg">Floral Text</span>
                  <div>
                    <span className="font-bold text-slate-700">Text Gradient</span>
                    <p className="text-blush-500">blush-600 → blush-400 → blush-500</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-blush-100 text-blush-700 border border-blush-200">
                    floral-badge
                  </span>
                  <div>
                    <span className="font-bold text-slate-700">Component Classes</span>
                    <p className="text-blush-500">floral-card, btn-floral-primary, floral-input, etc.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tailwind Config Code Snippet */}
          <div className="mt-8 p-4 bg-slate-800 rounded-2xl overflow-x-auto">
            <pre className="text-xs text-slate-300 font-mono leading-relaxed">
{`// tailwind.config.js — Floral Theme Extension
colors: {
  floral: { 50: '#fffdfd', ... 950: '#5c0d2e' },
  blush: { 50: '#fdf2f8', ... 950: '#500724' },
  petal: { light: '#fff0f5', DEFAULT: '#ffb6c1', dark: '#db7090' },
  bloom: { light: '#ffe4e1', DEFAULT: '#ff69b4', dark: '#c71585' },
  garden: { white: '#ffffff', cream: '#fefcfb', petal: '#fff5f7', ... }
},
backgroundImage: {
  'floral-gradient': 'linear-gradient(135deg, #fff5f7 0%, #fce7f3 30%, ...)',
  'blush-gradient': 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 50%, ...)',
},
boxShadow: {
  'blush': '0 4px 14px 0 rgba(236, 72, 153, 0.15)',
  'floral': '0 8px 32px rgba(244, 63, 94, 0.08)',
},
animation: {
  'bloom': 'bloom 3s ease-in-out infinite',
  'petal-fall': 'petalFall 6s ease-in-out infinite',
}`}
            </pre>
          </div>
        </div>

        {/* ===== FOOTER NOTE ===== */}
        <div className="mt-12 text-center pb-8">
          <div className="inline-flex items-center gap-2 text-blush-500/60 text-xs">
            <Heart className="h-4 w-4 text-blush-400 animate-pulse" />
            <span>
              This is a design exploration for owner vision alignment. 
              White + Pink palette — prioritizing look and feel over functionality.
            </span>
            <Heart className="h-4 w-4 text-blush-400 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
};