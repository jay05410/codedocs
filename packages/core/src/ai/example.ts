// packages/core/src/ai/example.ts
// Example usage of the AI provider module

import { createAiProvider, extractJson, type ChatMessage } from './index';

/**
 * Example 1: Using OpenAI provider
 */
async function exampleOpenAI() {
  const provider = createAiProvider({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
    temperature: 0.1,
    maxTokens: 4096,
  });

  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are a helpful coding assistant.' },
    { role: 'user', content: 'Explain what TypeScript generics are in 2 sentences.' },
  ];

  const response = await provider.chat(messages);
  console.log('OpenAI response:', response);
}

/**
 * Example 2: Using Claude provider
 */
async function exampleClaude() {
  const provider = createAiProvider({
    provider: 'claude',
    model: 'claude-sonnet-4-5-20250929',
    apiKey: process.env.ANTHROPIC_API_KEY || 'your-api-key',
  });

  const response = await provider.chat([
    { role: 'system', content: 'You are a code reviewer.' },
    { role: 'user', content: 'What are the key things to check in a code review?' },
  ]);

  console.log('Claude response:', response);
}

/**
 * Example 3: Using Gemini provider
 */
async function exampleGemini() {
  const provider = createAiProvider({
    provider: 'gemini',
    model: 'gemini-2.5-pro',
    apiKey: process.env.GOOGLE_API_KEY || 'your-api-key',
  });

  const response = await provider.chat([
    { role: 'user', content: 'What is the purpose of dependency injection?' },
  ]);

  console.log('Gemini response:', response);
}

/**
 * Example 4: Using Ollama (local)
 */
async function exampleOllama() {
  const provider = createAiProvider({
    provider: 'ollama',
    model: 'llama3',
    baseUrl: 'http://localhost:11434',
  });

  const response = await provider.chat([
    { role: 'user', content: 'Hello! How are you?' },
  ]);

  console.log('Ollama response:', response);
}

/**
 * Example 5: Using custom endpoint
 */
async function exampleCustom() {
  const provider = createAiProvider({
    provider: 'custom',
    model: 'my-model',
    baseUrl: 'https://my-llm-endpoint.com',
    apiKey: 'optional-api-key',
  });

  const response = await provider.chat([
    { role: 'user', content: 'Hello!' },
  ]);

  console.log('Custom provider response:', response);
}

/**
 * Example 6: JSON extraction
 */
async function exampleJsonExtraction() {
  const provider = createAiProvider({
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
  });

  const response = await provider.chat([
    {
      role: 'user',
      content: 'Return a JSON object with fields: name (string), age (number), skills (array of strings)',
    },
  ], { jsonMode: true });

  try {
    const jsonString = extractJson(response);
    const data = JSON.parse(jsonString);
    console.log('Extracted JSON:', data);
  } catch (error) {
    console.error('Failed to extract JSON:', error);
  }
}

/**
 * Example 7: Multi-turn conversation
 */
async function exampleConversation() {
  const provider = createAiProvider({
    provider: 'claude',
    model: 'claude-sonnet-4-5-20250929',
    apiKey: process.env.ANTHROPIC_API_KEY || 'your-api-key',
  });

  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is React?' },
  ];

  const response1 = await provider.chat(messages);
  console.log('Turn 1:', response1);

  // Add assistant response and new user message
  messages.push({ role: 'assistant', content: response1 });
  messages.push({ role: 'user', content: 'What are React hooks?' });

  const response2 = await provider.chat(messages);
  console.log('Turn 2:', response2);
}

/**
 * Example 8: Error handling
 */
async function exampleErrorHandling() {
  try {
    const provider = createAiProvider({
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'invalid-key',
    });

    await provider.chat([
      { role: 'user', content: 'Hello!' },
    ]);
  } catch (error) {
    console.error('Caught error:', (error as Error).message);
    // Example output: "OpenAI API error (401): Invalid API key"
  }
}

// Export examples for testing
export {
  exampleOpenAI,
  exampleClaude,
  exampleGemini,
  exampleOllama,
  exampleCustom,
  exampleJsonExtraction,
  exampleConversation,
  exampleErrorHandling,
};
