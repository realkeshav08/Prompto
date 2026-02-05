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
      { new: true }
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

    chat.messages.push({
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      isImage: false,
    });

    /* ===================================================== */
    /* ================= AI CALL =========================== */
    /* ===================================================== */

    let aiContent;

    try {
      console.log("🤖 Sending to AI:", prompt);

      const systemInstruction =
        "You are Prompto, a friendly assistant. Never mention Gemini. Keep answers concise.";

      const aiResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `${systemInstruction}\n\n${prompt}`,
      });

      console.log("🧠 RAW AI RESPONSE:", JSON.stringify(aiResponse, null, 2));

      aiContent =
        aiResponse?.text ||
        aiResponse?.output_text ||
        aiResponse?.output?.map(o =>
          (o.content || []).map(c => c.text || "").join("")
        ).join("\n");

      if (!aiContent || !aiContent.trim()) {
        throw new Error("AI returned empty content");
      }

      aiContent = aiContent.trim();
    } catch (aiErr) {
      console.error("🔥 AI FAILURE:", aiErr);
      console.error(aiErr.stack);

      /* Refund credit */
      try {
        await User.findByIdAndUpdate(userId, { $inc: { credits: 1 } });
        console.log("💰 Credit refunded");
      } catch (refundErr) {
        console.error("Refund failed:", refundErr);
      }

      return res.status(500).json({
        success: false,
        message: aiErr.message,
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
      { new: true }
    );

    if (!user) {
      return res.status(403).json({
        success: false,
        message: "Not enough credits",
      });
    }

    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) throw new Error("Chat not found");

    chat.messages.push({
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      isImage: false,
    });

    const encodedPrompt = encodeURIComponent(prompt);

    const imageUrl =
      `${process.env.IMAGEKIT_URL_ENDPOINT}` +
      `/ik-genimg-prompt-${encodedPrompt}` +
      `/quickgpt/${Date.now()}.png?tr=w-800,h-800`;

    console.log("🌐 Fetching image:", imageUrl);

    const aiImage = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 20000,
    });

    const base64Image =
      `data:image/png;base64,${Buffer.from(aiImage.data).toString("base64")}`;

    const upload = await imagekit.upload({
      file: base64Image,
      fileName: `${Date.now()}.png`,
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

    console.log("✅ Image generated");

    return res.status(200).json({
      success: true,
      reply,
    });

  } catch (err) {
    console.error("\n🔥 IMAGE FAILURE:");
    console.error(err);
    console.error(err.stack);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
