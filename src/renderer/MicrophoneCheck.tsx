import { useEffect, useRef, useState } from 'react';
import { AudioRecorder } from './audio-recorder';

export function MicrophoneCheck({deviceId, disabled, onVerified}: {deviceId:string; disabled:boolean; onVerified:()=>void}) {
  const [running,setRunning]=useState(false), [level,setLevel]=useState(0), [message,setMessage]=useState('Say a few words to check that we can hear you.'), [sample,setSample]=useState('');
  const recorder=useRef(new AudioRecorder()), generation=useRef(0), peak=useRef(0), timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined), url=useRef('');
  useEffect(()=>()=>{generation.current++;clearTimeout(timer.current);recorder.current.cancel();URL.revokeObjectURL(url.current);},[]);
  useEffect(()=>{generation.current++;clearTimeout(timer.current);recorder.current.cancel();setRunning(false);setLevel(0);setMessage('Say a few words to check that we can hear you.');URL.revokeObjectURL(url.current);url.current='';setSample('');},[deviceId]);
  useEffect(()=>{if(disabled){generation.current++;clearTimeout(timer.current);recorder.current.cancel();setRunning(false);setLevel(0);}},[disabled]);
  const check=async()=>{
    const current=++generation.current;
    setRunning(true);setSample('');URL.revokeObjectURL(url.current);url.current='';peak.current=0;setMessage('Opening microphone — please wait…');
    recorder.current.deviceId=deviceId;
    recorder.current.onLevel=n=>{if(generation.current===current){peak.current=Math.max(peak.current,n);setLevel(n);}};
    try {
      await recorder.current.start();
      if(generation.current!==current)return;
      setMessage('Speak now — checking for 4 seconds…');
      timer.current=setTimeout(()=>void finish(current),4000);
    } catch(e) {if(generation.current===current){recorder.current.cancel();setRunning(false);setMessage('We could not use this microphone. Check its connection and microphone permissions, then try again.');}}
  };
  const finish=async(current:number)=>{
    try {
      const wav=await recorder.current.stop();
      if(generation.current!==current)return;
      const bytes=Uint8Array.from(atob(wav),c=>c.charCodeAt(0));
      url.current=URL.createObjectURL(new Blob([bytes],{type:'audio/wav'}));setSample(url.current);
      if(peak.current<0.025)setMessage('That was very quiet. Move closer or choose another microphone, then try again.');
      else {setMessage('We can hear you. Play the sample below to check the sound.');onVerified();}
    } catch {if(generation.current===current)setMessage('The microphone stopped responding. Reconnect it and try again.');}
    finally {if(generation.current===current){setRunning(false);setLevel(0);}}
  };
  return <div className="mic-check"><div className="mic-meter" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level*100)}><span style={{width:`${Math.max(2,level*100)}%`}}/></div><p role="status">{message}</p><button type="button" className="secondary" disabled={disabled||running} onClick={()=>void check()}>{running?'Checking…':'Test microphone'}</button>{sample&&<audio aria-label="Your microphone test" src={sample} controls/>}</div>;
}
