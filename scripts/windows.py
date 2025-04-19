import subprocess
import time
import json
import platform
import os
from typing import Dict, List, Tuple, Optional, Union

class WindowManager:
    """
    A tool for managing window layouts that can be called by an LLM.
    The LLM will parse natural language instructions and call the appropriate methods.
    """

    def __init__(self):
        self.os_type = platform.system()  # 'Windows', 'Darwin' (macOS), or 'Linux'
        self.screen_width = 1920  # Default fallback
        self.screen_height = 1080  # Default fallback
        self.get_screen_resolution()
        self._initialize_app_configs()

    def _initialize_app_configs(self):
        # Common apps configuration based on OS
        if self.os_type == 'Windows':
            self.common_apps = {
                "vscode": "code",
                "vs code": "code",
                "visual studio code": "code",
                "chrome": "start chrome",
                "google chrome": "start chrome",
                "firefox": "start firefox",
                "browser": "start https://www.google.com",
                "terminal": "start cmd",
                "powershell": "start powershell",
                "file manager": "explorer",
                "files": "explorer",
                "spotify": "start spotify",
                "slack": "start slack",
                "discord": "start discord"
            }
            self.window_identifiers = {
                "vscode": "Visual Studio Code",
                "vs code": "Visual Studio Code",
                "chrome": "Google Chrome",
                "google chrome": "Google Chrome",
                "firefox": "Firefox",
                "browser": "Firefox|Chrome|Edge",
                "terminal": "cmd.exe|Command Prompt",
                "powershell": "powershell.exe",
                "file manager": "Explorer",
                "files": "Explorer",
                "spotify": "Spotify",
                "slack": "Slack",
                "discord": "Discord"
            }
        elif self.os_type == 'Darwin':  # macOS
            self.common_apps = {
                "vscode": "open -a 'Visual Studio Code'",
                "vs code": "open -a 'Visual Studio Code'",
                "visual studio code": "open -a 'Visual Studio Code'",
                "chrome": "open -a 'Google Chrome'",
                "google chrome": "open -a 'Google Chrome'",
                "firefox": "open -a Firefox",
                "browser": "open https://www.google.com",
                "terminal": "open -a Terminal",
                "file manager": "open -a Finder",
                "files": "open -a Finder",
                "spotify": "open -a Spotify",
                "slack": "open -a Slack",
                "discord": "open -a Discord"
            }
            self.window_identifiers = {
                "vscode": "Visual Studio Code",
                "vs code": "Visual Studio Code",
                "chrome": "Google Chrome",
                "google chrome": "Google Chrome",
                "firefox": "Firefox",
                "browser": "Firefox|Chrome|Safari",
                "terminal": "Terminal",
                "file manager": "Finder",
                "files": "Finder",
                "spotify": "Spotify",
                "slack": "Slack",
                "discord": "Discord"
            }
        else:  # Default to Linux
            self.common_apps = {
                "vscode": "code",
                "vs code": "code",
                "visual studio code": "code",
                "chrome": "google-chrome",
                "google chrome": "google-chrome",
                "firefox": "firefox",
                "browser": "xdg-open https://www.google.com",
                "terminal": "gnome-terminal",
                "konsole": "konsole",
                "file manager": "nautilus",
                "files": "nautilus",
                "spotify": "spotify",
                "slack": "slack",
                "discord": "discord"
            }
            self.window_identifiers = {
                "vscode": "Visual Studio Code",
                "vs code": "Visual Studio Code",
                "visual studio code": "Visual Studio Code",
                "chrome": "Google Chrome",
                "google chrome": "Google Chrome",
                "firefox": "Firefox",
                "browser": "Firefox|Chrome|Edge",
                "terminal": "Terminal",
                "konsole": "Konsole",
                "file manager": "Files|Nautilus",
                "files": "Files|Nautilus",
                "spotify": "Spotify",
                "slack": "Slack",
                "discord": "Discord"
            }

    def get_screen_resolution(self):
        """Get the screen resolution based on the operating system"""
        try:
            if self.os_type == 'Windows':
                # Windows
                from ctypes import windll
                user32 = windll.user32
                self.screen_width = user32.GetSystemMetrics(0)
                self.screen_height = user32.GetSystemMetrics(1)
            elif self.os_type == 'Darwin':  # macOS
                cmd = "system_profiler SPDisplaysDataType | grep Resolution"
                output = subprocess.check_output(cmd, shell=True).decode('utf-8')
                resolution = output.split(':')[1].strip()
                self.screen_width, self.screen_height = map(int, resolution.split(' x '))
            else:  # Linux
                output = subprocess.check_output(['xrandr']).decode('utf-8')
                for line in output.splitlines():
                    if ' connected ' in line and 'primary' in line:
                        for part in line.split():
                            if 'x' in part and '+' in part:
                                size = part.split('+')[0]
                                self.screen_width, self.screen_height = map(int, size.split('x'))
                                return
        except Exception as e:
            print(f"Failed to get screen resolution: {e}")
            print(f"Using default resolution: {self.screen_width}x{self.screen_height}")

    def minimize_all_windows(self):
        """Minimize all open windows by showing the desktop - cross-platform implementation"""
        try:
            if self.os_type == 'Windows':
                # Windows: Windows key + D
                import ctypes
                user32 = ctypes.windll.user32
                user32.keybd_event(0x5B, 0, 0, 0)  # Windows key down
                user32.keybd_event(0x44, 0, 0, 0)  # D key down
                user32.keybd_event(0x44, 0, 2, 0)  # D key up
                user32.keybd_event(0x5B, 0, 2, 0)  # Windows key up
                print("Minimized all windows on Windows")
            elif self.os_type == 'Darwin':  # macOS
                # macOS: Mission Control + F11
                cmd = """osascript -e 'tell application "System Events" to keystroke "m" using {command down, option down}'"""
                subprocess.run(cmd, shell=True)
                print("Minimized all windows on macOS")
            else:  # Linux
                # Linux with wmctrl
                subprocess.run("wmctrl -k on", shell=True)
                print("Minimized all windows on Linux")
        except Exception as e:
            print(f"Failed to minimize all windows: {e}")

    def open_application(self, command: str):
        """Open an application using the appropriate command for the current OS"""
        try:
            if self.os_type == 'Windows':
                # On Windows, some commands might need 'start' prefix which is already in common_apps
                subprocess.Popen(command, shell=True)
            elif self.os_type == 'Darwin':  # macOS
                # On macOS, some commands might need 'open -a' prefix which is already in common_apps
                subprocess.Popen(command, shell=True)
            else:  # Linux
                subprocess.Popen(command, shell=True)
        except Exception as e:
            print(f"Failed to open {command}: {e}")

    def move_resize_window(self, window_name_pattern: str, x: int, y: int, width: int, height: int):
        """Move and resize a window - platform specific implementation"""
        try:
            if self.os_type == 'Windows':
                # Windows implementation using PowerShell
                ps_script = f"""
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WindowPosition {{
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
}}
"@
$windows = Get-Process | Where-Object {{$_.MainWindowTitle -match "{window_name_pattern}"}}
foreach ($window in $windows) {{
    [WindowPosition]::SetWindowPos($window.MainWindowHandle, [IntPtr]::Zero, {x}, {y}, {width}, {height}, 0x0040)
}}
"""
                with open('temp_window_script.ps1', 'w') as f:
                    f.write(ps_script)
                subprocess.run('powershell -ExecutionPolicy Bypass -File temp_window_script.ps1', shell=True)
                os.remove('temp_window_script.ps1')
            elif self.os_type == 'Darwin':  # macOS
                # macOS implementation using AppleScript
                patterns = window_name_pattern.split('|')
                for pattern in patterns:
                    script = f"""
                    osascript -e '
                    tell application "System Events"
                        set appList to application processes whose name contains "{pattern}"
                        if (count of appList) > 0 then
                            tell (item 1 of appList)
                                set position of window 1 to {{{x}, {y}}}
                                set size of window 1 to {{{width}, {height}}}
                            end tell
                        end if
                    end tell'
                    """
                    subprocess.run(script, shell=True)
            else:  # Linux
                # Linux implementation using wmctrl
                output = subprocess.check_output(['wmctrl', '-l']).decode('utf-8')
                window_id = None
                for line in output.splitlines():
                    for pattern in window_name_pattern.split('|'):
                        if pattern.lower() in line.lower():
                            window_id = line.split()[0]
                            break
                    if window_id:
                        break
                if window_id is None:
                    print(f"Window with name containing '{window_name_pattern}' not found.")
                    return
                cmd = f"wmctrl -i -r {window_id} -e 0,{x},{y},{width},{height}"
                subprocess.run(cmd, shell=True)
        except Exception as e:
            print(f"Failed to move/resize window '{window_name_pattern}': {e}")

    def arrange_windows(self, instructions: Dict[str, str]):
        """Arrange windows according to instructions"""
        # First minimize all existing windows
        self.minimize_all_windows()
        
        # Open applications
        for app, position in instructions.items():
            cmd = self.common_apps.get(app.lower())
            if cmd:
                self.open_application(cmd)
            else:
                print(f"No command found for app '{app}'")

        # Wait for windows to open
        wait_time = 5 if self.os_type == 'Windows' else 3
        print(f"Waiting {wait_time} seconds for applications to open...")
        time.sleep(wait_time)

        # Define positions
        positions = {
            'left': (0, 0, self.screen_width // 2, self.screen_height),
            'right': (self.screen_width // 2, 0, self.screen_width // 2, self.screen_height),
            'top left': (0, 0, self.screen_width // 2, self.screen_height // 2),
            'top right': (self.screen_width // 2, 0, self.screen_width // 2, self.screen_height // 2),
            'bottom left': (0, self.screen_height // 2, self.screen_width // 2, self.screen_height // 2),
            'bottom right': (self.screen_width // 2, self.screen_height // 2, self.screen_width // 2, self.screen_height // 2),
            'full': (0, 0, self.screen_width, self.screen_height),
            'bottom': (0, self.screen_height // 2, self.screen_width, self.screen_height // 2)
        }

        for app, pos_name in instructions.items():
            pos_name_lower = pos_name.lower()
            if pos_name_lower in positions:
                x, y, w, h = positions[pos_name_lower]
                window_name_pattern = self.window_identifiers.get(app.lower(), app)
                # Add a small delay between positioning each window
                time.sleep(0.2)
                self.move_resize_window(window_name_pattern, x, y, w, h)
            else:
                print(f"Position '{pos_name}' not recognized.")
import os
import json
from typing import Dict, Optional
from groq import Groq

class GroqLLM:
    def __init__(self, api_key: Optional[str] = None):
        # Use the provided API key or fall back to the environment variable
        self.client = Groq(api_key=api_key or os.environ.get("GROQ_API_KEY"))
        self.model = "llama-3.3-70b-versatile"

    def parse_natural_language(self, text: str) -> Dict[str, str]:
        """
        Use the Groq LLM API to parse the natural language command and return a dictionary
        of app: position, e.g. {"vscode": "left", "browser": "right"}
        """
        system_prompt = (
            "You are an assistant that extracts window arrangement instructions from user commands. "
            "Given a user's request, output a JSON dictionary where the keys are app names (e.g., 'vscode', 'browser', 'terminal') "
            "and the values are screen positions (e.g., 'left', 'right', 'top left', 'full'). "
            "Only output valid JSON. Example: {'vscode': 'left', 'browser': 'right', 'terminal': 'top left'}"
        )
        user_prompt = f"User command: {text}\nOutput the mapping as JSON."

        response = self.client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model=self.model,
            max_tokens=256,
            temperature=0.1,
        )
        # Extract the assistant's reply and parse the JSON
        content = response.choices[0].message.content
        try:
            # Some models may wrap the JSON in code blocks, so strip them if present
            if content.startswith(""):
                content = content.strip("`\n")
                # Remove 'json' if present after the opening 
                if content.startswith("json"):
                    content = content[4:].strip()
            instructions = json.loads(content.replace("'", '"'))
            if not isinstance(instructions, dict):
                raise ValueError("Parsed instructions are not a dictionary.")
            return instructions
        except Exception as e:
            raise RuntimeError(f"Failed to parse Groq response as JSON: {content}\nError: {e}")

# Example usage:
groq_llm = GroqLLM(api_key='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')
# instructions = groq_llm.parse_natural_language("open vscode and my browser to the left and right and terminal to the top left")
instructions = groq_llm.parse_natural_language("Open chrome and firefox and terminal in best possible layout")
print(instructions)

wm = WindowManager()
wm.arrange_windows(instructions)