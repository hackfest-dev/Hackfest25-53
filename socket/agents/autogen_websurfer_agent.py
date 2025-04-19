import asyncio
import os
import json
from dotenv import load_dotenv
import base64
from io import BytesIO
from PIL import Image
from autogen_agentchat.ui import Console
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_ext.agents.web_surfer import MultimodalWebSurfer

# Entrypoint for running the WebSurfer agent and streaming output to websocket
async def run_websurfer_agent(task, websocket):
    load_dotenv()
    API_KEY = os.getenv("OPENAI_API_KEY")
    model_client = OpenAIChatCompletionClient(
        model="gpt-4o-2024-08-06",
        api_key=API_KEY
    )
    web_surfer_agent = MultimodalWebSurfer(
        name="MultimodalWebSurfer",
        model_client=model_client,
        headless=True,  # Run headless for server use
        animate_actions=False
    )
    agent_team = RoundRobinGroupChat([web_surfer_agent], max_turns=5)
    try:
        stream = agent_team.run_stream(task=task)
        # Instead of Console, stream each message to websocket


        async for msg in stream:
            # 1) Pull out either .content or .text
            if hasattr(msg, "content"):
                payload = msg.content
            elif hasattr(msg, "text"):
                payload = msg.text
            else:
                payload = str(msg)

            # 2) If it's actually an Image, convert to PNG‑bytes + base64
            if isinstance(payload, Image.Image):
                buf = BytesIO()
                payload.save(buf, format="PNG")
                img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
                send_obj = {
                    "type": "websurfer",
                    # the client can do: const img = new Image(); img.src = 'data:image/png;base64,' + content;
                    "content": {"image_base64": img_b64}
                }
            else:
                send_obj = {
                    "type": "websurfer",
                    "content": payload
                }

            await websocket.send(json.dumps(send_obj))
    except Exception as e:
        await websocket.send(json.dumps({
            "type": "error",
            "content": str(e)
        }))

