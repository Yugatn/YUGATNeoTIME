/* YUGATNeoTIME encrypted offline project backups. Web Crypto, no third parties. */
(function(root) {
  'use strict';
  const KIND='YUGATNeoTIME.projects.encrypted';
  const VERSION=1;
  const ITERATIONS=600000;
  const SALT_BYTES=16;
  const IV_BYTES=12;
  const MAX_ENVELOPE_CHARS=2400000;
  const MAX_CIPHER_BYTES=1200000;
  const AAD='YUGATNeoTIME encrypted project backup v1';
  const utf8=new TextEncoder();
  const decoder=new TextDecoder('utf-8',{fatal:true});

  function cryptoAPI() {
    const c=root.crypto;
    if(!c||!c.subtle||typeof c.getRandomValues!=='function')
      throw new Error('Защищённое шифрование недоступно. Требуется HTTPS или localhost и поддержка Web Crypto.');
    return c;
  }
  function passwordCheck(password) {
    if(typeof password!=='string'||password.length<12||password.length>512)
      throw new Error('Пароль должен содержать от 12 до 512 символов. Лучше использовать длинную уникальную фразу.');
    return password;
  }
  function b64(bytes) {
    let text='';
    for(let i=0;i<bytes.length;i+=32768) {
      text+=String.fromCharCode(...bytes.subarray(i,i+32768));
    }
    return btoa(text);
  }
  function fromB64(text,minimum,maximum) {
    if(typeof text!=='string'||text.length>Math.ceil(maximum/3)*4+8||
       text.length%4!==0||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text))
      throw new Error('Неверный формат зашифрованного файла.');
    let binary;
    try{binary=atob(text);}
    catch(error){throw new Error('Неверный формат зашифрованного файла.');}
    if(binary.length<minimum||binary.length>maximum)
      throw new Error('Недопустимый размер зашифрованных данных.');
    return Uint8Array.from(binary,char=>char.charCodeAt(0));
  }
  async function derive(password,salt,use) {
    const crypto=cryptoAPI();
    const material=await crypto.subtle.importKey('raw',utf8.encode(password),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey(
      {name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},
      material,{name:'AES-GCM',length:256},false,[use]);
  }
  function parseEnvelope(text){
    if(typeof text!=='string'||!text.length||text.length>MAX_ENVELOPE_CHARS)
      throw new Error('Зашифрованный файл отсутствует или слишком велик.');
    let e;
    try{e=JSON.parse(text);}
    catch(error){throw new Error('Некорректный JSON зашифрованного файла.');}
    if(!e||Array.isArray(e)||typeof e!=='object'||e.kind!==KIND||
       e.version!==VERSION||e.cipher!=='AES-256-GCM'||e.kdf!=='PBKDF2-SHA256'||
       e.iterations!==ITERATIONS)
      throw new Error('Формат или версия шифрованной резервной копии не поддерживаются.');
    const salt=fromB64(e.salt,SALT_BYTES,SALT_BYTES);
    const iv=fromB64(e.iv,IV_BYTES,IV_BYTES);
    const ciphertext=fromB64(e.ciphertext,17,MAX_CIPHER_BYTES);
    return {salt,iv,ciphertext};
  }
  function isEncrypted(text) {
    if(typeof text!=='string'||text.length>MAX_ENVELOPE_CHARS)return false;
    try {
      const obj=JSON.parse(text);
      return !!obj&&typeof obj==='object'&&obj.kind===KIND;
    } catch(error){return false;}
  }
  async function encrypt(plain,password) {
    passwordCheck(password);
    if(typeof plain!=='string'||!plain.length||utf8.encode(plain).length>1000000)
      throw new Error('Резервная копия для шифрования слишком велика или пуста.');
    const crypto=cryptoAPI();
    const salt=crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const iv=crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const key=await derive(password,salt,'encrypt');
    const ciphertext=new Uint8Array(await crypto.subtle.encrypt(
      {name:'AES-GCM',iv,additionalData:utf8.encode(AAD),tagLength:128},
      key,utf8.encode(plain)));
    return JSON.stringify({
      kind:KIND,version:VERSION,cipher:'AES-256-GCM',kdf:'PBKDF2-SHA256',
      iterations:ITERATIONS,salt:b64(salt),iv:b64(iv),ciphertext:b64(ciphertext)
    },null,2)+'\n';
  }
  async function decrypt(envelope,password) {
    passwordCheck(password);
    const item=parseEnvelope(envelope);
    try {
      const crypto=cryptoAPI();
      const key=await derive(password,item.salt,'decrypt');
      const data=await crypto.subtle.decrypt({
        name:'AES-GCM',iv:item.iv,additionalData:utf8.encode(AAD),tagLength:128
      },key,item.ciphertext);
      if(data.byteLength>1000000)throw new Error('Слишком большой файл после расшифрования.');
      return decoder.decode(data);
    } catch(error) {
      // Do not leak authentication details to a user or the page.
      throw new Error('Не удалось расшифровать копию. Проверьте пароль и целостность файла.');
    }
  }
  const api=Object.freeze({
    KIND,VERSION,ITERATIONS,MAX_ENVELOPE_CHARS,
    MIME:'application/json;charset=utf-8',isEncrypted,parseEnvelope,encrypt,decrypt
  });
  root.LifeCrypto=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
