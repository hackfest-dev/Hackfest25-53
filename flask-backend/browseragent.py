import asyncio
import os
from dotenv import load_dotenv

from autogen_agentchat.ui import Console
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_ext.agents.web_surfer import MultimodalWebSurfer

# Load environment variables
load_dotenv()
API_KEY = os.getenv("OPENAI_API_KEY")

async def main() -> None:
    # Define the model client with your API key
    model_client = OpenAIChatCompletionClient(
        model="gpt-4o-2024-08-06",
        api_key=API_KEY  # Make sure API_KEY is properly set from your .env file
    )
    
    # Define the web surfer agent
    web_surfer_agent = MultimodalWebSurfer(
        name="MultimodalWebSurfer",
        model_client=model_client,
        headless=False,  # Set to True for headless operation
        animate_actions=False  # Shows mouse movements and clicks
    )
    
    # Create the team with just the web surfer agent
    agent_team = RoundRobinGroupChat([web_surfer_agent], max_turns=3)
    
    print("\nAutoGen WebSurfer Agent\n")
    print("Type your web navigation task or 'exit' to quit.\n")
    
    while True:
        user_task = input("🧑 Enter task: ").strip()
        if user_task.lower() in {"exit", "quit"}:
            print("👋 Exiting...")
            break
        
        print("🤖 Processing...\n")
        
        try:
            # Run the team and stream messages to the console for the given task
            stream = agent_team.run_stream(task=user_task)
            await Console(stream)
        except Exception as e:
            print(f"Error: {e}")
    
    # Make sure to close the browser controlled by the agent
    await web_surfer_agent.close()

if __name__ == "__main__":
    asyncio.run(main())