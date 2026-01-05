
import React, { useState, useEffect, useRef } from 'react';
import { 
  getTrendingNews, 
  generatePostContent, 
  fetchAIImage
} from './services/geminiService';
import { 
  FBConfig, 
  NewsArticle, 
  GeneratedPost,
  ScheduledPost
} from './types';

const FB_BLUE = '#1877F2';
const NEWS_RED = '#EF4444';
const PARENTING_GREEN = '#10B981';
const PARENTING_GOLD = '#F59E0B';
const APP_NAME = "US NEWS & PARENTING";
const POST_INTERVAL = 120000; // 2 minutes for autopilot

const safeSave = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
};

const getSafeLocalStorage = (key: string) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (e) { return null; }
};

const base64ToBlob = (base64: string): Blob => {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
};

/**
 * Generates a branded image for social media posts.
 * Dynamically selects templates based on the category.
 */
const generatePostImage = async (
  base64Image: string, 
  headline: string, 
  highlightWords: string[] = [],
  options: { aspectRatio?: string, category?: string } = {}
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject("Canvas failure");

      // Dimensions based on aspect ratio
      let width = 1080;
      let height = 1350; // Standard 4:5
      if (options.aspectRatio === '1:1') height = 1080;

      canvas.width = width;
      canvas.height = height;

      // Draw original image
      ctx.drawImage(img, 0, 0, width, height);

      const isParenting = options.category?.toLowerCase() === 'parenting';
      
      // TEMPLATE SELECTION
      const template = isParenting ? {
        primary: PARENTING_GREEN,
        accent: PARENTING_GOLD,
        gradientStart: 'rgba(6, 78, 59, 0)', // Dark emerald transparent
        gradientEnd: 'rgba(2, 44, 34, 0.95)',
        badgeText: "PARENTING HUB",
        borderRadius: 20
      } : {
        primary: FB_BLUE,
        accent: NEWS_RED,
        gradientStart: 'rgba(30, 58, 138, 0)', // Deep blue transparent
        gradientEnd: 'rgba(15, 23, 42, 0.98)',
        badgeText: "BREAKING NEWS",
        borderRadius: 4
      };

      // Bottom Gradient Overlay for readability
      const grad = ctx.createLinearGradient(0, height * 0.3, 0, height);
      grad.addColorStop(0, template.gradientStart);
      grad.addColorStop(0.7, template.gradientEnd);
      grad.addColorStop(1, 'black');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const headFont = 'Outfit, sans-serif';

      // Category Badge (Top Left)
      ctx.fillStyle = template.primary;
      // Draw rounded/sharp rect based on template
      const bWidth = 320;
      const bHeight = 70;
      const bx = 50;
      const by = 50;
      
      if (isParenting) {
        ctx.beginPath();
        ctx.roundRect(bx, by, bWidth, bHeight, template.borderRadius);
        ctx.fill();
      } else {
        ctx.fillRect(bx, by, bWidth, bHeight);
      }

      ctx.fillStyle = 'white';
      ctx.font = `900 24px ${headFont}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(template.badgeText, bx + (bWidth / 2), by + (bHeight / 2));

      // HEADLINE RENDERING
      const fontSize = Math.floor(width * 0.08);
      ctx.font = `900 ${fontSize}px ${headFont}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      
      const words = headline.toUpperCase().split(' ');
      const lines: string[][] = [];
      let currentLine: string[] = [];
      const maxW = width * 0.9; 

      words.forEach(word => {
        const testLine = [...currentLine, word].join(' ');
        if (ctx.measureText(testLine).width > maxW) {
          lines.push(currentLine);
          currentLine = [word];
        } else {
          currentLine.push(word);
        }
      });
      lines.push(currentLine);

      const lineHeight = fontSize * 1.05;
      let y = height - (lines.length * lineHeight) - 100;

      lines.forEach(line => {
        let x = 50;
        line.forEach(word => {
          const cleanWord = word.replace(/[^\w]/g, '');
          const isHighlight = highlightWords.some(hw => 
            hw.toUpperCase().replace(/[^\w]/g, '') === cleanWord
          );

          // Shadow for text depth
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 15;
          ctx.shadowOffsetX = 4;
          ctx.shadowOffsetY = 4;

          ctx.fillStyle = isHighlight ? template.accent : 'white';
          ctx.fillText(word, x, y);
          
          // Reset shadow for measurements
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          
          x += ctx.measureText(word + ' ').width;
        });
        y += lineHeight;
      });

      resolve(canvas.toDataURL('image/jpeg', 0.95));
    };
    img.onerror = () => reject("Image loading failed");
    img.src = base64Image;
  });
};

