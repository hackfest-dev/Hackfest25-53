#!/usr/bin/env python3
"""
backend.py – Interactive multi-agent system with mem0 memory integration.
Each query is timestamped, the past 30 days of relevant memories are fetched and shown,
and the custom prompt is appended to each agent’s original prompt.
"""

import asyncio
import os
import inspect
import logging
from datetime import datetime, timedelta

from dotenv import load_dotenv
from autogen_agentchat.ui import Console
from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_agentchat.teams import MagenticOneGroupChat
from autogen_ext.agents.web_surfer import MultimodalWebSurfer
from autogen_ext.agents.file_surfer import FileSurfer
from autogen_ext.agents.magentic_one import MagenticOneCoderAgent
from autogen_agentchat.agents import CodeExecutorAgent
from autogen_ext.code_executors.local import LocalCommandLineCodeExecutor
from mem0 import Memory

# ----------------------------------------------------------------------------
# Load environment variables and configure logging
# ----------------------------------------------------------------------------
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

logging.basicConfig(level=logging.INFO)
logging.getLogger("chromadb").setLevel(logging.WARNING)

# ----------------------------------------------------------------------------
# Custom prompt template (this will be appended to each agent’s prompt)
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
memory = Memory.from_config(MEMORY_CONFIG)

# ----------------------------------------------------------------------------
# Memory helper functions
# ----------------------------------------------------------------------------
def add_timestamped_memory(content: str, user_id: str = "default") -> None:
    """Add a memory with a timestamp prefix."""
    timestamp = datetime.now().strftime("%A, %Y-%m-%d %H:%M:%S")
    memory.add(
        messages=[{"role": "system", "content": f"[{timestamp}] {content}"}],
        user_id=user_id
    )

def get_relevant_memories(query: str, user_id: str) -> str:
    """Retrieve up to three memories from the past 30 days relevant to the query for the specified user."""
    one_month_ago = datetime.now() - timedelta(days=30)
    # Define the filter using $and to combine conditions
    filters = {
        "$and": [
            {"created_at": {"gte": str(one_month_ago.date())}},
            {"user_id": user_id}  # Filter by user_id inside the $and block
        ]
    }
    try:
        # Call memory.search WITHOUT the separate user_id argument,
        # as it's already handled within the filters dictionary.
        results = memory.search(
            query=query,
            filters=filters,
            limit=3
        )
        # Process and return results
        return "\n".join(f"- {m['memory']}" for m in results.get("results", [])) # Safer access to results
    except Exception as e:
        logging.error(f"Error during memory search for user '{user_id}': {e}")
        logging.debug(f"Search details - Query: '{query}', Filters: {filters}")
        return "[Error retrieving memories]" # Indicate an error occurred




# ----------------------------------------------------------------------------
# create_agent helper function
# ----------------------------------------------------------------------------
def create_agent(agent_class, name, system_message="", **kwargs):
    """
    Helper to create an agent while appending CUSTOM_PROMPT to its system message.
    If the agent’s __init__ accepts 'system_message', we pass it;
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
        animate_actions = True, 
        system_message="I specialize in web browsing and online research.\n", 
    )
    file_surfer = create_agent(
        FileSurfer,
        "FileSurfer",
        base_path=os.getcwd(),
        system_message="I manage local file operations and content analysis.\n"
    )
    coder = create_agent(
        MagenticOneCoderAgent,
        "Coder",
        system_message="I write and debug code in multiple programming languages.\n"
    )

    executor = LocalCommandLineCodeExecutor(timeout=120)
    terminal = CodeExecutorAgent(name="ComputerTerminal", code_executor=executor)

    # Form the multi-agent team
    team = MagenticOneGroupChat(
        [web_surfer, file_surfer, coder, terminal],
        model_client=model_client
    )

    print("🤖 Multi-Agent System Ready. Type 'exit' to quit.")
    user_id = input("Enter your user ID: ").strip() or "default"

    try:
        while True:
            raw_query = input("🗨️ > ").strip()
            if raw_query.lower() in {"exit", "quit"}:
                break

            current_time = datetime.now().strftime("%A, %Y-%m-%d %H:%M:%S")
            memories_str = get_relevant_memories(raw_query, user_id)

            print(f"\n🕒 Current Time: {current_time}")
            if memories_str:
                print(f"🔍 Relevant Memories:\n{memories_str}")
            else:
                print("🔍 No relevant memories found")

            enhanced_task = f"[{current_time}]\nUser Query: {raw_query}"

            try:
                # Run the team in streaming mode (Console prints the output live)
                await Console(team.run_stream(task=enhanced_task))
                add_timestamped_memory(raw_query, user_id)
            except Exception as e:
                print(f"❌ Error processing task: {e}")

            print("\n--- Task completed. What's next? ---\n")
    finally:
        # Clean up resources
        await web_surfer.close()
        print("🧹 Cleanup complete. Goodbye!")

if __name__ == "__main__":
    asyncio.run(main())
