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
import re

# Suppress LangChain deprecation warnings (optional)
warnings.filterwarnings("ignore", category=DeprecationWarning, module="langchain")

# --- Improved cleaning functions ---
def clean_ansi_codes(text):
    """Remove ANSI color codes and other artifacts from text."""
    import re
    # Remove ANSI color codes
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    return ansi_escape.sub('', text).strip()

# Improve the filter function to be more comprehensive
def should_filter_verbose_line(line):
    """Filter out raw LangChain debug output that we don't want to show in frontend."""
    # First handle standard filters
    filters = [
        "> Entering new AgentExecutor chain",
        "> Finished chain",
        "[0m",  # ANSI color code endings
        "[32;1m",  # ANSI color code beginnings
        "[36;1m",  # More ANSI color codes
        "[1;3m",  # More ANSI formatting
        "Thought:",  # Raw thought prefix (already processed via thinking steps)
        "Action:",   # Raw action prefix (already processed via thinking steps)
        "Final Answer:",  # Raw final answer prefix
        "Observation:",   # Raw observation prefix
    ]
    
    for filter_text in filters:
        if filter_text in line:
            return True
    
    # Also filter lines that are just LangChain formatting noise with no real content
    if re.match(r'^\s*\[\d+;\d+m\s*$', line):
        return True
    
    # Super aggressive filtering of anything that might be JSON action format
    # Filter ANY line containing both action and action_input keywords, regardless of formatting
    if '"action"' in line or '"action_input"' in line:
        return True
        
    # Filter any line starting with { or ending with }
    if re.match(r'^\s*{', line.strip()) or re.match(r'.*}\s*$', line.strip()):
        return True
        
    # Filter triple backtick code blocks that come from raw output
    if line.strip() == '```' or line.strip().startswith('```{'):
        return True
        
    return False

