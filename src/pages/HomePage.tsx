import { useState, useEffect } from "react";
import { doc, setDoc, collection, query, where, onSnapshot, addDoc } from "firebase/firestore";
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import type { MapPost } from "../types";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const QUINTBRIDGE = { lat: 34.699167, lng: 135.530000 };
const GEOFENCE_RADIUS_M = 150;

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  return `${Math.floor(min / 60)}時間前`;
}

function MyLocationButton({ pos }: { pos: { lat: number; lng: number } | null }) {
  const map = useMap();
  const handleClick = () => {
    if (pos) map.setView([pos.lat, pos.lng], 17);
  };
  return (
    <button
      onClick={handleClick}
      title="現在地に移動"
      className="absolute top-3 right-3 z-[1000] bg-white rounded-xl shadow-md w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
    </button>
  );
}

export default function HomePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [checkedIn, setCheckedIn] = useState(profile?.checkedIn ?? false);
  const [loading, setLoading] = useState(false);
  const [postText, setPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [posts, setPosts] = useState<MapPost[]>([]);
  const [friendUids, setFriendUids] = useState<Set<string>>(new Set());
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  useEffect(() => {
    setCheckedIn(profile?.checkedIn ?? false);
  }, [profile]);

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "friendRequests"), where("status", "==", "accepted"));
    const unsub = onSnapshot(q, (snap) => {
      const uids = new Set<string>();
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.fromUid === user.uid) uids.add(data.toUid);
        if (data.toUid === user.uid) uids.add(data.fromUid);
      });
      setFriendUids(uids);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "mapPosts"), (snap) => {
      const now = Date.now();
      setPosts(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as MapPost))
          .filter((p) => p.expiresAt > now)
      );
    });
    return unsub;
  }, []);

  const handleCheckIn = async () => {
    setCheckInError(null);
    if (!myPos) {
      setCheckInError("位置情報を取得中です。少し待ってから再試行してください。");
      return;
    }
    const dist = haversineDistance(myPos.lat, myPos.lng, QUINTBRIDGE.lat, QUINTBRIDGE.lng);
    if (dist > GEOFENCE_RADIUS_M) {
      setCheckInError(`範囲外です — QUINTBRIDGEまで約${Math.round(dist)}m`);
      return;
    }
    setLoading(true);
    await setDoc(doc(db, "users", user!.uid), { checkedIn: true, checkedInAt: Date.now() }, { merge: true });
    await refreshProfile();
    setCheckedIn(true);
    setLoading(false);
  };

  const handleCheckOut = async () => {
    setLoading(true);
    await setDoc(doc(db, "users", user!.uid), { checkedIn: false, checkedInAt: null }, { merge: true });
    await refreshProfile();
    setCheckedIn(false);
    setLoading(false);
  };

  const handlePost = async () => {
    if (!postText.trim() || !myPos) return;
    setPosting(true);
    const now = Date.now();
    await addDoc(collection(db, "mapPosts"), {
      uid: user!.uid,
      displayName: profile?.displayName ?? "",
      text: postText.trim(),
      lat: myPos.lat,
      lng: myPos.lng,
      createdAt: now,
      expiresAt: now + 5 * 60 * 1000,
    });
    setPostText("");
    setPosting(false);
  };

  const mapLegend = [
    { color: "#3b82f6", label: "現在地" },
    { color: "#6366f1", label: "自分の投稿" },
    { color: "#10b981", label: "友達の投稿" },
    { color: "#9ca3af", label: "匿名の投稿" },
  ];

  return (
    <Layout>
      {/* Mobile layout: full-height flex column */}
      <div className="flex flex-col md:flex-row h-[calc(100svh-4rem)] md:h-screen">

        {/* Map area */}
        <div className="flex-1 relative">
          <MapContainer
            center={[QUINTBRIDGE.lat, QUINTBRIDGE.lng]}
            zoom={17}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Circle
              center={[QUINTBRIDGE.lat, QUINTBRIDGE.lng]}
              radius={GEOFENCE_RADIUS_M}
              pathOptions={{ color: "#6366f1", fillColor: "#6366f1", fillOpacity: 0.07, weight: 2, dashArray: "6 4" }}
            />
            {myPos && (
              <CircleMarker
                center={[myPos.lat, myPos.lng]}
                radius={10}
                pathOptions={{ color: "#fff", fillColor: "#3b82f6", fillOpacity: 1, weight: 3 }}
              >
                <Popup><p className="text-sm font-semibold m-0">📍 現在地</p></Popup>
              </CircleMarker>
            )}
            {posts.map((post) => {
              const isMine = post.uid === user?.uid;
              const isFriend = friendUids.has(post.uid);
              const label = isMine ? profile?.displayName ?? "自分" : isFriend ? post.displayName : "匿名";
              const color = isMine ? "#6366f1" : isFriend ? "#10b981" : "#9ca3af";
              return (
                <CircleMarker
                  key={post.id}
                  center={[post.lat, post.lng]}
                  radius={8}
                  pathOptions={{ color: "#fff", fillColor: color, fillOpacity: 1, weight: 2 }}
                >
                  <Popup>
                    <div style={{ minWidth: 140 }}>
                      <p className="font-semibold text-sm m-0 mb-1">{label}</p>
                      <p className="text-sm m-0 mb-1">{post.text}</p>
                      <p className="text-xs text-gray-400 m-0">{timeAgo(post.createdAt)}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
            <MyLocationButton pos={myPos} />
          </MapContainer>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-xl shadow-sm px-3 py-2 flex gap-3">
            {mapLegend.map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: l.color }} />
                <span className="text-[10px] text-gray-500">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Control panel — bottom on mobile, right sidebar on desktop */}
        <div className="md:w-80 md:border-l md:border-gray-100 bg-white flex flex-col">

          {/* Desktop header */}
          <div className="hidden md:block px-5 py-4 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">マップ操作</p>
          </div>

          <div className="p-4 space-y-3">
            {/* Check-in status badge */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${checkedIn ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
              <span className={`w-2 h-2 rounded-full ${checkedIn ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
              {checkedIn ? "チェックイン中 — QUINTBRIDGE" : "チェックアウト中"}
            </div>

            {checkedIn ? (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    maxLength={200}
                    placeholder="マップに投稿する..."
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition"
                  />
                  <button
                    onClick={handlePost}
                    disabled={posting || !postText.trim()}
                    className="bg-indigo-600 text-white px-4 rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-indigo-700 transition"
                  >
                    投稿
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 px-1">投稿は5分後に自動削除されます</p>
                <button
                  onClick={handleCheckOut}
                  disabled={loading}
                  className="w-full border border-gray-200 text-gray-600 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-50 transition disabled:opacity-50"
                >
                  チェックアウト
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleCheckIn}
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-semibold text-sm disabled:opacity-50 hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-sm"
                >
                  {loading ? "チェックイン中..." : "📍 チェックイン"}
                </button>
                {checkInError ? (
                  <div className="flex items-center gap-2 bg-red-50 text-red-500 text-xs px-3 py-2.5 rounded-xl">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {checkInError}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400 text-center px-2">
                    QUINTBRIDGE（半径150m）内にいる場合のみチェックインできます
                  </p>
                )}
              </>
            )}
          </div>

          {/* Desktop: post list */}
          {posts.length > 0 && (
            <div className="hidden md:block flex-1 overflow-y-auto border-t border-gray-100">
              <p className="px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">最近の投稿</p>
              <div className="space-y-px">
                {[...posts].sort((a, b) => b.createdAt - a.createdAt).map((post) => {
                  const isMine = post.uid === user?.uid;
                  const isFriend = friendUids.has(post.uid);
                  const label = isMine ? profile?.displayName ?? "自分" : isFriend ? post.displayName : "匿名";
                  const color = isMine ? "#6366f1" : isFriend ? "#10b981" : "#9ca3af";
                  return (
                    <div key={post.id} className="px-5 py-3 hover:bg-gray-50 transition">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs font-medium text-gray-700">{label}</span>
                        <span className="text-[10px] text-gray-400 ml-auto">{timeAgo(post.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-600 pl-4">{post.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
