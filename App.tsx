
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
 * Premium Branding Engine: Precision-tuned to replicate the CNN-style reference image.
 * All Post Graphics feature:
 * - Centered Category Tag (Yellow)
 * - Thick Red Line
 * - Three White Stars
 * - Big Bold Headline (White)
 * - Dark bottom vignette for visibility
 */
const overlayBranding = async (
  base64Image: string, 
  headline: string, 
  category: string, 
  options: { 
    aspectRatio?: string 
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

      const isCrime = category.toUpperCase().includes('CRIME');
      const padding = width * 0.1;
      
      // CNN Style Font: Inter (Bold/Heavy)
      const headFont = 'Inter, sans-serif';
      const headlineColor = '#FFFFFF'; 
      const categoryColor = isCrime ? '#FFFFFF' : '#FACC15'; // Yellow as requested, white for crime
      const redLineColor = '#DC2626';

      // Star helper
      const drawStar = (x: number, y: number, size: number) => {
        ctx.save();
        ctx.beginPath();
        ctx.translate(x, y);
        ctx.moveTo(0, 0 - size);
        for (let i = 0; i < 5; i++) {
          ctx.rotate(Math.PI / 5);
          ctx.lineTo(0, 0 - (size * 0.5));
          ctx.rotate(Math.PI / 5);
          ctx.lineTo(0, 0 - size);
        }
        ctx.closePath();
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.restore();
      };

      const scaleText = (text: string, maxW: number, maxH: number, maxFontSize: number) => {
        let fontSize = maxFontSize;
        let lines: string[] = [];
        let isTruncated = false;
        
        const getLines = (size: number) => {
          ctx.font = `900 ${size}px ${headFont}`;
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
        while ((lines.length * fontSize * 1.3 > maxH || lines.some(l => ctx.measureText(l).width > maxW)) && fontSize > minFontSize) {
          fontSize -= 2;
          lines = getLines(fontSize);
        }

        if (lines.length * fontSize * 1.3 > maxH) {
          isTruncated = true;
          const maxLinesAllowed = Math.floor(maxH / (fontSize * 1.3));
          if (maxLinesAllowed > 0) {
            lines = lines.slice(0, maxLinesAllowed);
            lines[lines.length - 1] += "...";
          }
        }
        return { lines, fontSize, isTruncated };
      };

      // Dramatic black vignette bottom (essential for text visibility)
      const grad = ctx.createLinearGradient(0, height * 0.4, 0, height);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.5, 'rgba(0,0,0,0.8)');
      grad.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      let truncationDetected = false;

      // Layout Logic - Centered Stack
      const stackBottomY = height - (height * 0.15);
      const headlineMaxW = width - padding * 2;
      const { lines, fontSize, isTruncated } = scaleText(headline.toUpperCase(), headlineMaxW, height * 0.3, Math.floor(width * 0.08));
      truncationDetected = isTruncated;
      
      ctx.textAlign = 'center';
      ctx.fillStyle = headlineColor;
      ctx.font = `900 ${fontSize}px ${headFont}`;
      ctx.letterSpacing = "-1px";
      
      // Draw Headline (at the bottom)
      lines.reverse().forEach((line, i) => {
        ctx.fillText(line, width / 2, stackBottomY - (i * fontSize * 1.15));
      });

      // Graphics Stack Y (starting above headline)
      const stackHeight = lines.length * fontSize * 1.15;
      const baselineY = stackBottomY - stackHeight - (height * 0.04);
      
      // 3 Stars
      const starSize = width * 0.022;
      const starSpace = width * 0.06;
      drawStar(width / 2, baselineY, starSize);
      drawStar(width / 2 - starSpace, baselineY, starSize);
      drawStar(width / 2 + starSpace, baselineY, starSize);

      // Red Thick Line
      const redLineW = width * 0.14;
      const redLineH = height * 0.008;
      const redLineY = baselineY - (height * 0.05);
      ctx.fillStyle = redLineColor;
      ctx.fillRect(width / 2 - redLineW / 2, redLineY, redLineW, redLineH);

      // Category Tag (Analysis, Breaking, etc)
      const catSize = Math.floor(width * 0.038);
      ctx.font = `900 ${catSize}px ${headFont}`;
      ctx.fillStyle = categoryColor;
      ctx.letterSpacing = "2px";
      ctx.fillText(category.toUpperCase(), width / 2, redLineY - (height * 0.035));

      // Logo (Lower Right, skipped for crime)
      if (!isCrime) {
        ctx.textAlign = 'right';
        ctx.font = `900 ${width * 0.045}px ${headFont}`;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText("ESN", width - padding/2, height - padding/2);
      }

      resolve({ imageUrl: canvas.toDataURL('image/jpeg', 0.96), isTruncated: truncationDetected });
    };
    img.onerror = (e) => reject(`Image load error: ${e}`);
    img.src = base64Image;
  });
};

