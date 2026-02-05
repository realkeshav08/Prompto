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

    const chats = await Chat.find({ userId })
      .sort({ updatedAt: -1 })
      .lean();

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
