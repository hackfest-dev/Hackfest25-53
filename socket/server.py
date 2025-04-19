import os
import asyncio
import websockets
import json
import openai
from dotenv import load_dotenv
from orchestrator.agent_router import route_task

load_dotenv()

# Initialize OpenAI client
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

async def determine_agent(content):
    """
    Use OpenAI to determine which agent is best suited to handle the content.
    """
    try:
        valid_agents = ['customer_service', 'technical_support', 'sales', 'general']

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a router that determines which AI agent should process a given request. "
                                             "Your task is to analyze the content and return ONLY the name of the most appropriate agent "
                                             f"from the following options: {valid_agents} "
                                             "Return only the agent name without any explanation or additional text."},
                {"role": "user", "content": f"Determine the best agent for this request: {content}"}
            ],
            temperature=0.3,
            max_tokens=20
        )
        
        agent_type = response.choices[0].message.content.strip().lower()
        
        # Validate that the returned agent is in our allowed list
        if agent_type not in valid_agents:
            return "general"  # Default to general if the returned agent is not valid
        
        return agent_type
    except Exception as e:
        print(f"Error determining agent: {e}")
        return "general"  # Default to general agent in case of errors

async def unified_agent_socket(websocket):
    async for raw_message in websocket:
        try:
            # Convert the raw_message to a dictionary first
            data = json.loads(raw_message)
            
            # Get content - agent will be determined automatically
            content = data.get("content")
            
            if not content:
                await websocket.send(json.dumps({
                    "type": "error",
                    "content": "Message must include 'content'."
                }))
                continue
            
            # User can override agent selection if they want
            if "agent" in data and data["agent"]:
                agent_type = data["agent"]
            else:
                # Determine which agent to use based on content
                agent_type = await determine_agent(content)
            
            # Let the user know which agent was selected
            await websocket.send(json.dumps({
                "type": "info",
                "content": f"Routing to {agent_type} agent..."
            }))
            
            # Route to the appropriate agent
            await route_task(agent_type, content, websocket)
            
        except Exception as e:
            await websocket.send(json.dumps({
                "type": "error",
                "content": str(e)
            }))

async def main():
    async with websockets.serve(unified_agent_socket, "localhost", 8765):
        print("Server running on ws://localhost:8765")
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    asyncio.run(main())