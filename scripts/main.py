import threading
import signal
import sys
import time

from categorizer import start_categorizer_loop
from logger import log_usage
from metrics import print_metrics

# Flag to indicate if we should exit
should_exit = False

def signal_handler(sig, frame):
    """Handle termination signals"""
    global should_exit
    print("Received termination signal. Shutting down gracefully...")
    should_exit = True

# Register signal handlers
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

if __name__ == "__main__":
    # Start the logging and categorizer threads
    log_thread = threading.Thread(target=log_usage, daemon=True)
    log_thread.start()
    
    categorizer_thread = threading.Thread(target=start_categorizer_loop, daemon=True)
    categorizer_thread.start()

    try:
        while not should_exit:
            # Check for user input with a timeout to allow checking should_exit flag
            # In a headless environment, this won't wait for input
            try:
                # Use a non-blocking approach when running as a service
                if sys.stdin.isatty():
                    cmd = input("Type 'metrics' to show usage metrics or 'exit' to quit:\n> ").strip().lower()
                    if cmd == "metrics":
                        print_metrics()
                    elif cmd == "exit":
                        break
                else:
                    # If running without a terminal, just sleep
                    time.sleep(1)
            except EOFError:
                # Handle EOFError which can happen in certain environments
                time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        print("Shutting down tracking service...")