import os
from autogen import GroupChat, GroupChatManager, register_function
from flask import Flask
from flask_socketio import SocketIO, emit
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from agents import make_bash_agent, make_env_agent, make_human_agent, make_manager_agent
from config import openai_client
from memory import add_memory, get_relevant_memories, view_memories
from tools import execute_command, generate_command, open_youtube_video


app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")
WATCHED_FILE = os.path.abspath(
    os.path.join(os.path.dirname(__file__),
                 "../scripts/logs\categorized_log.json")
)


class FileChangeHandler(FileSystemEventHandler):
    def __init__(self, socketio_instance):
        self.socketio = socketio_instance


    def on_modified(self, event):
        src = os.path.abspath(event.src_path)
        # print(f"src_path -> {src}")
        # print(f"watched file -> {WATCHED_FILE}")
        if src == WATCHED_FILE:
            print(f"File {event.src_path} has been modified!")
            self.emit_file_on_change_event()
    

    def emit_file_on_change_event(self):
        # print("Emitting....")
        with open("../scripts/logs/categorized_log.json", 'r') as file:
            data = file.read()
            socketio.emit('file_change', {'content': data})
        # emit('new_change', {'status': 'File changed and updated'})



@socketio.on('start_conversation')
def handle_start_conversation(data):
    user_id = data['user_id']
    input_text = data['input']

    print(f"Received input from {user_id}: {input_text}")

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
        llm_config={"config_list":[{"model":"gpt-4o-mini","api_key":openai_client.api_key}]}
    )

    # build memory context
    dev_ctx = get_relevant_memories(user_id, input_text, "dev_environment")
    proj_ctx = get_relevant_memories(user_id, input_text, "project_preferences")
    general_ctx = get_relevant_memories(user_id, input_text, None)
    memory_context = ""

    if dev_ctx:
        memory_context += "Dev Env Prefs:\n" + "\n".join(f"- {m}" for m in dev_ctx) + "\n\n"
    if proj_ctx:
        memory_context += "Project Prefs:\n" + "\n".join(f"- {m}" for m in proj_ctx) + "\n\n"
    if general_ctx:
        memory_context += "General:\n" + "\n".join(f"- {m}" for m in general_ctx) + "\n\n"
    if not memory_context:
        memory_context = "No relevant memories yet."
    
    chat.messages = [initial, {"role":"user","content":f"Memories:\n{memory_context}\nRequest: {input_text}"}]

    # run agents
    while True:
        success, _ = manager.run_chat(messages=chat.messages, sender=manager_agent, config=chat)
        if success:
            break
        
        # Get the last response from the AI
        last_ai = next(m['content'] for m in reversed(chat.messages) if m['role']=='assistant')

        emit('new_token', last_ai)
    
    add_memory([
        {"role":"user","content":input_text},
        {"role":"assistant","content":last_ai}
    ], user_id=user_id)


def start_file_watcher(socketio_instance):
    event_handler = FileChangeHandler(socketio_instance)
    observer = Observer()
    observer.schedule(event_handler, path="../scripts/logs", recursive=False)
    observer.start()
    print("File watcher started.")
    return observer


@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')


def run_server():
    observer = start_file_watcher(socketio)
    
    socketio.run(app, debug=True)

    observer.stop()
    observer.join()


if __name__ == "__main__":
    run_server()