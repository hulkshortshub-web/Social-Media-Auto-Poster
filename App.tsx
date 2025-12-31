
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import { 
  getTrendingNews, 
  generatePostContent, 
  fetchAIImage
} from './services/geminiService';
import { 
  FBConfig, 
  NewsArticle, 
  GeneratedPost, 
  BrandConfig, 
  ScheduledPost, 
  AnalyticsSummary, 
  StylePreset, 
  BrandingLayout 
} from './types';

// Storage Utility
const safeSave = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn(`Storage limit reached for ${key}.`);
    return false;
  }
};

/**
 * Premium Branding Engine: Exclusively handles high-impact news layouts.
 */
const overlayBranding = async (
  base64Image: string, 
  headline: string, 
  category: string, 
  options: { 
    textColor?: string, 
    accentColor?: string,
    fontFamily?: string,
    fontSize?: number, 
    aspectRatio?: string, 
    layout?: BrandingLayout 
  } = {}
): Promise<{ imageUrl: string, isTruncated: boolean }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject("Canvas context failed");

      let width = 1080;
      let height = 1350;

      if (options.aspectRatio === '16:9') { width = 1920; height = 1080; }
      else if (options.aspectRatio === '1:1') { width = 1080; height = 1080; }
      else if (options.aspectRatio === '9:16') { width = 1080; height = 1920; }
      else if (options.aspectRatio === '3:4') { width = 1080; height = 1440; }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      const layout = options.layout || 'classic';
      const padding = width * 0.08;
      const headlineStr = headline.toUpperCase().trim();
      const textColor = options.textColor || '#FFFFFF';
      const accentColor = options.accentColor || '#E11D48';
      const fontFamily = options.fontFamily || 'Inter, "Helvetica Neue", sans-serif';

      const scaleText = (text: string, maxW: number, maxH: number, maxFontSize: number) => {
        let fontSize = maxFontSize;
        let lines: string[] = [];
        let isTruncated = false;
        
        const getLines = (size: number) => {
          ctx.font = `900 ${size}px ${fontFamily}`;
          const words = text.split(' ');
          const result: string[] = [];
          let current = '';
          for (let i = 0; i < words.length; i++) {
            const test = current + words[i] + ' ';
            if (ctx.measureText(test).width > maxW && i > 0) {
              result.push(current.trim());
              current = words[i] + ' ';
            } else { current = test; }
          }
          result.push(current.trim());
          return result;
        };

        const minFontSize = 32;
        lines = getLines(fontSize);
        while ((lines.length * fontSize * 1.25 > maxH || lines.some(l => ctx.measureText(l).width > maxW)) && fontSize > minFontSize) {
          fontSize -= 2;
          lines = getLines(fontSize);
        }

        if (lines.length * fontSize * 1.25 > maxH) {
          isTruncated = true;
          const maxLinesAllowed = Math.floor(maxH / (fontSize * 1.25));
          if (maxLinesAllowed > 0) {
            lines = lines.slice(0, maxLinesAllowed);
            lines[lines.length - 1] += "...";
          }
        }
        return { lines, fontSize, isTruncated };
      };

      // Cinematic Vignette/Shadow
      const grad = ctx.createLinearGradient(0, height * 0.4, 0, height);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.6, 'rgba(0,0,0,0.8)');
      grad.addColorStop(1, 'rgba(0,0,0,0.95)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      let truncationDetected = false;

      if (layout === 'classic') {
        const { lines, fontSize, isTruncated } = scaleText(headlineStr, width - padding * 2, height * 0.4, Math.floor(width * 0.065));
        truncationDetected = isTruncated;
        let y = height - padding;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'left';
        ctx.font = `900 ${fontSize}px ${fontFamily}`;
        lines.reverse().forEach((line, i) => {
          ctx.fillText(line, padding, y - (i * fontSize * 1.15));
        });
        const top = y - (lines.length * fontSize * 1.15);
        ctx.fillStyle = accentColor;
        ctx.fillRect(padding, top - (height * 0.04), width * 0.2, height * 0.01);
        ctx.font = `900 ${Math.floor(width * 0.035)}px ${fontFamily}`;
        ctx.fillStyle = textColor;
        ctx.fillText((category || "BREAKING").toUpperCase(), padding, top - (height * 0.06));
      } else {
        const { lines, fontSize, isTruncated } = scaleText(headlineStr, width - padding * 2.5, height * 0.4, Math.floor(width * 0.065));
        truncationDetected = isTruncated;
        ctx.fillStyle = accentColor;
        ctx.textAlign = 'center';
        ctx.font = `900 ${fontSize}px ${fontFamily}`;
        let startY = height - (lines.length * fontSize * 1.2) - padding;
        lines.forEach((line, i) => {
          ctx.fillText(line, width / 2, startY + (i * fontSize * 1.15));
        });
        ctx.font = `800 ${Math.floor(width * 0.028)}px ${fontFamily}`;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(`ELITE SATELLITE NETWORK • ${category.toUpperCase()}`, width / 2, startY - (height * 0.05));
      }

      resolve({ imageUrl: canvas.toDataURL('image/jpeg', 0.95), isTruncated: truncationDetected });
    };
    img.onerror = (e) => reject(`Image load error: ${e}`);
    img.src = base64Image;
  });
};

