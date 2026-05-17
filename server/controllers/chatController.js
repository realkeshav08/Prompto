import Chat from '../models/Chat.js';

/* ---------------- CREATE CHAT ---------------- */
export const createChat = async (req, res) => {
  try {
    const { _id: userId, name: userName } = req.user;

    const newChat = await Chat.create({
      userId,
      userName,
      name: 'New Chat',
      messages: [],
    });

    return res.status(201).json({
      success: true,
      message: 'Chat created',
      chat: newChat,
    });
  } catch (err) {
    console.error('Create chat error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create chat',
    });
  }
};

/* ---------------- GET CHATS ---------------- */
export const getChats = async (req, res) => {
  try {
    const userId = req.user._id;
    console.log(`📂 Fetching chats for User: ${userId}`);

    const chats = await Chat.find({ userId })
      .sort({ updatedAt: -1 })
      .lean();

    console.log(`✅ Found ${chats.length} chats`);

    return res.status(200).json({
      success: true,
      chats,
    });
  } catch (err) {
    console.error('Get chats error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch chats',
    });
  }
};

/* ---------------- GET ONE CHAT (lightweight) ---------------- */
export const getChat = async (req, res) => {
  try {
    const userId = req.user._id;

    const chat = await Chat.findOne({ _id: req.params.id, userId })
      .select('name')
      .lean();

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found',
      });
    }

    return res.status(200).json({
      success: true,
      chat,
    });
  } catch (err) {
    console.error('Get chat error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch chat',
    });
  }
};

/* ---------------- DELETE CHAT ---------------- */
export const deleteChat = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId } = req.body;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID is required',
      });
    }

    const deleted = await Chat.findOneAndDelete({
      _id: chatId,
      userId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Chat deleted',
    });
  } catch (err) {
    console.error('Delete chat error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete chat',
    });
  }
};

/* ---------------- RENAME CHAT ---------------- */
export const renameChat = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId, name } = req.body;

    const trimmed = name?.trim();
    if (!chatId || !trimmed) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and a non-empty name are required',
      });
    }

    const updated = await Chat.findOneAndUpdate(
      { _id: chatId, userId },
      { name: trimmed.slice(0, 100) },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found',
      });
    }

    return res.status(200).json({
      success: true,
      name: updated.name,
    });
  } catch (err) {
    console.error('Rename chat error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to rename chat',
    });
  }
};
