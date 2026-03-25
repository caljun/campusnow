import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function StartPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", cred.user.uid), {
          uid: cred.user.uid,
          displayName: name,
          email,
          department: "",
          bio: "",
        });
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const snap = await getDoc(doc(db, "users", cred.user.uid));
        if (!snap.exists()) {
          setError("プロフィールが見つかりません");
          setLoading(false);
          return;
        }
      }
      navigate("/home");
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "";
      if (msg.includes("email-already-in-use")) setError("このメールはすでに使われています");
      else if (msg.includes("wrong-password") || msg.includes("invalid-credential")) setError("メールまたはパスワードが違います");
      else if (msg.includes("user-not-found")) setError("ユーザーが見つかりません");
      else if (msg.includes("weak-password")) setError("パスワードは6文字以上にしてください");
      else setError("エラーが発生しました");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Desktop: left branding panel */}
      <div className="hidden md:flex flex-col justify-between w-1/2 bg-indigo-600 p-12 text-white">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CampusNow</h1>
          <p className="text-indigo-200 text-sm mt-1">今、ここにいる人と繋がろう</p>
        </div>
        <div className="space-y-6">
          {[
            { icon: "📍", title: "チェックインで存在を共有", desc: "施設内にいることだけを伝える。詳細な位置情報は公開しない。" },
            { icon: "👥", title: "中間距離の人間関係", desc: "LINEするほどじゃないけど、会えば話せる人と自然に繋がれる。" },
            { icon: "🗺️", title: "マップ掲示板", desc: "チェックイン中だけ投稿できる匿名の地図ボード。友達なら実名表示。" },
          ].map((f) => (
            <div key={f.title} className="flex gap-4 items-start">
              <span className="text-2xl mt-0.5">{f.icon}</span>
              <div>
                <p className="font-semibold text-sm">{f.title}</p>
                <p className="text-indigo-200 text-xs mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-indigo-300 text-xs">対象施設: QUINTBRIDGE（大阪）</p>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="md:hidden text-center mb-8">
            <h1 className="text-2xl font-bold text-indigo-600">CampusNow</h1>
            <p className="text-gray-400 text-sm mt-1">今、ここにいる人と繋がろう</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-lg font-bold text-gray-800 mb-6">
              {mode === "login" ? "ログイン" : "アカウント作成"}
            </h2>

            {/* Tab */}
            <div className="flex rounded-xl bg-gray-100 p-1 mb-6 gap-1">
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    mode === m ? "bg-white shadow-sm text-indigo-600" : "text-gray-500"
                  }`}
                >
                  {m === "login" ? "ログイン" : "新規登録"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "register" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">名前</label>
                  <input
                    type="text"
                    placeholder="山田 太郎"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">メールアドレス</label>
                <input
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">パスワード</label>
                <input
                  type="password"
                  placeholder="6文字以上"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 transition"
                />
              </div>
              {error && (
                <div className="bg-red-50 text-red-500 text-xs px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
              >
                {loading ? "処理中..." : mode === "login" ? "ログイン" : "アカウントを作成"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
