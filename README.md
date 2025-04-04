# Graph-Code: Code Analysis Using Knowledge Graphs

A powerful TypeScript-based code analysis system that leverages knowledge graphs to analyze and visualize code structures using Neo4j. Graph-Code transforms your codebase into a navigable graph database, enabling advanced analysis, visualization, and AI-powered natural language queries.

## 🌟 Features

- **Code Analysis**: Parse and analyze TypeScript/JavaScript codebases with the TypeScript Compiler API
- **Knowledge Graph**: Store and query code relationships in Neo4j graph database
- **Interactive Visualization**: Explore code structures through an intuitive interface
- **Real-time Updates**: Track code changes and update the graph automatically
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
bun run build
```

### Running the Graph Analysis

```bash
bun run graph
```

### Starting the Explorer Interface

```bash
bun run serve
```

### Using Natural Language Queries

Graph-Code provides an AI-powered natural language interface for querying your codebase:

```bash
python ai/run_mcp_server.py
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

## 📚 Documentation

- `/docs/technical.md` - Technical specifications
- `/docs/project.md` - Project vision and overview
- `/docs/architecture.mermaid` - System architecture diagram

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
