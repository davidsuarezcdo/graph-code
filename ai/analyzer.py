from langchain.prompts import PromptTemplate
from langchain.chains.graph_qa.cypher import GraphCypherQAChain
from langchain.chat_models import ChatOpenAI
from typing import Dict, Any, Optional
from database import Neo4jManager
from config import OpenAIConfig

class CodeAnalyzer:
    def __init__(self, db_manager: Neo4jManager, openai_config: OpenAIConfig):
        self.db_manager = db_manager
        self.llm = ChatOpenAI(
            api_key=openai_config.api_key,
            model_name=openai_config.model_name,
            temperature=openai_config.temperature
        )
        self._qa_chain: Optional[GraphCypherQAChain] = None
        
    def initialize_qa_chain(self) -> GraphCypherQAChain:
        if not self._qa_chain and self.db_manager.graph:
            template = """
            You are an expert in analyzing TypeScript/NestJS code structures in a Neo4j graph database.
            
            Database Schema:
            {schema}
            
            The graph contains:
            - Nodes: Module, Controller, Provider, Method, Parameter, Class
            - Key relationships: 
                - (Module)-[:DECLARES_CONTROLLER]->(Controller) - A module declares controllers
                - (Module)-[:PROVIDES]->(Provider) - A module provides services
                - (Module)-[:EXPORTS]->(Provider) - A module exports providers
                - (Module)-[:IMPORTS]->(Module) - A module imports other modules
                - (Class/Provider/Controller)-[:HAS_METHOD]->(Method) - Classes have methods
                - (Method)-[:CALLS]->(Method) - Methods call other methods
                - (Method)-[:HAS_PARAMETER]->(Parameter) - Methods have parameters
                - (Class)-[:IMPLEMENTS]->(Interface) - Classes implement interfaces
                - (Class)-[:EXTENDS]->(Class) - Classes extend other classes
                - (Class/Provider/Controller)-[:INJECTION]->(Provider) - Dependency injection
            
            Node Properties:
            - Method: name, visibility, returnType, isAsync, isStatic, callCount
            - Parameter: name, type, isOptional, defaultValue
            - Class: name, isInjectable, isController
            - Module: name, controllers (list), imports (list), exports (list), providers (list)
            - Controller: name, level
            
            IMPORTANT: Always respect relationship directions exactly as shown above.
            For example, the relationship between Module and Controller is (Module)-[:DECLARES_CONTROLLER]->(Controller), 
            NOT (Controller)-[:DECLARES_CONTROLLER]->(Module).
            
            Generate a Cypher query to answer the following question about the codebase:
            Question: {question}
            
            Rules:
            1. Use only relationships and properties that exist in the schema
            2. Return meaningful property combinations
            3. Include relevant relationships for context
            4. Limit results when appropriate
            5. Order results by relevance (e.g., callCount for usage patterns)
            6. Always use the correct relationship direction
            
            Return only the Cypher query, no explanations.
            """
            
            question_prompt = PromptTemplate(
                template=template,
                input_variables=["schema", "question"]
            )
            
            self._qa_chain = GraphCypherQAChain.from_llm(
                llm=self.llm,
                graph=self.db_manager.graph,
                cypher_prompt=question_prompt,
                verbose=True,
                allow_dangerous_requests=True
            )
            
        return self._qa_chain
    
    def analyze(self, question: str) -> Dict[str, Any]:
        if not self._qa_chain:
            self.initialize_qa_chain()
            
        if not self._qa_chain:
            raise RuntimeError("QA Chain not initialized. Make sure the database is connected.")
            
        return self._qa_chain.invoke({"query": question}) 
