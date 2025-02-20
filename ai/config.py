import os
from dotenv import load_dotenv
from dataclasses import dataclass

@dataclass
class Neo4jConfig:
    url: str
    username: str
    password: str
    database: str = "neo4j"
    
@dataclass
class OpenAIConfig:
    api_key: str
    model_name: str = "gpt-4"
    temperature: float = 0

@dataclass
class AppConfig:
    neo4j: Neo4jConfig
    openai: OpenAIConfig
    
def load_config(env_path: str = None) -> AppConfig:
    if env_path:
        load_dotenv(env_path)
    else:
        load_dotenv()
    
    return AppConfig(
        neo4j=Neo4jConfig(
            url=os.getenv("NEO4J_URL"),
            username=os.getenv("NEO4J_USER"),
            password=os.getenv("NEO4J_PASSWORD")
        ),
        openai=OpenAIConfig(
            api_key=os.getenv("OPENAI_API_KEY")
        )
    ) 
