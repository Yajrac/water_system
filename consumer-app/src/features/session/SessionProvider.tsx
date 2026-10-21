import { createContext, useContext, useRef, useState, type PropsWithChildren } from 'react';

import { consumerRequest } from './api';

type ConsumerUser = { id: string; username: string; role: string; mustChangePassword: boolean };
type LoginResult = { user: ConsumerUser; accessToken: string };

type Session = {
  signedIn: boolean;
  accessToken: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
  mustChangePassword: boolean;
  changingPassword: boolean;
  openChangePassword: () => void;
  cancelChangePassword: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  notice: string;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  // Tokens remain in memory only; passwords are never persisted.
  const [login, setLogin] = useState<LoginResult | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [notice, setNotice] = useState('');
  const generation = useRef(0);

  async function signIn(username: string, password: string) {
    const attempt = ++generation.current;
    const result = await consumerRequest<LoginResult>('/auth/login', {
      username: username.trim(),
      password,
    });
    if (result.user.role !== 'consumer') throw new Error('Use a consumer account to sign in.');
    if (generation.current === attempt) {
      setNotice('');
      setLogin(result);
    }
  }

  function signOut() {
    generation.current++;
    setLogin(null);
    setChangingPassword(false);
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    if (!login) throw new Error('Please sign in again.');
    const attempt = generation.current;
    await consumerRequest(
      '/auth/change-password',
      { currentPassword, newPassword },
      login.accessToken,
    );
    if (generation.current === attempt) {
      signOut();
      setNotice('Password changed successfully. Sign in with your new password.');
    }
  }

  return (
    <SessionContext.Provider
      value={{
        signedIn: !!login,
        accessToken: login?.accessToken || null,
        signIn,
        signOut,
        notice,
        mustChangePassword: login?.user.mustChangePassword === true,
        changingPassword,
        openChangePassword: () => setChangingPassword(true),
        cancelChangePassword: () => setChangingPassword(false),
        changePassword,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('SessionProvider is missing.');
  return session;
}
