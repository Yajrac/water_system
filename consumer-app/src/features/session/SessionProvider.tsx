import { createContext, useContext, useRef, useState, useEffect, useCallback, type PropsWithChildren } from 'react';

import { ConsumerApiError, consumerRequest, setSessionResolver } from './api';
import { readSession, saveSession } from './session-storage';
import { AppState } from 'react-native';

type ConsumerUser = { id: string; username: string; role: string; mustChangePassword: boolean };
type LoginResult = { user: ConsumerUser; accessToken: string; refreshToken: string };

type Session = {
  restoring: boolean;
  restoreError: string;
  retryRestore: () => void;
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
  // Only the renewal credential is stored; passwords and access tokens stay in memory.
  const [login, setLogin] = useState<LoginResult | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [notice, setNotice] = useState('');
  const generation = useRef(0);

  const current = useRef<LoginResult | null>(null);
  const refreshedAt = useRef(0);
  const renewal = useRef<Promise<string | null> | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState('');

  const signOut = useCallback(() => {
    const token = current.current?.refreshToken;
    generation.current++;
    current.current = null;
    refreshedAt.current = 0;
    setLogin(null);
    setChangingPassword(false);
    setRestoring(false);
    setRestoreError('');
    void saveSession(null).catch(() => setNotice('Could not clear saved session. Please try logging out again.'));
    if (token) void consumerRequest('/auth/logout', { refreshToken: token }).catch(() => {});
  }, []);

  const renew = useCallback(async (force = false): Promise<string | null> => {
    if (!force && current.current && Date.now() - refreshedAt.current < 10 * 60 * 1000)
      return current.current.accessToken;
    if (renewal.current) return renewal.current;
    const attempt = generation.current;
    const operation = (async () => {
      try {
        const token = current.current?.refreshToken || await readSession();
        if (!token || attempt !== generation.current) return null;
        const result = await consumerRequest<LoginResult>('/auth/refresh', { refreshToken: token });
        if (result.user.role !== 'consumer') throw new ConsumerApiError('Use a consumer account.', 401);
        if (attempt !== generation.current) return null;
        await saveSession(result.refreshToken);
        if (attempt !== generation.current) return null;
        current.current = result;
        refreshedAt.current = Date.now();
        setLogin(result);
        setRestoreError('');
        return result.accessToken;
      } catch (error) {
        if (attempt === generation.current && error instanceof ConsumerApiError && [401,403].includes(error.status)) {
          signOut();
          setNotice('Your session ended. Please sign in again.');
        }
        throw error;
      }
    })();
    renewal.current = operation;
    try { return await operation; }
    finally { if (renewal.current === operation) renewal.current = null; }
  }, [signOut]);

  const restore = useCallback(async () => {
    setRestoring(true);
    setRestoreError('');
    try { await renew(true); }
    catch (error) {
      if (!(error instanceof ConsumerApiError && [401,403].includes(error.status)))
        setRestoreError(error instanceof Error ? error.message : 'Could not restore session.');
    } finally { setRestoring(false); }
  }, [renew]);

  useEffect(() => {
    setSessionResolver(force => renew(force));
    const initial = setTimeout(() => void restore(), 0);
    const timer = setInterval(() => {
      if (current.current && AppState.currentState === 'active') void renew().catch(() => {});
    }, 60000);
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active' && current.current) void renew().catch(() => {});
    });
    return () => { clearTimeout(initial); clearInterval(timer); listener.remove(); setSessionResolver(null); };
  }, [renew, restore]);

  async function signIn(username: string, password: string) {
    const attempt = ++generation.current;
    const result = await consumerRequest<LoginResult>('/auth/login', { username: username.trim(), password });
    if (result.user.role !== 'consumer') throw new Error('Use a consumer account to sign in.');
    if (generation.current === attempt) {
      if (!result.refreshToken) throw new Error('Please update the server before signing in.');
      await saveSession(result.refreshToken);
      if (generation.current !== attempt) return;
      current.current = result;
      refreshedAt.current = Date.now();
      setNotice('');
      setLogin(result);
    }
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    if (!login) throw new Error('Please sign in again.');
    const attempt = generation.current;
    await consumerRequest(
      '/auth/change-password',
      { currentPassword, newPassword },
      (await renew()) || login.accessToken,
    );
    if (generation.current === attempt) {
      signOut();
      setNotice('Password changed successfully. Sign in with your new password.');
    }
  }

  return (
    <SessionContext.Provider
      value={{
        restoring,
        restoreError,
        retryRestore: () => void restore(),
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