const App: React.FC = () => {
  const [fbConfig, setFbConfig] = useState<FBConfig | null>(() => getSafeLocalStorage('fb_config'));
  const [activeTab, setActiveTab] = useState<'monitor' | 'scheduled' | 'archive' | 'settings'>('monitor');
  const [isAutopilot, setIsAutopilot] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [latestNews, setLatestNews] = useState<NewsArticle[]>([]);
  const [posts, setPosts] = useState<GeneratedPost[]>(() => getSafeLocalStorage('generated_posts_live') || []);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>(() => getSafeLocalStorage('scheduled_posts_v1') || []);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [schedulingPost, setSchedulingPost] = useState<any | null>(null);
  
  const [processedArticles, setProcessedArticles] = useState<Set<string>>(() => {
    const saved = getSafeLocalStorage('processed_v4');
    return saved ? new Set(saved) : new Set();
  });

  useEffect(() => {
    safeSave('generated_posts_live', posts);
    safeSave('scheduled_posts_v1', scheduledPosts);
    safeSave('processed_v4', Array.from(processedArticles));
    if (fbConfig) safeSave('fb_config', fbConfig);
  }, [posts, fbConfig, processedArticles, scheduledPosts]);

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 30));

  const uploadToFacebook = async (base64Image: string, caption: string) => {
    if (!fbConfig) throw new Error("Credentials missing.");
    const blob = base64ToBlob(base64Image);
    const formData = new FormData();
    formData.append('source', blob);
    formData.append('message', caption);
    formData.append('access_token', fbConfig.accessToken);

    const res = await fetch(`https://graph.facebook.com/v21.0/${fbConfig.pageId}/photos`, { method: 'POST', body: formData });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.id; 
  };

  const processArticle = async (article: NewsArticle) => {
    if (processedArticles.has(article.title) || isProcessing) return;
    
    setIsProcessing(true);
    addLog(`AUTO: Processing ${article.category} -> ${article.title}`);
    
    try {
      const content = await generatePostContent(article, { name: APP_NAME, defaultTone: 'urgent', activeTemplateId: 't1', activeStyleId: 's1' }, "", 'urgent');
      const rawImg = await fetchAIImage(content.imagePrompt, article.category === 'Parenting' ? "Warm, educational photography" : "Breaking news style", { aspectRatio: "3:4" });
      const brandedImg = await generatePostImage(rawImg, article.title, content.highlightWords, { category: article.category });
      
      addLog(`UPLINK: Streaming to Facebook...`);
      const fbId = await uploadToFacebook(brandedImg, content.caption + "\n\n" + content.hashtags.join(' '));

      const newPost: GeneratedPost = {
        id: Math.random().toString(36).substr(2, 9),
        fbPostId: fbId,
        articleTitle: article.title,
        caption: content.caption,
        imageUrl: brandedImg,
        status: 'posted',
        timestamp: Date.now(),
        article: article
      };

      setPosts(prev => [newPost, ...prev]);
      setProcessedArticles(prev => new Set(prev).add(article.title));
      addLog(`SUCCESS: ${article.category} content is Live!`);
      setIsQuotaExceeded(false);
    } catch (e: any) {
      if (e.message.includes('429') || e.message.includes('RESOURCE_EXHAUSTED')) {
        addLog(`QUOTA: Gemini limit. Cooling down...`);
        setIsQuotaExceeded(true);
      } else {
        addLog(`ERROR: ${e.message}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const checkSchedule = async () => {
      const now = Date.now();
      const duePosts = scheduledPosts.filter(p => p.scheduledTime <= now);
      if (duePosts.length === 0) return;
      for (const p of duePosts) {
        try {
          addLog(`SCHEDULER: Releasing -> ${p.article.title}`);
          const fbId = await uploadToFacebook(p.imageUrl || '', p.caption);
          const newPost: GeneratedPost = {
            id: p.id,
            fbPostId: fbId,
            articleTitle: p.article.title,
            caption: p.caption,
            imageUrl: p.imageUrl,
            status: 'posted',
            timestamp: Date.now(),
            article: p.article
          };
          setPosts(prev => [newPost, ...prev]);
          setScheduledPosts(prev => prev.filter(item => item.id !== p.id));
          addLog(`SUCCESS: Scheduled ${p.article.category} published!`);
        } catch (e: any) {
          addLog(`FAULT: ${e.message}`);
        }
      }
    };
    const interval = setInterval(checkSchedule, 60000);
    return () => clearInterval(interval);
  }, [scheduledPosts, fbConfig]);

  useEffect(() => {
    let timer: any;
    const run = async () => {
      if (!fbConfig || !isAutopilot) return;
      addLog("SCANNER: Searching for Trends & parenting tips...");
      try {
        const { articles } = await getTrendingNews();
        setLatestNews(articles);
        const next = articles.find(a => !processedArticles.has(a.title) && !scheduledPosts.some(s => s.article.title === a.title));
        if (next) await processArticle(next);
        setIsQuotaExceeded(false);
      } catch (e: any) {
        if (e.message.includes('429') || e.message.includes('RESOURCE_EXHAUSTED')) setIsQuotaExceeded(true);
        else addLog(`FAULT: ${e.message}`);
      }
    };
    if (isAutopilot && fbConfig) { run(); timer = setInterval(run, POST_INTERVAL); }
    return () => clearInterval(timer);
  }, [isAutopilot, fbConfig, processedArticles.size, scheduledPosts.length]);

  const handleManualSchedule = async (article: NewsArticle) => {
    setIsProcessing(true);
    addLog(`DRAFT: Building parenting/news assets...`);
    try {
      const content = await generatePostContent(article, { name: APP_NAME, defaultTone: 'urgent', activeTemplateId: 't1', activeStyleId: 's1' }, "", 'urgent');
      const rawImg = await fetchAIImage(content.imagePrompt, article.category === 'Parenting' ? "Empathetic, cinematic photo" : "Journalistic press photo", { aspectRatio: "3:4" });
      const brandedImg = await generatePostImage(rawImg, article.title, content.highlightWords, { category: article.category });
      setSchedulingPost({ article, caption: content.caption + "\n\n" + content.hashtags.join(' '), imageUrl: brandedImg });
    } catch (e: any) { addLog(`FAULT: ${e.message}`); } finally { setIsProcessing(false); }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] pb-20 font-ui">
      <header className="bg-white border-b sticky top-0 z-50 px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black italic shadow-lg ${isAutopilot ? 'bg-[#10B981]' : 'bg-[#1877F2]'}`}>US</div>
          <h1 className="text-xl font-black tracking-tighter text-[#1C1E21] uppercase leading-none">{APP_NAME}</h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex bg-gray-100 p-1 rounded-xl font-bold text-[10px] uppercase">
            {['monitor', 'scheduled', 'archive', 'settings'].map(t => (
              <button key={t} onClick={() => setActiveTab(t as any)} className={`px-5 py-2 rounded-lg transition-all ${activeTab === t ? 'bg-white text-[#1877F2] shadow-sm scale-105' : 'text-gray-400'}`}>
                {t} {t === 'scheduled' && scheduledPosts.length > 0 && <span className="ml-1 bg-blue-500 text-white px-1 rounded-full">{scheduledPosts.length}</span>}
              </button>
            ))}
          </div>
          <button onClick={() => { if(!fbConfig) { setActiveTab('settings'); alert("Config first."); return; } setIsAutopilot(!isAutopilot); }} className={`px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-md ${isAutopilot ? 'bg-green-500 text-white animate-pulse' : 'bg-white text-gray-400'}`}>
            {isAutopilot ? 'AUTOPILOT: ON' : 'AUTOPILOT: OFF'}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto mt-10 px-8">
        {activeTab === 'monitor' && (
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-4 bg-white rounded-[32px] p-8 border shadow-sm h-[650px] flex flex-col">
              <h2 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-6">Uplink Activity</h2>
              <div className="flex-1 overflow-y-auto space-y-3 font-mono text-[10px] pr-2 custom-scrollbar">
                {logs.map((l, i) => (
                  <div key={i} className={`p-3 rounded-xl border-b border-gray-50 ${l.includes('SUCCESS') ? 'text-green-600 font-bold bg-green-50' : 'text-gray-500'}`}>{l}</div>
                ))}
              </div>
            </div>

            <div className="col-span-8 space-y-4">
              <div className="bg-gradient-to-r from-[#1877F2] to-[#10B981] p-8 rounded-[32px] text-white mb-6 shadow-xl flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter italic leading-none">Global Desktop</h3>
                  <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mt-2">Scanning News & Parenting Trends</p>
                </div>
                <button onClick={() => { setProcessedArticles(new Set()); addLog("SYSTEM: Cleared."); }} className="bg-white/10 px-6 py-3 rounded-2xl text-[10px] font-black uppercase border border-white/20">Purge Memory</button>
              </div>

              {latestNews.map((n, i) => {
                const isPublished = processedArticles.has(n.title);
                const isParenting = n.category?.toLowerCase() === 'parenting';
                return (
                  <div key={i} className={`bg-white p-8 rounded-[40px] border flex items-center justify-between group ${isPublished ? 'opacity-40' : 'hover:shadow-xl'}`}>
                    <div className="max-w-[65%]">
                      <span className={`text-[9px] font-black px-4 py-1.5 rounded-xl uppercase tracking-widest ${isParenting ? 'text-emerald-600 bg-emerald-50' : 'text-blue-600 bg-blue-50'}`}>
                        {n.category || 'News'}
                      </span>
                      <h3 className="text-xl font-black text-[#1C1E21] mt-3 group-hover:text-blue-600 transition-colors leading-tight">{n.title}</h3>
                      <p className="text-sm text-gray-400 mt-2 line-clamp-2">{n.summary}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {isPublished ? (
                        <span className="text-[10px] font-black text-green-500 bg-green-50 px-6 py-3 rounded-2xl">Broadcasted</span>
                      ) : (
                        <>
                          <button onClick={() => processArticle(n)} disabled={isProcessing} className="text-[9px] font-black bg-[#1877F2] text-white px-6 py-2.5 rounded-xl uppercase">Post Now</button>
                          <button onClick={() => handleManualSchedule(n)} disabled={isProcessing} className="text-[9px] font-black bg-white border text-gray-400 px-6 py-2.5 rounded-xl uppercase">Schedule</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'scheduled' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {scheduledPosts.map(p => (
              <div key={p.id} className="bg-white rounded-[40px] border p-8 flex gap-6 shadow-sm">
                <img src={p.imageUrl} className="w-32 aspect-square rounded-2xl object-cover" />
                <div className="flex flex-col justify-between">
                  <h4 className="font-black text-lg line-clamp-2">{p.article.title}</h4>
                  <p className="text-[10px] font-black text-blue-500 uppercase">{new Date(p.scheduledTime).toLocaleString()}</p>
                  <button onClick={() => setScheduledPosts(prev => prev.filter(i => i.id !== p.id))} className="text-red-500 text-[9px] font-bold uppercase mt-2">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'archive' && (
          <div className="grid grid-cols-3 gap-8">
            {posts.map(p => (
              <div key={p.id} className="bg-white rounded-[40px] border overflow-hidden shadow-sm group">
                <div className="aspect-[4/5] bg-gray-50 relative">
                  <img src={p.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className={`absolute top-6 right-6 text-white text-[8px] font-black px-3 py-1.5 rounded-lg shadow-lg ${p.article?.category?.toLowerCase() === 'parenting' ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                    {p.article?.category?.toUpperCase() || 'NEWS'}
                  </div>
                </div>
                <div className="p-8">
                  <h4 className="font-black text-lg line-clamp-2 leading-tight">{p.articleTitle}</h4>
                  <p className="text-[9px] text-gray-300 mt-4 font-black uppercase tracking-widest">{new Date(p.timestamp).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-xl mx-auto bg-white p-16 rounded-[64px] border shadow-2xl mt-10">
            <h2 className="text-3xl font-black text-center mb-12 uppercase">Station Config</h2>
            <form onSubmit={(e: any) => {
              e.preventDefault();
              const pid = e.target.pid.value;
              const at = e.target.at.value;
              setFbConfig({ pageId: pid, accessToken: at });
              setActiveTab('monitor');
            }} className="space-y-8">
              <input name="pid" defaultValue={fbConfig?.pageId} placeholder="Page ID" className="w-full bg-gray-50 border p-6 rounded-3xl font-black text-center" />
              <textarea name="at" defaultValue={fbConfig?.accessToken} placeholder="Token" rows={4} className="w-full bg-gray-50 border p-6 rounded-3xl font-bold text-xs text-center" />
              <button type="submit" className="w-full bg-black text-white py-6 rounded-3xl font-black uppercase tracking-widest">Connect Station</button>
            </form>
          </div>
        )}
      </main>

      {schedulingPost && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-10">
          <div className="bg-white w-full max-w-4xl rounded-[56px] p-12 flex gap-12 relative shadow-2xl">
            <div className="flex-1 space-y-8">
              <h2 className="text-3xl font-black uppercase italic">Setup Broadcast</h2>
              <div className="p-6 bg-gray-50 rounded-2xl font-bold text-xl">{schedulingPost.article.title}</div>
              <input type="datetime-local" id="st" className="w-full p-6 border-2 rounded-3xl font-black text-center text-xl" />
              <button onClick={() => {
                const val = (document.getElementById('st') as HTMLInputElement).value;
                if(!val) return;
                const st = new Date(val).getTime();
                const n: ScheduledPost = { id: Math.random().toString(36).substr(2,9), article: schedulingPost.article, caption: schedulingPost.caption, imageUrl: schedulingPost.imageUrl, scheduledTime: st, imagePrompt: '' };
                setScheduledPosts(p => [...p, n]);
                setProcessedArticles(prev => new Set(prev).add(schedulingPost.article.title));
                setSchedulingPost(null);
                addLog(`SCHEDULED: ${schedulingPost.article.category} post.`);
              }} className="w-full py-6 bg-blue-600 text-white rounded-3xl font-black uppercase tracking-[0.2em] shadow-xl">Confirm Time</button>
              <button onClick={()=>setSchedulingPost(null)} className="w-full text-gray-300 font-bold uppercase text-[10px]">Cancel</button>
            </div>
            <div className="w-80 aspect-[3/4] rounded-[32px] overflow-hidden border">
              <img src={schedulingPost.imageUrl} className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="fixed inset-0 z-[200] bg-white/95 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-6" />
            <p className="text-blue-600 font-black uppercase tracking-widest animate-pulse">Encoding Digital Assets...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
