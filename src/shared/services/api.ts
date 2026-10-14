/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

const API_URL = String(import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
// REQ-PLT-016 support view: a tab opened by RefTech support carries its own read-only token in sessionStorage
// (see modules/platform/support.tsx); every other tab uses the normal login.
function sessionToken(){try{return sessionStorage.getItem('reftech_support_token')||localStorage.getItem('reftech_token');}catch{return localStorage.getItem('reftech_token');}}
function inSupportTab(){try{return !!sessionStorage.getItem('reftech_support_token');}catch{return false;}}
export async function api(path:string, options:RequestInit={}){
 if(!API_URL) throw new Error('VITE_API_URL is not configured');
 const token=sessionToken();
 const response=await fetch(`${API_URL}${path}`,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{...{}}),...(options.headers||{})}});
 const text=await response.text(); let body:any={}; try{body=text?JSON.parse(text):{};}catch{body={message:text};}
 if(!response.ok){ if(response.status===401 && token && inSupportTab()){ sessionStorage.removeItem('reftech_support_token'); sessionStorage.removeItem('reftech_support_user'); throw new Error(body.message||'The support view has ended. Close this tab.'); } if(response.status===401 && token){ localStorage.removeItem('reftech_token'); localStorage.removeItem('reftech_user'); if(window.location.pathname!=='/login') window.location.href='/login?reason=session'; throw new Error(body.message||'Session expired. Please sign in again.'); } if(response.status===403 && token?.startsWith('DEV-')){ localStorage.removeItem('reftech_token'); localStorage.removeItem('reftech_user'); throw new Error('Your old session expired after the backend update. Please sign in again.'); } if(response.status===403 && body.code==='PASSWORD_CHANGE_REQUIRED' && window.location.pathname!=='/account/password'){ window.location.href='/account/password?reason=first'; } throw new Error(body.message||`Request failed (${response.status})`); } listNote(response); return body;
}
// REQ-PLT-004: a list the server cut at a fixed number of rows says so in the X-List-Note header; ListNotice shows it.
export const LIST_NOTE_EVENT='reftech:list-note';
function listNote(response:Response){try{const note=response.headers.get('X-List-Note');if(note&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent(LIST_NOTE_EVENT,{detail:note}));}catch{/* no window (tests) */}}
export function currentUser(){try{const sup=sessionStorage.getItem('reftech_support_user');if(sup){const u=JSON.parse(sup)?.user;if(u)return u;}return JSON.parse(localStorage.getItem('reftech_user')||'{}')}catch{return {}}}

export async function apiDownload(path:string, filename:string){
 if(!API_URL) throw new Error('VITE_API_URL is not configured');
 const token=sessionToken();
 const response=await fetch(`${API_URL}${path}`,{headers:{...(token?{Authorization:`Bearer ${token}`}:{})}});
 if(!response.ok){const text=await response.text();throw new Error(text||`Request failed (${response.status})`);}
 const blob=await response.blob(); const url=URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}

