=# orchestrator/agent_router.py
import json
from langchain.agents import AgentExecutor
from agents.customer_service import get_customer_service_agent
from agents.technical_support import get_technical_support_agent
from agents.sales import get_sales_agent
from agents.general import get_general_agent

async def route_task(agent_type, content, websocket, handle_parsing_errors=False):
    """
    Routes the task to the appropriate agent based on agent_type
    
    Args:
        agent_type: The type of agent to use (customer_service, technical_support, sales, general)
        content: The content to process
        websocket: The websocket connection to send responses back
        handle_parsing_errors: Whether to handle parsing errors in the agent executor
    """
    try:
        # Get the appropriate agent based on agent_type
        if agent_type == "customer_service":
            agent = get_customer_service_agent()
        elif agent_type == "technical_support":
            agent = get_technical_support_agent()
        elif agent_type == "sales":
            agent = get_sales_agent()
        else:
            # Default to general agent
            agent = get_general_agent()
            
        # Create agent executor with parsing error handling if requested
        agent_executor = AgentExecutor.from_agent_and_tools(
            agent=agent, 
            tools=agent.tools,
            handle_parsing_errors=handle_parsing_errors,
            verbose=True
        )
        
        # Execute the agent with the content
        result = await agent_executor.arun(content)
        
        # Send the result back to the client
        await websocket.send(json.dumps({
            "type": "response",
            "content": result
        }))
    except Exception as e:
        # Handle exceptions
        await websocket.send(json.dumps({
            "type": "error",
            "content": f"Error processing with {agent_type} agent: {str(e)}"
        }))