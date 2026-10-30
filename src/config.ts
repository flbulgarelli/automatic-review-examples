import 'dotenv/config';

export const LLM_PROVIDERS = ['ollama', 'openai', 'openai-compatible', 'anthropic'] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export const REVIEWER_IMPLS = ['llm', 'detoxify', 'approve_all', 'llama_guard'] as const;
export type ReviewerImpl = (typeof REVIEWER_IMPLS)[number];

export interface LlmConfig {
  provider: LlmProvider;
  model: string;
  baseUrl?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
}

export interface LlamaGuardConfig {
  model: string;
  baseUrl: string;
}

export interface Config {
  port: number;
  reviewer: ReviewerImpl;
  llm: LlmConfig;
  llamaGuard: LlamaGuardConfig;
}

export function loadConfig(): Config {
  const rawProvider = process.env.LLM_PROVIDER ?? 'ollama';
  if (!LLM_PROVIDERS.includes(rawProvider as LlmProvider)) {
    throw new Error(`Invalid LLM_PROVIDER: ${rawProvider}`);
  }
  const rawReviewer = process.env.REVIEWER_IMPL ?? 'llm';
  if (!REVIEWER_IMPLS.includes(rawReviewer as ReviewerImpl)) {
    throw new Error(`Invalid REVIEWER_IMPL: ${rawReviewer}`);
  }
  const provider = rawProvider as LlmProvider;
  return {
    port: Number(process.env.PORT ?? 3000),
    reviewer: rawReviewer as ReviewerImpl,
    llm: {
      provider,
      model: process.env.LLM_MODEL ?? defaultModel(provider),
      baseUrl: process.env.LLM_BASE_URL,
      openaiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    },
    llamaGuard: {
      model: process.env.LLAMA_GUARD_MODEL ?? 'llama-guard3:1b',
      baseUrl: process.env.LLAMA_GUARD_BASE_URL ?? 'http://localhost:11434/api',
    },
  };
}

function defaultModel(provider: LlmProvider): string {
  switch (provider) {
    case 'ollama':
      return 'qwen2.5:7b';
    case 'openai':
      return 'gpt-4o-mini';
    case 'openai-compatible':
      return 'Qwen/Qwen2.5-7B-Instruct';
    case 'anthropic':
      return 'claude-sonnet-4-5';
  }
}
