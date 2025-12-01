import { 
  getAuth, 
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  linkWithPopup,
  User,
  Auth
} from 'firebase/auth';
import { app, isFirebaseConfigured } from './firebaseConfig';

// Initialize auth only if Firebase is configured
let auth: Auth | null = null;

if (isFirebaseConfigured() && app) {
  auth = getAuth(app);
}

/**
 * Sign in anonymously - allows users to start using the app immediately
 * without creating an account. Data is still protected by Firebase rules.
 */
export const signInAnonymous = async (): Promise<User | null> => {
  if (!auth) return null;
  
  try {
    const result = await signInAnonymously(auth);
    console.log('✅ Signed in anonymously:', result.user.uid);
    return result.user;
  } catch (error) {
    console.error('❌ Anonymous sign-in failed:', error);
    throw error;
  }
};

/**
 * Sign in with Google - for users who want to sync across devices
 * or have a persistent account.
 */
export const signInWithGoogle = async (): Promise<User | null> => {
  if (!auth) return null;
  
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    console.log('✅ Signed in with Google:', result.user.email);
    return result.user;
  } catch (error) {
    console.error('❌ Google sign-in failed:', error);
    throw error;
  }
};

/**
 * Link anonymous account to Google - allows users to upgrade their
 * anonymous account to a Google account without losing data.
 */
export const linkAnonymousToGoogle = async (): Promise<User | null> => {
  if (!auth?.currentUser) return null;
  
  if (!auth.currentUser.isAnonymous) {
    console.log('User is not anonymous, no need to link');
    return auth.currentUser;
  }
  
  try {
    const provider = new GoogleAuthProvider();
    const result = await linkWithPopup(auth.currentUser, provider);
    console.log('✅ Account linked to Google:', result.user.email);
    return result.user;
  } catch (error: any) {
    // If account already exists, sign in instead
    if (error.code === 'auth/credential-already-in-use') {
      console.log('Account exists, signing in instead');
      return signInWithGoogle();
    }
    console.error('❌ Account linking failed:', error);
    throw error;
  }
};

/**
 * Subscribe to auth state changes
 */
export const onAuthChange = (callback: (user: User | null) => void): (() => void) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  
  return onAuthStateChanged(auth, callback);
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = (): User | null => {
  return auth?.currentUser || null;
};

/**
 * Get current user's UID (for Firestore paths)
 */
export const getCurrentUserId = (): string | null => {
  return auth?.currentUser?.uid || null;
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (): boolean => {
  return !!auth?.currentUser;
};

/**
 * Check if current user is anonymous
 */
export const isAnonymousUser = (): boolean => {
  return auth?.currentUser?.isAnonymous || false;
};

/**
 * Sign out current user
 */
export const signOut = async (): Promise<void> => {
  if (!auth) return;
  
  try {
    await auth.signOut();
    console.log('✅ Signed out successfully');
  } catch (error) {
    console.error('❌ Sign out failed:', error);
    throw error;
  }
};

/**
 * Initialize authentication - call this on app startup
 * Returns a promise that resolves when auth state is determined
 */
export const initializeAuth = (): Promise<User | null> => {
  return new Promise((resolve) => {
    if (!auth) {
      resolve(null);
      return;
    }
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      
      if (user) {
        console.log('✅ User already authenticated:', user.uid);
        resolve(user);
      } else {
        // Auto sign-in anonymously for seamless UX
        signInAnonymous().then(resolve).catch(() => resolve(null));
      }
    });
  });
};

export { auth };
