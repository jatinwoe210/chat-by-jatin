const socket = io();

let currentUser = '';
let currentRoom = '';

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
const chatRoomHeading = document.getElementById('chat-room-heading');
const currentUserSpan = document.getElementById('current-user');
const sidebarAvatar = document.getElementById('sidebar-avatar');
const typingIndicator = document.getElementById('typing-indicator');
const userCount = document.getElementById('user-count');
const activeMembers = document.getElementById('active-members');

joinBtn.addEventListener('click', joinChat);
usernameInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') joinChat();
});
roomInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') joinChat();
});

function joinChat() {
    const username = usernameInput.value.trim();
    const room = roomInput.value.trim() || 'General';

    if (!username) {
        usernameInput.focus();
        return;
    }

    currentUser = username;
    currentRoom = room;

    socket.emit('join', { username, room });

    loginScreen.classList.remove('active');
    chatScreen.classList.add('active');

    roomTitle.textContent = room;
    chatRoomHeading.textContent = room;
    currentUserSpan.textContent = username;
    sidebarAvatar.textContent = username.charAt(0).toUpperCase();

    messageInput.focus();
}

leaveBtn.addEventListener('click', () => {
    socket.disconnect();
    location.reload();
});

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') sendMessage();
});

let typingTimer;

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    socket.emit('chat message', { message });
    messageInput.value = '';
    stopTyping();
}

messageInput.addEventListener('input', () => {
    socket.emit('typing', { isTyping: true });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(stopTyping, 1000);
});

function stopTyping() {
    socket.emit('typing', { isTyping: false });
}

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
    typingIndicator.textContent = data.isTyping ? `${data.username} is typing...` : '';
});

function addMessage(data) {
    const messageDiv = document.createElement('div');
    const isCurrentUser = data.username === currentUser;
    const avatarInitial = data.username.charAt(0).toUpperCase();

    messageDiv.className = `message${isCurrentUser ? ' own' : ''}`;
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatarInitial}</div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-username">${escapeHtml(data.username)}</span>
                <span class="message-time">${escapeHtml(data.timestamp)}</span>
            </div>
            <div class="message-text">${escapeHtml(data.message)}</div>
        </div>
    `;

    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

function addSystemMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = message;
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

function updateUsersList(userList) {
    usersList.innerHTML = '';
    userCount.textContent = `${userList.length} online`;
    activeMembers.textContent = `${userList.length} participant${userList.length === 1 ? '' : 's'}`;

    userList.forEach((username) => {
        const userDiv = document.createElement('div');
        const activeClass = username === currentUser ? ' active' : '';
        const subtitle = username === currentUser ? 'You' : `In ${currentRoom}`;

        userDiv.className = `user-item${activeClass}`;
        userDiv.innerHTML = `
            <span class="user-presence"></span>
            <div class="user-meta">
                <strong>${escapeHtml(username)}</strong>
                <p>${escapeHtml(subtitle)}</p>
            </div>
        `;

        usersList.appendChild(userDiv);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
