require('dotenv').config();

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const RAW_MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://jatin:jatinwoeyua@19july@jatin-xo.vi8oyak.mongodb.net/?appName=Jatin-XO';
const PORT = process.env.PORT || 3000;

function normalizeMongoUri(uri) {
  const protocolSeparator = '://';
  const protocolIndex = uri.indexOf(protocolSeparator);

  if (protocolIndex === -1) {
    return uri;
  }

  const credentialsStart = protocolIndex + protocolSeparator.length;
  const atIndexes = [...uri.matchAll(/@/g)].map((match) => match.index);

  if (atIndexes.length <= 1) {
    return uri;
  }

  const hostSeparatorIndex = atIndexes[atIndexes.length - 1];
  const credentials = uri.slice(credentialsStart, hostSeparatorIndex);
  const colonIndex = credentials.indexOf(':');

  if (colonIndex === -1) {
    return uri;
  }

  const username = credentials.slice(0, colonIndex);
  const password = credentials.slice(colonIndex + 1);
  const encodedCredentials = `${username}:${encodeURIComponent(password)}`;

  return `${uri.slice(0, credentialsStart)}${encodedCredentials}${uri.slice(hostSeparatorIndex)}`;
}

const MONGODB_URI = normalizeMongoUri(RAW_MONGODB_URI);

const messageSchema = new mongoose.Schema(
  {
    room: {
      type: String,
      required: true,
      trim: true
    },
    username: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    }
  },
  {
    timestamps: true
  }
);

const Message = mongoose.model('Message', messageSchema);

function formatMessage(messageDocument) {
  const timestampSource = messageDocument.createdAt || new Date();

  return {
    username: messageDocument.username,
    message: messageDocument.message,
    timestamp: new Date(timestampSource).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
  };
}

// Serve static files
app.use(express.static(path.join(__dirname)));

// Store users by socket id
const users = new Map();

mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB Atlas');
});

mongoose.connection.on('error', (error) => {
  console.error('MongoDB connection error:', error.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('Disconnected from MongoDB Atlas');
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', async (data) => {
    const { username, room } = data;

    users.set(socket.id, { username, room });
    socket.join(room);

    try {
      const previousMessages = await Message.find({ room })
        .sort({ createdAt: 1 })
        .lean();

      socket.emit('room history', previousMessages.map(formatMessage));
    } catch (error) {
      console.error(`Failed to load message history for room "${room}":`, error.message);
      socket.emit('room history', []);
    }

    socket.to(room).emit('user joined', {
      username,
      message: `${username} joined the chat`
    });

    const roomUsers = Array.from(users.values())
      .filter((user) => user.room === room)
      .map((user) => user.username);

    io.to(room).emit('room users', roomUsers);
  });

  socket.on('chat message', async (data) => {
    const user = users.get(socket.id);
    const messageText = data.message?.trim();

    if (!user || !messageText) {
      return;
    }

    try {
      const savedMessage = await Message.create({
        room: user.room,
        username: user.username,
        message: messageText
      });

      io.to(user.room).emit('chat message', formatMessage(savedMessage));
    } catch (error) {
      console.error(`Failed to save message for room "${user.room}":`, error.message);
      socket.emit('message error', 'Unable to send message right now. Please try again.');
    }
  });

  socket.on('typing', (data) => {
    const user = users.get(socket.id);

    if (user) {
      socket.to(user.room).emit('user typing', {
        username: user.username,
        isTyping: data.isTyping
      });
    }
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);

    if (user) {
      socket.to(user.room).emit('user left', {
        username: user.username,
        message: `${user.username} left the chat`
      });
      users.delete(socket.id);

      const roomUsers = Array.from(users.values())
        .filter((roomUser) => roomUser.room === user.room)
        .map((roomUser) => roomUser.username);

      io.to(user.room).emit('room users', roomUsers);
    }

    console.log('User disconnected:', socket.id);
  });
});

async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });

    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB Atlas:', error.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`${signal} received. Closing resources...`);
  await mongoose.connection.close();
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', () => {
  shutdown('SIGINT').catch((error) => {
    console.error('Error during shutdown:', error.message);
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch((error) => {
    console.error('Error during shutdown:', error.message);
    process.exit(1);
  });
});

startServer();
