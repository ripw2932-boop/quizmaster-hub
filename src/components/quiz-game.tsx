import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, Crown, Gamepad2, Home, Loader2, Maximize, Pause, Play, RotateCcw, Settings, ShieldCheck, SkipForward, Swords, Trophy, Users, Volume2, VolumeX, X, Pencil, Eraser } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { categories } from '@/lib/categories';
import { newMatch, selectQuestions, settleQuestion, STEAL_SECONDS, type Match, type Question } from '@/lib/game';
import { supabase } from '@/integrations/supabase/client';
import homeImage from '@/assets/family-home.png.asset.json';

const number = (n: number) => n.toLocaleString('en-US');
type Screen = 'home' | 'setup' | 'categories' | 'review' | 'play';
export function QuizGame() {
  const [screen,setScreen]=useState<Screen>('home');
  const [slide,setSlide]=useState(0);
  const slides=[{title:<>ليلة وحدة.<br/>تحدّي ما بنتهي.</>,copy:<>فريقين، أسئلة، وضحك للآخر.<br/>جمّع أصحابك… وخلّينا نشوف مين قدّها!</>},{title:<>كل سؤال.<br/>بيغيّر النتيجة.</>,copy:<>٢٠٠، ٤٠٠، أو ٦٠٠ نقطة.<br/>اختاروا التحدّي اللي على قدّكم.</>},{title:<>جمعتكم.<br/>إلها بطل واحد.</>,copy:<>٣ فئات لكل فريق.<br/>خلّوا المعرفة تحسم المنافسة.</>}];
  useEffect(()=>{const t=setInterval(()=>setSlide(s=>(s+1)%3),6500);return()=>clearInterval(t)},[]);
  const [dialog,setDialog]=useState<'help'|'settings'|null>(null);
  const [teams,setTeams]=useState(['الصقور','النمور']);
  const [chosen,setChosen]=useState<string[]>([]);
  const [teamPick,setTeamPick]=useState(0);
  const [match,setMatch]=useState<Match|null>(null);
  const [saved,setSaved]=useState<{id:string;state:Match}|null>(null);
  const [matchId,setMatchId]=useState('');
  const [token,setToken]=useState('');
  const [used,setUsed]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [sound,setSound]=useState(true);
  const [volume,setVolume]=useState(40);
  const [saveStatus,setSaveStatus]=useState('');
  const audio=useRef<AudioContext|null>(null);
  const [drawWord,setDrawWord]=useState(false);
  const [eraser,setEraser]=useState(false);
  const canvas=useRef<HTMLCanvasElement|null>(null);
  const dragging=useRef(false);
  const historyLoaded=useRef(false);
  function beep(freq=600) {
    if(!sound)return;
    try { const ctx=audio.current??new AudioContext();audio.current=ctx;void ctx.resume();const oscillator=ctx.createOscillator();const gain=ctx.createGain();oscillator.connect(gain);gain.connect(ctx.destination);oscillator.frequency.value=freq;gain.gain.setValueAtTime(Math.max(.001,volume/100*.12),ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.2);oscillator.start();oscillator.stop(ctx.currentTime+.2); }catch { /* Sound is optional when unavailable. */ }
  }
  useEffect(()=>{
    let key=localStorage.getItem('rip-device-token');
    if(!key){key=crypto.randomUUID();localStorage.setItem('rip-device-token',key)}
    setToken(key);
    supabase.rpc('rip_get_history',{p_token:key}).then(({data,error:err})=>{
      if(err){setError('تعذّر تحميل سجل اللعب. حاول تحديث الصفحة.');return}
      const result=data as unknown as {used:string[];match:{id:string;state:Match}|null};
      setUsed(result.used??[]);setSaved(result.match);historyLoaded.current=true;
    });
  },[]);
  useEffect(()=>{
    if(!match||!matchId||!token)return;
    setSaveStatus('جارٍ الحفظ');
    const timeout=setTimeout(()=>{
      supabase.rpc('rip_save_match',{p_token:token,p_id:matchId,p_state:JSON.parse(JSON.stringify(match))}).then(({error:err,data})=>setSaveStatus(err||!data?'تعذّر الحفظ':'محفوظة'));
    },350);
    return()=>clearTimeout(timeout);
  },[match,matchId,token]);
  useEffect(()=>{
    if(!match?.active||match.paused||match.revealed||match.finished)return;
    const timer=setInterval(()=>setMatch(current=>{
      if(!current||!current.active)return current;
      if(current.seconds<=1){beep(200);return current.stealing?settleQuestion(current,null):{...current,stealing:true,seconds:STEAL_SECONDS}}
      if(current.seconds<=6)beep(400);
      return {...current,seconds:current.seconds-1};
    }),1000);
    return()=>clearInterval(timer);
  },[match?.active,match?.paused,match?.revealed,match?.stealing,sound,volume]);
  const active=match?.questions.find(q=>q.id===match.active);
  async function startMatch(){
    if(!historyLoaded.current){setError('انتظر تحميل سجل الأسئلة ثم حاول مرة أخرى.');return}
    setBusy(true);setError('');
    try{
      const bank = (await import('@/data/question-bank.json')).default as Question[];
      const questions=selectQuestions(bank,chosen,used);
      const state=newMatch(teams,chosen,questions);
      const {data,error:err}=await supabase.rpc('rip_create_match',{p_token:token,p_ids:questions.map(q=>q.id),p_state:JSON.parse(JSON.stringify(state))});
      if(err)throw err;
      setMatchId(String(data));setMatch(state);setUsed(previous=>[...previous,...questions.map(q=>q.id)]);setScreen('play');beep();
    }catch(err){setError(err instanceof Error?err.message:'تعذّر بدء المباراة. حاول مرة أخرى.')}finally{setBusy(false)}
  }
  function choose(id:string){
    if(teamPick===1&&chosen.slice(0,3).includes(id))return;
    if(chosen.includes(id)){setChosen(chosen.filter(x=>x!==id));return}
    if(chosen.length>=(teamPick===0?3:6))return;
    setChosen([...chosen,id]);beep(450);
  }
  function wrong(){
    if(!match)return;
    beep(180);
    setMatch(match.stealing?settleQuestion(match,null):{...match,stealing:true,seconds:STEAL_SECONDS,revealed:false,paused:false});
  }
  const featured=categories.filter(c=>['jordan','football','animals','movies'].includes(c.id));
  return <div className="app-shell" dir="rtl">
    <header className="app-header">
      <Link to="/" onClick={()=>setScreen('home')} className="brand"><span className="brand-logo">RIP<span className="brand-dot">.</span></span><span className="brand-caption">ليلة التحدّي</span></Link>
      <nav className="desktop-nav"><Button variant="ghost" className={screen==='home'?'nav-active':''} onClick={()=>setScreen('home')}><Home/> الرئيسية</Button><Button variant="ghost" onClick={()=>{setScreen('setup');setError('')}}><Gamepad2/> العب الآن</Button><Button variant="ghost" onClick={()=>setDialog('help')}><BookOpen/> كيف نلعب؟</Button></nav>
      <div className="header-tools"><span className="live-badge"><span/> جاهزين للتحدّي؟</span><Button size="icon" variant="outline" title={sound?'كتم الصوت':'تشغيل الصوت'} aria-label={sound?'كتم الصوت':'تشغيل الصوت'} onClick={()=>setSound(!sound)}>{sound?<Volume2/>:<VolumeX/>}</Button><Button size="icon" variant="outline" title="الإعدادات" aria-label="الإعدادات" onClick={()=>setDialog('settings')}><Settings/></Button></div>
    </header>
    {screen==='home'&&<main className="screen-in">
      <section className="home-hero">
        <img className="hero-art" src={homeImage.url} alt="عائلة تتنافس وتضحك في ليلة لعب جماعية"/>
        <div className="hero-shade"/>
        <div className="hero-content"><div className="eyebrow"><Swords size={16}/> جمعتكم… صارت منافسة</div><h1>RIP<span>.</span></h1><div className="slide-copy screen-in" key={slide}><h2>{slides[slide]?.title}</h2><p>{slides[slide]?.copy}</p></div><Button className="primary-cta" size="lg" onClick={()=>{setScreen('setup');setError('');beep()}}><Play fill="currentColor"/> ابدأ اللعب <ArrowLeft/></Button><div className="hero-meta"><span><Users size={15}/> فريقان</span><span><BookOpen size={15}/> ١٥ فئة</span><span><Trophy size={15}/> ٢٠٠ · ٤٠٠ · ٦٠٠</span></div></div>
        <div className="hero-bottom"><span className="hero-tag"><Crown size={17}/> حوّل جمعتك إلى ليلة أبطال</span><span className="slide-position"><Button size="icon" variant="ghost" title="الشريحة السابقة" aria-label="الشريحة السابقة" onClick={()=>setSlide((slide+2)%3)}><ArrowLeft/></Button><i/> 0{slide+1} <span>/</span> 03<Button size="icon" variant="ghost" title="الشريحة التالية" aria-label="الشريحة التالية" onClick={()=>setSlide((slide+1)%3)}><ArrowRight/></Button></span></div>
      </section>
      <section className="category-preview"><div className="section-heading"><div><span className="eyebrow">كل واحد وإله ملعبه</span><h2>بأي فئة بتتحدّاهم؟</h2></div><Button variant="ghost" onClick={()=>setScreen('setup')}>كل الفئات <ArrowLeft/></Button></div><div className="featured-grid">{featured.map(c=><Button variant="ghost" className="photo-card" key={c.id} onClick={()=>{setChosen([]);setScreen('setup')}}><img src={c.image} alt={c.name}/><span className="photo-overlay"/><span className="card-badge">١٠٠ سؤال</span><span className="photo-label"><small>{c.tag}</small><strong>{c.name}</strong></span><span className="photo-arrow"><ArrowLeft/></span></Button>)}</div></section>
      <section className="home-bottom"><span><ShieldCheck size={18}/> أسئلة جديدة. منافسة جديدة.</span>{saved&&!saved.state.finished?<Button variant="outline" onClick={()=>{setMatch(saved.state);setMatchId(saved.id);setScreen('play')}}><RotateCcw/> أكمل مباراتك</Button>:<span>الجمعة بتحلى بالتحدّي</span>}</section>
    </main>}
    {screen==='setup'&&<main className="setup-page screen-in"><Steps step={1}/><div className="page-title"><span className="eyebrow">أول التحدّي</span><h1>مين ضد مين؟</h1><p>سمّوا فريقكم… وخلّوا الاسم على قدّ التحدّي.</p></div><div className="team-setup">{teams.map((name,i)=><div className="team-field" key={i}><span className="team-symbol"><Users size={32}/></span><label htmlFor={`team-${i}`}>الفريق {i===0?'الأول':'الثاني'}</label><input id={`team-${i}`} value={name} maxLength={24} onChange={e=>setTeams(teams.map((t,j)=>j===i?e.target.value:t))}/><small>{i===0?'جاهزين نفوز؟':'التحدّي إلنا!'}</small></div>)}<span className="versus">VS</span></div><div className="setup-actions"><Button variant="ghost" onClick={()=>setScreen('home')}><ArrowRight/> رجوع</Button><Button size="lg" disabled={teams.some(t=>!t.trim())||teams[0]?.trim()===teams[1]?.trim()} onClick={()=>{setChosen([]);setTeamPick(0);setScreen('categories')}}>اختيار الفئات <ArrowLeft/></Button></div></main>}
    {screen==='categories'&&<main className="selection-page screen-in"><Steps step={2}/><div className="selection-heading"><div><span className="eyebrow">اختاروا ملعبكم</span><h1>فئات {teams[teamPick]}</h1><p>٣ فئات لكل فريق. اختاروا اللي بتعرفوه!</p></div><div className="selection-counter"><strong>{teamPick===0?Math.min(chosen.length,3):Math.max(0,chosen.length-3)}</strong><span>/ 3 فئات</span></div></div><div className="all-categories">{categories.map(c=><Button key={c.id} variant="ghost" className={`photo-card category-select ${chosen.includes(c.id)?'selected':''}`} disabled={teamPick===1&&chosen.slice(0,3).includes(c.id)} onClick={()=>choose(c.id)}><img src={c.image} alt={c.name}/><span className="photo-overlay"/><span className="card-badge">١٠٠ سؤال</span><span className="select-indicator">{chosen.includes(c.id)&&<Check size={16}/>}</span><span className="photo-label"><strong>{c.name}</strong><small>{c.tag}</small></span></Button>)}</div><div className="selection-footer"><div><strong>{teams[teamPick]}</strong><span>{chosen.slice(teamPick*3,teamPick*3+3).map(id=>categories.find(c=>c.id===id)?.name).join(' · ')||'اختر ٣ فئات'}</span></div><Button size="lg" disabled={chosen.length!==(teamPick===0?3:6)} onClick={()=>{if(teamPick===0)setTeamPick(1);else setScreen('review')}}>{teamPick===0?'فئات الفريق الثاني':'مراجعة المباراة'}<ArrowLeft/></Button></div></main>}
    {screen==='review'&&<main className="setup-page screen-in"><Steps step={3}/><div className="page-title"><span className="eyebrow">كل شيء جاهز</span><h1>خلّينا نبدأ التحدّي</h1><p>٦ فئات · ٣٦ سؤال · فريق واحد بيرفع الكأس</p></div><div className="review-teams">{teams.map((t,i)=><div key={i}><h2><Users/> {t}</h2>{chosen.slice(i*3,i*3+3).map(id=>{const c=categories.find(c=>c.id===id);return <div className="review-category" key={id}><img src={c?.image} alt=""/><span>{c?.name}</span><small>٦ أسئلة</small></div>})}</div>)}</div>{error&&<p role="alert" className="error-message">{error}</p>}<div className="setup-actions"><Button variant="ghost" onClick={()=>setScreen('categories')}><ArrowRight/> تعديل الفئات</Button><Button size="lg" disabled={busy} onClick={startMatch}>{busy?<Loader2 className="animate-spin"/>:<Swords/>}{busy?'نجهّز أسئلة جديدة…':'ابدأ المباراة'}<ArrowLeft/></Button></div></main>}
    {screen==='play'&&match&&<main className="play-page screen-in"><div className="match-toolbar"><Button variant="ghost" size="icon" title="الرئيسية" aria-label="الرئيسية" onClick={()=>{setSaved({id:matchId,state:match});setScreen('home')}}><Home/></Button><span><ShieldCheck size={14}/>{saveStatus}</span><Button variant="ghost" onClick={()=>setMatch({...match,finished:true,active:null})}>إنهاء المباراة</Button></div><div className="scoreboard">{match.teams.map((t,i)=><div key={i} className={`score-team ${match.turn===i?'current-team':''}`}><span><Users size={18}/>{t}</span><strong key={match.scores[i]}>{number(match.scores[i] ?? 0)}</strong><small>{match.turn===i?'عليكم الدور':'جاهزين للسرقة'}</small></div>)}<div className="score-vs"><Swords/><span>{match.completed.length} / 36</span></div></div>
      {match.finished?<div className="results"><Trophy size={72}/><span className="eyebrow">خلصت الجولة… وبلّشت الحكاية</span><h1>{match.scores[0]===match.scores[1]?'تعادل الأبطال!':`${match.teams[(match.scores[0] ?? 0)>(match.scores[1] ?? 0)?0:1]} أبطال الليلة!`}</h1><p>{number(match.scores[0] ?? 0)} — {number(match.scores[1] ?? 0)}</p><Button size="lg" onClick={()=>{setScreen('setup');setSaved(null)}}><RotateCcw/> تحدّي جديد</Button></div>:active?<section className="question-screen" key={active.id}><div className="question-top"><span>{categories.find(c=>c.id===active.category)?.name}</span><strong>{active.points} نقطة</strong></div><div className={`timer ${match.seconds<=10?'timer-urgent':''}`}><span>{String(Math.floor(match.seconds/60)).padStart(2,'0')}:{String(match.seconds%60).padStart(2,'0')}</span><small>{match.stealing?`فرصة السرقة · ${match.teams[1-match.turn]}`:match.teams[match.turn]}</small></div>{match.stealing&&<div className="steal-banner"><Swords/> فرصة السرقة!</div>}
        {active.category==='drawing'?<><h2>تحدّي الرسم</h2><Button variant="outline" onClick={()=>setDrawWord(!drawWord)}><Pencil/>{drawWord?active.answer:'اعرض الكلمة للرسّام'}</Button><canvas ref={canvas} className="drawing-canvas" width={900} height={360} onPointerDown={e=>{dragging.current=true;e.currentTarget.setPointerCapture(e.pointerId);const rect=e.currentTarget.getBoundingClientRect();const ctx=e.currentTarget.getContext('2d');ctx?.beginPath();ctx?.moveTo((e.clientX-rect.left)*900/rect.width,(e.clientY-rect.top)*360/rect.height)}} onPointerMove={e=>{if(!dragging.current)return;const ctx=e.currentTarget.getContext('2d');if(!ctx)return;const rect=e.currentTarget.getBoundingClientRect();ctx.globalCompositeOperation=eraser?'destination-out':'source-over';ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--primary-foreground').trim();ctx.lineWidth=eraser?25:4;ctx.lineCap='round';ctx.lineTo((e.clientX-rect.left)*900/rect.width,(e.clientY-rect.top)*360/rect.height);ctx.stroke()}} onPointerUp={()=>{dragging.current=false}}/><div className="drawing-tools"><Button variant="ghost" size="icon" aria-label="القلم" title="القلم" onClick={()=>setEraser(false)}><Pencil/></Button><Button variant="ghost" size="icon" aria-label="الممحاة" title="الممحاة" onClick={()=>setEraser(true)}><Eraser/></Button><Button variant="ghost" size="icon" aria-label="مسح الرسم" title="مسح الرسم" onClick={()=>canvas.current?.getContext('2d')?.clearRect(0,0,900,360)}><RotateCcw/></Button></div></>:<h2>{active.category==='acting'?(drawWord?active.question:'تحدّي التمثيل الصامت'):active.question}</h2>}
        {active.category==='acting'&&<Button variant="outline" onClick={()=>setDrawWord(!drawWord)}>{drawWord?'إخفاء الكلمة':'اعرض الكلمة للممثّل'}</Button>}
        {match.revealed&&<div className="answer-reveal"><small>الإجابة الصحيحة</small><strong>{active.answer}</strong></div>}
        <div className="ref-controls"><Button variant="outline" size="icon" title={match.paused?'استئناف':'إيقاف الوقت'} aria-label={match.paused?'استئناف':'إيقاف الوقت'} onClick={()=>setMatch({...match,paused:!match.paused})}>{match.paused?<Play/>:<Pause/>}</Button><Button variant="outline" onClick={()=>setMatch({...match,revealed:!match.revealed})}><BookOpen/>{match.revealed?'إخفاء الإجابة':'كشف الإجابة'}</Button><Button onClick={()=>{beep(850);setMatch(settleQuestion(match,match.stealing?1-match.turn:match.turn))}}><Check/> إجابة صحيحة</Button><Button variant="outline" onClick={wrong}><X/> إجابة خاطئة</Button><Button variant="ghost" size="icon" title="تجاوز السؤال" aria-label="تجاوز السؤال" onClick={()=>setMatch(settleQuestion(match,null))}><SkipForward/></Button></div></section>:<><div className="board-heading"><h2>اختاروا السؤال… وارفعوا الرصيد</h2><span>الدور على {match.teams[match.turn]}</span></div><div className="question-board">{match.categories.map((id,i)=>{const c=categories.find(c=>c.id===id);return <div className="board-column" key={id}><div className="board-photo"><img src={c?.image} alt=""/><span>{c?.name}</span><small>{match.teams[i<3?0:1]}</small></div>{[200,400,600].map(points=><div className="point-pair" key={points}>{match.questions.filter(q=>q.category===id&&q.points===points).map(q=><Button key={q.id} className="point-tile" variant="outline" disabled={match.completed.includes(q.id)} onClick={()=>{beep();setDrawWord(false);setMatch({...match,active:q.id,seconds:60,revealed:false,paused:false})}}>{match.completed.includes(q.id)?<Check/>:points}</Button>)}</div>)}</div>})}</div></>}
    </main>}
    {error&&screen==='home'&&<p className="error-message" role="alert">{error}</p>}
    <footer className="app-footer"><span><strong>RIP.</strong> جمعتكم غير.</span><span>صُنعت لليالي اللي ما بتنتسى <Swords size={13}/></span></footer>
    {dialog&&<div className="dialog-backdrop" onClick={()=>setDialog(null)}><section className="game-dialog" role="dialog" aria-modal="true" aria-label={dialog==='help'?'كيف نلعب؟':'الإعدادات'} onClick={e=>e.stopPropagation()}><Button className="dialog-close" variant="ghost" size="icon" aria-label="إغلاق" onClick={()=>setDialog(null)}><X/></Button>{dialog==='help'?<><BookOpen size={32}/><h2>كيف نلعب؟</h2><ol><li>فريقان، كل فريق يختار ٣ فئات مختلفة.</li><li>لكل فئة ٦ أسئلة: ٢٠٠ و٤٠٠ و٦٠٠، مرتين.</li><li>اختاروا سؤالاً. معكم ٦٠ ثانية للإجابة.</li><li>الخطأ أو انتهاء الوقت يعطي الخصم ٣٠ ثانية للسرقة.</li><li>الحكم يكشف الإجابة ويحدد صحتها. الأكثر نقاطاً يفوز.</li><li>الأسئلة المحجوزة لا تتكرر على هذا الجهاز. عند نفادها اختاروا فئة أخرى.</li><li>تحدّي الرسم والتمثيل: اعرضوا الكلمة للاعب بعيداً عن أعين البقية، ثم أخفوها قبل التخمين.</li></ol></>:<><Settings size={32}/><h2>الإعدادات</h2><div className="setting-row"><span>المؤثرات الصوتية</span><Button variant="outline" size="icon" aria-label="تبديل الصوت" onClick={()=>setSound(!sound)}>{sound?<Volume2/>:<VolumeX/>}</Button></div><label className="setting-row">مستوى الصوت <input type="range" min={0} max={100} value={volume} onChange={e=>setVolume(Number(e.target.value))}/></label><Button variant="outline" onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen()}}><Maximize/> ملء الشاشة</Button></>}</section></div>}
  </div>
}
function Steps({step}:{step:number}){return <div className="steps">{['الفريقان','الفئات','المباراة'].map((label,i)=><span key={label} className={i+1<=step?'step-active':''}><b>{i+1<step?<Check size={14}/>:i+1}</b>{label}{i<2&&<ChevronLeft size={16}/>}</span>)}</div>}
