import React, { useState } from 'react';
import { Project } from '../types';

interface ProjectsNavigationDrawerProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (project: Project) => void;
  onCreateNewProject: () => void;
  onDeleteProject: (projectId: string) => void;
  onRenameProject: (projectId: string, newTitle: string) => void;
  onDuplicateProject: (project: Project) => void;
  themeMode?: 'light' | 'dark';
}

export const ProjectsNavigationDrawer: React.FC<ProjectsNavigationDrawerProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateNewProject,
  onDeleteProject,
  onRenameProject,
  onDuplicateProject,
  themeMode = 'dark'
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'scripted' | 'rendered' | 'published'>('all');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const filteredProjects = projects.filter(p => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'draft') return p.status === 'draft' || !p.status;
    return p.status === statusFilter;
  });

  const getStatusBadge = (status: Project['status']) => {
    switch (status) {
      case 'rendered':
        return { label: 'Rendered', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-500' };
      case 'scripted':
        return { label: 'Scripted', bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30', dot: 'bg-purple-500' };
      case 'published':
        return { label: 'Published', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30', dot: 'bg-blue-500' };
      default:
        return { label: 'Draft', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-500' };
    }
  };

  return (
    <div className="space-y-4 py-2">
      {/* NEW PROJECT BUTTON */}
      <button
        onClick={onCreateNewProject}
        className="btn-3d btn-3d-orange w-full py-3.5 px-4 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
      >
        <i className="fa-solid fa-plus-circle text-sm"></i>
        <span>New Creation Project</span>
      </button>

      {/* REFINED SEGMENTED PROJECT FILTER CONTROL */}
      <div className={`p-1 rounded-2xl border flex items-center gap-1 ${
        themeMode === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-slate-950/80 border-white/10'
      }`}>
        {[
          { id: 'all', label: 'All Projects', count: projects.length },
          { id: 'draft', label: 'Drafts', count: projects.filter(p => p.status === 'draft' || !p.status).length },
          { id: 'scripted', label: 'Scripted', count: projects.filter(p => p.status === 'scripted').length },
          { id: 'rendered', label: 'Rendered', count: projects.filter(p => p.status === 'rendered').length }
        ].map((st) => {
          const isSelected = statusFilter === st.id;
          return (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id as any)}
              className={`flex-1 py-2 px-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight flex items-center justify-center gap-1.5 transition-all ${
                isSelected
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md'
                  : themeMode === 'light'
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{st.label}</span>
              {st.count > 0 && (
                <span className={`text-[8px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  isSelected ? 'bg-black/30 text-white' : 'bg-white/10 text-slate-400'
                }`}>
                  {st.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* PROJECTS LIST */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {filteredProjects.length === 0 ? (
          <div className={`p-4 text-center rounded-2xl border text-[11px] text-slate-500 font-medium ${
            themeMode === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/5'
          }`}>
            No video projects found. Click "New Creation Project" to start one!
          </div>
        ) : (
          filteredProjects.map((project) => {
            const isActive = activeProjectId === project.id;
            const badge = getStatusBadge(project.status);

            return (
              <div
                key={project.id}
                onClick={() => onSelectProject(project)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-500/15 to-amber-500/10 border-orange-500/50 text-white shadow-md'
                    : themeMode === 'light'
                    ? 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-800'
                    : 'bg-white/5 border-white/5 hover:border-white/20 text-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                    <div className="w-8 h-8 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {project.thumbnailUrl ? (
                        <img src={project.thumbnailUrl} alt="Thumb" className="w-full h-full object-cover" />
                      ) : (
                        <i className={`fa-solid ${project.aspectRatio === 'vertical' ? 'fa-mobile-screen-button' : 'fa-film'} text-ggd-orange text-xs`}></i>
                      )}
                    </div>

                    <div className="overflow-hidden flex-1">
                      {editingProjectId === project.id ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <input 
                            type="text" 
                            value={editingTitle} 
                            onChange={e => setEditingTitle(e.target.value)}
                            className={`w-full border border-orange-500 px-2 py-1 rounded-lg text-xs font-bold outline-none ${
                              themeMode === 'light' ? 'bg-white text-slate-900' : 'bg-black/40 text-white'
                            }`}
                            autoFocus
                          />
                          <button 
                            onClick={() => {
                              onRenameProject(project.id, editingTitle);
                              setEditingProjectId(null);
                            }}
                            className="text-emerald-500 hover:text-emerald-400 text-xs p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center cursor-pointer"
                          >
                            <i className="fa-solid fa-check"></i>
                          </button>
                        </div>
                      ) : (
                        <p className={`text-xs font-black uppercase truncate group-hover:text-ggd-orange transition-colors ${
                          themeMode === 'light' ? 'text-slate-900' : 'text-white'
                        }`}>
                          {project.title || project.topic}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[8px] font-bold uppercase px-1.5 py-0.2 rounded border flex items-center gap-1 ${badge.bg}`}>
                          <span className={`w-1 h-1 rounded-full ${badge.dot}`}></span>
                          <span>{badge.label}</span>
                        </span>
                        <span className={`text-[8px] font-mono font-bold ${themeMode === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                          {project.aspectRatio === 'vertical' ? '9:16' : project.aspectRatio === 'horizontal' ? '16:9' : '1:1'} • {project.targetDuration || '30s'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* OPTIONS MENU */}
                  <div className="flex items-center gap-1 opacity-90 sm:opacity-80 group-hover:opacity-100 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => onDuplicateProject(project)}
                      title="Duplicate Project"
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-[11px] transition-all cursor-pointer ${
                        themeMode === 'light'
                          ? 'bg-slate-200/80 hover:bg-slate-300 text-slate-700'
                          : 'bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white'
                      }`}
                    >
                      <i className="fa-solid fa-copy"></i>
                    </button>
                    <button
                      onClick={() => {
                        setEditingProjectId(project.id);
                        setEditingTitle(project.title || project.topic);
                      }}
                      title="Rename Project"
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-[11px] transition-all cursor-pointer ${
                        themeMode === 'light'
                          ? 'bg-slate-200/80 hover:bg-slate-300 text-slate-700'
                          : 'bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white'
                      }`}
                    >
                      <i className="fa-solid fa-pen"></i>
                    </button>
                    <button
                      onClick={() => onDeleteProject(project.id)}
                      title="Delete Project"
                      className="w-7 h-7 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center text-[11px] transition-all cursor-pointer"
                    >
                      <i className="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
