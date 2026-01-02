
import React, { useState, useEffect, useRef } from 'react';
import { 
  getTrendingNews, 
  generatePostContent, 
  fetchAIImage
} from './services/geminiService';
import { 
  FBConfig, 
  NewsArticle, 
  GeneratedPost 
} from './types';

const FB_BLUE = '#1877F2';
const APP_NAME = "US NEWS LIVE";
const POST_INTERVAL = 120000; // 2 minutes

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

      let width = 1080;
      let height = 1350; 
      if (options.aspectRatio === '1:1') height = 1080;

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);

      const grad = ctx.createLinearGradient(0, height * 0.4, 0, height);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.6, 'rgba(0,0,0,0.8)');
      grad.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      const headFont = 'Outfit, sans-serif';
      const blueColor = FB_BLUE;

      ctx.fillStyle = blueColor;
      ctx.fillRect(50, 50, 180, 60);
      ctx.fillStyle = 'white';
      ctx.font = `900 24px ${headFont}`;
      ctx.textAlign = 'center';
      ctx.fillText("LIVE", 140, 90);

      const fontSize = Math.floor(width * 0.07);
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

      const lineHeight = fontSize * 1.1;
      let y = height - (lines.length * lineHeight) - 80;

      lines.forEach(line => {
        let x = 50;
        line.forEach(word => {
          const cleanWord = word.replace(/[^\w]/g, '');
          const isHighlight = highlightWords.some(hw => 
            hw.toUpperCase().replace(/[^\w]/g, '') === cleanWord
          );

          ctx.fillStyle = isHighlight ? blueColor : 'white';
          ctx.fillText(word, x, y);
          x += ctx.measureText(word + ' ').width;
        });
        y += lineHeight;
      });

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => reject("Image failed");
    img.src = base64Image;
  });
};

