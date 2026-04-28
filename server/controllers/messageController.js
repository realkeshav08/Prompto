import axios from "axios";
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import imagekit from "../configs/imageKit.js";
import ai from "../configs/ai.js";

/* ===================================================== */
/* ================= TEXT MESSAGE ====================== */
/* ===================================================== */

export const textMessageController = async (req, res) => {
  console.log("\n🚀 TEXT MESSAGE REQUEST");
  console.log("Body:", req.body);

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

    console.log("👤 User after credit deduction:", user);

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
    /* ================= AI CALL (CASCADING) =============== */
    /* ===================================================== */

    let aiContent;
    const MODELS = [
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite-preview-02-05",
      "gemini-3-flash",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.5-pro"
    ];

    let lastError;

    for (const modelId of MODELS) {
      try {
        console.log(`🤖 [CASCADING] Attempting: ${modelId}`);

        const systemInstruction =
          "You are Prompto, a friendly assistant. Never mention Gemini. Keep answers concise.";

        const aiResponse = await ai.models.generateContent({
          model: modelId,
          contents: [{ role: "user", parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
        });

        aiContent = aiResponse.text;

        if (aiContent && aiContent.trim()) {
          aiContent = aiContent.trim();
          console.log(`✅ [SUCCESS] Fulfilled by: ${modelId}`);
          break; 
        }
      } catch (aiErr) {
        lastError = aiErr;
        const errMsg = aiErr.message || "Unknown Error";
        console.warn(`⚠️ [FAILURE] ${modelId} failed: ${errMsg.substring(0, 50)}...`);
        
        // We continue to the NEXT model regardless of the error type 
        // to ensure the user's request is completed if possible.
        continue; 
      }
    }

    if (!aiContent) {
      console.error("🔥 ALL AI MODELS FAILED:", lastError);

      /* Refund credit */
      try {
        await User.findByIdAndUpdate(userId, { $inc: { credits: 1 } });
        console.log("💰 Credit refunded");
      } catch (refundErr) {
        console.error("Refund failed:", refundErr);
      }

      return res.status(500).json({
        success: false,
        message: lastError?.message || "All AI models are currently unavailable",
      });
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

    console.log("✅ Message processed successfully");

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
/* ================= IMAGE MESSAGE ===================== */
/* ===================================================== */

export const imageMessageController = async (req, res) => {
  console.log("\n🖼 IMAGE REQUEST:", req.body);

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

    console.log("🌐 Attempting AI Generation:", imageUrl);

    let aiImage;
    try {
      aiImage = await axios.get(imageUrl, {
        responseType: "arraybuffer",
        timeout: 45000, 
      });
    } catch (fetchErr) {
      console.error("❌ ImageKit AI Generation failed:", fetchErr.message);
      
      // Refund credits on failure
      await User.findByIdAndUpdate(userId, { $inc: { credits: 2 } });
      console.log("💰 Credits refunded (Generation failed)");
      
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

    console.log("✅ Image generated and stored successfully");

    return res.status(200).json({
      success: true,
      reply,
    });

  } catch (err) {
    console.error("\n🔥 IMAGE CONTROLLER FAILURE:", err.message);
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
  console.log("\n🎬 VIDEO REQUEST:", req.body);

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

    console.log("✅ Video generated (demo)");

    return res.status(200).json({
      success: true,
      reply,
    });

  } catch (err) {
    console.error("\n🔥 VIDEO FAILURE:", err);
    
    // Refund credits on failure
    try {
      await User.findByIdAndUpdate(req.user?._id, { $inc: { credits: 4 } });
      console.log("💰 Credits refunded (Video failure)");
    } catch (refundErr) {
      console.error("Refund failed:", refundErr);
    }

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
