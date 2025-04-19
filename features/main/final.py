#!/usr/bin/env python3
"""
backend.py – Interactive multi-agent system with Enhanced Memory integration.
Each query is timestamped, categorized, and relevant memories are fetched and shown.
The custom prompt is appended to each agent's original prompt.
"""
#---------------
#Note: Run from main folder 
#---------------

import asyncio
import os
import logging
from datetime import datetime
import inspect

from dotenv import load_dotenv
from autogen_agentchat.ui import Console
from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_agentchat.teams import MagenticOneGroupChat
from autogen_ext.agents.web_surfer import MultimodalWebSurfer
from autogen_ext.agents.file_surfer import FileSurfer
from autogen_ext.agents.magentic_one import MagenticOneCoderAgent
from autogen_agentchat.agents import CodeExecutorAgent
from autogen_ext.code_executors.local import LocalCommandLineCodeExecutor
from memory import EnhancedMemory, view_category_memories, view_memories, create_agent, get_category_memories, get_relevant_memories, add_timestamped_memory

# ----------------------------------------------------------------------------
# Load environment variables and configure logging
# ----------------------------------------------------------------------------
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

logging.basicConfig(level=logging.INFO)
logging.getLogger("chromadb").setLevel(logging.WARNING)

# ----------------------------------------------------------------------------
# Custom prompt template (this will be appended to each agent's prompt)
# ----------------------------------------------------------------------------

CUSTOM_PROMPT = """## System Context
- Current Time: {timestamp}
- Relevant User Memories:
{memories}
------------------------
"""

# ----------------------------------------------------------------------------
# Memory configuration and initialization (using Chroma as vector store)
# ----------------------------------------------------------------------------
MEMORY_CONFIG = {
    "vector_store": {
        "provider": "chroma",
        "config": {
            "collection_name": "multi_agent_memory",
            "path": "./chroma_db",
        },
    }
}
memory = EnhancedMemory.from_config(MEMORY_CONFIG)

# ----------------------------------------------------------------------------
# create_agent helper function
# ----------------------------------------------------------------------------
def create_agent(agent_class, name, system_message="", **kwargs):
    """
    Helper to create an agent while appending CUSTOM_PROMPT to its system message.
    If the agent's __init__ accepts 'system_message', we pass it;
    otherwise, if the instance has the attribute, we update it afterward.
    """
    sig = inspect.signature(agent_class.__init__)
    if "system_message" in sig.parameters:
        kwargs["system_message"] = CUSTOM_PROMPT.format(timestamp="{timestamp}", memories="{memories}") + system_message
    agent = agent_class(name=name, model_client=model_client, **kwargs)
    if "system_message" not in sig.parameters and hasattr(agent, "system_message"):
        agent.system_message = CUSTOM_PROMPT.format(timestamp="{timestamp}", memories="{memories}") + system_message + agent.system_message
    return agent

# ----------------------------------------------------------------------------
# Custom Team class with memory integration
# ----------------------------------------------------------------------------
class MemoryEnhancedGroupChat(MagenticOneGroupChat):
    def __init__(self, agents, model_client, user_id="default", **kwargs):
        super().__init__(agents, model_client, **kwargs)
        self.agents = agents  # Explicitly set the agents attribute
        self.user_id = user_id
        self.conversation_history = []

        
    async def run_stream(self, task, user_id=None):
        # Update memory context in prompts
        user_id = user_id or self.user_id
        current_time = datetime.now().strftime("%A, %Y-%m-%d %H:%M:%S")
        memories_str = get_relevant_memories(task, user_id)
        
        # Update the system messages for all agents
        for agent in self.agents:
            if hasattr(agent, "system_message") and "{timestamp}" in agent.system_message:
                agent.system_message = agent.system_message.format(
                    timestamp=current_time,
                    memories=memories_str or "No relevant memories found."
                )
        
        # Store the task in conversation history
        self.conversation_history = [{"role": "user", "content": task}]
        
        # Run the team conversation
        async for chunk in super().run_stream(task=task):
            # Only consider chunks that have both sender and non-empty content
            if hasattr(chunk, 'sender') and hasattr(chunk, 'content') and chunk.content.strip():
                self.conversation_history.append({
                    "role": chunk.sender,
                    "content": chunk.content
                })
                yield chunk

        
        # Save the conversation to memory
        add_timestamped_memory(self.conversation_history, user_id)

