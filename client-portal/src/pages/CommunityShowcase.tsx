import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart, Flower2, Crown, AlertTriangle, X,
  Upload, Clock, Trash2, CheckCircle2,
  AlertCircle, Filter, Search, Plus, LayoutGrid,
  ArrowUpDown, Camera, Edit3, MessageSquare
} from 'lucide-react';
import { api, ShowcaseEntry } from '../services/api';

/** Emoji icon map by project type */
const PROJECT_ICONS: Record<string, string> = {
  'embroidery': '🧵',
  'collage': '✂️',
  'quilt-block': '🧩',
};

/** Gradient map by project type */
const PROJECT_GRADIENTS: Record<string, string> = {
  'embroidery': 'from-blush-300 via-pink-200 to-rose-200',
  'collage': 'from-purple-300 via-blush-200 to-pink-100',
  'quilt-block': 'from-amber-300 via-orange-200 to-blush-300',
};

/** Difficulty estimation based on stitch count */
function estimateDifficulty(stitchCount?: number): string {
  if (!stitchCount) return 'Beginner';
  if (stitchCount < 2000) return 'Beginner';
  if (stitchCount < 4000) return 'Intermediate';
  return 'Advanced';
}

/** Format a date string relative to now */
function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * CommunityShowcase Page - A gallery for users to share and browse
 * finished embroidery, collage, and quilt block projects.
 *
 * Features:
 * - Responsive gallery grid with filter, search, and sort
 * - Upload modal with tier gating (Hobbyist: 3/month)
 * - "My Showcases" section for managing own uploads
 * - Detail view with project metadata
 */
