import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc 
} from 'firebase/firestore';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private isFirebaseInitialized = false;
  private currentFirebaseConfig: FirebaseConfig | null = null;
  private auth: any = null;
  private db: any = null;
  
  // Active User State
  public currentUserEmail: string | null = null;
  public currentUserId: string | null = null;

  // Ponytail: Fallback mock authentication if Firebase credentials are default/empty.
  // Upgrade Path: Set up an actual Firebase web app in console.firebase.google.com and input config.
  private isMockMode = true;

  constructor() {
    this.initFirebase();
  }

  async loadFirebaseConfig(): Promise<FirebaseConfig | null> {
    const { value } = await Preferences.get({ key: 'firebase_config' });
    if (value) {
      try {
        return JSON.parse(value);
      } catch (e) {
        console.error('Failed to parse firebase config', e);
      }
    }
    return null;
  }

  async saveFirebaseConfig(config: FirebaseConfig): Promise<void> {
    await Preferences.set({ key: 'firebase_config', value: JSON.stringify(config) });
    localStorage.setItem('firebase_config', JSON.stringify(config));
    this.isFirebaseInitialized = false;
    await this.initFirebase();
  }

  async initFirebase(): Promise<void> {
    try {
      const savedConfig = await this.loadFirebaseConfig();
      
      if (savedConfig && savedConfig.apiKey && !savedConfig.apiKey.includes('MockConfig')) {
        this.currentFirebaseConfig = savedConfig;
        this.isMockMode = false;
        
        // Initialize or retrieve initialized app
        let app;
        if (getApps().length === 0) {
          app = initializeApp(savedConfig);
        } else {
          app = getApp();
        }
        
        this.auth = getAuth(app);
        this.db = getFirestore(app);
        this.isFirebaseInitialized = true;
        
        onAuthStateChanged(this.auth, (user) => {
          if (user) {
            this.currentUserEmail = user.email;
            this.currentUserId = user.uid;
          } else {
            this.currentUserEmail = null;
            this.currentUserId = null;
          }
        });
        
        console.log('Firebase initialized successfully in REAL cloud mode.');
      } else {
        // Fall back to Mock mode for instant running/testing
        this.isMockMode = true;
        this.isFirebaseInitialized = true;
        
        const { value: loggedInUser } = await Preferences.get({ key: 'mock_current_user' });
        if (loggedInUser) {
          this.currentUserEmail = loggedInUser;
          this.currentUserId = `mock_uid_${loggedInUser.replace(/[^a-zA-Z0-9]/g, '')}`;
        }
        
        console.log('Firebase initialized in MOCK offline database mode.');
      }
    } catch (error) {
      console.error('Failed to initialize Firebase, falling back to mock mode:', error);
      this.isMockMode = true;
      this.isFirebaseInitialized = true;
    }
  }

  async login(email: string, password: string): Promise<any> {
    if (this.isMockMode) {
      // Handle mock login
      const { value: usersStr } = await Preferences.get({ key: 'mock_auth_users' });
      const users = usersStr ? JSON.parse(usersStr) : {};
      
      if (users[email] && users[email] === password) {
        this.currentUserEmail = email;
        this.currentUserId = `mock_uid_${email.replace(/[^a-zA-Z0-9]/g, '')}`;
        await Preferences.set({ key: 'mock_current_user', value: email });
        return { email, uid: this.currentUserId };
      } else {
        throw new Error('Invalid email or password (Mock Mode).');
      }
    } else {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      this.currentUserEmail = userCredential.user.email;
      this.currentUserId = userCredential.user.uid;
      return userCredential.user;
    }
  }

  async signup(email: string, password: string): Promise<any> {
    if (this.isMockMode) {
      // Handle mock signup
      const { value: usersStr } = await Preferences.get({ key: 'mock_auth_users' });
      const users = usersStr ? JSON.parse(usersStr) : {};
      
      if (users[email]) {
        throw new Error('User already exists (Mock Mode).');
      }
      
      users[email] = password;
      await Preferences.set({ key: 'mock_auth_users', value: JSON.stringify(users) });
      
      this.currentUserEmail = email;
      this.currentUserId = `mock_uid_${email.replace(/[^a-zA-Z0-9]/g, '')}`;
      await Preferences.set({ key: 'mock_current_user', value: email });
      return { email, uid: this.currentUserId };
    } else {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      this.currentUserEmail = userCredential.user.email;
      this.currentUserId = userCredential.user.uid;
      return userCredential.user;
    }
  }

  async logout(): Promise<void> {
    if (this.isMockMode) {
      this.currentUserEmail = null;
      this.currentUserId = null;
      await Preferences.remove({ key: 'mock_current_user' });
    } else {
      await signOut(this.auth);
      this.currentUserEmail = null;
      this.currentUserId = null;
    }
  }

  async saveUserData(data: any): Promise<void> {
    if (!this.currentUserId) return;

    if (this.isMockMode) {
      await Preferences.set({ 
        key: `mock_userdata_${this.currentUserId}`, 
        value: JSON.stringify(data) 
      });
    } else {
      const docRef = doc(this.db, 'users', this.currentUserId);
      await setDoc(docRef, data, { merge: true });
    }
  }

  async loadUserData(): Promise<any | null> {
    if (!this.currentUserId) return null;

    if (this.isMockMode) {
      const { value } = await Preferences.get({ key: `mock_userdata_${this.currentUserId}` });
      return value ? JSON.parse(value) : null;
    } else {
      const docRef = doc(this.db, 'users', this.currentUserId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }
      return null;
    }
  }

  isConfigured(): boolean {
    return !this.isMockMode;
  }
}
