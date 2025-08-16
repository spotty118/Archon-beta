/**
 * Socket.IO event types and interfaces for Archon
 * Replaces generic 'any' types with proper interfaces
 */

import { Task, Project } from './project';

// Base socket message interface
export interface SocketMessage<T = unknown> {
  type: string;
  data?: T;
  timestamp: string;
  requestId?: string;
  [key: string]: unknown;
}

// Progress tracking interfaces
export interface ProgressData {
  progressId: string;
  status: string;
  percentage: number;
  log?: string;
  error?: string;
  step?: string;
  currentStep?: string;
  eta?: string;
  duration?: string;
  [key: string]: unknown;
}

export interface CrawlProgressData extends ProgressData {
  url?: string;
  urls_processed?: number;
  total_urls?: number;
  chunks_created?: number;
  crawl_type?: string;
}

export interface ProjectCreationProgressData extends ProgressData {
  project?: Project;
  stage?: 'starting' | 'initializing_agents' | 'generating_docs' | 'processing_requirements' | 'ai_generation' | 'finalizing_docs' | 'saving_to_database' | 'completed' | 'error';
}

// Task event interfaces
export interface TaskEventData {
  task: Task;
  projectId: string;
  action: 'created' | 'updated' | 'deleted' | 'archived' | 'moved';
  timestamp: string;
}

export interface TasksReorderedData {
  projectId: string;
  tasks: Task[];
  reorderType: 'status' | 'priority' | 'feature';
  timestamp: string;
}

// Project event interfaces
export interface ProjectEventData {
  project: Project;
  action: 'created' | 'updated' | 'deleted';
  timestamp: string;
}

// Knowledge update interfaces
export interface KnowledgeUpdateData {
  type: 'document_added' | 'document_updated' | 'source_crawled' | 'embedding_created';
  source_id?: string;
  document_id?: string;
  chunks_added?: number;
  timestamp: string;
}

// MCP related interfaces
export interface MCPToolResult {
  success: boolean;
  content?: Array<{
    type: 'text' | 'json' | 'error';
    text?: string;
    data?: Record<string, unknown>;
  }>;
  error?: string;
  metadata?: Record<string, unknown>;
}

// Error interfaces
export interface SocketErrorData {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
  timestamp: string;
  operation?: string;
}

// State change interfaces
export interface StateChangeData {
  component: string;
  state: Record<string, unknown>;
  previous_state?: Record<string, unknown>;
  timestamp: string;
}

// Connection interfaces
export interface ConnectionData {
  userId?: string;
  sessionId?: string;
  clientInfo?: {
    userAgent: string;
    ip?: string;
    timestamp: string;
  };
}

// Socket event handlers type definitions
export interface SocketEventHandlers {
  // Progress events
  crawl_progress: (data: CrawlProgressData) => void;
  project_creation_progress: (data: ProjectCreationProgressData) => void;
  
  // Task events
  task_created: (data: TaskEventData) => void;
  task_updated: (data: TaskEventData) => void;
  task_deleted: (data: TaskEventData) => void;
  task_archived: (data: TaskEventData) => void;
  tasks_reordered: (data: TasksReorderedData) => void;
  initial_tasks: (data: { tasks: Task[]; projectId: string }) => void;
  
  // Project events
  project_created: (data: ProjectEventData) => void;
  project_updated: (data: ProjectEventData) => void;
  project_deleted: (data: ProjectEventData) => void;
  
  // Knowledge events
  knowledge_update: (data: KnowledgeUpdateData) => void;
  
  // Error events
  error: (data: SocketErrorData) => void;
  
  // Connection events
  connect: () => void;
  disconnect: (reason: string) => void;
  connect_error: (error: Error) => void;
  
  // Generic event handler for any untyped events
  [eventName: string]: (...args: unknown[]) => void;
}

// WebSocket connection state
export interface WebSocketState {
  connected: boolean;
  reconnecting: boolean;
  error?: string;
  lastConnected?: string;
  connectionAttempts: number;
  latency?: number;
}

// Mock WebSocket interface for testing
export interface MockWebSocket {
  send: (data: unknown) => boolean;
  close: () => void;
  readyState: number;
  onopen?: (event: Event) => void;
  onmessage?: (event: MessageEvent) => void;
  onclose?: (event: CloseEvent) => void;
  onerror?: (event: Event) => void;
}

// Acknowledgment callback type
export type AckCallback = (response?: unknown) => void;

// Event emission data
export interface EmitData<T = unknown> {
  event: string;
  data: T;
  ack?: AckCallback;
  timeout?: number;
}