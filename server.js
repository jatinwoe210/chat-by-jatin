const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Store users and rooms
const users = new Map();
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user join
  socket.on('join', (data) => {
    const { username, room } = data;
    
    users.set(socket.id, { username, room });
    
    socket.join(room);
    
    // Notify room users
    socket.to(room).emit('user joined', { username, message: `${username} joined the chat` });
    
    // Send current users in room
    const roomUsers = Array.from(users.values())
      .filter(user => user.room === room)
      .map(user => user.username);
    
    socket.emit('room users', roomUsers);
    socket.to(room).emit('room users', roomUsers);
  });

  // Handle chat message
  socket.on('chat message', (data) => {
    const user = users.get(socket.id);
    if (user) {
      io.to(user.room).emit('chat message', {
        username: user.username,
        message: data.message,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    const user = users.get(socket.id);
    if (user) {
      socket.to(user.room).emit('user typing', {
        username: user.username,
        isTyping: data.isTyping
      });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      socket.to(user.room).emit('user left', { 
        username: user.username, 
        message: `${user.username} left the chat` 
      });
      users.delete(socket.id);
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});