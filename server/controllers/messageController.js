import axios from "axios";
import { z } from "zod";
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import imagekit from "../configs/imageKit.js";
import ai from "../configs/ai.js";

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://localhost:8000";

// Validates the shared shape of message requests: a chat id plus a non-empty
// prompt capped at 5000 chars to reject oversized/abusive payloads.
const messageSchema = z.object({
  chatId: z.string().min(1),
  prompt: z.string().trim().min(1).max(5000),
});

// Shared secret sent to the Python AI service so it can reject any caller
// other than this Node API. Sent only when configured (no-op in local dev).
const PY_HEADERS = process.env.INTERNAL_API_KEY
  ? { 'X-Internal-Key': process.env.INTERNAL_API_KEY }
  : {};

// Best-effort credit refund used by controller catch blocks. Every text/study/
// image handler debits credits up front (an atomic guard against double-spend),
// so any failure AFTER that debit — a missing chat, a DB write error — must put
// the credits back. Never throws: a failed refund must not mask the original
// error, and passing a null userId is a harmless no-op.
const refundCredits = async (userId, amount) => {
  if (!userId) return;
  try {
    await User.findByIdAndUpdate(userId, { $inc: { credits: amount } });
  } catch (refundErr) {
    console.error('Credit refund failed:', refundErr.message);
  }
};

/* Build the conversation context window sent to the AI.

   Like ChatGPT / Gemini, we don't resend the entire unbounded transcript —
   we keep a budget of the most RECENT turns. Messages are walked newest-first
   and kept until a character budget is reached, so long chats stay fast and
   within the model's context limit while preserving multi-turn memory.

   Image replies are stored as raw asset URLs — they're swapped for a text
   placeholder so the model doesn't mimic the URL and hallucinate links. */
const HISTORY_CHAR_BUDGET = 30000; // ~7-8k tokens of recent conversation

const buildHistory = (messages) => {
  const out = [];
  let budget = HISTORY_CHAR_BUDGET;

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const content = m.isImage ? '[generated an image]' : (m.content || '');

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

    if (!userId) {
      throw new Error("User not authenticated");
    }

    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Chat ID and a prompt (1–5000 chars) are required",
      });
    }
    const { chatId, prompt } = parsed.data;

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

    // EARLY SAVE: persist the user message before calling the AI so that a
    // tab close / AI failure / network drop can never delete what the user
    // already typed. (ChatGPT-style: user message is always durable; only the
    // assistant reply has a "Stopped" state.)
    await chat.save();

    /* ===================================================== */
    /* ================= AI CALL (Python service) ========= */
    /* ===================================================== */

    // Pass conversation history so Python can give context-aware replies
    // (exclude the user message we just pushed).
    const history = buildHistory(chat.messages.slice(0, -1));

    let aiContent = '';
    let stopped = false;
    try {
      const { data: aiData } = await axios.post(
        `${PYTHON_AI_URL}/chat`,
        { prompt, history },
        // Generous timeout so a cold-started AI service (free-tier hosts can
        // take ~50s to wake) still completes the first request instead of failing.
        { timeout: 90000, headers: PY_HEADERS }
      );
      aiContent = aiData.response || '';
      if (!aiContent.trim()) stopped = true;
    } catch (aiErr) {
      console.error("🔥 Python AI service error:", aiErr.message);
      stopped = true;
    }

    /* ---------- SAVE AI REPLY (or a stopped placeholder) ---------- */

    const reply = {
      role: "assistant",
      content: stopped ? '' : aiContent,
      timestamp: Date.now(),
      isImage: false,
      stopped,
      mode: 'text',
    };

    chat.messages.push(reply);
    await chat.save();

    if (stopped) {
      // Credit was deducted up front; refund since the user didn't receive a reply.
      await User.findByIdAndUpdate(userId, { $inc: { credits: 1 } });
    }

    res.status(200).json({
      success: true,
      reply,
      stopped,
    });

    // Background: generate a concise title for the first exchange — only on
    // a real reply (no point titling a stopped placeholder).
    if (isFirstMessage && !stopped) {
      generateChatTitle(chat._id, prompt, aiContent, '', chat.name);
    }
    return;

  } catch (err) {
    console.error("Text controller failure:", err.message);
    // The 1-credit debit happened before any throw here (e.g. chat not found),
    // so give it back rather than charging for an undelivered reply.
    await refundCredits(req.user?._id, 1);
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
    const { ragMode = 'hybrid' } = req.body;

    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: 'Chat ID and a prompt (1–5000 chars) are required' });
    }
    const { chatId, prompt } = parsed.data;

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
    // EARLY SAVE — see textMessageController for the rationale.
    await chat.save();

    const ragHistory = buildHistory(chat.messages.slice(0, -1));

    let aiContent = '';
    let stopped = false;
    try {
      const { data: aiData } = await axios.post(
        `${PYTHON_AI_URL}/rag`,
        { prompt, rag_mode: ragMode, user_id: userId.toString(), history: ragHistory },
        // Generous timeout — covers a cold-started AI service plus RAG retrieval.
        { timeout: 90000, headers: PY_HEADERS }
      );
      aiContent = aiData.response || '';
      if (!aiContent.trim()) stopped = true;
    } catch (ragErr) {
      console.error('RAG service error:', ragErr.message);
      stopped = true;
    }

    const reply = {
      role: 'assistant',
      content: stopped ? '' : aiContent,
      timestamp: Date.now(),
      isImage: false,
      stopped,
      mode: 'study',
    };
    chat.messages.push(reply);
    await chat.save();

    if (stopped) {
      await User.findByIdAndUpdate(userId, { $inc: { credits: 2 } });
    }

    res.status(200).json({ success: true, reply, stopped });

    // Background: generate a concise title for the first exchange (only on success).
    if (isFirstMessage && !stopped) {
      generateChatTitle(chat._id, prompt, aiContent, '📚 ', chat.name);
    }
    return;
  } catch (err) {
    console.error('RAG controller error:', err.message);
    // Study AI debits 2 credits up front; refund on any post-debit failure.
    await refundCredits(req.user?._id, 2);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
  }
};

