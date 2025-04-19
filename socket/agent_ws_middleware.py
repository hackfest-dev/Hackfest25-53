import asyncio
import json
import websockets
import logging
import sys
import os
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# WebSocket server configuration
WS_HOST = "localhost"
WS_PORT = 6789

# Agent output directory
AGENT_OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
                               "features", "main", "worksbro")
AGENT_OUTPUT_FILE = os.path.join(AGENT_OUTPUT_DIR, "agent_output.json")

# Ensure directory exists
os.makedirs(AGENT_OUTPUT_DIR, exist_ok=True)

# Create or ensure agent_output.json exists with valid initial content
if not os.path.exists(AGENT_OUTPUT_FILE):
    with open(AGENT_OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump({"messages": []}, f, ensure_ascii=False, indent=2)

# Connected clients
connected_clients = set()

async def send_to_clients(message):
    """Send a message to all connected clients."""
    if not connected_clients:
        return
        
    if isinstance(message, str):
        ws_message = message
    else:
        try:
            ws_message = json.dumps(message)
        except Exception as e:
            logger.error(f"Error serializing message: {e}")
            ws_message = str(message)
    
    disconnected = set()
    for client in connected_clients:
        try:
            await client.send(ws_message)
        except websockets.exceptions.ConnectionClosed:
            disconnected.add(client)
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            disconnected.add(client)
    
    # Remove disconnected clients
    connected_clients.difference_update(disconnected)

async def add_message_to_json(message_data):
    """Add a message to the agent_output.json file."""
    try:
        # Load existing data
        try:
            with open(AGENT_OUTPUT_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            # Reset if file is corrupted or missing
            data = {"messages": []}
        
        # Add the new message
        if isinstance(message_data, dict):
            data["messages"].append(message_data)
        
        # Write back to file
        with open(AGENT_OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            
        return True
    except Exception as e:
        logger.error(f"Error writing to agent_output.json: {e}")
        return False

async def message_handler(websocket):
    """Handle WebSocket connections and messages."""
    client_id = id(websocket)
    connected_clients.add(websocket)
    logger.info(f"New client connected: {client_id}")
    
    try:
        # Send initial connection message
        await websocket.send(json.dumps({
            "type": "system",
            "content": "Connected to agent WebSocket server"
        }))
        
        # Process incoming messages
        async for message in websocket:
            logger.info(f"Received from client {client_id}: {message[:100]}...")
            
            try:
                # Try to parse as JSON
                data = json.loads(message)
                message_type = data.get("type", "")
                content = data.get("content", "")
                
                # Handle user input
                if message_type == "user_input":
                    # Log user input
                    user_message = {
                        "agent_name": "user",
                        "agent_output": message,
                        "meta": None
                    }
                    await add_message_to_json(user_message)
                    
                    # Broadcast to all clients
                    await send_to_clients({
                        "agent_name": "user",
                        "agent_output": content,
                        "meta": None
                    })
                    
                    # Debug log
                    logger.info(f"Received command from client: {message}")
                    
                # Handle user response to a question
                elif message_type == "user_response":
                    await send_to_clients({
                        "type": "user_response",
                        "content": content
                    })
            except json.JSONDecodeError:
                # Not JSON, treat as plain text
                logger.warning(f"Received non-JSON message: {message[:100]}...")
                await send_to_clients({
                    "type": "output",
                    "content": message
                })
    except websockets.exceptions.ConnectionClosed:
        logger.info(f"Client {client_id} disconnected normally")
    except Exception as e:
        logger.error(f"Error handling client {client_id}: {e}")
    finally:
        connected_clients.discard(websocket)
        logger.info(f"Client {client_id} disconnected")

async def main():
    """Start the WebSocket server."""
    logger.info(f"Starting WebSocket server on {WS_HOST}:{WS_PORT}")
    logger.info(f"Agent output file: {AGENT_OUTPUT_FILE}")
    
    async with websockets.serve(message_handler, WS_HOST, WS_PORT):
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}")
        sys.exit(1)