# ========== To Console ======================================================
async def run_team_with_task(team, web_surfer, task):
    """Run the team with a specific task and handle cleanup"""
    try:
        await Console(team.run_stream(task=task))
    except Exception as e:
        print(f"Error executing task: {e}")
    finally:
        # No cleanup here as we'll handle it in the main loop
        pass

# ----------------------------------------------------------------------------
# Main interactive loop
# ----------------------------------------------------------------------------
async def main() -> None:
    global model_client
    model_client = OpenAIChatCompletionClient(model="gpt-4o-mini", api_key=OPENAI_API_KEY)
    
    # Initialize agents
    web_surfer = create_agent(
        MultimodalWebSurfer,
        "WebSurfer",
        headless=False,
        animate_actions=True, 
        system_message="I specialize in web browsing and online research. do not use browser unless the question requires a browser to answer\n", 
    )
    file_surfer = create_agent(
        FileSurfer,
        "FileSurfer",
        # system_message="I manage local file operations and content analysis.\n"
    )
    coder = create_agent(
        MagenticOneCoderAgent,
        "Coder",
        # system_message="I write and debug code in multiple programming languages.\n"
    )

    executor = LocalCommandLineCodeExecutor(timeout=120)
    terminal = CodeExecutorAgent(name="ComputerTerminal", code_executor=executor)

    print("Enhanced Memory Multi-Agent System Ready.")
    print("Special commands:")
    print("  - 'exit': Quit the program")
    print("  - 'view memories': View all stored memories")
    print("  - 'view category [name]': View memories in a specific category")
    print("  - 'save to category [name] [message]': Save a message to a specific category")
    
    user_id = input("Enter your user ID: ").strip() or "default"

    # Form the memory-enhanced multi-agent team
    team = MemoryEnhancedGroupChat(
        [web_surfer, file_surfer, coder, terminal],
        model_client=model_client,
        user_id=user_id
    )

    try:
        while True:
            raw_query = input("🗨️ > ").strip()
            
            if raw_query.lower() in {"exit", "quit"}:
                break
                
            elif raw_query.lower() == "view memories":
                view_memories(user_id=user_id)
                continue
                
            elif raw_query.lower().startswith("view category"):
                parts = raw_query.split(" ", 2)
                if len(parts) == 3:
                    category = parts[2]
                    print(f"Memories in category '{category}':")
                    memories_str = get_category_memories(category, user_id)
                    if memories_str:
                        print("========RELEVANT MEMORIES=======")
                        print(memories_str)
                    else:
                        print(f"No memories found in category '{category}'")
                else:
                    print("Please specify a category name, e.g., 'view category coding_environment'")
                continue
                
            elif raw_query.lower().startswith("save to category"):
                parts = raw_query.split(" ", 3)
                if len(parts) >= 4:
                    category = parts[2]
                    message = parts[3]
                    memory.save_categorized_memory(
                        messages=[{"role": "user", "content": message}],
                        category=category,
                        user_id=user_id
                    )
                    print(f"Saved to category '{category}'")
                else:
                    print("Please provide both category and message, e.g., 'save to category coding_environment My IDE is VS Code'")
                continue

            current_time = datetime.now().strftime("%A, %Y-%m-%d %H:%M:%S")
            memories_str = get_relevant_memories(raw_query, user_id)

            print(f"\n🕒 Current Time: {current_time}")
            if memories_str:
                print(f"🔍 Relevant Memories:\n{memories_str}")
            else:
                print("🔍 No relevant memories found")

            try:
                # Run the team in streaming mode with memory-enhanced prompts
                await Console(team.run_stream(task=raw_query, user_id=user_id))
                # await run_team_with_task(team, web_surfer, user_id=user_id)
            except Exception as e:
                print(f"❌ Error processing task: {e}")

            print("\n--- Task completed. What's next? ---\n")
    finally:
        # Clean up resources
        await web_surfer.close()
        print("🧹 Cleanup complete. Goodbye!")

if __name__ == "__main__":
    asyncio.run(main())