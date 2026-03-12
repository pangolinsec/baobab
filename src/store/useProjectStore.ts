import { create } from 'zustand';
import type { Project, ProjectFile } from '../types';
import { db } from '../db/database';
import {
  fetchProjectFiles,
  uploadProjectFile,
  deleteProjectFile,
  deleteBackendProject,
  checkBackendAvailable,
} from '../api/backend';

const BACKEND_PROJECT_SIZE_CAP = 50 * 1024 * 1024; // 50 MB
const LOCAL_PROJECT_SIZE_CAP = 20 * 1024 * 1024;    // 20 MB

const TEXT_MIME_TYPES = new Set([
  'text/plain', 'text/markdown', 'text/csv', 'text/html', 'text/css',
  'text/javascript', 'text/xml', 'text/yaml', 'text/x-python',
  'application/json', 'application/xml', 'application/javascript',
  'application/x-yaml', 'application/x-sh',
]);

function isTextMimeType(mimeType: string): boolean {
  if (mimeType.startsWith('text/')) return true;
  return TEXT_MIME_TYPES.has(mimeType);
}

interface ProjectState {
  projects: Project[];
  filesByProject: Record<string, ProjectFile[]>;

  loadProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project>;
  updateProject: (id: string, updates: { name?: string; description?: string; systemPrompt?: string; injectDescription?: boolean; knowledgeMode?: 'off' | 'direct' | 'agentic' }) => Promise<void>;
  getProject: (id: string) => Project | undefined;
  deleteProject: (id: string) => Promise<void>;
  fetchFiles: (projectId: string) => Promise<void>;
  uploadFile: (projectId: string, file: File) => Promise<ProjectFile>;
  deleteFile: (projectId: string, fileId: string) => Promise<void>;
  getProjectFiles: (projectId: string) => ProjectFile[];
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  filesByProject: {},

  loadProjects: async () => {
    const projects = await db.projects.orderBy('updatedAt').reverse().toArray();
    set({ projects });
  },

  createProject: async (name: string, description?: string) => {
    const now = Date.now();
    const project: Project = {
      id: crypto.randomUUID(),
      name,
      description: description || '',
      createdAt: now,
      updatedAt: now,
    };
    await db.projects.put(project);
    set(state => ({ projects: [project, ...state.projects] }));

    // Fire-and-forget backend sync
    fetch('http://localhost:3001/api/projects', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: project.id, name: project.name }),
    }).catch(() => {});

    return project;
  },

  getProject: (id: string) => {
    return get().projects.find(p => p.id === id);
  },

  updateProject: async (id: string, updates: { name?: string; description?: string; systemPrompt?: string; injectDescription?: boolean; knowledgeMode?: 'off' | 'direct' | 'agentic' }) => {
    const updatedFields = { ...updates, updatedAt: Date.now() };
    await db.projects.update(id, updatedFields);
    set(state => ({
      projects: state.projects.map(p =>
        p.id === id ? { ...p, ...updatedFields } : p
      ),
    }));
  },

  deleteProject: async (id: string) => {
    // Unset projectId on all conversations belonging to this project
    const convs = await db.conversations.where('projectId').equals(id).toArray();
    for (const conv of convs) {
      await db.conversations.update(conv.id, { projectId: undefined });
    }

    await db.projects.delete(id);

    // Also clean up local project files
    await db.projectFiles.where('projectId').equals(id).delete();

    set(state => ({
      projects: state.projects.filter(p => p.id !== id),
      filesByProject: (() => {
        const copy = { ...state.filesByProject };
        delete copy[id];
        return copy;
      })(),
    }));

    // Backend cascade delete (files on disk + SQLite)
    deleteBackendProject(id).catch(err => {
      console.error('Failed to cascade-delete project files from backend:', err);
    });
  },

  fetchFiles: async (projectId: string) => {
    if (await checkBackendAvailable()) {
      try {
        const files = await fetchProjectFiles(projectId);
        set(state => ({
          filesByProject: { ...state.filesByProject, [projectId]: files },
        }));
        return;
      } catch (err) {
        console.error('Failed to fetch project files from backend:', err);
      }
    }

    // Fall back to local Dexie storage
    try {
      const localFiles = await db.projectFiles.where('projectId').equals(projectId).toArray();
      const asProjectFiles: ProjectFile[] = localFiles.map(f => ({
        id: f.id,
        projectId: f.projectId,
        filename: f.filename,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        extractedTextPreview: f.extractedText.slice(0, 200) || null,
      }));
      set(state => ({
        filesByProject: { ...state.filesByProject, [projectId]: asProjectFiles },
      }));
    } catch (err) {
      console.error('Failed to fetch local project files:', err);
    }
  },

  uploadFile: async (projectId: string, file: File) => {
    const existingFiles = get().getProjectFiles(projectId);
    const currentTotal = existingFiles.reduce((sum, f) => sum + f.sizeBytes, 0);

    if (await checkBackendAvailable()) {
      // Backend mode: 50MB cap
      if (currentTotal + file.size > BACKEND_PROJECT_SIZE_CAP) {
        throw new Error(`Project file limit exceeded (${(BACKEND_PROJECT_SIZE_CAP / (1024 * 1024)).toFixed(0)}MB cap)`);
      }
      const uploaded = await uploadProjectFile(projectId, file);
      set(state => ({
        filesByProject: {
          ...state.filesByProject,
          [projectId]: [uploaded, ...(state.filesByProject[projectId] || [])],
        },
      }));
      return uploaded;
    }

    // Browser-only mode: text files only, 20MB cap
    if (!isTextMimeType(file.type || 'application/octet-stream')) {
      throw new Error('Only text files are supported without the backend. PDF and image files require the backend server.');
    }

    if (currentTotal + file.size > LOCAL_PROJECT_SIZE_CAP) {
      throw new Error(`Project file limit exceeded (${(LOCAL_PROJECT_SIZE_CAP / (1024 * 1024)).toFixed(0)}MB cap, browser-only mode)`);
    }

    const text = await file.text();
    const localFile = {
      id: crypto.randomUUID(),
      projectId,
      filename: file.name,
      mimeType: file.type || 'text/plain',
      sizeBytes: file.size,
      extractedText: text,
      createdAt: Date.now(),
    };
    await db.projectFiles.put(localFile);

    const asProjectFile: ProjectFile = {
      id: localFile.id,
      projectId: localFile.projectId,
      filename: localFile.filename,
      mimeType: localFile.mimeType,
      sizeBytes: localFile.sizeBytes,
      extractedTextPreview: text.slice(0, 200) || null,
    };
    set(state => ({
      filesByProject: {
        ...state.filesByProject,
        [projectId]: [asProjectFile, ...(state.filesByProject[projectId] || [])],
      },
    }));
    return asProjectFile;
  },

  deleteFile: async (projectId: string, fileId: string) => {
    if (await checkBackendAvailable()) {
      try {
        await deleteProjectFile(fileId);
      } catch {
        // Fall through to local delete
      }
    }

    // Also delete from local storage if it exists there
    await db.projectFiles.delete(fileId).catch(() => {});

    set(state => ({
      filesByProject: {
        ...state.filesByProject,
        [projectId]: (state.filesByProject[projectId] || []).filter(f => f.id !== fileId),
      },
    }));
  },

  getProjectFiles: (projectId: string) => {
    return get().filesByProject[projectId] || [];
  },
}));
