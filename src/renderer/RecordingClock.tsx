import { useEffect, useState } from 'react';
export function RecordingClock({startedAt, compact=false}:{startedAt?:number;compact?:boolean}) {
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),250);return()=>clearInterval(timer);},[startedAt]);
  const seconds=Math.min(300,Math.max(0,Math.floor((now-(startedAt??now))/1000)));
  const warning=seconds>=270;
  const time=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  return <span className={`recording-clock ${compact?'compact':''} ${warning?'warning':''}`}>
    <span aria-label={`Recorded ${time}`}>{time}{!compact&&' / 5:00'}</span>
    {warning&&<span role="status">{compact?`${300-seconds}s left`:`${300-seconds} seconds left — your recording finishes automatically at 5:00.`}</span>}
  </span>;
}