# --- Dual-Capture Callback Handler ---
class StreamingCaptureHandler(BaseCallbackHandler):
    def __init__(self, websocket):
        self.websocket = websocket
        self.token_buffer = StringIO()  # For capturing LLM tokens
        self.current_thought = ""
        self.thinking_mode = None
        self.throttle_counter = 0
        self.line_buffer = []  # Buffer to catch multi-line JSON
        self.last_command = None  # Track the last command to avoid duplicates
        self.thought_count = 0  # Track number of thoughts to avoid throttling initially
    
    async def on_llm_start(self, serialized, prompts, **kwargs):
        await self.websocket.send(json.dumps({
            "type": "thinking_step",
            "content": "Starting to analyze your request..."
        }))
        
        # Send the initial prompt too
        if prompts and len(prompts) > 0:
            first_prompt = prompts[0]
            if isinstance(first_prompt, str) and len(first_prompt) < 500:  # Only send if not too long
                await self.websocket.send(json.dumps({
                    "type": "reasoning_step",
                    "content": f"Working with prompt: {first_prompt[:150]}..."
                }))
        
        # Add small delay to make thinking appear more natural
        await asyncio.sleep(0.5)
    
    async def on_llm_new_token(self, token: str, **kwargs):
        # Capture token in buffer
        self.token_buffer.write(token)
        
        # Reduce throttling to show more tokens
        self.throttle_counter += 1
        if self.throttle_counter % 3 != 0 and self.thought_count > 5:  # Process every 3rd token after initial thoughts
            return
            
        # Check if token indicates a new thought pattern
        if "Thought:" in token and self.thinking_mode != "thinking":
            self.thinking_mode = "thinking"
            self.current_thought = ""
            await self.websocket.send(json.dumps({
                "type": "thinking_step", 
                "content": "Thinking about the problem..."
            }))
            self.thought_count += 1
            # Add small delay to make thinking appear more natural
            await asyncio.sleep(0.3)
        elif "Action:" in token and self.thinking_mode != "action":
            self.thinking_mode = "action"
            self.current_thought = ""
            await self.websocket.send(json.dumps({
                "type": "action_step", 
                "content": "Planning next action..."
            }))
            self.thought_count += 1
            # Add small delay to make thinking appear more natural
            await asyncio.sleep(0.3)
        elif "Final Answer:" in token and self.thinking_mode != "final":
            self.thinking_mode = "final"
            self.current_thought = ""
            await self.websocket.send(json.dumps({
                "type": "reasoning_step", 
                "content": "Finalizing answer..."
            }))
            self.thought_count += 1
            # Add small delay to make thinking appear more natural
            await asyncio.sleep(0.3)
        
        # Add to current thought and send if it forms a complete sentence or idea
        self.current_thought += token
        
        # Send smaller chunks of tokens more frequently
        sentence_end = ("." in token or "?" in token or "!" in token or "," in token or ";" in token)
        significant_length = len(self.current_thought) > 20  # Lower threshold for more frequent updates
        
        if sentence_end or significant_length:
            # Clean the thought text
            clean_thought = clean_ansi_codes(self.current_thought)
            
            if clean_thought:  # Only send if there's meaningful content
                if self.thinking_mode == "thinking":
                    await self.websocket.send(json.dumps({
                        "type": "reasoning_step", 
                        "content": clean_thought
                    }))
                elif self.thinking_mode == "action":
                    await self.websocket.send(json.dumps({
                        "type": "action_step", 
                        "content": clean_thought
                    }))
                elif self.thinking_mode == "final":
                    await self.websocket.send(json.dumps({
                        "type": "reasoning_step", 
                        "content": clean_thought
                    }))
                
                self.thought_count += 1
                # Reset current thought to avoid duplicates
                self.current_thought = ""
                
                # Shorter delay for more continuous feel
                await asyncio.sleep(0.3)
    
    async def on_tool_start(self, serialized, input_str, **kwargs):
        """Clean tool inputs and send proper commands."""
        # Clean up any JSON formatting if present in the input
        clean_input = input_str
        
        # Try multiple methods to extract the command
        if isinstance(input_str, str):
            # Method 1: If it's a JSON string with action_input
            if input_str.strip().startswith('{') and '"action_input"' in input_str:
                try:
                    action_data = json.loads(input_str)
                    if "action_input" in action_data:
                        clean_input = action_data["action_input"]
                except:
                    pass
            
            # Method 2: Simple regex extraction
            elif '"action_input"' in input_str:
                match = re.search(r'"action_input":\s*"([^"]+)"', input_str)
                if match:
                    clean_input = match.group(1).replace('\\"', '"')
        
        # Avoid sending duplicate commands
        if clean_input != self.last_command:
            self.last_command = clean_input
            
            # Send the clean command to frontend
            await self.websocket.send(json.dumps({
                "type": "action_step",
                "content": f"Executing: {clean_input}"
            }))
            
            # Send the actual command to display in terminal
            await self.websocket.send(json.dumps({
                "type": "command",
                "content": clean_input
            }))
    
    async def on_tool_end(self, output, **kwargs):
        await self.websocket.send(json.dumps({
            "type": "reasoning_step",
            "content": "Analyzing results..."
        }))
        await self.websocket.send(json.dumps({
            "type": "output",
            "content": output
        }))
    
    async def on_agent_action(self, action, **kwargs):
        """Handle agent actions, ensuring commands are properly displayed."""
        # First, notify about the tool being used
        await self.websocket.send(json.dumps({
            "type": "action_step",
            "content": f"Using tool: {action.tool}"
        }))
        
        # If this is a terminal action, extract and send the actual command
        if action.tool == "terminal" and hasattr(action, "tool_input"):
            # Extract the raw command
            command = action.tool_input
            
            # Clean up any JSON formatting if present
            if isinstance(command, str) and command.strip().startswith('{'):
                try:
                    cmd_data = json.loads(command)
                    if "action_input" in cmd_data:
                        command = cmd_data["action_input"]
                except:
                    # If JSON parsing fails, keep original
                    pass
            
            # Avoid sending duplicate commands
            if command != self.last_command:
                self.last_command = command
                
                # Send as both an action step and a command
                await self.websocket.send(json.dumps({
                    "type": "action_step",
                    "content": f"Executing: {command}"
                }))
                
                await self.websocket.send(json.dumps({
                    "type": "command",
                    "content": command
                }))

    def get_llm_tokens(self):
        return self.token_buffer.getvalue()

