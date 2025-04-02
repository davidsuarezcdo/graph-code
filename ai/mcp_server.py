from typing import Any, Dict
from mcp.server.fastmcp import FastMCP
from langchain.embeddings import OpenAIEmbeddings
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
async def search_codebase(query: str) -> Dict[str, Any]:
    """
    Search the codebase using natural language and convert to Cypher queries
    
    Args:
        query: Natural language question about the codebase
    
    Returns:
        A dictionary containing analysis results and the Cypher query used
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
    """Create a prompt template for querying specific entity types"""
    return f"Show me all {entity_type} nodes and their relationships in the codebase"

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

