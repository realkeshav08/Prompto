import axios from 'axios';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import imagekit from '../configs/imageKit.js';
import openai from '../configs/openai.js';

/* ---------------- TEXT MESSAGE ---------------- */

export const textMessageController = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId, prompt } = req.body;

    if (!chatId || !prompt?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and prompt are required',
      });
    }

    /* ---- Atomic credit check & deduction ---- */
    const user = await User.findOneAndUpdate(
      { _id: userId, credits: { $gte: 1 } },
      { $inc: { credits: -1 } },
      { new: true }
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
        message: 'Chat not found',
      });
    }

    /* ---- Save user message ---- */
    chat.messages.push({
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
      isImage: false,
    });

    /* ---- AI call ---- */
    const { choices } = await openai.chat.completions.create({
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: prompt }],
    });

    const reply = {
      role: 'assistant',
      content: choices[0].message.content,
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
    console.error('Text message error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to process message',
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
        message: 'Chat ID and prompt are required',
      });
    }

    /* ---- Atomic credit check (2 credits) ---- */
    const user = await User.findOneAndUpdate(
      { _id: userId, credits: { $gte: 2 } },
      { $inc: { credits: -2 } },
      { new: true }
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
        message: 'Chat not found',
      });
    }

    /* ---- Save user prompt ---- */
    chat.messages.push({
      role: 'user',
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
      responseType: 'arraybuffer',
      timeout: 20000,
    });

    const base64Image = `data:image/png;base64,${Buffer
      .from(aiImage.data)
      .toString('base64')}`;

    const upload = await imagekit.upload({
      file: base64Image,
      fileName: `${Date.now()}.png`,
      folder: 'quickgpt',
    });

    const reply = {
      role: 'assistant',
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
    console.error('Image message error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate image',
    });
  }
};
