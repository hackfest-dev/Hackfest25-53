import subprocess
import time

def open_application(command):
    """Open an application asynchronously."""
    try:
        subprocess.Popen(command, shell=True)
    except Exception as e:
        print(f"Failed to open {command}: {e}")

def move_resize_window(window_name, x, y, width, height):
    """
    Move and resize a window using wmctrl.
    window_name: part of the window's title (case-insensitive).
    x, y: position on screen.
    width, height: dimensions.
    """
    try:
        # List windows and filter by window_name
        output = subprocess.check_output(['wmctrl', '-l']).decode('utf-8')
        window_id = None
        for line in output.splitlines():
            if window_name.lower() in line.lower():
                window_id = line.split()[0]
                break
        if window_id is None:
            print(f"Window with name containing '{window_name}' not found.")
            return
        # Move and resize the window
        cmd = f"wmctrl -i -r {window_id} -e 0,{x},{y},{width},{height}"
        subprocess.run(cmd, shell=True)
    except Exception as e:
        print(f"Failed to move/resize window '{window_name}': {e}")

# Open VSCode
open_application('code')

# Open browser (change to 'firefox', 'google-chrome', etc., if desired)
open_application('xdg-open https://www.google.com')

# Wait for windows to launch
time.sleep(5)

# Get screen resolution using xrandr
try:
    output = subprocess.check_output(['xrandr']).decode('utf-8')
    width, height = 1920, 1080  # fallback
    for line in output.splitlines():
        if ' connected ' in line and 'primary' in line:
            # Example: eDP-1 connected primary 1920x1080+0+0
            for part in line.split():
                if 'x' in part and '+' in part:
                    size = part.split('+')[0]
                    width, height = map(int, size.split('x'))
                    break
            break
except Exception as e:
    print(f"Failed to get screen resolution: {e}")
    width, height = 1920, 1080  # fallback

# Move VSCode to the left half
move_resize_window('Visual Studio Code', 0, 0, width // 2, height)

# Move browser to the right half (change window name as needed)
move_resize_window('Mozilla Firefox', width // 2, 0, width // 2, height)

print("Commands executed. Adjust window names if needed.")
