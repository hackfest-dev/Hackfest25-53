import threading

from categorizer import start_categorizer_loop
from logger import log_usage
from metrics import print_metrics

if __name__ == "__main__":
    threading.Thread(target=log_usage, daemon=True).start()
    threading.Thread(target=start_categorizer_loop, daemon=True).start()

    try:
        while True:
            cmd = input("Type 'metrics' to show usage metrics or 'exit' to quit:\n> ").strip().lower()
            if cmd == "metrics":
                print_metrics()
            elif cmd == "exit":
                break
    except KeyboardInterrupt:
        pass