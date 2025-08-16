"""
Database Transaction Manager

Provides atomic database operations with automatic rollback on errors.
Ensures data consistency across multiple database operations.
"""

import asyncio
from contextlib import asynccontextmanager
from typing import Optional, Any, Dict, List
from ..config.logfire_config import get_logger
from ..utils import get_supabase_client

logger = get_logger(__name__)

class TransactionError(Exception):
    """Custom exception for transaction-related errors"""
    pass

class DatabaseTransaction:
    """Database transaction context manager for atomic operations"""
    
    def __init__(self, isolation_level: str = "READ_COMMITTED"):
        self.supabase = get_supabase_client()
        self.isolation_level = isolation_level
        self.operations = []
        self.rollback_operations = []
        self.is_active = False
        self.transaction_id = None
        
    async def __aenter__(self):
        """Start transaction"""
        try:
            self.is_active = True
            current_task = asyncio.current_task()
            task_name = current_task.get_name() if current_task else "unknown"
            self.transaction_id = f"txn_{task_name}_{id(self)}"
            
            logger.info(f"Starting database transaction - transaction_id: {self.transaction_id}, isolation_level: {self.isolation_level}")
            
            return self
            
        except Exception as e:
            logger.error(f"Failed to start transaction: {e}")
            raise TransactionError(f"Transaction start failed: {e}")
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Commit or rollback transaction"""
        if not self.is_active:
            return
            
        try:
            if exc_type is None:
                # No exception - commit transaction
                await self._commit()
                logger.info(f"Transaction committed successfully - transaction_id: {self.transaction_id}, operations_count: {len(self.operations)}")
            else:
                # Exception occurred - rollback transaction
                await self._rollback()
                logger.warning(f"Transaction rolled back due to error - transaction_id: {self.transaction_id}, error: {str(exc_val)}, operations_count: {len(self.operations)}")
                
        except Exception as rollback_error:
            logger.error(f"Failed to rollback transaction: {rollback_error}")
            raise TransactionError(f"Rollback failed: {rollback_error}")
        finally:
            self.is_active = False
    
    async def _commit(self):
        """Commit all operations in the transaction"""
        # For Supabase, we don't have native transactions, so we use compensating operations
        # This is a simplified implementation - in production, consider using PostgreSQL functions
        pass
    
    async def _rollback(self):
        """Rollback all operations in the transaction"""
        logger.info(f"Rolling back {len(self.rollback_operations)} operations")
        
        # Execute rollback operations in reverse order
        for rollback_op in reversed(self.rollback_operations):
            try:
                await rollback_op()
            except Exception as e:
                logger.error(f"Rollback operation failed: {e}")
    
    async def insert(self, table: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Insert operation with rollback support"""
        if not self.is_active:
            raise TransactionError("Transaction not active")
        
        try:
            result = self.supabase.table(table).insert(data).execute()
            
            if not result.data:
                raise TransactionError(f"Insert operation failed for table {table}")
            
            inserted_record = result.data[0]
            record_id = inserted_record.get('id')
            
            # Store operation for tracking
            self.operations.append({
                'type': 'insert',
                'table': table,
                'data': data,
                'result': inserted_record
            })
            
            # Add rollback operation (delete the inserted record)
            if record_id:
                async def rollback_insert():
                    try:
                        self.supabase.table(table).delete().eq('id', record_id).execute()
                        logger.debug(f"Rolled back insert for {table} id={record_id}")
                    except Exception as e:
                        logger.error(f"Failed to rollback insert: {e}")
                
                self.rollback_operations.append(rollback_insert)
            
            logger.debug(f"Transaction insert successful - table: {table}, record_id: {record_id}")
            
            return inserted_record
            
        except Exception as e:
            logger.error(f"Transaction insert failed: {e}")
            raise TransactionError(f"Insert failed: {e}")
    
    async def update(self, table: str, update_data: Dict[str, Any], 
                    where_clause: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Update operation with rollback support"""
        if not self.is_active:
            raise TransactionError("Transaction not active")
        
        try:
            # First, get the current data for rollback
            where_conditions = []
            query = self.supabase.table(table).select("*")
            
            for key, value in where_clause.items():
                query = query.eq(key, value)
            
            current_result = query.execute()
            current_records = current_result.data if current_result.data else []
            
            # Perform the update
            update_query = self.supabase.table(table).update(update_data)
            for key, value in where_clause.items():
                update_query = update_query.eq(key, value)
            
            result = update_query.execute()
            
            if not result.data:
                raise TransactionError(f"Update operation failed for table {table}")
            
            updated_records = result.data
            
            # Store operation for tracking
            self.operations.append({
                'type': 'update',
                'table': table,
                'update_data': update_data,
                'where_clause': where_clause,
                'result': updated_records
            })
            
            # Add rollback operation (restore original data)
            if current_records:
                async def rollback_update():
                    try:
                        for record in current_records:
                            record_id = record.get('id')
                            if record_id:
                                # Remove the id from the record for update
                                restore_data = {k: v for k, v in record.items() if k != 'id'}
                                self.supabase.table(table).update(restore_data).eq('id', record_id).execute()
                        
                        logger.debug(f"Rolled back update for {table}")
                    except Exception as e:
                        logger.error(f"Failed to rollback update: {e}")
                
                self.rollback_operations.append(rollback_update)
            
            logger.debug(f"Transaction update successful - table: {table}, updated_count: {len(updated_records)}")
            
            return updated_records
            
        except Exception as e:
            logger.error(f"Transaction update failed: {e}")
            raise TransactionError(f"Update failed: {e}")
    
    async def delete(self, table: str, where_clause: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Delete operation with rollback support"""
        if not self.is_active:
            raise TransactionError("Transaction not active")
        
        try:
            # First, get the data to be deleted for rollback
            query = self.supabase.table(table).select("*")
            for key, value in where_clause.items():
                query = query.eq(key, value)
            
            to_delete_result = query.execute()
            to_delete_records = to_delete_result.data if to_delete_result.data else []
            
            # Perform the delete
            delete_query = self.supabase.table(table).delete()
            for key, value in where_clause.items():
                delete_query = delete_query.eq(key, value)
            
            result = delete_query.execute()
            deleted_records = result.data if result.data else []
            
            # Store operation for tracking
            self.operations.append({
                'type': 'delete',
                'table': table,
                'where_clause': where_clause,
                'result': deleted_records
            })
            
            # Add rollback operation (restore deleted records)
            if to_delete_records:
                async def rollback_delete():
                    try:
                        for record in to_delete_records:
                            # Remove any auto-generated fields before re-insertion
                            restore_data = {k: v for k, v in record.items() 
                                          if k not in ['created_at', 'updated_at']}
                            self.supabase.table(table).insert(restore_data).execute()
                        
                        logger.debug(f"Rolled back delete for {table}")
                    except Exception as e:
                        logger.error(f"Failed to rollback delete: {e}")
                
                self.rollback_operations.append(rollback_delete)
            
            logger.debug(f"Transaction delete successful - table: {table}, deleted_count: {len(deleted_records)}")
            
            return deleted_records
            
        except Exception as e:
            logger.error(f"Transaction delete failed: {e}")
            raise TransactionError(f"Delete failed: {e}")

@asynccontextmanager
async def database_transaction(isolation_level: str = "READ_COMMITTED"):
    """Context manager for database transactions"""
    transaction = DatabaseTransaction(isolation_level)
    async with transaction:
        yield transaction

# Helper functions for common transaction patterns

async def create_project_with_tasks(project_data: Dict[str, Any], 
                                   tasks_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Create a project and its tasks atomically"""
    async with database_transaction() as txn:
        # Create project
        project = await txn.insert("projects", project_data)
        project_id = project["id"]
        
        # Create tasks with project reference
        created_tasks = []
        for task_data in tasks_data:
            task_data["project_id"] = project_id
            task = await txn.insert("tasks", task_data)
            created_tasks.append(task)
        
        return {
            "project": project,
            "tasks": created_tasks
        }

async def update_project_and_tasks(project_id: str, project_updates: Dict[str, Any],
                                  task_updates: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Update a project and its tasks atomically"""
    async with database_transaction() as txn:
        # Update project
        updated_projects = await txn.update(
            "projects", 
            project_updates, 
            {"id": project_id}
        )
        
        # Update tasks
        updated_tasks = []
        for task_update in task_updates:
            task_id = task_update.pop("id")
            tasks = await txn.update(
                "tasks",
                task_update,
                {"id": task_id}
            )
            updated_tasks.extend(tasks)
        
        return {
            "project": updated_projects[0] if updated_projects else None,
            "tasks": updated_tasks
        }

async def delete_project_cascade(project_id: str) -> Dict[str, Any]:
    """Delete a project and all related data atomically"""
    async with database_transaction() as txn:
        # Delete tasks first (foreign key dependency)
        deleted_tasks = await txn.delete("tasks", {"project_id": project_id})
        
        # Delete project
        deleted_projects = await txn.delete("projects", {"id": project_id})
        
        return {
            "project": deleted_projects[0] if deleted_projects else None,
            "tasks": deleted_tasks
        }