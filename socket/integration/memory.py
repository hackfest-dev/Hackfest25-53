from openai import OpenAI
from mem0 import Memory
from dotenv import load_dotenv
import os
import logging

# Optional: Reduce ChromaDB logs
logging.getLogger("chromadb").setLevel(logging.ERROR)

# Load environment variables
load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")

# Initialize OpenAI client (API key is read from environment)
openai_client = OpenAI()

# Configure persistent memory with ChromaDB
config = {
    "vector_store": {
        "provider": "chroma",
        "config": {
            "collection_name": "ai_friend_chatbot_memory",
            "path": "./chroma_db",  # Directory for persistent storage
        },
    }
}
memory = Memory.from_config(config)


def view_memories(user_id="default_user"):
    all_memories = memory.get_all(user_id=user_id)
    print(f"Total memories for {user_id}: {len(all_memories['results'])}")
    for i, mem in enumerate(all_memories['results'], 1):
        print(f"{i}. {mem['memory']}")

def chat_with_memories(message: str, user_id: str = "default_user") -> str:
    # Retrieve relevant memories
    relevant_memories = memory.search(query=message, user_id=user_id, limit=3)
    memories_str = "\n".join(f"- {entry['memory']}" for entry in relevant_memories["results"])

    # Generate Assistant response
    system_prompt = (
        "You are a helpful AI. Answer the question based on query and memories.\n"
        f"User Memories:\n{memories_str if memories_str else 'No memories yet.'}"
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": message}
    ]
    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",  # Change model if needed
        messages=messages
    )
    assistant_response = response.choices[0].message.content

    # Create new memories from the conversation
    messages.append({"role": "assistant", "content": assistant_response})
    memory.add(messages, user_id=user_id)

    return assistant_response

def main():
    user_id = input("Enter your user ID or name: ").strip()
    print(f"Chat with AI as '{user_id}' (type 'exit' to quit, 'view memories' to see all your memories)")
    while True:
        user_input = input("You: ").strip()
        if user_input.lower() == 'exit':
            print("Goodbye!")
            break
        elif user_input.lower() == 'view memories':
            view_memories(user_id=user_id)
            continue
        print(f"AI: {chat_with_memories(user_input, user_id=user_id)}")

if __name__ == "__main__":
    main()
