-- Beta Performance Optimization: Database Indexes
-- Optimizes query performance for frequently accessed tables and columns
-- Target: <100ms query times for 90th percentile

-- ==============================================================================
-- DOCUMENTS TABLE OPTIMIZATION
-- ==============================================================================

-- Index for document lookup by source_id (most common query pattern)
-- Improves performance for source-based document retrieval
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_source_id 
    ON documents(source_id);

-- Index for document creation/update time ordering
-- Improves performance for chronological document queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_created_at 
    ON documents(created_at DESC);

-- Composite index for source-based queries with pagination
-- Optimizes queries that filter by source and order by creation time
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_source_created 
    ON documents(source_id, created_at DESC);

-- Index for document content length (for chunk optimization)
-- Helps identify and optimize large documents
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_content_length 
    ON documents(length(content));

-- Partial index for published documents only
-- Optimizes queries for active/published content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_published 
    ON documents(source_id, created_at DESC) 
    WHERE metadata->>'status' != 'draft';

-- ==============================================================================
-- SOURCES TABLE OPTIMIZATION  
-- ==============================================================================

-- Index for source lookup by creation time (dashboard queries)
-- Improves performance for recent sources retrieval
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sources_created_at 
    ON sources(created_at DESC);

-- Index for source lookup by URL (duplicate detection)
-- Improves performance for URL-based source validation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sources_url 
    ON sources(url);

-- Index for source metadata queries (type, status filtering)
-- Optimizes filtering by source type and processing status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sources_metadata_gin 
    ON sources USING gin(metadata);

-- Composite index for active sources
-- Optimizes queries for sources that are actively being processed
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sources_active 
    ON sources(created_at DESC, updated_at DESC) 
    WHERE metadata->>'status' IN ('processing', 'completed');

-- ==============================================================================
-- CODE_EXAMPLES TABLE OPTIMIZATION
-- ==============================================================================

-- Index for code examples by source_id and language
-- Improves performance for language-specific code search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_code_examples_source_lang 
    ON code_examples(source_id, language);

-- Index for code examples by function/class name
-- Optimizes code example search by identifier
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_code_examples_identifiers 
    ON code_examples(function_name, class_name);

-- GIN index for code content search
-- Enables full-text search within code examples
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_code_examples_content_gin 
    ON code_examples USING gin(to_tsvector('english', content));

-- ==============================================================================
-- VECTOR SIMILARITY SEARCH OPTIMIZATION
-- ==============================================================================

-- Specialized index for vector similarity search (if using pgvector)
-- Optimizes embedding-based document retrieval
-- Note: This assumes embedding column exists and uses vector type
DO $$
BEGIN
    -- Check if embedding column exists before creating index
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'embedding'
    ) THEN
        -- Create IVFFlat index for approximate nearest neighbor search
        -- Adjust lists parameter based on data size (sqrt(rows) is a good starting point)
        EXECUTE 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_embedding_ivfflat 
                 ON documents USING ivfflat (embedding vector_cosine_ops) 
                 WITH (lists = 100)';
        
        -- Create HNSW index for high-dimensional vector search (if available)
        -- This provides better performance for high-dimensional embeddings
        BEGIN
            EXECUTE 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_embedding_hnsw 
                     ON documents USING hnsw (embedding vector_cosine_ops) 
                     WITH (m = 16, ef_construction = 64)';
        EXCEPTION WHEN OTHERS THEN
            -- HNSW might not be available in all pgvector versions
            RAISE NOTICE 'HNSW index creation failed, falling back to IVFFlat only';
        END;
    END IF;
END $$;

-- ==============================================================================
-- PROJECT MANAGEMENT OPTIMIZATION (if enabled)
-- ==============================================================================

-- Index for project tasks by status and priority
-- Optimizes task management queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_archon_tasks_status_priority 
    ON archon_tasks(status, task_order DESC) 
    WHERE archived = false;

-- Index for project tasks by feature grouping
-- Optimizes feature-based task filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_archon_tasks_feature 
    ON archon_tasks(project_id, feature, task_order DESC) 
    WHERE archived = false;

-- Index for project tasks by assignee
-- Optimizes assignee-based task queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_archon_tasks_assignee 
    ON archon_tasks(assignee, status, updated_at DESC) 
    WHERE archived = false;

