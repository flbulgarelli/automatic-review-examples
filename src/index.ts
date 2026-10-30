import { buildApp } from './inject.js';

const { app, config } = buildApp();

app.listen(config.port, () => {
  console.log(`[mentorship] listening on http://localhost:${config.port}`);
  console.log(`[mentorship] LLM provider: ${config.llm.provider} (${config.llm.model})`);
});
