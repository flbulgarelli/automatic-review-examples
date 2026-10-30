import 'dotenv/config';

export const LLM_PROVIDERS = ['ollama', 'openai', 'openai-compatible', 'anthropic'] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export interface LlmConfig {
  provider: LlmProvider;
  model: string;
  baseUrl?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
}

export interface Config {
  port: number;
  llm: LlmConfig;
}

export function loadConfig(): Config {
  const raw = process.env.LLM_PROVIDER ?? 'ollama';
  if (!LLM_PROVIDERS.includes(raw as LlmProvider)) {
    throw new Error(`Invalid LLM_PROVIDER: ${raw}`);
  }
  const provider = raw as LlmProvider;
  return {
    port: Number(process.env.PORT ?? 3000),
    llm: {
      provider,
      model: process.env.LLM_MODEL ?? defaultModel(provider),
      baseUrl: process.env.LLM_BASE_URL,
      openaiApiKey: process.env.OPENAI_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
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