/* ===================================================== */
/* ================= IMAGE MESSAGE ===================== */
/* ===================================================== */

export const imageMessageController = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { isPublished } = req.body;

    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Chat ID and a prompt (1–5000 chars) required",
      });
    }
    const { chatId, prompt } = parsed.data;

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
    // EARLY SAVE — see textMessageController for the rationale.
    await chat.save();

    const cleanPrompt = prompt.replace(/^(draw|generate|create|make)\s+(an\s+)?(image\s+)?(of\s+)?/i, '').trim();

    // Try multiple free image providers in turn so a quota limit or outage
    // on one doesn't break Draw. On total failure we persist a stopped
    // placeholder rather than discarding the user prompt.
    let url = '';
    let stopped = false;
    try {
      const imageBuffer = await generateImageBuffer(cleanPrompt || prompt);
      // Host the generated image permanently on ImageKit.
      const upload = await imagekit.upload({
        file: imageBuffer.toString('base64'),
        fileName: `gen-${Date.now()}.png`,
        folder: "quickgpt",
      });
      url = upload.url;
    } catch (genErr) {
      console.error('Image generation failed:', genErr.message);
      stopped = true;
    }

    const reply = {
      role: "assistant",
      content: stopped ? '' : url,
      timestamp: Date.now(),
      isImage: !stopped,
      isPublished: !stopped && Boolean(isPublished),
      stopped,
      mode: 'image',
    };

    chat.messages.push(reply);
    await chat.save();

    if (stopped) {
      await User.findByIdAndUpdate(userId, { $inc: { credits: 2 } });
    }

    return res.status(200).json({
      success: true,
      reply,
      stopped,
    });

  } catch (err) {
    // An exception here means we failed BEFORE the early-save (chat lookup
    // raced/missing, etc.) — refund the upfront 2 credits and bail.
    console.error('Image controller failure:', err.message);
    await refundCredits(req.user?._id, 2);
    return res.status(500).json({
      success: false,
      message: "Internal server error during image generation",
    });
  }
};

/* ===================================================== */
/* ================= REGENERATE ======================== */
/* =====================================================
   Retries the AI reply for a chat whose last assistant message is `stopped`.
   The mode (text / study / image) is read off that stopped placeholder, so
   the client doesn't have to remember what was attempted (works even after a
   page reload). Atomic credit deduct → remove the placeholder → run the right
   pipeline → save the new reply (success or another stopped placeholder). */

