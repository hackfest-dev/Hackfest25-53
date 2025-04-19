import asyncio
import os
from dotenv import load_dotenv

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

async def run_team_with_task(team, web_surfer, task):
    """Run the team with a specific task and handle cleanup"""
    try:
        await Console(team.run_stream(task=task))
    except Exception as e:
        print(f"Error executing task: {e}")
    finally:
        # No cleanup here as we'll handle it in the main loop
        pass

async def main() -> None:
    # Model client for all agents
    model_client = OpenAIChatCompletionClient(model="gpt-4o", api_key=OPENAI_API_KEY)

    # Web Surfer agent (web browsing)
    web_surfer = MultimodalWebSurfer(
        name="WebSurfer",
        model_client=model_client,
        headless=True,  # Set to False to see browser actions
        animate_actions=False,
    )

    # File Surfer agent (local file preview)
    file_surfer = FileSurfer(
        name="FileSurfer",
        model_client=model_client,
        base_path=os.getcwd()
    )

    # MagenticOne coding agent (LLM coding assistant)
    coder = MagenticOneCoderAgent(
        name="Coder",
        model_client=model_client
    )

    # Local code executor agent (executes code on your machine)
    executor = LocalCommandLineCodeExecutor(
        timeout=120,
    )
    terminal = CodeExecutorAgent(
        name="ComputerTerminal",
        code_executor=executor
    )

    # Group chat team with all agents
    team = MagenticOneGroupChat(
        [web_surfer, file_surfer, coder, terminal],
        model_client=model_client
    )

    print("🤖 Multi-Agent System Ready. Type 'exit' to quit.")
    
    try:
        while True:
            task = input("🗨️ > ")
            if task.lower() in {"exit", "quit"}:
                break
                
            # Run the team with the provided task
            await run_team_with_task(team, web_surfer, task)
            print("\n--- Task completed. What's next? ---\n")
    finally:
        # Clean up: close browser when done
        print("Cleaning up resources...")
        await web_surfer.close()
        print("Goodbye!")

if __name__ == "__main__":
    asyncio.run(main())
