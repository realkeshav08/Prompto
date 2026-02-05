import axios from "axios";
import Chat from "../models/Chat.js";
import User from "../models/User.js";
import imagekit from "../configs/imageKit.js";
import ai from "../configs/ai.js";

/* ---------------- TEXT MESSAGE ---------------- */

export const textMessageController = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId, prompt } = req.body;

    if (!chatId || !prompt?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Chat ID and prompt are required",
      });
    }

    /* ---- Atomic credit check & deduction ---- */
    const user = await User.findOneAndUpdate(
      { _id: userId, credits: { $gte: 1 } },
      { $inc: { credits: -1 } },
      { new: true },
    );
    console.log("User after credit deduction:", user);
    if (!user) {
      return res.status(403).json({
        success: false,
        message: "You don't have enough credits",
      });
    }

    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    /* ---- Save user message ---- */
    chat.messages.push({
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      isImage: false,
    });
    console.log(chat.messages);
    /* ---- AI call ---- */
    let aiContent;
    try {
      console.log(prompt);
      const systemInstruction = "You are Prompto, a friendly personal assistant. do NOT mention your model or the word 'gemini'. Keep responses concise and helpful.";
      const aiResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: `${systemInstruction}\n\n${prompt}`,
      });

      // Assign to outer variable (fix shadowing bug) and support multiple shapes
      aiContent = aiResponse?.text || aiResponse?.output_text ||
        (aiResponse?.output ? aiResponse.output.map(o => (o.content || [])
          .map(c => c.text || '')
          .join('')).join('\n') : undefined);

      console.log("AI response:", aiResponse);

      if (!aiContent || !String(aiContent).trim()) {
        // Refund credit if AI returned no content
        await User.findByIdAndUpdate(userId, { $inc: { credits: 1 } });
        console.error("AI returned unexpected response:", aiResponse);
        return res.status(500).json({
          success: false,
          message: "AI returned no content",
        });
      }

      aiContent = String(aiContent).trim();
    } catch (err) {
      // Refund credit on failure
      try {
        await User.findByIdAndUpdate(userId, { $inc: { credits: 1 } });
      } catch (refundErr) {
        console.error(
          "Failed to refund credits after AI error:",
          refundErr,
        );
      }
      console.error("AI error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to process message",
      });
    }

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
  } 
  catch (err) {
      console.error("🔥 MESSAGE ERROR:", err);
      res.status(500).json({
      success: false,
       message: err.message,
     });
  }
};

/* ---------------- IMAGE MESSAGE ---------------- */

export const imageMessageController = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId, prompt, isPublished } = req.body;

    if (!chatId || !prompt?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Chat ID and prompt are required",
      });
    }

    /* ---- Atomic credit check (2 credits) ---- */
    const user = await User.findOneAndUpdate(
      { _id: userId, credits: { $gte: 2 } },
      { $inc: { credits: -2 } },
      { new: true },
    );

    if (!user) {
      return res.status(403).json({
        success: false,
        message: "You don't have enough credits",
      });
    }

    const chat = await Chat.findOne({ _id: chatId, userId });
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    /* ---- Save user prompt ---- */
    chat.messages.push({
      role: "user",
      content: prompt,
      timestamp: Date.now(),
      isImage: false,
    });

    /* ---- Image generation ---- */
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl =
      `${process.env.IMAGEKIT_URL_ENDPOINT}` +
      `/ik-genimg-prompt-${encodedPrompt}` +
      `/quickgpt/${Date.now()}.png?tr=w-800,h-800`;

    const aiImage = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 20000,
    });

    const base64Image = `data:image/png;base64,${Buffer.from(
      aiImage.data,
    ).toString("base64")}`;

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

    return res.status(200).json({
      success: true,
      reply,
    });
  } catch (err) {
    console.error("Image message error:", err.message);
    return res.status(500).json({
      success: false,
      message: "Failed to generate image",
    });
  }
};
