const socket = io();

let currentUser = '';

const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const nameInput = document.getElementById('name');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('toggle-password-btn');
const passwordEyeIcon = document.getElementById('password-eye-icon');
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
const eyeIconPath = 'M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z';
const eyeSlashIconPath = 'M2.71 3.93 1.39 5.34l3.03 3.03A11.58 11.58 0 0 0 1 12c1.73 3.89 6 7 11 7 2.1 0 4.08-.55 5.78-1.5l3.83 3.83 1.41-1.41L2.71 3.93ZM7.53 11.48l1.57 1.57A3 3 0 0 1 9 12a3 3 0 0 1 .03-.52l-1.5-1.5a2.99 2.99 0 0 0 0 1.5ZM12 7c2.76 0 5 2.24 5 5 0 .81-.19 1.57-.53 2.24l1.46 1.46A6.9 6.9 0 0 0 19 12c0-3.87-3.13-7-7-7-.99 0-1.94.21-2.8.58l1.63 1.63c.37-.13.76-.21 1.17-.21Zm9 5c-.58-1.29-1.43-2.46-2.47-3.42l-1.43 1.43A9.95 9.95 0 0 1 18.89 12c-1.52 3.06-3.95 5-6.89 5-.89 0-1.73-.18-2.51-.5L7.9 14.91A4.98 4.98 0 0 0 12 17c5 0 9.27-3.11 11-7Z';

showLoginBtn.addEventListener('click', () => setAuthMode('login'));
showSignupBtn.addEventListener('click', () => setAuthMode('signup'));
authSubmitBtn.addEventListener('click', submitAuthForm);
togglePasswordBtn.addEventListener('click', togglePasswordVisibility);

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
    const username = usernameInput.value;
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

function togglePasswordVisibility() {
    const isVisible = passwordInput.type === 'text';
    const nextStateIsVisible = !isVisible;

    passwordInput.type = nextStateIsVisible ? 'text' : 'password';
    togglePasswordBtn.setAttribute('aria-pressed', String(nextStateIsVisible));
    togglePasswordBtn.setAttribute('aria-label', nextStateIsVisible ? 'Hide password' : 'Show password');
    passwordEyeIcon.innerHTML = `<path d="${nextStateIsVisible ? eyeSlashIconPath : eyeIconPath}"></path>`;
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
