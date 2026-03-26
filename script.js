import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';

const socket = io();

let currentUser = '';
let currentUserProfile = { uid: '', username: '', displayName: '', email: '', bio: '', photoURL: '' };
let selectedContact = null;
let contacts = [];
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

const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messages = document.getElementById('messages');
const usersList = document.getElementById('users-list');
const sidebarAvatar = document.getElementById('sidebar-avatar') || document.getElementById('user-pic');
const sidebarName = document.getElementById('sidebar-name') || document.getElementById('user-name');
const sidebarEmail = document.getElementById('sidebar-email');
const userNameLabel = sidebarName;
const userPic = sidebarAvatar;
const typingIndicator = document.getElementById('typing-indicator');
const chatTitle = document.getElementById('chat-title');
const addUserBtn = document.getElementById('add-user-btn');
const sidebarProfileBtn = document.getElementById('sidebar-profile-btn');
const profileDrawer = document.getElementById('profile-drawer');
const closeProfileDrawerBtn = document.getElementById('close-profile-drawer-btn');
const drawerAvatar = document.getElementById('drawer-avatar');
const drawerAvatarEditBtn = document.getElementById('drawer-avatar-edit-btn');
const avatarUploadInput = document.getElementById('avatar-upload');
const drawerDisplayName = document.getElementById('drawer-display-name');
const drawerUsername = document.getElementById('drawer-username');
const drawerContactInfo = document.getElementById('drawer-contact-info');
const drawerBioInput = document.getElementById('drawer-bio');
const saveBioBtn = document.getElementById('save-bio-btn');
const drawerBioMessage = document.getElementById('drawer-bio-message');
const drawerLogoutBtn = document.getElementById('drawer-logout-btn');

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

if (addUserBtn) {
    addUserBtn.addEventListener('click', handleAddContact);
}

if (profileDrawer) {
    profileDrawer.hidden = true;
}

function openProfileDrawer() {
    if (!profileDrawer) return;
    syncProfileDrawer();
    profileDrawer.hidden = false;
    profileDrawer.classList.add('active');
}

function closeProfileDrawer() {
    if (!profileDrawer) return;
    profileDrawer.classList.remove('active');
    profileDrawer.hidden = true;
}

if (sidebarProfileBtn) {
    sidebarProfileBtn.addEventListener('click', openProfileDrawer);
}

if (closeProfileDrawerBtn) {
    closeProfileDrawerBtn.onclick = closeProfileDrawer;
}

if (profileDrawer) {
    profileDrawer.addEventListener('click', (event) => {
        if (event.target === profileDrawer) {
            closeProfileDrawer();
        }
    });
}

if (drawerBioInput) {
    drawerBioInput.addEventListener('input', () => {
        currentUserProfile.bio = drawerBioInput.value.trim();
    });
}

if (saveBioBtn) {
    saveBioBtn.addEventListener('click', saveBio);
}

if (drawerAvatarEditBtn && avatarUploadInput) {
    drawerAvatarEditBtn.addEventListener('click', () => avatarUploadInput.click());
    avatarUploadInput.addEventListener('change', uploadProfilePhoto);
}

