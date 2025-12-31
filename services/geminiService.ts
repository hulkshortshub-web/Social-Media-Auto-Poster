
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
    contents: `ACT AS A REAL-TIME NEWS ANALYST. 
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
    breaking: "Urgent, like you're the first person in your group chat to see this. Breathless but real.",
    analytical: "Thoughtful and observational. Use phrases like 'I've been watching this' or 'Here's the real story'.",
    optimistic: "Genuine warmth. Focus on the win for normal people. Avoid 'inspiring' clichés.",
    urgent: "Immediate impact. Direct and visceral. Talk about what this means for people's daily lives right now."
  };

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are a professional human social media editor for a major news network. Write a post about this story.

    STORY: ${article.title}
    SUMMARY: ${article.summary}
    CATEGORY: ${article.category || 'ANALYSIS'}
    TONE: ${toneMap[tone]}
    
    CRITICAL HUMAN-STYLE RULES:
    1. ABSOLUTELY NO AI WORDS: Never use "delve", "tapestry", "unleash", "elevate", "beacon", "pivotal", "essential", "crucial", or "realm". 
    2. CONTRACTIONS: Use "don't", "it's", "can't", "we're", "should've".
    3. THE VOICE: React to the news. Start with a hook that stops the scroll (e.g., "This changes everything we thought about the economy.", "Wait until you see how this is actually playing out.").
    4. HASHTAGS: Provide 3-4 hashtags that are EXTREMELY SPECIFIC and RELEVANT to the entities and events in this news (e.g., if it's about a specific politician or policy, use their name or the policy name). No generic tags like #AI or #Love.
    5. NO RECAPS: We already see the headline. Give us the *vibe* or the *implication*.

    TASK:
    1. Write a CAPTION that feels like it was typed by a human with an opinion.
    2. Generate specific relevant hashtags.
    3. Create an IMAGE PROMPT for a candid photograph. 
       - Describe a "caught in the moment" shot. 
       - Subject MUST be the specific person/group from the news.
       - Focus on high-fidelity textures, journalistic grit, and natural unposed lighting.
    
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
  options: { 
    aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
    lighting?: string,
    cameraAngle?: string,
    depthOfField?: string
  } = {}
): Promise<string> => {
  const ai = getAI();
  const aspectRatio = options.aspectRatio || "3:4";
  
  const artisticConstraints = [
    options.lighting ? `Lighting: ${options.lighting}` : '',
    options.cameraAngle ? `Camera Angle: ${options.cameraAngle}` : '',
    options.depthOfField ? `Depth of Field: ${options.depthOfField}` : ''
  ].filter(Boolean).join(', ');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { 
      parts: [
        { 
          text: `A RAW, CANDID PRESS PHOTOGRAPH. ${styleDescription}. ${prompt}. ${artisticConstraints}. Professional journalistic capture, realistic skin textures, unposed authentic moment, documentary style, unedited grit.` 
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
