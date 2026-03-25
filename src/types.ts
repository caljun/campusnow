export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  department?: string;
  bio?: string;
  checkedIn: boolean;
  checkedInAt?: number; // timestamp ms
}

export interface FriendRequest {
  id: string;
  fromUid: string;
  toUid: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
}

export type PostCategory = "サークル" | "飲み会" | "就活";

export interface MapPost {
  id: string;
  uid: string;
  displayName: string;
  text: string;
  lat: number;
  lng: number;
  createdAt: number;
  category: PostCategory;
  anonymous: boolean;
}
