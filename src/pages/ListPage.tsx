import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import type { Post, PostType } from "../types";

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  return `${Math.floor(min / 60)}時間前`;
}

type Tab = "all" | PostType;

const TABS: { key: Tab; label: string }[] = [
  { key: "all",          label: "すべて" },
  { key: "post",         label: "投稿" },
  { key: "board",        label: "掲示板" },
  { key: "announcement", label: "告知" },
];

const TYPE_COLORS: Record<PostType, string> = {
  post:         "#6366f1",
  board:        "#f97316",
  announcement: "#10b981",
};

const TYPE_LABELS: Record<PostType, string> = {
  post:         "投稿",
  board:        "掲示板",
  announcement: "告知",
};

export default function ListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "posts"), (snap) => {
      setPosts(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Post))
          .sort((a, b) => b.createdAt - a.createdAt)
      );
    });
    return unsub;
  }, []);

  const filtered = tab === "all" ? posts : posts.filter((p) => p.type === tab);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-end justify-between mb-5">
          <h1 className="text-xl font-bold text-gray-900">タイムライン</h1>
          <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <span className="text-xs font-medium">{filtered.length}件</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition ${
                tab === key
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-gray-50 text-gray-500 border-gray-200"
              }`}
            >
              {label}
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
            <p className="text-sm font-medium text-gray-500">まだ投稿がありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((post) => {
              const isMine = post.uid === user?.uid;
              const color = TYPE_COLORS[post.type];
              const label = post.type === "post" && post.anonymous ? "匿名" : post.displayName;
              const isBoard = post.type === "board";

              return (
                <div
                  key={post.id}
                  onClick={() => isBoard && navigate(`/board/${post.id}`)}
                  className={`bg-white rounded-2xl px-4 py-4 border border-gray-100 transition ${
                    isBoard ? "hover:border-gray-300 cursor-pointer active:scale-[0.99]" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                      style={{ backgroundColor: color + "18", color }}
                    >
                      {TYPE_LABELS[post.type]}
                    </span>
                    {isMine && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">
                        自分
                      </span>
                    )}
                    <span className="text-[11px] text-gray-400 ml-auto">{timeAgo(post.createdAt)}</span>
                  </div>

                  {post.title && (
                    <p className="text-sm font-semibold text-gray-900 mb-1">{post.title}</p>
                  )}
                  <p className="text-sm text-gray-700 leading-relaxed mb-2">{post.text}</p>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400 font-medium">{label}</p>
                    {isBoard && (
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                          (post.replyCount ?? 0) > 0
                            ? "bg-orange-50 text-orange-500"
                            : "bg-gray-100 text-gray-400"
                        }`}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                          {post.replyCount ?? 0}件
                        </span>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