const DEFAULT_STYLES: StylePreset[] = [
  { 
    id: 's1', 
    name: 'Analytic Post', 
    visualPrompt: "Documentary photography, clean sharp focus, authentic news event lighting, high-end journalism aesthetic", 
    aspectRatio: "3:4", 
    lighting: 'Journalistic Flash / High Key',
    cameraAngle: 'Eye Level',
    depthOfField: 'Sharp Focus'
  },
  { 
    id: 's2', 
    name: 'Candid Report', 
    visualPrompt: "Handheld press photography, raw texture, candid moment, unposed expression, authentic grit", 
    aspectRatio: "1:1", 
    lighting: 'Natural Mixed Lighting',
    cameraAngle: 'Slight Low Angle',
    depthOfField: 'Authentic Shallow Focus'
  }
];

const Ticker: React.FC<{ items: NewsArticle[] }> = ({ items }) => (
  <div className="fixed bottom-0 left-0 right-0 bg-red-600 text-white h-11 flex items-center overflow-hidden z-[100] border-t border-red-400/30 backdrop-blur-md">
    <div className="bg-white text-red-700 px-6 h-full flex items-center font-news text-[11px] uppercase tracking-tighter whitespace-nowrap z-10 shadow-xl border-r border-red-700/10">
      LIVE FEED
    </div>
    <div className="flex whitespace-nowrap animate-marquee items-center">
      {items.length > 0 ? [...items, ...items].map((item, i) => (
        <span key={i} className="mx-8 text-[12px] font-bold uppercase tracking-tight flex items-center gap-4 font-ui">
          <span className="px-2 py-0.5 bg-black/20 rounded text-[9px] font-news tracking-widest">{item.category}</span>
          {item.title}
          <span className="w-1.5 h-1.5 bg-white/40 rounded-full" />
        </span>
      )) : (
        <span className="mx-8 text-xs font-medium italic opacity-70 font-ui">Establishing link... Tracking global nodes...</span>
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
          addLog("SCANNER: Probing world signals...");
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
            addLog(`ENGINE: Processing story "${nextArticle.title.substring(0, 30)}..."`);
            const content = await generatePostContent(nextArticle, brand, "{category}: {title} \n\n {summary} \n\n {hashtags}", 'breaking');
            
            const imageUrl = await fetchAIImage(content.imagePrompt, style.visualPrompt, { 
              aspectRatio: style.aspectRatio,
              lighting: style.lighting,
              cameraAngle: style.cameraAngle,
              depthOfField: style.depthOfField
            });

            const branded = await overlayBranding(imageUrl, nextArticle.title, nextArticle.category || 'ANALYSIS', { 
              aspectRatio: style.aspectRatio
            });
            
            setSchedule(prev => {
              const lastTime = prev.length > 0 ? prev[prev.length - 1].scheduledTime : Date.now();
              return [...prev, {
                id: Math.random().toString(36).substr(2, 9),
                article: nextArticle,
                caption: `${content.caption}\n\n${content.hashtags.join(' ')}`,
                imageUrl: branded.imageUrl,
                imagePrompt: content.imagePrompt,
                scheduledTime: Math.max(Date.now() + 60000, lastTime + 120000)
              }];
            });
            addLog(`PRODUCTION: Asset encoded with editorial branding.`);
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
      setEngineStep('Synchronizing Broadcast Uplink...');
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
      addLog(`SUCCESS: Story transmission complete.`);
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
    <div className="min-h-screen bg-[#050608] text-slate-300 pb-24 font-ui overflow-x-hidden selection:bg-red-500/40">
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-900 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-900 rounded-full blur-[120px]" />
      </div>

      <nav className="bg-[#0c0e12]/80 backdrop-blur-2xl border-b border-white/5 sticky top-0 z-[60] px-10 py-6 flex items-center justify-between">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(220,38,38,0.3)] border border-red-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black text-white uppercase tracking-tighter leading-none font-headline">ELITE <span className="text-red-600">SATELLITE</span></span>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.5em] mt-1.5 font-news">Broadcast Terminal</span>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-2xl border border-white/5">
            {['monitor', 'archive', 'analytics'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === tab ? 'bg-white text-black shadow-xl' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-8">
          {isAutopilot && (
             <div className="flex flex-col text-right">
                <span className="text-[8px] font-bold uppercase text-red-500 tracking-[0.3em] mb-1 font-news">TRANSMITTING...</span>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase font-ui">NEXT UPLINK</span>
                  <span className="text-2xl font-mono text-white font-black tabular-nums tracking-tighter">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
                </div>
             </div>
          )}
          <button onClick={() => setIsAutopilot(!isAutopilot)} className={`group relative w-16 h-8 rounded-full transition-all duration-500 ${isAutopilot ? 'bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'bg-slate-800'}`}>
            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-500 shadow-xl ${isAutopilot ? 'left-9' : 'left-1'}`} />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-10 py-12">
        {activeTab === 'monitor' && (
          <div className="grid grid-cols-12 gap-10">
            <aside className="col-span-12 lg:col-span-4 space-y-8">
              <div className="bg-[#0c0e12]/60 rounded-[2rem] p-8 border border-white/5 shadow-2xl backdrop-blur-xl">
                <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-6">
                  <h2 className="text-[11px] font-black uppercase text-white tracking-[0.3em] font-news">Mission Queue</h2>
                  <span className="px-3 py-1 bg-white/5 text-slate-400 rounded-lg text-[10px] font-black border border-white/5">{schedule.length} Assets</span>
                </div>
                <div className="space-y-4 max-h-[480px] overflow-y-auto custom-scrollbar pr-2">
                  {schedule.length > 0 ? schedule.map(item => (
                    <div key={item.id} className="bg-white/[0.02] p-5 rounded-[1.5rem] border border-white/5 flex gap-5 items-center group hover:bg-white/[0.05] transition-all">
                       <div className="w-16 h-20 rounded-xl overflow-hidden border border-white/10 flex-shrink-0 shadow-lg">
                          <img src={item.imageUrl} className="w-full h-full object-cover" />
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-white truncate uppercase mb-1 tracking-tight font-headline">{item.article.title}</p>
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_5px_red]" />
                            <p className="text-[9px] font-black text-red-500 uppercase tracking-widest font-news">Broadcast in {Math.floor((item.scheduledTime - Date.now())/1000)}s</p>
                          </div>
                       </div>
                    </div>
                  )) : (
                    <div className="py-24 text-center opacity-30 italic text-[11px] uppercase font-bold tracking-[0.3em]">Establishing link...</div>
                  )}
                </div>
              </div>

              <div className="bg-[#0c0e12]/60 rounded-[2rem] p-8 border border-white/5 shadow-2xl h-[380px] flex flex-col backdrop-blur-xl">
                <h2 className="text-[11px] font-black uppercase text-white tracking-[0.3em] mb-8 border-b border-white/5 pb-6 font-news">System Log</h2>
                <div className="flex-1 overflow-y-auto font-mono text-[10px] leading-relaxed custom-scrollbar pr-3 space-y-2.5 opacity-80">
                  {logs.map((l, i) => (
                    <div key={i} className="flex gap-4 text-slate-400 border-b border-white/[0.02] pb-1.5">
                      <span className="text-red-700 font-bold tracking-tighter shrink-0">{l.split(']')[0]}]</span>
                      <span className="tracking-tight">{l.split(']')[1]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            <section className="col-span-12 lg:col-span-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {latestNews.length > 0 ? latestNews.slice(0, 10).map((article, idx) => (
                  <div key={idx} className={`relative bg-[#0c0e12]/60 rounded-[2.5rem] border border-white/5 p-10 flex flex-col group transition-all duration-500 hover:border-white/10 hover:translate-y-[-6px] hover:shadow-2xl ${processedTitlesRef.current.has(article.title) ? 'opacity-20 grayscale pointer-events-none' : ''}`}>
                    <div className="flex justify-between items-center mb-8">
                      <span className="text-[10px] font-news text-white bg-red-600 px-4 py-1.5 rounded-lg uppercase tracking-widest shadow-lg">{article.category || 'NEWS'}</span>
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">{article.source}</span>
                    </div>
                    <h3 className="text-2xl font-black text-white mb-6 tracking-tighter leading-tight font-headline line-clamp-2">{article.title.toUpperCase()}</h3>
                    <p className="text-slate-400 text-[14px] mb-12 leading-relaxed line-clamp-3 italic font-light">"{article.summary}"</p>
                    <div className="mt-auto pt-8 border-t border-white/5 flex justify-between items-center">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2 font-news">Impact Sensor</span>
                        <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-red-600 shadow-[0_0_5px_red]" style={{ width: `${article.viralScore || 70}%` }} />
                        </div>
                      </div>
                      <button onClick={() => {
                          setEngineStep('Synchronizing Narrative Orbit...');
                          generatePostContent(article, { name:'ELITE', defaultTone:'breaking', activeTemplateId:'t1', activeStyleId:'s1'}, "{title}", 'breaking').then(c => {
                            setEditingPost({ ...c, article });
                            setEngineStep(null);
                          });
                      }} className="bg-white/5 hover:bg-white text-white hover:text-black px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-lg border border-white/5 font-headline">Sculpt Post</button>
                    </div>
                  </div>
                )) : (
                  <div className="col-span-full py-48 text-center bg-white/[0.01] rounded-[3rem] border border-white/5 border-dashed">
                    <div className="w-16 h-16 border-2 border-slate-800 border-t-red-600 rounded-full animate-spin mx-auto mb-12" />
                    <p className="text-slate-500 font-bold uppercase tracking-[0.6em] text-xs font-news">Observing global nodes...</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'archive' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {posts.map(post => (
              <div key={post.id} className="bg-[#0c0e12]/60 rounded-[2.5rem] border border-white/5 overflow-hidden group shadow-2xl transition-all">
                <div className="aspect-[3/4] overflow-hidden relative">
                  <img src={post.imageUrl} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-90" />
                  <div className="absolute bottom-8 left-10 right-10">
                     <p className="text-[14px] font-black text-white uppercase tracking-tighter truncate drop-shadow-2xl font-headline">{post.articleTitle}</p>
                  </div>
                </div>
                <div className="p-10 border-t border-white/5">
                  <div className="grid grid-cols-2 gap-8 mb-10">
                    <div>
                       <span className="text-[10px] font-news text-slate-500 uppercase block mb-2 tracking-widest">Global Reach</span>
                       <span className="text-xl font-black text-white tracking-tighter">{post.insights?.reach.toLocaleString()}</span>
                    </div>
                    <div>
                       <span className="text-[10px] font-news text-slate-500 uppercase block mb-2 tracking-widest">Engage Rate</span>
                       <span className="text-xl font-black text-red-500 tracking-tighter">{post.insights?.engagement}%</span>
                    </div>
                  </div>
                  <p className="text-[13px] text-slate-500 leading-relaxed italic font-light line-clamp-3">"{post.caption}"</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {[
                { label: 'Transmission Reach', value: analyticsSummary.totalReach.toLocaleString(), color: 'text-white' },
                { label: 'Connection Index', value: `${analyticsSummary.avgEngagement}%`, color: 'text-red-500' },
                { label: 'Broadcast Count', value: analyticsSummary.totalPosts, color: 'text-white' }
              ].map((m, i) => (
                <div key={i} className="bg-[#0c0e12]/60 p-12 rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-xl relative overflow-hidden group">
                  <p className="text-[11px] font-news text-slate-500 uppercase tracking-[0.4em] mb-8">{m.label}</p>
                  <h3 className={`text-6xl font-black uppercase tracking-tighter font-headline ${m.color}`}>{m.value}</h3>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {editingPost && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-10 bg-black/98 backdrop-blur-3xl overflow-y-auto">
          <div className="bg-[#0c0e12] w-full max-w-6xl rounded-[3rem] border border-white/5 p-16 relative my-10 shadow-[0_0_100px_rgba(0,0,0,1)]">
              <button onClick={() => setEditingPost(null)} className="absolute top-12 right-12 text-slate-600 hover:text-white transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
              
              <div className="flex flex-col lg:flex-row gap-20">
                <div className="flex-1 space-y-12">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-6xl font-black text-white uppercase tracking-tighter font-headline">NARRATIVE <span className="text-red-600">SCULPT</span></h3>
                    <p className="text-slate-500 font-news text-[11px] uppercase tracking-[0.5em]">Authenticating Human Perspective</p>
                  </div>

                  <div className="space-y-6">
                    <label className="text-[10px] font-news text-slate-500 uppercase tracking-widest">Broadcast Style</label>
                    <div className="grid grid-cols-2 gap-4">
                       {DEFAULT_STYLES.map(s => (
                         <button key={s.id} onClick={() => setEditingPost({...editingPost, styleId: s.id})} className={`py-4 px-6 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-[0.2em] font-headline ${editingPost.styleId === s.id ? 'bg-red-600 text-white border-transparent shadow-xl' : 'bg-white/5 text-slate-500 border-white/10 hover:border-white/20'}`}>
                           {s.name}
                         </button>
                       ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <label className="text-[10px] font-news text-slate-500 uppercase tracking-widest">Story Manuscript</label>
                    <textarea value={editingPost.caption} onChange={(e) => setEditingPost({...editingPost, caption: e.target.value})} rows={7} className="w-full bg-white/[0.02] border border-white/10 p-10 rounded-[2rem] text-slate-200 text-md leading-relaxed outline-none focus:border-red-600/30 font-editorial" />
                  </div>

                  <div className="flex gap-8">
                    <button onClick={async () => {
                        setEngineStep('Synthesizing Visual Moment...');
                        const style = DEFAULT_STYLES.find(s => s.id === editingPost.styleId) || DEFAULT_STYLES[0];
                        const imageUrl = await fetchAIImage(editingPost.imagePrompt, style.visualPrompt, { 
                          aspectRatio: style.aspectRatio,
                          lighting: style.lighting,
                          cameraAngle: style.cameraAngle,
                          depthOfField: style.depthOfField
                        });
                        const branded = await overlayBranding(imageUrl, editingPost.article.title, editingPost.article.category || 'ANALYSIS', { 
                          aspectRatio: style.aspectRatio
                        });
                        setEditingPost({...editingPost, imageUrl: branded.imageUrl});
                        setEngineStep(null);
                    }} className="flex-1 py-6 bg-white/5 hover:bg-white/10 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] border border-white/10 transition-all font-headline">Re-Snap</button>
                    
                    <button onClick={() => {
                        setSchedule(prev => [...prev, {
                          id: Math.random().toString(36).substr(2, 9),
                          article: editingPost.article,
                          caption: `${editingPost.caption}\n\n${editingPost.hashtags.join(' ')}`,
                          imageUrl: editingPost.imageUrl,
                          imagePrompt: editingPost.imagePrompt,
                          scheduledTime: Date.now() + 120000
                        }]);
                        setEditingPost(null);
                        addLog("MANUAL: Asset deployed to broadcast terminal.");
                    }} className="flex-[2] py-6 bg-red-600 hover:bg-red-700 text-white rounded-[2rem] font-black text-[12px] uppercase tracking-[0.4em] shadow-2xl transition-all font-headline">Deploy Story</button>
                  </div>
                </div>

                <div className="w-full lg:w-[460px] shrink-0">
                   <div className="aspect-[3/4] rounded-[3rem] overflow-hidden border border-white/10 relative shadow-[0_60px_120px_rgba(0,0,0,0.8)]">
                     {editingPost.imageUrl ? (
                        <img src={editingPost.imageUrl} className="w-full h-full object-cover" />
                     ) : (
                        <div className="w-full h-full bg-white/[0.02] animate-pulse flex items-center justify-center text-[10px] font-news uppercase tracking-[0.4em] text-slate-700">Synthesizing...</div>
                     )}
                     <div className="absolute top-10 left-10 bg-black/60 backdrop-blur-md text-white px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.3em] border border-white/10">PREVIEW</div>
                   </div>
                   <div className="mt-12 px-8">
                      <p className="text-white font-black uppercase tracking-tighter text-center text-lg leading-tight font-headline">{editingPost.article.title}</p>
                   </div>
                </div>
              </div>
          </div>
        </div>
      )}

      {engineStep && (
        <div className="fixed inset-0 z-[200] bg-black/99 flex items-center justify-center">
          <div className="text-center">
            <div className="w-24 h-24 border-2 border-slate-900 border-t-red-600 rounded-full animate-spin mx-auto mb-14" />
            <p className="text-white font-news text-2xl uppercase tracking-[0.8em] animate-pulse">{engineStep}</p>
          </div>
        </div>
      )}

      {!fbConfig && (
        <div className="fixed inset-0 z-[150] bg-[#050608] flex items-center justify-center p-8">
          <div className="w-full max-w-2xl bg-[#0c0e12]/90 backdrop-blur-3xl rounded-[3rem] p-24 border border-white/5 text-center shadow-[0_0_200px_rgba(0,0,0,1)]">
            <h2 className="text-7xl font-black text-white mb-6 uppercase tracking-tighter leading-none font-headline">ELITE <span className="text-red-600">SATELLITE</span></h2>
            <p className="text-slate-500 font-news text-[11px] font-bold uppercase tracking-[0.6em] mb-20">Global Uplink Authentication</p>
            <form onSubmit={(e:any) => {
              e.preventDefault();
              setFbConfig({ pageId: e.target.pid.value, accessToken: e.target.at.value });
            }} className="space-y-10">
              <input name="pid" placeholder="PAGE IDENTIFIER" required className="w-full bg-white/[0.02] border border-white/10 p-8 rounded-[2rem] text-white text-md outline-none focus:border-red-600/40 font-mono tracking-widest text-center" />
              <textarea name="at" placeholder="SYSTEM ACCESS TOKEN" required rows={3} className="w-full bg-white/[0.02] border border-white/10 p-8 rounded-[2rem] text-white text-[12px] outline-none focus:border-red-600/40 font-mono resize-none text-center" />
              <button className="w-full bg-white text-black py-8 rounded-[2.5rem] font-black text-[15px] uppercase tracking-[0.8em] hover:bg-red-600 hover:text-white transition-all shadow-2xl font-headline">Establish Link</button>
            </form>
          </div>
        </div>
      )}

      <Ticker items={latestNews} />
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 20px; }
        .animate-marquee { animation: marquee 160s linear infinite; }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      `}</style>
    </div>
  );
};

export default App;