-- Composite index for project task management
-- Optimizes complex project management queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_archon_tasks_project_mgmt 
    ON archon_tasks(project_id, status, task_order DESC, updated_at DESC) 
    WHERE archived = false;

-- ==============================================================================
-- ARCHON PROJECT OPTIMIZATION
-- ==============================================================================

-- Index for project lookup by creation and update time
-- Optimizes project dashboard queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_archon_projects_timeline 
    ON archon_projects(created_at DESC, updated_at DESC);

-- Index for pinned projects (high priority access)
-- Optimizes pinned project retrieval
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_archon_projects_pinned 
    ON archon_projects(pinned, updated_at DESC) 
    WHERE pinned = true;

-- GIN index for project document search
-- Enables full-text search within project documents
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_archon_projects_docs_gin 
    ON archon_projects USING gin(docs);

-- ==============================================================================
-- QUERY PERFORMANCE MONITORING
-- ==============================================================================

-- Enable query performance tracking (requires pg_stat_statements extension)
-- This helps monitor the effectiveness of our indexes
DO $$
BEGIN
    -- Check if pg_stat_statements is available
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_stat_statements') THEN
        CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
        
        -- Reset statistics to get fresh baseline after index creation
        SELECT pg_stat_statements_reset();
        
        RAISE NOTICE 'pg_stat_statements enabled for query performance monitoring';
    ELSE
        RAISE NOTICE 'pg_stat_statements not available - manual query monitoring recommended';
    END IF;
END $$;

-- ==============================================================================
-- MAINTENANCE AND CLEANUP
-- ==============================================================================

-- Update table statistics after index creation
-- This ensures the query planner has accurate information
ANALYZE documents;
ANALYZE sources;
ANALYZE code_examples;
ANALYZE archon_tasks;
ANALYZE archon_projects;

-- ==============================================================================
-- PERFORMANCE VALIDATION QUERIES
-- ==============================================================================

-- Query performance validation - these should all execute in <100ms
-- Run these after index creation to verify performance improvements

-- Test 1: Recent documents by source (should use idx_documents_source_created)
-- EXPLAIN (ANALYZE, BUFFERS) 
-- SELECT * FROM documents WHERE source_id = 'some-uuid' ORDER BY created_at DESC LIMIT 20;

-- Test 2: Vector similarity search (should use embedding index)
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT * FROM documents ORDER BY embedding <-> '[0.1,0.2,...]' LIMIT 10;

-- Test 3: Recent sources with metadata filtering (should use idx_sources_metadata_gin)
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT * FROM sources WHERE metadata->>'status' = 'completed' ORDER BY created_at DESC LIMIT 10;

-- Test 4: Project tasks by status (should use idx_archon_tasks_status_priority)
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT * FROM archon_tasks WHERE status = 'todo' AND archived = false ORDER BY task_order DESC;

-- ==============================================================================
-- BACKUP RECOMMENDATIONS
-- ==============================================================================

-- IMPORTANT: Before running in production:
-- 1. Take a full database backup
-- 2. Test on a copy of production data first
-- 3. Monitor query performance before and after
-- 4. Consider running during low-traffic periods
-- 5. Use CONCURRENTLY option to avoid blocking writes

-- Monitor index creation progress:
-- SELECT * FROM pg_stat_progress_create_index;

-- Check index usage after deployment:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch 
-- FROM pg_stat_user_indexes 
-- ORDER BY idx_scan DESC;

-- ==============================================================================
-- ROLLBACK PLAN (if needed)
-- ==============================================================================

-- If indexes cause issues, they can be dropped with:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_documents_source_id;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_documents_created_at;
-- (repeat for all created indexes)

-- ==============================================================================
-- EXPECTED PERFORMANCE IMPROVEMENTS
-- ==============================================================================

-- Before optimization (typical queries):
-- - Document retrieval by source: 200-500ms
-- - Vector similarity search: 1-3 seconds  
-- - Source listing with filters: 300-800ms
-- - Project task queries: 100-300ms

-- After optimization (target performance):
-- - Document retrieval by source: <50ms
-- - Vector similarity search: <200ms
-- - Source listing with filters: <100ms
-- - Project task queries: <50ms

-- Overall target: 90th percentile query time <100ms