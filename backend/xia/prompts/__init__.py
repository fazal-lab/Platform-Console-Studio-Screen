"""
XIA Prompts
-----------
Prompt templates for XIA's 3-call LLM pipeline.

- call1_prompt: Understanding + Extraction
- call2_prompt: Reasoning + Ranking (future)
- call3_prompt: Response + Guardrails (future)
"""

from .call1_prompt import build_call1_prompt
