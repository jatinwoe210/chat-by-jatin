const socket = io();

let currentUser = '';

const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const nameInput = document.getElementById('name');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const nameGroup = document.getElementById('name-group');
const showLoginBtn = document.getElementById('show-login-btn');
const showSignupBtn = document.getElementById('show-signup-btn');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authMessage = document.getElementById('auth-message');
const leaveBtn = document.getElementById('leave-btn');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messages = document.getElementById('messages');
const usersList = document.getElementById('users-list');
const currentUserSpan = document.getElementById('current-user');
const sidebarAvatar = document.getElementById('sidebar-avatar');
const typingIndicator = document.getElementById('typing-indicator');
const userCount = document.getElementById('user-count');
const activeMembers = document.getElementById('active-members');

let authMode = 'login';

showLoginBtn.addEventListener('click', () => setAuthMode('login'));
showSignupBtn.addEventListener('click', () => setAuthMode('signup'));
authSubmitBtn.addEventListener('click', submitAuthForm);

[nameInput, usernameInput, passwordInput].forEach((input) => {
    input.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') submitAuthForm();
    });
});

function setAuthMode(mode) {
    authMode = mode;
    const isSignup = mode === 'signup';

    showLoginBtn.classList.toggle('active', !isSignup);
    showSignupBtn.classList.toggle('active', isSignup);
    nameGroup.classList.toggle('hidden', !isSignup);
    authSubmitBtn.textContent = isSignup ? 'Create Account' : 'Log In';
    passwordInput.autocomplete = isSignup ? 'new-password' : 'current-password';
    authMessage.textContent = '';
    authMessage.className = 'auth-message';
}

async function submitAuthForm() {
    const name = nameInput.value.trim();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const isSignup = authMode === 'signup';

    if (isSignup && !name) {
        showAuthMessage('Please enter your name.', true);
        nameInput.focus();
        return;
    }

    if (!username || !password) {
        showAuthMessage('Please enter username and password.', true);
        if (!username) {
            usernameInput.focus();
        } else {
            passwordInput.focus();
        }
        return;
    }

    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = isSignup ? 'Creating...' : 'Logging in...';
    showAuthMessage('');

    try {
        const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login';
        const payload = isSignup
            ? { name, username, password }
            : { username, password };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            showAuthMessage(result.message || 'Something went wrong. Please try again.', true);
            return;
        }

        showAuthMessage(result.message || (isSignup ? 'Signup successful.' : 'Login successful.'));

        if (isSignup) {
            setAuthMode('login');
            passwordInput.value = '';
            passwordInput.focus();
            return;
        }

        currentUser = username;
        enterChat();
    } catch (error) {
        showAuthMessage('Unable to connect right now. Please try again.', true);
    } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = authMode === 'signup' ? 'Create Account' : 'Log In';
    }
}

function showAuthMessage(message, isError = false) {
    authMessage.textContent = message;
    if (!message) {
        authMessage.className = 'auth-message';
        return;
    }

    authMessage.className = `auth-message${isError ? ' error' : ' success'}`;
}

function enterChat() {
    messages.innerHTML = '';
    typingIndicator.textContent = '';

    socket.emit('join', { username: currentUser });

    loginScreen.classList.remove('active');
    chatScreen.classList.add('active');

    currentUserSpan.textContent = currentUser;
    sidebarAvatar.textContent = currentUser.charAt(0).toUpperCase();
    window.location.hash = 'chat';

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

socket.on('chat history', (history) => {
    messages.innerHTML = '';

    history.forEach((message) => {
        addMessage(message);
    });
});

socket.on('chat message', (data) => {
    addMessage(data);
});

socket.on('message error', (errorMessage) => {
    addSystemMessage(errorMessage);
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
        const subtitle = username === currentUser ? 'You' : 'Online';

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
