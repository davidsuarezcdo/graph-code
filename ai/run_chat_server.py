import streamlit as st
from langchain_openai import OpenAIEmbeddings
from config import load_config
from database import Neo4jManager
from analyzer import CodeAnalyzer

def initialize_session_state():
    """Initialize session state variables"""
    if 'initialized' not in st.session_state:
        config = load_config()
        
        # Initialize embeddings
        embeddings = OpenAIEmbeddings(api_key=config.openai.api_key)
        st.session_state['embeddings'] = embeddings
        
        # Initialize database manager
        db_manager = Neo4jManager(config.neo4j)
        st.session_state['db_manager'] = db_manager
        
        # Initialize analyzer
        analyzer = CodeAnalyzer(db_manager, config.openai)
        st.session_state['analyzer'] = analyzer
        
        st.session_state['initialized'] = True

def setup_page():
    """Configure page layout and sidebar"""
    st.set_page_config(
        layout="wide",
        page_title="Code Graph Analyzer",
        page_icon=":mag:"
    )
    
    st.title("TypeScript/NestJS Code Graph Analyzer")
    
    with st.sidebar.expander("About", expanded=True):
        st.markdown("""
        This application analyzes TypeScript/NestJS codebases using a Neo4j graph database.
        It can answer questions about:
        - Method relationships and dependencies
        - Code structure and patterns
        - Module organization
        - Class hierarchies
        """)

def connect_database():
    """Connect to Neo4j and initialize vector store"""
    if 'db_manager' in st.session_state:
        db_manager = st.session_state['db_manager']
        try:
            db_manager.connect()
            
            # Initialize vector store
            db_manager.initialize_vector_store(st.session_state['embeddings'])
            return True
            
        except Exception as e:
            st.error(f"Failed to connect to Neo4j: {e}")
            return False

def display_example_questions():
    """Display example questions for users"""
    st.subheader("Ask about your codebase")
    st.markdown("""
    Example questions:
    - What are the most called methods in the codebase?
    - Which methods have the most parameters?
    - Show me the dependency chain for method X
    - Which controllers have the most endpoints?
    - What are the unused methods?
    - Which classes have the most dependencies?
    - Show me all service methods that return Promises
    - What are the most complex methods based on parameter count?
    """)

def handle_question(question: str):
    """Process and display analysis results"""
    with st.spinner("Analyzing the codebase..."):
        try:
            analyzer = st.session_state['analyzer']
            result = analyzer.analyze(question)
            
            # Display results
            st.subheader("Analysis Results")
            
            # Show Cypher query in expandable section
            if isinstance(result, dict) and 'intermediate_steps' in result:
                with st.expander("View Generated Cypher Query"):
                    st.code(result['intermediate_steps'][0], language='cypher')
            
            # Display findings
            st.markdown("### Findings")
            if isinstance(result, dict) and 'result' in result:
                st.write(result['result'])
            else:
                st.write(result)
                
        except Exception as e:
            st.error(f"Error during analysis: {str(e)}")
            st.info("Please try rephrasing your question or check the database connection.")

def main():
    setup_page()
    initialize_session_state()
    
    if connect_database():
        display_example_questions()
        
        # Create question input
        question = st.text_input(
            "Enter your question about the codebase:",
            placeholder="e.g., What are the most called methods?"
        )
        analyze_button = st.button('Analyze', type='primary')
        
        if analyze_button and question:
            handle_question(question)
    else:
        st.warning("Please ensure Neo4j is running and credentials are correct in the .env file.")

if __name__ == "__main__":
    main()
