import asyncio
import websockets
import json
import os
import sys
import subprocess
from pathlib import Path

async def run_websocket_server():
    print("🚀 Starting WebSocket server on port 6789...")
    server = await websockets.serve(handle_client, "localhost", 6789)
    print("✅ WebSocket server is running at ws://localhost:6789")
    await server.wait_closed()

connected_clients = set()

async def handle_client(websocket, path):
    # Register client
    connected_clients.add(websocket)
    print(f"New client connected ({len(connected_clients)} active connections)")
    
    try:
        # Initial connection message
        await websocket.send(json.dumps({
            "type": "system",
            "content": "Connected to AI Agent WebSocket server"
        }))
        
        # Handle incoming messages
        async for message in websocket:
            try:
                data = json.dumps(json.loads(message))
                print(f"Received: {message[:50]}...")
                
                # Forward message to agent script via stdin
                if "browser_agent_process" in globals() and browser_agent_process.poll() is None:
                    browser_agent_process.stdin.write(f"{message}\n")
                    browser_agent_process.stdin.flush()
                    
                # Broadcast to other clients for monitoring
                for client in connected_clients:
                    if client != websocket:
                        try:
                            await client.send(message)
                        except:
                            pass
                            
            except Exception as e:
                print(f"Error processing message: {e}")
                try:
                    await websocket.send(json.dumps({
                        "type": "error", 
                        "content": f"Error: {str(e)}"
                    }))
                except:
                    pass
    except websockets.exceptions.ConnectionClosed:
        print("Client connection closed")
    finally:
        connected_clients.remove(websocket)
        print(f"Client disconnected ({len(connected_clients)} active connections)")

# Start the browser agent process
def start_browser_agent():
    global browser_agent_process
    agent_path = Path(__file__).parent.parent / "flask-backend" / "browseragent.py"
    
    if not agent_path.exists():
        print(f"ERROR: Browser agent script not found at {agent_path}")
        return None
    
    print(f"Starting browser agent: {agent_path}")
    
    browser_agent_process = subprocess.Popen(
        [sys.executable, str(agent_path)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    
    return browser_agent_process

if __name__ == "__main__":
    # Start the browser agent as a subprocess
    browser_agent_process = start_browser_agent()
    
    # Start the WebSocket server
    asyncio.run(run_websocket_server())
