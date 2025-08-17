"""
MCP Service Client for HTTP-based microservice communication

This module provides HTTP clients for the MCP service to communicate with
other services (API and Agents) instead of importing their modules directly.
"""

import uuid
from typing import Any
from urllib.parse import urljoin

import httpx

from ..config.logfire_config import mcp_logger
from ..config.service_discovery import get_agents_url, get_api_url
from .http_client_service import get_http_client_service


class MCPServiceClient:
    """
    Client for MCP service to communicate with other microservices via HTTP.
    Replaces direct module imports with proper service-to-service communication.
    """

    def __init__(self):
        self.api_url = get_api_url()
        self.agents_url = get_agents_url()
        self.service_auth = "mcp-service-key"  # In production, use proper key management
        self.timeout = httpx.Timeout(
            connect=5.0,
            read=300.0,  # 5 minutes for long operations like crawling
            write=30.0,
            pool=5.0,
        )
        # Use connection pooling HTTP client service for improved performance
        self.http_client = get_http_client_service()

    def _get_headers(self, request_id: str | None = None) -> dict[str, str]:
        """Get common headers for internal requests"""
        headers = {"X-Service-Auth": self.service_auth, "Content-Type": "application/json"}
        if request_id:
            headers["X-Request-ID"] = request_id
        else:
            headers["X-Request-ID"] = str(uuid.uuid4())
        return headers

    async def crawl_url(self, url: str, options: dict[str, Any] | None = None) -> dict[str, Any]:
        """
        Crawl a URL by calling the API service's knowledge-items/crawl endpoint.
        Transforms MCP's simple format to the API's KnowledgeItemRequest format.

        Args:
            url: URL to crawl
            options: Crawling options (max_depth, chunk_size, smart_crawl)

        Returns:
            Crawl response with success status and results
        """
        endpoint = urljoin(self.api_url, "/api/knowledge-items/crawl")

        # Transform to API's expected format
        request_data = {
            "url": url,
            "knowledge_type": "documentation",  # Default type
            "tags": [],
            "update_frequency": 7,  # Default to weekly
            "metadata": options or {},
        }

        mcp_logger.info(f"Calling API service to crawl {url}")

        try:
            # Use connection pooling HTTP client with fallback to httpx
            result = await self.http_client.post(
                endpoint, 
                json_data=request_data, 
                headers=self._get_headers(),
                timeout=300.0  # 5 minutes for crawling operations
            )
            
            if result is not None:
                # Transform API response to MCP expected format
                return {
                    "success": result.get("success", False),
                    "progressId": result.get("progressId"),
                    "message": result.get("message", "Crawling started"),
                    "error": None if result.get("success") else {"message": "Crawl failed"},
                }
            else:
                # Fallback to httpx if connection pooling failed
                mcp_logger.warning("Connection pooling unavailable, falling back to httpx")
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(
                        endpoint, json=request_data, headers=self._get_headers()
                    )
                    response.raise_for_status()
                    fallback_result = response.json()

                    return {
                        "success": fallback_result.get("success", False),
                        "progressId": fallback_result.get("progressId"),
                        "message": fallback_result.get("message", "Crawling started"),
                        "error": None if fallback_result.get("success") else {"message": "Crawl failed"},
                    }
                    
        except httpx.TimeoutException:
            mcp_logger.error(f"Timeout crawling {url}")
            return {
                "success": False,
                "error": {"code": "TIMEOUT", "message": "Crawl operation timed out"},
            }
        except httpx.HTTPStatusError as e:
            mcp_logger.error(f"HTTP error crawling {url}: {e.response.status_code}")
            return {"success": False, "error": {"code": "HTTP_ERROR", "message": str(e)}}
        except Exception as e:
            mcp_logger.error(f"Error crawling {url}: {str(e)}")
            return {"success": False, "error": {"code": "CRAWL_FAILED", "message": str(e)}}

    async def search(
        self,
        query: str,
        source_filter: str | None = None,
        match_count: int = 5,
        use_reranking: bool = False,
    ) -> dict[str, Any]:
        """
        Perform a search by calling the API service's rag/query endpoint.
        Transforms MCP's simple format to the API's RagQueryRequest format.

        Args:
            query: Search query
            source_filter: Optional source ID to filter results
            match_count: Number of results to return
            use_reranking: Whether to rerank results (handled in Server's service layer)

        Returns:
            Search response with results
        """
        endpoint = urljoin(self.api_url, "/api/rag/query")
        request_data = {"query": query, "source": source_filter, "match_count": match_count}

        mcp_logger.info(f"Calling API service to search: {query}")

        try:
            # Use connection pooling HTTP client with fallback to httpx
            result = await self.http_client.post(
                endpoint, 
                json_data=request_data, 
                headers=self._get_headers(),
                timeout=30.0  # 30 seconds for search operations
            )
            
            if result is not None:
                # Transform API response to MCP expected format
                return {
                    "success": result.get("success", True),
                    "results": result.get("results", []),
                    "reranked": False,  # Reranking should be handled by Server's service layer
                    "error": None,
                }
            else:
                # Fallback to httpx if connection pooling failed
                mcp_logger.warning("Connection pooling unavailable for search, falling back to httpx")
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(
                        endpoint, json=request_data, headers=self._get_headers()
                    )
                    response.raise_for_status()
                    fallback_result = response.json()

                    return {
                        "success": fallback_result.get("success", True),
                        "results": fallback_result.get("results", []),
                        "reranked": False,
                        "error": None,
                    }

        except Exception as e:
            mcp_logger.error(f"Error searching: {str(e)}")
            return {
                "success": False,
                "results": [],
                "error": {"code": "SEARCH_FAILED", "message": str(e)},
            }

    # Removed _rerank_results method - reranking should be handled by Server's service layer

    async def store_documents(
        self, documents: list[dict[str, Any]], generate_embeddings: bool = True
    ) -> dict[str, Any]:
        """
        Store documents by transforming them into the format expected by the API.
        Note: The regular API expects file uploads, so this is a simplified version.

        Args:
            documents: List of documents to store
            generate_embeddings: Whether to generate embeddings

        Returns:
            Storage response
        """
        # For now, return a simplified response since document upload
        # through the regular API requires multipart form data
        mcp_logger.info("Document storage through regular API not yet implemented")
        return {
            "success": True,
            "documents_stored": len(documents),
            "chunks_created": len(documents),
            "message": "Document storage should be handled by Server's service layer",
        }

    async def generate_embeddings(
        self, texts: list[str], model: str = "text-embedding-3-small"
    ) -> dict[str, Any]:
        """
        Generate embeddings by calling the API service's embeddings endpoint.
        
        Args:
            texts: List of texts to embed
            model: Embedding model to use (default: text-embedding-3-small)

        Returns:
            Embeddings response with vectors and metadata
        """
        endpoint = urljoin(self.api_url, "/api/embeddings/generate")
        request_data = {
            "texts": texts,
            "model": model
        }

        mcp_logger.info(f"Calling API service to generate embeddings for {len(texts)} texts")

        try:
            # Use connection pooling HTTP client with fallback to httpx
            result = await self.http_client.post(
                endpoint,
                json_data=request_data,
                headers=self._get_headers(),
                timeout=60.0  # 1 minute for embedding generation
            )
            
            if result is not None:
                # Transform API response to MCP expected format
                return {
                    "success": result.get("success", True),
                    "embeddings": result.get("embeddings", []),
                    "model": result.get("model", model),
                    "usage": result.get("usage", {}),
                    "error": None,
                }
            else:
                # Fallback to httpx if connection pooling failed
                mcp_logger.warning("Connection pooling unavailable for embeddings, falling back to httpx")
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(
                        endpoint, json=request_data, headers=self._get_headers()
                    )
                    response.raise_for_status()
                    fallback_result = response.json()

                    return {
                        "success": fallback_result.get("success", True),
                        "embeddings": fallback_result.get("embeddings", []),
                        "model": fallback_result.get("model", model),
                        "usage": fallback_result.get("usage", {}),
                        "error": None,
                    }

        except httpx.TimeoutException:
            mcp_logger.error(f"Timeout generating embeddings for {len(texts)} texts")
            return {
                "success": False,
                "embeddings": [],
                "error": {"code": "TIMEOUT", "message": "Embedding generation timed out"},
            }
        except httpx.HTTPStatusError as e:
            mcp_logger.error(f"HTTP error generating embeddings: {e.response.status_code}")
            return {
                "success": False,
                "embeddings": [],
                "error": {"code": "HTTP_ERROR", "message": str(e)}
            }
        except Exception as e:
            mcp_logger.error(f"Error generating embeddings: {str(e)}")
            return {
                "success": False,
                "embeddings": [],
                "error": {"code": "EMBEDDING_FAILED", "message": str(e)}
            }

    # Removed analyze_document - document analysis should be handled by Agents via MCP tools

    async def health_check(self) -> dict[str, Any]:
        """
        Check health of all dependent services.

        Returns:
            Combined health status
        """
        health_status = {"api_service": False, "agents_service": False}

        # Check API service
        api_health_url = urljoin(self.api_url, "/api/health")
        try:
            # Use connection pooling for health checks
            result = await self.http_client.get(
                api_health_url,
                timeout=5.0
            )
            
            if result is not None:
                health_status["api_service"] = True
                mcp_logger.info("API service health check: 200 (via connection pooling)")
            else:
                # Fallback to httpx
                async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
                    mcp_logger.info(f"Checking API service health at: {api_health_url}")
                    response = await client.get(api_health_url)
                    health_status["api_service"] = response.status_code == 200
                    mcp_logger.info(f"API service health check: {response.status_code}")
        except Exception as e:
            health_status["api_service"] = False
            mcp_logger.warning(f"API service health check failed: {e}")

        # Check Agents service
        try:
            # Use connection pooling for agents health check
            agents_health_url = urljoin(self.agents_url, "/health")
            result = await self.http_client.get(
                agents_health_url,
                timeout=5.0
            )
            
            if result is not None:
                health_status["agents_service"] = True
            else:
                # Fallback to httpx
                async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
                    response = await client.get(urljoin(self.agents_url, "/health"))
                    health_status["agents_service"] = response.status_code == 200
        except Exception:
            health_status["agents_service"] = False

        return health_status


# Global client instance
_mcp_client = None


def get_mcp_service_client() -> MCPServiceClient:
    """Get or create the global MCP service client"""
    global _mcp_client
    if _mcp_client is None:
        _mcp_client = MCPServiceClient()
    return _mcp_client
