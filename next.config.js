import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

const SOURCES = [
  { id:'isw',           icon:'🎯', name:'ISW',               type:'UNDERSTANDINGWAR.ORG', group:'ANALYSIS',  query:'Institute for Study of War Middle East Israel Iran Gaza latest assessment 2026' },
  { id:'warzone',       icon:'✈️', name:'The War Zone',      type:'MILITARY ANALYSIS',    group:'ANALYSIS',  query:'The War Zone thedrive.com Middle East Israel Iran military operations latest 2026' },
  { id:'csis',          icon:'🔬', name:'CSIS',              type:'STRATEGIC STUDIES',    group:'ANALYSIS',  query:'CSIS Middle East Iran Israel strategic analysis 2026' },
  { id:'toi',           icon:'🇮🇱', name:'Times of Israel',  type:'LIVE BLOG',            group:'LIVE NEWS', query:'Times of Israel breaking news live updates Israel Iran Gaza today February 2026' },
  { id:'iranintl',      icon:'🇮🇷', name:'Iran International',type:'IRAN COVERAGE',       group:'LIVE NEWS', query:'Iran International latest breaking news Iran today February 2026' },
  { id:'reuters',       icon:'📰', name:'Reuters',           type:'WIRE SERVICE',         group:'LIVE NEWS', query:'Reuters Middle East latest news Israel Iran Gaza Lebanon today February 2026' },
  { id:'aljazeera',     icon:'📺', name:'Al Jazeera',        type:'REGIONAL COVERAGE',    group:'LIVE NEWS', query:'Al Jazeera Middle East breaking news Gaza Lebanon Iran today 2026' },
  { id:'rferl',         icon:'📡', name:'RFE/RL',            type:'RADIO FREE EUROPE',    group:'LIVE NEWS', query:'Radio Free Europe Iran latest news today February 2026' },
  { id:'me_spectator',  icon:'📨', name:'ME Spectator',      type:'TELEGRAM / OSINT',     group:'OSINT',     query:'Middle East Spectator Telegram latest posts Israel Iran Lebanon Houthi conflict' },
  { id:'osint',         icon:'🔭', name:'OSINT Accounts',    type:'SOCIAL MEDIA',         group:'OSINT',     query:'OSINT Middle East conflict OSINTdefender IntelCrab Aurora_Intel Israel Iran Gaza latest 2026' },
  { id:'combatfootage', icon:'🎥', name:'r/CombatFootage',   type:'REDDIT',               group:'OSINT',     query:'reddit combatfootage Israel Iran Gaza Lebanon latest verified footage 2026' },
  { id:'iran_nuclear',  icon:'☢️', name:'Iran Nuclear',      type:'PROLIFERATION',        group:'THEATER',   query:'Iran nuclear program IAEA Fordow Natanz enrichment latest February 2026' },
  { id:'houthis',       icon:'🚢', name:'Houthis / Red Sea', type:'YEMEN / MARITIME',     group:'THEATER',   query:'Houthi Yemen Red Sea attacks shipping Bab al-Mandab latest February 2026' },
  { id:'hezbollah',     icon:'🇱🇧', name:'Hezbollah',        type:'LEBANON FRONT',        group:'THEATER',   query:'Hezbollah Lebanon Israel northern border ceasefire latest February 2026' },
  { id:'idf_ops',       icon:'⚔️', name:'IDF Operations',   type:'MILITARY OPS',         group:'THEATER',   query:'IDF Israel Defense Forces military operations strikes latest February 2026' },
];

const THEATERS = [
  { name:'GAZA',    pct:91, color:'#e04040', level:'HI'  },
  { name:'IRAN',    pct:78, color:'#d4601a', level:'HI'  },
  { name:'LEBANON', pct:54, color:'#d4881a', level:'MID' },
  { name:'YEMEN',   pct:62, color:'#d4881a', level:'MID' },
  { name:'SYRIA',   pct:35, color:'#3a5a70', level:'LOW' },
  { name:'IRAQ',    pct:28, color:'#3a5a70', level:'LOW' },
];

