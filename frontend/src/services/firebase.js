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

// Authentication functions
const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // This gives you access to the Google Access Token which we'll use for Calendar
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential.accessToken;
    const user = result.user;
    
    // Store the user's Google access token in localStorage for use with Calendar API
    localStorage.setItem('googleAccessToken', token);
    
    return { user, token };
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

const logOut = async () => {
  try {
    await signOut(auth);
    localStorage.removeItem('googleAccessToken');
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
  googleProvider 
};
