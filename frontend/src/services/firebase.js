import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs } from 'firebase/firestore';

// Firebase configuration - replace with your actual Firebase project settings
const firebaseConfig = {
  apiKey: "AIzaSyBo19DxOfdghHAw317XIfSw-hVS381v4Ns",
  authDomain: "filenest12390.firebaseapp.com",
  projectId: "filenest12390",
  storageBucket: "filenest12390.firebasestorage.app",
  messagingSenderId: "18884551507",
  appId: "1:18884551507:web:af234ad217c106f025f7a6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Add calendar-related scopes for Google Auth
googleProvider.addScope('https://www.googleapis.com/auth/calendar');
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');
// Add Gmail API scopes
googleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');
googleProvider.addScope('https://www.googleapis.com/auth/gmail.labels');
// Force selection of account on each login to avoid scope issues
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Authentication functions
const signInWithGoogle = async () => {
  try {
    // Force the consent prompt to ensure we get fresh tokens with all scopes
    googleProvider.setCustomParameters({
      prompt: 'consent',
      access_type: 'offline' // Request a refresh token too
    });
    
    const result = await signInWithPopup(auth, googleProvider);
    // This gives you access to the Google Access Token which we'll use for Calendar and Gmail
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential.accessToken;
    const user = result.user;
    
    // Store the user's Google access token in localStorage
    localStorage.setItem('googleAccessToken', token);
    
    // Store complete token data including refresh token if available
    const tokenData = {
      access_token: token,
      id_token: credential.idToken,
      refresh_token: credential.refreshToken,
      expires_at: Date.now() + 3600 * 1000, // Approximate expiration (1 hour)
      scopes: googleProvider.scopes
    };
    localStorage.setItem('googleTokenData', JSON.stringify(tokenData));
    
    // Immediately after login, set Gmail tokens on the server
    try {
      const response = await fetch('/api/gmail/set-gmail-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.accessToken}`
        },
        body: JSON.stringify({
          googleToken: tokenData,
          userInfo: {
            sub: user.uid,
            email: user.email
          }
        })
      });
      console.log('Gmail token setup result:', await response.json());
    } catch (gmailError) {
      console.error('Failed to set Gmail tokens:', gmailError);
      // Continue - we don't want to fail login if Gmail token setup fails
    }
    
    return { user, token };
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

// Get the Google token for API use
const getGoogleToken = () => {
  try {
    const tokenData = localStorage.getItem('googleTokenData');
    if (tokenData) {
      return JSON.parse(tokenData);
    }
    return null;
  } catch (error) {
    console.error("Error getting Google token:", error);
    return null;
  }
};

const logOut = async () => {
  try {
    await signOut(auth);
    localStorage.removeItem('googleAccessToken');
    localStorage.removeItem('googleTokenData');
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

// Firestore functions for command history
const saveCommandToFirestore = async (commandData) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    
    const commandsRef = collection(db, 'users', user.uid, 'commands');
    const docRef = await addDoc(commandsRef, {
      ...commandData,
      userId: user.uid,
      timestamp: new Date()
    });
    
    return docRef.id;
  } catch (error) {
    console.error("Error saving command:", error);
    throw error;
  }
};

const getCommandHistory = async (maxResults = 10) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("User not authenticated");
    
    const commandsRef = collection(db, 'users', user.uid, 'commands');
    const q = query(commandsRef, orderBy('timestamp', 'desc'), limit(maxResults));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error getting command history:", error);
    return [];
  }
};

export { 
  auth, 
  db, 
  signInWithGoogle, 
  logOut, 
  saveCommandToFirestore, 
  getCommandHistory,
  googleProvider,
  getGoogleToken
};
