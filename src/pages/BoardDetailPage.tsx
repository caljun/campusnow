import { useEffect, useState } from "react";
import { doc, getDoc, collection, onSnapshot, addDoc, updateDoc, increment, setDoc } from "firebase/firestore";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import type { Post, Reply } from "../types";

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  return `${Math.floor(min / 60)}時間前`;
}

export default function BoardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, "posts", id)).then((snap) => {
      if (snap.exists()) setPost({ id: snap.id, ...snap.data() } as Post);
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(
      collection(db, "posts", id, "replies"),
      (snap) => {
        const sorted = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Reply))
          .sort((a, b) => a.createdAt - b.createdAt);
        setReplies(sorted);
        // replyCountを実数に同期
        setDoc(doc(db, "posts", id), { replyCount: snap.size }, { merge: true });
      }
    );
    return unsub;
  }, [id]);

  const handleReply = async () => {
    if (!replyText.trim() || !id || !user) return;
    setSending(true);
    await addDoc(collection(db, "posts", id, "replies"), {
      uid: user.uid,
      displayName: profile?.displayName ?? "",
      text: replyText.trim(),
      createdAt: Date.now(),
    });
    await updateDoc(doc(db, "posts", id), { replyCount: increment(1) });
    setReplyText("");
    setSending(false);
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition mb-5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          タイムラインへ戻る
        </button>

        {post ? (
          <>
            {/* Original post */}
            <div className="bg-white rounded-2xl px-5 py-5 border border-gray-100 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-orange-50 text-orange-500">
                  掲示板
                </span>
                <span className="text-[11px] text-gray-400 ml-auto">{timeAgo(post.createdAt)}</span>
              </div>
              <p className="font-bold text-gray-900 text-base mb-2">{post.title}</p>
              <p className="text-sm text-gray-700 leading-relaxed mb-3">{post.text}</p>
              <p className="text-xs text-gray-400 font-medium">{post.displayName}</p>
            </div>

            {/* Replies */}
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
              返信 {replies.length}件
            </p>

            <div className="space-y-2 mb-5">
              {replies.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">まだ返信がありません。最初の返信をしてみよう</p>
              ) : (
                replies.map((reply) => {
                  const isMine = reply.uid === user?.uid;
                  return (
                    <div key={reply.id} className="bg-white rounded-2xl px-4 py-3.5 border border-gray-100">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs flex-shrink-0">
                          {reply.displayName.charAt(0)}
                        </div>
                        <span className="text-xs font-semibold text-gray-700">{reply.displayName}</span>
                        {isMine && (
                          <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">自分</span>
                        )}
                        <span className="text-[11px] text-gray-400 ml-auto">{timeAgo(reply.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed pl-9">{reply.text}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply input */}
            <div className="bg-white rounded-2xl px-4 py-4 border border-gray-100 flex gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                {profile?.displayName?.charAt(0) ?? "?"}
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  maxLength={300}
                  rows={2}
                  placeholder="返信する..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition resize-none"
                />
                <button
                  onClick={handleReply}
                  disabled={sending || !replyText.trim()}
                  className="self-end bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-40 hover:bg-indigo-700 transition"
                >
                  {sending ? "送信中..." : "返信"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-24 text-gray-400 text-sm">読み込み中...</div>
        )}
      </div>
    </Layout>
  );
}
