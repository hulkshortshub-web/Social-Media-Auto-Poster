
import { GoogleGenAI, Type } from "@google/genai";
import { NewsArticle, GroundingSource, BrandConfig, EditorialTone } from "../types";

const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is missing.");
  return new GoogleGenAI({ apiKey });
};

/**
 * Helper to call Gemini with exponential backoff for 429 errors.
 */
async function callWithRetry(fn: () => Promise<any>, maxRetries = 3): Promise<any> {
  let delay = 2000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
      if (isRateLimit && i < maxRetries - 1) {
        console.warn(`Gemini Rate Limit reached. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
        continue;
      }
      throw error;
    }
  }
}

export const getTrendingNews = async (): Promise<{ articles: NewsArticle[], sources: GroundingSource[] }> => {
  const ai = getAI();
  const now = new Date();
  const currentTimeStr = now.toLocaleString("en-US", { timeZone: "America/New_York" });

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Perform a dual search for today (${currentTimeStr}):
      1. Find the top 4 breaking news stories from the USA.
      2. Find 4 highly engaging parenting topics or child upbringing (Tarbiyat) strategies that are currently trending or evergreen (e.g., discipline, emotional intelligence, moral values).
      
      For the Parenting articles, focus on advice that helps parents improve their children's character.
      Return valid JSON.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            articles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  url: { type: Type.STRING },
                  source: { type: Type.STRING },
                  timestamp: { type: Type.STRING },
                  viralScore: { type: Type.NUMBER },
                  category: { type: Type.STRING, description: "Must be either 'News' or 'Parenting'" },
                  suggestedThemes: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["title", "summary", "url", "source", "timestamp", "category", "viralScore"]
              }
            }
          },
          required: ["articles"]
        }
      },
    });

    const data = JSON.parse(response.text || "{}");
    return { 
      articles: data.articles || [], 
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] 
    };
  });
};

export const generatePostContent = async (
  article: NewsArticle, 
  brand: BrandConfig, 
  structure: string,
  tone: EditorialTone
): Promise<{ caption: string, imagePrompt: string, hashtags: string[], highlightWords: string[] }> => {
  const ai = getAI();
  
  const isParenting = article.category?.toLowerCase() === 'parenting';

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Transform this content into a high-engagement Facebook post:
      TYPE: ${article.category}
      STORY: ${article.title}
      SUMMARY: ${article.summary}
      
      GUIDELINES:
      - If category is 'Parenting', use a 'Mentor/Counselor' tone. Focus on child 'Tarbiyat' (upbringing). Use words like 'Empathy', 'Growth', 'Character'.
      - If category is 'News', use an 'Urgent/Journalistic' tone.
      - Write a short, punchy caption that encourages comments and shares.
      - For Parenting: Include a 'Tip for Parents' at the end of the caption.
      - Generate a descriptive image prompt for a high-quality photo.
      - Pick 2-3 'highlight' words for the graphic text.
      
      Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            caption: { type: Type.STRING },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
            imagePrompt: { type: Type.STRING },
            highlightWords: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["caption", "hashtags", "imagePrompt", "highlightWords"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  });
};

export const fetchAIImage = async (prompt: string, style: string, options: { aspectRatio?: string } = {}): Promise<string> => {
  const ai = getAI();
  
  return callWithRetry(async () => {
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `High quality professional photography: ${prompt}. ${style}. Cinematic lighting, emotional depth, 8k.` }] },
      config: { imageConfig: { aspectRatio: options.aspectRatio || "3:4" } }
    });

    const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!part?.inlineData) throw new Error("Image Generation Failed");
    return `data:image/png;base64,${part.inlineData.data}`;
  });
};
