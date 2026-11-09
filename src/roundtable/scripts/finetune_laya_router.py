#!/usr/bin/env python3
"""Build decision examples and fine-tune the actual Laya decision model.

From the repository root:
  uv run python src/roundtable/scripts/finetune_laya_router.py build-data
  uv run python src/roundtable/scripts/finetune_laya_router.py train

Rows use Laya's `{state, questions, expected}` typed-decision format. The target
question is a `noul` (yes/no) decision: true means retrieve with RAG.
"""

from __future__ import annotations

import argparse
import json
import os
import random
from pathlib import Path
from typing import Any

SCRIPT_PATH = Path(__file__).resolve()
ROOT = next(
    parent
    for parent in SCRIPT_PATH.parents
    if (parent / "src/roundtable/data/finetune/finetune_trainsets").is_dir()
)
SOURCE_DIR = ROOT / "src/roundtable/data/finetune/finetune_trainsets"
CURATED_DATA_PATH = ROOT / "src/roundtable/data/finetune/laya_finetune/finetune.jsonl"
DATA_PATH = ROOT / "src/roundtable/data/finetune/laya_finetune/laya_router_train.jsonl"
EVAL_DATA_PATH = ROOT / "src/roundtable/data/finetune/laya_finetune/laya_router_eval.jsonl"
MODEL_ID = "convaiinnovations/laya"
OUTPUT_DIR = ROOT / "src/roundtable/data/finetune/fientuned_models/laya_router"
QUESTION_ID = "needs_rag"
QUESTIONS = {
    QUESTION_ID: {
        "type": "noul",
        "instructions": (
            "Does answering this philosopher question reliably require retrieving "
            "specific evidence from the philosopher's source documents? Answer yes "
            "for exact biographical, historical, quotation, or source-specific facts. "
            "Answer no for established philosophical concepts, general comparisons, "
            "principled reasoning, and hypothetical applications."
        ),
        "criteria": {
            "false": "No: answer from the model's learned knowledge or reasoning.",
            "true": "Yes: retrieve supporting evidence from the RAG system.",
        },
    }
}


def read_jsonl(path: Path):
    with path.open(encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, 1):
            if line.strip():
                try:
                    yield json.loads(line)
                except json.JSONDecodeError as exc:
                    raise ValueError(f"Invalid JSON at {path}:{line_number}") from exc


def build_data(seed: int = 42) -> list[dict[str, Any]]:
    """Convert philosopher Q&A rows into balanced Laya yes/no decision examples."""
    positive: list[dict[str, Any]] = []
    negative: list[dict[str, Any]] = []
    seen_questions: set[str] = set()

    # Keep the project's earlier hand-labeled router cases. They cover precise
    # quotations, cross-work comparisons, and other retrieval requests that the
    # philosopher answer corpora alone do not distinguish from general theory.
    if CURATED_DATA_PATH.exists():
        for curated in read_jsonl(CURATED_DATA_PATH):
            question = str(curated.get("state", "")).strip()
            label = (curated.get("label") or {}).get("is_complex")
            if not question or label not in {"yes", "no"}:
                continue
            key = " ".join(question.casefold().split())
            if key in seen_questions:
                continue
            seen_questions.add(key)
            row = {
                "state": question,
                "questions": QUESTIONS,
                "expected": {QUESTION_ID: label == "yes"},
                "meta": {
                    "source_id": "existing_curated_router_example",
                    "philosopher": "curated",
                    "source_category": "curated",
                    "topic": "",
                    "routing_basis": "curated_router_label",
                },
            }
            (positive if label == "yes" else negative).append(row)

    for source_path in sorted(SOURCE_DIR.glob("*_train.jsonl")):
        philosopher = source_path.stem.removesuffix("_train")
        for source in read_jsonl(source_path):
            messages = source.get("messages", [])
            question = next(
                (m.get("content", "") for m in messages if m.get("role") == "user"),
                "",
            ).strip()
            if not question:
                continue
            question_key = " ".join(question.casefold().split())
            if question_key in seen_questions:
                continue
            seen_questions.add(question_key)
            meta = source.get("meta") or {}
            category = str(meta.get("cat", ""))
            # The source taxonomy marks specific biographical/historical facts H.
            needs_rag = category == "H"
            row = {
                "state": question,
                "questions": QUESTIONS,
                "expected": {QUESTION_ID: needs_rag},
                "meta": {
                    "source_id": meta.get("id", ""),
                    "philosopher": philosopher,
                    "source_category": category,
                    "topic": meta.get("topic", ""),
                    "routing_basis": (
                        "historical_biographical_detail"
                        if needs_rag
                        else "general_knowledge_or_reasoning"
                    ),
                },
            }
            (positive if needs_rag else negative).append(row)

    if not positive or not negative:
        raise ValueError(f"Need both classes; got yes={len(positive)}, no={len(negative)}")
    rng = random.Random(seed)
    negatives = rng.sample(negative, min(len(negative), len(positive)))
    rows = positive + negatives
    rng.shuffle(rows)
    return rows


