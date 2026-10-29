export function validReviewReference(id,token){return /^[0-9a-f-]{36}$/i.test(id||'')&&/^[0-9a-f-]{72}$/i.test(token||'');}
export function gasReviewCall(google,action,id,token,payload={}){
 return new Promise((resolve,reject)=>{
  if(!validReviewReference(id,token)||!['load','save'].includes(action))return reject(Error('This photo review link is incomplete. Reopen it from the email.'));
  const timer=setTimeout(()=>reject(Error('The photo service did not reply. Your cutout is kept. Retry to check whether it was saved.')),65000);
  const runner=google.script.run.withSuccessHandler(result=>{clearTimeout(timer);resolve(result);}).withFailureHandler(error=>{clearTimeout(timer);reject(Error(error.message||String(error)));});
  if(action==='load')runner.getAvatarStudioReview(id,token);
  else runner.saveAvatarStudioReview({...payload,id,token});
 });
}
