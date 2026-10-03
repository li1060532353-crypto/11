export type PublicCoverTone = 'blue' | 'violet' | 'teal' | 'orange';

export interface PublicPostSummary {
  slug: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  publishedAt: string;
  readingTime: number;
  selected: boolean;
  cover: {
    alt: string;
    tone: 'blue' | 'violet' | 'teal' | 'orange';
    image?: string;
  };
}

export interface PublicPostDetail extends PublicPostSummary {
  body: string;
  contentJson?: unknown;
}

export interface PublicNeighborPost {
  slug: string;
  title: string;
}

export interface PublicPostNeighbors {
  previous?: PublicNeighborPost | undefined;
  next?: PublicNeighborPost | undefined;
}

export interface PublicPostListResponse {
  items: PublicPostSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
