from openai import OpenAI
from mem0 import Memory
from dotenv import load_dotenv
import os
import logging
import subprocess
import webbrowser
from autogen import ConversableAgent, GroupChat, GroupChatManager, register_function
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

# Command-line code executor (for EnvSetupAgent)
executor = LocalCommandLineCodeExecutor(
    timeout=120,
    work_dir="./cli_workspace"
)

# --- Memory helpers ---------------------------------------------------------
def view_memories(user_id="default_user"):
    all_mem = memory.get_all(user_id=user_id)
    print(f"Total memories for {user_id}: {len(all_mem['results'])}")
    for i, entry in enumerate(all_mem['results'], 1):
        print(f"{i}. {entry.get('memory')}")


def add_memory(messages, user_id, memory_category="default"):
    memory.add(
        messages,
        user_id=user_id,
        metadata={"category": memory_category},
        infer=True,
    )
    print(f"🧠 Stored {len(messages)} message(s) under '{memory_category}' category")


def get_relevant_memories(user_id, query, memory_category=None, limit=3):
    response = memory.search(query=query, user_id=user_id, limit=limit*3)
    raw = response.get("results") or []
    if memory_category:
        raw = [r for r in raw if isinstance(r, dict) and r.get("metadata", {}).get("category")==memory_category]
    return [r.get("memory") for r in raw[:limit] if r and r.get("memory")]

# --- BashAgent Tools -------------------------------------------------------
def execute_command(command: str) -> dict:
    """Execute a shell command and return result."""
    try:
        output = subprocess.check_output(command, shell=True, stderr=subprocess.STDOUT, text=True)
        return {"success": True, "command": command, "output": output}
    except subprocess.CalledProcessError as e:
        return {"success": False, "command": command, "output": e.output}


def generate_command(task: str) -> str:
    """Generate a bash command for the given task using OpenAI."""
    prompt = f"Generate a bash command on {os.name} to: {task}. Only return the command itself."
    resp = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}],
    )
    return resp.choices[0].message.content.strip().strip('`')


def open_youtube_video(query: str) -> dict:
    """Open YouTube search results for a query in the browser."""
    url = f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}"
    webbrowser.open(url)
    return {"success": True, "url": url}

# --- Agent definitions -----------------------------------------------------
def make_env_agent(user_id):
    return ConversableAgent(
        name="EnvSetupAgent",
        system_message=(
            "You are an expert in setting up development environments via CLI. "
            "Always consult memory for user preferences. Explain your plan, then generate shell commands."
        ),
        llm_config={"config_list":[{"model":"gpt-4o-mini","api_key":api_key}]},
        code_execution_config={"executor": executor},
        human_input_mode="NEVER",
    )


def make_manager_agent(user_id):
    return ConversableAgent(
        name="ManagerAgent",
        system_message=(
            "You are a project manager AI. Coordinate agents and respect preferences."
        ),
        llm_config={"config_list":[{"model":"gpt-4o-mini","api_key":api_key}]},
        human_input_mode="NEVER",
    )


def make_bash_agent(user_id):
    return ConversableAgent(
        name="BashAgent",
        system_message=(
            "You are BashAgent. You can generate and execute shell commands, search YouTube, and open URLs."
        ),
        llm_config={"config_list":[{"model":"gpt-4o-mini","api_key":api_key}]},
        human_input_mode="NEVER",
    )


def make_human_agent(user_id):
    return ConversableAgent(
        name="UserProxy",
        human_input_mode="TERMINATE",
        max_consecutive_auto_reply=3,
    )

# --- Main loop -------------------------------------------------------------

def main():
    user_id = input("Enter your user ID: ").strip()
    view_memories(user_id)
    print("Type 'exit' or 'view memories'.")

    env_agent = make_env_agent(user_id)
    manager_agent = make_manager_agent(user_id)
    bash_agent = make_bash_agent(user_id)
    human_agent = make_human_agent(user_id)

    # Register tools for BashAgent
    register_function(
        execute_command,
        caller=bash_agent,
        executor=bash_agent,
        name="execute_command",
        description="Execute arbitrary shell commands on the host system."
    )
    register_function(
        generate_command,
        caller=bash_agent,
        executor=bash_agent,
        name="generate_command",
        description="Generate a bash command for a given natural language task."
    )
    register_function(
        open_youtube_video,
        caller=bash_agent,
        executor=bash_agent,
        name="open_youtube_video",
        description="Search YouTube for a query and open results in the browser."
    )

    initial = {"role":"user","content":"Session start."}
    chat = GroupChat(
        agents=[manager_agent, env_agent, bash_agent, human_agent],
        messages=[initial],
        max_round=10,
        send_introductions=True,
        speaker_selection_method="auto",
    )
    manager = GroupChatManager(
        groupchat=chat,
        llm_config={"config_list":[{"model":"gpt-4o-mini","api_key":api_key}]}
    )

    while True:
        inp = input("You: ").strip()
        if inp.lower() in ('exit','quit'):
            print("Goodbye!")
            break
        if inp.lower() == 'view memories':
            view_memories(user_id)
            continue

        # build memory context
        dev_ctx = get_relevant_memories(user_id, inp, "dev_environment")
        proj_ctx = get_relevant_memories(user_id, inp, "project_preferences")
        general_ctx = get_relevant_memories(user_id, inp, None)
        memory_context = ""
        if dev_ctx:
            memory_context += "Dev Env Prefs:\n" + "\n".join(f"- {m}" for m in dev_ctx) + "\n\n"
        if proj_ctx:
            memory_context += "Project Prefs:\n" + "\n".join(f"- {m}" for m in proj_ctx) + "\n\n"
        if general_ctx:
            memory_context += "General:\n" + "\n".join(f"- {m}" for m in general_ctx) + "\n\n"
        if not memory_context:
            memory_context = "No relevant memories yet."

        chat.messages = [initial, {"role":"user","content":f"Memories:\n{memory_context}\nRequest: {inp}"}]

        # run agents
        while True:
            success, _ = manager.run_chat(messages=chat.messages, sender=manager_agent, config=chat)
            if success:
                break
            resp = input(f"{chat.messages[-1]['content']}\nYou: ")
            chat.messages.append({"role":"user","content":resp})

        # print last assistant output
        last_ai = next(m['content'] for m in reversed(chat.messages) if m['role']=='assistant')
        print(f"AI: {last_ai}")
        add_memory([
            {"role":"user","content":inp},
            {"role":"assistant","content":last_ai}
        ], user_id=user_id)

if _name_ == "_main_":
    main()