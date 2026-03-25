import { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc } from "firebase/firestore";
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import type { MapPost, PostCategory } from "../types";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const QUINTBRIDGE = { lat: 34.699167, lng: 135.530000 };
const GEOFENCE_RADIUS_M = 150;

const CATEGORY_COLORS: Record<PostCategory, string> = {
  "サークル": "#6366f1",
  "飲み会": "#f97316",
  "就活": "#10b981",
};

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
  return (
    <button
      onClick={() => { if (pos) map.setView([pos.lat, pos.lng], 17); }}
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
  const { user, profile } = useAuth();
  const [posts, setPosts] = useState<MapPost[]>([]);
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [postText, setPostText] = useState("");
  const [category, setCategory] = useState<PostCategory>("サークル");
  const [anonymous, setAnonymous] = useState(false);
  const [posting, setPosting] = useState(false);

  const inRange = myPos
    ? haversineDistance(myPos.lat, myPos.lng, QUINTBRIDGE.lat, QUINTBRIDGE.lng) <= GEOFENCE_RADIUS_M
    : false;

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "mapPosts"), (snap) => {
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MapPost)));
    });
    return unsub;
  }, []);

  const handlePost = async () => {
    if (!postText.trim() || !myPos || !inRange) return;
    setPosting(true);
    const now = Date.now();
    await addDoc(collection(db, "mapPosts"), {
      uid: user!.uid,
      displayName: profile?.displayName ?? "",
      text: postText.trim(),
      lat: myPos.lat,
      lng: myPos.lng,
      createdAt: now,
      category,
      anonymous,
    });
    setPostText("");
    setCategory("サークル");
    setAnonymous(false);
    setPosting(false);
    setShowModal(false);
  };

  const categories: PostCategory[] = ["サークル", "飲み会", "就活"];

  return (
    <Layout>
      <div className="relative h-[calc(100svh-4rem)]">
        {/* Map */}
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
            const label = post.anonymous ? "匿名" : post.displayName;
            const color = isMine ? "#6366f1" : CATEGORY_COLORS[post.category] ?? "#9ca3af";
            return (
              <CircleMarker
                key={post.id}
                center={[post.lat, post.lng]}
                radius={8}
                pathOptions={{ color: "#fff", fillColor: color, fillOpacity: 1, weight: 2 }}
              >
                <Popup>
                  <div style={{ minWidth: 140 }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[post.category] + "22", color: CATEGORY_COLORS[post.category] }}>
                        {post.category}
                      </span>
                    </div>
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
        <div className="absolute bottom-24 left-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-xl shadow-sm px-3 py-2 flex gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0 bg-[#3b82f6]" />
            <span className="text-[10px] text-gray-500">現在地</span>
          </div>
          {categories.map((cat) => (
            <div key={cat} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat] }} />
              <span className="text-[10px] text-gray-500">{cat}</span>
            </div>
          ))}
        </div>

        {/* Post button */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-1.5">
          <button
            onClick={() => inRange && setShowModal(true)}
            disabled={!inRange}
            className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-semibold text-sm shadow-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 active:scale-[0.97] transition-all"
          >
            ✏️ 投稿する
          </button>
          {!inRange && (
            <span className="text-[11px] text-white bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full">
              {myPos ? "範囲外 — QUINTBRIDGEに近づいてください" : "位置情報を取得中..."}
            </span>
          )}
        </div>
      </div>

      {/* Post modal */}
      {showModal && (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-900">投稿する</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Category */}
            <div className="flex gap-2 mb-4">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold border transition"
                  style={
                    category === cat
                      ? { backgroundColor: CATEGORY_COLORS[cat], color: "#fff", borderColor: CATEGORY_COLORS[cat] }
                      : { backgroundColor: "#f9fafb", color: "#6b7280", borderColor: "#e5e7eb" }
                  }
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Text */}
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="内容を入力..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition resize-none mb-4"
            />

            {/* Anonymous toggle */}
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => setAnonymous(false)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition ${
                  !anonymous ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200"
                }`}
              >
                {profile?.displayName ?? "名前"}で投稿
              </button>
              <button
                onClick={() => setAnonymous(true)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition ${
                  anonymous ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200"
                }`}
              >
                匿名で投稿
              </button>
            </div>

            <button
              onClick={handlePost}
              disabled={posting || !postText.trim()}
              className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-semibold text-sm disabled:opacity-40 hover:bg-indigo-700 transition"
            >
              {posting ? "投稿中..." : "投稿する"}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
