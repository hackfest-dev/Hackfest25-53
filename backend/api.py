from flask import Flask, jsonify, request
import subprocess
import os
import signal
import psutil
import sys

app = Flask(__name__)

# Global variable to store the tracking process
tracking_process = None

def find_process_by_name(name):
    """Find a process by its name"""
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            # Check if the name is in the process name or command line
            if name in proc.info['name'] or (
                proc.info['cmdline'] and name in ' '.join([str(cmd) for cmd in proc.info['cmdline']])
            ):
                return proc
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    return None

@app.route('/api/tracking/status', methods=['GET'])
def get_tracking_status():
    """Get the current status of the tracking service"""
    global tracking_process
    
    # Check if our tracking process is running
    if tracking_process and tracking_process.poll() is None:
        return jsonify({"status": "running"})
    
    # Also check if main.py is running independently
    process = find_process_by_name('main.py')
    if process:
        # Update our reference
        tracking_process = process
        return jsonify({"status": "running"})
    
    return jsonify({"status": "stopped"})

@app.route('/api/tracking/start', methods=['POST'])
def start_tracking():
    """Start the tracking service"""
    global tracking_process
    
    # Check if already running
    if tracking_process and tracking_process.poll() is None:
        return jsonify({"message": "Tracking already running"})
    
    # Check if main.py is already running elsewhere
    process = find_process_by_name('main.py')
    if process:
        tracking_process = process
        return jsonify({"message": "Tracking already running"})
    
    # Start the main.py script
    try:
        script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'scripts', 'main.py')
        
        # Use pythonw on Windows to hide console window, or python on other platforms
        python_executable = 'pythonw' if sys.platform == 'win32' else 'python'
        
        tracking_process = subprocess.Popen([python_executable, script_path])
        return jsonify({"message": "Tracking started"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/tracking/stop', methods=['POST'])
def stop_tracking():
    """Stop the tracking service"""
    global tracking_process
    
    # First check our stored process
    if tracking_process:
        try:
            if hasattr(tracking_process, 'terminate'):
                tracking_process.terminate()
            elif hasattr(tracking_process, 'kill'):
                tracking_process.kill()
            tracking_process = None
            return jsonify({"message": "Tracking stopped"})
        except Exception as e:
            pass  # Continue to find the process by name
    
    # Find the process by name if our reference failed
    process = find_process_by_name('main.py')
    if process:
        try:
            process.terminate()
            return jsonify({"message": "Tracking stopped"})
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return jsonify({"error": "Could not stop tracking process"}), 500
    
    return jsonify({"message": "Tracking not running"})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
