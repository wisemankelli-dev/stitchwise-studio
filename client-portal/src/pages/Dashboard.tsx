import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Clock, ArrowRight, ShieldCheck, Heart, Sparkles, FolderHeart } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  owner: string;
  avatar: string;
  role: 'owner' | 'collaborator';
  lastUpdated: string;
  gridSize: string;
  collaboratorsCount: number;
  activeSessionId: string;
  complexity: 'Hobbyist' | 'Pro' | 'Masterpiece';
  previewColor: string;
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const myProjects: Project[] = [
    {
      id: 'rose-heart',
      name: 'Rose Heart Patch',
      owner: 'You',
      avatar: '👑',
      role: 'owner',
      lastUpdated: '5 minutes ago',
      gridSize: '16x16 Grid',
      collaboratorsCount: 3,
      activeSessionId: 'rose-heart-collab',
      complexity: 'Hobbyist',
      previewColor: 'from-rose-500 to-amber-500',
    },
    {
      id: 'spring-tulip',
      name: 'Spring Tulip Border',
      owner: 'You',
      avatar: '👑',
      role: 'owner',
      lastUpdated: '2 days ago',
      gridSize: '24x24 Grid',
      collaboratorsCount: 1,
      activeSessionId: 'tulip-collab',
      complexity: 'Pro',
      previewColor: 'from-emerald-500 to-teal-400',
    }
  ];

  const sharedWithMe: Project[] = [
    {
      id: 'vintage-floral',
      name: 'Vintage Floral Border',
      owner: 'Elena Crafter',
      avatar: '🌸',
      role: 'collaborator',
      lastUpdated: '2 hours ago',
      gridSize: '32x32 Grid',
      collaboratorsCount: 4,
      activeSessionId: 'floral-workshop',
      complexity: 'Masterpiece',
      previewColor: 'from-violet-500 to-fuchsia-400',
    },
    {
      id: 'golden-retriever',
      name: 'Golden Retriever Portrait',
      owner: 'Dave Digitizer',
      avatar: '🐕',
      role: 'collaborator',
      lastUpdated: 'Yesterday',
      gridSize: '16x16 Grid',
      collaboratorsCount: 2,
      activeSessionId: 'retriever-workshop',
      complexity: 'Masterpiece',
      previewColor: 'from-amber-600 to-yellow-400',
    },
    {
      id: 'cyberpunk-dragon',
      name: 'Cyberpunk Dragon Patch',
      owner: 'StitchMaster Pro',
      avatar: '🐉',
      role: 'collaborator',
      lastUpdated: '3 days ago',
      gridSize: '48x48 Grid',
      collaboratorsCount: 5,
      activeSessionId: 'dragon-workshop',
      complexity: 'Pro',
      previewColor: 'from-pink-600 to-rose-400',
    }
  ];

  const joinSession = (sessionId: string) => {
    navigate(`/designer?session=${sessionId}`);
  };

  return (
    <div className="bg-slate-50 min-h-screen py-12 px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Dashboard Header */}
        <div className="md:flex md:items-center md:justify-between mb-10 pb-6 border-b border-slate-200">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold leading-7 text-slate-900 sm:text-3xl sm:truncate flex items-center gap-2">
              <LayoutDashboard className="h-7 w-7 text-brand-500" />
              Crafter Dashboard
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Access your digital patterns, track live collaboration, and view designs shared with you.
            </p>
          </div>
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <button
              onClick={() => navigate('/designer')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 transition-colors focus:outline-none"
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
            
            {/* Shared With Me Section */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Users className="h-5 w-5 text-brand-500" />
                  Shared with Me
                </h3>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                  {sharedWithMe.length} workshop projects
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sharedWithMe.map((project) => (
                  <div 
                    key={project.id} 
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 flex flex-col h-full"
                  >
                    <div className={`h-2.5 bg-gradient-to-r ${project.previewColor}`} />
                    
                    <div className="p-6 flex-grow flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700">
                            <Sparkles className="h-3 w-3" />
                            {project.complexity}
                          </span>
                          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {project.lastUpdated}
                          </span>
                        </div>

                        <h4 className="text-base font-bold text-slate-900 line-clamp-1 mb-1">{project.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                          <span className="text-base" title="Designer Avatar">{project.avatar}</span>
                          <span>Shared by <strong className="text-slate-700 font-semibold">{project.owner}</strong></span>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Users className="h-4 w-4 text-slate-400" />
                          <span>{project.collaboratorsCount} active</span>
                        </div>
                        
                        <button
                          onClick={() => joinSession(project.activeSessionId)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-brand-600 hover:bg-brand-500 transition-colors shadow-sm"
                        >
                          Join Workshop
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* My Personal Projects Section */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FolderHeart className="h-5 w-5 text-brand-500" />
                  My Patterns
                </h3>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800">
                  {myProjects.length} created
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {myProjects.map((project) => (
                  <div 
                    key={project.id} 
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 flex flex-col h-full"
                  >
                    <div className={`h-2.5 bg-gradient-to-r ${project.previewColor}`} />
                    
                    <div className="p-6 flex-grow flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                            {project.gridSize}
                          </span>
                          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {project.lastUpdated}
                          </span>
                        </div>

                        <h4 className="text-base font-bold text-slate-900 line-clamp-1 mb-1">{project.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                          <span className="text-base">👑</span>
                          <span>Owner: <strong className="text-slate-700 font-semibold">{project.owner}</strong></span>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Users className="h-4 w-4 text-slate-400" />
                          <span>{project.collaboratorsCount} collaborators</span>
                        </div>
                        
                        <button
                          onClick={() => joinSession(project.activeSessionId)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
                        >
                          Open Editor
                          <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Sidebar - Right 4 columns */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Quick Stats / Info Widget */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.15),transparent)] pointer-events-none" />
              
              <h3 className="text-lg font-extrabold flex items-center gap-2 mb-4">
                <Heart className="h-5 w-5 text-brand-500 animate-pulse" />
                Workshop Hub
              </h3>
              
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                Collaborative workshops enable designers and hobbyists to co-create beautiful embroidery patterns in real-time. Invite others to fine-tune stitch layouts, thread selections, and layout styles together.
              </p>

              <div className="space-y-3 mt-6">
                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-white/5">
                  <div className="h-8 w-8 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Generate Share Link</h4>
                    <p className="text-[10px] text-slate-400">Click share inside the pattern designer tool</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-white/5">
                  <div className="h-8 w-8 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Invite Collaborators</h4>
                    <p className="text-[10px] text-slate-400">Invite hobbyists or other master stitchers</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-white/5">
                  <div className="h-8 w-8 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center font-bold text-sm">
                    3
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Co-Create Live</h4>
                    <p className="text-[10px] text-slate-400">Witness grid updates in real-time as they stitch</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quality Standard Banner */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 mb-2">
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
