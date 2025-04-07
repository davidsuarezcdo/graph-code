# Graph-Code: Code Analysis Using Knowledge Graphs

A powerful TypeScript-based code analysis system that leverages knowledge graphs to analyze and visualize code structures using Neo4j. Graph-Code transforms your codebase into a navigable graph database, enabling advanced analysis, visualization, and AI-powered natural language queries.

## 🌟 Features

- **Code Analysis**: Parse and analyze TypeScript/JavaScript codebases with the TypeScript Compiler API
- **Knowledge Graph**: Store and query code relationships in Neo4j graph database
- **Advanced Querying**: Use natural language and Cypher queries to explore code relationships
- **AI Integration**: Leverage AI models to transform natural language questions into graph queries
- **NestJS Support**: Special handling for NestJS applications with module, controller, and provider analysis

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- Bun.js
- Python 3.8+
- Neo4j Database (v5.x)

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd graph-code
   ```

2. Install dependencies:

   ```bash
   bun install
   pip install -r requirements.txt
   ```

3. Configure environment variables:
   ```bash
   cp ai/.env.example ai/.env
   # Edit .env with your Neo4j credentials and configuration
   ```

## 🛠️ Usage

### Building the Project

```bash
bun run compile
```

### Running the Graph Analysis

```bash
bun run build:graph <path-to-project>
```

Where `<path-to-project>` is the path to the project you want to analyze.

### Starting the Chat Interface

```bash
bun run serve:chat
```

### Starting the MCP Server

```bash
bun run serve:mcp
```

Example queries:

- "What are the most called methods in the codebase?"
- "Show me the dependency chain for the AuthService class"
- "Which controllers have the most endpoints?"
- "Find all classes that implement the UserRepository interface"

## 🏗️ Architecture

The system consists of three main components:

1. **Code Scanner & Parser**

   - Uses TypeScript Compiler API
   - Implements incremental parsing
   - Handles multiple file types

2. **Knowledge Graph Engine**

   - Neo4j database backend
   - Optimized Cypher queries
   - APOC integration

3. **Explorer Interface**

   - Interactive visualization
   - RESTful API
   - Real-time updates

4. **AI Integration**
   - Natural language processing for code queries
   - Automatic Cypher query generation
   - MCP (Model Context Protocol) server for IDE integration
   - Code analysis and insights generation

### System Architecture Diagram

```mermaid
graph TD
    subgraph Code Analysis
        Scanner[Code Scanner]
        Parser[AST Parser]
        Analyzer[Code Analyzer]
        TSBuilder[TypeScript Graph Builder]
    end

    subgraph Knowledge Graph
        Neo4j[(Neo4j Database)]
        GraphBuilder[Neo4j Graph Builder]
        QueryEngine[Query Engine]
        VectorStore[Vector Store]
    end

    subgraph Explorer
        UI[Web Interface]
        APILayer[API Layer]
        Visualizer[Graph Visualizer]
    end

    subgraph AI Integration
        LLMService[LLM Service]
        CodeAnalyzer[Code Analyzer]
        MCPServer[MCP Server]
        ChatServer[Chat Interface]
    end

    Scanner --> Parser
    Parser --> Analyzer
    Analyzer --> TSBuilder
    TSBuilder --> GraphBuilder
    GraphBuilder --> Neo4j
    QueryEngine --> Neo4j

    Neo4j --> VectorStore

    APILayer --> QueryEngine
    UI --> APILayer
    Visualizer --> APILayer

    CodeAnalyzer --> Neo4j
    CodeAnalyzer --> LLMService
    MCPServer --> CodeAnalyzer
    ChatServer --> CodeAnalyzer

    APILayer --> MCPServer

    classDef core fill:#553366,stroke:#aa88bb,stroke-width:2px
    classDef db fill:#335566,stroke:#88aabb,stroke-width:2px
    classDef ui fill:#555533,stroke:#bbbb88,stroke-width:2px
    classDef ai fill:#553355,stroke:#bb88aa,stroke-width:2px

    class Scanner,Parser,Analyzer,TSBuilder core
    class Neo4j,GraphBuilder,QueryEngine,VectorStore db
    class UI,APILayer,Visualizer ui
    class LLMService,CodeAnalyzer,MCPServer,ChatServer ai
```

## 📊 Data Model

The knowledge graph uses the following Entity-Property-Relationship structure:

```mermaid
erDiagram
    Module {
        string id PK
        string name
        string filepath
        boolean isDynamic
        int totalProviders
        int totalControllers
        int totalImports
    }

    Class {
        string id PK
        string name
        string filepath
        boolean isInjectable
        string visibility
    }

    Interface {
        string id PK
        string name
        string filepath
    }

    Method {
        string id PK
        string name
        string visibility
        string returnType
        int callCount
        string filepath
    }

    Parameter {
        string id PK
        string name
        string type
    }

    Provider {
        string id PK
        string name
        string type
        string filepath
    }

    Controller {
        string id PK
        string name
        string filepath
    }

    DynamicModuleConfig {
        string id PK
        string methodName
    }

    Dependency {
        string id PK
        string name
        string filepath
        boolean isExternal
    }

    Module ||--o{ Controller : DECLARES_CONTROLLER
    Module ||--o{ Provider : PROVIDES
    Module ||--o{ Module : IMPORTS
    Module ||--o{ DynamicModuleConfig : HAS_DYNAMIC_CONFIG

    Class ||--o{ Method : CONTAINS
    Class ||--o{ Parameter : CONTAINS
    Class }|--|| Interface : IMPLEMENTS
    Class }|--|| Class : EXTENDS

    Controller ||--o{ Method : CONTAINS

    Method ||--o{ Parameter : ACCEPTS
    Method ||--o{ Method : CALLS
    Method ||--o{ Dependency : INJECTION
```

Key entities in the knowledge graph:

- **Modules**: TypeScript modules with imports, controllers, and providers
- **Classes**: TypeScript classes with methods and inheritance relationships
- **Interfaces**: TypeScript interfaces that classes can implement
- **Methods**: Functions within classes, including call relationships
- **Parameters**: Function parameters with their types
- **Controllers**: API endpoints and route handlers
- **Providers**: Service providers and dependency injection
- **Dependencies**: External and internal code dependencies

The knowledge graph captures the relationships between these entities, enabling powerful code analysis and exploration capabilities.

## 🧪 Testing

```bash
bun test
```

The project maintains a minimum of 80% test coverage across all components.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

[GNU Affero General Public License v3 (AGPL-3.0)](LICENSE) - This is a copyleft license that requires anyone who distributes or modifies your code to make the source available under the same terms. It also requires that if the software is used over a network (like a web application), the complete source code must be made available to its users.

For commercial use, please contact the author for explicit permission.

## 🔗 Links

- [Project Documentation](docs/)
- [Issue Tracker](issues/)
- [Neo4j Documentation](https://neo4j.com/docs/)
