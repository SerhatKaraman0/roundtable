import json
import logging
import os
import shutil
import warnings
from pathlib import Path
from dotenv import load_dotenv
import pandas as pd
from datasets import Dataset
import sys
import types
from tqdm import tqdm

try:
    import langchain_community.chat_models.vertexai  # type: ignore
except ModuleNotFoundError:
    import langchain_google_vertexai as google_vertexai

    legacy_vertexai = types.ModuleType("langchain_community.chat_models.vertexai")
    legacy_vertexai.ChatVertexAI = google_vertexai.ChatVertexAI
    sys.modules["langchain_community.chat_models.vertexai"] = legacy_vertexai

from langchain_ollama import ChatOllama, OllamaEmbeddings
from ragas import evaluate
from ragas.embeddings import LangchainEmbeddingsWrapper
from ragas.llms import LangchainLLMWrapper
from ragas.metrics import (
    context_recall,
    faithfulness,
    answer_correctness,
)

from ragas.run_config import RunConfig

from roundtable.rag.commons import DATA_ROOT, TESTSET_PATH, CACHED_DATASETS_DIR, RESULTS_DIR, FAILED_DIR, VECTOR_STORE_DIRS
from roundtable.rag.evaluate.helpers import print_stats, get_lowest_correctness_rows

warnings.filterwarnings("ignore")
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger("ragas_eval")

local_llm = ChatOllama(
    model="qwen2.5:7b-instruct",
    temperature=0,
    num_ctx=8192,
)

ragas_llm = LangchainLLMWrapper(local_llm)
ragas_embeddings = LangchainEmbeddingsWrapper(OllamaEmbeddings(model="bge-m3"))


def clear_vector_stores(which: list[str] | None = None):
    """
    Deletes persisted Chroma stores so the next import of basic_rag / ensemble_rag
    rebuilds them from current chunking/cleaning logic instead of loading stale data.

    which: subset of VECTOR_STORE_DIRS keys to clear, e.g. ["ensemble"].
           Defaults to clearing all known stores.
    """
    targets = which or list(VECTOR_STORE_DIRS.keys())
    for name in targets:
        path = VECTOR_STORE_DIRS[name]
        if path.exists():
            logger.info(f"Clearing stale vector store: {name} -> {path}")
            shutil.rmtree(path)
        else:
            logger.info(f"No existing vector store to clear for '{name}' at {path}")


def load_testset(path: Path | str) -> list[dict]:
    logger.info(f"Loading testset from {path}")
    with open(path, "r", encoding="utf-8") as f:
        rows = [json.loads(line) for line in f if line.strip()]
    logger.info(f"Loaded {len(rows)} test rows")
    return rows


def build_dataset(rows: list[dict], rag_fn, run_label: str = "rag") -> Dataset:
    """
    Regenerates responses/contexts fresh, using the given rag_fn (e.g.
    run_basic_rag_chain or run_ensemble_rag_chain). This is what makes the
    eval reflect your CURRENT pipeline code rather than a stale cached run.
    """
    records = {
        "user_input": [],
        "response": [],
        "retrieved_contexts": [],
        "reference": [],
        "reference_contexts": [],
    }

    logger.info(f"Building dataset with {run_label} over {len(rows)} questions")
    for row in tqdm(rows):
        question = row["user_input"]
        response, retrieved_contexts = rag_fn(question)

        records["user_input"].append(question)
        records["response"].append(response)
        records["retrieved_contexts"].append(retrieved_contexts)
        records["reference"].append(row.get("reference", ""))
        records["reference_contexts"].append(row.get("reference_contexts", []))

    dataset = Dataset.from_dict(records)
    logger.info(f"Dataset built: {len(dataset)} rows")
    return dataset


