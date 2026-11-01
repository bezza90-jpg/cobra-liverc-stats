const panel=document.getElementById('charts');
const back=document.createElement('a');back.textContent='← Back';back.href=new URL('../#raceExplorer',import.meta.url).href;back.className='lap-chart-back';back.style.cssText='display:inline-block;margin:0 0 20px;padding:11px 18px;border:1px solid #6c8a6d;border-radius:8px;color:#fff;background:#122b19;text-decoration:none';
back.addEventListener('click',event=>{if(history.length>1){event.preventDefault();history.back();}});
panel.before(back);
