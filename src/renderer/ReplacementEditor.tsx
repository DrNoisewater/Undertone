import { useEffect, useState } from 'react';
import { validateReplacements } from '../shared/text-tools';
import type { WordReplacement } from '../shared/text-tools';
export function ReplacementEditor({value,onSave}:{value:WordReplacement[];onSave:(rules:WordReplacement[])=>Promise<void>}) {
  const [rows,setRows]=useState(value),[message,setMessage]=useState(''),[saving,setSaving]=useState(false);
  useEffect(()=>{setRows(value);},[value]);
  const edit=(index:number,key:'from'|'to',text:string)=>{setMessage('');setRows(rows.map((r,i)=>i===index?{...r,[key]:text}:r));};
  const save=async()=>{setSaving(true);setMessage('');try{const valid=validateReplacements(rows);await onSave(valid);setMessage('Replacements saved.');}catch(e){setMessage(e instanceof Error?e.message:String(e));}finally{setSaving(false);}};
  return <section className="panel"><h2>Your words, spelled your way</h2><p>Replace a misheard word or phrase with your preferred spelling. Works in every writing mode, including Verbatim.</p><p className="hint">Whole phrases only, ignoring case. Longer matches win; replacements never chain into each other. For example: “noise water labs” → “Noisewater Labs”.</p><fieldset disabled={saving}>
    {rows.map((row,i)=><div className="replacement-row" key={i}><label>When Undertone writes<input maxLength={120} value={row.from} onChange={e=>edit(i,'from',e.target.value)} placeholder="noise water labs"/></label><label>Use this instead<input maxLength={500} value={row.to} onChange={e=>edit(i,'to',e.target.value)} placeholder="Noisewater Labs"/></label><button className="secondary" aria-label={`Remove replacement ${i+1}`} onClick={()=>{setRows(rows.filter((_,j)=>j!==i));setMessage('');}}>Remove</button></div>)}
    <div className="row"><button className="secondary" disabled={rows.length>=100} onClick={()=>{setRows([...rows,{from:'',to:''}]);setMessage('');}}>Add replacement</button><button onClick={()=>void save()}>{saving?'Saving…':'Save replacements'}</button></div>
  </fieldset>{message&&<p role="status">{message}</p>}</section>;
}
