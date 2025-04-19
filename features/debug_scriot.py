#!/usr/bin/env python3
import os
import logging
from datetime import datetime
from dotenv import load_dotenv
from openai import OpenAI
from mem0 import Memory

# --- Configuration ---
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
logging.basicConfig(level=logging.DEBUG) # Set to DEBUG for more verbose logs
logging.getLogger("httpx").setLevel(logging.WARNING) # Quieten HTTP logs if needed
logging.getLogger("chromadb").setLevel(logging.WARNING)

# --- Initialization ---
try:
    # Ensure API key is available
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY not found in environment variables.")

    # Initialize OpenAI client (needed by Mem0 default config)
    openai_client = OpenAI(api_key=OPENAI_API_KEY)

    # Initialize Mem0 with a specific user focus
    # Using ChromaDB persistence as in your main script
    memory_config = {
        "vector_store": {
            "provider": "chroma",
            "config": {
                "collection_name": "debug_memory_test", # Use a separate collection
                "path": "./chroma_db_debug",
            },
        },
        # Optionally configure the underlying LLM if needed, else defaults work
        # "llm": {"provider": "openai", "config": {"model": "gpt-4o-mini"}}
    }
    memory = Memory.from_config(memory_config)

    logging.info("Mem0 initialized successfully for debugging.")

except Exception as e:
    logging.error(f"Initialization failed: {e}")
    exit(1)

# --- Debug Functions ---
def print_memory_results(label: str, search_results: dict):
    """Helper to print search results clearly."""
    print("-" * 20)
    print(f"DEBUG: {label}")
    if search_results and "results" in search_results:
        memories = search_results["results"]
        print(f"Found {len(memories)} memories:")
        for i, mem in enumerate(memories, 1):
            print(f"  {i}. ID: {mem.get('id', 'N/A')}, Score: {mem.get('score', 'N/A'):.4f}, Memory: '{mem.get('memory', '')}'")
            # print(f"     Metadata: {mem.get('metadata', {})}") # Uncomment for more detail
    else:
        print("No memories found or error in results structure.")
        print(f"Raw results: {search_results}")
    print("-" * 20)

# --- Test Operations ---
test_user_id = "debug_user_alpha"
timestamp = datetime.now().strftime("%A, %Y-%m-%d %H:%M:%S")

# 1. Add initial memory
print(f"\n>>> 1. ADDING initial memory for user: {test_user_id}")
initial_content = f"Penguins live in the Southern Hemisphere. User asked about this on {timestamp}."
try:
    add_result = memory.add(
        messages=[{"role": "user", "content": initial_content}],
        user_id=test_user_id
    )
    logging.debug(f"Add operation result: {add_result}")
    print(f"Memory added: '{initial_content}'")
except Exception as e:
    logging.error(f"Failed to add initial memory: {e}")

# 2. Search for the added memory
print(f"\n>>> 2. SEARCHING for 'penguin' memory for user: {test_user_id}")
query1 = "penguin habitats"
try:
    search_results1 = memory.search(query=query1, user_id=test_user_id, limit=3)
    print_memory_results(f"Search results for '{query1}'", search_results1)
except Exception as e:
    logging.error(f"Search 1 failed: {e}")

# 3. Add another memory
print(f"\n>>> 3. ADDING second memory for user: {test_user_id}")
second_content = f"User also likes polar bears. Mentioned on {timestamp}."
try:
    add_result_2 = memory.add(
        messages=[{"role": "user", "content": second_content}],
        user_id=test_user_id
    )
    logging.debug(f"Second add operation result: {add_result_2}")
    print(f"Memory added: '{second_content}'")
except Exception as e:
    logging.error(f"Failed to add second memory: {e}")

# 4. Search again, potentially retrieving both
print(f"\n>>> 4. SEARCHING for 'animal' related memory for user: {test_user_id}")
query2 = "animal preferences"
try:
    search_results2 = memory.search(query=query2, user_id=test_user_id, limit=5)
    print_memory_results(f"Search results for '{query2}'", search_results2)
except Exception as e:
    logging.error(f"Search 2 failed: {e}")

# 5. Search with a filter (Example: using the date from the first memory)
print(f"\n>>> 5. SEARCHING with date filter for user: {test_user_id}")
query3 = "hemisphere"
search_date = datetime.now().date() # Search for today's date
date_filter = {"created_at": {"gte": str(search_date)}}
try:
    # Note: Filters here might need the $and structure if combined with implicit user_id
    # Depending on how mem0 handles combining arg user_id and explicit filters.
    # Let's try passing JUST the date filter first.
    search_results3 = memory.search(
        query=query3,
        user_id=test_user_id,
        filters=date_filter,
        limit=3
    )
    print_memory_results(f"Search results for '{query3}' with filter {date_filter}", search_results3)
except Exception as e:
    logging.error(f"Search 3 with filter failed: {e}")
    # If the above fails with the single-operator error, try the $and structure:
    logging.info("Trying search with $and filter structure...")
    and_filter = {"$and": [date_filter]} # Wrap the date filter in $and
    try:
        search_results4 = memory.search(
            query=query3,
            user_id=test_user_id,
            filters=and_filter,
            limit=3
        )
        print_memory_results(f"Search results for '{query3}' with $and filter {and_filter}", search_results4)
    except Exception as e2:
         logging.error(f"Search 4 with $and filter also failed: {e2}")


print("\n>>> Debug script finished.")

