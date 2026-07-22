const crypto = require('crypto');
const COOKIE='banki_admin';
function secret(){return process.env.JWT_SECRET||''}
function sign(value){return crypto.createHmac('sha256',secret()).update(value).digest('hex')}
function token(){const exp=Date.now()+1000*60*60*12; const value=String(exp); return `${value}.${sign(value)}`}
function isAuth(event){const raw=event.headers.cookie||''; const found=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'=')); if(!found||!secret())return false; const [exp,sig]=(found.split('=')[1]||'').split('.'); if(!exp||!sig||Number(exp)<Date.now())return false; const expected=sign(exp); return sig.length===expected.length&&crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected));}
function json(statusCode,body,headers={}){return{statusCode,headers:{'Content-Type':'application/json; charset=utf-8',...headers},body:JSON.stringify(body)}}
module.exports={COOKIE,token,isAuth,json};
