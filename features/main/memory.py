from openai import OpenAI
from mem0 import Memory
from dotenv import load_dotenv
import os
import logging
import uuid
import pytz
from datetime import datetime
import hashlib
import inspect

# Optional: Reduce ChromaDB logs
logging.getLogger("chromadb").setLevel(logging.ERROR)

# Load environment variables
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")

# Initialize OpenAI client (API key is read from environment)
openai_client = OpenAI()

# ----------------------------------------------------------------------------
# Custom prompt template (this will be appended to each agent's prompt)
# ----------------------------------------------------------------------------
CUSTOM_PROMPT = """## System Context
- Current Time: {timestamp}
- Relevant User Memories:
{memories}
------------------------
"""
global model_client

# Extend Memory class to add timestamped entries and custom categorization
class EnhancedMemory(Memory):
    def _create_memory(self, data, existing_embeddings, metadata=None):
        logging.debug(f"Creating memory with {data=}")
        
        # Add timestamp and day information
        now = datetime.now(pytz.timezone("US/Pacific"))
        day_of_week = now.strftime("%A")
        timestamp = now.isoformat()
        
        # Prepend timestamp and day to the content
        timestamped_data = f"[{day_of_week}, {timestamp}] {data}"
        
        if data in existing_embeddings:
            # We need to re-embed with the timestamped data
            embeddings = self.embedding_model.embed(timestamped_data, memory_action="add")
        else:
            embeddings = self.embedding_model.embed(timestamped_data, memory_action="add")
        
        memory_id = str(uuid.uuid4())
        metadata = metadata or {}
        metadata["data"] = timestamped_data
        metadata["original_data"] = data  # Store the original data too
        metadata["hash"] = hashlib.md5(timestamped_data.encode()).hexdigest()
        metadata["created_at"] = timestamp
        
        # Store time data as flat keys instead of nested dictionary
        metadata["time_day"] = day_of_week
        metadata["time_timestamp"] = timestamp
        
        # Add date and time in more structured formats for easier querying
        metadata["time_date"] = now.strftime("%Y-%m-%d")
        metadata["time_hour"] = now.hour
        metadata["time_minute"] = now.minute

        self.vector_store.insert(
            vectors=[embeddings],
            ids=[memory_id],
            payloads=[metadata],
        )
        self.db.add_history(memory_id, None, timestamped_data, "ADD", created_at=metadata["created_at"])
        return memory_id        

    def save_categorized_memory(
        self,
        messages,
        category,
        user_id=None,
        agent_id=None,
        run_id=None,
        metadata=None,
        filters=None,
    ):
        """
        Create a new memory that only includes information relevant to a specific category.
        
        Args:
            messages (str or List[Dict[str, str]]): Messages to filter and store in the memory.
            category (str): Description of the category to filter for (e.g., "user coding development environment")
            user_id (str, optional): ID of the user creating the memory. Defaults to None.
            agent_id (str, optional): ID of the agent creating the memory. Defaults to None.
            run_id (str, optional): ID of the run creating the memory. Defaults to None.
            metadata (dict, optional): Additional metadata to store with the memory. Defaults to None.
            filters (dict, optional): Filters to apply to the search. Defaults to None.
            
        Returns:
            dict: A dictionary containing the result of the memory addition operation.
        """
        if metadata is None:
            metadata = {}
        
        # Add category to metadata
        metadata["category"] = category
        
        # Create a system prompt to filter content based on the category
        if isinstance(messages, str):
            parsed_content = messages
        elif isinstance(messages, list) and all(isinstance(msg, dict) for msg in messages):
            parsed_content = "\n".join([f"{msg['role']}: {msg['content']}" for msg in messages if 'content' in msg])
        else:
            parsed_content = str(messages)
        
        # Create a prompt that asks the LLM to extract only information relevant to the category
        category_filter_prompt = [
            {"role": "system", "content": f"Extract only the information related to the following category: {category}. If there is no relevant information, respond with 'No relevant information found.'"},
            {"role": "user", "content": f"Input:\n{parsed_content}"}
        ]
        
        # Use OpenAI to filter the content
        filtered_response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=category_filter_prompt
        )
        
        filtered_content = filtered_response.choices[0].message.content
        
        if "No relevant information found" in filtered_content:
            return {"results": [], "message": "No relevant information found for the specified category."}
        
        # Add the filtered content as a new memory with category metadata
        if isinstance(messages, list):
            categorized_message = [{"role": "user", "content": filtered_content}]
        else:
            categorized_message = filtered_content
        
        # Use the regular add method with our filtered content and enhanced metadata
        return self.add(
            messages=categorized_message,
            user_id=user_id,
            agent_id=agent_id,
            run_id=run_id,
            metadata=metadata,
            filters=filters
        )
        
    def search_by_category(self, category, query=None, user_id=None, agent_id=None, run_id=None, limit=100):
        """
        Search for memories by category.
        
        Args:
            category (str): Category to search for.
            query (str, optional): Additional query to search for within the category. Defaults to None.
            user_id (str, optional): ID of the user to search for. Defaults to None.
            agent_id (str, optional): ID of the agent to search for. Defaults to None.
            run_id (str, optional): ID of the run to search for. Defaults to None.
            limit (int, optional): Limit the number of results. Defaults to 100.
            
        Returns:
            list: List of search results.
        """
        filters = {}
        if user_id:
            filters["user_id"] = user_id
        if agent_id:
            filters["agent_id"] = agent_id
        if run_id:
            filters["run_id"] = run_id
            
        # Add category filter
        filters["category"] = category
        
        if query:
            # If there's a query, use the search method
            return self.search(query=query, filters=filters, limit=limit)
        else:
            # If no query, get all memories with this category
            memories = self.vector_store.list(filters=filters, limit=limit)[0]
            
            # Format results similar to search results
            results = []
            for mem in memories:
                memory_item = {
                    "id": mem.id,
                    "memory": mem.payload["data"],
                    "created_at": mem.payload.get("created_at"),
                    "updated_at": mem.payload.get("updated_at"),
                }
                
                # Add metadata if available
                excluded_keys = {"user_id", "agent_id", "run_id", "hash", "data", "created_at", "updated_at", "id"}
                metadata = {k: v for k, v in mem.payload.items() if k not in excluded_keys}
                if metadata:
                    memory_item["metadata"] = metadata
                
                results.append(memory_item)
            
            return {"results": results}

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

