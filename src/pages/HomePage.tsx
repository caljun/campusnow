import { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc } from "firebase/firestore";
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import type { Post, PostType } from "../types";

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

const POST_TYPES: { type: PostType; label: string; desc: string }[] = [
  { type: "post",         label: "投稿",   desc: "普通の投稿（匿名可）" },
  { type: "board",        label: "掲示板", desc: "返信できるスレッド（実名）" },
  { type: "announcement", label: "告知",   desc: "お知らせ（実名）" },
];

export default function HomePage() {
  const { user, profile } = useAuth();
  const [mapPosts, setMapPosts] = useState<Post[]>([]);
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [postType, setPostType] = useState<PostType>("post");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
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

  // Map shows only "post" type
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "posts"), (snap) => {
      setMapPosts(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Post))
          .filter((p) => p.type === "post" && p.lat != null)
      );
    });
    return unsub;
  }, []);

  const openModal = () => {
    setPostType("post");
    setTitle("");
    setText("");
    setAnonymous(false);
    setShowModal(true);
  };

  const handlePost = async () => {
    if (!text.trim() || !myPos || !inRange) return;
    if ((postType === "board" || postType === "announcement") && !title.trim()) return;
    setPosting(true);

    const data: Omit<Post, "id"> = {
      type: postType,
      uid: user!.uid,
      displayName: profile?.displayName ?? "",
      text: text.trim(),
      createdAt: Date.now(),
      ...(postType === "post" && {
        anonymous,
        lat: myPos.lat,
        lng: myPos.lng,
      }),
      ...((postType === "board" || postType === "announcement") && {
        title: title.trim(),
        replyCount: 0,
      }),
    };

    await addDoc(collection(db, "posts"), data);
    setShowModal(false);
    setPosting(false);
  };

  return (
    <Layout>
      <div className="relative h-[calc(100svh-4rem)]">
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
          {mapPosts.map((post) => {
            const isMine = post.uid === user?.uid;
            const label = post.anonymous ? "匿名" : post.displayName;
            return (
              <CircleMarker
                key={post.id}
                center={[post.lat!, post.lng!]}
                radius={8}
                pathOptions={{ color: "#fff", fillColor: isMine ? "#6366f1" : "#9ca3af", fillOpacity: 1, weight: 2 }}
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

        {/* Post button */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-1.5">
          <button
            onClick={() => inRange && openModal()}
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
        <div className="fixed inset-0 z-[2000] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-3xl w-full max-w-md mx-4 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-900">投稿する</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Type selector */}
            <div className="flex gap-2 mb-4">
              {POST_TYPES.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => { setPostType(type); setAnonymous(false); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                    postType === type
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-gray-50 text-gray-500 border-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mb-4 -mt-2">
              {POST_TYPES.find((t) => t.type === postType)?.desc}
            </p>

            {/* Title (board / announcement) */}
            {(postType === "board" || postType === "announcement") && (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                placeholder="タイトル"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition mb-3"
              />
            )}

            {/* Text */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="内容を入力..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition resize-none mb-4"
            />

            {/* Anonymous toggle (post only) */}
            {postType === "post" && (
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
            )}

            <button
              onClick={handlePost}
              disabled={posting || !text.trim() || ((postType === "board" || postType === "announcement") && !title.trim())}
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
