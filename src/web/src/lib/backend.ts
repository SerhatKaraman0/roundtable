import { CharacterId, ChatMessage } from '@/types';

export interface BackendOutput {
  author: string;
  text: string;
}

export interface BackendChatResponse {
  status: 'answered' | 'agents_not_configured';
  outputs: BackendOutput[];
  targets: string[];
  needs_rag: boolean;
  rag_probability: number;
  sources: string[];
  detail?: string | null;
}

export interface BackendHistoryTurn {
  role: 'user' | 'assistant';
  author: string;
  content: string;
}

const API_URL = (process.env.NEXT_PUBLIC_ROUNDTABLE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export function asCharacterId(author: string, fallback: CharacterId): CharacterId {
  const normalized = author.toLowerCase();
  return normalized === 'marx' || normalized === 'bakunin' || normalized === 'mill'
    ? normalized
    : fallback;
}

export async function sendChatToBackend(
  message: string,
  targets: CharacterId[],
  history: ChatMessage[],
): Promise<BackendChatResponse> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      targets,
      history: history.map((item) => ({
        role: item.senderId === 'user' ? 'user' : 'assistant',
        author: item.senderId,
        content: item.text,
      } satisfies BackendHistoryTurn)),
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.detail || `Backend request failed (${response.status})`);
  }
  return data as BackendChatResponse;
}
