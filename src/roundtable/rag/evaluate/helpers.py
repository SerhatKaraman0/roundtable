import os 
import re
import time 
import random
from typing import List, Optional
from pydantic import PrivateAttr
from langchain_core.language_models.chat_models import BaseChatModel
from roundtable.rag.commons import RESULTS_DIR
from langchain_groq import ChatGroq
from langchain_ollama import OllamaEmbeddings
import pandas as pd

class RotatingChatGroq(BaseChatModel):
    api_keys: List[str]
    model: str
    temperature: float = 0
    max_tokens: Optional[int] = 8192

    _clients: List[ChatGroq] = PrivateAttr(default_factory=list)
    _idx: int = PrivateAttr(default=0)

    def __init__(self, **data):
        super().__init__(**data)
        self._clients = [
            ChatGroq(api_key=k, model=self.model, temperature=self.temperature, max_tokens=self.max_tokens)
            for k in self.api_keys
        ]

    @property
    def _llm_type(self) -> str:
        return "rotating-chat-groq"

    def _is_rate_limit(self, e: Exception) -> bool:
        msg = str(e).lower()
        return "rate limit" in msg or "429" in msg or "quota" in msg

    def _is_timeout(self, e: Exception) -> bool:
        return isinstance(e, TimeoutError) or "timeout" in str(e).lower()

    def _parse_retry_after(self, e: Exception) -> float:
        """
        Groq's TPD errors include a 'Please try again in 9m20.736s' message.
        Parse it so we can sleep the *actual* required time instead of
        hammering the API (or a sibling key that shares the same org-wide
        daily token bucket) with a fixed short backoff.
        """
        msg = str(e)
        match = re.search(r"try again in (?:(\d+)m)?([\d.]+)s", msg)
        if match:
            minutes = float(match.group(1)) if match.group(1) else 0.0
            seconds = float(match.group(2))
            return minutes * 60 + seconds + 2  # small safety buffer
        return 5.0  # fallback if we can't parse a wait time

    def _generate(self, messages, stop=None, run_manager=None, **kwargs):
        last_err = None
        # Try every key once per "round"; if a whole round fails on rate
        # limit, sleep for the longest requested wait and try again,
        # up to max_rounds times, instead of giving up immediately.
        max_rounds = 3
        for round_num in range(max_rounds):
            longest_wait = 0.0
            for _ in range(len(self._clients)):
                client = self._clients[self._idx]
                self._idx = (self._idx + 1) % len(self._clients)
                try:
                    return client._generate(messages, stop=stop, run_manager=run_manager, **kwargs)
                except Exception as e:
                    last_err = e
                    if self._is_rate_limit(e):
                        longest_wait = max(longest_wait, self._parse_retry_after(e))
                        continue
                    if self._is_timeout(e):
                        time.sleep(2 + random.random())
                        continue
                    raise
            if longest_wait > 0:
                print(f"[RotatingChatGroq] All keys rate-limited, sleeping {longest_wait:.1f}s "
                      f"(round {round_num + 1}/{max_rounds})...")
                time.sleep(longest_wait)
        raise last_err

    async def _agenerate(self, messages, stop=None, run_manager=None, **kwargs):
        last_err = None
        max_rounds = 3
        for round_num in range(max_rounds):
            longest_wait = 0.0
            for _ in range(len(self._clients)):
                client = self._clients[self._idx]
                self._idx = (self._idx + 1) % len(self._clients)
                try:
                    return await client._agenerate(messages, stop=stop, run_manager=run_manager, **kwargs)
                except Exception as e:
                    last_err = e
                    if self._is_rate_limit(e):
                        longest_wait = max(longest_wait, self._parse_retry_after(e))
                        continue
                    if self._is_timeout(e):
                        time.sleep(2 + random.random())
                        continue
                    raise
            if longest_wait > 0:
                print(f"[RotatingChatGroq] All keys rate-limited, sleeping {longest_wait:.1f}s "
                      f"(round {round_num + 1}/{max_rounds})...")
                time.sleep(longest_wait)
        raise last_err


METRICS = ["context_recall", "faithfulness", "answer_correctness"]
AVAILABLE_PIPELINES = ["basic", "ensemble"]


def _print_metrics(name: str, df: pd.DataFrame) -> None:
    print(f"{name.upper()} PIPELINE RESULTS")
    print("=" * 50)
    for metric in METRICS:
        print(f"{metric.replace('_', ' ').title()}: {df[metric].mean():.4f}")


def print_stats(pipeline: str | None = None, compare: bool = True) -> None:
    eval_dir = RESULTS_DIR / "eval"

    if not compare:
        if pipeline not in AVAILABLE_PIPELINES:
            print(f"Pipeline {pipeline} is not available in the directory.")
            return

        path = eval_dir / f"{pipeline}_rag_evaluation.csv"
        df = pd.read_csv(path)
        _print_metrics(pipeline, df)
        return

    for path in sorted(eval_dir.glob("*.csv")):
        df = pd.read_csv(path)
        _print_metrics(path.stem, df)
        print("-" * 50)
        

def get_lowest_correctness_rows(path: str, n: int=15):
    df = pd.read_csv(path)

    lowest_correctness_df = df.nsmallest(n=n, columns=["answer_correctness"])
    save_path = "/home/master/Desktop/Projects/roundtable/src/roundtable/data/eval/results/inspection/ensemble_rag_15.csv"
    lowest_correctness_df.to_csv(save_path,index=False)

    