const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "mysecretkey";

let io = null;

// Admin panel connections all join this room, so a single emit reaches every
// support agent looking at the Chat System page. Users/drivers join their own
// conversation room(s) explicitly (see 'join_conversation' below) — a person
// only needs live updates for the conversation they currently have open.
const ADMIN_ROOM = "admin_support";
const conversationRoom = (conversationId) => `conversation_${conversationId}`;

function initSocket(httpServer, allowedOrigins) {
    io = new Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
                return callback(new Error(`Not allowed by CORS: ${origin}`));
            },
            credentials: true
        }
    });

    // Handshake auth: client sends { auth: { token: "<jwt>", client_type: "USER"|"DRIVER"|"ADMIN" } }
    // client_type is trusted from the connecting app (same trust model the REST admin
    // routes already use — no separate admin role is encoded in the admin JWT today).
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token;
            if (!token) return next(new Error("Authentication required"));
            const actualToken = token.startsWith("Bearer ") ? token.split(" ")[1] : token;
            const decoded = jwt.verify(actualToken, SECRET);

            const clientType = socket.handshake.auth?.client_type;
            socket.participantType = clientType === "ADMIN"
                ? "ADMIN"
                : (decoded.role === "driver" ? "DRIVER" : "USER");
            socket.userId = decoded.id;
            next();
        } catch (err) {
            next(new Error("Invalid token"));
        }
    });

    io.on("connection", (socket) => {
        if (socket.participantType === "ADMIN") {
            socket.join(ADMIN_ROOM);
        }

        socket.on("join_conversation", (conversationId) => {
            if (conversationId) socket.join(conversationRoom(conversationId));
        });

        socket.on("leave_conversation", (conversationId) => {
            if (conversationId) socket.leave(conversationRoom(conversationId));
        });
    });

    return io;
}

function getIO() {
    return io;
}

// Broadcast a new message to whoever has this conversation open (admin panel +
// the participant's own screen, if they're both currently viewing it) and to the
// admin room generally (so the conversation list can bump/reorder without every
// admin needing to already have that specific thread open).
function emitNewMessage(conversationId, message) {
    if (!io) return;
    io.to(conversationRoom(conversationId)).emit("new_message", message);
    io.to(ADMIN_ROOM).emit("conversation_updated", { conversation_id: conversationId, last_message: message });
}

function emitConversationUpdated(conversationId, payload) {
    if (!io) return;
    io.to(ADMIN_ROOM).emit("conversation_updated", { conversation_id: conversationId, ...payload });
}

module.exports = { initSocket, getIO, emitNewMessage, emitConversationUpdated };
