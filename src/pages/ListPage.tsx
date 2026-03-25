import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import Layout from "../components/Layout";
import type { UserProfile, FriendRequest } from "../types";

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  return `${Math.floor(min / 60)}時間前`;
}

function Avatar({ name, color = "indigo", size = "md" }: { name: string; color?: "indigo" | "emerald"; size?: "md" | "lg" }) {
  const sizeClass = size === "lg" ? "w-12 h-12 text-lg" : "w-10 h-10 text-sm";
  const colorClass = color === "emerald"
    ? "bg-emerald-100 text-emerald-600"
    : "bg-indigo-100 text-indigo-600";
  return (
    <div className={`${sizeClass} ${colorClass} rounded-full flex items-center justify-center font-bold flex-shrink-0`}>
      {name.charAt(0)}
    </div>
  );
}

export default function ListPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, "users"), where("checkedIn", "==", true));
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map((d) => d.data() as UserProfile));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const q1 = query(collection(db, "friendRequests"), where("fromUid", "==", user.uid));
    const q2 = query(collection(db, "friendRequests"), where("toUid", "==", user.uid));
    const unsub1 = onSnapshot(q1, (snap) => {
      setRequests((prev) => [
        ...prev.filter((r) => r.fromUid !== user.uid),
        ...snap.docs.map((d) => ({ id: d.id, ...d.data() } as FriendRequest)),
      ]);
    });
    const unsub2 = onSnapshot(q2, (snap) => {
      setRequests((prev) => [
        ...prev.filter((r) => r.toUid !== user.uid),
        ...snap.docs.map((d) => ({ id: d.id, ...d.data() } as FriendRequest)),
      ]);
    });
    return () => { unsub1(); unsub2(); };
  }, [user]);

  const getRelation = (targetUid: string) =>
    requests.find(
      (r) =>
        (r.fromUid === user?.uid && r.toUid === targetUid) ||
        (r.toUid === user?.uid && r.fromUid === targetUid)
    ) ?? null;

  const sendRequest = async (toUid: string) => {
    if (!user) return;
    setSending(toUid);
    await addDoc(collection(db, "friendRequests"), {
      fromUid: user.uid,
      toUid,
      status: "pending",
      createdAt: Date.now(),
    });
    setSending(null);
  };

  const me = users.find((u) => u.uid === user?.uid);
  const others = users.filter((u) => u.uid !== user?.uid);
  const sorted = me ? [me, ...others] : others;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">今ここにいる人</h1>
            <p className="text-xs text-gray-400 mt-0.5">QUINTBRIDGE</p>
          </div>
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium">{sorted.length}人</span>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-500">今チェックインしている人はいません</p>
            <p className="text-xs text-gray-400 mt-1">あなたがチェックインして最初の一人になりませんか？</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((u) => {
              const isMe = u.uid === user?.uid;
              const rel = getRelation(u.uid);
              const isFriend = rel?.status === "accepted";
              const isPending = rel?.status === "pending";

              return (
                <div
                  key={u.uid}
                  className="bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 border border-gray-100 hover:border-gray-200 transition"
                >
                  <Avatar name={u.displayName} color={isMe ? "indigo" : isFriend ? "emerald" : "indigo"} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm truncate">{u.displayName}</p>
                      {isMe ? (
                        <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                          自分
                        </span>
                      ) : isFriend && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                          友達
                        </span>
                      )}
                    </div>
                    {u.department && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{u.department}</p>
                    )}
                    {u.checkedInAt && (
                      <p className="text-[11px] text-gray-300 mt-0.5">{timeAgo(u.checkedInAt)}にチェックイン</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    {isMe ? null : isFriend ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    ) : isPending ? (
                      <span className="text-xs bg-gray-100 text-gray-400 px-3 py-1.5 rounded-full">申請中</span>
                    ) : (
                      <button
                        onClick={() => sendRequest(u.uid)}
                        disabled={sending === u.uid}
                        className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-full font-medium disabled:opacity-50 hover:bg-indigo-700 transition"
                      >
                        {sending === u.uid ? "..." : "申請"}
                      </button>
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
