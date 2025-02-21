# Graph-Code: Code Analysis Using Knowledge Graphs

A powerful TypeScript-based code analysis system that leverages knowledge graphs to analyze and visualize code structures using Neo4j.

## 🌟 Features

- **Code Analysis**: Parse and analyze TypeScript/JavaScript codebases
- **Knowledge Graph**: Store and query code relationships in Neo4j
- **Interactive Visualization**: Explore code structures through an intuitive interface
- **Real-time Updates**: Track code changes and update the graph automatically
- **Advanced Querying**: Use natural language and Cypher queries to explore code relationships

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

## 📊 Data Model

Key entities in the knowledge graph:

- **Nodes**: Modules, Classes, Functions, Variables, Files
- **Relationships**: Contains, Inherits From, Implements, Calls
- **Properties**: Name, Type, File Path, Modification Date, Size

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