export const regenerateMessageController = async (req, res) => {
  // Tracks credits already debited so the catch can refund if a later step
  // (e.g. a DB save) throws after the deduction.
  let debitedAmount = 0;
  try {
    const userId = req.user?._id;
    if (!userId) throw new Error("User not authenticated");

    const { chatId, ragMode = 'hybrid', isPublished = false } = req.body || {};
    if (!chatId || typeof chatId !== 'string') {
      return res.status(400).json({ success: false, message: "Chat ID is required" });
    }

    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) return res.status(404).json({ success: false, message: "Chat not found" });

    if (chat.messages.length < 2) {
      return res.status(400).json({ success: false, message: "Nothing to regenerate" });
    }

    const lastMsg = chat.messages[chat.messages.length - 1];
    if (lastMsg.role !== 'assistant' || !lastMsg.stopped) {
      return res.status(400).json({ success: false, message: "Only a stopped reply can be regenerated" });
    }

    const prevUserMsg = chat.messages[chat.messages.length - 2];
    if (!prevUserMsg || prevUserMsg.role !== 'user') {
      return res.status(400).json({ success: false, message: "No user message to regenerate from" });
    }

    const prompt = prevUserMsg.content;
    const mode = ['text', 'study', 'image'].includes(lastMsg.mode) ? lastMsg.mode : 'text';
    const cost = (mode === 'image' || mode === 'study') ? 2 : 1;

    // Atomic credit deduct BEFORE removing the placeholder; if the user is out
    // of credits, the stopped state stays exactly as it was.
    const debited = await User.findOneAndUpdate(
      { _id: userId, credits: { $gte: cost } },
      { $inc: { credits: -cost } },
      { returnDocument: 'after' }
    );
    if (!debited) {
      return res.status(403).json({ success: false, message: "Not enough credits to regenerate" });
    }
    debitedAmount = cost;

    // Remove the stopped placeholder so the retried reply can take its place,
    // and so history sent to the AI doesn't contain a phantom empty turn.
    chat.messages.pop();
    await chat.save();

    let reply;
    let stopped = false;

    if (mode === 'text') {
      const history = buildHistory(chat.messages.slice(0, -1));
      let aiContent = '';
      try {
        const { data: aiData } = await axios.post(
          `${PYTHON_AI_URL}/chat`,
          { prompt, history },
          { timeout: 90000, headers: PY_HEADERS }
        );
        aiContent = aiData.response || '';
        if (!aiContent.trim()) stopped = true;
      } catch (e) {
        console.error('Regenerate text error:', e.message);
        stopped = true;
      }
      reply = {
        role: 'assistant',
        content: stopped ? '' : aiContent,
        timestamp: Date.now(),
        isImage: false,
        stopped,
        mode: 'text',
      };
    } else if (mode === 'study') {
      const ragHistory = buildHistory(chat.messages.slice(0, -1));
      let aiContent = '';
      try {
        const { data: aiData } = await axios.post(
          `${PYTHON_AI_URL}/rag`,
          { prompt, rag_mode: ragMode, user_id: userId.toString(), history: ragHistory },
          { timeout: 90000, headers: PY_HEADERS }
        );
        aiContent = aiData.response || '';
        if (!aiContent.trim()) stopped = true;
      } catch (e) {
        console.error('Regenerate rag error:', e.message);
        stopped = true;
      }
      reply = {
        role: 'assistant',
        content: stopped ? '' : aiContent,
        timestamp: Date.now(),
        isImage: false,
        stopped,
        mode: 'study',
      };
    } else { // image
      let url = '';
      try {
        const cleanPrompt = prompt.replace(/^(draw|generate|create|make)\s+(an\s+)?(image\s+)?(of\s+)?/i, '').trim();
        const imageBuffer = await generateImageBuffer(cleanPrompt || prompt);
        const upload = await imagekit.upload({
          file: imageBuffer.toString('base64'),
          fileName: `gen-${Date.now()}.png`,
          folder: "quickgpt",
        });
        url = upload.url;
      } catch (e) {
        console.error('Regenerate image error:', e.message);
        stopped = true;
      }
      reply = {
        role: 'assistant',
        content: stopped ? '' : url,
        timestamp: Date.now(),
        isImage: !stopped,
        isPublished: !stopped && Boolean(isPublished),
        stopped,
        mode: 'image',
      };
    }

    chat.messages.push(reply);
    await chat.save();

    if (stopped) {
      await User.findByIdAndUpdate(userId, { $inc: { credits: cost } });
    }

    // If this regeneration completed the very first exchange of the chat and
    // succeeded, kick off the background title generation we skipped earlier.
    const userMsgCount = chat.messages.filter(m => m.role === 'user').length;
    if (!stopped && userMsgCount === 1 && (mode === 'text' || mode === 'study')) {
      const prefix = mode === 'study' ? '📚 ' : '';
      generateChatTitle(chat._id, prompt, reply.content, prefix, chat.name);
    }

    return res.status(200).json({ success: true, reply, stopped });

  } catch (err) {
    console.error("Regenerate error:", err.message);
    // Refund whatever was debited before the failure (0 if we never got there).
    await refundCredits(req.user?._id, debitedAmount);
    return res.status(500).json({ success: false, message: "Failed to regenerate" });
  }
};

