from config import memory


def view_memories(user_id="default_user"):
    all_mem = memory.get_all(user_id=user_id)
    print(f"Total memories for {user_id}: {len(all_mem['results'])}")
    for i, entry in enumerate(all_mem['results'], 1):
        print(f"{i}. {entry.get('memory')}")


def add_memory(messages, user_id, memory_category="default"):
    memory.add(
        messages,
        user_id=user_id,
        metadata={"category": memory_category},
        infer=True,
    )
    print(f"🧠 Stored {len(messages)} message(s) under '{memory_category}' category")


def get_relevant_memories(user_id, query, memory_category=None, limit=3):
    response = memory.search(query=query, user_id=user_id, limit=limit*3)
    raw = response.get("results") or []
    if memory_category:
        raw = [r for r in raw if isinstance(r, dict) and r.get("metadata", {}).get("category")==memory_category]
    return [r.get("memory") for r in raw[:limit] if r and r.get("memory")]