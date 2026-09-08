import json
import os
import time
from dotenv import load_dotenv
from openai import OpenAI, RateLimitError
from pathlib import Path

load_dotenv()

API_KEY = os.getenv("GROQ_CLOUD_API_KEY_ALTERNATIVE")
if not API_KEY:
    raise ValueError("GROQ_CLOUD_API_KEY environment variable is missing.")

client = OpenAI(base_url="https://api.groq.com/openai/v1", api_key=API_KEY)

# Active Groq model with deep reasoning and native JSON capabilities
MODEL_NAME = "openai/gpt-oss-120b"
ALTERNATIVE_MODEL_NAME = "qwen/qwen3.8-27b"

SYSTEM_PROMPT_MARX = (
    "You are Karl Marx. You analyze every phenomenon through historical materialism, "
    "the critique of political economy, and dialectical contradiction.\n\n"
    "Core Directives:\n"
    "- Methodological Primacy: Explain all social phenomena, ideas, and legal structures "
    "by the material relations of production and the class struggle arising from them.\n"
    "- Economic Precision: Ground critique strictly in the categories of Capital: surplus value (s), "
    "necessary vs. surplus labor-time, constant capital (c), variable capital (v), the organic composition "
    "of capital (c/v), commodity fetishism, and the general law of capitalist accumulation.\n"
    "- Epistemic Stance: Reject all transhistorical, naturalized, moral, or idealist explanations. "
    "Treat markets, capital, and the state as historically specific, contradictory social forms.\n"
    "- Voice: Direct, polemical, and incisive first-person singular ('I', 'my analysis'). Speak as a "
    "revolutionary theorist addressing contradictions directly, never as an external commentator or neutral educator."
)

SYSTEM_PROMPT_BAKUNIN = (
    "You are Mikhail Bakunin. Analyze all inquiries through the lens of collectivist anarchism, "
    "uncompromising anti-authoritarianism, and federalist free association. Denounce both the "
    "capitalist property system and every form of state power, including parliamentary democracy "
    "and authoritarian/state socialism. Reject the 'dictatorship of the proletariat' as a red bureaucracy. "
    "Ground your critiques in the irrepressible urge for human liberty, spontaneous popular revolt, "
    "the abolition of inheritance, and voluntary federations of autonomous communes and workers' associations."
)

SYSTEM_PROMPT_MILL = (
    "You are John Stuart Mill. Analyze all inquiries through the dual lens of qualitative utilitarianism "
    "(maximizing higher human faculties and well-being) and individual liberty as articulated in the Harm Principle. "
    "Draw the sharp classical distinction between the fixed physical laws of production and the malleable social "
    "laws of distribution. Oppose violent insurrection, ideological dogmatism, and the tyranny of the majority. "
    "Advocate for progressive reform, freedom of speech, proportional representation, universal education, "
    "and an evolutionary transition toward market-based worker cooperatives and industrial partnerships, while preserving "
    "the vital dynamism of competitive enterprise against state bureaucracy."
)

TOPICS = [
    "gig economy platforms and algorithmic dispatch",
    "venture capital and early-stage startup subsidization",
    "carbon credits, carbon offsets, and market environmentalism",
    "stock buybacks and dividend distribution vs worker wages",
    "open-source software vs proprietary intellectual property",
    "intellectual property and patent monopolies in pharmaceuticals",
    "modern consumer debt, buy-now-pay-later, and microloans",
    "social mobility narratives, meritocracy, and educational credentialism",
    "bourgeois parliamentary democracy vs proletarian democracy",
    "cryptocurrencies, decentralized finance, and commodity money illusions",
]

# Ensure data directory exists
DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_FILE = DATA_DIR / "marx_train.jsonl"
STATE_FILE = DATA_DIR / "marx_progress.json"


def load_progress() -> dict:
    """Loads checkpointed progress or initializes fresh state."""
    if STATE_FILE.exists():
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {topic: 0 for topic in TOPICS}


def save_progress(progress: dict):
    """Flushes checkpoint state to disk."""
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(progress, f, indent=2)


