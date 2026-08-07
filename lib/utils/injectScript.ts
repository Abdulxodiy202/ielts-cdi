/**
 * Builds a <script> string injected into CDI HTML test iframes.
 *
 * After the user clicks a Check/Submit button, we wait 1 second for the
 * HTML test to process and render results, then extract the score from the
 * DOM and send CDI_SUBMIT to the parent window.  Only if extraction fails
 * do we fall back to the legacy CDI_CHECK_ANSWERS (which yields score=0).
 *
 * Score extraction strategies (tried in order):
 *   1. Button text "Score: N / M" — exact match from check-button text
 *   2. Text "N/40" or "N / 40" — for full 40-question tests
 *
 * Strategy 3 (.correct element count) was removed — it incorrectly counts
 * "show correct answer" labels that get .correct class regardless of user choice.
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
    var lower=text.toLowerCase();

    // Strategy 1: "Score: N / M" button text — produced by check-button after click.
    // Find first digit sequence after "score:" to handle any total (10, 30, 40, etc.)
    var idx=lower.indexOf('score:');
    if(idx!==-1){
      var sub=text.slice(idx+6); // skip "score:"
      var firstDigit=-1;
      for(var k=0;k<sub.length;k++){
        var c=sub.charCodeAt(k);
        if(c>=48&&c<=57){firstDigit=k;break;}
      }
      if(firstDigit!==-1){
        var numStr='';
        for(var k2=firstDigit;k2<sub.length;k2++){
          var c2=sub.charCodeAt(k2);
          if(c2>=48&&c2<=57) numStr+=sub[k2]; else break;
        }
        var n=parseInt(numStr,10);
        if(!isNaN(n)&&n>=0&&n<=40) return n;
      }
    }

    // Strategy 2: "N/40" — full-test pattern (only whole-number match: space/newline/start before N)
    for(var i=40;i>=0;i--){
      var s=String(i);
      var patterns=[' '+s+'/40',' '+s+' /40',' '+s+'/ 40',' '+s+' / 40',
                    '\\n'+s+'/40','\\n'+s+' / 40'];
      for(var p=0;p<patterns.length;p++){
        if(text.indexOf(patterns[p])!==-1) return i;
      }
    }

    return null;
  }

  function notify(){
    var score=extractScore();
    // Always send CDI_NATIVE first so parent's nativeSubmitRef gate opens,
    // even if the HTML file's own CDI_NATIVE failed (e.g. exception before it).
    window.parent.postMessage({type:'CDI_NATIVE'},'*');
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

  // Event delegation for CDI buttons (works even if elements are hidden at load time)
  document.addEventListener('click',function(e){
    var target=e.target;
    if(!target) return;
    var el=target;
    while(el&&el!==document.body){
      if(el.id==='go-dashboard-btn'){
        window.parent.postMessage({type:'CDI_GO_DASHBOARD'},'*');
        return;
      }
      if(el.id==='analyse-btn'){
        var modal=document.getElementById('results-modal');
        if(modal) modal.classList.add('hidden');
        return;
      }
      el=el.parentElement;
    }
  });
})()
`

  return `<script>${body}${close}`
}
