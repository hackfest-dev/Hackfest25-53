import os
from langchain.chat_models import ChatOpenAI
from langchain.agents import initialize_agent, AgentType
from langchain_community.tools import ShellTool
from dotenv import load_dotenv

# Load environment variables first
load_dotenv()

# Initialize LLM with explicit API key
openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    raise ValueError("OPENAI_API_KEY not found in environment variables")

llm = ChatOpenAI(
    temperature=0, 
    model_name="gpt-4o-mini",
    openai_api_key=openai_api_key
)

# Initialize shell tool
shell = ShellTool()

# Build agent
agent = initialize_agent(
    tools=[shell],
    llm=llm,
    agent=AgentType.CHAT_ZERO_SHOT_REACT_DESCRIPTION,
    verbose=True, 
)

def terminal_agent_loop():
    print("🖥️ Terminal agent ready. Type 'exit' to quit.")
    while True:
        cmd = input("🗨️ > ")
        if cmd.lower() in {"exit", "quit"}:
            break
        # Agent decides whether and how to shell out
        result = agent.run(cmd)
        print(result)

if __name__ == "__main__":
    terminal_agent_loop()
