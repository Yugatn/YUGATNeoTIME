/* UI for encrypted project-only backups; secrets never enter localStorage. */
(function(){
 'use strict';
 const C=globalThis.LifeCrypto, T=globalThis.LifeTransfer, B=globalThis.LifePlannerBridge;
 const $=id=>document.getElementById(id);
 let sealedText=null, pending=null, readToken=0, processing=false;
 const message=text=>{$('crypto-status').textContent=text;};
 function preview(text){$('crypto-preview').textContent=text;}
 function invalidate(text){
   ++readToken; sealedText=null;pending=null;
   $('crypto-apply').disabled=true;
   preview(text||'Выберите шифрованную резервную копию.');
 }
 function download(name,content){
   const blob=new Blob([content],{type:C.MIME});
   const href=URL.createObjectURL(blob);
   const a=document.createElement('a');a.download=name;a.href=href;
   document.body.appendChild(a);
   try { a.click(); }
   finally { a.remove();setTimeout(()=>URL.revokeObjectURL(href),5000); }
 }
 function consentMode(){return $('crypto-import-mode').value;}
 function showPreview(){
   $('crypto-apply').disabled=true;
   if(!pending){preview('Сначала расшифруйте и проверьте файл.');return;}
   try{
     const mode=consentMode();
     const p=T.preview(B.snapshot(),pending,mode);
     preview('Расшифровано: '+p.importedProjects+' проектов, '+p.importedMilestones+
       ' этапов. После импорта: '+p.afterProjects+' проектов, '+p.afterMilestones+
       ' этапов. '+(mode==='replace'?
         'Все текущие записи будут заменены после отдельного подтверждения.':
         'Текущие записи останутся; повторное добавление создаст копии.'));
     $('crypto-apply').disabled=false;
   }catch(error){preview('Применение заблокировано: '+error.message);}
 }
 $('crypto-export').addEventListener('click',async function(){
   if(processing)return;
   const a=$('crypto-export-password'),b=$('crypto-export-confirm');
   const password=a.value,confirmation=b.value;
   a.value='';b.value='';
   if(password!==confirmation){message('Пароли не совпадают. Файл не создан.');return;}
   processing=true; $('crypto-export').disabled=true;
   message('Создание зашифрованной копии…');
   try{
     const plain=T.exportJson(B.snapshot());
     const encrypted=await C.encrypt(plain,password);
     download('yugatneotime-projects.encrypted.json',encrypted);
     message('Зашифрованная резервная копия готова. Храните пароль отдельно: восстановить его невозможно.');
   }catch(error){message('Копия не создана: '+error.message);}
   finally{processing=false;$('crypto-export').disabled=false;}
 });
 $('crypto-file').addEventListener('change',async function(){
   invalidate();
   const files=$('crypto-file').files;
   if(!files||!files.length){message('Файл не выбран.');return;}
   const file=files[0];
   if(!Number.isFinite(file.size)||!file.size||file.size>C.MAX_ENVELOPE_CHARS){
     message('Зашифрованный JSON-файл должен быть размером не более 2,4 МБ.');
     return;
   }
   const token=readToken;
   try{
     const raw=await file.text();
     if(token!==readToken)return;
     if(!C.isEncrypted(raw))throw Error('Выберите зашифрованный файл YUGATNeoTIME, не обычный JSON.');
     C.parseEnvelope(raw); // structural validation before asking for password
     sealedText=raw;
     message('Зашифрованный файл проверен. Введите пароль и нажмите «Расшифровать».');
     preview('Файл структурно корректен. Содержимое ещё недоступно без пароля.');
   }catch(error){
     if(token!==readToken)return;
     sealedText=null;
     message('Невозможно открыть файл: '+error.message);
   }
 });
 $('crypto-unlock').addEventListener('click',async function(){
   if(!sealedText||processing){message('Сначала выберите корректный зашифрованный файл.');return;}
   const input=$('crypto-import-password'),password=input.value;
   input.value='';
   const token=readToken;
   processing=true;$('crypto-unlock').disabled=true;
   message('Проверка пароля и расшифрование…');
   try{
     const plain=await C.decrypt(sealedText,password);
     if(token!==readToken)return;
     pending=T.parseJson(plain);
     sealedText=null;
     message('Данные расшифрованы и проверены. Выберите режим импорта.');
     showPreview();
   }catch(error){
     if(token!==readToken)return;
     pending=null;
     $('crypto-apply').disabled=true;
     message('Не удалось получить данные: '+error.message);
     preview('Попробуйте пароль ещё раз. Текущие проекты не изменены.');
   }finally{processing=false;$('crypto-unlock').disabled=false;}
 });
 $('crypto-import-mode').addEventListener('change',showPreview);
 $('crypto-apply').addEventListener('click',function(){
   if(!pending)return;
   try{
     const mode=consentMode(),p=T.preview(B.snapshot(),pending,mode);
     if(mode==='replace'&&!window.confirm('Заменить все текущие '+p.beforeProjects+
       ' проектов и '+p.beforeMilestones+
       ' этапов? Существующие записи будут утрачены без отдельной копии.')){
       message('Замена отменена. Текущие данные сохранены.');
       return;
     }
     const merged=T.merge(B.snapshot(),pending,mode);
     const result=B.applyImport(merged);
     message('Импорт завершён: '+result.projects+' проектов, '+result.milestones+' этапов.'+
       (result.persisted?'':' Данные остаются только в памяти вкладки либо сохранение недоступно.'));
     invalidate('Импорт завершён. Для нового импорта выберите файл.');
     $('crypto-file').value='';$('crypto-import-password').value='';
   }catch(error){
     message('Импорт не применён: '+error.message);
     showPreview();
   }
 });
 $('clear').addEventListener('click',function(){
   invalidate('Параметры сброшены, выбранный файл удалён из памяти вкладки.');
   $('crypto-export-password').value='';
   $('crypto-export-confirm').value='';
   $('crypto-import-password').value='';
   $('crypto-file').value='';
 });
 invalidate();
})();
