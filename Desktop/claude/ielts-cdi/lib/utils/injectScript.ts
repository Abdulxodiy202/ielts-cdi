/**
 * Builds a <script> string injected into CDI HTML test iframes.
 *
 * After the user clicks a Check/Submit button, we wait 1 second for the
 * HTML test to process and render results, then extract the score from the
 * DOM and send CDI_SUBMIT to the parent window.  Only if extraction fails
 * do we fall back to the legacy CDI_CHECK_ANSWERS (which yields score=0).
 *
 * Score extraction strategies (tried in order):
 *   1. Text "N/40" anywhere on the page (handles "33/40", "33 / 40", etc.)
 *   2. Text "score: N" or "correct: N" pattern
 *   3. Count elements with .correct / .right / .tick class
 */
export function buildInjectScript(): string {
  const close = '</' + 'script>'

  // NOTE: this string is injected verbatim as JavaScript inside the iframe.
  // Avoid regex literals to sidestep backslash-escaping complexity — use
  // indexOf loops instead.
  const body = `
(function(){
  function extractScore(){
    var body=document.body||document.documentElement;
    var text=body.innerText||body.textContent||'';

    // Strategy 1: find "N/40" (with optional spaces around /)
    for(var i=40;i>=0;i--){
      var s=String(i);
      if(text.indexOf(s+'/40')!==-1||
         text.indexOf(s+' /40')!==-1||
         text.indexOf(s+'/ 40')!==-1||
         text.indexOf(s+' / 40')!==-1){
        return i;
      }
    }

    // Strategy 2: "score: N" or "correct: N" (case-insensitive via toLowerCase)
    var lower=text.toLowerCase();
    var idx=lower.indexOf('score:');
    if(idx===-1) idx=lower.indexOf('correct:');
    if(idx!==-1){
      var after=text.slice(idx).replace(/[^0-9]/,'');
      var n=parseInt(after,10);
      if(!isNaN(n)&&n>=0&&n<=40) return n;
    }

    // Strategy 3: count .correct / .right / .tick elements
    var selectors=['.correct','.right','.tick','[class*=correct]','[class*=right]','[class*=tick]'];
    for(var j=0;j<selectors.length;j++){
      try{
        var els=body.querySelectorAll(selectors[j]);
        if(els.length>0&&els.length<=40) return els.length;
      }catch(e){}
    }

    return null;
  }

  function notify(){
    var score=extractScore();
    if(score!==null&&score>=0){
      window.parent.postMessage({type:'CDI_SUBMIT',score:score},'*');
    }else{
      window.parent.postMessage({type:'CDI_CHECK_ANSWERS'},'*');
    }
  }

  function bind(){
    document.querySelectorAll('button,input[type=button],input[type=submit]').forEach(function(el){
      var t=(el.textContent||el.value||'').toLowerCase().trim();
      if(t.indexOf('check')!==-1||t.indexOf('submit')!==-1||t.indexOf('finish')!==-1||t.indexOf('done')!==-1){
        el.addEventListener('click',function(){ setTimeout(notify,1000); },{once:true});
      }
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',bind);
  }else{
    bind();
  }
  setTimeout(bind,1500);
})()
`

  return `<script>${body}${close}`
}
