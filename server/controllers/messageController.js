import axios from "axios";
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import imagekit from "../configs/imageKit.js";
import ai from "../configs/ai.js";

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://localhost:8000";

// Shared secret sent to the Python AI service so it can reject any caller
// other than this Node API. Sent only when configured (no-op in local dev).
const PY_HEADERS = process.env.INTERNAL_API_KEY
  ? { 'X-Internal-Key': process.env.INTERNAL_API_KEY }
  : {};

/* Build the conversation context window sent to the AI.

   Like ChatGPT / Gemini, we don't resend the entire unbounded transcript —
   we keep a budget of the most RECENT turns. Messages are walked newest-first
   and kept until a character budget is reached, so long chats stay fast and
   within the model's context limit while preserving multi-turn memory.

   Image/video replies are stored as raw asset URLs — they're swapped for a
   text placeholder so the model doesn't mimic the URL and hallucinate links. */
const HISTORY_CHAR_BUDGET = 30000; // ~7-8k tokens of recent conversation

const buildHistory = (messages) => {
  const out = [];
  let budget = HISTORY_CHAR_BUDGET;

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const content = m.isVideo
      ? '[generated a video]'
      : m.isImage
        ? '[generated an image]'
        : (m.content || '');

    // Stop once the budget is spent — but always keep at least the latest turn.
    if (content.length > budget && out.length > 0) break;
    budget -= content.length;
    out.unshift({ role: m.role, content });
  }

  return out;
};

/* Generate a concise chat title from the first exchange.
   Runs as a background task — never awaited by the request handler, so it
   never delays the user's reply. If it fails, the truncated-prompt name
   already saved on the chat stays as the fallback. */
const generateChatTitle = async (chatId, prompt, answer, prefix = '', expectedName = null) => {
  try {
    const { data } = await axios.post(
      `${PYTHON_AI_URL}/title`,
      { prompt, answer: answer || '' },
      { timeout: 15000, headers: PY_HEADERS }
    );
    const title = data?.title?.trim();
    if (title) {
      // Only apply the auto-title if the chat still carries its placeholder
      // name — i.e. the user hasn't manually renamed it in the meantime.
      const filter = expectedName
        ? { _id: chatId, name: expectedName }
        : { _id: chatId };
      await Chat.updateOne(filter, { name: `${prefix}${title}` });
    }
  } catch (err) {
    console.error('Title generation failed:', err.message);
  }
};

/* ---------- IMAGE GENERATION — free model cascade ----------
   Each source returns image bytes (Buffer) or throws. They are tried in
   order so a quota limit or outage on one provider falls through to the
   next — the same idea as the Gemini text-model fallback. */
const IMAGE_SOURCES = [
  {
    name: 'pollinations-flux',
    run: async (p) => {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=1024&height=1024&model=flux&nologo=true`;
      const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 50000 });
      return Buffer.from(r.data);
    },
  },
  {
    name: 'pollinations-turbo',
    run: async (p) => {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=1024&height=1024&model=turbo&nologo=true`;
      const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 50000 });
      return Buffer.from(r.data);
    },
  },
  {
    name: 'gemini-image',
    run: async (p) => {
      const resp = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: p,
      });
      const parts = resp?.candidates?.[0]?.content?.parts || [];
      const imgPart = parts.find(x => x.inlineData?.data);
      if (!imgPart) throw new Error('Gemini returned no image');
      return Buffer.from(imgPart.inlineData.data, 'base64');
    },
  },
  {
    name: 'imagekit',
    run: async (p) => {
      let baseUrl = process.env.IMAGEKIT_URL_ENDPOINT;
      if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
      baseUrl = baseUrl.replace(/\/$/, '');
      const url = `${baseUrl}/ik-genimg-prompt-${encodeURIComponent(p)}/quickgpt/${Date.now()}.png?tr=w-800,h-800`;
      const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 45000 });
      return Buffer.from(r.data);
    },
  },
];

