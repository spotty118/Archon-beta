// Supabase-backed Project & Task Service (replaces API-based projectService)
// Provides real implementations hitting Supabase tables: archon_projects, archon_tasks, archon_document_versions

import { supabase } from '../lib/supabaseClient';
import type {
  Project,
  Task,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
  DatabaseTaskStatus,
  UITaskStatus,
  ProjectManagementEvent
} from '../types/project';
import {
  validateCreateProject,
  validateUpdateProject,
  validateCreateTask,
  validateUpdateTask,
  validateUpdateTaskStatus,
  formatValidationErrors
} from '../lib/projectSchemas';
import { dbTaskToUITask, uiStatusToDBStatus } from '../types/project';

// Basic error classes consistent with legacy service
export class ProjectServiceError extends Error {
  constructor(message: string, public code?: string, public statusCode?: number) {
    super(message);
    this.name = 'ProjectServiceError';
  }
}
export class ValidationError extends ProjectServiceError {
  constructor(message: string) { super(message, 'VALIDATION_ERROR', 400); }
}

// Real-time broadcast (in-memory WebSocket bridge identical signature to legacy)
let websocketConnection: WebSocket | null = null;
const projectUpdateSubscriptions: Map<string, (event: ProjectManagementEvent) => void> = new Map();

function initializeWebSocket() {
  if (websocketConnection?.readyState === WebSocket.OPEN) return websocketConnection;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const wsUrl = `${protocol}//${host}/ws/project-updates`;
  websocketConnection = new WebSocket(wsUrl);
  websocketConnection.onopen = () => console.log('📡 Project WebSocket (Supabase service) connected');
  websocketConnection.onclose = () => setTimeout(initializeWebSocket, 3000);
  return websocketConnection;
}

