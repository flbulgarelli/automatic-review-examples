import type { LanguageModel } from 'ai';
import { createOllama } from 'ollama-ai-provider-v2';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createAnthropic } from '@ai-sdk/anthropic';

import type { LlmConfig } from './config.js';

export function buildLanguageModel(cfg: LlmConfig): LanguageModel {
  switch (cfg.provider) {
    case 'ollama': {
      const ollama = createOllama({
        baseURL: cfg.baseUrl ?? 'http://localhost:11434/api',
      });
      return ollama(cfg.model);
    }
    case 'openai': {
      if (!cfg.openaiApiKey) throw new Error('OPENAI_API_KEY is required for provider=openai');
      const openai = createOpenAI({ apiKey: cfg.openaiApiKey });
      return openai(cfg.model);
    }
    case 'openai-compatible': {
      if (!cfg.baseUrl)
        throw new Error('LLM_BASE_URL is required for provider=openai-compatible');
      const provider = createOpenAICompatible({
        name: 'openai-compatible',
        baseURL: cfg.baseUrl,
        apiKey: cfg.openaiApiKey ?? 'dummy',
      });
      return provider(cfg.model);
    }
    case 'anthropic': {
      if (!cfg.anthropicApiKey)
        throw new Error('ANTHROPIC_API_KEY is required for provider=anthropic');
      const anthropic = createAnthropic({ apiKey: cfg.anthropicApiKey });
      return anthropic(cfg.model);
    }
  }
}