# --- Parse Agent Thinking Function ---
async def parse_verbose_output(line, websocket):
    # Clean the line
    clean_line = clean_ansi_codes(line)
    
    # Pattern matching for different types of thinking steps
    thought_match = re.search(r'Thought:(.+?)(?=\n|$)', clean_line)
    action_match = re.search(r'Action:(.+?)(?=\n|$)', clean_line)
    final_match = re.search(r'Final Answer:(.+?)(?=\n|$)', clean_line)
    
    if "Entering new AgentExecutor chain" in clean_line:
        await websocket.send(json.dumps({
            "type": "thinking_step",
            "content": "Starting to process your request..."
        }))
        # Add delay
        await asyncio.sleep(0.5)
    elif thought_match:
        thought_content = thought_match.group(1).strip()
        await websocket.send(json.dumps({
            "type": "reasoning_step",
            "content": thought_content
        }))
        # Add delay
        await asyncio.sleep(0.5)
    elif action_match:
        action_content = action_match.group(1).strip()
        await websocket.send(json.dumps({
            "type": "action_step",
            "content": f"Taking action: {action_content}"
        }))
        # Add delay
        await asyncio.sleep(0.5)
    elif final_match:
        final_content = final_match.group(1).strip()
        await websocket.send(json.dumps({
            "type": "reasoning_step",
            "content": f"Conclusion: {final_content}"
        }))
        # Add delay
        await asyncio.sleep(0.5)
    elif "Observation:" in clean_line:
        await websocket.send(json.dumps({
            "type": "reasoning_step",
            "content": "Observing results..."
        }))
        # Add delay
        await asyncio.sleep(0.5)

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
        callbacks=[callback_handler],
        max_iterations=75,  # Increase time limit by 5x (default is 15)
        early_stopping_method="generate"  # Ensures agent can decide to stop early if needed
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
            
            # Process captured stdout with a buffer for multi-line JSON detection
            buffer = ""
            in_json_block = False
            
            for line in verbose_output.splitlines():
                # Add to buffer if possible start of JSON
                if line.strip().startswith('{') and ('"action"' in line or '"action_input"' in line):
                    buffer = line
                    in_json_block = True
                    continue
                    
                # Continue building buffer if in JSON block
                elif in_json_block:
                    buffer += line
                    
                    # Check if buffer is complete JSON
                    if line.strip().endswith('}'):
                        in_json_block = False
                        # Skip the entire buffered JSON
                        buffer = ""
                        continue
                    else:
                        continue
                
                # Skip filtered lines
                if should_filter_verbose_line(line):
                    continue
                
                # Additional check for multi-line JSON blocks
                if line.strip().startswith('{') and not line.strip().endswith('}'):
                    # This could be the start of a JSON block, skip until we find the end
                    continue
                
                if line.strip():  # Skip empty lines
                    # Parse thinking steps from verbose output
                    await parse_verbose_output(line, websocket)
                    
                    # Add deliberate delay between lines for smoother animation
                    await asyncio.sleep(0.5)
                    
                    # Only send non-filtered verbose output
                    if not should_filter_verbose_line(line):
                        await websocket.send(json.dumps({
                            "type": "verbose",
                            "content": line
                        }))
            
            # Explicitly send a delay message before sending final result
            # to ensure all thinking steps are complete
            await websocket.send(json.dumps({
                "type": "thinking_step",
                "content": "Preparing final response..."
            }))
            
            # Add a slightly longer delay to ensure thinking UI is updated
            await asyncio.sleep(1.0)
            
            # Tell frontend we're keeping thinking state visible
            # (instead of clearing it)
            await websocket.send(json.dumps({
                "type": "thinking_step",
                "content": "Processing complete. Here's the result:"
            }))
            
            # Add a slightly longer delay 
            await asyncio.sleep(0.5)
            
            # Don't clear thinking state completely
            # Just mark it as no longer actively thinking
            await websocket.send(json.dumps({
                "type": "clear_thinking",
                "content": "keep"  # Signal to keep thoughts visible
            }))
            
            # Format code blocks properly in the result
            formatted_result = result
            if '```' not in result:
                # If the result might contain code but is not already in a code block
                code_indicators = ['function', 'class', 'const', 'let', 'var', 'console.log', ';', 'if (', 'for (']
                
                has_code = any(indicator in result for indicator in code_indicators)
                
                if has_code:
                    # If it contains code, wrap it in a code block with appropriate language
                    lang = "typescript" if ".ts" in message else "javascript"
                    formatted_result = f"```{lang}\n{result}\n```"
                else:
                    # For non-code results, still wrap them in markdown for better formatting
                    formatted_result = result
            
            # Send final result 
            await websocket.send(json.dumps({
                "type": "result",
                "content": formatted_result
            }))
            
        except Exception as e:
            # Also clear thinking state for errors
            await websocket.send(json.dumps({
                "type": "thinking_step",
                "content": "Error occurred..."
            }))
            
            # Add a small delay before clearing thinking state
            await asyncio.sleep(0.3)
            
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