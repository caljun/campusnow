export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  department?: string;
  bio?: string;
}

export type PostType = "post" | "board" | "announcement";

export interface Post {
  id: string;
  type: PostType;
  uid: string;
  displayName: string;
  text: string;
  createdAt: number;
  // post only
  anonymous?: boolean;
  lat?: number;
  lng?: number;
  // board / announcement
  title?: string;
  replyCount?: number;
}

export interface Reply {
  id: string;
  uid: string;
  displayName: string;
  text: string;
  createdAt: number;
}
