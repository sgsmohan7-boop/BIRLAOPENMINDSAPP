import { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { SCOPES, connectGoogleDrive, getDriveAccessToken, disconnectGoogleDrive } from '../utils/googleDrive';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  signInWithGoogleDrive: () => Promise<string | null>;
  driveAccessToken: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      const token = await getDriveAccessToken();
      setDriveAccessToken(token);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    SCOPES.forEach(scope => provider.addScope(scope));
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setDriveAccessToken(credential.accessToken);
    }
  };

  const signInWithGoogleDrive = async (): Promise<string | null> => {
    try {
      const res = await connectGoogleDrive();
      setDriveAccessToken(res.accessToken);
      return res.accessToken;
    } catch (err) {
      // console.error('Failed to sign in with Google Drive:', err);
      throw err;
    }
  };

  const logOut = async () => {
    disconnectGoogleDrive();
    setDriveAccessToken(null);
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logOut, signInWithGoogleDrive, driveAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

