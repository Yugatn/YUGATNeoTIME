/* PWA install and offline availability controls. No client data leaves the browser. */
(function(){
 'use strict';
 const status=document.getElementById('pwa-status');
 const install=document.getElementById('pwa-install');
 if(!status||!install)return;
 const message=value=>{status.textContent=value;};
 let deferred=null;
 const standalone=()=>window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches||
   window.navigator&&window.navigator.standalone===true;
 if(standalone())message('Приложение открыто в установленном режиме.');
 else message('Для установки и автономной работы требуется HTTPS или localhost.');
 window.addEventListener('beforeinstallprompt',event=>{
   event.preventDefault();
   deferred=event;install.hidden=false;
   message('Приложение доступно для установки. Нажмите «Установить» или используйте меню браузера.');
 });
 install.addEventListener('click',async()=>{
   if(!deferred)return;
   const prompt=deferred;deferred=null;install.hidden=true;
   try {await prompt.prompt();await prompt.userChoice;}
   catch(error){message('Для установки используйте меню браузера.');}
 });
 window.addEventListener('appinstalled',()=>{
   deferred=null;install.hidden=true;
   message('Приложение установлено.');
 });
 if(!('serviceWorker' in navigator)){
   if(!standalone())message('Браузер не поддерживает офлайн-режим PWA. Используйте современный браузер.');
   return;
 }
 if(location.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(location.hostname)){
   message('Офлайн-режим и зашифрованные резервные копии требуют HTTPS или localhost.');
   return;
 }
 navigator.serviceWorker.register('./sw.js',{scope:'./'}).then(reg=>{
   if(standalone())message('Установленное приложение готовит офлайн-файлы.');
   else if(!deferred)message('Офлайн-файлы подготавливаются. На iPhone: Поделиться → На экран «Домой».');
   if(reg.active)message('Основные страницы доступны офлайн после успешной первоначальной загрузки. Архивные данные Всемирного банка требуют сети.');
   navigator.serviceWorker.ready.then(()=>{
     if(!deferred&&!standalone())
       message('Календарь и часы подготовлены к офлайн-работе. На iPhone: Поделиться → На экран «Домой».');
   }).catch(()=>{});
 }).catch(error=>{
   message('Не удалось включить офлайн-режим: '+(error&&error.message?error.message:'ошибка регистрации')+'.');
 });
})();
