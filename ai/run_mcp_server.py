#!/usr/bin/env python
import uvicorn
import sys
from typing import Any, Dict
from mcp.server.fastmcp import FastMCP
from langchain_openai import OpenAIEmbeddings
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

# Import local modules from main.py
from config import load_config
from database import Neo4jManager
from analyzer import CodeAnalyzer

# Initialize FastMCP server
@asynccontextmanager
async def server_lifespan(server) -> AsyncIterator[dict]:
    """Manage server startup and shutdown lifecycle."""
    print("Starting up Neo4j connection...")
    # Initialize the database connection
    db_manager.connect()
    db_manager.initialize_vector_store(embeddings)
    
    try:
        yield {"db_manager": db_manager}
    finally:
        print("Shutting down Neo4j connection...")
        db_manager.close()

mcp = FastMCP("neo4j-search", lifespan=server_lifespan, settings={
    "host": "localhost", 
    "port": 28888,
    "cors_origins": ["*"]
})

# Initialize components
config = load_config()
embeddings = OpenAIEmbeddings(api_key=config.openai.api_key)
db_manager = Neo4jManager(config.neo4j)
analyzer = CodeAnalyzer(db_manager, config.openai)

# Connect to database
def connect_database():
    try:
        db_manager.connect()
        db_manager.initialize_vector_store(embeddings)
        return True
    except Exception as e:
        print(f"Error connecting to Neo4j: {e}")
        return False


@mcp.tool()
async def find_code_relationships(query: str) -> Dict[str, Any]:
    """
    Search the codebase for precise code relationships and references
    
    This tool specializes in discovering exact relationships between code components
    in TypeScript/NestJS applications. It transforms natural language questions into
    optimized Cypher queries that reveal precise dependencies, interactions, and
    structural connections within your codebase.
    
    Relationship-finding capabilities:
    - Exact dependency chains (which services depend on which)
    - Call hierarchies (which methods call which methods)
    - Module composition (what controllers/providers belong where)
    - Inheritance structures (class extension and interface implementation)
    - Injection patterns (what gets injected where)
    
    Each entity in the knowledge graph includes exact code location via the filepath
    property (format: 'path/to/file.ts:startLine:endLine'), enabling direct navigation
    to specific relationship implementations in the source code.
    
    Relationship query examples:
    - "Find all direct dependencies of AuthService"
    - "Show the complete call chain from UserController.create to Repository.save"
    - "Which controllers are declared by modules that import ConfigModule?"
    - "Find all classes that both extend BaseEntity and implement Repository interface"
    - "Show methods that are called by more than 5 other methods"
    - "Which providers are injected into controllers in the auth directory?"
    
    Args:
        query: Natural language question about code relationships
    
    Returns:
        A dictionary containing the discovered relationships and the Cypher query used
    """
    try:
        # Use analyzer to process the question (similar to handle_question)
        result = analyzer.analyze(query)
        
        # Format the response
        if isinstance(result, dict):
            response = {
                "success": True,
                "result": result.get("result", "No results found"),
            }
            
            # Include Cypher query if available
            if "intermediate_steps" in result and result["intermediate_steps"]:
                response["cypher_query"] = result["intermediate_steps"][0]
        else:
            response = {
                "success": True,
                "result": result,
                "cypher_query": None
            }
            
        return response
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "Error processing query. Please try rephrasing your question."
        }

@mcp.resource("schema://graph")
def get_schema() -> str:
    """Provide the Neo4j graph schema as a resource"""
    return db_manager.get_schema_description()

@mcp.prompt()
def create_query_prompt(entity_type: str) -> str:
    """Create a prompt template for finding relationships for specific entity types"""
    return f"Find all relationships involving {entity_type} nodes in the codebase"

if __name__ == "__main__":
    # Connect to database first
    if not connect_database():
        print("Failed to connect to database. Exiting.")
        exit(1)
    
    try:
        mcp.run(transport='sse')
    except KeyboardInterrupt:
        print("Server shutdown requested...")
    except Exception as e:
        print(f"Error running server: {e}")



if __name__ == "__main__":
    # Get port from command line or use default
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 28888
    
    # Use uvicorn directly with explicit port configuration
    uvicorn.run(
        mcp.sse_app(),
        host="localhost",
        port=port,
        log_level="info"
    ) 