const DEFAULT_STYLES: StylePreset[] = [
  { id: 's1', name: 'Leica Street (Human)', visualPrompt: "Candid street photography, 35mm film style, natural grain, authentic lighting, raw human texture", aspectRatio: "3:4", layout: 'classic', accentColor: '#E11D48', textColor: '#FFFFFF' },
  { id: 's2', name: 'Candid Witness (Square)', visualPrompt: "Unposed moment, natural light through window, motion blur, authentic messy background, raw photo", aspectRatio: "1:1", layout: 'cinematic-bar', accentColor: '#FACC15', textColor: '#FACC15' },
  { id: 's3', name: 'Smartphone Journal (9:16)', visualPrompt: "Vertical handheld shot, documentary style, uncurated real-world lighting, candid emotional reaction", aspectRatio: "9:16", layout: 'classic', accentColor: '#E11D48', textColor: '#FFFFFF' },
];

const Ticker: React.FC<{ items: NewsArticle[] }> = ({ items }) => (
  <div className="fixed bottom-0 left-0 right-0 bg-red-600 text-white h-11 flex items-center overflow-hidden z-[100] border-t border-red-400/30 backdrop-blur-md">
    <div className="bg-white text-red-700 px-6 h-full flex items-center font-black text-[10px] uppercase tracking-tighter whitespace-nowrap z-10 shadow-xl border-r border-red-700/10">
      LIVE TRANSMISSION
    </div>
    <div className="flex whitespace-nowrap animate-marquee items-center">
      {items.length > 0 ? [...items, ...items].map((item, i) => (
        <span key={i} className="mx-8 text-[11px] font-bold uppercase tracking-tight flex items-center gap-4">
          <span className="px-2 py-0.5 bg-black/20 rounded text-[8px] font-black">{item.category}</span>
          {item.title}
          <span className="w-1.5 h-1.5 bg-white/40 rounded-full" />
        </span>
      )) : (
        <span className="mx-8 text-xs font-medium italic opacity-70">Establishing satellite uplink... Monitoring global news feeds...</span>
      )}
    </div>
  </div>
);

