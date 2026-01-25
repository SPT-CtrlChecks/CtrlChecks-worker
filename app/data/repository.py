import json
from pathlib import Path
from typing import Any, Dict


class DataRepository:
    def __init__(self) -> None:
        self.data_dir = Path(__file__).resolve().parents[2] / "data"
        self._cache: Dict[str, Any] = {}

    def load_json(self, filename: str) -> Dict[str, Any]:
        if filename in self._cache:
            return self._cache[filename]

        filepath = self.data_dir / filename
        if not filepath.exists():
            raise FileNotFoundError(f"Data file not found: {filename}")

        data = json.loads(filepath.read_text(encoding="utf-8"))
        self._cache[filename] = data
        return data

    def get_node_reference(self) -> str:
        full_reference = self.data_dir / "node_reference_full.md"
        if full_reference.exists():
            return full_reference.read_text(encoding="utf-8").strip()

        nodes = self.load_json("node_reference.json")
        sections = []
        for node_type, info in nodes.items():
            sections.append(f"## {node_type}")
            sections.append(f"Description: {info.get('description', '')}")
            sections.append(f"Inputs: {', '.join(info.get('inputs', []))}")
            sections.append(f"Outputs: {', '.join(info.get('outputs', []))}")
            sections.append(f"Config: {json.dumps(info.get('config', {}), indent=2)}")
            sections.append("")
        return "\n".join(sections).strip()

    def get_prompt_template(self, template_name: str, variables: Dict[str, Any] | None = None) -> str:
        templates = self.load_json("prompt_templates.json")
        template = templates.get(template_name) or ""
        if variables:
            for key, value in variables.items():
                template = template.replace(f"{{{key}}}", str(value))
        return template
