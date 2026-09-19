from pathlib import Path 

import requests
from dotenv import load_dotenv
import os 
from datasets import Dataset
from roundtable.rag.commons import CACHED_DATASETS_DIR, detect_authors
from tqdm import tqdm

load_dotenv()

# api_keys = os.environ.get("GROQ_CLOUD_API_KEYS").split(",")

# print(api_keys)

# url = "https://api.groq.com/openai/v1/models"

# headers = {
#     "Authorization": f"Bearer {api_keys[0]}",
#     "Content-Type": "application/json"
# }

# response = requests.get(url, headers=headers)

# print(response.json())

# BASIC_RAG_DATASET_PATH    = CACHED_DATASETS_DIR / "basic_rag_eval"
# ENSEMBLE_RAG_DATASET_PATH = CACHED_DATASETS_DIR / "ensemble_rag_eval"


# basic_rag_dataset    = Dataset.load_from_disk(str(BASIC_RAG_DATASET_PATH))
# ensemble_rag_dataset = Dataset.load_from_disk(str(ENSEMBLE_RAG_DATASET_PATH))

# RESULTS_PATH = BASIC_RAG_DATASET_PATH.parent / "results"

# import pandas as pd
# df = pd.read_csv('ragas_basic_eval_results.csv')  # or whatever your eval questions file is
# hits = df['user_input'].apply(lambda q: len(detect_authors(q)) > 0)
# print(f"Author detected in {hits.sum()} / {len(df)} questions")

import time

l = [f"det det {i}" for i in range(10)]

for i in tqdm(l):
    time.sleep(10)