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
            - Key relationships: CALLS, HAS_PARAMETER, IMPLEMENTS, EXTENDS, INJECTION
            
            Node Properties:
            - Method: name, visibility, returnType, isAsync, isStatic, callCount
            - Parameter: name, type, isOptional, defaultValue
            - Class: name, isInjectable, isController
            
            Generate a Cypher query to answer the following question about the codebase:
            Question: {question}
            
            Rules:
            1. Use only relationships and properties that exist in the schema
            2. Return meaningful property combinations
            3. Include relevant relationships for context
            4. Limit results when appropriate
            5. Order results by relevance (e.g., callCount for usage patterns)
            
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
