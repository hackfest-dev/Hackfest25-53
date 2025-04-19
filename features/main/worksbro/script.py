import asyncio
import sys
import os
import websockets
from dotenv import load_dotenv

# Import your multi-agent system modules
from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_agentchat.teams import MagenticOneGroupChat
from autogen_agentchat.ui import Console
from autogen_ext.agents.web_surfer import MultimodalWebSurfer
from autogen_ext.agents.file_surfer import FileSurfer
from autogen_ext.agents.magentic_one import MagenticOneCoderAgent
from autogen_agentchat.agents import CodeExecutorAgent
from autogen_ext.code_executors.local import LocalCommandLineCodeExecutor

# Load environment variables
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Globals
agent_team = None
global_web_surfer = None
agent_lock = None
connected_clients = set()
message_queue = asyncio.Queue()

import sys
import asyncio

class StdoutRedirector:
    def __init__(self, original_stdout, queue, log_file_path="agent_output.log"):
        self.original_stdout = original_stdout
        self.queue = queue
        self.log_file_path = log_file_path

    def write(self, message):
        self.original_stdout.write(message)
        self.original_stdout.flush()
        if message.strip():
            try:
                asyncio.create_task(self.queue.put(message))
            except Exception:
                pass
            # Write to file in the specified format
            with open(self.log_file_path, "a", encoding="utf-8") as f:
                f.write(f'agent: ""\noutput: "{message.rstrip()}"\n')

    def flush(self):
        self.original_stdout.flush()


# original_stdout = sys.stdout
# sys.stdout = StdoutRedirector(original_stdout, message_queue)

original_stdout = sys.stdout
sys.stdout = StdoutRedirector(original_stdout, message_queue)


async def run_team_with_task(team, web_surfer, task):
    try:
        await Console(team.run_stream(task=task))
    except Exception as e:
        print(f"Error executing task: {e}")

async def ws_handler(websocket):
    connected_clients.add(websocket)
    print("New WebSocket client connected.")
    try:
        async for message in websocket:
            print(f"Received command from client: {message}")
            if message.lower().strip() in {"exit", "quit"}:
                print("Received exit command.")
                continue
            async with agent_lock:
                await run_team_with_task(agent_team, global_web_surfer, message)
    except websockets.ConnectionClosed:
        print("A WebSocket client disconnected.")
    finally:
        connected_clients.discard(websocket)

async def broadcast_messages():
    while True:
        message = await message_queue.get()
        if connected_clients:
            for client in list(connected_clients):
                try:
                    await client.send(message)
                except Exception as e:
                    print(f"Error sending message to a client: {e}")
        message_queue.task_done()

async def main():
    global agent_team, global_web_surfer, agent_lock

    model_client = OpenAIChatCompletionClient(model="gpt-4o", api_key=OPENAI_API_KEY)
    web_surfer = MultimodalWebSurfer(
        name="WebSurfer",
        model_client=model_client,
        headless=False,
        animate_actions=True,
    )
    file_surfer = FileSurfer(
        name="FileSurfer",
        model_client=model_client,
        base_path=os.getcwd()
    )
    coder = MagenticOneCoderAgent(
        name="Coder",
        model_client=model_client
    )
    executor = LocalCommandLineCodeExecutor(timeout=120)
    terminal = CodeExecutorAgent(
        name="ComputerTerminal",
        code_executor=executor
    )
    team = MagenticOneGroupChat(
        [web_surfer, file_surfer, coder, terminal],
        model_client=model_client
    )

    agent_team = team
    global_web_surfer = web_surfer
    agent_lock = asyncio.Lock()

    print("🤖 Multi-Agent System Ready. Waiting for commands via WebSocket...")

    ws_server = await websockets.serve(ws_handler, "localhost", 6789)
    print("WebSocket server started on ws://localhost:6789")

    broadcast_task = asyncio.create_task(broadcast_messages())

    try:
        await asyncio.Future()
    finally:
        print("Cleaning up resources...")
        await web_surfer.close()
        ws_server.close()
        await ws_server.wait_closed()
        broadcast_task.cancel()
        print("Goodbye!")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Server interrupted by user.")
    finally:
        sys.stdout = original_stdout
