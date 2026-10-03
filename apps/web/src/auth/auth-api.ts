export async function authRequest(action:'login'|'session'|'logout',body?:{username:string;password:string}) {
  const response=await fetch(`/api/auth/${action}`,{method:action==='session'?'GET':'POST',credentials:'same-origin',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const json=await response.json();
  if(!response.ok || !json.success) throw new Error(json.error?.code??'AUTH_UNAVAILABLE');
  return json.data as {authenticated?:boolean};
}
