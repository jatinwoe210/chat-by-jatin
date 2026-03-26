require('dotenv').config();

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIo = require('socket.io');
const path = require('path');
const bcrypt = require('bcryptjs');
const admin = require('firebase-admin');

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
const SALT_ROUNDS = 10;

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

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  }
});

const Message = mongoose.model('Message', messageSchema);

const userSchema = new mongoose.Schema(
  {
    uid: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    name: {
      type: String,
      trim: true,
      default: ''
    },
    displayName: {
      type: String,
      trim: true,
      default: ''
    },
    username: {
      type: String,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },
    password: {
      type: String
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true
    },
    googleUid: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    photoURL: {
      type: String,
      trim: true,
      default: ''
    },
    googlePhotoURL: {
      type: String,
      trim: true,
      default: ''
    },
    customPhotoURL: {
      type: String,
      trim: true,
      default: ''
    },
    bio: {
      type: String,
      trim: true,
      default: '',
      maxlength: 140
    },
    authProviders: {
      type: [String],
      default: ['local']
    },
    contacts: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

const User = mongoose.model('User', userSchema);

function formatMessage(messageDocument) {
  const timestampSource = messageDocument.timestamp || messageDocument.createdAt || new Date();

  return {
    senderId:
      messageDocument.sender?._id?.toString?.() ||
      messageDocument.sender?.toString?.() ||
      messageDocument.senderId ||
      '',
    receiverId:
      messageDocument.receiver?._id?.toString?.() ||
      messageDocument.receiver?.toString?.() ||
      messageDocument.receiverId ||
      '',
    text: messageDocument.text,
    status: messageDocument.status || 'sent',
    timestamp: new Date(timestampSource).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
  };
}

function getFirebaseServiceAccountFromEnv() {
  const jsonFromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (jsonFromEnv) {
    try {
      return JSON.parse(jsonFromEnv);
    } catch (error) {
      console.error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON value:', error.message);
      return null;
    }
  }

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    return null;
  }

  return {
    project_id: FIREBASE_PROJECT_ID,
    client_email: FIREBASE_CLIENT_EMAIL,
    private_key: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  };
}

let isFirebaseAdminReady = false;

function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    isFirebaseAdminReady = true;
    return;
  }

  const serviceAccount = getFirebaseServiceAccountFromEnv();

  if (!serviceAccount) {
    console.warn('Firebase Admin credentials not found. Google auth endpoints are disabled.');
    isFirebaseAdminReady = false;
    return;
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  isFirebaseAdminReady = true;
}

function ensureFirebaseAdminConfigured() {
  if (!isFirebaseAdminReady) {
    throw new Error('Google authentication is not configured on the server.');
  }
}

async function verifyGoogleIdToken(idToken) {
  ensureFirebaseAdminConfigured();
  return admin.auth().verifyIdToken(idToken);
}

function upsertAuthProvider(existingProviders, provider) {
  const providers = Array.isArray(existingProviders) ? [...existingProviders] : [];

  if (!providers.includes(provider)) {
    providers.push(provider);
  }

  if (providers.length === 0) {
    providers.push('local');
  }

  return providers;
}

// Serve static files
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/api/config/firebase', (req, res) => {
  const {
    FIREBASE_API_KEY,
    FIREBASE_AUTH_DOMAIN,
    FIREBASE_PROJECT_ID,
    FIREBASE_APP_ID,
    FIREBASE_STORAGE_BUCKET,
    FIREBASE_MESSAGING_SENDER_ID
  } = process.env;

  if (!FIREBASE_API_KEY || !FIREBASE_AUTH_DOMAIN || !FIREBASE_PROJECT_ID || !FIREBASE_APP_ID) {
    return res.status(500).json({
      success: false,
      message: 'Firebase web config is not set on the server.'
    });
  }

  return res.status(200).json({
    success: true,
    config: {
      apiKey: FIREBASE_API_KEY,
      authDomain: FIREBASE_AUTH_DOMAIN,
      projectId: FIREBASE_PROJECT_ID,
      appId: FIREBASE_APP_ID,
      storageBucket: FIREBASE_STORAGE_BUCKET,
      messagingSenderId: FIREBASE_MESSAGING_SENDER_ID
    }
  });
});