const TICKER = [
  'IDF operations ongoing across multiple fronts — ISW assessment updated',
  'IRGC naval exercise in Strait of Hormuz — 3rd consecutive week',
  'Houthi anti-ship operations continue in Red Sea corridor',
  'Hezbollah fire along Blue Line — northern Israel evacuations extended',
  'US carrier group repositioned to Eastern Mediterranean',
  'IAEA denied Fordow access — enrichment at 60% continues',
  'Iraqi PMF on heightened alert near Syrian border',
  'Iran nuclear talks: Washington rejects sanctions precondition',
];

// Calls our own /api/claude proxy — API key stays server-side
async function callProxy(body) {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || data.error);
  return data.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

const m  = (tag, props, ...kids) => ({ tag, props: props||{}, kids });
const V  = '#07090c', V2='#0b0f14', V3='#0f151d', PANEL='#0b1018';
const B  = '#182232', B2='#1f2f42';
const A  = '#d4881a', A2='#f0a832', ADIM='#6b4208';
const R  = '#b83232', R2='#e04040';
const T  = '#bfcdd8', TD='#526878', TM='#283848';
const MONO = "'Share Tech Mono',monospace";
const COND = "'Barlow Condensed',sans-serif";
const BODY = "'Barlow',sans-serif";

export default function Sitrep() {
  const [clock, setClock]               = useState('--:--:--');
  const [activeId, setActiveId]         = useState(null);
  const [articles, setArticles]         = useState([]);
  const [feedState, setFeedState]       = useState('idle');
  const [errorMsg, setErrorMsg]         = useState('');
  const [selectedIdx, setSelectedIdx]   = useState(null);
  const [analysisQ, setAnalysisQ]       = useState('');
  const [analysisLog, setAnalysisLog]   = useState([
    { type:'system', text:'Ask anything — escalation risks, force postures, strategic assessments.' }
  ]);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const analysisRef = useRef(null);

  useEffect(() => {
    const tick = () => {
      const d = new Date(), p = n => String(n).padStart(2,'0');
      setClock(`${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`);
    };
    tick(); const id = setInterval(tick,1000); return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (analysisRef.current) analysisRef.current.scrollTop = analysisRef.current.scrollHeight;
  }, [analysisLog, analysisLoading]);

  async function loadSource(src) {
    setActiveId(src.id); setSelectedIdx(null); setArticles([]);
    setFeedState('loading'); setErrorMsg('');
    try {
      const system = `You are an intelligence analyst. Search the web for the latest news on the given topic and return ONLY valid JSON — no markdown, no explanation.
Schema: {"articles":[{"id":"str","title":"str","source":"str","time":"str","summary":"2-3 sentence summary","body":"5-7 sentence detailed breakdown","tags":["TAG"],"priority":"high|medium|low"}]}
Return 6-8 articles. Priority: high=active strikes/casualties, medium=diplomatic/movements, low=analysis.`;
      const raw = await callProxy({
        model:'claude-sonnet-4-20250514', max_tokens:4000,
        tools:[{type:'web_search_20250305',name:'web_search'}],
        system,
        messages:[{role:'user',content:`Latest intel on: ${src.query}. Focus on past 7 days.`}]
      });
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No structured data in response');
      const parsed = JSON.parse(match[0]);
      setArticles(parsed.articles || []); setFeedState('done');
    } catch(e) { setErrorMsg(e.message); setFeedState('error'); }
  }

  async function askAnalyst() {
    const q = analysisQ.trim();
    if (!q || analysisLoading) return;
    setAnalysisQ(''); setAnalysisLoading(true);
    setAnalysisLog(l => [...l, {type:'question',text:q}]);
    try {
      const answer = await callProxy({
        model:'claude-sonnet-4-20250514', max_tokens:1000,
        tools:[{type:'web_search_20250305',name:'web_search'}],
        system:`You are a senior Middle East intelligence analyst. Give concise, ISW-style assessments grounded in current web-searched facts. Be direct and specific. 3-5 sentences unless more detail is warranted. No excessive hedging.`,
        messages:[{role:'user',content:q}]
      });
      setAnalysisLog(l => [...l, {type:'answer',text:answer}]);
    } catch(e) {
      setAnalysisLog(l => [...l, {type:'error',text:'Error: '+e.message}]);
    }
    setAnalysisLoading(false);
  }

  const groups   = [...new Set(SOURCES.map(s => s.group))];
  const selected = selectedIdx !== null ? articles[selectedIdx] : null;
  const activeSrc = SOURCES.find(s => s.id === activeId);

  // ── styles as plain objects ──
  const S = {
    root:   { display:'flex', flexDirection:'column', height:'100vh', background:V, color:T, fontFamily:BODY, overflow:'hidden', position:'relative' },
    scan:   { position:'fixed', inset:0, background:'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.06) 3px,rgba(0,0,0,.06) 4px)', pointerEvents:'none', zIndex:9999 },
    ticker: { height:26, background:R, display:'flex', alignItems:'center', overflow:'hidden', borderBottom:`1px solid ${R}`, flexShrink:0 },
    header: { height:52, background:V2, borderBottom:`1px solid ${B2}`, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 18px', flexShrink:0, position:'relative' },
    body:   { display:'flex', flex:1, overflow:'hidden' },
  };

  return (
    <>
      <Head>
        <title>SITREP // Middle East Intelligence Dashboard</title>
        <meta name="description" content="Live Middle East conflict intelligence — powered by Claude AI" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎯</text></svg>" />
      </Head>

      <div style={S.root}>
        <div style={S.scan} />

        {/* ── TICKER ── */}
        <div style={S.ticker}>
          <div style={{padding:'0 14px',height:'100%',display:'flex',alignItems:'center',background:'rgba(0,0,0,.35)',fontFamily:MONO,fontSize:9,letterSpacing:3,color:'#fff',whiteSpace:'nowrap',borderRight:'1px solid rgba(255,255,255,.15)',flexShrink:0}}>
            ⬥ SITREP LIVE
          </div>
          <div style={{overflow:'hidden',flex:1}}>
            <div style={{display:'flex',animation:'ticker 90s linear infinite',whiteSpace:'nowrap'}}>
              {[...TICKER,...TICKER].map((t,i) => (
                <span key={i} style={{fontFamily:MONO,fontSize:10,color:'rgba(255,255,255,.9)',padding:'0 48px',letterSpacing:.3}}>◆ {t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ── HEADER ── */}
        <div style={S.header}>
          <div style={{position:'absolute',bottom:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${ADIM} 30%,${ADIM} 70%,transparent)`}} />
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            <div style={{fontFamily:COND,fontSize:28,fontWeight:900,letterSpacing:8,color:'#fff'}}>
              SIT<span style={{color:A2,textShadow:`0 0 16px rgba(212,136,26,.5)`}}>REP</span>
            </div>
            <div style={{width:1,height:24,background:B2}} />
            <div style={{fontFamily:MONO,fontSize:8,letterSpacing:3,color:TD,lineHeight:1.7}}>
              MIDDLE EAST INTELLIGENCE DASHBOARD<br/>POWERED BY CLAUDE AI · LIVE WEB SEARCH
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:20}}>
            <div style={{display:'flex',alignItems:'center',gap:6,fontFamily:MONO,fontSize:9,letterSpacing:3,color:R2}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:R2,boxShadow:`0 0 6px ${R2}`,animation:'blink 1.4s ease-in-out infinite'}} />
              LIVE
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontFamily:MONO,fontSize:20,color:A2,letterSpacing:2,textShadow:`0 0 10px rgba(212,136,26,.3)`}}>{clock}</div>
              <div style={{fontFamily:MONO,fontSize:8,color:TD,letterSpacing:2,marginTop:2}}>ZULU / UTC</div>
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={S.body}>

          {/* LEFT: SOURCES */}
          <div style={{width:210,flexShrink:0,borderRight:`1px solid ${B2}`,display:'flex',flexDirection:'column',background:PANEL,overflow:'hidden'}}>
            <div style={{padding:'8px 12px',background:V3,borderBottom:`1px solid ${B}`,fontFamily:MONO,fontSize:8,letterSpacing:3,color:A,flexShrink:0}}>INTEL SOURCES</div>
            <div style={{flex:1,overflowY:'auto'}}>
              {groups.map(group => (
                <div key={group} style={{borderBottom:`1px solid ${B}`}}>
                  <div style={{padding:'5px 12px',fontFamily:MONO,fontSize:8,letterSpacing:2,color:TM,background:V3,borderBottom:`1px solid ${B}`}}>{group}</div>
                  {SOURCES.filter(s => s.group === group).map(src => {
                    const isActive = activeId === src.id;
                    const isLoading = feedState === 'loading' && isActive;
                    return (
                      <button key={src.id} onClick={() => loadSource(src)} style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'8px 12px',border:'none',background:isActive?'rgba(212,136,26,.08)':'transparent',borderLeft:`2px solid ${isActive?A:'transparent'}`,borderBottom:`1px solid ${B}`,cursor:'pointer',textAlign:'left'}}>
                        <span style={{fontSize:13,flexShrink:0,width:20,textAlign:'center'}}>{src.icon}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontFamily:COND,fontSize:12,fontWeight:700,color:isActive?A2:T,letterSpacing:.5,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{src.name}</div>
                          <div style={{fontFamily:MONO,fontSize:7,color:TM,letterSpacing:1,marginTop:1}}>{src.type}</div>
                        </div>
                        {isLoading && <div style={{width:8,height:8,border:`1px solid ${A}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin .6s linear infinite',flexShrink:0}} />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{padding:'8px 12px',background:V3,borderTop:`1px solid ${B}`,flexShrink:0}}>
              <button onClick={() => activeSrc && loadSource(activeSrc)} style={{width:'100%',padding:6,background:`rgba(212,136,26,.08)`,border:`1px solid ${ADIM}`,borderRadius:2,fontFamily:MONO,fontSize:9,letterSpacing:2,color:A,cursor:'pointer'}}>
                ↺ REFRESH FEED
              </button>
            </div>
          </div>

          {/* CENTER: FEED */}
          <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',borderRight:`1px solid ${B2}`}}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px',background:V3,borderBottom:`1px solid ${B2}`,flexShrink:0}}>
              <span style={{fontFamily:MONO,fontSize:10,letterSpacing:3,color:A}}>INTEL FEED</span>
              <span style={{fontFamily:MONO,fontSize:9,padding:'2px 8px',background:'rgba(212,136,26,.1)',border:`1px solid ${ADIM}`,borderRadius:2,color:A2,letterSpacing:1}}>
                {activeSrc ? activeSrc.name.toUpperCase() : 'NO SOURCE SELECTED'}
              </span>
              <span style={{flex:1}} />
              <span style={{fontFamily:MONO,fontSize:9,color:TM,letterSpacing:1}}>
                {feedState==='done'?`${articles.length} REPORTS`:''}
              </span>
            </div>
            <div style={{flex:1,overflowY:'auto'}}>
              {feedState==='idle' && (
                <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,opacity:.3}}>
                  <div style={{fontSize:48}}>◉</div>
                  <div style={{fontFamily:COND,fontSize:18,fontWeight:700,letterSpacing:4,color:T}}>SELECT A SOURCE</div>
                  <div style={{fontFamily:MONO,fontSize:9,color:TD,letterSpacing:2}}>CHOOSE FROM THE LEFT PANEL TO LOAD LIVE INTEL</div>
                </div>
              )}
              {feedState==='loading' && (
                <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16}}>
                  <div style={{width:36,height:36,border:`2px solid ${B2}`,borderTopColor:A,borderRadius:'50%',animation:'spin .8s linear infinite'}} />
                  <div style={{fontFamily:MONO,fontSize:10,color:TD,letterSpacing:3}}>FETCHING INTEL</div>
                  <div style={{fontFamily:MONO,fontSize:8,color:TM,letterSpacing:2,maxWidth:260,textAlign:'center',lineHeight:1.7}}>Searching live sources via Claude AI web search…</div>
                </div>
              )}
              {feedState==='error' && (
                <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,padding:40,textAlign:'center'}}>
                  <div style={{fontSize:32,opacity:.4}}>⚠</div>
                  <div style={{fontFamily:MONO,fontSize:10,color:R2,letterSpacing:3}}>FETCH ERROR</div>
                  <div style={{fontFamily:MONO,fontSize:9,color:TD,letterSpacing:1,maxWidth:320,lineHeight:1.8}}>{errorMsg}</div>
                  <button onClick={() => activeSrc && loadSource(activeSrc)} style={{marginTop:8,padding:'6px 16px',background:`rgba(212,136,26,.1)`,border:`1px solid ${ADIM}`,borderRadius:2,fontFamily:MONO,fontSize:9,color:A,cursor:'pointer',letterSpacing:2}}>↺ RETRY</button>
                </div>
              )}
              {feedState==='done' && articles.map((a,i) => {
                const hi = a.priority==='high', mid = a.priority==='medium';
                const bc = hi?R2:mid?A:'transparent';
                const isSel = selectedIdx===i;
                return (
                  <div key={a.id||i} onClick={() => setSelectedIdx(i)} style={{padding:'13px 16px',borderBottom:`1px solid ${B}`,borderLeft:`2px solid ${isSel?A2:bc}`,background:isSel?'rgba(212,136,26,.05)':'transparent',cursor:'pointer',animation:`fadein .3s ease ${i*.05}s both`}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                      <span style={{fontFamily:MONO,fontSize:8,letterSpacing:2,color:TM,textTransform:'uppercase'}}>{a.source}</span>
                      <span style={{flex:1}} />
                      <span style={{fontFamily:MONO,fontSize:8,color:TM,letterSpacing:1}}>{a.time}</span>
                    </div>
                    <div style={{fontFamily:COND,fontSize:15,fontWeight:700,color:isSel?'#fff':T,letterSpacing:.3,lineHeight:1.3,marginBottom:5}}>{a.title}</div>
                    <div style={{fontFamily:BODY,fontSize:12,fontWeight:300,color:TD,lineHeight:1.6,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{a.summary}</div>
                    <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:7}}>
                      {(a.tags||[]).map(t => (
                        <span key={t} style={{fontFamily:MONO,fontSize:7,padding:'2px 5px',background:hi?'rgba(184,50,50,.2)':mid?'rgba(212,136,26,.15)':B,color:hi?R2:mid?A2:TM,borderRadius:1,letterSpacing:1}}>{t}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div style={{width:300,flexShrink:0,display:'flex',flexDirection:'column',overflow:'hidden',background:PANEL}}>

            {/* Theater bars */}
            <div style={{padding:'12px 14px',borderBottom:`1px solid ${B2}`,flexShrink:0}}>
              <div style={{fontFamily:MONO,fontSize:8,letterSpacing:3,color:TM,marginBottom:10}}>THEATER ACTIVITY</div>
              {THEATERS.map(t => (
                <div key={t.name} style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
                  <span style={{fontFamily:MONO,fontSize:8,letterSpacing:1,color:TD,width:52,flexShrink:0}}>{t.name}</span>
                  <div style={{flex:1,height:3,background:B,borderRadius:2,overflow:'hidden'}}>
                    <div style={{width:`${t.pct}%`,height:'100%',background:t.color,borderRadius:2}} />
                  </div>
                  <span style={{fontFamily:MONO,fontSize:8,letterSpacing:1,width:28,textAlign:'right',color:t.color,flexShrink:0}}>{t.level}</span>
                </div>
              ))}
            </div>

            {/* Article detail */}
            <div style={{flex:1,overflowY:'auto',padding:14}}>
              {!selected ? (
                <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,opacity:.25}}>
                  <div style={{fontSize:28}}>📋</div>
                  <div style={{fontFamily:MONO,fontSize:8,letterSpacing:2,color:TD,textAlign:'center',lineHeight:1.8}}>CLICK ANY ARTICLE<br/>TO READ IN FULL</div>
                </div>
              ) : (
                <div style={{animation:'fadein .25s ease both'}}>
                  <div style={{fontFamily:MONO,fontSize:8,letterSpacing:3,color:A,textTransform:'uppercase',marginBottom:6}}>{selected.source}</div>
                  <div style={{fontFamily:COND,fontSize:19,fontWeight:700,color:'#fff',lineHeight:1.25,letterSpacing:.5,marginBottom:10}}>{selected.title}</div>
                  <div style={{fontFamily:MONO,fontSize:8,color:TM,letterSpacing:2,marginBottom:14,paddingBottom:12,borderBottom:`1px solid ${B}`}}>{selected.time}</div>
                  <div style={{fontFamily:BODY,fontSize:12.5,fontWeight:300,lineHeight:1.8,color:T}}>{selected.body||selected.summary}</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:16}}>
                    {(selected.tags||[]).map(t => (
                      <span key={t} style={{fontFamily:MONO,fontSize:7,padding:'2px 6px',background:'rgba(212,136,26,.15)',color:A2,borderRadius:1,letterSpacing:1}}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Ask the Analyst */}
            <div style={{flexShrink:0,borderTop:`1px solid ${B2}`,background:V3}}>
              <div style={{padding:'8px 14px',fontFamily:MONO,fontSize:8,letterSpacing:3,color:A,borderBottom:`1px solid ${B}`,background:V2}}>⬥ ASK THE ANALYST</div>
              <div ref={analysisRef} style={{maxHeight:180,overflowY:'auto',padding:'10px 12px'}}>
                {analysisLog.map((m,i) => (
                  <div key={i} style={{fontFamily:m.type==='question'?MONO:BODY,fontSize:m.type==='question'?9:11.5,fontWeight:300,lineHeight:1.7,color:m.type==='question'?TD:m.type==='error'?R2:T,background:m.type==='question'?V:'transparent',borderLeft:m.type==='question'?`2px solid ${ADIM}`:'none',padding:m.type==='question'?'4px 8px':0,letterSpacing:m.type==='question'?1:0,marginBottom:8,animation:'fadein .2s ease both'}}>
                    {m.type==='question'?`▸ ${m.text}`:m.text}
                  </div>
                ))}
                {analysisLoading && <div style={{fontFamily:MONO,fontSize:9,color:A,letterSpacing:2,animation:'blink 1s ease-in-out infinite'}}>ANALYZING…</div>}
              </div>
              <div style={{display:'flex',padding:'8px 12px',borderTop:`1px solid ${B}`}}>
                <input value={analysisQ} onChange={e=>setAnalysisQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&askAnalyst()} placeholder="Ask about the conflict…" style={{flex:1,background:V,border:`1px solid ${B2}`,borderRight:'none',borderRadius:'2px 0 0 2px',padding:'7px 10px',fontFamily:MONO,fontSize:10,color:T,letterSpacing:.5,outline:'none'}} />
                <button onClick={askAnalyst} disabled={analysisLoading} style={{padding:'7px 12px',background:`rgba(212,136,26,.15)`,border:`1px solid ${ADIM}`,borderRadius:'0 2px 2px 0',fontFamily:MONO,fontSize:9,color:A,cursor:'pointer',letterSpacing:1,opacity:analysisLoading?.4:1}}>ASK →</button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
