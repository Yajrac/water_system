import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TextInput, View, StyleSheet } from 'react-native';
import { Button, Card, Detail, Screen, text } from '@/components/consumer/ui';
import { colors } from '@/theme/tokens';
import { useSession } from '../session/SessionProvider';
import { consumerRequest } from '../session/api';
type Feedback = {id:string;category:string;status:string;message:string;date:string};
export default function FeedbackScreen() {
  const {accessToken}=useSession();
  const [items,setItems]=useState<Feedback[]>([]);
  const [message,setMessage]=useState('');
  const [category,setCategory]=useState('Other');
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(false);
  const [notice,setNotice]=useState('');
  const sending=useRef(false);
  const load=useCallback(async()=>{
    if(!accessToken)return;
    setLoading(true);
    try{setItems(await consumerRequest<Feedback[]>('/consumer/feedback',undefined,accessToken,'GET'));}
    catch(failure){setNotice(failure instanceof Error?failure.message:'Could not load feedback.');}
    finally{setLoading(false);}
  },[accessToken]);
  useEffect(()=>{void load();},[load]);
  async function send(){
    if(sending.current||!accessToken||!message.trim())return;
    sending.current=true;setBusy(true);setNotice('');
    try{
      await consumerRequest('/consumer/feedback',{category,message:message.trim()},accessToken);
      setMessage('');setNotice('Feedback sent successfully.');await load();
    }catch(failure){setNotice(failure instanceof Error?failure.message:'Could not send feedback.');}
    finally{sending.current=false;setBusy(false);}
  }
  return <Screen title="Feedback">
    <Text style={text.body}>Send your concern to the PWSS office. Feedback is for submission only; replies are not available here.</Text>
    <Card>
      <Text style={text.heading}>Category</Text>
      <View style={styles.categories}>{['Billing','Water supply','Meter','Other'].map(value=>
        <Button key={value} label={value} secondary={category!==value} disabled={busy} onPress={()=>setCategory(value)}/>)}</View>
      <Text style={text.heading}>Your feedback</Text>
      <TextInput accessibilityLabel="Feedback message" multiline maxLength={1500} editable={!busy}
        placeholder="Describe your concern" placeholderTextColor={colors.muted}
        value={message} onChangeText={setMessage} style={styles.input}/>
      <Text style={text.muted}>{message.length}/1500</Text>
      <Button label={busy?'Sending...':'Send feedback'} disabled={busy||!message.trim()} onPress={()=>void send()}/>
    </Card>
    {!!notice && <Text accessibilityRole="alert" style={text.muted}>{notice}</Text>}
    <Button label={loading?'Loading...':'Refresh submissions'} secondary disabled={loading||busy} onPress={()=>void load()}/>
    {!loading&&!items.length&&<Text style={text.muted}>No feedback submitted yet.</Text>}
    {items.map(item=><Card key={item.id}>
      <Text style={text.heading}>{item.category}</Text><Text style={text.body}>{item.message}</Text>
      <Text style={text.muted}>{item.date}</Text><Detail label="Status" value={item.status}/>
    </Card>)}
  </Screen>;
}
const styles=StyleSheet.create({
  categories:{gap:8},input:{minHeight:120,borderWidth:1,borderColor:colors.border,borderRadius:8,
    padding:12,color:colors.ink,textAlignVertical:'top'},
});
