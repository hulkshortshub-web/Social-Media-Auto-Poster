
export interface FBConfig {
  pageId: string;
  accessToken: string;
  groupIds?: string[];
}

export type EditorialTone = 'breaking' | 'analytical' | 'optimistic' | 'urgent';
export type BrandingLayout = 'classic' | 'corner-tag' | 'bold-header' | 'modern-sidebar' | 'impact-minimal' | 'news-strip' | 'cinematic-bar';

export interface CaptionTemplate {
  id: string;
  name: string;
  structure: string; 
}

export interface StylePreset {
  id: string;
  name: string;
  visualPrompt: string;
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  layout?: BrandingLayout;
  fontFamily?: string;
  textColor?: string;
  backgroundColor?: string;
  accentColor?: string;
  // Artistic parameters
  lighting?: string;
  cameraAngle?: string;
  depthOfField?: string;
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
  article?: NewsArticle; // Added to facilitate regeneration
  insights?: PostInsights;
}

export interface AnalyticsSummary {
  totalReach: number;
  avgEngagement: number;
  followerGrowth: number;
  totalPosts: number;
}

export interface GroundingSource {
  web?: {
    uri: string;
    title: string;
  };
}
