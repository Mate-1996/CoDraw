export interface UserProfile {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSummary {
  _id: string;
  name: string;
  email: string;
}

export interface Stroke {
  _id?: string;
  tool: 'pen' | 'eraser';
  color: string;
  size: number;
  points: { x: number; y: number }[];
  userId: string;
}

export interface Drawing {
  _id: string;
  title: string;
  description: string;
  ownerId: UserSummary;
  collaborators: UserSummary[];
  joinCode: string;
  strokes: Stroke[];
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  _id: string;
  drawingId: string;
  userId: UserSummary;
  text: string;
  pinX: number | null;
  pinY: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  message: string;
  data: T;
}