const generateImageBuffer = async (prompt) => {
  let lastError;
  for (const source of IMAGE_SOURCES) {
    try {
      const buf = await source.run(prompt);
      // Sanity check — a real image is well over 1 KB; reject error pages.
      if (buf && buf.length > 1024) {
        console.log(`🖼️  Image generated via "${source.name}"`);
        return buf;
      }
      throw new Error('Returned an empty/invalid image');
    } catch (err) {
      lastError = err;
      console.error(`Image source "${source.name}" failed:`, err.message);
    }
  }
  throw lastError || new Error('All image sources failed');
};

/* ===================================================== */
/* ================= TEXT MESSAGE ====================== */
/* ===================================================== */

export const textMessageController = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { chatId, prompt } = req.body;

    if (!userId) {
      throw new Error("User not authenticated");
    }

    if (!chatId || !prompt?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Chat ID and prompt are required",
      });
    }

    /* ---------- CREDIT CHECK ---------- */

    const user = await User.findOneAndUpdate(
      { _id: userId, credits: { $gte: 1 } },
      { $inc: { credits: -1 } },
      { returnDocument: 'after' }
    );

    if (!user) {
      return res.status(403).json({
        success: false,
        message: "Not enough credits",
      });
    }

    /* ---------- CHAT VALIDATION ---------- */

    const chat = await Chat.findOne({ _id: chatId, userId });

    if (!chat) {
      throw new Error("Chat not found or unauthorized");
    }

    /* ---------- SAVE USER MESSAGE ---------- */

    // Auto-rename chat from the first prompt. This truncated name shows
    // immediately; a cleaner AI-generated title replaces it shortly after
    // (see the background generateChatTitle call below).
    const isFirstMessage = chat.name === 'New Chat' || chat.messages.length === 0;
    if (isFirstMessage) {
      chat.name = prompt.length > 40 ? prompt.substring(0, 40) + '...' : prompt;
    }

    chat.messages.push({
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      isImage: false,
    });

    /* ===================================================== */
    /* ================= AI CALL (Python service) ========= */
    /* ===================================================== */

    // Pass conversation history so Python can give context-aware replies
    // (exclude the user message we just pushed).
    const history = buildHistory(chat.messages.slice(0, -1));

    let aiContent;
    try {
      const { data: aiData } = await axios.post(
        `${PYTHON_AI_URL}/chat`,
        { prompt, history },
        { timeout: 30000, headers: PY_HEADERS }
      );
      aiContent = aiData.response;
    } catch (aiErr) {
      console.error("🔥 Python AI service error:", aiErr.message);
      await User.findByIdAndUpdate(userId, { $inc: { credits: 1 } });
      return res.status(500).json({
        success: false,
        message: aiErr.response?.data?.detail || "AI service is temporarily unavailable",
      });
    }

    if (!aiContent?.trim()) {
      await User.findByIdAndUpdate(userId, { $inc: { credits: 1 } });
      return res.status(500).json({ success: false, message: "AI returned an empty response" });
    }

    /* ---------- SAVE AI REPLY ---------- */

    const reply = {
      role: "assistant",
      content: aiContent,
      timestamp: Date.now(),
      isImage: false,
    };

    chat.messages.push(reply);
    await chat.save();

    res.status(200).json({
      success: true,
      reply,
    });

    // Background: generate a concise title for the first exchange.
    if (isFirstMessage) {
      generateChatTitle(chat._id, prompt, aiContent, '', chat.name);
    }
    return;

  } catch (err) {
    console.error("\n🔥 CONTROLLER FAILURE:");
    console.error(err);
    console.error(err.stack);

    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
};

/* ===================================================== */
/* ================= RAG / STUDY AI =================== */
/* ===================================================== */