async function currentUserId(): Promise<string> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id || 'anonymous';
  } catch { return 'anonymous'; }
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = (now.getTime() - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff/60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff/86400)} days ago`;
  return `${Math.floor(diff/604800)} weeks ago`;
}

function broadcastProjectUpdate(type: 'PROJECT_CREATED' | 'PROJECT_UPDATED' | 'PROJECT_DELETED', projectId: string, data: any) {
  const event: ProjectManagementEvent = {
    type,
    projectId,
    userId: (window as any)?.__ARCHON_AUTH__?.user?.id || 'anonymous',
    timestamp: new Date().toISOString(),
    data
  } as any;
  if (websocketConnection?.readyState === WebSocket.OPEN) websocketConnection.send(JSON.stringify(event));
  projectUpdateSubscriptions.get(projectId)?.(event);
}
function broadcastTaskUpdate(type: 'TASK_CREATED' | 'TASK_UPDATED' | 'TASK_MOVED' | 'TASK_DELETED' | 'TASK_ARCHIVED', taskId: string, projectId: string, data: any) {
  const event: ProjectManagementEvent = {
    type,
    taskId,
    projectId,
    userId: (window as any)?.__ARCHON_AUTH__?.user?.id || 'anonymous',
    timestamp: new Date().toISOString(),
    data
  } as any;
  if (websocketConnection?.readyState === WebSocket.OPEN) websocketConnection.send(JSON.stringify(event));
  projectUpdateSubscriptions.get(projectId)?.(event);
}

export const projectService = {
  // ========== PROJECTS ==========
  async listProjects(): Promise<Project[]> {
    const { data, error } = await supabase.from('archon_projects').select('*').order('pinned', { ascending: false }).order('title');
    if (error) throw new ProjectServiceError(error.message, 'DB_ERROR', error.code as any);
  const projects: Project[] = (data || []).map((p: any) => ({
      ...p,
      progress: 0,
      updated: formatRelativeTime(p.updated_at),
      pinned: !!p.pinned
    }));
    // Compute progress in one pass of tasks
    const { data: tasksData, error: tasksErr } = await supabase.from('archon_tasks').select('id, project_id, status, archived').eq('archived', false);
    if (!tasksErr && tasksData) {
      const grouped: Record<string, { total: number; done: number }> = {};
  tasksData.forEach((t: any) => {
        if (!grouped[t.project_id]) grouped[t.project_id] = { total: 0, done: 0 };
        grouped[t.project_id].total += 1;
        if (t.status === 'done') grouped[t.project_id].done += 1;
      });
      projects.forEach(p => {
        const g = grouped[p.id];
        if (g && g.total > 0) p.progress = Math.round((g.done / g.total) * 100);
      });
    }
    return projects;
  },

  async getProject(projectId: string): Promise<Project> {
    const { data, error } = await supabase.from('archon_projects').select('*').eq('id', projectId).single();
    if (error || !data) throw new ProjectServiceError(error?.message || 'Not found', 'NOT_FOUND', 404);
    const proj: Project = { ...data, progress: 0, updated: formatRelativeTime(data.updated_at), pinned: !!data.pinned };
    // compute progress
    const { data: tasks, error: terr } = await supabase.from('archon_tasks').select('status, archived').eq('project_id', projectId).eq('archived', false);
    if (!terr && tasks && tasks.length) {
      const total = tasks.length;
  const done = tasks.filter((t: any) => t.status === 'done').length;
      proj.progress = Math.round((done / total) * 100);
    }
    return proj;
  },

  async createProject(projectData: CreateProjectRequest): Promise<Project> {
    const validation = validateCreateProject(projectData);
    if (!validation.success) throw new ValidationError(formatValidationErrors(validation.error));
    const insert = {
      title: validation.data.title,
      description: validation.data.description || '',
      docs: validation.data.docs || [],
      features: validation.data.features || [],
      data: validation.data.data || [],
      github_repo: validation.data.github_repo || null,
      pinned: validation.data.pinned || false
    };
    const { data, error } = await supabase.from('archon_projects').insert(insert).select('*').single();
    if (error || !data) throw new ProjectServiceError(error?.message || 'Insert failed', 'DB_ERROR');
    const project: Project = { ...data, progress: 0, updated: formatRelativeTime(data.created_at), pinned: !!data.pinned };
    broadcastProjectUpdate('PROJECT_CREATED', project.id, project);
    return project;
  },

  async createProjectWithStreaming(projectData: CreateProjectRequest): Promise<{ progress_id: string; status: string; message: string }> {
    const project = await this.createProject(projectData);
    return { progress_id: project.id, status: 'completed', message: 'Project created' };
  },

  async updateProject(projectId: string, updates: UpdateProjectRequest): Promise<Project> {
    const validation = validateUpdateProject(updates);
    if (!validation.success) throw new ValidationError(formatValidationErrors(validation.error));
    const { data, error } = await supabase.from('archon_projects').update(validation.data).eq('id', projectId).select('*').single();
    if (error || !data) throw new ProjectServiceError(error?.message || 'Update failed', 'DB_ERROR');
    const project: Project = { ...data, progress: 0, updated: formatRelativeTime(data.updated_at), pinned: !!data.pinned };
    broadcastProjectUpdate('PROJECT_UPDATED', project.id, updates);
    return project;
  },

  async deleteProject(projectId: string): Promise<void> {
    const { error } = await supabase.from('archon_projects').delete().eq('id', projectId);
    if (error) throw new ProjectServiceError(error.message, 'DB_ERROR');
    broadcastProjectUpdate('PROJECT_DELETED', projectId, {});
  },

  // ========== TASKS ==========
  async getTasksByProject(projectId: string): Promise<Task[]> {
    const { data, error } = await supabase.from('archon_tasks').select('*').eq('project_id', projectId).eq('archived', false).order('task_order', { ascending: true });
    if (error) throw new ProjectServiceError(error.message, 'DB_ERROR');
  return (data || []).map((t: any) => dbTaskToUITask(t as any));
  },

  async getTask(taskId: string): Promise<Task> {
    const { data, error } = await supabase.from('archon_tasks').select('*').eq('id', taskId).single();
    if (error || !data) throw new ProjectServiceError(error?.message || 'Not found', 'NOT_FOUND', 404);
    return dbTaskToUITask(data as any);
  },

  async createTask(taskData: CreateTaskRequest): Promise<Task> {
    const validation = validateCreateTask(taskData);
    if (!validation.success) throw new ValidationError(formatValidationErrors(validation.error));
    const defaults = {
      status: validation.data.status || 'todo',
      assignee: validation.data.assignee || 'User',
      task_order: validation.data.task_order || 0,
      feature: validation.data.feature || null,
      sources: validation.data.sources || [],
      code_examples: validation.data.code_examples || []
    };
    const insert = { ...validation.data, ...defaults };
    const { data, error } = await supabase.from('archon_tasks').insert(insert).select('*').single();
    if (error || !data) throw new ProjectServiceError(error?.message || 'Insert failed', 'DB_ERROR');
    broadcastTaskUpdate('TASK_CREATED', data.id, data.project_id, data);
    return dbTaskToUITask(data as any);
  },

  async updateTask(taskId: string, updates: UpdateTaskRequest): Promise<Task> {
    const validation = validateUpdateTask(updates);
    if (!validation.success) throw new ValidationError(formatValidationErrors(validation.error));
    const { data, error } = await supabase.from('archon_tasks').update(validation.data).eq('id', taskId).select('*').single();
    if (error || !data) throw new ProjectServiceError(error?.message || 'Update failed', 'DB_ERROR');
    broadcastTaskUpdate('TASK_UPDATED', data.id, data.project_id, updates);
    return dbTaskToUITask(data as any);
  },

  async updateTaskStatus(taskId: string, uiStatus: UITaskStatus): Promise<Task> {
    const dbStatus: DatabaseTaskStatus = uiStatusToDBStatus(uiStatus);
    const validation = validateUpdateTaskStatus({ task_id: taskId, status: dbStatus });
    if (!validation.success) throw new ValidationError(formatValidationErrors(validation.error));
    const { data, error } = await supabase.from('archon_tasks').update({ status: dbStatus }).eq('id', taskId).select('*').single();
    if (error || !data) throw new ProjectServiceError(error?.message || 'Status update failed', 'DB_ERROR');
    broadcastTaskUpdate('TASK_MOVED', data.id, data.project_id, { status: dbStatus });
    return dbTaskToUITask(data as any);
  },

  async deleteTask(taskId: string): Promise<void> {
    // Soft archive instead of physical delete
    const user = await currentUserId();
    const { data, error } = await supabase.from('archon_tasks').update({ archived: true, archived_at: new Date().toISOString(), archived_by: user }).eq('id', taskId).select('id, project_id').single();
    if (error) throw new ProjectServiceError(error.message, 'DB_ERROR');
    broadcastTaskUpdate('TASK_ARCHIVED', taskId, data?.project_id, {});
  },

  async updateTaskOrder(taskId: string, newOrder: number, newStatus?: DatabaseTaskStatus): Promise<Task> {
    const updates: any = { task_order: newOrder };
    if (newStatus) updates.status = newStatus;
    const { data, error } = await supabase.from('archon_tasks').update(updates).eq('id', taskId).select('*').single();
    if (error || !data) throw new ProjectServiceError(error?.message || 'Order update failed', 'DB_ERROR');
    broadcastTaskUpdate('TASK_MOVED', data.id, data.project_id, updates);
    return dbTaskToUITask(data as any);
  },

  async getTasksByStatus(status: DatabaseTaskStatus): Promise<Task[]> {
    const { data, error } = await supabase.from('archon_tasks').select('*').eq('status', status).eq('archived', false);
    if (error) throw new ProjectServiceError(error.message, 'DB_ERROR');
  return (data || []).map((t: any) => dbTaskToUITask(t as any));
  },

  // ========== DOCUMENT VERSION METHODS ==========
  async getDocumentVersionHistory(projectId: string, fieldName: string = 'docs'): Promise<any[]> {
    const { data, error } = await supabase
      .from('archon_document_versions')
      .select('version_number, created_at, created_by, change_summary, change_type, document_id')
      .eq('project_id', projectId)
      .eq('field_name', fieldName)
      .order('version_number', { ascending: false });
    if (error) throw new ProjectServiceError(error.message, 'DB_ERROR');
    return data || [];
  },
  async getVersionContent(projectId: string, versionNumber: number, fieldName: string = 'docs'): Promise<any> {
    const { data, error } = await supabase
      .from('archon_document_versions')
      .select('content')
      .eq('project_id', projectId)
      .eq('field_name', fieldName)
      .eq('version_number', versionNumber)
      .single();
    if (error || !data) throw new ProjectServiceError(error?.message || 'Version not found', 'NOT_FOUND');
    return data.content;
  },
  async restoreDocumentVersion(projectId: string, versionNumber: number, fieldName: string = 'docs'): Promise<any> {
    // Get version content
    const content = await this.getVersionContent(projectId, versionNumber, fieldName);
    // Update project field with this content
    const { error } = await supabase
      .from('archon_projects')
      .update({ [fieldName]: content })
      .eq('id', projectId);
    if (error) throw new ProjectServiceError(error.message, 'DB_ERROR');
    // Create new version entry marking restore
    const { error: verErr } = await supabase.from('archon_document_versions').insert({
      project_id: projectId,
      field_name: fieldName,
      version_number: versionNumber + 1, // simplistic increment
      content,
      change_type: 'restore',
      change_summary: `Restored ${fieldName} to version ${versionNumber}`
    });
    if (verErr) console.warn('Failed to record restore version:', verErr.message);
    return content;
  },

  // ========== REAL-TIME SUBSCRIPTIONS ==========
  subscribeToProjectUpdates(projectId: string, callback: (event: ProjectManagementEvent) => void): () => void {
    initializeWebSocket();
    projectUpdateSubscriptions.set(projectId, callback);
    return () => projectUpdateSubscriptions.delete(projectId);
  },
  unsubscribeFromUpdates(): void { projectUpdateSubscriptions.clear(); websocketConnection?.close(); },
};

export default projectService;
