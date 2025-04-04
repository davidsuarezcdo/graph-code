from langchain_community.graphs import Neo4jGraph
from langchain_community.vectorstores import Neo4jVector
from langchain.embeddings.base import Embeddings
from typing import Optional
from config import Neo4jConfig

class Neo4jManager:
    def __init__(self, config: Neo4jConfig):
        self.config = config
        self._graph: Optional[Neo4jGraph] = None
        self._vector_store: Optional[Neo4jVector] = None
        
    def connect(self) -> Neo4jGraph:
        if not self._graph:
            self._graph = Neo4jGraph(
                url=self.config.url,
                username=self.config.username,
                password=self.config.password
            )
        return self._graph
    
    def initialize_vector_store(self, embeddings: Embeddings) -> Neo4jVector:
        if not self._vector_store:
            self._vector_store = Neo4jVector.from_existing_graph(
                embedding=embeddings,
                url=self.config.url,
                username=self.config.username,
                password=self.config.password,
                database=self.config.database,
                node_label="Method",
                text_node_properties=["name", "visibility", "returnType"],
                embedding_node_property="embedding",
                index_name="method_vector_index",
                search_type="hybrid"
            )
        return self._vector_store
    
    @property
    def graph(self) -> Optional[Neo4jGraph]:
        return self._graph
    
    @property
    def vector_store(self) -> Optional[Neo4jVector]:
        return self._vector_store
    
    @property
    def schema(self):
        if self._graph:
            return self._graph.get_schema
        return None 