// POST a JSON body and save the file that comes back (e.g. the Create Bill "Generate Excel" preview,
// built from rows that aren't saved yet). Uses the server's filename when it sends one.
export async function apiDownloadPost(path:string, body:unknown, fallbackFilename:string){
 if(!API_URL) throw new Error('VITE_API_URL is not configured');
 const token=sessionToken();
 const response=await fetch(`${API_URL}${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
 if(!response.ok){const text=await response.text();let msg=text;try{msg=JSON.parse(text).message||text}catch{/* plain text */}throw new Error(msg||`Request failed (${response.status})`);}
 const cd=response.headers.get('Content-Disposition')||''; const m=/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd); const filename=m?decodeURIComponent(m[1]):fallbackFilename;
 const blob=await response.blob(); const url=URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
 return filename;
}

export async function uploadEmployeePhoto(employeeId:number|string, photo:File){
 if(!API_URL) throw new Error('VITE_API_URL is not configured');
 const token=sessionToken(); const form=new FormData(); form.append('photo',photo);
 const response=await fetch(`${API_URL}/api/admin/employees/${employeeId}/photo`,{method:'POST',headers:{...(token?{Authorization:`Bearer ${token}`}:{})},body:form});
 const text=await response.text(); let body:any={}; try{body=text?JSON.parse(text):{};}catch{body={message:text};}
 if(!response.ok) throw new Error(body.message||`Photo upload failed (${response.status})`); return body;
}

export async function uploadEmployeeIdentityCopy(employeeId:number|string, document:File){
 if(!API_URL) throw new Error('VITE_API_URL is not configured');
 const token=sessionToken(); const form=new FormData(); form.append('document',document);
 const response=await fetch(`${API_URL}/api/admin/employees/${employeeId}/identity-copy`,{method:'POST',headers:{...(token?{Authorization:`Bearer ${token}`}:{})},body:form});
 const text=await response.text(); let body:any={}; try{body=text?JSON.parse(text):{};}catch{body={message:text};}
 if(!response.ok) throw new Error(body.message||`Identity upload failed (${response.status})`); return body;
}

export async function uploadEmployeeDrivingLicence(employeeId:number|string, document:File){
 if(!API_URL) throw new Error('VITE_API_URL is not configured');
 const token=sessionToken(); const form=new FormData(); form.append('document',document);
 const response=await fetch(`${API_URL}/api/admin/employees/${employeeId}/driving-licence`,{method:'POST',headers:{...(token?{Authorization:`Bearer ${token}`}:{})},body:form});
 const text=await response.text(); let body:any={}; try{body=text?JSON.parse(text):{};}catch{body={message:text};}
 if(!response.ok) throw new Error(body.message||`Driving licence upload failed (${response.status})`); return body;
}

// Best-effort OCR pre-fill, run on the raw photo before the employee record exists. Never throws
// on a bad/unreadable image — callers treat a failure as "nothing to pre-fill", not a hard error.
export async function ocrIdentityName(document:File, identityDocumentType:string){
 if(!API_URL) throw new Error('VITE_API_URL is not configured');
 const token=sessionToken(); const form=new FormData(); form.append('document',document);
 const response=await fetch(`${API_URL}/api/admin/employees/ocr/identity-name?identityDocumentType=${encodeURIComponent(identityDocumentType||'')}`,{method:'POST',headers:{...(token?{Authorization:`Bearer ${token}`}:{})},body:form});
 const text=await response.text(); let body:any={}; try{body=text?JSON.parse(text):{};}catch{body={};}
 if(!response.ok) return {firstName:null,lastName:null,ocrAvailable:false}; return body;
}

export async function ocrDrivingLicenceExpiry(document:File){
 if(!API_URL) throw new Error('VITE_API_URL is not configured');
 const token=sessionToken(); const form=new FormData(); form.append('document',document);
 const response=await fetch(`${API_URL}/api/admin/employees/ocr/driving-licence-expiry`,{method:'POST',headers:{...(token?{Authorization:`Bearer ${token}`}:{})},body:form});
 const text=await response.text(); let body:any={}; try{body=text?JSON.parse(text):{};}catch{body={};}
 if(!response.ok) return {expiryDate:null,ocrAvailable:false}; return body;
}

// REQ-HR-007, 008, 009: send a file with form fields (self-service documents, HR documents, training certificates).
export async function apiUpload(path:string, fields:Record<string,string|Blob|null|undefined>){
 if(!API_URL) throw new Error('VITE_API_URL is not configured');
 const token=sessionToken(); const form=new FormData();
 for(const [k,v] of Object.entries(fields)) if(v!==null&&v!==undefined&&v!=='') form.append(k,v as any);
 const response=await fetch(`${API_URL}${path}`,{method:'POST',headers:{...(token?{Authorization:`Bearer ${token}`}:{})},body:form});
 const text=await response.text(); let body:any={}; try{body=text?JSON.parse(text):{};}catch{body={message:text};}
 if(!response.ok) throw new Error(body.message||`Upload failed (${response.status})`); return body;
}

// Opens a PDF or file from the server in a new tab (the address needs the login, so it is fetched first).
export async function apiOpen(path:string){
 if(!API_URL) throw new Error('VITE_API_URL is not configured');
 const token=sessionToken();
 const w=window.open('', '_blank');
 const response=await fetch(`${API_URL}${path}`,{headers:{...(token?{Authorization:`Bearer ${token}`}:{})}});
 if(!response.ok){ w?.close(); const text=await response.text(); let msg=text; try{msg=JSON.parse(text).message||text}catch{/* plain */} throw new Error(msg||`Request failed (${response.status})`); }
 const url=URL.createObjectURL(await response.blob());
 if(w) w.location.href=url; else window.location.href=url;
}
