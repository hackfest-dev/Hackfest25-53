import os
import subprocess
import webbrowser


from config import openai_client


# --- BashAgent Tools -------------------------------------------------------
def execute_command(command: str) -> dict:
    """Execute a shell command and return result."""
    try:
        output = subprocess.check_output(command, shell=True, stderr=subprocess.STDOUT, text=True)
        return {"success": True, "command": command, "output": output}
    except subprocess.CalledProcessError as e:
        return {"success": False, "command": command, "output": e.output}


def generate_command(task: str) -> str:
    """Generate a bash command for the given task using OpenAI."""
    prompt = f"Generate a bash command on {os.name} to: {task}. Only return the command itself."
    resp = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}],
    )
    return resp.choices[0].message.content.strip().strip('`')


def open_youtube_video(query: str) -> dict:
    """Open YouTube search results for a query in the browser."""
    url = f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}"
    webbrowser.open(url)
    return {"success": True, "url": url}