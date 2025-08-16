/**
 * API service layer for communicating with the MCP server backend.
 */

// Types for API responses
export interface MCPServerResponse {
  success: boolean;
  status: 'starting' | 'running' | 'stopped' | 'error';
  message?: string;
}

export interface MCPServerStatus {
  status: 'starting' | 'running' | 'stopped' | 'error';
  uptime?: number;
  logs: string[];
}

export interface CrawlResponse {
  success: boolean;
  url: string;
  chunks_stored?: number;
  content_length?: number;
  crawl_type?: string;
  urls_processed?: number;
  total_chunks?: number;
  error?: string;
}

export interface CrawlOptions {
  max_depth?: number;
  max_concurrent?: number;
  chunk_size?: number;
}

export interface RAGQueryResponse {
  results: Array<{
    content: string;
    score: number;
    source?: string;
  }>;
  query: string;
}

export interface RAGQueryOptions {
  source?: string;
  match_count?: number;
}

export interface SourcesResponse {
  sources: string[];
}

export interface UploadResponse {
  success: boolean;
  filename: string;
  chunks_created?: number;
  error?: string;
}

export interface UploadOptions {
  tags?: string[];
  knowledge_type?: 'technical' | 'business';
}

export interface DatabaseMetrics {
  documents: number;
  storage_used: string;
  last_sync: string;
}

const API_BASE_URL = '/api';

// Retry wrapper for transient errors
export async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}

// Enhanced error interface for alpha mode debugging
interface EnhancedError extends Error {
  context?: {
    endpoint: string;
    method: string;
    status?: number;
    requestId?: string;
    timestamp: string;
    stack?: string;
  };
}

// Generic API request handler with enhanced error handling for alpha mode
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const requestId = Math.random().toString(36).substring(2, 15);
  const timestamp = new Date().toISOString();
  
  try {
    console.log(`[API Request ${requestId}] ${options.method || 'GET'} ${url} at ${timestamp}`);
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        ...options.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorDetails: any = {};
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || errorMessage;
        errorDetails = errorData;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      
      // Enhanced error for alpha mode with full context
      const enhancedError = new Error(errorMessage) as EnhancedError;
      enhancedError.context = {
        endpoint,
        method: options.method || 'GET',
        status: response.status,
        requestId,
        timestamp,
        stack: new Error().stack
      };
      
      // In alpha mode, log full error details to console for debugging
      console.error(`[API Error ${requestId}] Request failed:`, {
        url,
        method: options.method || 'GET',
        status: response.status,
        errorMessage,
        errorDetails,
        timestamp,
        requestHeaders: options.headers,
        responseHeaders: Object.fromEntries(response.headers.entries())
      });
      
      throw enhancedError;
    }
    
    const responseData = await response.json();
    console.log(`[API Success ${requestId}] Response received at ${new Date().toISOString()}`);
    return responseData;
    
  } catch (error) {
    if (error instanceof Error && 'context' in error) {
      // Already an enhanced error, re-throw it
      throw error;
    }
    
    // Create enhanced error for network/other errors
    const enhancedError = new Error(
      error instanceof Error ? error.message : 'Unknown network error occurred'
    ) as EnhancedError;
    
    enhancedError.context = {
      endpoint,
      method: options.method || 'GET',
      requestId,
      timestamp,
      stack: error instanceof Error ? error.stack : new Error().stack
    };
    
    // Log network errors with full context
    console.error(`[Network Error ${requestId}] Request failed:`, {
      url,
      method: options.method || 'GET',
      originalError: error,
      timestamp,
      stack: enhancedError.context.stack
    });
    
    throw enhancedError;
  }
}

// MCP Server Management
export async function startMCPServer(): Promise<MCPServerResponse> {
  return retry(() => apiRequest<MCPServerResponse>('/mcp/start', { method: 'POST' }));
}

export async function stopMCPServer(): Promise<MCPServerResponse> {
  return retry(() => apiRequest<MCPServerResponse>('/mcp/stop', { method: 'POST' }));
}

export async function getMCPServerStatus(): Promise<MCPServerStatus> {
  return retry(() => apiRequest<MCPServerStatus>('/mcp/status'));
}

// Crawling Operations
export async function crawlSinglePage(url: string): Promise<CrawlResponse> {
  return retry(() => apiRequest<CrawlResponse>('/crawl/single', {
    method: 'POST',
    body: JSON.stringify({ url }),
  }));
}

export async function smartCrawlUrl(url: string, options: CrawlOptions = {}): Promise<CrawlResponse> {
  return retry(() => apiRequest<CrawlResponse>('/crawl/smart', {
    method: 'POST',
    body: JSON.stringify({ url, ...options }),
  }));
}

// RAG Operations
export async function performRAGQuery(query: string, options: RAGQueryOptions = {}): Promise<RAGQueryResponse> {
  return retry(() => apiRequest<RAGQueryResponse>('/rag/query', {
    method: 'POST',
    body: JSON.stringify({ query, ...options }),
  }));
}

export async function getAvailableSources(): Promise<SourcesResponse> {
  return retry(() => apiRequest<SourcesResponse>('/rag/sources'));
}

// Document Upload
export async function uploadDocument(file: File, options: UploadOptions = {}): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (options.tags) {
    formData.append('tags', JSON.stringify(options.tags));
  }
  if (options.knowledge_type) {
    formData.append('knowledge_type', options.knowledge_type);
  }
  return retry(() => apiRequest<UploadResponse>('/documents/upload', {
    method: 'POST',
    body: formData,
    headers: {}, // Let browser set Content-Type for FormData
  }));
}

// Database Metrics
export async function getDatabaseMetrics(): Promise<DatabaseMetrics> {
  return retry(() => apiRequest<DatabaseMetrics>('/database/metrics'));
}
