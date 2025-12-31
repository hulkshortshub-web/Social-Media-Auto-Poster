
import { GoogleGenAI, Type } from "@google/genai";
import { NewsArticle, GroundingSource, BrandConfig, EditorialTone } from "../types";

const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is missing.");
  return new GoogleGenAI({ apiKey });
};

export const getTrendingNews = async (): Promise<{ articles: NewsArticle[], sources: GroundingSource[] }> => {
  const ai = getAI();
  const now = new Date();
  
  const currentTimeStr = now.toLocaleString("en-US", { 
    timeZone: "America/New_York",
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `ACT AS A REAL-TIME NEWS ANALYST FOR A HIGH-END MEDIA NETWORK. 
    CURRENT SYSTEM TIME: ${currentTimeStr} (USA Eastern Time).
    
    TASK: Use Google Search to find the absolute LATEST breaking news in the USA.
    
    STRICT TIME CONSTRAINT: 
    - ONLY return news published within the LAST 2 HOURS.
    
    Identify the top 6 most URGENT and VIRAL stories happening RIGHT NOW. 
    Assign a 'viralScore' (1-100) and a 'category' (e.g. BREAKING, POLICY, GEOPOLITICS, TECH, CRIME). 
    
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
                category: { type: Type.STRING },
                suggestedThemes: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["title", "summary", "url", "source", "timestamp", "suggestedThemes", "viralScore", "category"]
            }
          }
        },
        required: ["articles"]
      }
    },
  });

  const data = JSON.parse(response.text);
  const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  return { articles: data.articles, sources };
};

export const generatePostContent = async (
  article: NewsArticle, 
  brand: BrandConfig, 
  captionStructure: string,
  tone: EditorialTone
): Promise<{ caption: string, imagePrompt: string, hashtags: string[] }> => {
  const ai = getAI();
  
  const toneMap = {
    breaking: "Urgent, relatable, like a text from a smart friend. No professional jargon.",
    analytical: "Smart and deep but told through a conversational story. Use 'I' or 'We'.",
    optimistic: "Genuine warmth, personal and uplifting. Focus on the human face of the story.",
    urgent: "Immediate impact, breathless but grounded in real reality."
  };

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are a human social media editor who actually cares about the news. 
    
    STORY: ${article.title}
    SUMMARY: ${article.summary}
    CATEGORY: ${article.category || 'ANALYSIS'}
    TONE: ${toneMap[tone]}
    
    CRITICAL HUMAN-STYLE RULES:
    1. NO AI CLICHÉS: Never use "Unleashing," "Diving deep," "The wait is over," or "Step into."
    2. USE CONTRACTIONS: Use "don't," "it's," "can't." It sounds more natural.
    3. VARIATION: Use short, punchy sentences followed by longer ones.
    4. EMOTION: Mention how this affects real people on the ground.
    5. conversational: Ask a rhetorical question or end with a thought-provoking line.

    TASK:
    1. Write a CAPTION that a human would actually post. It should feel candid and authentic.
    2. Generate 4 relevant, un-branded hashtags.
    3. Create an IMAGE PROMPT for a candid photograph. 
       - Describe a "caught in the moment" shot. 
       - Include details like "natural skin texture, slight imperfections, raw lighting."
       - Mention "unposed, non-centered composition, background blur but with realistic depth."
    
    Return result as JSON.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          caption: { type: Type.STRING },
          hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
          imagePrompt: { type: Type.STRING }
        },
        required: ["caption", "hashtags", "imagePrompt"]
      }
    }
  });

  return JSON.parse(response.text);
};

export const fetchAIImage = async (
  prompt: string, 
  styleDescription: string,
  options: { aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" } = {}
): Promise<string> => {
  const ai = getAI();
  const aspectRatio = options.aspectRatio || "3:4";
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { 
      parts: [
        { 
          text: `A RAW, CANDID PHOTOGRAPH. ${styleDescription}. ${prompt}. Captured on a real camera, natural unedited skin tones, authentic messy environment, no plastic smoothing, realistic lighting, slight film grain, unposed human expression.` 
        }
      ] 
    },
    config: { 
      imageConfig: { 
        aspectRatio: aspectRatio
      } 
    }
  });

  const part = response.candidates?.[0].content.parts.find(p => p.inlineData);
  if (!part?.inlineData) throw new Error("Image synthesis failure");
  return `data:image/png;base64,${part.inlineData.data}`;
};
