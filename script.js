import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';

const socket = io();

let currentUser = '';
let authMode = 'login';
let firebaseAuth;
let googleProvider;
const pendingGoogleSession = {
    idToken: '',
    email: '',
    uid: ''
};

const screens = {
    login: document.getElementById('login-screen'),
    passwordSetup: document.getElementById('password-setup-screen'),
    profileSetup: document.getElementById('profile-setup-screen'),
    chat: document.getElementById('chat-screen')
};

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
const googleAuthBtn = document.getElementById('google-auth-btn');

const googlePasswordInput = document.getElementById('google-password');
const toggleGooglePasswordBtn = document.getElementById('toggle-google-password-btn');
const googlePasswordEyeIcon = document.getElementById('google-password-eye-icon');
const googlePasswordSubmitBtn = document.getElementById('google-password-submit-btn');
const googlePasswordMessage = document.getElementById('google-password-message');

const profileUsernameInput = document.getElementById('profile-username');
const profileDisplayNameInput = document.getElementById('profile-display-name');
const profileSubmitBtn = document.getElementById('profile-submit-btn');
const profileMessage = document.getElementById('profile-message');

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

const stickerBtn = document.getElementById('sticker-btn');
const categoryTabs = Array.from(document.querySelectorAll('.chat-tab'));
const bottomNavItems = Array.from(document.querySelectorAll('.bottom-nav-item'));

const eyeIconPath = 'M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z';
const eyeSlashIconPath = 'M2.71 3.93 1.39 5.34l3.03 3.03A11.58 11.58 0 0 0 1 12c1.73 3.89 6 7 11 7 2.1 0 4.08-.55 5.78-1.5l3.83 3.83 1.41-1.41L2.71 3.93ZM7.53 11.48l1.57 1.57A3 3 0 0 1 9 12a3 3 0 0 1 .03-.52l-1.5-1.5a2.99 2.99 0 0 0 0 1.5ZM12 7c2.76 0 5 2.24 5 5 0 .81-.19 1.57-.53 2.24l1.46 1.46A6.9 6.9 0 0 0 19 12c0-3.87-3.13-7-7-7-.99 0-1.94.21-2.8.58l1.63 1.63c.37-.13.76-.21 1.17-.21Zm9 5c-.58-1.29-1.43-2.46-2.47-3.42l-1.43 1.43A9.95 9.95 0 0 1 18.89 12c-1.52 3.06-3.95 5-6.89 5-.89 0-1.73-.18-2.51-.5L7.9 14.91A4.98 4.98 0 0 0 12 17c5 0 9.27-3.11 11-7Z';

showLoginBtn.addEventListener('click', () => setAuthMode('login'));
showSignupBtn.addEventListener('click', () => setAuthMode('signup'));
authSubmitBtn.addEventListener('click', submitAuthForm);
googleAuthBtn.addEventListener('click', beginGoogleSignIn);
togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
toggleGooglePasswordBtn.addEventListener('click', toggleGooglePasswordVisibility);
googlePasswordSubmitBtn.addEventListener('click', submitGooglePassword);
profileSubmitBtn.addEventListener('click', submitGoogleProfile);

if (stickerBtn) {
    stickerBtn.addEventListener('click', () => {
        messageInput.value = `${messageInput.value}😊`;
        messageInput.focus();
    });
}

categoryTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
        categoryTabs.forEach((item) => item.classList.remove('active'));
        tab.classList.add('active');
    });
});

bottomNavItems.forEach((item) => {
    item.addEventListener('click', () => {
        bottomNavItems.forEach((nav) => nav.classList.remove('active'));
        item.classList.add('active');
    });
});

[nameInput, usernameInput, passwordInput].forEach((input) => {
    input.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') submitAuthForm();
    });
});

googlePasswordInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') submitGooglePassword();
});

[profileUsernameInput, profileDisplayNameInput].forEach((input) => {
    input.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') submitGoogleProfile();
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
    showAuthMessage('');
}

function showScreen(screenName) {
    Object.values(screens).forEach((screen) => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

async function postJson(endpoint, payload) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(result.message || 'Request failed.');
    }

    return result;
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
        const payload = isSignup ? { name, username, password } : { username, password };
        const result = await postJson(endpoint, payload);

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
        showAuthMessage(error.message || 'Unable to connect right now. Please try again.', true);
    } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = authMode === 'signup' ? 'Create Account' : 'Log In';
    }
}

