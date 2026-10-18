import { createContext, useContext, useState, type PropsWithChildren } from 'react';

import { demoLogin } from '@/data/sample';

type Session = {
  signedIn: boolean;
  signIn: (username: string, password: string) => boolean;
  signOut: () => void;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [signedIn, setSignedIn] = useState(false);

  function signIn(username: string, password: string) {
    const valid =
      username.trim().toLowerCase() === demoLogin.username && password === demoLogin.password;
    setSignedIn(valid);
    return valid;
  }

  return (
    <SessionContext.Provider value={{ signedIn, signIn, signOut: () => setSignedIn(false) }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('SessionProvider is missing.');
  return session;
}