export const CommunityShowcase: React.FC = () => {
  const [entries, setEntries] = useState<ShowcaseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; name: string; tier: string; avatar: string } | null>(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'embroidery' | 'collage' | 'quilt-block'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'popular'>('newest');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ShowcaseEntry | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'mine'>('all');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load data
  useEffect(() => {
    Promise.all([
      api.getShowcaseEntries(),
      api.getUserProfile().then(u => ({
        id: u.id,
        name: u.name,
        tier: u.subscriptionTier,
        avatar: u.avatarUrl || '🧵'
      })).catch(() => null)
    ])
      .then(([entriesData, userData]) => {
        setEntries(entriesData);
        setUser(userData);
      })
      .catch(() => setError('Failed to load showcase entries'))
      .finally(() => setLoading(false));
  }, []);

  /** Show a toast notification */
  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  /** Delete an entry if the user owns it */
  const handleDelete = useCallback(async (id: string) => {
    const result = await api.deleteShowcaseEntry(id);
    if (result.success) {
      setEntries(prev => prev.filter(e => e.id !== id));
      showToast('success', 'Project removed from showcase');
      if (selectedEntry?.id === id) setSelectedEntry(null);
    } else {
      showToast('error', result.error || 'Failed to delete');
    }
  }, [selectedEntry, showToast]);

  // Filter, search, and sort entries
  const filteredEntries = entries
    .filter(e => {
      // Tab filter
      if (activeTab === 'mine' && user) return e.userId === user.id;
      return true;
    })
    .filter(e => {
      // Type filter
      if (filterType !== 'all') return e.projectType === filterType;
      return true;
    })
    .filter(e => {
      // Search filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        e.title.toLowerCase().includes(q) ||
        e.userName.toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'popular') return b.likes - a.likes;
      return 0;
    });

  const isHobbyist = user?.tier === 'Hobbyist';
  const userEntries = entries.filter(e => user && e.userId === user.id);
  const userUploadsThisMonth = userEntries.filter(e => {
    const d = new Date(e.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="min-h-screen bg-floral-soft">
      {/* ===== HERO HEADER ===== */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blush-50 via-white to-blush-100 border-b border-blush-200">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23db2777' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '60px 60px',
          }}
        />
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 sm:py-16 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-x-2 rounded-full bg-blush-100/80 backdrop-blur-sm px-4 py-1.5 text-sm font-semibold text-blush-700 ring-1 ring-inset ring-blush-300/50 mb-6 animate-fade-in-up">
              <Flower2 className="h-4 w-4 text-blush-500" />
              Community Showcase
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800 sm:text-4xl animate-fade-in-up">
              Share Your <span className="text-gradient-floral">Finished Projects</span>
            </h1>
            <p className="mt-4 text-lg text-blush-600/80 max-w-xl mx-auto animate-fade-in-up">
              Upload photos of your completed embroidery, collage quilting, and quilt block projects. 
              Inspire the StitchWise community with your creativity!
            </p>
          </div>
        </div>
      </div>

      {/* ===== CONTENT AREA ===== */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">

        {/* Action Bar: Upload + Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          {/* Tabs */}
          <div className="flex items-center gap-2 bg-white rounded-2xl p-1.5 shadow-sm border border-blush-100">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'all'
                  ? 'bg-blush-500 text-white shadow-sm'
                  : 'text-blush-600 hover:bg-blush-50'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              All Projects
              <span className="bg-blush-200/50 text-blush-800 text-[10px] px-1.5 py-0.5 rounded-full">{entries.length}</span>
            </button>
            <button
              onClick={() => setActiveTab('mine')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 ${
                activeTab === 'mine'
                  ? 'bg-blush-500 text-white shadow-sm'
                  : 'text-blush-600 hover:bg-blush-50'
              }`}
            >
              <Camera className="h-4 w-4" />
              My Showcases
              <span className="bg-blush-200/50 text-blush-800 text-[10px] px-1.5 py-0.5 rounded-full">{userEntries.length}</span>
            </button>
          </div>

          {/* Upload Button */}
          <button
            onClick={() => setShowUploadModal(true)}
            className="btn-floral-primary inline-flex items-center gap-2 text-sm"
          >
            <Upload className="h-4 w-4" />
            Share Your Project
          </button>
        </div>

        {/* Upload Limit Warning for Hobbyists */}
        {isHobbyist && activeTab === 'mine' && (
          <div className="floral-card p-4 mb-6 flex items-center gap-3 bg-gradient-to-r from-amber-50 to-blush-50 border-amber-200">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-slate-700 font-medium">
                Hobbyist Plan: <strong>{userUploadsThisMonth}/3</strong> uploads used this month
              </p>
              <p className="text-[11px] text-blush-500 mt-0.5">
                Upgrade to <Link to="/pricing" className="text-blush-600 font-bold underline">Pro Crafter</Link> for unlimited uploads!
              </p>
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className="floral-card p-4 mb-8">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-blush-400" />
              <input
                type="text"
                placeholder="Search projects by title, creator..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="floral-input pl-10 py-3 text-sm"
              />
            </div>

            {/* Type Filter */}
            <div className="flex gap-2">
              <div className="relative">
                <Filter className="absolute left-3 top-3.5 h-4 w-4 text-blush-400 pointer-events-none" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="floral-input pl-10 py-3 text-sm appearance-none cursor-pointer min-w-[140px]"
                >
                  <option value="all">All Types</option>
                  <option value="embroidery">🧵 Embroidery</option>
                  <option value="collage">✂️ Collage</option>
                  <option value="quilt-block">🧩 Quilt Block</option>
                </select>
              </div>

              {/* Sort */}
              <div className="relative">
                <ArrowUpDown className="absolute left-3 top-3.5 h-4 w-4 text-blush-400 pointer-events-none" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="floral-input pl-10 py-3 text-sm appearance-none cursor-pointer min-w-[130px]"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="popular">Most Liked</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ===== GALLERY GRID ===== */}
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={() => window.location.reload()} />
        ) : filteredEntries.length === 0 ? (
          <EmptyState
            isMyTab={activeTab === 'mine'}
            searchQuery={searchQuery}
            onUpload={() => setShowUploadModal(true)}
          />
        ) : (
          <>
            {/* Results Count */}
            <p className="text-xs text-blush-400 mb-4">
              Showing {filteredEntries.length} {filteredEntries.length === 1 ? 'project' : 'projects'}
              {activeTab === 'mine' ? ' by you' : ''}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="floral-card overflow-hidden group cursor-pointer transition-all duration-300 hover:shadow-blush"
                  onClick={() => setSelectedEntry(entry)}
                >
                  {/* Preview Image */}
                  <div className={`h-40 bg-gradient-to-br ${PROJECT_GRADIENTS[entry.projectType] || 'from-blush-300 via-pink-200 to-rose-200'} relative overflow-hidden`}>
                    <img
                      src={entry.imageUrl}
                      alt={entry.title}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-95 transition-opacity duration-300"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                    
                    {/* Project Type Badge */}
                    <div className="absolute top-3 left-3 floral-badge bg-white/90 backdrop-blur-sm text-[10px]">
                      {PROJECT_ICONS[entry.projectType] || '🧵'}
                      <span className="ml-1 capitalize">{entry.projectType}</span>
                    </div>

                    {/* Like Count */}
                    <div className="absolute top-3 right-3 floral-badge bg-white/90 backdrop-blur-sm text-[10px]">
                      <Heart className="h-3 w-3 text-blush-500" />
                      <span>{entry.likes}</span>
                    </div>

                    {/* Stitch Count */}
                    {entry.metadata?.stitchCount && (
                      <div className="absolute bottom-3 right-3 text-[10px] font-bold text-white bg-black/30 px-2 py-1 rounded-full backdrop-blur-sm">
                        {entry.metadata.stitchCount.toLocaleString()} st
                      </div>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-slate-800 text-sm group-hover:text-blush-600 transition-colors line-clamp-1">
                        {entry.title}
                      </h3>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blush-50 text-blush-700 shrink-0 ml-2">
                        {estimateDifficulty(entry.metadata?.stitchCount)}
                      </span>
                    </div>

                    {/* Creator */}
                    <p className="text-xs text-blush-500 mb-2 flex items-center gap-1">
                      <span>{entry.userAvatar}</span>
                      by {entry.userName}
                      <span className="text-blush-300 ml-auto">{timeAgo(entry.createdAt)}</span>
                    </p>

                    {/* Description */}
                    {entry.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                        {entry.description}
                      </p>
                    )}

                    {/* Tags */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {entry.metadata?.fabricType && (
                        <span className="floral-tag text-[10px]">{entry.metadata.fabricType}</span>
                      )}
                      {entry.metadata?.patternSource && (
                        <span className="floral-tag text-[10px]">{entry.metadata.patternSource}</span>
                      )}
                      {entry.metadata?.timeSpent && (
                        <span className="text-[10px] text-slate-400 ml-auto flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {entry.metadata.timeSpent}
                        </span>
                      )}
                    </div>

                    {/* Owner Actions */}
                    {user && entry.userId === user.id && (
                      <div className="mt-3 pt-3 border-t border-blush-100 flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Remove this project from the showcase?')) {
                              handleDelete(entry.id);
                            }
                          }}
                          className="text-[11px] text-blush-400 hover:text-red-500 transition-colors flex items-center gap-1 font-medium"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ===== UPLOAD MODAL ===== */}
      {showUploadModal && (
        <UploadModal
          user={user}
          isHobbyist={isHobbyist}
          userUploadsThisMonth={userUploadsThisMonth}
          onClose={() => setShowUploadModal(false)}
          onSuccess={(entry) => {
            setEntries(prev => [entry, ...prev]);
            setShowUploadModal(false);
            showToast('success', '🎉 Your project has been shared with the community!');
          }}
          onError={(msg) => showToast('error', msg)}
        />
      )}

      {/* ===== DETAIL MODAL ===== */}
      {selectedEntry && (
        <DetailModal
          entry={selectedEntry}
          isOwner={!!user && user.id === selectedEntry.userId}
          onClose={() => setSelectedEntry(null)}
          onDelete={handleDelete}
        />
      )}

      {/* ===== TOAST ===== */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in-up">
          <div className={`rounded-2xl shadow-floral border px-5 py-4 flex items-center gap-3 max-w-sm ${
            toast.type === 'success'
              ? 'bg-white border-emerald-200'
              : 'bg-white border-red-200'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            )}
            <p className="text-xs text-slate-700 font-medium">{toast.message}</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== SUB-COMPONENTS ====================

/** Skeleton loading state for the gallery grid */
const LoadingSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <div key={i} className="floral-card overflow-hidden animate-pulse">
        <div className="h-40 bg-blush-100" />
        <div className="p-5 space-y-3">
          <div className="h-4 bg-blush-100 rounded w-3/4" />
          <div className="h-3 bg-blush-50 rounded w-1/2" />
          <div className="h-3 bg-blush-50 rounded w-full" />
          <div className="flex gap-2">
            <div className="h-5 bg-blush-100 rounded-full w-16" />
            <div className="h-5 bg-blush-100 rounded-full w-20" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

/** Error state with retry button */
const ErrorState: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="text-center py-20">
    <div className="h-16 w-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
      <AlertCircle className="h-8 w-8 text-red-400" />
    </div>
    <h3 className="text-lg font-bold text-slate-700 mb-2">Oops! Something went wrong</h3>
    <p className="text-sm text-blush-500 mb-6">{message}</p>
    <button onClick={onRetry} className="btn-floral-primary">
      Try Again
    </button>
  </div>
);

/** Empty state with contextual messaging */
const EmptyState: React.FC<{ isMyTab: boolean; searchQuery: string; onUpload: () => void }> = ({ isMyTab, searchQuery, onUpload }) => (
  <div className="text-center py-16">
    {isMyTab ? (
      <>
        <div className="h-16 w-16 rounded-2xl bg-blush-50 flex items-center justify-center mx-auto mb-4">
          <Camera className="h-8 w-8 text-blush-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-700 mb-2">No projects shared yet</h3>
        <p className="text-sm text-blush-500 mb-6 max-w-md mx-auto">
          Share your finished embroidery, collage, and quilt block projects with the community!
        </p>
        <button onClick={onUpload} className="btn-floral-primary inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Share Your First Project
        </button>
      </>
    ) : searchQuery ? (
      <>
        <div className="h-16 w-16 rounded-2xl bg-blush-50 flex items-center justify-center mx-auto mb-4">
          <Search className="h-8 w-8 text-blush-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-700 mb-2">No results found</h3>
        <p className="text-sm text-blush-500">
          Try adjusting your search or filter to find what you're looking for.
        </p>
      </>
    ) : (
      <>
        <div className="h-16 w-16 rounded-2xl bg-blush-50 flex items-center justify-center mx-auto mb-4">
          <Flower2 className="h-8 w-8 text-blush-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-700 mb-2">Welcome to the Showcase!</h3>
        <p className="text-sm text-blush-500 mb-6 max-w-md mx-auto">
          The community showcase is a place to share your finished projects. 
          Be the first to upload and inspire others!
        </p>
        <button onClick={onUpload} className="btn-floral-primary inline-flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Share Your Project
        </button>
      </>
    )}
  </div>
);

/** Upload Modal Component */
const UploadModal: React.FC<{
  user: { id: string; name: string; tier: string; avatar: string } | null;
  isHobbyist: boolean;
  userUploadsThisMonth: number;
  onClose: () => void;
  onSuccess: (entry: ShowcaseEntry) => void;
  onError: (msg: string) => void;
}> = ({ user, isHobbyist, userUploadsThisMonth, onClose, onSuccess, onError }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tips, setTips] = useState('');
  const [projectType, setProjectType] = useState<'embroidery' | 'collage' | 'quilt-block'>('embroidery');
  const [stitchCount, setStitchCount] = useState('');
  const [fabricType, setFabricType] = useState('');
  const [patternSource, setPatternSource] = useState('AI Generated');
  const [timeSpent, setTimeSpent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Project name is required';
    if (title.length > 100) newErrors.title = 'Title must be under 100 characters';
    if (description.length > 1000) newErrors.description = 'Description must be under 1000 characters';
    if (tips.length > 500) newErrors.tips = 'Tips must be under 500 characters';
    if (stitchCount && (isNaN(Number(stitchCount)) || Number(stitchCount) < 0)) {
      newErrors.stitchCount = 'Enter a valid stitch count';
    }
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Check hobbyist limit
    if (isHobbyist && userUploadsThisMonth >= 3) {
      onError('Hobbyist plan limited to 3 uploads per month. Upgrade to Pro for unlimited uploads!');
      return;
    }

    setSubmitting(true);
    setErrors({});

    const result = await api.uploadShowcaseEntry({
      title: title.trim(),
      description: description.trim() || undefined,
      tips: tips.trim() || undefined,
      projectType,
      metadata: {
        stitchCount: stitchCount ? parseInt(stitchCount) : undefined,
        fabricType: fabricType.trim() || undefined,
        patternSource: patternSource === 'Select...' ? undefined : patternSource,
        timeSpent: timeSpent.trim() || undefined,
      },
    });

    setSubmitting(false);

    if (result.success && result.entry) {
      onSuccess(result.entry);
    } else {
      onError(result.error || 'Upload failed. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-floral border border-blush-100 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-blush-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blush-50 flex items-center justify-center">
              <Upload className="h-5 w-5 text-blush-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Share Your Project</h3>
              <p className="text-xs text-blush-500">Inspire the community with your finished work</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-blush-50 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Tier Info */}
          {!user && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-700">Not signed in</p>
                <p className="text-[11px] text-blush-500">
                  <Link to="/login" className="text-blush-600 font-medium underline">Sign in</Link> to share your projects with the community.
                </p>
              </div>
            </div>
          )}

          {/* Hobbyist Limit Info */}
          {isHobbyist && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-blush-50 border border-blush-200">
              <Crown className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-700">Hobbyist Plan — {userUploadsThisMonth}/3 uploads used</p>
                <p className="text-[11px] text-blush-500">
                  <Link to="/pricing" className="text-blush-600 font-medium underline">Upgrade to Pro</Link> for unlimited uploads!
                </p>
              </div>
            </div>
          )}

          {/* Project Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Project Name <span className="text-blush-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Spring Blossom Wreath"
              className={`floral-input py-3 text-sm ${errors.title ? 'border-red-300 focus:border-red-400 focus:ring-red-400' : ''}`}
              maxLength={100}
            />
            {errors.title && <p className="text-[11px] text-red-500 mt-1">{errors.title}</p>}
          </div>

          {/* Project Type */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Project Type</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'embroidery', label: '🧵 Embroidery' },
                { value: 'collage', label: '✂️ Collage' },
                { value: 'quilt-block', label: '🧩 Quilt Block' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setProjectType(opt.value)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                    projectType === opt.value
                      ? 'bg-blush-500 text-white border-blush-500 shadow-sm'
                      : 'bg-white text-slate-600 border-blush-100 hover:border-blush-300 hover:bg-blush-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us about your project — what inspired it, techniques used, etc."
              rows={3}
              className={`floral-input py-3 text-sm resize-none ${errors.description ? 'border-red-300' : ''}`}
              maxLength={1000}
            />
            <div className="flex justify-between mt-1">
              {errors.description && <p className="text-[11px] text-red-500">{errors.description}</p>}
              <p className="text-[10px] text-blush-300 ml-auto">{description.length}/1000</p>
            </div>
          </div>

          {/* Tips for Other Crafters */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              <MessageSquare className="h-3 w-3 inline mr-1 text-blush-400" />
              Tips for Other Crafters
            </label>
            <textarea
              value={tips}
              onChange={(e) => setTips(e.target.value)}
              placeholder="Share your best tips for recreating this project — materials, techniques, lessons learned..."
              rows={2}
              className={`floral-input py-3 text-sm resize-none ${errors.tips ? 'border-red-300' : ''}`}
              maxLength={500}
            />
            {errors.tips && <p className="text-[11px] text-red-500 mt-1">{errors.tips}</p>}
          </div>

          {/* Optional Metadata */}
          <div>
            <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
              <Edit3 className="h-3 w-3 text-blush-400" />
              Project Details <span className="text-blush-300 font-normal">(optional)</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Stitch Count</label>
                <input
                  type="number"
                  value={stitchCount}
                  onChange={(e) => setStitchCount(e.target.value)}
                  placeholder="e.g., 2500"
                  className={`floral-input py-2.5 text-sm ${errors.stitchCount ? 'border-red-300' : ''}`}
                  min={0}
                />
                {errors.stitchCount && <p className="text-[11px] text-red-500 mt-1">{errors.stitchCount}</p>}
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Fabric Type</label>
                <input
                  type="text"
                  value={fabricType}
                  onChange={(e) => setFabricType(e.target.value)}
                  placeholder="e.g., Cotton, Linen"
                  className="floral-input py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Pattern Source</label>
                <select
                  value={patternSource}
                  onChange={(e) => setPatternSource(e.target.value)}
                  className="floral-input py-2.5 text-sm"
                >
                  <option>AI Generated</option>
                  <option>Uploaded</option>
                  <option>Manual</option>
                  <option>Marketplace</option>
                  <option>Select...</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Time Spent</label>
                <input
                  type="text"
                  value={timeSpent}
                  onChange={(e) => setTimeSpent(e.target.value)}
                  placeholder="e.g., 3 hours"
                  className="floral-input py-2.5 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-floral-secondary flex-1 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !user}
              className={`btn-floral-primary flex-1 text-sm flex items-center justify-center gap-2 ${
                submitting || !user ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Share Project
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/** Detail Modal Component */
const DetailModal: React.FC<{
  entry: ShowcaseEntry;
  isOwner: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}> = ({ entry, isOwner, onClose, onDelete }) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-floral border border-blush-100 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image Area */}
        <div className={`relative h-56 sm:h-72 bg-gradient-to-br ${PROJECT_GRADIENTS[entry.projectType]} overflow-hidden`}>
          {!imgError && (
            <img
              src={entry.imageUrl}
              alt={entry.title}
              className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? 'opacity-80' : 'opacity-0'}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          )}
          {!imgLoaded && !imgError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 border-2 border-blush-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-9 w-9 rounded-xl bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-all shadow-sm"
          >
            <X className="h-4 w-4 text-slate-600" />
          </button>

          {/* Badges */}
          <div className="absolute top-4 left-4 flex gap-2">
            <span className="floral-badge bg-white/90 backdrop-blur-sm text-xs">
              {PROJECT_ICONS[entry.projectType]} <span className="capitalize ml-1">{entry.projectType}</span>
            </span>
            <span className="floral-badge bg-white/90 backdrop-blur-sm text-xs">
              {estimateDifficulty(entry.metadata?.stitchCount)}
            </span>
          </div>

          {/* Title overlay at bottom */}
          <div className="absolute bottom-4 left-4 right-4">
            <h2 className="text-xl font-extrabold text-white drop-shadow-sm">{entry.title}</h2>
            <p className="text-sm text-white/80 flex items-center gap-1">
              <span>{entry.userAvatar}</span>
              by {entry.userName} · {timeAgo(entry.createdAt)}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Description */}
          {entry.description && (
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">About This Project</h4>
              <p className="text-sm text-slate-600 leading-relaxed">{entry.description}</p>
            </div>
          )}

          {/* Tips */}
          {entry.tips && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-blush-50 to-white border border-blush-100">
              <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-blush-500" />
                Tips from the Crafter
              </h4>
              <p className="text-sm text-slate-600 italic">"{entry.tips}"</p>
            </div>
          )}

          {/* Metadata Grid */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Project Details</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {entry.metadata?.stitchCount && (
                <div className="p-3 rounded-xl bg-blush-50 border border-blush-100">
                  <p className="text-[10px] text-blush-500 font-medium">Stitch Count</p>
                  <p className="text-sm font-bold text-slate-700">{entry.metadata.stitchCount.toLocaleString()}</p>
                </div>
              )}
              {entry.metadata?.fabricType && (
                <div className="p-3 rounded-xl bg-blush-50 border border-blush-100">
                  <p className="text-[10px] text-blush-500 font-medium">Fabric</p>
                  <p className="text-sm font-bold text-slate-700">{entry.metadata.fabricType}</p>
                </div>
              )}
              {entry.metadata?.patternSource && (
                <div className="p-3 rounded-xl bg-blush-50 border border-blush-100">
                  <p className="text-[10px] text-blush-500 font-medium">Pattern Source</p>
                  <p className="text-sm font-bold text-slate-700">{entry.metadata.patternSource}</p>
                </div>
              )}
              {entry.metadata?.timeSpent && (
                <div className="p-3 rounded-xl bg-blush-50 border border-blush-100">
                  <p className="text-[10px] text-blush-500 font-medium">Time Spent</p>
                  <p className="text-sm font-bold text-slate-700">{entry.metadata.timeSpent}</p>
                </div>
              )}
              {entry.metadata?.threadColors && entry.metadata.threadColors.length > 0 && (
                <div className="p-3 rounded-xl bg-blush-50 border border-blush-100 col-span-2 sm:col-span-2">
                  <p className="text-[10px] text-blush-500 font-medium mb-1.5">Thread Colors</p>
                  <div className="flex gap-1.5">
                    {entry.metadata.threadColors.map((color, i) => (
                      <div
                        key={i}
                        className="h-6 w-6 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-blush-100">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-blush-500">
                <Heart className={`h-4 w-4 ${entry.likes > 0 ? 'fill-blush-500 text-blush-500' : ''}`} />
                <span className="font-bold">{entry.likes}</span>
              </div>
            </div>

            {isOwner && (
              <div className="relative">
                {showConfirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600 font-medium">Confirm delete?</span>
                    <button
                      onClick={() => {
                        onDelete(entry.id);
                        setShowConfirmDelete(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-all"
                    >
                      Yes, Delete
                    </button>
                    <button
                      onClick={() => setShowConfirmDelete(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowConfirmDelete(true)}
                    className="flex items-center gap-1.5 text-xs font-bold text-blush-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};