app.post('/api/auth/signup', async (req, res) => {
  const { name, username, password } = req.body;
  const trimmedName = name?.trim();
  const rawUsername = typeof username === 'string' ? username.trim() : '';
  const trimmedPassword = password?.trim();

  if (!trimmedName || !rawUsername || !trimmedPassword) {
    return res.status(400).json({
      success: false,
      message: 'Name, username, and password are required.'
    });
  }

  try {
    const existingUser = await User.findOne({ username: rawUsername }).lean();

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Username already exists.'
      });
    }

    const hashedPassword = await bcrypt.hash(trimmedPassword, SALT_ROUNDS);

    await User.create({
      name: trimmedName,
      displayName: trimmedName,
      username: rawUsername,
      password: hashedPassword,
      authProviders: ['local']
    });

    return res.status(201).json({
      success: true,
      message: 'Signup successful.'
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Username already exists.'
      });
    }

    console.error('Signup failed:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to sign up right now. Please try again.'
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const rawUsername = typeof username === 'string' ? username.trim() : '';
  const trimmedPassword = password?.trim();

  if (!rawUsername || !trimmedPassword) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required.'
    });
  }

  try {
    const user = await User.findOne({ username: rawUsername });

    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.'
      });
    }

    const isPasswordCorrect = await bcrypt.compare(trimmedPassword, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      user: {
        uid: user.uid || '',
        name: user.name,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        bio: user.bio || '',
        photoURL: user.photoURL || ''
      }
    });
  } catch (error) {
    console.error('Login failed:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to log in right now. Please try again.'
    });
  }
});

app.post('/api/auth/google', async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({
      success: false,
      message: 'Google token is required.'
    });
  }

  try {
    const decodedToken = await verifyGoogleIdToken(idToken);
    const googleUid = decodedToken.uid;
    const email = typeof decodedToken.email === 'string' ? decodedToken.email.toLowerCase() : '';
    const inferredName = decodedToken.name || '';
    const photoURL = decodedToken.picture || '';

    let user = await User.findOne({ $or: [{ uid: googleUid }, { googleUid }, ...(email ? [{ email }] : [])] });
    let isNewUser = false;

    if (!user) {
      user = await User.create({
        uid: googleUid,
        googleUid,
        email,
        name: inferredName,
        displayName: inferredName,
        photoURL,
        bio: '',
        authProviders: ['google']
      });
      isNewUser = true;
    } else {
      user.uid = user.uid || googleUid;
      user.googleUid = user.googleUid || googleUid;
      user.email = user.email || email;
      user.name = user.name || inferredName;
      user.displayName = user.displayName || inferredName;
      user.photoURL = user.photoURL || photoURL;
      user.bio = typeof user.bio === 'string' ? user.bio : '';
      user.authProviders = upsertAuthProvider(user.authProviders, 'google');
      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Google login successful.',
      isNewUser,
      requiresPassword: !user.password,
      requiresProfileSetup: !user.username || !user.displayName,
      user: {
        uid: user.uid || user.googleUid,
        email: user.email,
        username: user.username,
        name: user.name,
        displayName: user.displayName,
        photoURL: user.photoURL || '',
        bio: user.bio || ''
      }
    });
  } catch (error) {
    console.error('Google auth failed:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Unable to verify Google sign-in.'
    });
  }
});

