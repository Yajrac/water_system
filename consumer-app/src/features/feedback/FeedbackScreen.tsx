import { LoadingCards, RefreshControl } from '@/components/consumer/LoadingState';
import { Icon } from '@/components/consumer/Icon';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Text, TextInput, View, StyleSheet, Pressable } from 'react-native';
import { Badge, Button, Card, Screen, Sheet, text } from '@/components/consumer/ui';
import { colors } from '@/theme/tokens';
import { useSession } from '../session/SessionProvider';
import { consumerRequest } from '../session/api';
type Feedback = {id:string;category:string;status:string;message:string;date:string};
export default function FeedbackScreen() {
  const {accessToken}=useSession();
  const [items,setItems]=useState<Feedback[]>([]);
  const [message,setMessage]=useState('');
  const [category,setCategory]=useState('Billing');
  const [otherConcern,setOtherConcern]=useState('');
  const composedMessage=category==='Other' ? 'Concern: '+otherConcern.trim()+'\n\n'+message.trim() : message.trim();
  const canSend=!!message.trim() && (category!=='Other'||!!otherConcern.trim()) && composedMessage.length<=1500;
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(false);
  const [notice,setNotice]=useState('');
  const [historyError,setHistoryError]=useState('');
  const [sent,setSent]=useState(false);
  const [historyOpen,setHistoryOpen]=useState(false);
  const sending=useRef(false);
  const messageInput=useRef<TextInput>(null);
  const load=useCallback(async()=>{
    if(!accessToken)return;
    setLoading(true);
    setHistoryError('');
    try{setItems(await consumerRequest<Feedback[]>('/consumer/feedback',undefined,accessToken,'GET'));}
    catch(failure){setHistoryError(failure instanceof Error?failure.message:'Could not load feedback.');}
    finally{setLoading(false);}
  },[accessToken]);
  useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer);},[load]);
  async function send(){
    if(sending.current||!accessToken||!canSend)return;
    sending.current=true;setBusy(true);setNotice('');
    try{
      await consumerRequest('/consumer/feedback',{category,message:composedMessage},accessToken);
      setMessage('');setOtherConcern('');setCategory('Billing');
      Keyboard.dismiss();setSent(true);void load();
    }catch(failure){setNotice(failure instanceof Error?failure.message:'Could not send feedback.');}
    finally{sending.current=false;setBusy(false);}
  }
  return <Screen title="Feedback" footer={
    <View style={styles.sendArea}>
      {!!notice && <Text accessibilityRole="alert" style={text.muted}>{notice}</Text>}
      <Button label={busy?'Sending...':'Send feedback'} disabled={busy||!canSend} onPress={()=>void send()}/>
    </View>
  } headerAction={
    <Pressable accessibilityRole="button" accessibilityLabel="Feedback history"
      onPress={()=>{setHistoryOpen(true);void load();}} hitSlop={8} style={styles.historyButton}>
      <Icon name="bills" size={22}/>
    </Pressable>
  }>
    <View style={styles.intro}>
      <View style={styles.introIcon}><Icon name="feedback" size={22} color="#ffffff"/></View>
      <View style={{flex:1}}>
        <Text style={styles.introTitle}>How can we help?</Text>
        <Text style={styles.introText}>Send your concern to the PWSS office. We will update you here.</Text>
      </View>
    </View>
    <Card>
      <Text style={styles.label}>Category</Text>
      <View style={styles.categories}>{['Billing','Water supply','Meter','Other'].map(value=>
        <Pressable key={value} accessibilityRole="button" accessibilityState={{selected:category===value,disabled:busy}}
          disabled={busy} onPress={()=>setCategory(value)} style={[styles.category,category===value&&styles.selectedCategory]}>
          <Text style={[styles.categoryText,category===value&&styles.selectedCategoryText]}>{value}</Text>
        </Pressable>)}</View>
      {category==='Other' && <View style={styles.otherField}>
        <Text style={styles.label}>Please specify your concern</Text>
        <TextInput accessibilityLabel="Other concern" value={otherConcern} onChangeText={setOtherConcern}
          maxLength={100} editable={!busy} placeholder="For example, account details" placeholderTextColor={colors.muted}
          style={styles.subjectInput} returnKeyType="next" onSubmitEditing={()=>messageInput.current?.focus()}/>
      </View>}
      <Text style={styles.label}>Your feedback</Text>
      <TextInput ref={messageInput} accessibilityLabel="Feedback message" multiline maxLength={category==='Other'?1500-('Concern: '+otherConcern.trim()+'\n\n').length:1500} editable={!busy}
        placeholder="Describe your concern" placeholderTextColor={colors.muted}
        value={message} onChangeText={setMessage} style={styles.input}/>
      <Text style={[text.muted,{textAlign:'right'}]}>{composedMessage.length}/1500 characters</Text>
    </Card>
    <Sheet title="Feedback sent" visible={sent} onClose={()=>setSent(false)}>
      <View style={styles.successIcon} accessible accessibilityLabel="Success">
        <Text style={styles.successCheck}>{'\u2713'}</Text>
      </View>
      <Text accessibilityRole="alert" style={text.heading}>Feedback sent successfully</Text>
      <Text style={text.body}>The PWSS office has received your feedback.</Text>
      <Button label="View feedback history" onPress={()=>{setSent(false);setHistoryOpen(true);void load();}} />
      <Button label="Done" secondary onPress={()=>setSent(false)} />
    </Sheet>
    <Sheet title="Feedback history" visible={historyOpen} onClose={()=>setHistoryOpen(false)}>
    <RefreshControl busy={loading||busy} onRefresh={()=>void load()} />
    {!!historyError&&<Text accessibilityRole="alert" style={text.muted}>{historyError}</Text>}
    {loading&&!items.length&&<LoadingCards count={2}/>}
    {!loading&&!historyError&&!items.length&&<Text style={text.muted}>No feedback submitted yet.</Text>}
    {items.map(item=><View key={item.id} style={styles.historyItem}>
      <View style={styles.historyTop}>
        <Text style={styles.historyCategory}>{item.category}</Text>
        <Badge label={item.status==='New'?'Submitted':item.status} paid={/resolved|closed/i.test(item.status)}/>
      </View>
      <Text style={text.body}>{item.message}</Text>
      <Text style={text.muted}>{item.date}</Text>
    </View>)}
    </Sheet>
  </Screen>;
}
const styles=StyleSheet.create({
  intro:{flexDirection:'row',alignItems:'center',gap:14,padding:18,borderRadius:22,backgroundColor:'#0a6789',
    experimental_backgroundImage:'linear-gradient(150deg, #0a3f5a 0%, #0b6f93 55%, #18a3c4 100%)'},
  introIcon:{width:44,height:44,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,0.16)'},
  introTitle:{fontSize:17,fontWeight:'800',color:'#ffffff'},
  introText:{fontSize:12,lineHeight:18,color:'rgba(225,244,250,0.9)',marginTop:2},
  label:{fontSize:13,fontWeight:'700',color:colors.ink},
  successIcon:{alignSelf:'center',width:64,height:64,borderRadius:32,backgroundColor:colors.successTint,alignItems:'center',justifyContent:'center'},
  successCheck:{fontSize:34,fontWeight:'800',color:colors.success},
  historyButton:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:colors.surface,
    boxShadow:'0 8px 24px rgba(16, 58, 82, 0.08)'},
  sendArea:{gap:10},
  categories:{flexDirection:'row',flexWrap:'wrap',gap:8},
  category:{minHeight:42,paddingHorizontal:16,paddingVertical:9,borderWidth:1,borderColor:'#dbe7ee',borderRadius:21,
    justifyContent:'center',backgroundColor:colors.background},
  selectedCategory:{backgroundColor:colors.primary,borderColor:colors.primary},
  categoryText:{fontSize:13,fontWeight:'700',color:colors.ink},
  selectedCategoryText:{color:'#ffffff'},
  otherField:{gap:10},
  subjectInput:{minHeight:50,borderWidth:1,borderColor:'#dbe7ee',borderRadius:14,paddingHorizontal:14,paddingVertical:12,
    color:colors.ink,backgroundColor:colors.background,fontSize:15},
  input:{minHeight:140,borderWidth:1,borderColor:'#dbe7ee',borderRadius:14,padding:14,color:colors.ink,
    backgroundColor:colors.background,textAlignVertical:'top',fontSize:15,lineHeight:22},
  historyItem:{gap:8,padding:14,borderRadius:16,backgroundColor:colors.background},
  historyTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},
  historyCategory:{fontSize:14,fontWeight:'800',color:colors.ink},
});
