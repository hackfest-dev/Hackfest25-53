import logging
import os
from dotenv import load_dotenv
from openai import OpenAI
from mem0 import Memory


load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")
openai_client = OpenAI()

config = {
    "vector_store": {
        "provider": "chroma",
        "config": {
            "collection_name": "cli_multiagent_memory",
            "path": "./chroma_db",
        },
    }
}

memory = Memory.from_config(config)

# Reduce ChromaDB logs
logging.getLogger("chromadb").setLevel(logging.ERROR)


def get_config():
    return openai_client, memory