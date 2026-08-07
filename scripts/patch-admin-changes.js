const fs = require('fs');

const file = 'C:/Users/Abdulxodiy202/Desktop/claude/ielts-cdi/app/admin/AdminClient.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');
console.log('Initial lines:', lines.length);

function findLine(pred, label) {
  const idx = lines.findIndex(pred);
  if (idx === -1) { console.error('NOT FOUND:', label); process.exit(1); }
  console.log('Found "' + label + '" at line ' + (idx + 1) + ' (0-indexed ' + idx + ')');
  return idx;
}

// ── CHANGE 2: Remove GamesTab (bottom to top) ──

// 2a. Remove games rendering line
{
  const idx = findLine(l => l.includes("activeTab === 'games'") && l.includes('GamesTab'), 'games rendering');
  lines.splice(idx, 1);
}

// 2b. Remove games TABS entry
{
  const idx = findLine(l => l.includes("id: 'games'") && l.includes('Gamepad2'), 'games TABS entry');
  lines.splice(idx, 1);
}

// 2c. Remove GamesTab comment + function
{
  const commentIdx = findLine(l => l.includes('GamesTab') && l.trim().startsWith('/*'), 'GamesTab comment');
  let depth = 0, end = -1;
  for (let i = commentIdx + 1; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end !== -1) break;
  }
  if (end === -1) { console.error('GamesTab end not found'); process.exit(1); }
  console.log('Removing GamesTab lines ' + (commentIdx + 1) + '-' + (end + 1) + ' (' + (end - commentIdx + 1) + ' lines)');
  lines.splice(commentIdx, end - commentIdx + 1);
}

// 2d. Remove Gamepad2 from import
{
  const idx = findLine(l => l.includes('Gamepad2'), 'Gamepad2 import');
  lines[idx] = lines[idx].replace(', Gamepad2', '').replace('Gamepad2, ', '');
  console.log('Updated import:', lines[idx].trim());
}

// ── CHANGE 1: Transcript file upload in DictationsTab ──

// 1a. Add state vars after audioXhrRef line
{
  const idx = findLine(l => l.includes('audioXhrRef') && l.includes('useRef'), 'audioXhrRef');
  const insert = [
    "  const [transcriptMode, setTranscriptMode] = useState<'manual' | 'file'>('manual')",
    "  const [transcriptFileMsg, setTranscriptFileMsg] = useState<string | null>(null)",
  ];
  lines.splice(idx + 1, 0, ...insert);
}

// 1b. Add handleTranscriptFile function before "const wordCount"
{
  const idx = findLine(l => l.includes('const wordCount') && l.includes('transcript'), 'wordCount');
  const handler = [
    "  async function handleTranscriptFile(e: React.ChangeEvent<HTMLInputElement>) {",
    "    const file = e.target.files?.[0]",
    "    if (!file) return",
    "    if (file.size > 5 * 1024 * 1024) { alert('Fayl hajmi 5MB dan oshmasligi kerak'); return }",
    "    setTranscriptFileMsg(null)",
    "    const ext = file.name.split('.').pop()?.toLowerCase()",
    "    try {",
    "      let text = ''",
    "      if (ext === 'txt') {",
    "        text = await file.text()",
    "      } else if (ext === 'docx') {",
    "        const mammoth = (await import('mammoth')).default",
    "        const arrayBuffer = await file.arrayBuffer()",
    "        const result = await mammoth.extractRawText({ arrayBuffer })",
    "        text = result.value",
    "      } else {",
    "        alert(\"Faqat .txt yoki .docx fayllar qabul qilinadi\")",
    "        return",
    "      }",
    "      setEditing(p => ({ ...p, transcript: text.trim() }))",
    "      const wc = text.trim().split(/\\s+/).filter(Boolean).length",
    "      setTranscriptFileMsg(\"Fayl yuklandi (\" + wc + \" so'z)\")",
    "    } catch (err) {",
    "      alert(\"Fayl o'qishda xato: \" + (err instanceof Error ? err.message : \"Noma'lum xato\"))",
    "    }",
    "  }",
    "",
  ];
  lines.splice(idx, 0, ...handler);
}

