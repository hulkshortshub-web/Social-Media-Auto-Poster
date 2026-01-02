
export interface FBConfig {
  pageId: string;
  accessToken: string;
  groupIds?: string[];
}

export type EditorialTone = 'breaking' | 'analytical' | 'optimistic' | 'urgent';
export type BrandingLayout = 'broadcast' | 'classic' | 'modern';

export interface StylePreset {
  id: string;
  name: string;
  visualPrompt: string;
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  lighting: string;
  cameraAngle: string;
  depthOfField: string;
}

export interface BrandConfig {
  name: string;
  handle?: string;
  defaultTone: EditorialTone;
  activeTemplateId: string;
  activeStyleId: string;
}

export interface NewsArticle {
  title: string;
  summary: string;
  url: string;
  source: string;
  timestamp: string;
  suggestedThemes: string[];
  viralScore: number; 
  category?: string; 
}

export interface ScheduledPost {
  id: string;
  article: NewsArticle;
  caption: string;
  imagePrompt: string;
  imageUrl?: string;
  scheduledTime: number;
  highlightWords?: string[];
}

export interface PostInsights {
  reach: number;
  engagement: number;
  clicks: number;
  likes: number;
}

export interface GeneratedPost {
  id: string;
  fbPostId?: string;
  articleTitle: string;
  caption: string;
  imageUrl?: string;
  status: 'draft' | 'posted' | 'failed';
  timestamp: number;
  article?: NewsArticle;
  insights?: PostInsights;
  highlightWords?: string[];
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  content: string;
  rating: number;
  location: string;
  avatar?: string;
}

export interface GroundingSource {
  web?: {
    uri: string;
    title: string;
  };
}
