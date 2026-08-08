const db = require("../config/db");
const { emitNewMessage, emitConversationUpdated } = require("../services/socket");

const actorType = (req) => (req.user.role === "driver" ? "DRIVER" : "USER");

// find this participant's open conversation, or start a new one
const findOrCreateConversation = async (participantType, participantId) => {
    const [[existing]] = await db.execute(
        `SELECT * FROM chat_conversations WHERE participant_type = ? AND participant_id = ? AND status = 'OPEN' ORDER BY id DESC LIMIT 1`,
        [participantType, participantId]
    );
    if (existing) return existing;

    const [result] = await db.execute(
        `INSERT INTO chat_conversations (participant_type, participant_id, status, created_at, updated_at)
         VALUES (?, ?, 'OPEN', NOW(), NOW())`,
        [participantType, participantId]
    );
    const [[created]] = await db.execute(`SELECT * FROM chat_conversations WHERE id = ?`, [result.insertId]);
    return created;
};

// ═══════════════════════════════════════════════════════════════════════════════
//  USER / DRIVER — my support conversation
// ═══════════════════════════════════════════════════════════════════════════════

// GET /support/conversation — fetch (or create) my open conversation + its messages
exports.getMyConversation = async (req, res) => {
    try {
        const participantType = actorType(req);
        const participantId = req.user.id;

        const conversation = await findOrCreateConversation(participantType, participantId);

        const [messages] = await db.execute(
            `SELECT id, conversation_id, sender_type, sender_id, message, created_at
             FROM chat_messages WHERE conversation_id = ? ORDER BY id ASC`,
            [conversation.id]
        );

        // opening the thread clears what's unread on my side
        if (conversation.unread_by_participant > 0) {
            await db.execute(`UPDATE chat_conversations SET unread_by_participant = 0 WHERE id = ?`, [conversation.id]);
        }

        return res.json({ status: true, message: "Conversation fetched", data: { conversation, messages } });
    } catch (error) {
        console.error("getMyConversation error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// POST /support/send  { message }
exports.sendMessage = async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ status: false, message: "message is required" });
        }

        const participantType = actorType(req);
        const participantId = req.user.id;
        const conversation = await findOrCreateConversation(participantType, participantId);

        const [result] = await db.execute(
            `INSERT INTO chat_messages (conversation_id, sender_type, sender_id, message, created_at)
             VALUES (?, ?, ?, ?, NOW())`,
            [conversation.id, participantType, participantId, message.trim()]
        );

        await db.execute(
            `UPDATE chat_conversations
             SET status = 'OPEN', last_message = ?, last_message_at = NOW(),
                 unread_by_admin = unread_by_admin + 1, updated_at = NOW()
             WHERE id = ?`,
            [message.trim(), conversation.id]
        );

        const [[saved]] = await db.execute(`SELECT * FROM chat_messages WHERE id = ?`, [result.insertId]);
        emitNewMessage(conversation.id, saved);
        emitConversationUpdated(conversation.id, { last_message: message.trim(), unread_bump: true });

        return res.json({ status: true, message: "Message sent", data: saved });
    } catch (error) {
        console.error("sendMessage error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ADMIN — support inbox
// ═══════════════════════════════════════════════════════════════════════════════

// GET /admin/support/conversations?status=OPEN|CLOSED&search=
exports.adminGetConversations = async (req, res) => {
    try {
        const { status, search, page, limit } = req.query;
        const limitNum = Math.max(1, Number(limit) || 20);
        const pageNum  = Math.max(1, Number(page)  || 1);
        const offset   = (pageNum - 1) * limitNum;

        const conditions = [];
        const values = [];
        if (status) { conditions.push(`c.status = ?`); values.push(status.toUpperCase()); }
        const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

        const [[{ total }]] = await db.execute(`SELECT COUNT(*) AS total FROM chat_conversations c ${where}`, values);

        const [rows] = await db.execute(`
            SELECT c.*,
                   CASE c.participant_type WHEN 'USER' THEN u.name ELSE d.full_name END AS participant_name,
                   CASE c.participant_type WHEN 'USER' THEN u.mobile ELSE d.phone END AS participant_mobile
            FROM chat_conversations c
            LEFT JOIN users u   ON c.participant_type = 'USER'   AND u.id = c.participant_id
            LEFT JOIN drivers d ON c.participant_type = 'DRIVER' AND d.id = c.participant_id
            ${where}
            ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
            LIMIT ${limitNum} OFFSET ${offset}
        `, values);

        const filtered = search
            ? rows.filter(r => (r.participant_name || "").toLowerCase().includes(search.toLowerCase())
                             || (r.participant_mobile || "").includes(search))
            : rows;

        return res.json({
            status: true,
            message: "Conversations fetched",
            pagination: { total, page: pageNum, limit: limitNum, total_pages: Math.ceil(total / limitNum) },
            data: filtered
        });
    } catch (error) {
        console.error("adminGetConversations error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// GET /admin/support/conversations/:id/messages
exports.adminGetMessages = async (req, res) => {
    try {
        const { id } = req.params;

        const [[conversation]] = await db.execute(`SELECT * FROM chat_conversations WHERE id = ?`, [id]);
        if (!conversation) return res.status(404).json({ status: false, message: "Conversation not found" });

        const [messages] = await db.execute(
            `SELECT id, conversation_id, sender_type, sender_id, message, created_at
             FROM chat_messages WHERE conversation_id = ? ORDER BY id ASC`,
            [id]
        );

        if (conversation.unread_by_admin > 0) {
            await db.execute(`UPDATE chat_conversations SET unread_by_admin = 0 WHERE id = ?`, [id]);
        }

        return res.json({ status: true, message: "Messages fetched", data: { conversation, messages } });
    } catch (error) {
        console.error("adminGetMessages error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// POST /admin/support/conversations/:id/send  { message }
exports.adminSendMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ status: false, message: "message is required" });
        }

        const [[conversation]] = await db.execute(`SELECT * FROM chat_conversations WHERE id = ?`, [id]);
        if (!conversation) return res.status(404).json({ status: false, message: "Conversation not found" });

        const adminId = req.user?.id || null;
        const [result] = await db.execute(
            `INSERT INTO chat_messages (conversation_id, sender_type, sender_id, message, created_at)
             VALUES (?, 'ADMIN', ?, ?, NOW())`,
            [id, adminId, message.trim()]
        );

        await db.execute(
            `UPDATE chat_conversations
             SET last_message = ?, last_message_at = NOW(),
                 unread_by_participant = unread_by_participant + 1, updated_at = NOW()
             WHERE id = ?`,
            [message.trim(), id]
        );

        const [[saved]] = await db.execute(`SELECT * FROM chat_messages WHERE id = ?`, [result.insertId]);
        emitNewMessage(id, saved);
        emitConversationUpdated(id, { last_message: message.trim() });

        return res.json({ status: true, message: "Reply sent", data: saved });
    } catch (error) {
        console.error("adminSendMessage error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// PATCH /admin/support/conversations/:id/close
exports.adminCloseConversation = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute(`UPDATE chat_conversations SET status = 'CLOSED', updated_at = NOW() WHERE id = ?`, [id]);
        emitConversationUpdated(id, { status: "CLOSED" });
        return res.json({ status: true, message: "Conversation closed" });
    } catch (error) {
        console.error("adminCloseConversation error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};

// PATCH /admin/support/conversations/:id/reopen
exports.adminReopenConversation = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute(`UPDATE chat_conversations SET status = 'OPEN', updated_at = NOW() WHERE id = ?`, [id]);
        emitConversationUpdated(id, { status: "OPEN" });
        return res.json({ status: true, message: "Conversation reopened" });
    } catch (error) {
        console.error("adminReopenConversation error:", error);
        return res.status(500).json({ status: false, message: error.message });
    }
};
