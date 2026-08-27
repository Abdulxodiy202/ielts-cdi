/**
 * Responsive safety-net for uploaded CDI test HTML files.
 *
 * The admin-uploaded template ships with a hard-coded desktop layout:
 *
 *   .header                (position:fixed, height:60px, z-index:100)
 *   .main-container        (margin-top:60px, height: calc(100vh - 60px))
 *     .panels-container    (display:flex, flex:1)
 *       .passage-panel     (flex:1, min-width:200px)
 *       .resizer           (width:10px, cursor:col-resize)
 *       .questions-panel   (flex:1, min-width:200px, border-left)
 *   .nav-arrows            (fixed bottom:100px right:20px, z-index:101)
 *   .nav-row               (fixed bottom:0, height:80px, z-index:100)
 *
 * On a 400px phone the two flex:1 panels + the 10px resizer squash the
 * passage/questions text below its own min-width. The nav-arrows (50px
 * square) and the .nav-row question footer (80px tall) also overlap the
 * questions-panel scroll area badly enough to hide the last question's
 * options. The previous generic rules (inline flex/grid selectors,
 * .split / .two-column names) never fired because this template uses
 * different class names, so nothing changed on mobile at all.
 *
 * Below 820px we now:
 *   - stack .panels-container vertically (flex-direction: column)
 *     so each panel takes full width
 *   - hide .resizer (col-resize is meaningless when stacked)
 *   - swap .questions-panel border-left for border-top and add extra
 *     bottom padding so the .nav-row / .nav-arrows can't clip content
 *   - shrink .nav-arrows to 40px and pull them off the .nav-row so both
 *     stay reachable (thumb zone)
 *   - keep the JS layer untouched: prev/next in this template toggle
 *     .question-set .hidden on a fixed-ID div (id="questions-1" etc.),
 *     not element widths, so a column stack doesn't break navigation.
 */
function buildResponsiveStyle(): string {
  return `
<style>
@media (max-width: 820px) {
  html, body { max-width: 100vw !important; overflow-x: hidden !important; }
  img, table, video, pre, code { max-width: 100% !important; height: auto !important; }

  /* Header: shrink to leave more room for content */
  .header { height: 50px !important; padding: 8px 12px !important; }
  .main-container { margin-top: 50px !important; height: calc(100vh - 50px) !important; }

  /* Stack the two panels vertically */
  .panels-container { flex-direction: column !important; overflow: auto !important; }
  .passage-panel, .questions-panel {
    flex: 0 0 auto !important;
    width: 100% !important;
    min-width: 0 !important;
    padding: 12px 14px 20px !important;
  }
  .questions-panel {
    border-left: none !important;
    border-top: 1px solid #e0e0e0 !important;
    /* Reserve room for the fixed .nav-row (70px) + .nav-arrows (50px) */
    padding-bottom: 140px !important;
  }
  .resizer { display: none !important; }

  /* Fixed pagination controls -- keep clickable, out of the way of
     the .nav-row footer. */
  .nav-arrows {
    bottom: 84px !important;
    right: 8px !important;
    gap: 4px !important;
    z-index: 102 !important;
  }
  .nav-arrow {
    width: 40px !important;
    height: 40px !important;
    font-size: 18px !important;
  }

  /* Bottom question-navigation footer: shrink + allow horizontal scroll
     so 40-question strips still fit a 400px screen. */
  .nav-row {
    height: 70px !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    -webkit-overflow-scrolling: touch;
  }
  .footer__questionWrapper___1tZ46 { margin-right: 8px !important; }
  .footer__questionNo___3WNct {
    padding: 6px 8px !important;
    font-size: 13px !important;
    gap: 3px !important;
  }
}
</style>`
}

/**
 * Builds a <script> (plus the responsive safety-net <style> above) string
 * injected into CDI HTML test iframes.
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

  return `${buildResponsiveStyle()}\n<script>${body}${close}`
}
