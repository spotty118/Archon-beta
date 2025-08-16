"""
RAG Module for Archon MCP Server (Enhanced HTTP Connection Pooling)

This module provides tools for:
- RAG query and search
- Source management
- Code example extraction and search

Enhanced Features:
- High-performance connection pooling for MCP service communication
- Circuit breaker pattern for improved reliability
- Optimized retry logic for different operation types
- Comprehensive performance monitoring and metrics
"""

import json
import logging
import os
from urllib.parse import urljoin

from mcp.server.fastmcp import Context, FastMCP

# Import enhanced MCP HTTP client and service discovery
from src.server.config.service_discovery import get_api_url
from src.server.services.mcp_http_client import get_mcp_http_client, MCPRequestType

logger = logging.getLogger(__name__)


def get_setting(key: str, default: str = "false") -> str:
    """Get a setting from environment variable."""
    return os.getenv(key, default)


def get_bool_setting(key: str, default: bool = False) -> bool:
    """Get a boolean setting from environment variable."""
    value = get_setting(key, "false" if not default else "true")
    return value.lower() in ("true", "1", "yes", "on")


def register_rag_tools(mcp: FastMCP):
    """Register all RAG tools with the MCP server."""

    @mcp.tool()
    async def get_available_sources(ctx: Context) -> str:
        """
        Get list of available sources in the knowledge base.

        Uses enhanced HTTP connection pooling for optimal performance.

        Returns:
            JSON string with list of sources
        """
        try:
            # Use enhanced MCP HTTP client with connection pooling
            http_client = get_mcp_http_client()
            
            result = await http_client.mcp_request(
                method="GET",
                service="api",
                endpoint="/api/rag/sources",
                request_type=MCPRequestType.RAG_QUERY
            )

            if result:
                sources = result.get("sources", [])
                return json.dumps(
                    {"success": True, "sources": sources, "count": len(sources)}, indent=2
                )
            else:
                return json.dumps(
                    {"success": False, "error": "Failed to fetch sources", "sources": []}, indent=2
                )

        except Exception as e:
            logger.error(f"Error getting sources: {e}")
            return json.dumps({"success": False, "error": str(e)}, indent=2)

    @mcp.tool()
    async def perform_rag_query(
        ctx: Context, query: str, source: str = None, match_count: int = 5
    ) -> str:
        """
        Perform a RAG (Retrieval Augmented Generation) query on stored content.

        Uses enhanced HTTP connection pooling for optimal performance and reliability.
        This tool searches the vector database for content relevant to the query and returns
        the matching documents. Optionally filter by source domain.

        Args:
            query: The search query
            source: Optional source domain to filter results (e.g., 'example.com')
            match_count: Maximum number of results to return (default: 5)

        Returns:
            JSON string with search results
        """
        try:
            # Use enhanced MCP HTTP client with connection pooling
            http_client = get_mcp_http_client()
            
            result = await http_client.rag_query(
                query=query,
                source_filter=source,
                match_count=match_count
            )

            if result:
                return json.dumps(
                    {
                        "success": True,
                        "results": result.get("results", []),
                        "reranked": result.get("reranked", False),
                        "error": None,
                    },
                    indent=2,
                )
            else:
                return json.dumps(
                    {
                        "success": False,
                        "results": [],
                        "error": {"code": "RAG_QUERY_FAILED", "message": "Failed to execute RAG query"},
                    },
                    indent=2,
                )

        except Exception as e:
            logger.error(f"Error performing RAG query: {e}")
            return json.dumps({"success": False, "results": [], "error": str(e)}, indent=2)

    @mcp.tool()
    async def search_code_examples(
        ctx: Context, query: str, source_id: str = None, match_count: int = 5
    ) -> str:
        """
        Search for code examples relevant to the query.

        This tool searches the vector database for code examples relevant to the query and returns
        the matching examples with their summaries. Optionally filter by source_id.
        Get the source_id by using the get_available_sources tool before calling this search!

        Use the get_available_sources tool first to see what sources are available for filtering.

        Args:
            query: The search query
            source_id: Optional source ID to filter results (e.g., 'example.com')
            match_count: Maximum number of results to return (default: 5)

        Returns:
            JSON string with search results
        """
        try:
            # Use enhanced MCP HTTP client with connection pooling
            http_client = get_mcp_http_client()
            
            request_data = {"query": query, "match_count": match_count}
            if source_id:
                request_data["source"] = source_id

            result = await http_client.mcp_request(
                method="POST",
                service="api",
                endpoint="/api/rag/code-examples",
                request_type=MCPRequestType.RAG_QUERY,
                json_data=request_data
            )

            if result:
                return json.dumps(
                    {
                        "success": True,
                        "results": result.get("results", []),
                        "reranked": result.get("reranked", False),
                        "error": None,
                    },
                    indent=2,
                )
            else:
                return json.dumps(
                    {
                        "success": False,
                        "results": [],
                        "error": {"code": "CODE_SEARCH_FAILED", "message": "Failed to search code examples"},
                    },
                    indent=2,
                )

        except Exception as e:
            logger.error(f"Error searching code examples: {e}")
            return json.dumps({"success": False, "results": [], "error": str(e)}, indent=2)

    # Log successful registration
    logger.info("✓ RAG tools registered (HTTP-based version)")
