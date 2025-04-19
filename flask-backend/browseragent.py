import asyncio
import os
from dotenv import load_dotenv

from autogen_agentchat.agents import UserProxyAgent, AssistantAgent
from autogen_agentchat.teams import SelectorGroupChat
from autogen_agentchat.conditions import MaxMessageTermination, TextMentionTermination
from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_ext.agents.web_surfer import MultimodalWebSurfer

load_dotenv()
API_KEY = os.getenv("OPENAI_API_KEY")

async def main():
    # Initialize OpenAI model client
    model_client = OpenAIChatCompletionClient(model="gpt-4o-mini", api_key=API_KEY)

    # Create a WebSurfer agent (uses Playwright under the hood)
    websurfer_agent = MultimodalWebSurfer(
        name="websurfer_agent",
        description="An agent that solves tasks by browsing the web using Playwright.",
        model_client=model_client,
        headless=True,           # Set to True for headless browser
        animate_actions=True    # Shows mouse movements and clicks
    )

    # Assistant agent for verification and summarization
    assistant_agent = AssistantAgent(
        name="assistant_agent",
        description="Verifies and summarizes the task progress.",
        system_message=(
            "You are a task verification assistant working with a web surfer agent to solve tasks. "
            "At each point, check if the task has been completed as requested by the user. "
            "If the websurfer_agent responds and the task has not yet been completed, "
            "respond with what is left to do and then say 'keep going'. "
            "If and only when the task has been completed, summarize and present a final answer "
            "that directly addresses the user task in detail and then respond with TERMINATE."
        ),
        model_client=model_client
    )

    # User proxy agent for interactive CLI
    user_proxy = UserProxyAgent("user_proxy")

    # Termination condition: stop after "TERMINATE" or 20 messages
    termination = MaxMessageTermination(max_messages=20) | TextMentionTermination("TERMINATE")

    # Selector prompt (optional, but helps guide the team)
    selector_prompt = """You are the coordinator of a web automation team.
The following roles are available: {roles}.
Given a task, the websurfer_agent will be tasked to address it by browsing the web and providing information.
The assistant_agent will be tasked with verifying the information provided by the websurfer_agent and summarizing the information to present a final answer to the user.
If the task needs assistance from a human user (e.g., providing feedback, preferences, or the task is stalled), you should select the user_proxy role to provide the necessary information.
Read the following conversation. Then select the next role from {participants} to play. Only return the role.
{history}
Read the above conversation. Then select the next role from {participants} to play. Only return the role."""

    # Group chat: pass agents as a list, not as 'agents='
    team = SelectorGroupChat(
        [user_proxy, websurfer_agent, assistant_agent],
        model_client=model_client,
        selector_prompt=selector_prompt,
        termination_condition=termination,
    )

    print(
        "\nAutoGen Playwright Browser Agent\n"
        "Type your instruction (e.g., 'Play Bohemian Rhapsody on YouTube and click play', "
        "'Open wikipedia.org and scroll to the bottom', "
        "'Go to github.com and search for AutoGen').\n"
        "Type 'exit' to quit.\n"
    )

    while True:
        user_task = input("🧑 You: ").strip()
        if user_task.lower() in {"exit", "quit"}:
            print("👋 Exiting...")
            break
        print("🤖 Processing...\n")
        try:
            # Run the team on the user's task
            await team.run(task=user_task)
        except Exception as e:
            print(f"⚠️ Error: {e}")

    await websurfer_agent.close()
    await model_client.close()

if __name__ == "__main__":
    asyncio.run(main())