// 1c. Replace Matn section
{
  const labelIdx = findLine(l => l.includes('Matn &mdash;') && l.includes('javob'), 'Matn label');

  // Walk back to find opening <div>
  let divStart = labelIdx - 1;
  while (divStart > 0 && !lines[divStart].trim().match(/^<div/)) divStart--;

  // Walk forward to find matching </div>
  let depth = 0, divEnd = -1;
  for (let i = divStart; i < lines.length; i++) {
    let pos = 0, s = lines[i];
    while (pos < s.length) {
      const open = s.indexOf('<div', pos);
      const close = s.indexOf('</div>', pos);
      if (open === -1 && close === -1) break;
      if (open !== -1 && (close === -1 || open < close)) { depth++; pos = open + 4; }
      else { depth--; pos = close + 6; if (depth === 0) { divEnd = i; break; } }
    }
    if (divEnd !== -1) break;
  }
  if (divEnd === -1) { console.error('Matn </div> not found'); process.exit(1); }
  console.log('Matn section lines ' + (divStart + 1) + '-' + (divEnd + 1));

  const newMatn = [
    "              <div>",
    "                <div className=\"flex items-center justify-between mb-1\">",
    "                  <label className=\"text-xs font-medium\" style={{ color: 'var(--text-muted)' }}>",
    "                    Matn &mdash; to&apos;g&apos;ri javob *",
    "                    <span className=\"ml-2 font-normal\">(audiodagi so&apos;zma-so&apos;z)</span>",
    "                  </label>",
    "                  <span className=\"text-xs\" style={{ color: wordCount >= 20 ? '#10b981' : '#ef4444' }}>",
    "                    {wordCount} so&apos;z{wordCount < 20 ? ' (min 20)' : ''}",
    "                  </span>",
    "                </div>",
    "                <div className=\"flex gap-4 mb-3\">",
    "                  <label className=\"flex items-center gap-1.5 cursor-pointer text-xs\">",
    "                    <input type=\"radio\" checked={transcriptMode === 'file'}",
    "                      onChange={() => { setTranscriptMode('file'); setTranscriptFileMsg(null) }}",
    "                      className=\"w-3 h-3\" />",
    "                    <span style={{ color: 'var(--text-primary)' }}>Fayl yuklash</span>",
    "                  </label>",
    "                  <label className=\"flex items-center gap-1.5 cursor-pointer text-xs\">",
    "                    <input type=\"radio\" checked={transcriptMode === 'manual'}",
    "                      onChange={() => { setTranscriptMode('manual'); setTranscriptFileMsg(null) }}",
    "                      className=\"w-3 h-3\" />",
    "                    <span style={{ color: 'var(--text-primary)' }}>Qo&apos;lda yozish</span>",
    "                  </label>",
    "                </div>",
    "                {transcriptMode === 'file' && (",
    "                  <div className=\"mb-3\">",
    "                    <label className=\"flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-sm\"",
    "                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>",
    "                      <FileText size={14} style={{ color: 'var(--accent)' }} />",
    "                      {transcriptFileMsg",
    "                        ? <span style={{ color: '#10b981' }}>✓ {transcriptFileMsg}</span>",
    "                        : <span style={{ color: 'var(--text-muted)' }}>TXT yoki DOCX fayl tanlang</span>}",
    "                      <input type=\"file\" accept=\".txt,.docx\" className=\"hidden\" onChange={handleTranscriptFile} />",
    "                    </label>",
    "                    {transcriptFileMsg && (",
    "                      <label className=\"mt-1.5 flex items-center gap-1.5 text-xs cursor-pointer\" style={{ color: 'var(--accent)' }}>",
    "                        <Upload size={11} /> Boshqa fayl tanlash",
    "                        <input type=\"file\" accept=\".txt,.docx\" className=\"hidden\" onChange={handleTranscriptFile} />",
    "                      </label>",
    "                    )}",
    "                  </div>",
    "                )}",
    "                <textarea value={editing.transcript ?? ''} onChange={e => setEditing(p => ({ ...p, transcript: e.target.value }))}",
    "                  rows={12} className=\"w-full px-3 py-2 rounded-lg text-sm border resize-y\"",
    "                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border)', minHeight: 300 }}",
    "                  placeholder=\"Audiodagi to'liq matn...\" />",
    "              </div>",
  ];
  lines.splice(divStart, divEnd - divStart + 1, ...newMatn);
  console.log('Replaced Matn section with ' + newMatn.length + ' lines');
}

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('Done. Final lines:', lines.length);