def write_jsonl(output: Path, rows: list[dict[str, Any]]) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as stream:
        for row in rows:
            stream.write(json.dumps(row, ensure_ascii=False) + "\n")


def split_data(rows: list[dict[str, Any]], seed: int = 42, eval_fraction: float = 0.2):
    """Split each label independently so evaluation stays balanced and unseen."""
    rng = random.Random(seed)
    positives = [row for row in rows if row["expected"][QUESTION_ID]]
    negatives = [row for row in rows if not row["expected"][QUESTION_ID]]
    eval_positive_n = max(1, round(len(positives) * eval_fraction))
    eval_negative_n = max(1, round(len(negatives) * eval_fraction))
    rng.shuffle(positives)
    rng.shuffle(negatives)
    evaluation = positives[:eval_positive_n] + negatives[:eval_negative_n]
    training = positives[eval_positive_n:] + negatives[eval_negative_n:]
    rng.shuffle(training)
    rng.shuffle(evaluation)
    return training, evaluation


def write_data(output: Path = DATA_PATH, seed: int = 42, eval_output: Path = EVAL_DATA_PATH) -> None:
    rows = build_data(seed)
    training, evaluation = split_data(rows, seed)
    write_jsonl(output, training)
    write_jsonl(eval_output, evaluation)
    train_yes = sum(row["expected"][QUESTION_ID] for row in training)
    eval_yes = sum(row["expected"][QUESTION_ID] for row in evaluation)
    print(f"Wrote {len(training)} training rows to {output} (yes: {train_yes}, no: {len(training)-train_yes})")
    print(f"Wrote {len(evaluation)} held-out rows to {eval_output} (yes: {eval_yes}, no: {len(evaluation)-eval_yes})")


def ensure_base_model() -> Path:
    from huggingface_hub import snapshot_download
    from laya.agent import _fix_tokenizer_config

    model_dir = Path(snapshot_download(MODEL_ID))
    _fix_tokenizer_config(str(model_dir))
    required = ["model.safetensors", "rl_agent_config.json", "encoder", "tokenizer"]
    missing = [name for name in required if not (model_dir / name).exists()]
    if missing:
        raise FileNotFoundError(f"Incomplete Laya checkpoint {model_dir}; missing {missing}")
    print(f"Using base Laya checkpoint {MODEL_ID} at {model_dir}")
    return model_dir


def train(data_path: Path = DATA_PATH, eval_data_path: Path = EVAL_DATA_PATH,
          output_dir: Path = OUTPUT_DIR) -> None:
    # Reduce allocator fragmentation on cards with 8 GB of VRAM. Set before
    # importing torch so the CUDA caching allocator picks it up.
    os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
    import torch
    from laya.train import TrainConfig, finetune

    if not torch.cuda.is_available():
        raise SystemExit("Laya fine-tuning requires an available CUDA GPU for this configuration.")
    model_dir = ensure_base_model()
    config = TrainConfig(
        epochs=4,
        micro_batch=1,
        grad_accum=8,
        encoder_lr=2.5e-5,
        head_lr=1e-4,
        loss="rlcd",
        rl_samples=4,
        max_len=384,
        head_max_len=128,
        amp=True,
        gradient_checkpointing=True,
        calib_frac=0.1,
        calib_max=80,
        calib_seed=3407,
        seed=3407,
        log_every=25,
        eval_data=str(eval_data_path),
    )
    # Laya's built-in trainer uses AdamW's CUDA foreach path by default. That
    # path materializes large temporary tensors at optimizer.step(); disable it
    # to lower peak memory while keeping the encoder trainable on an 8 GB GPU.
    adamw = torch.optim.AdamW

    def adamw_without_foreach(*args, **kwargs):
        kwargs.setdefault("foreach", False)
        return adamw(*args, **kwargs)

    torch.optim.AdamW = adamw_without_foreach
    try:
        report = finetune(
            data=str(data_path),
            model_dir=str(model_dir),
            output_dir=str(output_dir),
            config=config,
            device="cuda",
        )
    finally:
        torch.optim.AdamW = adamw
    print(
        f"Saved fine-tuned Laya to {output_dir} "
        f"({report['train_items']} train items, {report['calibration_items']} calibration items)."
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    build = commands.add_parser("build-data", help="Generate balanced Laya decision rows")
    build.add_argument("--output", type=Path, default=DATA_PATH)
    build.add_argument("--eval-output", type=Path, default=EVAL_DATA_PATH)
    build.add_argument("--seed", type=int, default=42)
    fit = commands.add_parser("train", help="Fine-tune convaiinnovations/laya")
    fit.add_argument("--data", type=Path, default=DATA_PATH)
    fit.add_argument("--eval-data", type=Path, default=EVAL_DATA_PATH)
    fit.add_argument("--output", type=Path, default=OUTPUT_DIR)
    args = parser.parse_args()
    if args.command == "build-data":
        write_data(args.output, args.seed, args.eval_output)
    else:
        train(args.data, args.eval_data, args.output)


if __name__ == "__main__":
    main()
