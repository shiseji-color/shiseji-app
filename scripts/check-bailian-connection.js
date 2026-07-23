import OpenAI from 'openai';

const requiredVariables = ['API_KEY', 'BASE_URL', 'MODEL_NAME'];
const missingVariables = requiredVariables.filter(
  (name) => !process.env[name]?.trim(),
);

if (missingVariables.length > 0) {
  console.error(`Missing environment variables: ${missingVariables.join(', ')}`);
  process.exit(1);
}

const client = new OpenAI({
  apiKey: process.env.API_KEY.trim(),
  baseURL: process.env.BASE_URL.trim().replace(/\/+$/, ''),
});

try {
  const response = await client.chat.completions.create({
    model: process.env.MODEL_NAME.trim(),
    messages: [
      {
        role: 'user',
        content: 'Reply with exactly: OK',
      },
    ],
    max_tokens: 5,
    temperature: 0,
  });

  const content = response.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('The model returned an empty response.');
  }

  console.log('Bailian connection OK');
  console.log(`Model: ${process.env.MODEL_NAME.trim()}`);
  console.log(`Response: ${content}`);
} catch (error) {
  console.error('Bailian connection failed');
  console.error(error?.status ? `HTTP status: ${error.status}` : '');
  console.error(error?.message || error);
  process.exit(1);
}
