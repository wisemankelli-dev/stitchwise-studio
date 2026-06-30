import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, Star, Flower2, Crown, CheckCircle2,
  AlertTriangle, Copy, ArrowRight
} from 'lucide-react';
import { api, User } from '../services/api';

interface GalleryDesign {
  id: string;
  title: string;
  designer: string;
  description: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  tags: string[];
  previewGradient: string;
  icon: string;
  stitchCount: number;
  gridSize: string;
}

export const FeaturedGallery: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [cloneStatus, setCloneStatus] = useState<string | null>(null);

  useEffect(() => {
    api.getUserProfile().then(setUser).catch(() => setUser(null));
  }, []);

  const userTier = user?.subscriptionTier || 'Hobbyist';
  const canClone = userTier === 'Pro Crafter' || userTier === 'Design Studio';

  const galleryDesigns: GalleryDesign[] = [
    { id: 'g-1', title: 'Spring Blossom Wreath', designer: 'Elena Crafter', description: 'A delicate wreath of cherry blossoms and wildflowers, perfect for spring projects.', difficulty: 'Beginner', tags: ['Floral', 'Wreath', 'Spring'], previewGradient: 'from-blush-300 via-pink-200 to-rose-200', icon: '🌸', stitchCount: 1800, gridSize: '24x24' },
    { id: 'g-2', title: 'Vintage Rose Bouquet', designer: 'StitchMaster Pro', description: 'Classic vintage roses with satin stitch detailing for elegant embroidery pieces.', difficulty: 'Advanced', tags: ['Vintage', 'Rose', 'Satin'], previewGradient: 'from-rose-400 via-blush-500 to-pink-600', icon: '🌹', stitchCount: 4500, gridSize: '48x48' },
    { id: 'g-3', title: 'Garden Butterfly', designer: 'Dave Digitizer', description: 'A monarch butterfly resting on a lavender sprig. Nature-inspired design.', difficulty: 'Intermediate', tags: ['Butterfly', 'Nature', 'Garden'], previewGradient: 'from-amber-300 via-orange-200 to-blush-300', icon: '🦋', stitchCount: 2800, gridSize: '32x32' },
    { id: 'g-4', title: 'Peony Love Heart', designer: 'Sofia R.', description: 'A romantic heart-shaped peony design, ideal for Valentine projects.', difficulty: 'Beginner', tags: ['Heart', 'Romantic', 'Peony'], previewGradient: 'from-pink-400 via-blush-300 to-rose-200', icon: '🌺', stitchCount: 1200, gridSize: '16x16' },
    { id: 'g-5', title: 'Lavender Fields', designer: 'Elena Crafter', description: 'Rolling lavender fields with French knot detailing for texture.', difficulty: 'Intermediate', tags: ['Lavender', 'Fields', 'French Knot'], previewGradient: 'from-purple-300 via-blush-200 to-pink-100', icon: '💜', stitchCount: 3200, gridSize: '36x36' },
    { id: 'g-6', title: 'Floral Monogram Frame', designer: 'StitchMaster Pro', description: 'Customizable monogram frame surrounded by intricate floral motifs.', difficulty: 'Advanced', tags: ['Monogram', 'Frame', 'Intricate'], previewGradient: 'from-rose-600 via-pink-500 to-blush-400', icon: '👑', stitchCount: 5200, gridSize: '48x48' },
  ];

  const handleClone = (design: GalleryDesign) => {
    if (!canClone) return;
    setCloneStatus(`Cloning "${design.title}" to your workshop...`);
    setTimeout(() => {
      setCloneStatus(`✅ "${design.title}" has been cloned to your workshop!`);
      setTimeout(() => setCloneStatus(null), 3000);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-floral-soft">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blush-50 via-white to-blush-100 border-b border-blush-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16 sm:py-20">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-x-2 rounded-full bg-blush-100/80 px-4 py-1.5 text-sm font-semibold text-blush-700 ring-1 ring-inset ring-blush-300/50 mb-6">
              <Flower2 className="h-4 w-4 text-blush-500" />
              Featured Gallery
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800 sm:text-4xl">
              Get Inspired by Our <span className="text-gradient-floral">Curated Designs</span>
            </h1>
            <p className="mt-4 text-lg text-blush-600/80 max-w-xl mx-auto">
              Browse our collection of premium embroidery patterns. Clone any design to your workshop and make it your own.
            </p>

            {/* Tier Status Badge */}
            <div className="mt-6 inline-flex items-center gap-2 floral-badge text-sm px-4 py-2">
              {canClone ? (
                <>
                  <Crown className="h-4 w-4 text-amber-500" />
                  <span className="text-blush-800">
                    <strong className="text-amber-700">{userTier}</strong> — Clone access active
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-blush-600">
                    <strong>Hobbyist</strong> —{' '}
                    <Link to="/pricing" className="text-brand-600 hover:text-brand-500 underline font-bold">
                      Upgrade to Pro
                    </Link>{' '}
                    to clone designs
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {galleryDesigns.map((design) => (
            <div
              key={design.id}
              className="floral-card overflow-hidden group transition-all duration-300 hover:shadow-blush"
            >
              {/* Preview */}
              <div className={`h-40 bg-gradient-to-br ${design.previewGradient} relative overflow-hidden`}>
                <div className="absolute inset-0 bg-white/10 backdrop-blur-[1px]" />
                <div className="absolute top-3 right-3 floral-badge bg-white/80 backdrop-blur-sm">
                  <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                  Featured
                </div>
                <div className="absolute bottom-3 left-3 text-5xl">{design.icon}</div>
                <div className="absolute bottom-3 right-3 text-[10px] font-bold text-white/80 bg-black/20 px-2 py-1 rounded-full backdrop-blur-sm">
                  {design.gridSize}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-800 text-base group-hover:text-blush-600 transition-colors">
                    {design.title}
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blush-50 text-blush-700">
                    {design.difficulty}
                  </span>
                </div>
                <p className="text-xs text-blush-500 mb-1">by {design.designer}</p>
                <p className="text-xs text-slate-500 line-clamp-2 mb-3">{design.description}</p>

                {/* Tags + Stitch Count */}
                <div className="flex flex-wrap items-center gap-1.5 mb-4">
                  {design.tags.map((tag) => (
                    <span key={tag} className="floral-tag text-[10px]">{tag}</span>
                  ))}
                  <span className="text-[10px] text-slate-400 ml-auto flex items-center gap-0.5">
                    <Sparkles className="h-3 w-3" />
                    {design.stitchCount.toLocaleString()} st
                  </span>
                </div>

                {/* Clone Button */}
                <button
                  onClick={() => handleClone(design)}
                  disabled={!canClone}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                    canClone
                      ? 'bg-blush-500 text-white hover:bg-blush-600 hover:shadow-blush active:scale-[0.98]'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {canClone ? (
                    <>
                      <Copy className="h-4 w-4" />
                      Clone to Workshop
                    </>
                  ) : (
                    <>
                      <Crown className="h-4 w-4 text-amber-400" />
                      Upgrade to Clone
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Clone Status Toast */}
        {cloneStatus && (
          <div className="fixed bottom-6 right-6 z-50 bg-white rounded-2xl shadow-floral border border-blush-100 px-5 py-4 flex items-center gap-3 max-w-sm animate-fade-in-up">
            {cloneStatus.startsWith('✅') ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <div className="h-5 w-5 border-2 border-blush-500 border-t-transparent rounded-full animate-spin shrink-0" />
            )}
            <p className="text-xs text-slate-700 font-medium">{cloneStatus.replace('✅ ', '')}</p>
          </div>
        )}

        {/* Upgrade CTA for Hobbyists */}
        {!canClone && (
          <div className="mt-12 floral-card-elevated p-8 text-center">
            <div className="max-w-lg mx-auto">
              <Crown className="h-10 w-10 text-amber-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-800 mb-2">Unlock Full Gallery Access</h3>
              <p className="text-sm text-blush-600/70 mb-6">
                Upgrade to <strong>Pro Crafter</strong> or <strong>Design Studio</strong> to clone any design 
                directly into your workshop. Unlimited access to our entire curated collection.
              </p>
              <div className="flex gap-4 justify-center">
                <Link
                  to="/pricing"
                  className="btn-floral-primary inline-flex items-center gap-2"
                >
                  <Crown className="h-4 w-4" />
                  View Plans
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/designer"
                  className="btn-floral-secondary inline-flex items-center gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Try Free Designer
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};