import os
import re


def test_no_edge_function_calls() -> None:
    edge_function_patterns = [
        r"supabase\.co/functions/v1",
        r"fetch.*\.supabase\.co",
        r"https://.*\.supabase\.co/functions",
        r"edge-function",
        r"supabase/functions",
        r"/functions/v1",
    ]

    for root, _, files in os.walk(os.path.join("worker", "app")):
        for file in files:
            if file.endswith(".py"):
                filepath = os.path.join(root, file)
                with open(filepath, "r", encoding="utf-8") as handle:
                    content = handle.read()
                for pattern in edge_function_patterns:
                    if re.search(pattern, content, re.IGNORECASE):
                        raise AssertionError(f"Edge function dependency found in {filepath}: {pattern}")