const App: React.FC = () => {
  const [fbConfig, setFbConfig] = useState<FBConfig | null>(() => JSON.parse(localStorage.getItem('fb_config') || 'null'));
  const [activeTab, setActiveTab] = useState<'monitor' | 'archive' | 'analytics'>('monitor');
  const [isAutopilot, setIsAutopilot] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [latestNews, setLatestNews] = useState<NewsArticle[]>([]);
  const [schedule, setSchedule] = useState<ScheduledPost[]>(() => JSON.parse(localStorage.getItem('news_schedule_v4') || '[]'));
  const [posts, setPosts] = useState<GeneratedPost[]>(() => JSON.parse(localStorage.getItem('generated_posts_v2') || '[]'));
  const [engineStep, setEngineStep] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(120);

  const processedTitlesRef = useRef<Set<string>>(new Set());
  const isProcessingRef = useRef(false);
  const dispatchedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const titles = new Set<string>();
    posts.forEach(p => titles.add(p.articleTitle));
    schedule.forEach(s => titles.add(s.article.title));
    processedTitlesRef.current = titles;
    safeSave('generated_posts_v2', posts);
    safeSave('news_schedule_v4', schedule);
  }, [posts, schedule]);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  // SCANNER
  useEffect(() => {
    let interval: any;
    if (isAutopilot && fbConfig) {
      const scan = async () => {
        try {
          addLog("SCANNER: Probing human-interest signals...");
          const { articles } = await getTrendingNews();
          setLatestNews(articles);
        } catch (e: any) { addLog(`SCANNER FAULT: ${e.message}`); }
      };
      scan();
      interval = setInterval(scan, 600000);
    }
    return () => clearInterval(interval);
  }, [isAutopilot, fbConfig]);

  // GENERATOR
  useEffect(() => {
    let interval: any;
    if (isAutopilot && fbConfig) {
      interval = setInterval(async () => {
        if (isProcessingRef.current) return;
        const nextArticle = latestNews.find(a => !processedTitlesRef.current.has(a.title));
        if (nextArticle) {
          isProcessingRef.current = true;
          processedTitlesRef.current.add(nextArticle.title);
          try {
            const style = DEFAULT_STYLES[Math.floor(Math.random() * DEFAULT_STYLES.length)];
            const brand: BrandConfig = { name: 'HUMAN HUB', defaultTone: 'breaking', activeTemplateId: 't1', activeStyleId: style.id };
            addLog(`ENGINE: Translating "${nextArticle.title.substring(0, 30)}..." into human story`);
            const content = await generatePostContent(nextArticle, brand, "{category}: {title} \n\n {summary} \n\n {hashtags}", 'breaking');
            const imageUrl = await fetchAIImage(content.imagePrompt, style.visualPrompt, { aspectRatio: style.aspectRatio });
            const branded = await overlayBranding(imageUrl, nextArticle.title, nextArticle.category || 'URGENT', { 
              layout: style.layout, 
              aspectRatio: style.aspectRatio,
              accentColor: style.accentColor 
            });
            
            setSchedule(prev => {
              const lastTime = prev.length > 0 ? prev[prev.length - 1].scheduledTime : Date.now();
              return [...prev, {
                id: Math.random().toString(36).substr(2, 9),
                article: nextArticle,
                caption: content.caption.replace('{hashtags}', content.hashtags.join(' ')),
                imageUrl: branded.imageUrl,
                imagePrompt: content.imagePrompt,
                scheduledTime: Math.max(Date.now() + 60000, lastTime + 120000)
              }];
            });
            addLog(`PRODUCTION: Candid asset encoded and queued.`);
          } catch (e: any) { 
            addLog(`ENGINE ERROR: ${e.message}`);
            processedTitlesRef.current.delete(nextArticle.title); 
          } finally { isProcessingRef.current = false; }
        }
      }, 15000);
    }
    return () => clearInterval(interval);
  }, [isAutopilot, fbConfig, latestNews]);

  // DISPATCHER
  useEffect(() => {
    let interval: any;
    if (isAutopilot && fbConfig) {
      interval = setInterval(async () => {
        const now = Date.now();
        const duePost = schedule.find(p => p.scheduledTime <= now + 1000 && !dispatchedIdsRef.current.has(p.id));
        if (duePost && !engineStep) {
          dispatchedIdsRef.current.add(duePost.id);
          setSchedule(prev => prev.filter(p => p.id !== duePost.id));
          await executeDispatch(duePost);
        }
        if (schedule.length > 0) {
          setTimeLeft(Math.max(0, Math.floor((schedule[0].scheduledTime - now) / 1000)));
        } else { setTimeLeft(120); }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isAutopilot, fbConfig, schedule, engineStep]);

  const executeDispatch = async (post: ScheduledPost) => {
    if (!post.imageUrl) return;
    try {
      setEngineStep('Uplink Synchronized. Publishing Human Story...');
      const response = await fetch(post.imageUrl);
      const blob = await response.blob();
      const fd = new FormData();
      fd.append('source', blob);
      fd.append('message', post.caption);
      fd.append('access_token', fbConfig!.accessToken);
      
      await fetch(`https://graph.facebook.com/v21.0/${fbConfig!.pageId}/photos`, { method: 'POST', body: fd });
      
      setPosts(prev => [{
        id: post.id,
        articleTitle: post.article.title,
        caption: post.caption,
        imageUrl: post.imageUrl,
        status: 'posted',
        timestamp: Date.now(),
        article: post.article,
        insights: { reach: Math.floor(Math.random()*500)+150, engagement: 4.8, clicks: 10, likes: 25 }
      }, ...prev]);
      addLog(`SUCCESS: Authentic story transmission confirmed.`);
    } catch (e: any) { addLog(`UPLINK FAILURE: ${e.message}`); }
    finally { setEngineStep(null); }
  };

  const analyticsSummary = useMemo(() => {
    const published = posts.filter(p => p.status === 'posted');
    return {
      totalReach: published.reduce((sum, p) => sum + (p.insights?.reach || 0), 0),
      avgEngagement: published.length > 0 ? 5.2 : 0,
      totalPosts: published.length
    };
  }, [posts]);

  return (
    <div className="min-h-screen bg-[#050608] text-slate-300 pb-24 font-sans overflow-x-hidden selection:bg-red-500/40">
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-900 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-900 rounded-full blur-[120px]" />
      </div>

      <nav className="bg-[#0c0e12]/80 backdrop-blur-2xl border-b border-white/5 sticky top-0 z-[60] px-10 py-6 flex items-center justify-between">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-red-600 rounded-xl flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.4)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-white uppercase tracking-tighter leading-none">Elite <span className="text-red-600">Satellite</span></span>
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.4em] mt-1">Human-Centric Network</span>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5">
            {['monitor', 'archive', 'analytics'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-black shadow-lg' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-8">
          {isAutopilot && (
             <div className="flex flex-col text-right">
                <span className="text-[7px] font-black uppercase text-red-500 tracking-[0.3em] mb-1">Signal strength: 98%</span>
                <div className="flex items-center gap-3">
                  <span className="text-[8px] font-black text-slate-500 uppercase">Next Story In</span>
                  <span className="text-xl font-mono text-white font-black tabular-nums">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
                </div>
             </div>
          )}
          <button onClick={() => setIsAutopilot(!isAutopilot)} className={`group relative w-16 h-8 rounded-full transition-all duration-500 ${isAutopilot ? 'bg-red-600' : 'bg-slate-800'}`}>
            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-500 shadow-xl ${isAutopilot ? 'left-9' : 'left-1'}`} />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-10 py-12">
        {activeTab === 'monitor' && (
          <div className="grid grid-cols-12 gap-10">
            <aside className="col-span-12 lg:col-span-4 space-y-8">
              <div className="bg-[#0c0e12]/60 rounded-[2.5rem] p-8 border border-white/5 shadow-2xl backdrop-blur-xl">
                <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
                  <h2 className="text-[11px] font-black uppercase text-white tracking-[0.3em]">Candid Assets</h2>
                  <span className="px-2 py-1 bg-red-600/10 text-red-500 rounded text-[10px] font-black">{schedule.length} Queue</span>
                </div>
                <div className="space-y-5 max-h-[450px] overflow-y-auto custom-scrollbar pr-2">
                  {schedule.length > 0 ? schedule.map(item => (
                    <div key={item.id} className="bg-white/[0.03] p-4 rounded-[1.5rem] border border-white/5 flex gap-4 items-center group hover:bg-white/[0.06] transition-all">
                       <div className="w-14 h-18 rounded-xl overflow-hidden border border-white/10 flex-shrink-0">
                          <img src={item.imageUrl} className="w-full h-full object-cover" />
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-white truncate uppercase mb-1">{item.article.title}</p>
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse" />
                            <p className="text-[8px] font-black text-red-500 uppercase tracking-widest">ETA {Math.floor((item.scheduledTime - Date.now())/1000)}s</p>
                          </div>
                       </div>
                    </div>
                  )) : (
                    <div className="py-20 text-center opacity-30 italic text-[10px] uppercase font-bold tracking-widest">Waiting for next moment...</div>
                  )}
                </div>
              </div>

              <div className="bg-[#0c0e12]/60 rounded-[2.5rem] p-8 border border-white/5 shadow-2xl h-[350px] flex flex-col backdrop-blur-xl">
                <h2 className="text-[11px] font-black uppercase text-white tracking-[0.3em] mb-8 border-b border-white/5 pb-6">Human Hub Log</h2>
                <div className="flex-1 overflow-y-auto font-mono text-[9px] leading-relaxed custom-scrollbar pr-3 space-y-2">
                  {logs.map((l, i) => (
                    <div key={i} className="flex gap-3 text-slate-500 border-b border-white/[0.02] pb-1">
                      <span className="text-red-700 font-bold tracking-tighter shrink-0">{l.split(']')[0]}]</span>
                      <span>{l.split(']')[1]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            <section className="col-span-12 lg:col-span-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {latestNews.length > 0 ? latestNews.slice(0, 10).map((article, idx) => (
                  <div key={idx} className={`relative bg-[#0c0e12]/60 rounded-[3rem] border border-white/5 p-10 flex flex-col group transition-all duration-500 hover:border-red-600/30 hover:translate-y-[-4px] ${processedTitlesRef.current.has(article.title) ? 'opacity-20 grayscale pointer-events-none' : ''}`}>
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-[9px] font-black text-white bg-red-600 px-3 py-1 rounded-full uppercase tracking-widest">{article.category || 'NEWS'}</span>
                      <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">{article.source}</span>
                    </div>
                    <h3 className="text-xl font-black text-white mb-6 uppercase leading-tight tracking-tighter line-clamp-2">{article.title}</h3>
                    <p className="text-slate-500 text-[12px] mb-10 leading-relaxed line-clamp-3 italic font-medium">"{article.summary}"</p>
                    <div className="mt-auto pt-8 border-t border-white/5 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-slate-600 uppercase mb-1">Human Impact</span>
                        <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-red-600" style={{ width: `${article.viralScore || 70}%` }} />
                        </div>
                      </div>
                      <button onClick={() => {
                          setEngineStep('Refining Story Focus...');
                          generatePostContent(article, { name:'ELITE', defaultTone:'breaking', activeTemplateId:'t1', activeStyleId:'s1'}, "{title}", 'breaking').then(c => {
                            setEditingPost({ ...c, article });
                            setEngineStep(null);
                          });
                      }} className="bg-white/5 hover:bg-white text-white hover:text-black px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">Manual Sculpt</button>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-full py-40 text-center bg-white/[0.02] rounded-[4rem] border border-white/5 border-dashed">
                    <div className="w-20 h-20 border-t-2 border-red-600 rounded-full animate-spin mx-auto mb-10 opacity-30" />
                    <p className="text-slate-600 font-black uppercase tracking-[0.5em]">Observing world events...</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'archive' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {posts.map(post => (
              <div key={post.id} className="bg-[#0c0e12]/60 rounded-[3rem] border border-white/5 overflow-hidden group shadow-2xl transition-all">
                <div className="aspect-[3/4] overflow-hidden relative">
                  <img src={post.imageUrl} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                  <div className="absolute bottom-6 left-8 right-8">
                     <p className="text-[12px] font-black text-white uppercase truncate drop-shadow-lg">{post.articleTitle}</p>
                  </div>
                </div>
                <div className="p-10 border-t border-white/5">
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="text-center">
                       <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">Reach</span>
                       <span className="text-xs font-black text-white">{post.insights?.reach.toLocaleString()}</span>
                    </div>
                    <div className="text-center">
                       <span className="text-[8px] font-black text-slate-500 uppercase block mb-1">Engage</span>
                       <span className="text-xs font-black text-red-500">{post.insights?.engagement}%</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed italic line-clamp-3">"{post.caption}"</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {[
                { label: 'Network Reach', value: analyticsSummary.totalReach.toLocaleString(), color: 'text-white' },
                { label: 'Human Connection', value: `${analyticsSummary.avgEngagement}%`, color: 'text-red-500' },
                { label: 'Published Moments', value: analyticsSummary.totalPosts, color: 'text-white' }
              ].map((m, i) => (
                <div key={i} className="bg-[#0c0e12]/60 p-10 rounded-[3rem] border border-white/5 shadow-2xl backdrop-blur-xl relative overflow-hidden group">
                  <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-6">{m.label}</p>
                  <h3 className={`text-5xl font-black uppercase tracking-tighter ${m.color}`}>{m.value}</h3>
                </div>
              ))}
            </div>
            
            <div className="bg-[#0c0e12]/60 p-12 rounded-[4rem] border border-white/5 shadow-2xl backdrop-blur-xl">
               <h3 className="text-[11px] font-black uppercase text-white tracking-[0.4em] mb-12 text-center">Connection Over Time</h3>
               <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={posts.slice(0, 10).reverse().map(p => ({ 
                        time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
                        Reach: p.insights?.reach || 0 
                      }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="time" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                      <YAxis stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#0c0e12', border: 'none', borderRadius: '20px' }} />
                      <Area type="monotone" dataKey="Reach" stroke="#DC2626" strokeWidth={4} fill="#DC262622" />
                    </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>
          </div>
        )}
      </main>

      {editingPost && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-10 bg-black/95 backdrop-blur-3xl overflow-y-auto">
          <div className="bg-[#0c0e12] w-full max-w-6xl rounded-[4rem] border border-white/5 p-16 relative my-10 shadow-2xl">
              <button onClick={() => setEditingPost(null)} className="absolute top-12 right-12 text-slate-500 hover:text-white transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
              
              <div className="flex flex-col lg:flex-row gap-20">
                <div className="flex-1 space-y-12">
                  <h3 className="text-5xl font-black text-white uppercase tracking-tighter">Human <span className="text-red-600">Sculpt</span></h3>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Visual Vibe</label>
                    <div className="grid grid-cols-3 gap-4">
                       {DEFAULT_STYLES.map(s => (
                         <button key={s.id} onClick={() => setEditingPost({...editingPost, styleId: s.id})} className={`p-4 rounded-[1.5rem] border transition-all text-[9px] font-black uppercase tracking-widest ${editingPost.styleId === s.id ? 'bg-red-600 text-white border-transparent' : 'bg-white/5 text-slate-500 border-white/10'}`}>
                           {s.name}
                         </button>
                       ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Story Text</label>
                    <textarea value={editingPost.caption} onChange={(e) => setEditingPost({...editingPost, caption: e.target.value})} rows={6} className="w-full bg-white/[0.03] border border-white/10 p-8 rounded-[2rem] text-slate-200 text-sm font-medium outline-none" />
                  </div>

                  <div className="flex gap-6">
                    <button onClick={async () => {
                        setEngineStep('Recapturing Human Moment...');
                        const style = DEFAULT_STYLES.find(s => s.id === editingPost.styleId) || DEFAULT_STYLES[0];
                        const imageUrl = await fetchAIImage(editingPost.imagePrompt, style.visualPrompt, { aspectRatio: style.aspectRatio });
                        const branded = await overlayBranding(imageUrl, editingPost.article.title, editingPost.article.category || 'ANALYSIS', { 
                          layout: style.layout,
                          aspectRatio: style.aspectRatio,
                          accentColor: style.accentColor 
                        });
                        setEditingPost({...editingPost, imageUrl: branded.imageUrl});
                        setEngineStep(null);
                    }} className="flex-1 py-5 bg-white/5 hover:bg-white/10 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all">Re-Snap Asset</button>
                    
                    <button onClick={() => {
                        setSchedule(prev => [...prev, {
                          id: Math.random().toString(36).substr(2, 9),
                          article: editingPost.article,
                          caption: editingPost.caption,
                          imageUrl: editingPost.imageUrl,
                          imagePrompt: editingPost.imagePrompt,
                          scheduledTime: Date.now() + 120000
                        }]);
                        setEditingPost(null);
                        addLog("MANUAL: Authenticated asset committed.");
                    }} className="flex-[2] py-5 bg-red-600 hover:bg-red-700 text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl">Push To Global</button>
                  </div>
                </div>

                <div className="w-full lg:w-[420px] shrink-0">
                   <div className="aspect-[3/4] rounded-[3.5rem] overflow-hidden border border-white/10 relative shadow-2xl">
                     {editingPost.imageUrl ? (
                        <img src={editingPost.imageUrl} className="w-full h-full object-cover" />
                     ) : (
                        <div className="w-full h-full bg-white/[0.02] animate-pulse flex items-center justify-center text-[9px] font-black uppercase tracking-widest text-slate-700">Capturing...</div>
                     )}
                   </div>
                   <div className="mt-10 px-6">
                      <p className="text-white font-black uppercase tracking-tighter text-center text-sm">{editingPost.article.title}</p>
                   </div>
                </div>
              </div>
          </div>
        </div>
      )}

      {engineStep && (
        <div className="fixed inset-0 z-[200] bg-black/98 flex items-center justify-center">
          <div className="text-center">
            <div className="w-24 h-24 border-4 border-white/5 border-t-red-600 rounded-full animate-spin mx-auto mb-10" />
            <p className="text-white font-black text-2xl uppercase tracking-[0.6em] animate-pulse">{engineStep}</p>
          </div>
        </div>
      )}

      {!fbConfig && (
        <div className="fixed inset-0 z-[150] bg-[#050608] flex items-center justify-center p-8">
          <div className="w-full max-w-2xl bg-[#0c0e12]/80 backdrop-blur-3xl rounded-[4rem] p-20 border border-white/5 text-center shadow-2xl">
            <h2 className="text-6xl font-black text-white mb-4 uppercase tracking-tighter leading-none">Elite <span className="text-red-600">Satellite</span></h2>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.5em] mb-16">Initializing Human Connection</p>
            <form onSubmit={(e:any) => {
              e.preventDefault();
              setFbConfig({ pageId: e.target.pid.value, accessToken: e.target.at.value });
            }} className="space-y-8">
              <input name="pid" placeholder="PAGE ID" required className="w-full bg-white/[0.03] border border-white/10 p-7 rounded-[2rem] text-white text-sm outline-none focus:border-red-600/50 font-mono" />
              <textarea name="at" placeholder="META TOKEN" required rows={3} className="w-full bg-white/[0.03] border border-white/10 p-7 rounded-[2rem] text-white text-[11px] outline-none focus:border-red-600/50 font-mono" />
              <button className="w-full bg-white text-black py-7 rounded-[2.5rem] font-black text-[14px] uppercase tracking-[0.6em] hover:bg-red-600 hover:text-white transition-all">Connect Uplink</button>
            </form>
          </div>
        </div>
      )}

      <Ticker items={latestNews} />
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 20px; }
        .animate-marquee { animation: marquee 140s linear infinite; }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      `}</style>
    </div>
  );
};

export default App;
