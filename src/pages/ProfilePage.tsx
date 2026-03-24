import { useState, useEffect } from "react";
import { doc, updateDoc, setDoc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import type { FriendRequest, UserProfile } from "../types";

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [department, setDepartment] = useState(profile?.department ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [pendingIncoming, setPendingIncoming] = useState<(FriendRequest & { fromProfile?: UserProfile })[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<UserProfile | null>(null);

  useEffect(() => {
    setDisplayName(profile?.displayName ?? "");
    setDepartment(profile?.department ?? "");
    setBio(profile?.bio ?? "");
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "friendRequests"), where("toUid", "==", user.uid), where("status", "==", "pending"));
    const unsub = onSnapshot(q, async (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FriendRequest));
      const withProfiles = await Promise.all(
        list.map(async (req) => {
          const uSnap = await getDocs(query(collection(db, "users"), where("uid", "==", req.fromUid)));
          return { ...req, fromProfile: uSnap.docs[0]?.data() as UserProfile | undefined };
        })
      );
      setPendingIncoming(withProfiles);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q1 = query(collection(db, "friendRequests"), where("fromUid", "==", user.uid), where("status", "==", "accepted"));
    const q2 = query(collection(db, "friendRequests"), where("toUid", "==", user.uid), where("status", "==", "accepted"));
    const fetchFriends = async () => {
      const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const uids = [...s1.docs.map((d) => d.data().toUid as string), ...s2.docs.map((d) => d.data().fromUid as string)];
      if (uids.length === 0) { setFriends([]); return; }
      const profiles = await Promise.all(
        uids.map(async (uid) => {
          const snap = await getDocs(query(collection(db, "users"), where("uid", "==", uid)));
          return snap.docs[0]?.data() as UserProfile | undefined;
        })
      );
      setFriends(profiles.filter(Boolean) as UserProfile[]);
    };
    const unsub1 = onSnapshot(q1, fetchFriends);
    const unsub2 = onSnapshot(q2, fetchFriends);
    return () => { unsub1(); unsub2(); };
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    await setDoc(doc(db, "users", user.uid), { uid: user.uid, email: user.email ?? "", displayName, department, bio }, { merge: true });
    await refreshProfile();
    setSaving(false);
    setEditing(false);
  };

  const handleAccept = (reqId: string) => updateDoc(doc(db, "friendRequests", reqId), { status: "accepted" });
  const handleReject = (reqId: string) => updateDoc(doc(db, "friendRequests", reqId), { status: "rejected" });
  const handleLogout = async () => { await signOut(auth); navigate("/"); };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Friend profile modal */}
        {selectedFriend && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedFriend(null)} />
            <div className="relative bg-white w-full md:max-w-sm md:rounded-2xl rounded-t-2xl overflow-hidden">
              <div className="h-16 bg-gradient-to-r from-emerald-400 to-emerald-500" />
              <div className="px-5 pb-8">
                <div className="flex items-end justify-between -mt-7 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border-2 border-white flex items-center justify-center text-emerald-600 font-bold text-2xl">
                    {selectedFriend.displayName.charAt(0)}
                  </div>
                  <button
                    onClick={() => setSelectedFriend(null)}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-gray-900 text-lg leading-tight">{selectedFriend.displayName}</p>
                  <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full font-medium">友達</span>
                </div>
                {selectedFriend.department && (
                  <p className="text-sm text-gray-400">{selectedFriend.department}</p>
                )}
                {selectedFriend.bio ? (
                  <p className="text-sm text-gray-600 mt-3 leading-relaxed">{selectedFriend.bio}</p>
                ) : (
                  <p className="text-sm text-gray-300 mt-3">自己紹介はまだありません</p>
                )}
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

        {/* Pending requests */}
        {pendingIncoming.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800 text-sm">友達申請</h2>
              <span className="text-xs bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center font-medium">
                {pendingIncoming.length}
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {pendingIncoming.map((req) => (
                <div key={req.id} className="px-5 py-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                    {req.fromProfile?.displayName?.charAt(0) ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{req.fromProfile?.displayName ?? "不明"}</p>
                    {req.fromProfile?.department && <p className="text-xs text-gray-400 truncate">{req.fromProfile.department}</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleReject(req.id)} className="text-xs px-3 py-1.5 border border-gray-200 text-gray-500 rounded-full hover:bg-gray-50 transition">
                      拒否
                    </button>
                    <button onClick={() => handleAccept(req.id)} className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-full font-medium hover:bg-indigo-700 transition">
                      承認
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-800 text-sm">友達</h2>
            <span className="text-xs text-gray-400 font-medium">{friends.length}人</span>
          </div>
          {friends.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <line x1="23" y1="11" x2="17" y2="11" /><line x1="20" y1="8" x2="20" y2="14" />
                </svg>
              </div>
              <p className="text-sm text-gray-400">まだ友達がいません</p>
              <p className="text-xs text-gray-300 mt-1">「いる人」ページから申請してみよう</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {friends.map((f) => (
                <button
                  key={f.uid}
                  onClick={() => setSelectedFriend(f)}
                  className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm flex-shrink-0">
                    {f.displayName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{f.displayName}</p>
                    {f.department && <p className="text-xs text-gray-400 truncate">{f.department}</p>}
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
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
