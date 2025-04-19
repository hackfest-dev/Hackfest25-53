from openai import OpenAI
from mem0 import Memory
from dotenv import load_dotenv
import os
import logging
from autogen import ConversableAgent, GroupChat, GroupChatManager
from autogen.coding import LocalCommandLineCodeExecutor

# Reduce ChromaDB logs
logging.getLogger("chromadb").setLevel(logging.ERROR)

# Load environment variables
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")

# Initialize OpenAI client
openai_client = OpenAI()

# Persistent memory setup
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

# Command-line code executor
executor = LocalCommandLineCodeExecutor(
    timeout=120,
    work_dir="./cli_workspace"
)

# Memory helper functions
def get_relevant_memories(user_id, query, limit=3):
    relevant = memory.search(query=query, user_id=user_id, limit=limit)
    return [entry['memory'] for entry in relevant["results"]]

def add_memory(messages, user_id):
    memory.add(messages, user_id=user_id)

def get_all_memories(user_id):
    all_memories = memory.get_all(user_id=user_id)
    for mem in all_memories['results']:
        print(mem)
    return [mem['memory'] for mem in all_memories['results']]

# Define agents
def make_env_agent(user_id):
    return ConversableAgent(
        name="EnvSetupAgent",
        system_message=(
            "You are an expert in setting up development environments via CLI. "
            "Always check user memory for preferences (Python version, venv, npm, git, etc). "
            "Explain your plan, then generate shell commands. "
            "After each step, log what was done and update memory."
        ),
        llm_config={
            "config_list": [
                {"model": "gpt-4o-mini", "api_key": api_key}
            ]
        },
        code_execution_config={"executor": executor},
        human_input_mode="NEVER"
    )

def make_manager_agent(user_id):
    return ConversableAgent(
        name="ManagerAgent",
        system_message=(
            "You are a project manager AI. "
            "Coordinate with the EnvSetupAgent and ensure user preferences are respected. "
            "Summarize what was done and update memory with user choices (e.g., Python version, npm packages, git init, etc). "
            "Ask clarifying questions if needed."
        ),
        llm_config={
            "config_list": [
                {"model": "gpt-4o-mini", "api_key": api_key}
            ]
        },
        human_input_mode="NEVER"
    )

def make_human_agent(user_id):
    return ConversableAgent(
        name="UserProxy",
        human_input_mode="TERMINATE",  # Prompts user only when needed
        max_consecutive_auto_reply=3,  # Number of auto replies before asking user
    )


def main():
    user_id = input("Enter your user ID or name: ").strip()
    get_all_memories(user_id=user_id)
    print(f"Multi-agent CLI Assistant as '{user_id}' (type 'exit' to quit, 'view memories' to see all your memories)")
    env_agent = make_env_agent(user_id)
    manager_agent = make_manager_agent(user_id)
    human_agent = make_human_agent(user_id)

    initial_message = {"role": "user", "content": "Hello, I'm starting a new session."}
    group_chat = GroupChat(
        agents=[manager_agent, env_agent, human_agent],
        messages=[initial_message],
        max_round=10,
        send_introductions=True,
        speaker_selection_method="auto"
    )
    group_chat_manager = GroupChatManager(
        groupchat=group_chat,
        llm_config={"config_list": [{"model": "gpt-4o-mini", "api_key": api_key}]}
    )

    while True:
        user_input = input("You: ").strip()
        if user_input.lower() == 'exit':
            print("Goodbye!")
            break
        elif user_input.lower() == 'view memories':
            memories = get_all_memories(user_id)
            print(f"Total memories for {user_id}: {len(memories)}")
            for i, mem in enumerate(memories, 1):
                print(f"{i}. {mem}")
            continue

        # build memory context
        relevant_memories = get_relevant_memories(user_id, user_input)
        memory_context = (
            "\n".join(f"- {m}" for m in relevant_memories)
            if relevant_memories else "No memories yet."
        )

        # prime the chat with your new request
        new_message = {
            "role": "user",
            "content": f"User Memories:\n{memory_context}\n\nUser request: {user_input}"
        }
        print(new_message)
        group_chat.messages = [initial_message, new_message]

        # run the multi-agent loop, re-prompting you whenever UserProxy needs input
        while True:
            success, termination_reason = group_chat_manager.run_chat(
                messages=group_chat.messages,
                sender=manager_agent,
                config=group_chat
            )

            if success:
                # finished: break out to print/store result
                break

            # not finished == human agent needs input
            # grab the last assistant message as the prompt
            prompt = group_chat.messages[-1]["content"]
            user_reply = input(f"{prompt}\nYou: ").strip()
            # feed it back into the conversation
            group_chat.messages.append({"role": "user", "content": user_reply})

        # extract and display the final assistant reply
        last_assistant_msg = next(
            (m["content"] for m in reversed(group_chat.messages) if m["role"] == "assistant"),
            "No assistant response."
        )
        print(f"AI: {last_assistant_msg}")

        # store to memory
        messages = [
            {"role": "system", "content": f"User Memories:\n{memory_context}"},
            {"role": "user", "content": user_input},
            {"role": "assistant", "content": last_assistant_msg}
        ]
        add_memory(messages, user_id)

# If this script is run directly, start the main loop
if __name__ == "__main__":
    main()