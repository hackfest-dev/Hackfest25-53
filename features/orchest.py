import asyncio
import os

from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_ext.teams.magentic_one import MagenticOne
from autogen_agentchat.ui import Console
from mem0 import MemoryClient

# --- Environment Setup ---
API_KEY = os.getenv("OPENAI_API_KEY")
MEM0_API_KEY = os.getenv("MEM0_API_KEY")  # Set this in your environment

# --- Initialize Mem0 Memory Client ---
memory = MemoryClient(api_key=MEM0_API_KEY)

# --- MagenticOne with Memory Integration ---
class MagenticOneWithMemory(MagenticOne):
    def __init__(self, client, user_id="default_user"):
        super().__init__(client=client)
        self.user_id = user_id

    async def run_stream(self, task: str):
        # 1. Retrieve relevant memories for the task
        relevant_memories = memory.search(query=task, user_id=self.user_id, limit=3)
        # Each memory is a dict with a "memory" key
        memories_str = "\n".join(f"- {m['memory']}" for m in relevant_memories)

        # 2. Prepend memories to the task prompt
        task_with_memory = (
            f"User Memories:\n{memories_str if memories_str else 'No relevant memories.'}\n\nTask: {task}"
        )

        # 3. Run the original MagenticOne pipeline with memory-augmented prompt
        result = await super().run_stream(task=task_with_memory)

        # 4. Store the conversation (task and result) as new memory
        conversation = [
            {"role": "user", "content": task},
            {"role": "assistant", "content": result}
        ]
        memory.add(conversation, user_id=self.user_id)

        return result

# --- Main Async Entrypoint ---
async def main():
    client = OpenAIChatCompletionClient(model="gpt-4o-mini", api_key=API_KEY)
    m1 = MagenticOneWithMemory(client=client, user_id="user123")
    task = input("Enter your task: ").strip()
    result = await Console(m1.run_stream(task=task))
    print(result)

if __name__ == "__main__":
    asyncio.run(main())
