# ---------- METRICS ----------
from collections import Counter, defaultdict
import json
import os
from config import API_CALL_COUNT_FILE, CATEGORY_FILE, TRACK_INTERVAL


def print_metrics():
    if not os.path.exists(CATEGORY_FILE):
        print("No categorized logs yet.")
        return

    with open(CATEGORY_FILE, 'r') as f:
        logs = json.load(f)

    total_time = defaultdict(int)
    freq = Counter()

    for i in range(1, len(logs)):
        if logs[i]["status"] == "active":
            delta = TRACK_INTERVAL
            cat = logs[i]["category"]
            total_time[cat] += delta
            freq[cat] += 1

    print("\n--- Usage Metrics ---")
    for cat in total_time:
        print(f"Category: {cat}\tTime: {total_time[cat] // 60} mins")

    print("\nAPI Call Stats:")
    if os.path.exists(API_CALL_COUNT_FILE):
        with open(API_CALL_COUNT_FILE) as f:
            print(f.read())
    else:
        print("No API calls made yet.")