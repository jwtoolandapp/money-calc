import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const target=resolve(process.argv[2] || 'dist');
const css=`<style data-jw-network="style">
[data-jw-network="top"],[data-jw-network="bottom"]{display:flex!important;justify-content:center!important;align-items:center!important;position:relative!important;box-sizing:border-box!important;font-family:system-ui,sans-serif!important;flex-shrink:0!important;float:none!important;color:#29364b!important}
[data-jw-network="top"]{width:fit-content!important;max-width:100%!important;min-height:56px!important;margin:0 auto!important;padding:8px 12px 4px!important;align-self:center!important;background:transparent!important;border:0!important;box-shadow:none!important}
[data-jw-network="bottom"]{width:100%!important;max-width:none!important;min-height:44px!important;padding:4px 12px!important;margin:24px 0 0!important;background:#fff!important;border:0!important;border-top:1px solid #e5e7eb!important}
[data-jw-network] a{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:36px!important;padding:0 12px!important;font-size:14px!important;font-weight:750!important;letter-spacing:.02em!important;text-decoration:none!important;color:inherit!important;background:none!important;border:0!important;box-shadow:none!important}
[data-jw-network="top"] a{min-height:44px!important;gap:9px!important;padding:0 8px!important;white-space:nowrap!important}
[data-jw-logo] .jw-monogram{display:inline-flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;width:34px!important;height:34px!important;flex:0 0 34px!important;border-radius:10px!important;background:#0c1638!important;color:#fff!important;font-family:system-ui,sans-serif!important;font-style:normal!important;font-size:12px!important;font-weight:850!important;letter-spacing:.04em!important;line-height:1!important;text-transform:none!important}
[data-jw-logo] .jw-caption{font-family:system-ui,sans-serif!important;font-style:normal!important;font-size:14px!important;font-weight:850!important;letter-spacing:-.02em!important;line-height:1.2!important;color:#0c1638!important;text-transform:none!important}
[data-jw-network] a:focus-visible{outline:2px solid #355cff!important;outline-offset:2px!important;border-radius:4px!important}
@media print{[data-jw-network]{display:none!important}}
</style>`;
let count=0;
async function visit(dir){
 for(const e of await readdir(dir,{withFileTypes:true})){
  const f=join(dir,e.name);
  if(e.isDirectory()){
   if(!e.name.startsWith('.')&&!['node_modules','scripts','design-preview','backups','functions'].includes(e.name))await visit(f);
  }else if(e.name.endsWith('.html')){
   const original=await readFile(f,'utf8');let html=original;
   if(!/<body[\s>]/i.test(html))continue;
   const english=/<html[^>]*lang=["']en/i.test(html);
   const top='<nav data-jw-network="top" aria-label="JW Tool &amp; App"><a data-jw-logo="wordmark" href="https://jwapplab.com/" aria-label="'+(english?'JW Tool &amp; App home':'JW Tool &amp; App 메인으로')+'"><span class="jw-monogram">JW</span><span class="jw-caption">Tool &amp; App</span></a></nav>';
   const bottom='<nav data-jw-network="bottom" aria-label="'+(english?'All apps':'전체 앱')+'"><a href="https://jwapplab.com/">'+(english?'All apps':'전체 앱 보기')+'</a></nav>';
   const existingStyle=html.match(/<style data-jw-network="style">[^]*?<\/style>/);
   const newline=(existingStyle?.[0] || original).match(/\r?\n/)?.[0] || '\n';
   const pageCss=css.replace(/\r?\n/g,newline);
   html=existingStyle?html.replace(existingStyle[0],pageCss):html.replace('</head>',pageCss+'</head>');
   html=/<nav data-jw-network="top"/.test(html)?html.replace(/<nav data-jw-network="top"[^>]*>[^]*?<\/nav>/,top):html.replace(/(<body[^>]*>)/i,'$1'+top);
   if(!/<nav[^>]*data-jw-network="bottom"/.test(html))html=html.replace('</body>',bottom+'</body>');
   if(html!==original){await writeFile(f,html);count++;}
  }
 }
}
if(!(await stat(target)).isDirectory())throw new Error('Missing output');
await visit(target);console.log('Network logo updated on '+count+' HTML pages');
