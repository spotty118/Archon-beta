"""
Load Testing Data Seeder for Archon V2 Beta

Seeds the database with realistic test data for comprehensive load testing:
- 10K+ knowledge documents with embeddings
- 100+ projects with hierarchical tasks
- Realistic user scenarios and API endpoints
"""

import asyncio
import os
import random
import json
from typing import List, Dict, Any
from datetime import datetime, timedelta
from faker import Faker
import lorem

# Database connection
import asyncpg
from src.server.database.connection import get_database_connection


fake = Faker()

# Configuration from environment
SEED_DOCUMENTS = int(os.getenv("SEED_DOCUMENTS", "10000"))
SEED_PROJECTS = int(os.getenv("SEED_PROJECTS", "100"))
SEED_USERS = int(os.getenv("SEED_USERS", "50"))


class LoadTestDataSeeder:
    """Seeds realistic test data for load testing scenarios"""
    
    def __init__(self):
        self.db_pool = None
        
    async def connect(self):
        """Establish database connection"""
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise ValueError("DATABASE_URL environment variable required")
            
        self.db_pool = await asyncpg.create_pool(database_url, min_size=5, max_size=20)
        print(f"Connected to database for seeding")
    
    async def close(self):
        """Close database connection"""
        if self.db_pool:
            await self.db_pool.close()
    
    async def clear_existing_data(self):
        """Clear existing test data to ensure clean state"""
        print("Clearing existing test data...")
        
        async with self.db_pool.acquire() as conn:
            # Clear in dependency order
            await conn.execute("DELETE FROM code_examples WHERE source_id LIKE 'load-test-%'")
            await conn.execute("DELETE FROM documents WHERE source_id LIKE 'load-test-%'")
            await conn.execute("DELETE FROM sources WHERE id LIKE 'load-test-%'")
            await conn.execute("DELETE FROM tasks WHERE project_id LIKE 'load-test-%'")
            await conn.execute("DELETE FROM projects WHERE id LIKE 'load-test-%'")
            
        print("Existing test data cleared")
    
    async def seed_knowledge_sources(self) -> List[str]:
        """Seed knowledge sources with realistic metadata"""
        print(f"Seeding {SEED_DOCUMENTS} knowledge sources...")
        
        source_ids = []
        batch_size = 100
        
        for batch_start in range(0, SEED_DOCUMENTS, batch_size):
            batch_sources = []
            
            for i in range(batch_start, min(batch_start + batch_size, SEED_DOCUMENTS)):
                source_id = f"load-test-source-{i:06d}"
                
                # Generate realistic source types
                source_type = random.choice([
                    "documentation", "api_reference", "tutorial", 
                    "blog_post", "code_repository", "wiki"
                ])
                
                source_data = {
                    "id": source_id,
                    "url": f"https://example-docs.com/{fake.slug()}-{i}",
                    "title": fake.catch_phrase() + f" - Document {i}",
                    "description": fake.text(max_nb_chars=200),
                    "source_type": source_type,
                    "content_type": "text/html",
                    "last_crawled": datetime.now() - timedelta(days=random.randint(1, 30)),
                    "crawl_frequency": random.choice([1, 7, 14, 30]),
                    "status": "completed",
                    "metadata": json.dumps({
                        "author": fake.name(),
                        "tags": [fake.word() for _ in range(random.randint(2, 5))],
                        "difficulty": random.choice(["beginner", "intermediate", "advanced"]),
                        "estimated_read_time": random.randint(2, 15)
                    })
                }
                
                batch_sources.append(source_data)
                source_ids.append(source_id)
            
            # Insert batch
            async with self.db_pool.acquire() as conn:
                await conn.executemany("""
                    INSERT INTO sources (
                        id, url, title, description, source_type, content_type,
                        last_crawled, crawl_frequency, status, metadata, created_at, updated_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
                    )
                """, [
                    (s["id"], s["url"], s["title"], s["description"], s["source_type"],
                     s["content_type"], s["last_crawled"], s["crawl_frequency"], 
                     s["status"], s["metadata"]) for s in batch_sources
                ])
            
            print(f"Seeded sources batch {batch_start}-{min(batch_start + batch_size, SEED_DOCUMENTS)}")
        
        print(f"Knowledge sources seeding completed: {len(source_ids)} sources")
        return source_ids
    
    async def seed_documents(self, source_ids: List[str]):
        """Seed documents with realistic content and embeddings"""
        print(f"Seeding documents for {len(source_ids)} sources...")
        
        # Each source gets 1-5 document chunks
        total_documents = 0
        batch_size = 50
        current_batch = []
        
        for source_id in source_ids:
            num_chunks = random.randint(1, 5)
            
            for chunk_idx in range(num_chunks):
                document_id = f"load-test-doc-{total_documents:08d}"
                
                # Generate realistic content
                content_paragraphs = [lorem.paragraph() for _ in range(random.randint(2, 8))]
                content = "\n\n".join(content_paragraphs)
                
                # Generate realistic embedding (1536 dimensions for OpenAI)
                embedding = [random.gauss(0, 0.1) for _ in range(1536)]
                
                document_data = {
                    "id": document_id,
                    "source_id": source_id,
                    "title": fake.sentence(nb_words=6).rstrip('.'),
                    "content": content[:4000],  # Limit content size
                    "chunk_index": chunk_idx,
                    "embedding": embedding,
                    "token_count": len(content.split()),
                    "metadata": json.dumps({
                        "section": f"Section {chunk_idx + 1}",
                        "level": random.randint(1, 3),
                        "topics": [fake.word() for _ in range(random.randint(1, 3))]
                    })
                }
                
                current_batch.append(document_data)
                total_documents += 1
                
                # Insert when batch is full
                if len(current_batch) >= batch_size:
                    await self._insert_document_batch(current_batch)
                    current_batch = []
                    print(f"Seeded {total_documents} documents...")
        
        # Insert remaining documents
        if current_batch:
            await self._insert_document_batch(current_batch)
        
        print(f"Document seeding completed: {total_documents} documents")
    
    async def _insert_document_batch(self, documents: List[Dict[str, Any]]):
        """Insert a batch of documents efficiently"""
        async with self.db_pool.acquire() as conn:
            await conn.executemany("""
                INSERT INTO documents (
                    id, source_id, title, content, chunk_index, embedding,
                    token_count, metadata, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
                )
            """, [
                (d["id"], d["source_id"], d["title"], d["content"], d["chunk_index"],
                 d["embedding"], d["token_count"], d["metadata"]) for d in documents
            ])
    
    async def seed_projects(self) -> List[str]:
        """Seed realistic projects for testing"""
        print(f"Seeding {SEED_PROJECTS} projects...")
        
        project_ids = []
        batch_size = 20
        
        for batch_start in range(0, SEED_PROJECTS, batch_size):
            batch_projects = []
            
            for i in range(batch_start, min(batch_start + batch_size, SEED_PROJECTS)):
                project_id = f"load-test-project-{i:04d}"
                
                # Realistic project types
                project_types = [
                    "Web Application", "Mobile App", "API Service", 
                    "Data Pipeline", "Machine Learning", "DevOps"
                ]
                
                project_data = {
                    "id": project_id,
                    "title": f"{fake.company()} {random.choice(project_types)} - {i:04d}",
                    "description": fake.text(max_nb_chars=300),
                    "status": random.choice(["active", "planning", "on_hold", "completed"]),
                    "priority": random.choice(["low", "medium", "high", "critical"]),
                    "github_repo": f"https://github.com/{fake.user_name()}/{fake.slug()}",
                    "features": json.dumps([
                        f"Feature {j+1}: {fake.bs()}" for j in range(random.randint(3, 8))
                    ]),
                    "docs": json.dumps({
                        "requirements": fake.text(max_nb_chars=500),
                        "architecture": fake.text(max_nb_chars=400),
                        "deployment": fake.text(max_nb_chars=300)
                    }),
                    "prd": json.dumps({
                        "target_users": [fake.job() for _ in range(random.randint(2, 4))],
                        "success_metrics": [fake.sentence() for _ in range(random.randint(2, 5))],
                        "constraints": [fake.sentence() for _ in range(random.randint(1, 3))]
                    })
                }
                
                batch_projects.append(project_data)
                project_ids.append(project_id)
            
            # Insert batch
            async with self.db_pool.acquire() as conn:
                await conn.executemany("""
                    INSERT INTO projects (
                        id, title, description, status, priority, github_repo,
                        features, docs, prd, created_at, updated_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
                    )
                """, [
                    (p["id"], p["title"], p["description"], p["status"], p["priority"],
                     p["github_repo"], p["features"], p["docs"], p["prd"]) for p in batch_projects
                ])
            
            print(f"Seeded projects batch {batch_start}-{min(batch_start + batch_size, SEED_PROJECTS)}")
        
        print(f"Project seeding completed: {len(project_ids)} projects")
        return project_ids
    
    async def seed_tasks(self, project_ids: List[str]):
        """Seed realistic tasks for projects"""
        print("Seeding tasks for projects...")
        
        total_tasks = 0
        batch_size = 100
        current_batch = []
        
        # Task templates for realistic scenarios
        task_templates = [
            ("Setup Development Environment", "Initialize project structure, dependencies, and development tools"),
            ("Database Schema Design", "Design and implement database schema with proper indexing"),
            ("API Endpoint Implementation", "Implement RESTful API endpoints with proper validation"),
            ("Frontend Component Development", "Create reusable UI components with proper styling"),
            ("Authentication System", "Implement secure user authentication and authorization"),
            ("Testing Suite Implementation", "Create comprehensive test suite with good coverage"),
            ("Performance Optimization", "Optimize application performance and database queries"),
            ("Documentation Writing", "Write comprehensive documentation for users and developers"),
            ("Deployment Pipeline", "Set up CI/CD pipeline for automated deployment"),
            ("Security Audit", "Conduct security review and implement recommendations")
        ]
        
        for project_id in project_ids:
            # Each project gets 5-15 tasks
            num_tasks = random.randint(5, 15)
            
            for task_idx in range(num_tasks):
                task_id = f"load-test-task-{total_tasks:08d}"
                template = random.choice(task_templates)
                
                task_data = {
                    "id": task_id,
                    "project_id": project_id,
                    "title": f"{template[0]} - {task_idx + 1}",
                    "description": template[1] + f" (Task {task_idx + 1} for {project_id})",
                    "status": random.choice(["todo", "doing", "review", "done"]),
                    "priority": random.choice(["low", "medium", "high"]),
                    "assignee": f"load-test-user-{random.randint(1, SEED_USERS)}",
                    "task_order": task_idx + 1,
                    "estimated_hours": random.randint(2, 40),
                    "feature": random.choice([
                        "Authentication", "API", "Frontend", "Database", 
                        "Testing", "DevOps", "Documentation"
                    ]),
                    "sources": json.dumps([
                        {"url": fake.url(), "type": "documentation"},
                        {"url": fake.url(), "type": "reference"}
                    ]),
                    "code_examples": json.dumps([
                        {"file": f"src/{fake.file_name()}", "function": fake.word()},
                        {"file": f"tests/{fake.file_name()}", "function": f"test_{fake.word()}"}
                    ])
                }
                
                current_batch.append(task_data)
                total_tasks += 1
                
                # Insert when batch is full
                if len(current_batch) >= batch_size:
                    await self._insert_task_batch(current_batch)
                    current_batch = []
                    print(f"Seeded {total_tasks} tasks...")
        
        # Insert remaining tasks
        if current_batch:
            await self._insert_task_batch(current_batch)
        
        print(f"Task seeding completed: {total_tasks} tasks")
    
    async def _insert_task_batch(self, tasks: List[Dict[str, Any]]):
        """Insert a batch of tasks efficiently"""
        async with self.db_pool.acquire() as conn:
            await conn.executemany("""
                INSERT INTO tasks (
                    id, project_id, title, description, status, priority, assignee,
                    task_order, estimated_hours, feature, sources, code_examples,
                    created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
                )
            """, [
                (t["id"], t["project_id"], t["title"], t["description"], t["status"],
                 t["priority"], t["assignee"], t["task_order"], t["estimated_hours"],
                 t["feature"], t["sources"], t["code_examples"]) for t in tasks
            ])
    
    async def seed_code_examples(self):
        """Seed realistic code examples for search testing"""
        print("Seeding code examples...")
        
        # Code example templates
        code_templates = [
            {
                "title": "React Component Example",
                "language": "typescript",
                "code": """
export const ExampleComponent = ({ title, onAction }: Props) => {
  const [loading, setLoading] = useState(false);
  
  const handleClick = async () => {
    setLoading(true);
    try {
      await onAction();
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="component">
      <h2>{title}</h2>
      <button onClick={handleClick} disabled={loading}>
        {loading ? 'Loading...' : 'Action'}
      </button>
    </div>
  );
};
""",
                "description": "React component with async action handling"
            },
            {
                "title": "Python API Endpoint",
                "language": "python",
                "code": """
@app.post("/api/data")
async def create_data(data: DataModel, current_user: User = Depends(get_current_user)):
    try:
        # Validate input
        validated_data = await validate_data(data)
        
        # Save to database
        result = await db_service.create(validated_data)
        
        return {"success": True, "data": result}
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create data: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
""",
                "description": "FastAPI endpoint with error handling"
            }
        ]
        
        code_examples = []
        for i in range(200):  # 200 code examples
            template = random.choice(code_templates)
            source_id = f"load-test-source-{random.randint(0, SEED_DOCUMENTS-1):06d}"
            
            code_example = {
                "id": f"load-test-code-{i:06d}",
                "source_id": source_id,
                "title": f"{template['title']} {i+1}",
                "code": template["code"],
                "language": template["language"],
                "description": template["description"],
                "metadata": json.dumps({
                    "framework": random.choice(["React", "FastAPI", "Express", "Django"]),
                    "complexity": random.choice(["beginner", "intermediate", "advanced"])
                })
            }
            code_examples.append(code_example)
        
        # Insert code examples
        async with self.db_pool.acquire() as conn:
            await conn.executemany("""
                INSERT INTO code_examples (
                    id, source_id, title, code, language, description, metadata,
                    created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
                )
            """, [
                (c["id"], c["source_id"], c["title"], c["code"], c["language"],
                 c["description"], c["metadata"]) for c in code_examples
            ])
        
        print(f"Code example seeding completed: {len(code_examples)} examples")
    
    async def verify_seeded_data(self):
        """Verify that data was seeded correctly"""
        print("Verifying seeded data...")
        
        async with self.db_pool.acquire() as conn:
            # Count records
            source_count = await conn.fetchval("SELECT COUNT(*) FROM sources WHERE id LIKE 'load-test-%'")
            doc_count = await conn.fetchval("SELECT COUNT(*) FROM documents WHERE source_id LIKE 'load-test-%'")
            project_count = await conn.fetchval("SELECT COUNT(*) FROM projects WHERE id LIKE 'load-test-%'")
            task_count = await conn.fetchval("SELECT COUNT(*) FROM tasks WHERE project_id LIKE 'load-test-%'")
            code_count = await conn.fetchval("SELECT COUNT(*) FROM code_examples WHERE id LIKE 'load-test-%'")
            
            print(f"""
Data Seeding Verification:
- Sources: {source_count:,}
- Documents: {doc_count:,}
- Projects: {project_count:,}
- Tasks: {task_count:,}
- Code Examples: {code_count:,}
""")
        
        print("✅ Load testing data seeding completed successfully!")


async def main():
    """Main seeding execution"""
    seeder = LoadTestDataSeeder()
    
    try:
        print("🚀 Starting load testing data seeding...")
        print(f"Target: {SEED_DOCUMENTS} documents, {SEED_PROJECTS} projects")
        
        await seeder.connect()
        await seeder.clear_existing_data()
        
        # Seed in dependency order
        source_ids = await seeder.seed_knowledge_sources()
        await seeder.seed_documents(source_ids)
        project_ids = await seeder.seed_projects()
        await seeder.seed_tasks(project_ids)
        await seeder.seed_code_examples()
        
        await seeder.verify_seeded_data()
        
    except Exception as e:
        print(f"❌ Seeding failed: {e}")
        raise
    finally:
        await seeder.close()


if __name__ == "__main__":
    asyncio.run(main())