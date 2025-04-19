import asyncio
import json
import websockets
import logging
import subprocess
import sys
import os
import threading
import queue
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Queue for communication between threads
task_queue = queue.Queue()
result_queue = queue.Queue()
connected_clients = set()

def run_browser_agent(input_queue, output_queue):
    """Run the browser agent script in a separate thread."""
    try:
        # Path to the browser agent script
        script_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
                                  "flask-backend", "browseragent.py")
        
        # Create subprocess with pipes for input/output
        process = subprocess.Popen(
            [sys.executable, script_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1  # Line buffered
        )
        
        logger.info("Browser agent process started")
        
        # Function to handle stdout in realtime
        def read_output():
            while True:
                line = process.stdout.readline()
                if not line and process.poll() is not None:
                    break
                    
                if line:
                    line = line.strip()
                    logger.info(f"Agent output: {line}")
                    
                    # Detect if this is a question prompt
                    if "🧑 Enter task:" in line:
                        # Ignore initial prompt
                        continue
                    elif "🧑" in line and "?" in line:
                        # This looks like a question
                        question = line.split("🧑", 1)[1].strip()
                        output_queue.put(json.dumps({
                            "type": "question",
                            "content": question
                        }))
                    else:
                        # Regular output line
                        output_queue.put(json.dumps({
                            "type": "output",
                            "content": line
                        }))
        
        # Start output reading thread
        output_thread = threading.Thread(target=read_output, daemon=True)
        output_thread.start()
        
        # Wait for tasks and send them to the browser agent
        while True:
            try:
                # Get task from queue with timeout
                task_data = input_queue.get(timeout=0.1)
                data = json.loads(task_data)
                
                if data["type"] == "task":
                    # Send new task to browser agent
                    process.stdin.write(f"{data['content']}\n")
                    process.stdin.flush()
                    logger.info(f"Sent task to browser agent: {data['content']}")
                    
                    # Notify frontend
                    output_queue.put(json.dumps({
                        "type": "system",
                        "content": "Task received, processing..."
                    }))
                    
                elif data["type"] == "answer":
                    # Send answer to question
                    process.stdin.write(f"{data['content']}\n")
                    process.stdin.flush()
                    logger.info(f"Sent answer to browser agent: {data['content']}")
                
                elif data["type"] == "exit":
                    # Exit command received
                    break
                    
            except queue.Empty:
                # No task available, check if process is still alive
                if process.poll() is not None:
                    logger.error(f"Browser agent process exited with code {process.returncode}")
                    output_queue.put(json.dumps({
                        "type": "error",
                        "content": f"Browser agent process terminated (exit code {process.returncode})"
                    }))
                    break
                continue
                
            except Exception as e:
                logger.error(f"Error processing task: {str(e)}")
                output_queue.put(json.dumps({
                    "type": "error",
                    "content": f"Error processing task: {str(e)}"
                }))
        
        # Terminate process if it's still running
        if process.poll() is None:
            process.terminate()
            process.wait(timeout=5)
            
    except Exception as e:
        logger.error(f"Error in browser agent thread: {str(e)}")
        output_queue.put(json.dumps({
            "type": "error",
            "content": f"Browser agent error: {str(e)}"
        }))

async def handle_websocket(websocket, path):
    """Handle WebSocket connections from frontend."""
    client_id = id(websocket)
    connected_clients.add(websocket)
    logger.info(f"Client connected: {client_id}")
    
    try:
        # Start browser agent thread if not already running
        if not hasattr(handle_websocket, 'agent_thread') or not handle_websocket.agent_thread.is_alive():
            handle_websocket.agent_thread = threading.Thread(
                target=run_browser_agent, 
                args=(task_queue, result_queue),
                daemon=True
            )
            handle_websocket.agent_thread.start()
            logger.info("Started browser agent thread")
        
        # Send initial connection message
        await websocket.send(json.dumps({
            "type": "system",
            "content": "Connected to Browser Agent server"
        }))
        
        # Start task to forward results from agent to websocket
        async def forward_results():
            while True:
                try:
                    # Check if there's anything in the result queue
                    if not result_queue.empty():
                        result = result_queue.get_nowait()
                        # Forward to client
                        await websocket.send(result)
                    
                    # Small delay to prevent high CPU usage
                    await asyncio.sleep(0.1)
                    
                except Exception as e:
                    logger.error(f"Error forwarding results: {str(e)}")
                    await asyncio.sleep(1)  # Longer delay on error
        
        # Start forwarding task
        forward_task = asyncio.create_task(forward_results())
        
        # Handle incoming messages from frontend
        async for message in websocket:
            try:
                # Parse the message
                data = json.loads(message)
                logger.info(f"Received message: {data['type']}")
                
                # Send to browser agent thread
                task_queue.put(message)
                
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON: {message}")
                await websocket.send(json.dumps({
                    "type": "error",
                    "content": "Invalid JSON message"
                }))
                
            except Exception as e:
                logger.error(f"Error handling message: {str(e)}")
                await websocket.send(json.dumps({
                    "type": "error",
                    "content": f"Server error: {str(e)}"
                }))
    
    finally:
        # Clean up when connection closes
        connected_clients.remove(websocket)
        forward_task.cancel()
        logger.info(f"Client disconnected: {client_id}")
        
        # If this was the last client, signal browser agent to exit
        if not connected_clients:
            try:
                task_queue.put(json.dumps({"type": "exit"}))
                logger.info("Sent exit signal to browser agent")
            except:
                pass

async def main():
    """Start the WebSocket server."""
    server = await websockets.serve(
        handle_websocket,
        "localhost",
        8766  # Different port from the command agent server
    )
    
    logger.info("Browser Agent WebSocket server started on ws://localhost:8766")
    
    # Keep the server running
    await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {str(e)}")
