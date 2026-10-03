import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const directory=resolve(root,'.owner-login');
const credentialPath=resolve(directory,'credentials.json');
mkdirSync(directory,{recursive:true});
let credentials;
if(existsSync(credentialPath) && !process.argv.includes('--rotate')) {
  credentials=JSON.parse(readFileSync(credentialPath,'utf8').replace(/^\uFEFF/,''));
} else {
  const password=process.argv.includes('--password-stdin') ? readFileSync(0,'utf8').trim() : randomBytes(24).toString('base64url');
  if(password.length<14 || password.length>512) throw new Error('Password must contain 14–512 characters.');
  credentials={username:'admin',password,salt:randomBytes(32).toString('hex'),version:randomBytes(16).toString('hex')};
}
const config={username:credentials.username,salt:credentials.salt,version:credentials.version,iterations:100000,hash:pbkdf2Sync(credentials.password,Buffer.from(credentials.salt,'hex'),100000,32,'sha256').toString('hex')};
if(process.argv.includes('--configure')) {
  const result=spawnSync(process.execPath,[resolve(root,'node_modules/wrangler/bin/wrangler.js'),'pages','secret','put','OWNER_LOGIN_CONFIG','--project-name','11'],{cwd:root,input:JSON.stringify(config),encoding:'utf8'});
  if(result.status!==0) {process.stderr.write(result.stderr??'Configuration failed');process.exit(1);}
}
writeFileSync(credentialPath,JSON.stringify(credentials,null,2),{mode:0o600});
writeFileSync(resolve(directory,'owner-login.txt'),'\uFEFF'+`知识库登录\n地址：https://11-9tc.pages.dev/login\n用户名：${credentials.username}\n密码：${credentials.password}\n\n请妥善保存此文件，不要提交 Git 或放入公开部署包。\n`,{mode:0o600});
console.log(process.argv.includes('--configure')?'Cloudflare owner login configured.':'Local credentials prepared; run with --configure to set the Cloudflare Secret.');
console.log('Credentials saved locally: '+resolve(directory,'owner-login.txt'));