app.post('/api/auth/google/set-password', async (req, res) => {
  const { idToken, password } = req.body;
  const trimmedPassword = typeof password === 'string' ? password.trim() : '';

  if (!idToken || !trimmedPassword) {
    return res.status(400).json({
      success: false,
      message: 'Google token and password are required.'
    });
  }

  if (trimmedPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters.'
    });
  }

  try {
    const decodedToken = await verifyGoogleIdToken(idToken);
    const user = await User.findOne({ googleUid: decodedToken.uid });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found for this Google account.'
      });
    }

    user.password = await bcrypt.hash(trimmedPassword, SALT_ROUNDS);
    user.authProviders = upsertAuthProvider(user.authProviders, 'local');
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password saved successfully.'
    });
  } catch (error) {
    console.error('Set password failed:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Unable to save password.'
    });
  }
});

app.post('/api/auth/google/profile', async (req, res) => {
  const { idToken, username, displayName } = req.body;
  const rawUsername = typeof username === 'string' ? username.trim() : '';
  const rawDisplayName = typeof displayName === 'string' ? displayName.trim() : '';

  if (!idToken || !rawUsername || !rawDisplayName) {
    return res.status(400).json({
      success: false,
      message: 'Google token, username, and display name are required.'
    });
  }

  try {
    const decodedToken = await verifyGoogleIdToken(idToken);
    const user = await User.findOne({ googleUid: decodedToken.uid });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found for this Google account.'
      });
    }

    const existingUsername = await User.findOne({ username: rawUsername }).lean();
    if (existingUsername && existingUsername._id.toString() !== user._id.toString()) {
      return res.status(409).json({
        success: false,
        message: 'Username already exists.'
      });
    }

    user.username = rawUsername;
    user.displayName = rawDisplayName;
    user.name = user.name || rawDisplayName;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile setup completed.',
      user: {
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        uid: user.uid || user.googleUid,
        photoURL: user.photoURL || '',
        bio: user.bio || ''
      }
    });
  } catch (error) {
    console.error('Profile setup failed:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Unable to save profile details.'
    });
  }
});

app.patch('/api/users/:uid', async (req, res) => {
  const uid = typeof req.params.uid === 'string' ? req.params.uid.trim() : '';
  const bio = typeof req.body?.bio === 'string' ? req.body.bio.trim() : '';

  if (!uid) {
    return res.status(400).json({
      success: false,
      message: 'User uid is required.'
    });
  }

  if (bio.length > 140) {
    return res.status(400).json({
      success: false,
      message: 'Bio must be 140 characters or fewer.'
    });
  }

  try {
    const user = await User.findOne({ $or: [{ uid }, { googleUid: uid }] });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    user.bio = bio;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Bio updated successfully.',
      user: {
        uid: user.uid || user.googleUid,
        bio: user.bio || ''
      }
    });
  } catch (error) {
    console.error('Failed to update user bio:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to update bio right now.'
    });
  }
});

function generateDefaultUsername() {
  return `user_${Math.floor(1000 + Math.random() * 9000)}`;
}

async function createUniqueDefaultUsername() {
  let username = generateDefaultUsername();
  let existing = await User.findOne({ username }).lean();

  while (existing) {
    username = generateDefaultUsername();
    existing = await User.findOne({ username }).lean();
  }

  return username;
}

