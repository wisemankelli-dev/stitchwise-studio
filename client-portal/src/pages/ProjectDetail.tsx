import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, Edit3, Save, Share2, Copy, Check, Mail, Scissors, 
  Users, Settings, LayoutDashboard, Calendar, Compass, ShieldAlert, Sparkles, FolderHeart
} from 'lucide-react';
import { Project, api } from '../services/api';

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Edit metadata form states
  const [editName, setEditName] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editGridSize, setEditGridSize] = useState<string>('');
  const [editComplexity, setEditComplexity] = useState<'Hobbyist' | 'Pro' | 'Masterpiece'>('Hobbyist');
  const [editPreviewColor, setEditPreviewColor] = useState<string>('');

  // Share and Invite states
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [shareLink, setShareLink] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteLoading, setInviteLoading] = useState<boolean>(false);
  const [inviteSuccess, setInviteSuccess] = useState<boolean>(false);

  // Fetch project data
  useEffect(() => {
    const fetchProject = async () => {
      if (!id) return;
      try {
        setIsLoading(true);
        const data = await api.getProject(id);
        if (data) {
          setProject(data);
          setEditName(data.name);
          setEditDescription(data.description || '');
          setEditGridSize(data.gridSize);
          setEditComplexity(data.complexity);
          setEditPreviewColor(data.previewColor);
        }
      } catch (err) {
        console.error('Error fetching project:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProject();
  }, [id]);

  // Handle Metadata Save
  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !project) return;

    try {
      setIsLoading(true);
      const updated = await api.updateProject(id, {
        name: editName,
        description: editDescription,
        gridSize: editGridSize,
        complexity: editComplexity,
        previewColor: editPreviewColor
      });
      if (updated) {
        setProject(updated);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Error updating project:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate and Copy Share Link
  const handleGenerateShareLink = async () => {
    if (!id) return;
    try {
      const link = await api.createShareLink(id);
      setShareLink(link);
      setShowShareModal(true);
    } catch (err) {
      console.error('Error generating share link:', err);
    }
  };

  const handleCopyLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Invite Collaborator Form
  const handleInviteCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !inviteEmail.trim()) return;

    try {
      setInviteLoading(true);
      setInviteSuccess(false);
      const success = await api.inviteCollaborator(id, inviteEmail);
      if (success) {
        setInviteSuccess(true);
        setInviteEmail('');
        // Refresh project state to see incremented collaborators count
        const updatedProj = await api.getProject(id);
        if (updatedProj) {
          setProject(updatedProj);
        }
        setTimeout(() => setInviteSuccess(false), 4000);
      }
    } catch (err) {
      console.error('Error inviting collaborator:', err);
    } finally {
      setInviteLoading(false);
    }
  };

  // Loading skeleton
  if (isLoading && !project) {
    return (
      <div className="bg-slate-50 min-h-screen py-12 px-6 lg:px-8 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm w-full">
          <div className="h-12 w-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="space-y-2">
            <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4 mx-auto"></div>
            <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  // Not Found State
  if (!project) {
    return (
      <div className="bg-slate-50 min-h-screen py-12 px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-md w-full text-center bg-white rounded-3xl p-8 border border-slate-200 shadow-xl space-y-6">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
            <ShieldAlert className="h-8 w-8 text-red-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Project Not Found</h2>
            <p className="text-slate-500">
              The project you are looking for may have been deleted, or you might not have access permissions.
            </p>
          </div>
          <div className="flex flex-col gap-3 pt-4">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center w-full px-4 py-2.5 border border-transparent text-sm font-semibold rounded-xl text-white bg-brand-600 hover:bg-brand-500 shadow-sm transition-all focus:outline-none"
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Navigation Breadcrumb & Actions */}
        <div className="flex items-center justify-between">
          <Link
            to="/dashboard"
            className="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Dashboard
          </Link>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 shadow-sm transition-colors"
            >
              <Edit3 className="h-4 w-4 text-slate-500" />
              {isEditing ? 'Cancel Edit' : 'Edit Metadata'}
            </button>
            <Link
              to={`/designer?session=${project.activeSessionId}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-500 shadow-md transition-all"
            >
              <Scissors className="h-4 w-4" />
              Open Pattern in Designer
            </Link>
          </div>
        </div>

        {/* Project Header Banner */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
          <div className={`h-4 bg-gradient-to-r ${project.previewColor}`} />
          <div className="p-8 sm:p-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-5">
              <span className="text-5xl p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                {project.avatar}
              </span>
              <div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100 mb-2">
                  <Compass className="h-3 w-3 animate-spin" />
                  {project.gridSize}
                </span>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{project.name}</h1>
                <p className="text-sm text-slate-500 font-medium flex items-center gap-1.5 mt-1">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  Last updated {project.lastUpdated}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {project.complexity} Plan
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 capitalize">
                Role: {project.role}
              </span>
            </div>
          </div>
        </div>

        {/* Main Work Area split into Details/Edit and Collaboration widgets */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          
          {/* Left Column: Project Description & Metadata Edit (8 cols) */}
          <div className="md:col-span-8 space-y-6">
            
            {/* Edit / Metadata Mode */}
            {isEditing ? (
              <div className="bg-white rounded-3xl border border-slate-200 shadow-lg p-6 sm:p-8">
                <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Settings className="h-5 w-5 text-brand-500 animate-spin" />
                  Edit Project Information
                </h2>
                
                <form onSubmit={handleSaveChanges} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Project Name</label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm transition-all"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
                    <textarea
                      rows={4}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Give a brief summary of thread colors, fabric count, and stitch count estimation..."
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Grid Size</label>
                      <select
                        value={editGridSize}
                        onChange={(e) => setEditGridSize(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm transition-all"
                      >
                        <option value="16x16 Grid">16x16 Grid (Standard)</option>
                        <option value="24x24 Grid">24x24 Grid (Intermediate)</option>
                        <option value="32x32 Grid">32x32 Grid (Advanced)</option>
                        <option value="48x48 Grid">48x48 Grid (Expert)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Complexity Tier</label>
                      <select
                        value={editComplexity}
                        onChange={(e) => setEditComplexity(e.target.value as any)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm transition-all"
                      >
                        <option value="Hobbyist">Hobbyist</option>
                        <option value="Pro">Pro Crafter</option>
                        <option value="Masterpiece">Masterpiece</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Preview Banner Color Theme</label>
                    <select
                      value={editPreviewColor}
                      onChange={(e) => setEditPreviewColor(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm transition-all"
                    >
                      <option value="from-rose-500 to-amber-500">Rose Amber (Warm)</option>
                      <option value="from-emerald-500 to-teal-400">Emerald Teal (Fresh)</option>
                      <option value="from-violet-500 to-fuchsia-400">Violet Fuchsia (Vibrant)</option>
                      <option value="from-amber-600 to-yellow-400">Amber Yellow (Sunny)</option>
                      <option value="from-pink-600 to-rose-400">Pink Rose (Blossom)</option>
                      <option value="from-brand-500 to-rose-400">Brand Classic (StitchWise)</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-sm font-semibold transition-colors"
                    >
                      Discard
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-500 shadow-md transition-all"
                    >
                      <Save className="h-4 w-4" />
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* Display Details Mode */
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <FolderHeart className="h-5 w-5 text-brand-500" />
                    Project Specifications
                  </h2>
                </div>

                <div className="prose prose-slate max-w-none">
                  <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</h4>
                  <p className="text-slate-600 leading-relaxed text-sm bg-slate-50 p-4 rounded-2xl border border-slate-100/50">
                    {project.description || "No description provided yet. Click 'Edit Metadata' above to supply structural notes, canvas type, and DMC thread details."}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50 text-center">
                    <span className="text-xs font-semibold text-slate-400 block mb-1">Canvas Grid</span>
                    <span className="text-base font-extrabold text-slate-800">{project.gridSize}</span>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50 text-center">
                    <span className="text-xs font-semibold text-slate-400 block mb-1">Complexity</span>
                    <span className="text-base font-extrabold text-slate-800">{project.complexity}</span>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100/50 text-center col-span-2 sm:col-span-1">
                    <span className="text-xs font-semibold text-slate-400 block mb-1">Owner</span>
                    <span className="text-base font-extrabold text-slate-800">{project.owner}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Collaboration, Sharing, and Invite Panel (4 cols) */}
          <div className="md:col-span-4 space-y-6">
            
            {/* Share Project Panel */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-5">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Share2 className="h-5 w-5 text-brand-500" />
                Collaborative Sharing
              </h3>
              
              <p className="text-xs text-slate-500 leading-relaxed">
                Unlock real-time stitch synchronization, multi-user cursors, and visual design feedback inside the StitchWise Workshop.
              </p>

              <button
                onClick={handleGenerateShareLink}
                className="inline-flex items-center justify-center w-full gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-sm"
              >
                <Sparkles className="h-4 w-4 text-brand-400" />
                Create Sharing Session Link
              </button>
            </div>

            {/* Invite Collaborators panel */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-5">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-brand-500" />
                Invite Contributors ({project.collaboratorsCount})
              </h3>
              
              <p className="text-xs text-slate-500 leading-relaxed">
                Add crafters directly by email. Instructors and studio designers will automatically be added to your active workshop.
              </p>

              <form onSubmit={handleInviteCollaborator} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="partner@stitchwise.studio"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-xs transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="inline-flex items-center justify-center w-full px-4 py-2 border border-transparent text-xs font-bold rounded-xl text-brand-700 bg-brand-50 hover:bg-brand-100 border-brand-100 transition-colors focus:outline-none disabled:opacity-50"
                >
                  {inviteLoading ? 'Sending Invitation...' : 'Send Direct Invite'}
                </button>
              </form>

              {inviteSuccess && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-800 text-xs font-medium animate-fade-in flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-600" />
                  Crafter invited successfully!
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Share Link Modal Overlay */}
        {showShareModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 max-w-lg w-full text-center space-y-6 animate-scale-up">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-brand-50 border border-brand-100">
                <Share2 className="h-6 w-6 text-brand-600" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">Active Workshop Session Ready</h3>
                <p className="text-xs text-slate-500">
                  Any creator with this secure endpoint will be able to synchronize stitches and edits simultaneously.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <input
                  type="text"
                  readOnly
                  value={shareLink}
                  className="flex-grow bg-transparent outline-none text-slate-600 text-xs font-mono font-medium truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                >
                  {isCopied ? (
                    <>
                      <Check className="h-3 w-3" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy Link
                    </>
                  )}
                </button>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setShowShareModal(false)}
                  className="px-6 py-2 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 text-xs font-semibold transition-colors w-full"
                >
                  Close Sharing Link Dialog
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
