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

/* ---------------- GET CHATS ----------------
   Also acts as a safety net for abandoned sessions: a fresh browser tab
   auto-creates an empty "New Chat", and if the tab is closed without sending
   anything the client fires a best-effort delete. Should that beacon ever be
   lost (crash, offline, blocked), this sweep removes any of the user's empty
   chats left untouched for over an hour — long enough that an in-use session
   in another tab is never affected — so empty sessions can't accumulate. */
export const getChats = async (req, res) => {
  try {
    const userId = req.user._id;

    const ONE_HOUR_AGO = new Date(Date.now() - 60 * 60 * 1000);
    await Chat.deleteMany({
      userId,
      'messages.0': { $exists: false }, // no first element ⇒ messages array is empty
      updatedAt: { $lt: ONE_HOUR_AGO },
    });

    /* Cursor pagination — the list is ordered newest-first by updatedAt, and the
       client passes the last page's `nextCursor` to fetch older sessions. This
       bounds the payload for users with large histories instead of shipping the
       entire chat list (with all messages) on every load. */
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
    const filter = { userId };
    if (req.query.cursor) {
      const cursorDate = new Date(req.query.cursor);
      if (!isNaN(cursorDate.getTime())) filter.updatedAt = { $lt: cursorDate };
    }

    // Fetch one extra row to know whether another page exists.
    const rows = await Chat.find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const chats = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? chats[chats.length - 1].updatedAt : null;

    return res.status(200).json({
      success: true,
      chats,
      nextCursor,
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

/* ---------------- DELETE CHAT ----------------
   `onlyIfEmpty` is the safe path used by the auto-cleanup of unused "New Chat"
   sessions (tab close / chat switch). It atomically deletes only when the chat
   has zero messages, so a race against a parallel send in another tab can never
   wipe a real conversation. Without the flag this is the regular user-initiated
   delete (works whether the chat has messages or not). */
export const deleteChat = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId, onlyIfEmpty } = req.body;

    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID is required',
      });
    }

    const filter = { _id: chatId, userId };
    // messages.0 exists iff the array has at least one element. `$exists: false`
    // therefore means "messages array is empty" — used as an atomic guard.
    if (onlyIfEmpty) filter['messages.0'] = { $exists: false };

    const deleted = await Chat.findOneAndDelete(filter);

    if (!deleted) {
      // For an explicit user delete, "not found" is a 404. For the empty-only
      // auto-cleanup path, a non-match is expected (chat already gone, or no
      // longer empty) — respond success/kept so the client doesn't toast an error.
      if (onlyIfEmpty) {
        return res.status(200).json({ success: true, kept: true });
      }
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
