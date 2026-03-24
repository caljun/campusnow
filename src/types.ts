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

export interface MapPost {
  id: string;
  uid: string;
  displayName: string;
  text: string;
  lat: number;
  lng: number;
  createdAt: number;
  expiresAt: number; // createdAt + 24h
}