document.addEventListener('click', (event) => {
    if (!profileDrawer || profileDrawer.hidden) return;

    const clickedInsideDrawer = event.target.closest('.profile-drawer');
    const clickedProfileButton = event.target.closest('#sidebar-profile-btn');

    if (!clickedInsideDrawer && !clickedProfileButton) {
        closeProfileDrawer();
    }
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

async function patchJson(endpoint, payload) {
    const response = await fetch(endpoint, {
        method: 'PATCH',
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

        currentUser = result.user?.username || username;
        currentUserProfile = {
            uid: result.user?.uid || '',
            username: result.user?.username || username,
            displayName: result.user?.displayName || result.user?.name || username,
            email: result.user?.email || '',
            bio: result.user?.bio || '',
            photoURL: result.user?.photoURL || ''
        };
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
        currentUserProfile.displayName = authResult.user.displayName || currentUserProfile.displayName || '';
        currentUserProfile.photoURL = authResult.user.photoURL || currentUserProfile.photoURL || '';
        currentUserProfile.email = authResult.user.email || currentUserProfile.email || '';
        syncProfileHeader(currentUserProfile.displayName);

        if (sidebarEmail) {
            sidebarEmail.textContent = currentUserProfile.email || sidebarEmail.textContent;
        }

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
        currentUserProfile = {
            uid: result.user.uid || pendingGoogleSession.uid || '',
            username: result.user.username,
            displayName: result.user.displayName || result.user.name || result.user.username,
            email: result.user.email || pendingGoogleSession.email || '',
            bio: result.user.bio || '',
            photoURL: result.user.photoURL || ''
        };
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
        currentUserProfile = {
            uid: result.user.uid || pendingGoogleSession.uid || '',
            username: result.user.username,
            displayName: result.user.displayName || result.user.username,
            email: result.user.email || pendingGoogleSession.email || '',
            bio: result.user.bio || '',
            photoURL: result.user.photoURL || ''
        };
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
    selectedContact = null;

    socket.emit('join', { username: currentUser });

    showScreen('chat');
    const resolvedDisplayName = currentUserProfile.displayName || currentUser;
    sidebarEmail.textContent = `@${currentUserProfile.username || currentUser}`;
    syncProfileDrawer();
    syncProfileHeader(resolvedDisplayName);
    chatTitle.textContent = 'My Contacts';
    closeProfileDrawer();
    window.location.hash = 'chat';
    loadContacts();
}

async function handleLogout() {
    if (firebaseAuth?.currentUser) {
        await firebaseAuth.signOut();
    }

    socket.disconnect();
    location.reload();
}

if (drawerLogoutBtn) {
    drawerLogoutBtn.addEventListener('click', handleLogout);
}

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') sendMessage();
});

let typingTimer;
const renderedMessageMap = new Map();

function syncProfileHeader(displayName) {
    const resolvedDisplayName = displayName || currentUser || 'User';
    const initial = resolvedDisplayName.charAt(0).toUpperCase();
    userNameLabel.textContent = resolvedDisplayName;
    userPic.textContent = initial;
    userPic.style.backgroundImage = '';

    if (drawerAvatar) {
        const imageUrl = currentUserProfile.photoURL || '';
        if (imageUrl) {
            drawerAvatar.src = imageUrl;
        } else {
            drawerAvatar.removeAttribute('src');
        }
        drawerAvatar.alt = `${resolvedDisplayName} profile photo`;
    }

    if (currentUserProfile.photoURL) {
        userPic.textContent = '';
        userPic.style.backgroundImage = `url("${currentUserProfile.photoURL}")`;
        userPic.style.backgroundSize = 'cover';
        userPic.style.backgroundPosition = 'center';
    }
}

function syncProfileDrawer() {
    const displayName = currentUserProfile.displayName || currentUser || 'User';
    const username = currentUserProfile.username || currentUser || 'user';
    const contactInfo = `@${username}`;
    const bio = currentUserProfile.bio || '';

    if (drawerDisplayName) {
        drawerDisplayName.textContent = displayName;
    }

    if (drawerContactInfo) {
        drawerContactInfo.textContent = contactInfo;
    }

    if (drawerUsername) {
        drawerUsername.textContent = `@${username}`;
    }

    if (drawerBioInput) {
        drawerBioInput.value = bio;
    }

    showDrawerBioMessage('');
    syncProfileHeader(displayName);
}

function showDrawerBioMessage(message, isError = false) {
    if (!drawerBioMessage) return;
    drawerBioMessage.textContent = message;
    drawerBioMessage.className = `drawer-bio-message${isError ? ' error' : ''}`;
}

async function saveBio() {
    const bio = drawerBioInput?.value.trim() || '';
    if (bio.length > 140) {
        showDrawerBioMessage('Status can be at most 140 characters.', true);
        return;
    }

    if (saveBioBtn) {
        saveBioBtn.disabled = true;
        saveBioBtn.textContent = 'Saving...';
    }
    showDrawerBioMessage('');

    try {
        const result = await patchJson('/api/users/update-bio', {
            uid: currentUserProfile.uid || '',
            username: currentUserProfile.username || currentUser || '',
            bio
        });
        currentUserProfile.bio = result.user?.bio || bio;
        if (drawerBioInput) {
            drawerBioInput.value = currentUserProfile.bio;
        }
        syncProfileDrawer();
        showDrawerBioMessage('Status updated.');
    } catch (error) {
        showDrawerBioMessage(error.message || 'Unable to update status.', true);
    } finally {
        if (saveBioBtn) {
            saveBioBtn.disabled = false;
            saveBioBtn.textContent = 'Save status';
        }
    }
}

async function uploadProfilePhoto(event) {
    const selectedFile = event.target?.files?.[0];
    if (!selectedFile) {
        return;
    }

    if (!selectedFile.type.startsWith('image/')) {
        showDrawerBioMessage('Please select a valid image file.', true);
        return;
    }

    try {
        showDrawerBioMessage('Uploading profile photo...');
        drawerAvatarEditBtn.disabled = true;
        const payload = new FormData();
        payload.append('avatar', selectedFile);
        payload.append('uid', currentUserProfile.uid || '');
        payload.append('username', currentUserProfile.username || currentUser || '');

        const response = await fetch('/api/users/upload-avatar', {
            method: 'POST',
            body: payload
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Unable to upload profile photo.');
        }

        currentUserProfile.photoURL = result.user?.photoURL || '';
        syncProfileDrawer();
        showDrawerBioMessage('Profile photo updated.');
    } catch (error) {
        showDrawerBioMessage(error.message || 'Unable to update profile photo.', true);
    } finally {
        drawerAvatarEditBtn.disabled = false;
        avatarUploadInput.value = '';
    }
}

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !selectedContact) return;

    const payload = {
        senderUsername: currentUser,
        receiverUsername: selectedContact.username,
        text,
        clientMessageId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        status: 'sent'
    };

    try {
        await saveMessageToDB(payload);
        socket.emit('private message', payload);
        messageInput.value = '';
        stopTyping();
    } catch (error) {
        addSystemMessage(error.message || 'Unable to send message right now.');
    }
}

async function saveMessageToDB(msgData) {
    return postJson('/api/messages', {
        senderUsername: msgData.senderUsername,
        receiverUsername: msgData.receiverUsername,
        text: msgData.text,
        clientMessageId: msgData.clientMessageId
    });
}

messageInput.addEventListener('input', () => {
    if (!selectedContact) {
        return;
    }

    socket.emit('typing', { isTyping: true, toUsername: selectedContact.username });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(stopTyping, 1000);
});

function stopTyping() {
    if (!selectedContact) {
        return;
    }

    socket.emit('typing', { isTyping: false, toUsername: selectedContact.username });
}

socket.on('conversation history', (history) => {
    messages.innerHTML = '';

    history.forEach((message) => {
        addMessage(message);
    });
});

socket.on('receive-message', (data) => {
    addMessage(data);

    const senderUsername = data.senderUsername || data.senderId || '';
    const shouldMarkAsRead =
        senderUsername &&
        senderUsername !== currentUser &&
        selectedContact &&
        selectedContact.username === senderUsername;

    if (shouldMarkAsRead) {
        socket.emit('message read', {
            messageId: data.messageId || data._id || '',
            clientMessageId: data.clientMessageId || '',
            senderUsername,
            receiverUsername: currentUser
        });
    }
});

socket.on('message error', (errorMessage) => {
    addSystemMessage(errorMessage);
});

socket.on('user typing', (data) => {
    if (!selectedContact || data.username !== selectedContact.username) {
        typingIndicator.textContent = '';
        return;
    }

    typingIndicator.textContent = data.isTyping ? `${selectedContact.displayName} is typing...` : '';
});

function addMessage(data) {
    const messageDiv = document.createElement('div');
    const senderId = data.senderUsername || data.senderId || data.fromUsername || '';
    const messageText = data.text || data.message || '';
    const isCurrentUser = senderId === currentUser;
    const senderDisplayName = isCurrentUser ? 'You' : (selectedContact?.displayName || senderId || 'User');
    const avatarInitial = senderDisplayName.charAt(0).toUpperCase();
    const messageStatus = data.status || 'sent';
    const messageRef = data.messageId || data._id || data.clientMessageId || '';

    messageDiv.className = `message ${isCurrentUser ? 'sent' : 'received'}`;
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatarInitial}</div>
        <div class="message-content">
            <div class="message-header">
                <span class="message-username">${escapeHtml(senderDisplayName)}</span>
                <span class="message-time">${escapeHtml(data.timestamp)}</span>
            </div>
            <div class="message-text">${escapeHtml(messageText)}</div>
            ${isCurrentUser ? `<div class="message-status" data-message-ref="${escapeHtml(messageRef)}">${messageStatus === 'read' ? '✓✓' : '✓'}</div>` : ''}
        </div>
    `;

    if (isCurrentUser && messageRef) {
        renderedMessageMap.set(messageRef, messageDiv);
    }

    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

socket.on('message read update', (data) => {
    const messageRef = data.messageId || data.clientMessageId || '';
    if (!messageRef || !renderedMessageMap.has(messageRef)) {
        return;
    }

    const messageElement = renderedMessageMap.get(messageRef);
    const statusElement = messageElement?.querySelector('.message-status');
    if (statusElement) {
        statusElement.textContent = '✓✓';
    }
});

function addSystemMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = message;
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

function updateUsersList(userList) {
    usersList.innerHTML = '';

    userList.forEach((contact) => {
        const userDiv = document.createElement('div');
        const isActive = selectedContact?.username === contact.username;
        const activeClass = isActive ? ' active' : '';

        userDiv.className = `user-item${activeClass}`;
        userDiv.innerHTML = `
            <span class="user-presence"></span>
            <div class="user-meta">
                <strong>${escapeHtml(contact.displayName)}</strong>
                <p>@${escapeHtml(contact.username)}</p>
            </div>
        `;
        userDiv.addEventListener('click', () => selectContact(contact.username));

        usersList.appendChild(userDiv);
    });
}

async function loadContacts() {
    try {
        const response = await fetch(`/api/contacts?username=${encodeURIComponent(currentUser)}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Unable to load contacts.');
        }

        contacts = result.contacts || [];
        updateUsersList(contacts);
        messages.innerHTML = '';
        typingIndicator.textContent = '';
    } catch (error) {
        addSystemMessage(error.message || 'Unable to load contacts.');
    }
}

async function handleAddContact() {
    const enteredUsername = window.prompt('Enter username to add:');
    const contactUsername = enteredUsername ? enteredUsername.trim() : '';

    if (!contactUsername) {
        return;
    }

    try {
        const result = await postJson('/api/contacts/add', {
            username: currentUser,
            contactUsername
        });

        const exists = contacts.some((contact) => contact.username === result.contact.username);
        if (!exists) {
            contacts.push(result.contact);
            contacts.sort((a, b) => a.displayName.localeCompare(b.displayName));
            updateUsersList(contacts);
        }
    } catch (error) {
        addSystemMessage(error.message || 'Unable to add contact.');
    }
}

function selectContact(contactUsername) {
    const contact = contacts.find((item) => item.username === contactUsername);
    if (!contact) return;

    selectedContact = contact;
    chatTitle.textContent = contact.displayName;
    typingIndicator.textContent = '';
    messages.innerHTML = '';
    updateUsersList(contacts);
    socket.emit('open conversation', { contactUsername: contact.username });
    messageInput.focus();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
