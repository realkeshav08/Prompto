import { OpenAI } from 'openai';

const { GEMINI_API_KEY } = process.env;

if (!GEMINI_API_KEY) {
  throw new Error('❌ GEMINI_API_KEY is not defined');
}

const openai = new OpenAI({
  apiKey: GEMINI_API_KEY,
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
});

export default openai;

