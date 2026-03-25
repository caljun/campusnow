import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import type { MapPost, PostCategory } from "../types";

const CATEGORY_COLORS: Record<PostCategory, string> = {
  "サークル": "#6366f1",
  "飲み会": "#f97316",
  "就活": "#10b981",
};

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  return `${Math.floor(min / 60)}時間前`;
}

const CATEGORIES: PostCategory[] = ["サークル", "飲み会", "就活"];

export default function ListPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<MapPost[]>([]);
  const [filter, setFilter] = useState<PostCategory | "すべて">("すべて");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "mapPosts"), (snap) => {
      setPosts(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as MapPost))
          .sort((a, b) => b.createdAt - a.createdAt)
      );
    });
    return unsub;
  }, []);

  const filtered = filter === "すべて" ? posts : posts.filter((p) => p.category === filter);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-end justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">投稿</h1>
            <p className="text-xs text-gray-400 mt-0.5">QUINTBRIDGE</p>
          </div>
          <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-xs font-medium">{posts.length}件</span>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {(["すべて", ...CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition"
              style={
                filter === cat && cat !== "すべて"
                  ? { backgroundColor: CATEGORY_COLORS[cat as PostCategory], color: "#fff", borderColor: CATEGORY_COLORS[cat as PostCategory] }
                  : filter === cat
                  ? { backgroundColor: "#111827", color: "#fff", borderColor: "#111827" }
                  : { backgroundColor: "#f9fafb", color: "#6b7280", borderColor: "#e5e7eb" }
              }
            >
              {cat}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">投稿がありません</p>
            <p className="text-xs text-gray-400 mt-1">QUINTBRIDGEで最初の投稿をしてみよう</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((post) => {
              const isMine = post.uid === user?.uid;
              const label = post.anonymous ? "匿名" : post.displayName;
              const color = CATEGORY_COLORS[post.category];
              return (
                <div
                  key={post.id}
                  className="bg-white rounded-2xl px-4 py-4 border border-gray-100 hover:border-gray-200 transition"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                      style={{ backgroundColor: color + "18", color }}
                    >
                      {post.category}
                    </span>
                    {isMine && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">
                        自分
                      </span>
                    )}
                    <span className="text-[11px] text-gray-400 ml-auto">{timeAgo(post.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-800 mb-2 leading-relaxed">{post.text}</p>
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