memory = EnhancedMemory.from_config(config)

def view_memories(user_id="default_user"):
    all_memories = memory.get_all(user_id=user_id)
    print(f"Total memories for {user_id}: {len(all_memories['results'])}")
    for i, mem in enumerate(all_memories['results'], 1):
        print(f"{i}. {mem['memory']}")

def view_category_memories(category, user_id="default_user"):
    categorized_memories = memory.search_by_category(category=category, user_id=user_id)
    print(f"Total '{category}' memories for {user_id}: {len(categorized_memories['results'])}")
    for i, mem in enumerate(categorized_memories['results'], 1):
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
    
    # Check if this might contain information about development environment
    if any(keyword in message.lower() for keyword in ["code", "develop", "program", "environment", "setup", "tool", "ide"]):
        memory.save_categorized_memory(
            messages=messages,
            category="user coding development environment",
            user_id=user_id
        )
    
    return assistant_response

# ----------------------------------------------------------------------------
# Memory helper functions
# ----------------------------------------------------------------------------
def get_relevant_memories(query: str, user_id: str = "default_user") -> str:
    """Get relevant memories for a query from the memory store."""
    relevant_memories = memory.search(query=query, user_id=user_id, limit=3)
    memories_str = "\n".join(f"- {entry['memory']}" for entry in relevant_memories["results"])
    return memories_str

def get_category_memories(category: str, user_id: str = "default_user") -> str:
    """Get memories from a specific category."""
    categorized_memories = memory.search_by_category(category=category, user_id=user_id)
    memories_str = "\n".join(f"- {entry['memory']}" for entry in categorized_memories["results"])
    return memories_str

def add_timestamped_memory(messages, user_id: str = "default_user"):
    """Add a new memory entry with timestamp."""
    if isinstance(messages, str):
        messages = [{"role": "user", "content": messages}]
    memory.add(messages=messages, user_id=user_id)
    
    # Check if this might contain information about development environment
    user_message = next((msg["content"] for msg in messages if msg["role"] == "user"), "")
    if any(keyword in user_message.lower() for keyword in ["code", "develop", "program", "environment", "setup", "tool", "ide"]):
        memory.save_categorized_memory(
            messages=messages,
            category="user coding development environment",
            user_id=user_id
        )

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


# def main():
#     user_id = input("Enter your user ID or name: ").strip()
#     print(f"Chat with AI as '{user_id}' (type 'exit' to quit, 'view memories' to see all your memories, 'view category [name]' to see category-specific memories)")
    
#     while True:
#         user_input = input("You: ").strip()
        
#         if user_input.lower() == 'exit':
#             print("Goodbye!")
#             break
        
#         elif user_input.lower() == 'view memories':
#             view_memories(user_id=user_id)
#             continue
        
#         elif user_input.lower().startswith('view category'):
#             parts = user_input.split(' ', 2)
#             if len(parts) == 3:
#                 category = parts[2]
#                 view_category_memories(category=category, user_id=user_id)
#             else:
#                 print("Please specify a category name, e.g., 'view category coding environment'")
#             continue
        
#         elif user_input.lower().startswith('save to category'):
#             parts = user_input.split(' ', 3)
#             if len(parts) >= 4:
#                 category = parts[2]
#                 message = parts[3]
#                 memory.save_categorized_memory(
#                     messages=[{"role": "user", "content": message}],
#                     category=category,
#                     user_id=user_id
#                 )
#                 print(f"Saved to category '{category}'")
#             else:
#                 print("Please provide both category and message, e.g., 'save to category coding My IDE is VS Code'")
#             continue
        
#         print(f"AI: {chat_with_memories(user_input, user_id=user_id)}")

# if __name__ == "__main__":
#     main()