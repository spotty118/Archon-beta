// TypeScript types for Project Management system
// Based on database schema in migration/archon_tasks.sql

// Database status enum mapping
export type DatabaseTaskStatus = 'todo' | 'doing' | 'review' | 'done';

// UI status enum (used in current TasksTab)
export type UITaskStatus = 'backlog' | 'in-progress' | 'review' | 'complete';

// Priority levels
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

// Assignee type - simplified to predefined options
export type Assignee = 'User' | 'Archon' | 'AI IDE Agent';

// Document content structure for PRP documents
export interface DocumentContent {
  title?: string;
  version?: string;
  author?: string;
  date?: string;
  status?: string;
  document_type?: string;
  goal?: string;
  why?: string[];
  what?: {
    description?: string;
    success_criteria?: string[];
    user_stories?: string[];
  };
  context?: {
    documentation?: Array<{
      source: string;
      why: string;
    }>;
    existing_code?: Array<{
      file: string;
      purpose: string;
    }>;
    gotchas?: string[];
    dependencies?: string[];
    current_state?: string;
    environment_variables?: string[];
  };
  implementation_blueprint?: Record<string, {
    description?: string;
    tasks?: Array<{
      title: string;
      files?: string[];
      details?: string;
    }>;
  }>;
  validation?: Record<string, string[]>;
  additional_context?: Record<string, string[] | Record<string, string[]>>;
}

// Feature structure
export interface ProjectFeature {
  id: string;
  name: string;
  description?: string;
  status?: 'planned' | 'in-progress' | 'completed' | 'cancelled';
  priority?: TaskPriority;
  created_at?: string;
  updated_at?: string;
}

// Data structure for project data field
export interface ProjectData {
  nodes?: Array<{
    id: string;
    label: string;
    type?: string;
    position?: { x: number; y: number };
    data?: Record<string, unknown>;
  }>;
  edges?: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
    type?: string;
  }>;
  metadata?: Record<string, unknown>;
}

// Source reference structure
export interface SourceReference {
  source_id: string;
  title?: string;
  url?: string;
  type?: 'technical' | 'business';
  relevance?: string;
}

// Code example structure
export interface CodeExample {
  id?: string;
  file?: string;
  function?: string;
  class?: string;
  purpose?: string;
  language?: string;
  content?: string;
  line_start?: number;
  line_end?: number;
}

// Base Project interface (matches database schema)
export interface Project {
  id: string;
  title: string;
  prd?: Record<string, unknown>; // JSONB field
  docs?: DocumentContent[]; // JSONB field
  features?: ProjectFeature[]; // JSONB field  
  data?: ProjectData[]; // JSONB field
  github_repo?: string;
  created_at: string;
  updated_at: string;
  technical_sources?: string[]; // Array of source IDs from archon_project_sources table
  business_sources?: string[]; // Array of source IDs from archon_project_sources table
  
  // Extended UI properties (stored in JSONB fields)
  description?: string;
  progress?: number;
  updated?: string; // Human-readable format
  pinned: boolean; // Database column - indicates if project is pinned for priority
  
  // Creation progress tracking for inline display
  creationProgress?: {
    progressId: string;
    status: 'starting' | 'initializing_agents' | 'generating_docs' | 'processing_requirements' | 'ai_generation' | 'finalizing_docs' | 'saving_to_database' | 'completed' | 'error';
    percentage: number;
    logs: string[];
    error?: string;
    step?: string;
    currentStep?: string;
    eta?: string;
    duration?: string;
    project?: Project; // The created project when completed
  };
}

// Base Task interface (matches database schema)
export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: DatabaseTaskStatus;
  assignee: Assignee; // Now a database column with enum constraint
  task_order: number; // New database column for priority ordering
  feature?: string; // New database column for feature name
  sources?: SourceReference[]; // JSONB field
  code_examples?: CodeExample[]; // JSONB field
  created_at: string;
  updated_at: string;
  
  // Soft delete fields
  archived?: boolean; // Soft delete flag
  archived_at?: string; // Timestamp when archived
  archived_by?: string; // User/system that archived the task
  
  // Extended UI properties (can be stored in sources JSONB)
  featureColor?: string;
  priority?: TaskPriority;
  
  // UI-specific computed properties
  uiStatus?: UITaskStatus; // Computed from database status
}

// Create project request
export interface CreateProjectRequest {
  title: string;
  description?: string;
  github_repo?: string;
  pinned?: boolean;
  // Note: PRD data should be stored as a document in the docs array with document_type="prd"
  // not as a direct 'prd' field since this column doesn't exist in the database
  docs?: DocumentContent[];
  features?: ProjectFeature[];
  data?: ProjectData[];
  technical_sources?: string[];
  business_sources?: string[];
}

// Update project request
export interface UpdateProjectRequest {
  title?: string;
  description?: string;
  github_repo?: string;
  prd?: Record<string, unknown>;
  docs?: DocumentContent[];
  features?: ProjectFeature[];
  data?: ProjectData[];
  technical_sources?: string[];
  business_sources?: string[];
  pinned?: boolean;
}

// Create task request
export interface CreateTaskRequest {
  project_id: string;
  title: string;
  description: string;
  status?: DatabaseTaskStatus;
  assignee?: Assignee;
  task_order?: number;
  feature?: string;
  featureColor?: string;
  priority?: TaskPriority;
  sources?: SourceReference[];
  code_examples?: CodeExample[];
}

// Update task request
export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: DatabaseTaskStatus;
  assignee?: Assignee;
  task_order?: number;
  feature?: string;
  featureColor?: string;
  priority?: TaskPriority;
  sources?: SourceReference[];
  code_examples?: CodeExample[];
}

// MCP tool response types
export interface MCPToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// WebSocket event types for real-time updates
export interface ProjectUpdateEvent {
  type: 'PROJECT_UPDATED' | 'PROJECT_CREATED' | 'PROJECT_DELETED';
  projectId: string;
  userId: string;
  timestamp: string;
  data: Partial<Project>;
}

export interface TaskUpdateEvent {
  type: 'TASK_MOVED' | 'TASK_CREATED' | 'TASK_UPDATED' | 'TASK_DELETED' | 'TASK_ARCHIVED';
  taskId: string;
  projectId: string;
  userId: string;
  timestamp: string;
  data: Partial<Task>;
}

export type ProjectManagementEvent = ProjectUpdateEvent | TaskUpdateEvent;

// Utility type for paginated responses
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Status mapping utilities
export const statusMappings = {
  // Database to UI status mapping
  dbToUI: {
    'todo': 'backlog',
    'doing': 'in-progress', 
    'review': 'review', // Map database 'review' to UI 'review'
    'done': 'complete'
  } as const,
  
  // UI to Database status mapping
  uiToDB: {
    'backlog': 'todo',
    'in-progress': 'doing',
    'review': 'review', // Map UI 'review' to database 'review'
    'complete': 'done'
  } as const
} as const;

// Helper function to convert database task to UI task
export function dbTaskToUITask(dbTask: Task): Task {
  return {
    ...dbTask,
    uiStatus: statusMappings.dbToUI[dbTask.status]
  };
}

// Helper function to convert UI status to database status  
export function uiStatusToDBStatus(uiStatus: UITaskStatus): DatabaseTaskStatus {
  return statusMappings.uiToDB[uiStatus];
} 