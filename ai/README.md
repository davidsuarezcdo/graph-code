# Neo4j Natural Language Search MCP Server

This is a Model Context Protocol (MCP) server that provides natural language search capabilities for Neo4j databases. It converts natural language queries into Cypher queries using the existing analyzer implementation.

## Features

- Converts natural language questions into Cypher queries
- Uses stdio transport for MCP communication
- Integrates with existing Neo4j database and analysis tools
- Returns both query results and the generated Cypher query

## Setup

1. Install the required dependencies:

```bash
pip install -r requirements.txt
```

2. Make sure your environment variables are set up properly in `.env` file (used by the config module)

3. Set up Cursor to use the MCP server:

```bash
python setup_cursor_mcp.py
```

This will configure Cursor to use the neo4j-search MCP server with stdio transport.

4. Restart Cursor to apply the changes

## Tool Usage

The MCP server provides a tool called `find_code_relationships` that takes a natural language query and returns analysis results from your Neo4j graph database.

Example queries:

- What are the most called methods in the codebase?
- Which methods have the most parameters?
- Show me the dependency chain for method X
- Which controllers have the most endpoints?

## Architecture

The server follows the same implementation approach as in the main.py application:

- Uses OpenAIEmbeddings for text processing
- Connects to Neo4j database using Neo4jManager
- Leverages CodeAnalyzer for query processing and analysis
- Returns structured results with both findings and the generated Cypher query