app.post('/api/users/sync', async (req, res) => {
  const uid = typeof req.body?.uid === 'string' ? req.body.uid.trim() : '';
  const googleUid = typeof req.body?.googleUid === 'string' ? req.body.googleUid.trim() : uid;
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : name;
  const photoURL = typeof req.body?.photoURL === 'string' ? req.body.photoURL.trim() : '';
  const customPhotoURL = typeof req.body?.customPhotoURL === 'string' ? req.body.customPhotoURL.trim() : '';
  const bio = typeof req.body?.bio === 'string' ? req.body.bio.trim() : '';

  if (!uid && !googleUid && !email) {
    return res.status(400).json({
      success: false,
      message: 'At least one identifier (uid, googleUid, or email) is required.'
    });
  }

  if (bio.length > 140) {
    return res.status(400).json({
      success: false,
      message: 'Bio must be 140 characters or fewer.'
    });
  }

  try {
    const query = { $or: [] };
    if (uid) query.$or.push({ uid });
    if (googleUid) query.$or.push({ googleUid });
    if (email) query.$or.push({ email });

    let user = await User.findOne(query);
    let isNewUser = false;

    if (!user) {
      const username = await createUniqueDefaultUsername();
      user = await User.create({
        uid: uid || googleUid || '',
        googleUid: googleUid || uid || '',
        email,
        name,
        displayName,
        username,
        photoURL,
        googlePhotoURL: photoURL,
        customPhotoURL,
        bio,
        authProviders: ['google']
      });
      isNewUser = true;
    } else {
      user.uid = user.uid || uid || googleUid;
      user.googleUid = user.googleUid || googleUid || uid;
      user.email = user.email || email;
      user.name = user.name || name;
      user.displayName = user.displayName || displayName || name;
      user.photoURL = customPhotoURL || user.photoURL || photoURL;
      user.googlePhotoURL = photoURL || user.googlePhotoURL || '';
      user.customPhotoURL = customPhotoURL || user.customPhotoURL || '';
      user.bio = bio || user.bio || '';
      user.authProviders = upsertAuthProvider(user.authProviders, 'google');

      if (!user.username) {
        user.username = await createUniqueDefaultUsername();
      }

      await user.save();
    }

    return res.status(200).json({
      success: true,
      isNewUser,
      user: {
        id: user._id,
        uid: user.uid || user.googleUid || '',
        username: user.username,
        name: user.name,
        displayName: user.displayName,
        email: user.email || '',
        bio: user.bio || '',
        googlePhotoURL: user.googlePhotoURL || '',
        customPhotoURL: user.customPhotoURL || ''
      }
    });
  } catch (error) {
    console.error('Failed to sync user profile:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to sync user profile right now.'
    });
  }
});

app.get('/api/contacts', async (req, res) => {
  const username = typeof req.query.username === 'string' ? req.query.username.trim() : '';

  if (!username) {
    return res.status(400).json({
      success: false,
      message: 'Username is required.'
    });
  }

  try {
    const user = await User.findOne({ username }).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const contactsUsernames = (user.contacts || []).filter((contact) => contact && contact !== username);
    const contacts = await User.find({ username: { $in: contactsUsernames } })
      .select('username displayName name')
      .lean();

    const mappedContacts = contacts
      .map((contact) => ({
        username: contact.username,
        displayName: contact.displayName || contact.name || contact.username
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));

    return res.status(200).json({
      success: true,
      contacts: mappedContacts
    });
  } catch (error) {
    console.error('Failed to fetch contacts:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to fetch contacts right now.'
    });
  }
});

app.post('/api/contacts/add', async (req, res) => {
  const requesterUsername = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const targetUsername = typeof req.body.contactUsername === 'string' ? req.body.contactUsername.trim() : '';

  if (!requesterUsername || !targetUsername) {
    return res.status(400).json({
      success: false,
      message: 'Username and contact username are required.'
    });
  }

  if (requesterUsername === targetUsername) {
    return res.status(400).json({
      success: false,
      message: 'You cannot add yourself as a contact.'
    });
  }

  try {
    const [requester, targetUser] = await Promise.all([
      User.findOne({ username: requesterUsername }),
      User.findOne({ username: targetUsername })
    ]);

    if (!requester) {
      return res.status(404).json({
        success: false,
        message: 'Current user not found.'
      });
    }

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Username not found.'
      });
    }

    if (!requester.contacts.includes(targetUsername)) {
      requester.contacts.push(targetUsername);
      await requester.save();
    }

    return res.status(200).json({
      success: true,
      contact: {
        username: targetUser.username,
        displayName: targetUser.displayName || targetUser.name || targetUser.username
      }
    });
  } catch (error) {
    console.error('Failed to add contact:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to add contact right now.'
    });
  }
});

