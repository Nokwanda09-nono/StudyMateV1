const OpenAI = require('openai');

const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENROUTES_API_KEY;

const openrouter = apiKey
  ? new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:8081',
        'X-Title': 'StudyMate',
      },
    })
  : null;

module.exports = openrouter;