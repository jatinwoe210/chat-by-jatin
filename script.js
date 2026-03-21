const socket = io();

let currentUser = '';
let currentRoom = '';

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const usernameInput = document.getElementById('username');
const roomInput = document.getElementById('room');
const joinBtn = document.getElementById('join-btn');
const leaveBtn = document.getElementById('leave-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messages = document.getElementById('messages');
const usersList = document.getElementById('users-list');
const roomTitle = document.getElementById('room-title');
const currentUserSpan = document.getElementById('current-user');
const typingIndicator = document.getElementById('typing-indicator');

// Join chat
joinBtn.addEventListener('click', joinChat);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinChat();
});
roomInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinChat();
});

function joinChat() {
    const username = usernameInput.value.trim();
    const room = roomInput.value.trim() || 'General';
    
    if (username) {
        currentUser = username;
        currentRoom = room;
        
        socket.emit('join', { username, room });
        
        loginScreen.classList.remove('active');
        chatScreen.classList.add('active');
        
        roomTitle.textContent = `Room: ${room}`;
        currentUserSpan.textContent = username;
        
        messageInput.focus();
    }
}

// Leave chat
leaveBtn.addEventListener('click', () => {
    socket.disconnect();
    location.reload();
});

// Send message
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

let typingTimer;
function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        socket.emit('chat message', { message });
        messageInput.value = '';
        stopTyping();
    }
}

// Typing indicator
messageInput.addEventListener('input', () => {
    socket.emit('typing', { isTyping: true });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(stopTyping, 1000);
});

function stopTyping() {
    socket.emit('typing', { isTyping: false });
}

// Socket events
socket.on('chat message', (data) => {
    addMessage(data);
});

socket.on('user joined', (data) => {
    addSystemMessage(data.message);
});

socket.on('user left', (data) => {
    addSystemMessage(data.message);
});

socket.on('room users', (userList) => {
    updateUsersList(userList);
});

socket.on('user typing', (data) => {
    if (data.isTyping) {
        typingIndicator.textContent = `${data.username} is typing...`;
    } else {
        typingIndicator.textContent = '';
    }
});

function addMessage(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    const avatarInitial = data.username.charAt(0).toUpperCase();
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatarInitial}</div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-username">${data.username}</span>
                <span class="message-time">${data.timestamp}</span>
            </div>
            <div class="message-text">${escapeHtml(data.message)}</div>
        </div>
    `;
    
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

function addSystemMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        text-align: center;
        color: #6c757d;
        font-style: italic;
        font-size: 14px;
        margin: 1rem 0;
    `;
    messageDiv.textContent = message;
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

function updateUsersList(userList) {
    usersList.innerHTML = '';
    userList.forEach(username => {
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        userDiv.textContent = username;
        usersList.appendChild(userDiv);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}