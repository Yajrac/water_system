import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState, Platform } from 'react-native';
import { useSession } from '../session/SessionProvider';
import { consumerRequest } from '../session/api';

export type ConsumerNotice = {
  id: string;
  category: string;
  title: string;
  date: string;
  body: string;
  read: boolean;
};
const Context = createContext<{
  items: ConsumerNotice[];
  unread: number;
  busy: boolean;
  error: string;
  refresh: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
} | null>(null);
export function NotificationProvider({ children }: PropsWithChildren) {
  const { accessToken, mustChangePassword } = useSession();
  const [items, setItems] = useState<ConsumerNotice[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const version = useRef(0);
  const refresh = useCallback(async () => {
    if (!accessToken || mustChangePassword) return;
    const current = ++version.current;
    setBusy(true);
    try {
      const result = await consumerRequest<ConsumerNotice[]>(
        '/notifications/mine',
        undefined,
        accessToken,
        'GET',
      );
      if (current === version.current) {
        setItems(result);
        setError('');
      }
    } catch (failure) {
      if (current === version.current)
        setError(failure instanceof Error ? failure.message : 'Could not load notifications.');
    } finally {
      if (current === version.current) setBusy(false);
    }
  }, [accessToken, mustChangePassword]);
  const invalidate = useCallback(() => {
    version.current++;
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => {
      setItems([]);
      setError('');
      if (!accessToken || mustChangePassword) {
        setBusy(false);
        return;
      }
      void refresh();
    }, 0);
    const timer = setInterval(() => {
      if (AppState.currentState === 'active' || Platform.OS === 'web') void refresh();
    }, 30000);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      invalidate();
      clearTimeout(initial);
      clearInterval(timer);
      listener.remove();
    };
  }, [accessToken, mustChangePassword, refresh, invalidate]);
  const markRead = useCallback(
    async (ids: string[]) => {
      if (!accessToken) return;
      await consumerRequest('/notifications/read', { ids }, accessToken);
      invalidate();
      setBusy(false);
      setItems((current) =>
        current.map((item) => (ids.includes(item.id) ? { ...item, read: true } : item)),
      );
    },
    [accessToken, invalidate],
  );
  return (
    <Context.Provider
      value={{
        items,
        unread: items.filter((item) => !item.read).length,
        busy,
        error,
        refresh,
        markRead,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useNotifications() {
  const value = useContext(Context);
  if (!value) throw Error('Missing notification provider.');
  return value;
}
