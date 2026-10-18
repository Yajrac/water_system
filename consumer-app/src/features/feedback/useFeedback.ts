import { useState } from 'react';

export type Message = { id: string; author: 'consumer' | 'admin'; body: string; time: string };
const initial: Message[] = [
  {
    id: '1',
    author: 'consumer',
    body: 'Good morning. May I ask about the scheduled interruption in Barangay 1?',
    time: 'Oct 19, 8:15 AM',
  },
  {
    id: '2',
    author: 'admin',
    body: 'Good morning, Ana. Maintenance is scheduled tomorrow from 9 AM to 12 PM. Please store enough water. Thank you!',
    time: 'Oct 19, 8:30 AM',
  },
];
export function useFeedback() {
  const [messages, setMessages] = useState(initial);
  function send(body: string) {
    const value = body.trim();
    if (!value || value.length > 1000) return false;
    setMessages((current) => [
      ...current,
      {
        id: Date.now().toString(),
        author: 'consumer',
        body: value,
        time: new Intl.DateTimeFormat('en-PH', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'Asia/Manila',
        }).format(new Date()),
      },
    ]);
    return true;
  }
  return { messages, send };
}
