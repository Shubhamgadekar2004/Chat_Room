const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Store chat history and users
let chatHistory = [];
let connectedUsers = new Map();
let typingUsers = new Set();

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle user joining
  socket.on('join', (username) => {
    // Store user info
    connectedUsers.set(socket.id, {
      username: username,
      joinTime: new Date()
    });

    // Send chat history to the new user
    socket.emit('chat_history', chatHistory);

    // Broadcast user joined notification
    const joinMessage = {
      type: 'notification',
      message: `${username} joined the chat`,
      timestamp: new Date().toISOString(),
      id: Date.now()
    };
    
    socket.broadcast.emit('user_joined', joinMessage);
    
    // Send updated user count
    io.emit('user_count', connectedUsers.size);
    
    console.log(`${username} joined the chat`);
  });

  // Handle chat messages
  socket.on('chat_message', (data) => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      const messageData = {
        type: 'message',
        username: user.username,
        message: data.message,
        timestamp: new Date().toISOString(),
        id: Date.now()
      };

      // Store message in chat history
      chatHistory.push(messageData);
      
      // Keep only last 100 messages
      if (chatHistory.length > 100) {
        chatHistory.shift();
      }

      // Broadcast message to all users
      io.emit('chat_message', messageData);
    }
  });

  // Handle typing indicator
  socket.on('typing', (isTyping) => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      if (isTyping) {
        typingUsers.add(user.username);
      } else {
        typingUsers.delete(user.username);
      }
      
      // Broadcast typing users to all clients except sender
      socket.broadcast.emit('typing_update', Array.from(typingUsers));
    }
  });

  // Handle user disconnection
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      // Remove from typing users
      typingUsers.delete(user.username);
      
      // Remove from connected users
      connectedUsers.delete(socket.id);

      // Broadcast user left notification
      const leaveMessage = {
        type: 'notification',
        message: `${user.username} left the chat`,
        timestamp: new Date().toISOString(),
        id: Date.now()
      };
      
      socket.broadcast.emit('user_left', leaveMessage);
      
      // Send updated user count and typing indicator
      io.emit('user_count', connectedUsers.size);
      io.emit('typing_update', Array.from(typingUsers));
      
      console.log(`${user.username} left the chat`);
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to access the chat room`);
});