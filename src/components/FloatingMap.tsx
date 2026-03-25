import { useState, useEffect, useRef } from "react";
import { collection, onSnapshot, addDoc } from "firebase/firestore";
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useMapContext } from "../context/MapContext";
import type { Post, PostType } from "../types";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const LOCATIONS = [
  { id: "quintbridge", name: "QUINTBRIDGE", lat: 34.699167, lng: 135.530000 },
  { id: "osakajo",     name: "大阪城",       lat: 34.687315, lng: 135.526201 },
];
const GEOFENCE_RADIUS_M = 150;
type LocationId = typeof LOCATIONS[number]["id"];

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  return `${Math.floor(min / 60)}時間前`;
}

function MapInteractions({ enabled, resetCenter }: { enabled: boolean; resetCenter: { lat: number; lng: number } }) {
  const map = useMap();
  useEffect(() => {
    if (enabled) {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
      map.touchZoom.enable();
      setTimeout(() => map.invalidateSize(), 50);
    } else {
      map.dragging.disable();
      map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable();
      map.touchZoom.disable();
      map.setView([resetCenter.lat, resetCenter.lng], 17, { animate: false });
    }
  }, [enabled, map, resetCenter]);
  return null;
}

function FlyToTarget({
  target,
  onFlied,
  markerRefs,
}: {
  target: { lat: number; lng: number; postId?: string } | null;
  onFlied: () => void;
  markerRefs: React.MutableRefObject<Record<string, L.CircleMarker | null>>;
}) {
  const map = useMap();
  const onFliedRef = useRef(onFlied);
  onFliedRef.current = onFlied;
  useEffect(() => {
    if (!target) return;
    setTimeout(() => {
      map.invalidateSize();
      map.flyTo([target.lat, target.lng], 18, { duration: 0.8 });
      if (target.postId) {
        setTimeout(() => { markerRefs.current[target.postId!]?.openPopup(); }, 900);
      }
      onFliedRef.current();
    }, 400);
  }, [target, map, markerRefs]);
  return null;
}

function FlyToLocation({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    map.flyTo([lat, lng], 17, { duration: 1.2 });
  }, [lat, lng, map]);
  return null;
}

function MyLocationButton({ pos }: { pos: { lat: number; lng: number } | null }) {
  const map = useMap();
  return (
    <button
      onClick={() => { if (pos) map.setView([pos.lat, pos.lng], 17); }}
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

export default function FloatingMap() {
  const { mapOpen, setMapOpen, flyTarget, clearFlyTarget } = useMapContext();
  const { user, profile } = useAuth();
  const markerRefs = useRef<Record<string, L.CircleMarker | null>>({});
  const [mapPosts, setMapPosts] = useState<Post[]>([]);
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const [activeLocationId, setActiveLocationId] = useState<LocationId>("quintbridge");
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [postType, setPostType] = useState<PostType>("post");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [posting, setPosting] = useState(false);

  const activeLocation = LOCATIONS.find((l) => l.id === activeLocationId)!;
  const inRange = myPos
    ? haversineDistance(myPos.lat, myPos.lng, activeLocation.lat, activeLocation.lng) <= GEOFENCE_RADIUS_M
    : false;

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

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
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
      ...(postType === "post" && { anonymous, lat: myPos.lat, lng: myPos.lng }),
      ...((postType === "board" || postType === "announcement") && { title: title.trim(), replyCount: 0 }),
    };
    await addDoc(collection(db, "posts"), data);
    setShowModal(false);
    setPosting(false);
  };

  return (
    <>
      <div
        className={mapOpen
          ? "fixed inset-0 z-50"
          : "fixed bottom-5 right-4 w-36 h-24 rounded-xl overflow-hidden shadow-lg z-40 cursor-pointer"
        }
        onClick={!mapOpen ? () => setMapOpen(true) : undefined}
      >
        <MapContainer
          center={[LOCATIONS[0].lat, LOCATIONS[0].lng]}
          zoom={17}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Circle
            center={[activeLocation.lat, activeLocation.lng]}
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
          {mapPosts.map((post) => (
            <CircleMarker
              key={post.id}
              ref={(el) => { markerRefs.current[post.id] = el; }}
              center={[post.lat!, post.lng!]}
              radius={8}
              pathOptions={{ color: "#fff", fillColor: "#6366f1", fillOpacity: 1, weight: 2 }}
            >
              <Popup>
                <div style={{ minWidth: 140 }}>
                  <p className="font-semibold text-sm m-0 mb-1">{post.anonymous ? "匿名" : post.displayName}</p>
                  <p className="text-sm m-0 mb-1">{post.text}</p>
                  <p className="text-xs text-gray-400 m-0">{timeAgo(post.createdAt)}</p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
          <FlyToLocation lat={activeLocation.lat} lng={activeLocation.lng} />
          <MapInteractions enabled={mapOpen} resetCenter={activeLocation} />
          <FlyToTarget target={flyTarget} onFlied={clearFlyTarget} markerRefs={markerRefs} />
          {mapOpen && <MyLocationButton pos={myPos} />}
        </MapContainer>

        {/* サムネイルのラベル */}
        {!mapOpen && (
          <div className="absolute inset-0 flex items-end justify-center pb-1 pointer-events-none">
            <span className="text-[10px] text-white bg-black/50 px-2 py-0.5 rounded-full">マップ</span>
          </div>
        )}

        {/* 全画面時のUI */}
        {mapOpen && (
          <>
            {/* 閉じるボタン */}
            <button
              onClick={() => setMapOpen(false)}
              className="absolute top-3 left-3 z-[1000] bg-white rounded-xl shadow-md w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* エリア切り替え */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000]">
              <button
                onClick={() => setShowLocationMenu((v) => !v)}
                className="flex items-center gap-2 bg-white rounded-xl shadow-md px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {activeLocation.name}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showLocationMenu && (
                <div className="mt-1.5 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden w-44">
                  {LOCATIONS.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => { setActiveLocationId(loc.id as LocationId); setShowLocationMenu(false); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition flex items-center justify-between ${
                        loc.id === activeLocationId ? "bg-indigo-50 text-indigo-600 font-semibold" : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {loc.name}
                      {loc.id === activeLocationId && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 投稿ボタン */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000]">
              {inRange ? (
                <button
                  onClick={openModal}
                  className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-semibold text-sm shadow-lg hover:bg-indigo-700 active:scale-[0.97] transition-all"
                >
                  ✏️ 投稿する
                </button>
              ) : (
                <span className="text-[11px] text-white bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full">
                  {myPos ? "圏外 — QUINTBRIDGEに近づいてください" : "位置情報を取得中..."}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* 投稿モーダル */}
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

            <div className="flex gap-2 mb-4">
              {POST_TYPES.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => { setPostType(type); setAnonymous(false); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition ${
                    postType === type ? "bg-indigo-600 text-white border-indigo-600" : "bg-gray-50 text-gray-500 border-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mb-4 -mt-2">
              {POST_TYPES.find((t) => t.type === postType)?.desc}
            </p>

            {(postType === "board" || postType === "announcement") && (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                placeholder="タイトル"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition mb-3"
              />
            )}

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="内容を入力..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition resize-none mb-4"
            />

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
    </>
  );
}