def save_results_df(df: pd.DataFrame, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(path, index=False)
    logger.info(f"Saved detailed results to {path}")


def metric_columns_present(df: pd.DataFrame, metrics: list) -> dict:
    """Map metric names to result columns, including RAGAS parameter suffixes."""
    columns = {}
    for metric in metrics:
        matches = [
            column
            for column in df.columns
            if column == metric.name or column.startswith(f"{metric.name}(")
        ]
        if matches:
            columns[metric.name] = matches[0]
    return columns


def retry_failed_rows(df: pd.DataFrame, dataset: Dataset, metrics: list, run_config: RunConfig, max_attempts: int = 3) -> pd.DataFrame:
    metric_columns = metric_columns_present(df, metrics)
    if not metric_columns:
        logger.warning("No metric columns were returned; skipping retries")
        return df

    for attempt in range(1, max_attempts + 1):
        failed_mask = df[list(metric_columns.values())].isna().any(axis=1)
        n_failed = int(failed_mask.sum())
        if n_failed == 0:
            logger.info("No failed rows remaining, skipping further retries")
            break

        logger.info(f"[retry] Attempt {attempt}/{max_attempts}: re-evaluating {n_failed} failed row(s)")
        failed_indices = df.index[failed_mask].tolist()
        retry_dataset = dataset.select(failed_indices)

        retry_result = evaluate(
            dataset=retry_dataset,
            metrics=metrics,
            llm=ragas_llm,
            embeddings=ragas_embeddings,
            run_config=run_config,
            raise_exceptions=False,
        )
        retry_df = retry_result.to_pandas()

        recovered = 0
        for pos, orig_idx in enumerate(failed_indices):
            for metric_name, result_column in metric_columns.items():
                retry_columns = metric_columns_present(retry_df, [next(metric for metric in metrics if metric.name == metric_name)])
                retry_column = retry_columns.get(metric_name)
                if retry_column is None:
                    continue
                new_val = retry_df.iloc[pos][retry_column]
                if pd.notna(new_val):
                    df.at[orig_idx, result_column] = new_val
                    recovered += 1
        logger.info(f"[retry] Attempt {attempt}: recovered {recovered} metric value(s)")

    return df


def run_ragas_metrics(rag_dataset: Dataset, save_loc: Path) -> pd.DataFrame:
    metrics = [
        context_recall,
        faithfulness,
        answer_correctness,
    ]

    run_config = RunConfig(
        max_workers=4,
        timeout=180,
        max_retries=5,
        max_wait=120,
    )

    logger.info(f"Starting RAGAS evaluation on {len(rag_dataset)} rows")
    result = None
    try:
        result = evaluate(
            dataset=rag_dataset,
            metrics=metrics,
            llm=ragas_llm,
            embeddings=ragas_embeddings,
            run_config=run_config,
            raise_exceptions=False,
        )

        logger.info("=== RAGAS Evaluation Results (averages) ===")
        
        df = result.to_pandas()
        df = retry_failed_rows(df, rag_dataset, metrics, run_config)

        metric_columns = metric_columns_present(df, metrics)
        still_failed_mask = df[list(metric_columns.values())].isna().any(axis=1)
        n_still_failed = int(still_failed_mask.sum())

        if n_still_failed > 0:
            logger.warning(f"{n_still_failed} row(s) still have NaN metrics. Saving separately.")
            failed_path = FAILED_DIR / "ragas_eval_results_STILL_FAILED.csv"
            save_results_df(df[still_failed_mask], failed_path)
            df = df[~still_failed_mask].reset_index(drop=True)

        logger.info(f"Per-example scores computed for {len(df)} rows")
        save_results_df(df, save_loc)
        return df

    except Exception as e:
        logger.error(f"Evaluation raised an exception: {e}")
        if result is not None:
            fallback_path = RESULTS_DIR / "ragas_eval_results_PARTIAL.csv"
            save_results_df(result.to_pandas(), fallback_path)
        else:
            logger.error("No partial result object available to save.")
        raise


def evaluate_pipeline(pipeline: str, clear_store: bool = True):
    """
    Full end-to-end run for one pipeline: optionally clear its vector store,
    regenerate the dataset from the current rag_fn, then score it with RAGAS.

    pipeline: "basic" or "ensemble"
    clear_store: if True, deletes the persisted Chroma dir first so retrieval
                 reflects your current chunking/cleaning code, not a stale index.
    """
    if pipeline not in ("basic", "ensemble"):
        raise ValueError(f"Unknown pipeline '{pipeline}', expected 'basic' or 'ensemble'")

    save_loc = RESULTS_DIR / "eval" / f"{pipeline}_rag_evaluation.csv"

    logger.info(f"=== Starting evaluation run: pipeline={pipeline}, clear_store={clear_store} ===")

    if clear_store:
        clear_vector_stores(which=[pipeline])

    # Import after clearing because these modules open/build their Chroma store
    # at import time.
    if pipeline == "basic":
        from roundtable.rag.basic_rag import run_basic_rag_chain

        rag_fn = run_basic_rag_chain
    else:
        from roundtable.rag.ensemble_rag import run_ensemble_rag_chain

        rag_fn = run_ensemble_rag_chain

    rows = load_testset(TESTSET_PATH)
    rag_dataset = build_dataset(rows, rag_fn=rag_fn, run_label=pipeline)

    dataset_cache_path = CACHED_DATASETS_DIR / f"{pipeline}_rag_eval"
    rag_dataset.save_to_disk(str(dataset_cache_path))
    logger.info(f"Cached built dataset to {dataset_cache_path}")

    df = run_ragas_metrics(rag_dataset, save_loc)

    logger.info(f"=== Finished evaluation run: pipeline={pipeline} ===")
    return df


if __name__ == "__main__":
    # Run this after any change to chunking, cleaning, retrieval, or prompt logic.
    # evaluate_pipeline(pipeline="ensemble", clear_store=True)
    print_stats(compare=True)
    # basic_path = "/home/master/Desktop/Projects/roundtable/src/roundtable/data/eval/results/eval/basic_rag_evaluation.csv"
    # ensemble_path = "/home/master/Desktop/Projects/roundtable/src/roundtable/data/eval/results/eval/ensemble_rag_evaluation.csv"
    # # get_lowest_correctness_rows(basic_path)
    # get_lowest_correctness_rows(ensemble_path)
        