async function beginGoogleSignIn() {
    googleAuthBtn.disabled = true;
    googleAuthBtn.textContent = 'Opening Google...';
    showAuthMessage('');

    try {
        await ensureFirebaseReady();
        const authResult = await signInWithPopup(firebaseAuth, googleProvider);
        const idToken = await authResult.user.getIdToken(true);

        pendingGoogleSession.idToken = idToken;
        pendingGoogleSession.email = authResult.user.email || '';
        pendingGoogleSession.uid = authResult.user.uid;

        const result = await postJson('/api/auth/google', { idToken });

        if (result.requiresPassword) {
            showScreen('passwordSetup');
            googlePasswordInput.value = '';
            googlePasswordInput.focus();
            return;
        }

        if (result.requiresProfileSetup) {
            openProfileSetup(result.user);
            return;
        }

        currentUser = result.user.username;
        enterChat();
    } catch (error) {
        showAuthMessage(error.message || 'Google sign-in failed. Please try again.', true);
    } finally {
        googleAuthBtn.disabled = false;
        googleAuthBtn.textContent = 'Continue with Google';
    }
}

async function ensureFirebaseReady() {
    if (firebaseAuth && googleProvider) {
        return;
    }

    const response = await fetch('/api/config/firebase');
    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(result.message || 'Firebase is not configured on server.');
    }

    const app = initializeApp(result.config);
    firebaseAuth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
}

async function submitGooglePassword() {
    const password = googlePasswordInput.value.trim();

    if (password.length < 6) {
        showInlineMessage(googlePasswordMessage, 'Password must be at least 6 characters.', true);
        return;
    }

    googlePasswordSubmitBtn.disabled = true;
    googlePasswordSubmitBtn.textContent = 'Saving...';
    showInlineMessage(googlePasswordMessage, '');

    try {
        await postJson('/api/auth/google/set-password', {
            idToken: pendingGoogleSession.idToken,
            password
        });

        showInlineMessage(googlePasswordMessage, 'Password saved successfully.');
        openProfileSetup();
    } catch (error) {
        showInlineMessage(googlePasswordMessage, error.message || 'Unable to save password.', true);
    } finally {
        googlePasswordSubmitBtn.disabled = false;
        googlePasswordSubmitBtn.textContent = 'Save Password';
    }
}

function openProfileSetup(user = {}) {
    showScreen('profileSetup');
    profileUsernameInput.value = user.username || '';
    profileDisplayNameInput.value = user.displayName || user.name || '';
    showInlineMessage(profileMessage, '');
    profileUsernameInput.focus();
}

async function submitGoogleProfile() {
    const username = profileUsernameInput.value.trim();
    const displayName = profileDisplayNameInput.value.trim();

    if (!username || !displayName) {
        showInlineMessage(profileMessage, 'Username and display name are required.', true);
        return;
    }

    profileSubmitBtn.disabled = true;
    profileSubmitBtn.textContent = 'Saving...';
    showInlineMessage(profileMessage, '');

    try {
        const result = await postJson('/api/auth/google/profile', {
            idToken: pendingGoogleSession.idToken,
            username,
            displayName
        });

        currentUser = result.user.username;
        enterChat();
    } catch (error) {
        showInlineMessage(profileMessage, error.message || 'Unable to save profile.', true);
    } finally {
        profileSubmitBtn.disabled = false;
        profileSubmitBtn.textContent = 'Save Profile';
    }
}

function showAuthMessage(message, isError = false) {
    showInlineMessage(authMessage, message, isError);
}

function showInlineMessage(element, message, isError = false) {
    element.textContent = message;
    if (!message) {
        element.className = 'auth-message';
        return;
    }

    element.className = `auth-message${isError ? ' error' : ' success'}`;
}

function togglePasswordVisibility() {
    const isVisible = passwordInput.type === 'text';
    const nextStateIsVisible = !isVisible;

    passwordInput.type = nextStateIsVisible ? 'text' : 'password';
    togglePasswordBtn.setAttribute('aria-pressed', String(nextStateIsVisible));
    togglePasswordBtn.setAttribute('aria-label', nextStateIsVisible ? 'Hide password' : 'Show password');
    passwordEyeIcon.innerHTML = `<path d="${nextStateIsVisible ? eyeSlashIconPath : eyeIconPath}"></path>`;
}

function toggleGooglePasswordVisibility() {
    const isVisible = googlePasswordInput.type === 'text';
    const nextStateIsVisible = !isVisible;

    googlePasswordInput.type = nextStateIsVisible ? 'text' : 'password';
    toggleGooglePasswordBtn.setAttribute('aria-pressed', String(nextStateIsVisible));
    toggleGooglePasswordBtn.setAttribute('aria-label', nextStateIsVisible ? 'Hide password' : 'Show password');
    googlePasswordEyeIcon.innerHTML = `<path d="${nextStateIsVisible ? eyeSlashIconPath : eyeIconPath}"></path>`;
}

function enterChat() {
    messages.innerHTML = '';
    typingIndicator.textContent = '';

    socket.emit('join', { username: currentUser });

    showScreen('chat');
    currentUserSpan.textContent = currentUser;
    sidebarAvatar.textContent = currentUser.charAt(0).toUpperCase();
    window.location.hash = 'chat';

    messageInput.focus();
}

leaveBtn.addEventListener('click', async () => {
    if (firebaseAuth?.currentUser) {
        await firebaseAuth.signOut();
    }

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
