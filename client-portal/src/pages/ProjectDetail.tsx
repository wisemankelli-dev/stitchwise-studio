import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, Edit3, Save, Scissors, 
  Settings, LayoutDashboard, Calendar, ShieldAlert, Sparkles, FolderHeart
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

  // Loading skeleton
  if (isLoading && !project) {
    return (
      <div className="bg-floral-soft min-h-screen py-12 px-6 lg:px-8 flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm w-full">
          <div className="h-12 w-12 border-4 border-blush-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="space-y-2">
            <div className="h-4 bg-blush-100 rounded animate-pulse w-3/4 mx-auto"></div>
            <div className="h-3 bg-blush-50 rounded animate-pulse w-1/2 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  // Not Found State
  if (!project) {
    return (
      <div className="bg-floral-soft min-h-screen py-12 px-6 lg:px-8 flex items-center justify-center">
        <div className="max-w-md w-full text-center floral-card-elevated p-8 space-y-6">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-50">
            <ShieldAlert className="h-8 w-8 text-red-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Project Not Found</h2>
            <p className="text-blush-500">
              The project you are looking for may have been deleted, or you might not have access permissions.
            </p>
          </div>
          <div className="flex flex-col gap-3 pt-4">
            <Link
              to="/dashboard"
              className="btn-floral-primary inline-flex items-center justify-center gap-2"
            >
              <LayoutDashboard className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-floral-soft min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Navigation Breadcrumb & Actions */}
        <div className="flex items-center justify-between">
          <Link
            to="/dashboard"
            className="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-blush-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Dashboard
          </Link>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="btn-floral-secondary inline-flex items-center gap-1.5 text-sm"
            >
              <Edit3 className="h-4 w-4" />
              {isEditing ? 'Cancel Edit' : 'Edit Metadata'}
            </button>
            <Link
              to="/designer"
              className="btn-floral-primary inline-flex items-center gap-1.5 text-sm"
            >
              <Scissors className="h-4 w-4" />
              Open in Designer
            </Link>
          </div>
        </div>

        {/* Project Header Banner */}
        <div className="floral-card-elevated overflow-hidden">
          <div className={`h-4 bg-gradient-to-r ${project.previewColor}`} />
          <div className="p-8 sm:p-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-5">
              <span className="text-5xl p-4 bg-blush-50 rounded-2xl border border-blush-100 shadow-inner">
                {project.avatar}
              </span>
              <div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blush-50 text-blush-700 border border-blush-100 mb-2">
                  <Sparkles className="h-3 w-3" />
                  {project.gridSize}
                </span>
                <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">{project.name}</h1>
                <p className="text-sm text-blush-500 font-medium flex items-center gap-1.5 mt-1">
                  <Calendar className="h-4 w-4 text-blush-400" />
                  Last updated {project.lastUpdated}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="inline-flex items-center rounded-full bg-blush-50 px-3 py-1 text-xs font-semibold text-blush-700 border border-blush-100">
                {project.complexity} Plan
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 capitalize">
                Role: {project.role}
              </span>
            </div>
          </div>
        </div>

        {/* Main Work Area - single column, solo focused */}
        <div className="grid grid-cols-1 gap-8">
          
          {/* Project Description & Metadata */}
          <div className="space-y-6">
            
            {/* Edit / Metadata Mode */}
            {isEditing ? (
              <div className="floral-card-elevated p-6 sm:p-8">
                <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Settings className="h-5 w-5 text-blush-500" />
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
                      className="floral-input py-2.5 text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
                    <textarea
                      rows={4}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Give a brief summary of thread colors, fabric count, and stitch count estimation..."
                      className="floral-input py-2.5 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Grid Size</label>
                      <select
                        value={editGridSize}
                        onChange={(e) => setEditGridSize(e.target.value)}
                        className="floral-input py-2.5 text-sm"
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
                        className="floral-input py-2.5 text-sm"
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
                      className="floral-input py-2.5 text-sm"
                    >
                      <option value="from-rose-500 to-amber-500">Rose Amber (Warm)</option>
                      <option value="from-emerald-500 to-teal-400">Emerald Teal (Fresh)</option>
                      <option value="from-violet-500 to-fuchsia-400">Violet Fuchsia (Vibrant)</option>
                      <option value="from-amber-600 to-yellow-400">Amber Yellow (Sunny)</option>
                      <option value="from-pink-600 to-rose-400">Pink Rose (Blossom)</option>
                      <option value="from-brand-500 to-rose-400">Brand Classic (StitchWise)</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-blush-100">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="btn-floral-secondary text-sm"
                    >
                      Discard
                    </button>
                    <button
                      type="submit"
                      className="btn-floral-primary inline-flex items-center gap-1.5 text-sm"
                    >
                      <Save className="h-4 w-4" />
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              /* Display Details Mode */
              <div className="floral-card-elevated p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-blush-100">
                  <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <FolderHeart className="h-5 w-5 text-blush-500" />
                    Project Specifications
                  </h2>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-blush-400 uppercase tracking-wider mb-2">Description</h4>
                  <p className="text-slate-600 leading-relaxed text-sm bg-blush-50 p-4 rounded-2xl border border-blush-100/50">
                    {project.description || "No description provided yet. Click 'Edit Metadata' above to supply structural notes, canvas type, and DMC thread details."}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4">
                  <div className="p-4 bg-blush-50 rounded-2xl border border-blush-100/50 text-center">
                    <span className="text-xs font-semibold text-blush-400 block mb-1">Canvas Grid</span>
                    <span className="text-base font-extrabold text-slate-800">{project.gridSize}</span>
                  </div>

                  <div className="p-4 bg-blush-50 rounded-2xl border border-blush-100/50 text-center">
                    <span className="text-xs font-semibold text-blush-400 block mb-1">Complexity</span>
                    <span className="text-base font-extrabold text-slate-800">{project.complexity}</span>
                  </div>

                  <div className="p-4 bg-blush-50 rounded-2xl border border-blush-100/50 text-center col-span-2 sm:col-span-1">
                    <span className="text-xs font-semibold text-blush-400 block mb-1">Owner</span>
                    <span className="text-base font-extrabold text-slate-800">{project.owner}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};