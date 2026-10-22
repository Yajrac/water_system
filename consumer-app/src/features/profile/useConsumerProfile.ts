import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from '../session/SessionProvider';
import { consumerRequest } from '../session/api';
export type ConsumerProfile = { id:string; name:string; firstName:string; account:string; submitter:string;
  customerType:string; status:string; address:string; contact:string; meter:string };
export function useConsumerProfile() {
  const { accessToken } = useSession();
  const [profile,setProfile]=useState<ConsumerProfile|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(true);
  const version=useRef(0);
  const reload=useCallback(async()=>{
    const current=++version.current;
    if(!accessToken){setProfile(null);setBusy(false);return;}
    setBusy(true);setError('');
    try{const value=await consumerRequest<ConsumerProfile>('/consumer/profile',undefined,accessToken,'GET');
      if(current===version.current)setProfile(value);
    }catch(failure){if(current===version.current)setError(failure instanceof Error?failure.message:'Could not load profile.');}
    finally{if(current===version.current)setBusy(false);}
  },[accessToken]);
  const invalidate=useCallback(()=>{version.current++;},[]);
  useEffect(()=>{const timer=setTimeout(()=>{setProfile(null);void reload();},0);
    return()=>{clearTimeout(timer);invalidate();};},[reload,invalidate]);
  return {profile,error,busy,reload};
}