export const ragMessageController = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { chatId, prompt, ragMode = 'hybrid' } = req.body;

    if (!chatId || !prompt?.trim()) {
      return res.status(400).json({ success: false, message: 'Chat ID and prompt are required' });
    }

    const user = await User.findOneAndUpdate(
      { _id: userId, credits: { $gte: 2 } },
      { $inc: { credits: -2 } },
      { returnDocument: 'after' }
    );

    if (!user) {
      return res.status(403).json({ success: false, message: 'Not enough credits (2 required for Study AI)' });
    }

    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) throw new Error('Chat not found or unauthorized');

    const isFirstMessage = chat.name === 'New Chat' || chat.messages.length === 0;
    if (isFirstMessage) {
      const title = prompt.length > 40 ? prompt.substring(0, 40) + '...' : prompt;
      chat.name = `📚 ${title}`;
    }

    chat.messages.push({ role: 'user', content: prompt, timestamp: Date.now(), isImage: false });

    const ragHistory = buildHistory(chat.messages.slice(0, -1));

    let aiContent;
    try {
      const { data: aiData } = await axios.post(
        `${PYTHON_AI_URL}/rag`,
        { prompt, rag_mode: ragMode, user_id: userId.toString(), history: ragHistory },
        { timeout: 60000, headers: PY_HEADERS }
      );
      aiContent = aiData.response;
    } catch (ragErr) {
      console.error('RAG service error:', ragErr.message);
      await User.findByIdAndUpdate(userId, { $inc: { credits: 2 } });
      return res.status(500).json({ success: false, message: 'Study AI is temporarily unavailable' });
    }

    const reply = { role: 'assistant', content: aiContent, timestamp: Date.now(), isImage: false };
    chat.messages.push(reply);
    await chat.save();

    res.status(200).json({ success: true, reply });

    // Background: generate a concise title for the first exchange.
    if (isFirstMessage) {
      generateChatTitle(chat._id, prompt, aiContent, '📚 ', chat.name);
    }
    return;
  } catch (err) {
    console.error('RAG controller error:', err);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

/* ===================================================== */
/* ================= IMAGE MESSAGE ===================== */
/* ===================================================== */

export const imageMessageController = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { chatId, prompt, isPublished } = req.body;

    if (!chatId || !prompt?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Chat ID and prompt required",
      });
    }

    const user = await User.findOneAndUpdate(
      { _id: userId, credits: { $gte: 2 } },
      { $inc: { credits: -2 } },
      { returnDocument: 'after' }
    );

    if (!user) {
      return res.status(403).json({
        success: false,
        message: "Not enough credits",
      });
    }

    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) throw new Error("Chat not found");

    // Auto-rename chat from the first prompt. Chats that end up with the same
    // name are still uniquely distinguished by _id and their createdAt/updatedAt
    // timestamps (the sidebar shows that date under each chat).
    if (chat.name === 'New Chat' || chat.messages.length === 0) {
      chat.name = prompt.length > 40 ? prompt.substring(0, 40) + '...' : prompt;
    }

    chat.messages.push({
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      isImage: false,
    });

    const cleanPrompt = prompt.replace(/^(draw|generate|create|make)\s+(an\s+)?(image\s+)?(of\s+)?/i, '').trim();

    // Try multiple free image providers in turn so a quota limit or outage
    // on one doesn't break Draw.
    let imageBuffer;
    try {
      imageBuffer = await generateImageBuffer(cleanPrompt || prompt);
    } catch (genErr) {
      console.error('All image providers failed:', genErr.message);
      await User.findByIdAndUpdate(userId, { $inc: { credits: 2 } });
      return res.status(500).json({
        success: false,
        message: "Image generation is busy across all providers. Please try again in a moment.",
      });
    }

    // Host the generated image permanently on ImageKit.
    const upload = await imagekit.upload({
      file: imageBuffer.toString('base64'),
      fileName: `gen-${Date.now()}.png`,
      folder: "quickgpt",
    });

    const reply = {
      role: "assistant",
      content: upload.url,
      timestamp: Date.now(),
      isImage: true,
      isPublished: Boolean(isPublished),
    };

    chat.messages.push(reply);
    await chat.save();

    return res.status(200).json({
      success: true,
      reply,
    });

  } catch (err) {
    // Credits were already deducted before this point — refund them.
    try {
      await User.findByIdAndUpdate(req.user?._id, { $inc: { credits: 2 } });
    } catch (_) {}

    return res.status(500).json({
      success: false,
      message: "Internal server error during image generation",
    });
  }
};

/* ===================================================== */
/* ================= VIDEO MESSAGE ===================== */
/* ===================================================== */

export const videoMessageController = async (_req, res) => {
  // There is no free text-to-video model to back this (Gemini's Veo is
  // paid-only). Surfaced to the user as an upcoming feature — no credits charged.
  return res.status(503).json({
    success: false,
    message: "🎬 Video generation is an upcoming feature — coming soon!",
  });
};
