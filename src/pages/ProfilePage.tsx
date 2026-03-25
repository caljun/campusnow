import { useState, useEffect } from "react";
import { doc, setDoc, deleteDoc, collection, query, where, onSnapshot, getDocs } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import type { Post } from "../types";

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  return `${Math.floor(min / 60)}時間前`;
}

const TYPE_LABELS: Record<string, string> = {
  post: "投稿",
  board: "掲示板",
  announcement: "告知",
};

const TYPE_COLORS: Record<string, string> = {
  post: "#6366f1",
  board: "#f97316",
  announcement: "#10b981",
};

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [department, setDepartment] = useState(profile?.department ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<Post | null>(null);

  useEffect(() => {
    setDisplayName(profile?.displayName ?? "");
    setDepartment(profile?.department ?? "");
    setBio(profile?.bio ?? "");
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "posts"), where("uid", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setMyPosts(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Post))
          .sort((a, b) => b.createdAt - a.createdAt)
      );
    });
    return unsub;
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await setDoc(doc(db, "users", user.uid), { uid: user.uid, email: user.email ?? "", displayName, department, bio }, { merge: true });
    await refreshProfile();
    setSaving(false);
    setEditing(false);
  };

  const handleDeletePost = async () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === "board") {
      const repliesSnap = await getDocs(collection(db, "posts", deleteConfirm.id, "replies"));
      await Promise.all(repliesSnap.docs.map((r) => deleteDoc(r.ref)));
    }
    await deleteDoc(doc(db, "posts", deleteConfirm.id));
    setDeleteConfirm(null);
  };

  const handleLogout = async () => { await signOut(auth); navigate("/"); };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Delete confirm modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirm(null)} />
            <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl">
              <p className="text-sm text-gray-800 mb-1 font-semibold">投稿を削除しますか？</p>
              <p className="text-xs text-gray-400 mb-5 leading-relaxed line-clamp-2">
                {deleteConfirm.title ?? deleteConfirm.text}
                {deleteConfirm.type === "board" && "（返信もすべて削除されます）"}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 border border-gray-200 text-gray-500 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">
                  キャンセル
                </button>
                <button onClick={handleDeletePost} className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-red-600 transition">
                  削除する
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit modal */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(false)} />
            <div className="relative bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl px-5 pt-5 pb-8 md:pb-6 space-y-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-gray-900 text-base">プロフィールを編集</h3>
                <button onClick={() => setEditing(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">名前</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="名前"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">学部・所属</label>
                <input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="例: 工学部 3年"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">自己紹介</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="一言自己紹介..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition resize-none"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditing(false)} className="flex-1 border border-gray-200 text-gray-500 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">
                  キャンセル
                </button>
                <button onClick={handleSave} disabled={saving} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50">
                  {saving ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Profile card */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="h-20 bg-gradient-to-r from-indigo-500 to-indigo-600" />
          <div className="px-5 pb-5">
            <div className="flex items-end justify-between -mt-8 mb-4">
              <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border-2 border-white flex items-center justify-center text-indigo-600 font-bold text-2xl">
                {profile?.displayName?.charAt(0) ?? "?"}
              </div>
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-indigo-600 border border-indigo-200 bg-indigo-50 px-3 py-1.5 rounded-full font-medium hover:bg-indigo-100 transition"
              >
                編集
              </button>
            </div>
            <p className="font-bold text-gray-900 text-lg leading-tight">{profile?.displayName}</p>
            {profile?.department && <p className="text-sm text-gray-400 mt-0.5">{profile.department}</p>}
            {profile?.bio && <p className="text-sm text-gray-600 mt-3 leading-relaxed">{profile.bio}</p>}
            {!profile?.bio && !profile?.department && (
              <p className="text-sm text-gray-300 mt-1">プロフィールを編集して自己紹介を追加しよう</p>
            )}
          </div>
        </div>

        {/* My posts */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-800 text-sm">自分の投稿</h2>
            <span className="text-xs text-gray-400 font-medium">{myPosts.length}件</span>
          </div>
          {myPosts.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-gray-400">まだ投稿がありません</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {myPosts.map((post) => (
                <div key={post.id} className="px-5 py-4 flex gap-3 items-start">
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0"
                    style={{ backgroundColor: (TYPE_COLORS[post.type] ?? "#6366f1") + "18", color: TYPE_COLORS[post.type] ?? "#6366f1" }}
                  >
                    {TYPE_LABELS[post.type] ?? post.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    {post.title && <p className="text-xs font-semibold text-gray-700 mb-0.5">{post.title}</p>}
                    <p className="text-sm text-gray-700">{post.text}</p>
                    <p className="text-xs text-gray-400 mt-1">{timeAgo(post.createdAt)}</p>
                  </div>
                  <button
                    onClick={() => setDeleteConfirm(post)}
                    className="flex-shrink-0 w-7 h-7 rounded-full hover:bg-red-50 flex items-center justify-center transition"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full text-sm text-gray-400 py-3 hover:text-red-400 transition flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          ログアウト
        </button>
      </div>
    </Layout>
  );
}
