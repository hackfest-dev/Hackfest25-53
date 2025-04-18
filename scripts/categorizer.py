from collections import defaultdict
from datetime import datetime
import json
import logging
import os
import time

import openai

from config import API_CALL_COUNT_FILE, API_LOG_FILE, CATEGORY_FILE, CATEGORY_UPDATE_INTERVAL, LOG_FILE


logging.basicConfig(filename=API_LOG_FILE, level=logging.INFO)

KEYWORD_CATEGORIES = {
    "system": ["file explorer", "settings", "control panel", "task manager", "registry editor"],
    "office": ["word", "excel", "powerpoint", "outlook"],
    "media": ["spotify", "photos", "vlc", "wmplayer"],
    "gaming": ["xbox", "steam", "epic games", "origin", "battle.net"]
}


def categorize_manual(window_title: str, app_name: str) -> str:
    text = f"{(window_title or '')} {(app_name or '')}".lower()
    for category, keywords in KEYWORD_CATEGORIES.items():
        if any(kw in text for kw in keywords):
            return category
    return None


def call_openai_batch(prompts):
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You're a smart assistant that categorizes software/app/browser activity."},
                {"role": "user", "content": "Categorize these application/browser window titles into productivity, development, entertainment, communication, or other:\n\n" + "\n".join(prompts)}
            ]
        )
        logging.info(f"[{datetime.now()}] API response: {response}")
        with open(API_CALL_COUNT_FILE, 'a') as f:
            f.write(f"{datetime.now()} - Called API for {len(prompts)} items\n")
        return response.choices[0].message.content.strip().split('\n')
    except Exception as e:
        logging.error(f"[{datetime.now()}] API call failed: {e}")
        return ["Other"] * len(prompts)


def read_logs():
    if not os.path.exists(LOG_FILE):
        return []
    with open(LOG_FILE, 'r') as f:
        return json.load(f)


def write_categorized_logs(logs):
    with open(CATEGORY_FILE, 'w') as f:
        json.dump(logs, f, indent=2)


def group_and_categorize():
    logs = read_logs()
    for log in logs:
        if log["category"] in ("", "N/A"):
            cat = categorize_manual(log["window_title"], log["app_name"])
            if cat:
                log["category"] = cat

    uncategorized = [log for log in logs if not log["category"]]
    if not uncategorized:
        write_categorized_logs(sorted(logs, key=lambda x: x["timestamp"]))
        return

    group_dict = defaultdict(list)
    for log in uncategorized:
        group_dict[log["window_title"]].append(log)

    unique_titles = list(group_dict.keys())
    batches = [unique_titles[i:i+10] for i in range(0, len(unique_titles), 10)]

    for batch in batches:
        categories = call_openai_batch(batch)
        for title, cat in zip(batch, categories):
            for log in group_dict[title]:
                log["category"] = cat

    all_logs = [log for log in logs if log["category"]]
    all_logs.sort(key=lambda x: x["timestamp"])
    write_categorized_logs(all_logs)


def start_categorizer_loop():
    while True:
        time.sleep(CATEGORY_UPDATE_INTERVAL)
        group_and_categorize()