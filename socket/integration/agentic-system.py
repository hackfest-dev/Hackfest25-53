import asyncio
import os
from dotenv import load_dotenv

from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_agentchat.teams import MagenticOneGroupChat
from autogen_agentchat.ui import Console
from autogen_ext.agents.web_surfer import MultimodalWebSurfer
from autogen_ext.agents.file_surfer import FileSurfer
from autogen_ext.agents.magentic_one import MagenticOneCoderAgent
from autogen_agentchat.agents import CodeExecutorAgent, UserProxyAgent
from autogen_ext.code_executors.local import LocalCommandLineCodeExecutor

# Load environment variables
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

async def main() -> None:
    # Model client for all agents
    model_client = OpenAIChatCompletionClient(model="gpt-4o-mini", api_key=OPENAI_API_KEY)

    # Web Surfer agent (web browsing)
    web_surfer = MultimodalWebSurfer(
        name="WebSurfer",
        model_client=model_client,
        headless=False,  # Set to False to see browser actions
        animate_actions=False
    )

    # File Surfer agent (local file preview)
    file_surfer = FileSurfer(
        name="FileSurfer",
        model_client=model_client
    )

    # MagenticOne coding agent (LLM coding assistant)
    coder = MagenticOneCoderAgent(
        name="Coder",
        model_client=model_client
    )

    # Local code executor agent (executes code on your machine)
    executor = LocalCommandLineCodeExecutor(
        timeout=120,
        work_dir="./cli_workspace"
    )
    terminal = CodeExecutorAgent(
        name="ComputerTerminal",
        code_executor=executor
    )

    # UserProxyAgent for human-in-the-loop (only prompts when needed)
    user_proxy = UserProxyAgent(
        name="Human",
        input_func=input  # Uses Python's input() for console prompt
    )

    # Group chat team with all agents (including human-in-the-loop)
    team = MagenticOneGroupChat(
        [web_surfer, file_surfer, coder, terminal, user_proxy],
        model_client=model_client
    )

    # Example task (can be replaced with input())
    task = (
        "Set up a venv called 'ml-trial-env', but ask me before actually creating it."
        "linear regression model and logistic regression model in it. also ask me wether I want to initialize git"
    )

    # Run the team and stream output to the console
    await Console(team.run_stream(task=task))

    # Clean up: close browser
    await web_surfer.close()

if __name__ == "__main__":
    asyncio.run(main())
