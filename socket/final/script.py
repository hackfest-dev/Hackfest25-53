import asyncio
import json
from io import StringIO
from contextlib import redirect_stdout
from langchain_openai import ChatOpenAI  # Updated import
from langchain.agents import initialize_agent, AgentType
from langchain.tools import BaseTool
from langchain.callbacks.base import BaseCallbackHandler
from dotenv import load_dotenv
import os
import websockets
import warnings
import platform

# Suppress LangChain deprecation warnings (optional)
warnings.filterwarnings("ignore", category=DeprecationWarning, module="langchain")

# --- Dual-Capture Callback Handler ---
class StreamingCaptureHandler(BaseCallbackHandler):
    def __init__(self, websocket):
        self.websocket = websocket
        self.token_buffer = StringIO()  # For capturing LLM tokens
    
    async def on_llm_start(self, serialized, prompts, **kwargs):
        await self.websocket.send(json.dumps({
            "type": "thinking",
            "content": "Agent is thinking..."
        }))
    
    async def on_llm_new_token(self, token: str, **kwargs):
        # Capture token in buffer and send to websocket
        self.token_buffer.write(token)
        await self.websocket.send(json.dumps({
            "type": "token", 
            "content": token
        }))
    
    async def on_tool_start(self, serialized, input_str, **kwargs):
        await self.websocket.send(json.dumps({
            "type": "command",
            "content": input_str
        }))
    
    async def on_tool_end(self, output, **kwargs):
        await self.websocket.send(json.dumps({
            "type": "output",
            "content": output
        }))
    
    async def on_agent_action(self, action, **kwargs):
        await self.websocket.send(json.dumps({
            "type": "action",
            "content": f"Using tool: {action.tool}"
        }))
    
    def get_llm_tokens(self):
        return self.token_buffer.getvalue()

# --- Shell Tool with Output Capture ---
class CaptureShellTool(BaseTool):
    name: str = "terminal"
    description: str = "Executes shell commands and captures output"
    
    async def _arun(self, command: str, run_manager=None):
        # Detect OS and adjust command if needed
        system = platform.system()
        
        if system == "Windows":
            # For Windows, ensure cmd.exe is used
            # Wrap the command with cmd /c to execute and exit
            if not command.startswith("cmd /c") and not command.startswith("powershell"):
                command = f"cmd /c {command}"
        
        process = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            shell=True,  # Explicitly set shell=True for Windows compatibility
        )
        
        output_lines = []
        while True:
            line = await process.stdout.readline()
            if not line: break
            
            decoded = line.decode().strip()
            output_lines.append(decoded)
            
            # Stream line to callback handler if available
            if run_manager:
                # Just log the output but don't try to call non-existent method
                # We'll rely on the regular tool_end callback instead
                pass
                
        await process.wait()
        
        # Improve error handling for common Windows issues
        result = "\n".join(output_lines)
        if process.returncode != 0 and not result:
            if system == "Windows":
                result = f"Command failed with exit code {process.returncode}. Make sure the command is valid on Windows."
            else:
                result = f"Command failed with exit code {process.returncode}."
        
        return json.dumps({
            "command": command,
            "result": result,
            "status": "success" if process.returncode == 0 else "error"
        })
    
    def _run(self, command: str):
        # Synchronous fallback
        import subprocess
        
        # Detect OS and adjust command if needed
        system = platform.system()
        
        if system == "Windows":
            # For Windows, ensure cmd.exe is used
            if not command.startswith("cmd /c") and not command.startswith("powershell"):
                command = f"cmd /c {command}"
        
        result = subprocess.run(
            command, 
            shell=True,  # Explicitly set shell=True for Windows compatibility
            capture_output=True, 
            text=True
        )
        
        # Improve error handling for empty output
        output = result.stdout if result.stdout else (
            f"Command failed with exit code {result.returncode}. No output was returned." 
            if result.returncode != 0 else ""
        )
        
        return json.dumps({
            "command": command,
            "result": output,
            "status": "success" if result.returncode == 0 else "error"
        })

# --- WebSocket Handler with Dual Capture ---
async def agent_socket(websocket):
    load_dotenv()
    
    # Create streaming-enabled LLM
    llm = ChatOpenAI(
        temperature=0,
        model="gpt-4o-mini",
        streaming=True,
    )
    
    # Create our custom callback handler
    callback_handler = StreamingCaptureHandler(websocket)
    
    # Initialize agent with our tools and callbacks
    agent = initialize_agent(
        tools=[CaptureShellTool()],
        llm=llm,
        agent=AgentType.CHAT_ZERO_SHOT_REACT_DESCRIPTION,
        verbose=True,  # This is what creates detailed stdout
        callbacks=[callback_handler]
    )
    
    async for message in websocket:
        try:
            # Create StringIO buffer to capture stdout
            stdout_buffer = StringIO()
            
            # Use context manager to capture all stdout during agent run
            with redirect_stdout(stdout_buffer):
                # Replace deprecated arun with ainvoke
                result = await agent.ainvoke({"input": message})
                # Extract the result from the return value
                if isinstance(result, dict) and "output" in result:
                    result = result["output"]
            
            # Get all captured stdout
            verbose_output = stdout_buffer.getvalue()
            
            # Send the verbose agent steps to frontend
            for line in verbose_output.splitlines():
                if line.strip():  # Skip empty lines
                    await websocket.send(json.dumps({
                        "type": "verbose",
                        "content": line
                    }))
            
            # Send final result 
            await websocket.send(json.dumps({
                "type": "result",
                "content": result
            }))
            
        except Exception as e:
            await websocket.send(json.dumps({
                "type": "error",
                "content": str(e)
            }))

# Main server
async def main():
    async with websockets.serve(agent_socket, "localhost", 8765):
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    asyncio.run(main())