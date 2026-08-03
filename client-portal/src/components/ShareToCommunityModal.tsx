import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload, X, Crown, MessageSquare,
  Edit3
} from 'lucide-react';
import { api, ShowcaseEntry } from '../services/api';

type ProjectType = 'embroidery' | 'collage' | 'quilt-block';

const PROJECT_ICONS: Record<ProjectType, string> = {
  'embroidery': '🧵',
  'collage': '✂️',
  'quilt-block': '🧩',
};

interface ShareToCommunityModalProps {
  projectType: ProjectType;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultStitchCount?: number;
  defaultThreadColors?: string[];
  onClose: () => void;
  onSuccess: (entry: ShowcaseEntry) => void;
  onError: (msg: string) => void;
}

export const ShareToCommunityModal: React.FC<ShareToCommunityModalProps> = ({
  projectType,
  defaultTitle = '',
  defaultDescription = '',
  defaultStitchCount,
  defaultThreadColors,
  onClose,
  onSuccess,
  onError,
}) => {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [tips, setTips] = useState('');
  const [stitchCount, setStitchCount] = useState(defaultStitchCount ? String(defaultStitchCount) : '');
  const [fabricType, setFabricType] = useState('');
  const [patternSource, setPatternSource] = useState('AI Generated');
  const [timeSpent, setTimeSpent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [userTier, setUserTier] = useState<string>('Hobbyist');

  // Check user tier on mount
  React.useEffect(() => {
    api.getUserProfile()
      .then(u => setUserTier(u.subscriptionTier))
      .catch(() => {});
  }, []);

  const isHobbyist = userTier === 'Hobbyist';

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

    setSubmitting(true);
    setErrors({});

    const result = await api.uploadShowcaseEntry({
      title: title.trim(),
      description: description.trim() || undefined,
      tips: tips.trim() || undefined,
      projectType,
      metadata: {
        stitchCount: stitchCount ? parseInt(stitchCount) : undefined,
        threadColors: defaultThreadColors,
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
            <div className="h-10 w-10 rounded-xl bg-blush-50 flex items-center justify-center text-lg">
              {PROJECT_ICONS[projectType]}
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Share to Community</h3>
              <p className="text-xs text-blush-500">Showcase your finished {projectType} project</p>
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
          {/* Hobbyist Limit Info */}
          {isHobbyist && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-blush-50 border border-blush-200">
              <Crown className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-700">Hobbyist Plan</p>
                <p className="text-[11px] text-blush-500">
                  Limited to 3 uploads per month.{' '}
                  <Link to="/pricing" className="text-blush-600 font-medium underline">Upgrade to Pro</Link> for unlimited sharing!
                </p>
              </div>
            </div>
          )}

          {/* Project Type display */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-blush-50/50 border border-blush-100">
            <span className="text-lg">{PROJECT_ICONS[projectType]}</span>
            <span className="text-xs font-bold text-slate-700 capitalize">{projectType} Project</span>
          </div>

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
              placeholder="Share your best tips for recreating this project..."
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
              disabled={submitting}
              className={`btn-floral-primary flex-1 text-sm flex items-center justify-center gap-2 ${
                submitting ? 'opacity-50 cursor-not-allowed' : ''
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