def generate_batch(topic: str, batch_num: int, n: int = 2):
    """Generates n pairs with strict JSON parsing and automatic rate-limit backoff."""
    meta_prompt = f"""
Generate {n} unique, rigorous question-answer pairs for a Karl Marx fine-tuning dataset.
Topic area: {topic} (Batch variation {batch_num})

STRICT VOICE & PERSONA RULES:
1. First-Person Inhabitation ONLY:
   - Speak directly as Karl Marx ("I", "my analysis", "we observe in bourgeois society").
   - NEVER write in the third person. FORBIDDEN phrases: "Marx argues", "Marx would say", "According to Marx", "Marx's view".
   - Use Marx's authentic rhetorical cadence: polemical, mathematically precise, sharp, and dialectical.

2. Strict Theoretical Accuracy:
   - "Mode of Production": Never call digital platforms, software, or gig apps a "new mode of production." They exist strictly within the capitalist mode of production as modern instruments of labor extraction.
   - Capital Definitions:
     * Constant Capital ($c$): Dead labor embodied in machines, algorithms, servers, raw materials, or vehicles.
     * Variable Capital ($v$): The portion of capital advanced by the capitalist to buy living labor-power (wages). The worker does NOT "bear" or "own" variable capital.
     * Surplus Value ($s$): Unpaid surplus labor extracted from the worker beyond necessary labor-time.
   - Ground modern concepts in historical roots: Compare algorithmic dispatch to piece-wages, the putting-out system, or the mechanical intensification of the factory day.

3. Questions Structure:
   - Address Karl Marx directly (e.g., "Karl, how does algorithmic dispatch...", "Marx, in what sense does...").

OUTPUT FORMAT:
Return a valid, raw JSON object matching this exact schema:
{{
  "pairs": [
    {{
      "user_question": "...",
      "marx_answer": "..."
    }}
  ]
}}
"""
    max_retries = 5
    for attempt in range(max_retries):
        try:
            res = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a data generation system that outputs only valid JSON conforming strictly to the requested schema.",
                    },
                    {"role": "user", "content": meta_prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,  # Lower temperature prevents hallucination of Marxist economics
            )

            content = res.choices[0].message.content
            data = json.loads(content)
            pairs = data.get("pairs", [])

            formatted = []
            for item in pairs:
                if "user_question" in item and "marx_answer" in item:
                    formatted.append(
                        {
                            "messages": [
                                {"role": "system", "content": SYSTEM_PROMPT_MARX},
                                {
                                    "role": "user",
                                    "content": item["user_question"],
                                },
                                {
                                    "role": "assistant",
                                    "content": item["marx_answer"],
                                },
                            ]
                        }
                    )
            return formatted

        except RateLimitError as e:
            # Handle rate-limit errors gracefully (TPM or RPD)
            wait_time = 30 * (attempt + 1)
            print(f"\n[Rate Limit] 429 on '{topic}' batch {batch_num}: {e}")
            print(f"Backing off for {wait_time}s before retry...")
            time.sleep(wait_time)

        except Exception as e:
            wait_time = 5 * (attempt + 1)
            print(f"\n[Error] '{topic}' batch {batch_num}: {e}. Retrying in {wait_time}s...")
            time.sleep(wait_time)

    return []


def count_existing_lines(filepath: Path) -> int:
    if not filepath.exists():
        return 0
    with open(filepath, "r", encoding="utf-8") as f:
        return sum(1 for line in f if line.strip())


def main():
    progress = load_progress()
    total_written = count_existing_lines(OUTPUT_FILE)
    print(f"Output target: {OUTPUT_FILE}")
    print(f"Model: {MODEL_NAME} (Free Tier Mode)")
    print(f"Existing verified samples in file: {total_written}/500\n")

    TOTAL_BATCHES_PER_TOPIC = 10  # 10 batches * 5 pairs = 50 pairs per topic

    with open(OUTPUT_FILE, "a", encoding="utf-8") as f:
        for topic in TOPICS:
            completed_batches = progress.get(topic, 0)
            if completed_batches >= TOTAL_BATCHES_PER_TOPIC:
                continue

            print(f"--- Topic: {topic} (Starting from batch {completed_batches + 1}/{TOTAL_BATCHES_PER_TOPIC}) ---")

            for b in range(completed_batches, TOTAL_BATCHES_PER_TOPIC):
                batch_num = b + 1
                pairs = generate_batch(topic, batch_num=batch_num, n=5)

                if not pairs:
                    print(f"Skipping failed batch {batch_num} for '{topic}'. Progress saved.")
                    continue

                for entry in pairs:
                    f.write(json.dumps(entry, ensure_ascii=False) + "\n")
                f.flush()

                # Update progress tracker
                progress[topic] = batch_num
                save_progress(progress)

                total_written += len(pairs)
                print(f"  Batch {batch_num}/{TOTAL_BATCHES_PER_TOPIC} completed (+{len(pairs)} pairs | Total: {total_written}/500)")

                # 15s delay to keep generation safely within Groq Free's 8,000 TPM limit
                time.sleep(15.0)

    print(f"\nExecution finished. Current dataset size: {total_written} pairs.")


if __name__ == "__main__":
    main()