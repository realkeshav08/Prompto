import axios from "axios";
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import imagekit from "../configs/imageKit.js";

const PYTHON_AI_URL = process.env.PYTHON_AI_URL || "http://localhost:8000";

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

    // Auto-rename chat if it's the first message
    if (chat.name === 'New Chat' || chat.messages.length === 0) {
      let chatTitle = prompt.length > 40 ? prompt.substring(0, 40) + '...' : prompt;
      
      // Handle generic/short greetings by adding a timestamp
      if (prompt.trim().length < 10) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });
        chatTitle = `${chatTitle} (${dateStr}, ${timeStr})`;
      }
      
      chat.name = chatTitle;
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
    const history = chat.messages
      .slice(0, -1) // exclude the user message we just pushed
      .map(m => ({ role: m.role, content: m.content }));

    let aiContent;
    try {
      const { data: aiData } = await axios.post(
        `${PYTHON_AI_URL}/chat`,
        { prompt, history },
        { timeout: 30000 }
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

    return res.status(200).json({
      success: true,
      reply,
    });

  } catch (err) {
    console.error("\n🔥 CONTROLLER FAILURE:");
    console.error(err);
    console.error(err.stack);

    return res.status(500).json({
      success: false,
      message: err.message,
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
      { _id: userId, credits: { $gte: 1 } },
      { $inc: { credits: -1 } },
      { returnDocument: 'after' }
    );

    if (!user) {
      return res.status(403).json({ success: false, message: 'Not enough credits' });
    }

    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) throw new Error('Chat not found or unauthorized');

    if (chat.name === 'New Chat' || chat.messages.length === 0) {
      const title = prompt.length > 40 ? prompt.substring(0, 40) + '...' : prompt;
      chat.name = `📚 ${title}`;
    }

    chat.messages.push({ role: 'user', content: prompt, timestamp: Date.now(), isImage: false });

    const ragHistory = chat.messages
      .slice(0, -1)
      .map(m => ({ role: m.role, content: m.content }));

    let aiContent;
    try {
      const { data: aiData } = await axios.post(
        `${PYTHON_AI_URL}/rag`,
        { prompt, rag_mode: ragMode, user_id: userId.toString(), history: ragHistory },
        { timeout: 60000 }
      );
      aiContent = aiData.response;
    } catch (ragErr) {
      console.error('RAG service error:', ragErr.message);
      await User.findByIdAndUpdate(userId, { $inc: { credits: 1 } });
      return res.status(500).json({ success: false, message: 'Study AI is temporarily unavailable' });
    }

    const reply = { role: 'assistant', content: aiContent, timestamp: Date.now(), isImage: false };
    chat.messages.push(reply);
    await chat.save();

    return res.status(200).json({ success: true, reply });
  } catch (err) {
    console.error('RAG controller error:', err);
    return res.status(500).json({ success: false, message: err.message });
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

    // Auto-rename chat if it's the first message
    if (chat.name === 'New Chat' || chat.messages.length === 0) {
      let chatTitle = prompt.length > 40 ? prompt.substring(0, 40) + '...' : prompt;
      
      // Handle generic/short greetings by adding a timestamp
      if (prompt.trim().length < 10) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });
        chatTitle = `${chatTitle} (${dateStr}, ${timeStr})`;
      }
      
      chat.name = chatTitle;
    }

    chat.messages.push({
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      isImage: false,
    });

    const cleanPrompt = prompt.replace(/^(draw|generate|create|make)\s+(an\s+)?(image\s+)?(of\s+)?/i, '').trim();
    const encodedPrompt = encodeURIComponent(cleanPrompt);

    // URL Normalization: Ensure HTTPS and no double slashes
    let baseUrl = process.env.IMAGEKIT_URL_ENDPOINT;
    if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
    baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    const imageUrl =
      `${baseUrl}` +
      `/ik-genimg-prompt-${encodedPrompt}` +
      `/quickgpt/${Date.now()}.png?tr=w-800,h-800`;

    let aiImage;
    try {
      aiImage = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 45000, 
      });
    } catch (fetchErr) {
      await User.findByIdAndUpdate(userId, { $inc: { credits: 2 } });
      
      return res.status(500).json({
        success: false,
        message: "AI Generation is currently busy. Please try again in a moment.",
      });
    }

    const base64Image = `data:image/png;base64,${Buffer.from(aiImage.data).toString("base64")}`;

    const upload = await imagekit.upload({
      file: base64Image,
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
    return res.status(500).json({
      success: false,
      message: "Internal server error during image generation",
    });
  }
};

/* ===================================================== */
/* ================= VIDEO MESSAGE ===================== */
/* ===================================================== */

export const videoMessageController = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { chatId, prompt, isPublished } = req.body;

    if (!chatId || !prompt?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Chat ID and prompt required",
      });
    }

    // Video generation is expensive: 4 credits
    const user = await User.findOneAndUpdate(
      { _id: userId, credits: { $gte: 4 } },
      { $inc: { credits: -4 } },
      { returnDocument: 'after' }
    );

    if (!user) {
      return res.status(403).json({
        success: false,
        message: "Not enough credits (4 required for Video)",
      });
    }

    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) throw new Error("Chat not found");

    // Auto-rename chat if it's the first message
    if (chat.name === 'New Chat' || chat.messages.length === 0) {
      let chatTitle = prompt.length > 40 ? prompt.substring(0, 40) + '...' : prompt;
      if (prompt.trim().length < 10) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });
        chatTitle = `${chatTitle} (${dateStr}, ${timeStr})`;
      }
      chat.name = chatTitle;
    }

    chat.messages.push({
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      isImage: false,
    });

    // Use a universally public video URL for demo
    const videoUrl = "https://www.w3schools.com/html/movie.mp4";

    const reply = {
      role: "assistant",
      content: videoUrl,
      timestamp: Date.now(),
      isVideo: true, 
      isImage: false,
      isPublished: Boolean(isPublished),
    };

    chat.messages.push(reply);
    await chat.save();

    return res.status(200).json({
      success: true,
      reply,
    });

  } catch (err) {
    try {
      await User.findByIdAndUpdate(req.user?._id, { $inc: { credits: 4 } });
    } catch (_) {}

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
