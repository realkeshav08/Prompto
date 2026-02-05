  import { GoogleGenAI } from "@google/genai";

  const { GEMINI_API_KEY } = process.env;

  if (!GEMINI_API_KEY) {
    throw new Error("❌ GEMINI_API_KEY is not defined");
  }

  const ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY,
  });

  export default ai;
