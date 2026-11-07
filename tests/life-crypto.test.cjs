'use strict';
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const M=require('../src/life-milestones.js');
const T=require('../src/life-transfer.js');
const Crypto=require('../src/life-crypto.js');

// Node exposes the same standardized WebCrypto primitives as modern browsers.
globalThis.crypto=webcrypto;
async function run() {
  let state=M.addProject(M.empty(),{
    id:'project1',name:'Амбивалентный Солипсизм',start:'2026-11-08'
  });
  state=M.addMilestone(state,{
    id:'step1',projectId:'project1',date:'2026-11-15',
    title:'Завершить рукопись. Защищённая копия'
  });
  const plain=T.exportJson(state,'2026-11-08T00:00:00.000Z');
  const password='Длинная уникальная фраза с 18+ символами 🗝️';
  const encrypted=await Crypto.encrypt(plain,password);
  assert.equal(Crypto.isEncrypted(encrypted),true);
  assert.ok(!encrypted.includes('Амбивалентный Солипсизм'));
  assert.ok(!encrypted.includes('Завершить рукопись'));
  assert.ok(!encrypted.includes(password));
  const metadata=JSON.parse(encrypted);
  assert.equal(metadata.kind,Crypto.KIND);
  assert.equal(metadata.version,1);
  assert.equal(metadata.kdf,'PBKDF2-SHA256');
  assert.equal(metadata.cipher,'AES-256-GCM');
  assert.equal(metadata.iterations,600000);
  assert.equal(Buffer.from(metadata.salt,'base64').byteLength,16);
  assert.equal(Buffer.from(metadata.iv,'base64').byteLength,12);
  const restored=await Crypto.decrypt(encrypted,password);
  assert.equal(restored,plain);
  assert.deepEqual(T.parseJson(restored),state);
  const other=await Crypto.encrypt(plain,password);
  assert.notEqual(JSON.parse(other).salt,metadata.salt);
  assert.notEqual(JSON.parse(other).iv,metadata.iv);
  assert.notEqual(other,encrypted);
  await assert.rejects(Crypto.decrypt(encrypted,'Другой очень длинный пароль для теста'),/Не удалось расшифровать/);
  const broken=JSON.parse(encrypted);
  const modified=Buffer.from(broken.ciphertext,'base64');
  modified[modified.length-2]^=0x02;
  broken.ciphertext=modified.toString('base64');
  await assert.rejects(Crypto.decrypt(JSON.stringify(broken),password),/Не удалось расшифровать/);
  const wrongIter={...metadata,iterations:1};
  await assert.rejects(Crypto.decrypt(JSON.stringify(wrongIter),password),/не поддерживаются/);
  const wrongSalt={...metadata,salt:'a'};
  await assert.rejects(Crypto.decrypt(JSON.stringify(wrongSalt),password),/Неверный формат/);
  await assert.rejects(Crypto.encrypt(plain,'short'),/от 12/);
  await assert.rejects(Crypto.decrypt(encrypted,'short'),/от 12/);
  assert.equal(Crypto.isEncrypted(plain),false);
  assert.equal(Crypto.isEncrypted('not json'),false);
  await assert.rejects(Crypto.decrypt('not json',password),/Некорректный JSON/);

  // Compatibility: encrypted backups decrypt back to existing importable v1 JSON.
  const imported=T.merge(M.empty(),T.parseJson(restored),'append');
  assert.equal(imported.projects.length,1);
  assert.equal(imported.milestones.length,1);
  assert.equal(imported.milestones[0].projectId,imported.projects[0].id);

  const html=fs.readFileSync(path.join(__dirname,'../life-clock.html'),'utf8');
  const ui=fs.readFileSync(path.join(__dirname,'../src/life-crypto-ui.js'),'utf8');
  for(const id of [
    'crypto-export-password','crypto-export-confirm','crypto-export',
    'crypto-file','crypto-import-password','crypto-import-mode',
    'crypto-unlock','crypto-apply','crypto-preview','crypto-status'
  ])assert.ok(html.includes('id="'+id+'"'),'Missing crypto UI control '+id);
  assert.ok(html.indexOf('src/life-crypto.js')<html.indexOf('src/life-crypto-ui.js'));
  new vm.Script(ui,{filename:'life-crypto-ui.js'});
  console.log('Web Crypto AES-256-GCM encrypted backups: roundtrip, tamper & password tests passed');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