app.post('/api/messages', async (req, res) => {
  const senderId = typeof req.body?.senderId === 'string' ? req.body.senderId.trim() : '';
  const receiverId = typeof req.body?.receiverId === 'string' ? req.body.receiverId.trim() : '';
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';

  if (!senderId || !receiverId || !text) {
    return res.status(400).json({
      success: false,
      message: 'senderId, receiverId, and text are required.'
    });
  }

  try {
    if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({
        success: false,
        message: 'senderId and receiverId must be valid user ObjectIds.'
      });
    }

    const savedMessage = await Message.create({
      sender: senderId,
      receiver: receiverId,
      text,
      status: 'sent'
    });

    return res.status(201).json({
      success: true,
      message: formatMessage(savedMessage)
    });
  } catch (error) {
    console.error('Failed to save message:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to save message right now.'
    });
  }
});

app.post('/api/messages/history', async (req, res) => {
  const senderId = typeof req.body?.senderId === 'string' ? req.body.senderId.trim() : '';
  const receiverId = typeof req.body?.receiverId === 'string' ? req.body.receiverId.trim() : '';

  if (!senderId || !receiverId) {
    return res.status(400).json({
      success: false,
      message: 'senderId and receiverId are required.'
    });
  }

  if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
    return res.status(400).json({
      success: false,
      message: 'senderId and receiverId must be valid user ObjectIds.'
    });
  }

  try {
    const messages = await Message.find({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId }
      ]
    })
      .sort({ timestamp: -1 })
      .limit(50)
      .sort({ timestamp: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      messages: messages.map((message) => formatMessage(message))
    });
  } catch (error) {
    console.error('Failed to fetch message history:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to fetch message history right now.'
    });
  }
});

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
    const username = typeof data?.username === 'string' ? data.username : '';

    if (!username) {
      return;
    }

    users.set(socket.id, { username, activeContact: '' });
  });

  socket.on('send-message', (data) => {
    const user = users.get(socket.id);
    const receiverId = typeof data?.receiverId === 'string' ? data.receiverId.trim() : '';
    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    const timestamp = data?.timestamp || new Date();
    const status = data?.status === 'delivered' ? 'delivered' : 'sent';

    if (!user || !receiverId || !text) {
      return;
    }

    const payload = formatMessage({
      senderId: user.username,
      receiverId,
      text,
      timestamp,
      status
    });

    users.forEach((socketUser, socketId) => {
      const isParticipant = socketUser.username === user.username || socketUser.username === receiverId;
      if (!isParticipant) return;

      const isActiveConversation =
        socketUser.activeContact === user.username || socketUser.activeContact === receiverId;

      if (isActiveConversation) {
        io.to(socketId).emit('receive-message', payload);
      }
    });
  });

  socket.on('open conversation', async (data) => {
    const user = users.get(socket.id);
    const contactUsername = typeof data?.contactUsername === 'string' ? data.contactUsername.trim() : '';

    if (!user || !contactUsername) {
      return;
    }

    users.set(socket.id, { ...user, activeContact: contactUsername });

    try {
      const history = await Message.find({
        $or: [
          { senderId: user.username, receiverId: contactUsername },
          { senderId: contactUsername, receiverId: user.username }
        ]
      })
        .sort({ timestamp: 1 })
        .lean();

      socket.emit(
        'conversation history',
        history.map((message) => formatMessage(message))
      );
    } catch (error) {
      console.error('Failed to load conversation history:', error.message);
      socket.emit('conversation history', []);
    }
  });

  socket.on('typing', (data) => {
    const user = users.get(socket.id);
    const toUsername = typeof data?.toUsername === 'string' ? data.toUsername.trim() : '';

    if (user && toUsername) {
      users.forEach((socketUser, socketId) => {
        if (socketUser.username === toUsername && socketUser.activeContact === user.username) {
          io.to(socketId).emit('user typing', {
            username: user.username,
            isTyping: Boolean(data.isTyping)
          });
        }
      });
    }
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);

    if (user) {
      users.delete(socket.id);
    }

    console.log('User disconnected:', socket.id);
  });
});

async function startServer() {
  try {
    initializeFirebaseAdmin();

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
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