const App: React.FC = () => {
  const [fbConfig, setFbConfig] = useState<FBConfig | null>(() => getSafeLocalStorage('fb_config'));
  const [activeTab, setActiveTab] = useState<'monitor' | 'archive' | 'settings'>('monitor');
  const [isAutopilot, setIsAutopilot] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [latestNews, setLatestNews] = useState<NewsArticle[]>([]);
  const [posts, setPosts] = useState<GeneratedPost[]>(() => getSafeLocalStorage('generated_posts_live') || []);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [processedArticles, setProcessedArticles] = useState<Set<string>>(() => {
    const saved = getSafeLocalStorage('processed_v4');
    return saved ? new Set(saved) : new Set();
  });

  useEffect(() => {
    safeSave('generated_posts_live', posts);
    safeSave('processed_v4', Array.from(processedArticles));
    if (fbConfig) safeSave('fb_config', fbConfig);
  }, [posts, fbConfig, processedArticles]);

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 30));

  const uploadToFacebook = async (base64Image: string, caption: string) => {
    if (!fbConfig) throw new Error("Credentials missing. Check Settings.");
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
    addLog(`AUTO: Generating Post -> ${article.title}`);
    
    try {
      const content = await generatePostContent(article, { name: APP_NAME, defaultTone: 'urgent', activeTemplateId: 't1', activeStyleId: 's1' }, "", 'urgent');
      const rawImg = await fetchAIImage(content.imagePrompt, "Breaking news style", { aspectRatio: "3:4" });
      const brandedImg = await generatePostImage(rawImg, article.title, content.highlightWords, { category: article.category });
      
      addLog(`UPLINK: Uploading to Facebook...`);
      const fbId = await uploadToFacebook(brandedImg, content.caption + "\n\n" + content.hashtags.join(' '));

      const newPost: GeneratedPost = {
        id: Math.random().toString(36).substr(2, 9),
        fbPostId: fbId,
        articleTitle: article.title,
        caption: content.caption,
        imageUrl: brandedImg,
        status: 'posted',
        timestamp: Date.now()
      };

      setPosts(prev => [newPost, ...prev]);
      setProcessedArticles(prev => new Set(prev).add(article.title));
      addLog(`SUCCESS: Post Live! ID: ${fbId}`);
      setIsQuotaExceeded(false);
    } catch (e: any) {
      if (e.message.includes('429') || e.message.includes('RESOURCE_EXHAUSTED')) {
        addLog(`QUOTA: Gemini API limit reached. Cooling down...`);
        setIsQuotaExceeded(true);
      } else if (e.message.includes('limit') || e.message.includes('spam')) {
        addLog(`SKIP: Facebook Limit. Moving to next story.`);
        setProcessedArticles(prev => new Set(prev).add(article.title)); 
      } else {
        addLog(`ERROR: ${e.message}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    let timer: any;
    const run = async () => {
      if (!fbConfig || !isAutopilot) return;
      
      addLog("SCANNER: Checking trends...");
      try {
        const { articles } = await getTrendingNews();
        setLatestNews(articles);
        const next = articles.find(a => !processedArticles.has(a.title));
        if (next) {
          await processArticle(next);
        } else {
          addLog("SCANNER: Page is fully updated.");
        }
        setIsQuotaExceeded(false);
      } catch (e: any) {
        if (e.message.includes('429') || e.message.includes('RESOURCE_EXHAUSTED')) {
           setIsQuotaExceeded(true);
           addLog(`QUOTA: System rate limited. Waiting for reset.`);
        } else {
           addLog(`FAULT: Scanner error - ${e.message}`);
        }
      }
    };

    if (isAutopilot && fbConfig) {
      run();
      timer = setInterval(run, POST_INTERVAL);
    }
    return () => clearInterval(timer);
  }, [isAutopilot, fbConfig, processedArticles.size]);

  const handleSettingsSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const pid = (e.currentTarget.elements.namedItem('pid') as HTMLInputElement).value;
    const at = (e.currentTarget.elements.namedItem('at') as HTMLTextAreaElement).value;

    if (pid && at) {
      const newConfig = { pageId: pid, accessToken: at };
      setFbConfig(newConfig);
      safeSave('fb_config', newConfig);
      addLog("SYSTEM: Facebook Credentials Saved.");
      setActiveTab('monitor');
      alert("Settings Saved Successfully!");
    } else {
      alert("Error: Please provide both Page ID and Access Token.");
    }
  };

  const clearHistory = () => {
    if (confirm("Reset posting history? The tool will be able to post these stories again.")) {
      setProcessedArticles(new Set());
      localStorage.removeItem('processed_v4');
      addLog("SYSTEM: Posting History Reset.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] pb-20 font-ui">
      <header className="bg-white border-b sticky top-0 z-50 px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1877F2] rounded-xl flex items-center justify-center text-white font-black italic shadow-lg">US</div>
          <h1 className="text-xl font-black tracking-tighter text-[#1C1E21] uppercase leading-none">{APP_NAME}</h1>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex bg-gray-100 p-1 rounded-xl font-bold text-[10px] uppercase">
            {['monitor', 'archive', 'settings'].map(t => (
              <button key={t} onClick={() => setActiveTab(t as any)} className={`px-5 py-2 rounded-lg transition-all ${activeTab === t ? 'bg-white text-[#1877F2] shadow-sm scale-105' : 'text-gray-400 hover:text-gray-600'}`}>{t}</button>
            ))}
          </div>
          <button 
            onClick={() => {
              if (!fbConfig) {
                setActiveTab('settings');
                alert("Please save your Facebook credentials first.");
                return;
              }
              setIsAutopilot(!isAutopilot);
            }}
            className={`px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-md ${isAutopilot ? 'bg-green-500 text-white animate-pulse' : 'bg-white text-gray-400 border hover:bg-gray-50'}`}
          >
            {isAutopilot ? 'AUTOPILOT: ACTIVE' : 'AUTOPILOT: STANDBY'}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto mt-10 px-8">
        {activeTab === 'monitor' && (
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-4 bg-white rounded-[32px] p-8 border shadow-sm h-[650px] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-[10px] font-black uppercase text-gray-400 tracking-widest">System Pulse</h2>
                <div className={`w-2 h-2 rounded-full ${isAutopilot ? 'bg-green-500 animate-ping' : 'bg-gray-300'}`}></div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 font-mono text-[10px] pr-2 custom-scrollbar">
                {logs.map((l, i) => (
                  <div key={i} className={`p-3 rounded-xl border-b border-gray-50 transition-all ${l.includes('SUCCESS') ? 'text-green-600 font-bold bg-green-50/50' : l.includes('QUOTA') ? 'text-orange-600 font-bold bg-orange-50/50' : 'text-gray-500'}`}>{l}</div>
                ))}
                {logs.length === 0 && <div className="text-gray-300 italic">Listening for broadcast signals...</div>}
              </div>
            </div>

            <div className="col-span-8 space-y-4">
              {isQuotaExceeded && (
                <div className="bg-gradient-to-r from-orange-500 to-red-500 p-8 rounded-[32px] text-white shadow-xl animate-pulse flex items-center gap-6">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-2xl">⚠️</div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tighter italic">Gemini Quota Exceeded</h3>
                    <p className="text-xs font-bold opacity-90 uppercase tracking-widest">System is cooling down. Autopilot will resume shortly.</p>
                  </div>
                </div>
              )}
              
              <div className="bg-[#1877F2] p-8 rounded-[32px] text-white shadow-xl flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter italic">Global News Control</h3>
                  <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mt-1">Status: {isAutopilot ? 'Streaming' : 'Paused'}</p>
                </div>
                <button onClick={clearHistory} className="bg-white/10 hover:bg-white/20 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/20 transition-all">Clear Memory</button>
              </div>

              {latestNews.length === 0 && !isQuotaExceeded && (
                <div className="p-24 text-center text-gray-300 font-black uppercase tracking-[0.2em] bg-white rounded-[40px] border border-dashed">Scanning Satellite Feed...</div>
              )}

              {latestNews.map((n, i) => (
                <div key={i} className={`bg-white p-8 rounded-[40px] border flex items-center justify-between transition-all group ${processedArticles.has(n.title) ? 'opacity-40 grayscale-[0.5]' : 'hover:shadow-2xl hover:-translate-y-1'}`}>
                  <div className="max-w-[70%]">
                    <span className="text-[10px] font-black text-[#1877F2] bg-blue-50 px-4 py-1.5 rounded-xl uppercase tracking-widest">{n.category || 'News'}</span>
                    <h3 className="text-xl font-black text-[#1C1E21] mt-3 group-hover:text-[#1877F2] transition-colors leading-tight">{n.title}</h3>
                    <p className="text-sm text-gray-400 mt-3 line-clamp-2 font-medium leading-relaxed">{n.summary}</p>
                  </div>
                  <div className="shrink-0 ml-6">
                    {processedArticles.has(n.title) ? (
                      <span className="text-[10px] font-black text-green-500 bg-green-50 px-6 py-3 rounded-2xl border border-green-100 shadow-sm uppercase tracking-widest">Published</span>
                    ) : (
                      <button 
                        onClick={() => processArticle(n)} 
                        disabled={isQuotaExceeded || isProcessing}
                        className={`text-[10px] font-black px-8 py-4 rounded-2xl uppercase tracking-widest transition-all shadow-lg ${isQuotaExceeded || isProcessing ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#1877F2] text-white hover:bg-blue-600 shadow-blue-500/30 active:scale-95'}`}
                      >
                        {isProcessing ? 'Working...' : 'Push Live'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'archive' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.length === 0 && <div className="col-span-full py-40 text-center text-gray-300 font-black uppercase tracking-widest">No Broadcasts Archived</div>}
            {posts.map(p => (
              <div key={p.id} className="bg-white rounded-[48px] border overflow-hidden shadow-sm hover:shadow-2xl transition-all group">
                <div className="aspect-[4/5] bg-gray-50 relative overflow-hidden">
                  <img src={p.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
                  <div className="absolute top-8 right-8 bg-[#1877F2] text-white text-[9px] font-black px-5 py-2 rounded-2xl shadow-xl uppercase tracking-widest border border-white/20">SENT</div>
                </div>
                <div className="p-10">
                  <h4 className="font-black text-xl text-[#1C1E21] line-clamp-2 leading-tight group-hover:text-[#1877F2] transition-colors">{p.articleTitle}</h4>
                  <div className="flex items-center justify-between mt-8 border-t pt-6 border-gray-50">
                    <p className="text-[10px] text-gray-300 uppercase font-black tracking-widest">{new Date(p.timestamp).toLocaleDateString()}</p>
                    <span className="text-[10px] text-[#1877F2] font-black uppercase tracking-widest">Live View</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto bg-white p-16 rounded-[64px] border shadow-2xl mt-10">
            <div className="text-center mb-16">
              <div className="w-24 h-24 bg-[#1877F2] rounded-[32px] flex items-center justify-center mx-auto mb-10 shadow-2xl rotate-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
              </div>
              <h2 className="text-4xl font-black text-[#1C1E21] tracking-tighter uppercase">Station Access</h2>
              <p className="text-gray-400 font-bold uppercase tracking-[0.4em] text-[10px] mt-4">Connect to FB Graph Network</p>
            </div>
            
            <form onSubmit={handleSettingsSubmit} className="space-y-10">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-8">FB Page ID</label>
                <input 
                  name="pid" 
                  defaultValue={fbConfig?.pageId} 
                  placeholder="e.g. 10492857123"
                  required 
                  className="w-full bg-gray-50 border-2 border-gray-100 p-8 rounded-[32px] font-black text-xl outline-none focus:border-[#1877F2] transition-all text-center" 
                />
              </div>
              <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-8">Page Access Token</label>
                <textarea 
                  name="at" 
                  defaultValue={fbConfig?.accessToken} 
                  placeholder="EAAB..."
                  required 
                  rows={4} 
                  className="w-full bg-gray-50 border-2 border-gray-100 p-8 rounded-[32px] font-bold text-xs outline-none focus:border-[#1877F2] resize-none text-center transition-all" 
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white py-8 rounded-[40px] font-black uppercase text-sm tracking-[0.4em] shadow-2xl shadow-blue-500/40 active:scale-95 transition-all"
              >
                Apply Broadcast Token
              </button>
            </form>
            
            <p className="mt-12 text-center text-[10px] text-gray-300 font-bold uppercase tracking-widest leading-relaxed px-10">
              Station uses 256-bit encryption for local credential storage.
            </p>
          </div>
        )}
      </main>

      {isProcessing && (
        <div className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-md flex items-center justify-center">
          <div className="text-center">
            <div className="w-24 h-24 border-[8px] border-blue-50 border-t-[#1877F2] rounded-full animate-spin mx-auto mb-10" />
            <p className="text-[#1877F2] text-2xl font-black uppercase tracking-[0.6em] animate-pulse">Encoding Asset...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
