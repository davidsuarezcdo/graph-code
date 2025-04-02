#!/usr/bin/env python
import uvicorn
import sys
from mcp_server import mcp

if __name__ == "__main__":
    # Get port from command line or use default
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 28888
    
    # Use uvicorn directly with explicit port configuration
    uvicorn.run(
        mcp.sse_app(),
        host="localhost",
        port=port,
        log_level="info"
    ) 
