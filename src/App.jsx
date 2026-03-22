import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams } from "react-router-dom";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ==============================
// HELPERS
// ==============================
function getUserColor(id) {
  if (!id) return "#ffffff";

  // simple hash → color
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = hash % 360;

  return `hsl(${hue}, 70%, 60%)`; // nice vibrant colors
}

function timeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function shortId(id) {
  return id?.slice(0, 6) || "??????";
}

function getBrowserId() {
  let id = localStorage.getItem("browser_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("browser_id", id);
  }
  return id;
}

function getModName() {
  return localStorage.getItem("mod_name") || "Mod";
}

function isModPost(record) {
  return record?.is_mod === true;
}

function buildModMetadata(user) {
  if (!user) {
    return {
      username: null,
      is_mod: false,
      moderator: false,
      author_role: "user",
      mod_user_id: null
    };
  }

  return {
    username: getModName(),
    is_mod: true,
    moderator: true,
    author_role: "mod",
    mod_user_id: user.id
  };
}

// ==============================
// AUTH HEADER
// ==============================
async function getAuthHeader() {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) {
    throw new Error("No active moderator session. Please log in again.");
  }

  return {
    Authorization: `Bearer ${data.session.access_token}`
  };
}

async function getOptionalAuthHeader() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token
    ? { Authorization: `Bearer ${data.session.access_token}` }
    : {};
}

function RealtimeStyles() {
  return (
    <style>{`
      @keyframes composerPulse {
        0% { opacity: 0.55; transform: scale(0.98); }
        50% { opacity: 1; transform: scale(1); }
        100% { opacity: 0.55; transform: scale(0.98); }
      }

      @keyframes sendFlight {
        0% { transform: translateX(0) translateY(0) scale(1); opacity: 1; }
        70% { transform: translateX(14px) translateY(-10px) scale(1.08); opacity: 1; }
        100% { transform: translateX(22px) translateY(-18px) scale(0.9); opacity: 0; }
      }

      @keyframes livePop {
        0% { opacity: 0; transform: translateY(10px); }
        100% { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  );
}

// ==============================
// MOD ACTION
// ==============================
async function modAction(action) {
  try {
    const headers = await getAuthHeader();

    const res = await fetch("https://daboysforumip.coldbrainarchive.workers.dev/mod-action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify(action)
    });

    const data = await res.json();
    if (!res.ok) alert(data.error);
  } catch (err) {
    alert(err.message);
  }
}

// ==============================
// AUTH
// ==============================
function Auth({ setUser }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const signIn = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else setUser(data.user);
  };

  return (
    <div>
      <h2>Moderator Login</h2>
      <input onChange={(e) => setEmail(e.target.value)} placeholder="email" />
      <input type="password" onChange={(e) => setPassword(e.target.value)} placeholder="password" />
      <button onClick={signIn}>Login</button>
    </div>
  );
}

// ==============================
// HOME
// ==============================
function Home() {
  const [posts, setPosts] = useState([]);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .eq("deleted", false)
      .order("pinned", { ascending: false })
      .order("last_activity", { ascending: false });

    setPosts(data || []);
  };

  useEffect(() => {
    fetchPosts();
    const i = setInterval(fetchPosts, 4000);
    return () => clearInterval(i);
  }, []);

  return (
    <div>
      <h1>Daboysforum 👻</h1>
      <Link to="/new">Create Post</Link>

      {posts.map((p) => {
        const isMod = isModPost(p);

        return (
          <div key={p.id} style={{ borderBottom: "1px solid #ccc", padding: 10 }}>
            {p.pinned && <b>📌 PINNED</b>}
            {p.locked && <b style={{ color: "red" }}> 🔒</b>}

            <Link to={`/post/${p.id}`}>
              <h3>{p.title}</h3>
            </Link>

            <p>{p.content}</p>

            <small>
              <b
  style={{
    color: isMod ? "#c084fc" : getUserColor(p.browser_id),
    fontWeight: "bold"
  }}
>
                {isMod && "👤 "}
                {p.username || `Anon #${shortId(p.browser_id)}`}
              </b>{" "}
              • {timeAgo(p.last_activity || p.created_at)}
            </small>
          </div>
        );
      })}
    </div>
  );
}

// ==============================
// CREATE POST (FIXED)
// ==============================
function NewPost() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  const createPost = async () => {
    try {
      if (!title.trim() || !content.trim()) return alert("Fill all fields");
      if (isSending) return;

      setIsSending(true);

      const { data } = await supabase.auth.getUser();
      const modMetadata = buildModMetadata(data.user);
      const authHeaders = await getOptionalAuthHeader();

      const res = await fetch("https://daboysforumip.coldbrainarchive.workers.dev/create-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          title,
          content,
          browser_id: getBrowserId(),
          ...modMetadata
        })
      });

      const result = await res.json();
      if (!res.ok) {
        setIsSending(false);
        if (result.error === "Banned") {
          alert("🚫 You are banned from posting");
        } else {
          alert(result.error);
        }
        return;
      }

      setTitle("");
      setContent("");
      setTimeout(() => {
        navigate("/");
      }, 450);
    } catch (err) {
      setIsSending(false);
      alert(err.message);
    }
  };

  return (
    <div
      style={{
        maxWidth: 720,
        margin: "24px auto",
        padding: 20,
        border: "1px solid #d4d4d8",
        borderRadius: 18,
        background: "linear-gradient(180deg, #ffffff 0%, #f5f7fb 100%)",
        boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)"
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ marginBottom: 6 }}>New Post</h2>
        <p style={{ margin: 0, color: "#475569" }}>
          Drop the title first, then write the full post underneath.
        </p>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>
            Title
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give the thread a title"
            disabled={isSending}
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              fontSize: 16
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" }}>
            Body
          </span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What’s going on?"
            disabled={isSending}
            rows={8}
            style={{
              padding: "16px",
              borderRadius: 14,
              border: "1px solid #cbd5e1",
              fontSize: 15,
              resize: "vertical"
            }}
          />
        </label>

        <div
          style={{
            padding: "14px 16px",
            borderRadius: 14,
            background: "#e0f2fe",
            color: "#0f172a",
            border: "1px solid #bae6fd",
            animation: isSending ? "composerPulse 1s ease-in-out infinite" : "none"
          }}
        >
          <b>{isSending ? "Sending post..." : "Ready to post"}</b>
          <div style={{ marginTop: 4, fontSize: 14, color: "#334155" }}>
            {isSending ? "Pushing your thread live now." : "Your title and body will go up together."}
          </div>
        </div>

        <button
          onClick={createPost}
          disabled={isSending}
          style={{
            justifySelf: "start",
            padding: "12px 18px",
            borderRadius: 999,
            border: "none",
            background: isSending ? "#0f172a" : "#2563eb",
            color: "#fff",
            fontWeight: 700,
            cursor: isSending ? "default" : "pointer"
          }}
        >
          <span
            style={{
              display: "inline-block",
              animation: isSending ? "sendFlight 0.8s ease-in-out infinite" : "none"
            }}
          >
            {isSending ? "Sending..." : "Post Thread"}
          </span>
        </button>
      </div>
    </div>
  );
}

// ==============================
// POST PAGE (WITH MOD CONTROLS 🔥)
// ==============================
function PostPage({ user }) {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [pendingComments, setPendingComments] = useState([]);

  const isMod = !!user;

  const load = async () => {
    const { data: p } = await supabase
      .from("posts")
      .select("*")
      .eq("id", id)
      .single();

    const { data: c } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", id)
      .eq("deleted", false)
      .order("created_at");

    setPost(p);
    setComments(c || []);
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 2000);
    return () => clearInterval(i);
  }, [id]);

  const addComment = async () => {
    if (!text.trim() || post?.locked) return;
    if (isSendingComment) return;

    try {
      const pendingContent = text;
      const pendingId = crypto.randomUUID();
      setIsSendingComment(true);
      setPendingComments((current) => [
        ...current,
        {
          id: pendingId,
          content: pendingContent,
          created_at: new Date().toISOString()
        }
      ]);

      const { data } = await supabase.auth.getUser();
      const modMetadata = buildModMetadata(data.user);
      const authHeaders = await getOptionalAuthHeader();

      const res = await fetch(
        "https://daboysforumip.coldbrainarchive.workers.dev/add-comment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders
          },
          body: JSON.stringify({
            content: pendingContent,
            post_id: id,
            browser_id: getBrowserId(),
            ...modMetadata
          })
        }
      );

      const result = await res.json();
      if (!res.ok) {
        setPendingComments((current) => current.filter((comment) => comment.id !== pendingId));
        setIsSendingComment(false);
        if (result.error === "Banned") {
          alert("🚫 You are banned from commenting");
        } else {
          alert(result.error);
        }
        return;
      }

      setText("");
      setPendingComments((current) => current.filter((comment) => comment.id !== pendingId));
      setIsSendingComment(false);
      load();
    } catch (err) {
      setPendingComments([]);
      setIsSendingComment(false);
      console.error(err);
      alert("Failed to send comment");
    }
  };

  if (!post) return <div>Loading...</div>;

  return (
    <div>
      <h2>{post.title}</h2>
      <p>{post.content}</p>

      {post.locked && <b style={{ color: "red" }}>🔒 Locked</b>}

      {/* 🔥 MOD CONTROLS (POST) */}
      {isMod && (
        <div style={{ marginBottom: 10 }}>
          <button onClick={() => modAction({ type: "delete_post", post_id: post.id })}>
            🗑 Delete
          </button>

          <button
            onClick={async () => {
              await supabase
                .from("posts")
                .update({ pinned: !post.pinned })
                .eq("id", post.id);
              load();
            }}
          >
            {post.pinned ? "Unpin" : "📌 Pin"}
          </button>

          <button
            onClick={async () => {
              await supabase
                .from("posts")
                .update({ locked: !post.locked })
                .eq("id", post.id);
              load();
            }}
          >
            {post.locked ? "Unlock" : "🔒 Lock"}
          </button>
        </div>
      )}

      {/* COMMENTS */}
      {pendingComments.map((c) => (
        <div
          key={c.id}
          style={{
            borderLeft: "4px solid #38bdf8",
            marginBottom: 10,
            padding: 10,
            background: "#f0f9ff",
            borderRadius: 10,
            animation: "livePop 0.25s ease-out, composerPulse 1s ease-in-out infinite"
          }}
        >
          <b style={{ color: "#0284c7" }}>You</b>
          <small> sending now...</small>
          <p style={{ marginBottom: 0 }}>{c.content}</p>
        </div>
      ))}

      {comments.map((c) => {
        const isModUser = isModPost(c);

        return (
          <div
            key={c.id}
            style={{
              borderLeft: "4px solid #ccc",
              marginBottom: 10,
              padding: 5
            }}
          >
            <b
              style={{
                color: isModUser ? "#c084fc" : getUserColor(c.browser_id),
                fontWeight: "bold"
              }}
            >
              {isModUser && "👤 "}
              {c.username || `Anon #${shortId(c.browser_id)}`}
              {c.browser_id === post.browser_id && " (OP)"}
            </b>

            <small> {timeAgo(c.created_at)}</small>
            <p>{c.content}</p>

            {/* 🔥 MOD DELETE COMMENT */}
            {isMod && (
              <button
                onClick={() =>
                  modAction({ type: "delete_comment", comment_id: c.id })
                }
              >
                🗑 Delete
              </button>
            )}
          </div>
        );
      })}

      {/* COMMENT BOX */}
      {!post.locked && (
        <div style={{ marginTop: 10 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a comment..."
            disabled={isSendingComment}
            rows={4}
            style={{
              width: "100%",
              maxWidth: 560,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #cbd5e1",
              resize: "vertical"
            }}
          />
          <div style={{ marginTop: 10 }}>
            <button
              onClick={addComment}
              disabled={isSendingComment}
              style={{
                padding: "10px 16px",
                borderRadius: 999,
                border: "none",
                background: isSendingComment ? "#0f172a" : "#2563eb",
                color: "#fff",
                fontWeight: 700,
                cursor: isSendingComment ? "default" : "pointer"
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  animation: isSendingComment ? "sendFlight 0.8s ease-in-out infinite" : "none"
                }}
              >
                {isSendingComment ? "Sending..." : "Send"}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
// ==============================
// MOD PANEL (FINAL)
// ==============================
function ModPanel({ setModName }) {
  const [name, setName] = useState(localStorage.getItem("mod_name") || "");
  const [users, setUsers] = useState([]);
  const [bans, setBans] = useState([]);
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // LOAD DATA
  const load = async () => {
    const { data: posts } = await supabase.from("posts").select("*");
    const { data: comments } = await supabase.from("comments").select("*");
    const { data: bans } = await supabase.from("bans").select("*");
    const { data: userData } = await supabase.auth.getUser();

    setBans(bans || []);
    setEmail(userData?.user?.email || "");

    const all = [...(posts || []), ...(comments || [])];
    const map = {};

    all.forEach((u) => {
      if (!u.browser_id) return;

      map[u.browser_id] = {
  browser_id: u.browser_id,
  username: u.username || `Anon #${shortId(u.browser_id)}`,
  ip_hash: u.ip_hash // 🔥 ADD THIS
};
    });

    setUsers(Object.values(map));
  };

  useEffect(() => {
    load();
  }, []);

  // SAVE MOD NAME
  const saveName = () => {
    localStorage.setItem("mod_name", name);
    setModName(name);
    alert("Saved!");
  };

  // LOGOUT
  const logout = async () => {
    await supabase.auth.signOut();
  };

  // UPDATE EMAIL
  const updateEmail = async () => {
    if (!newEmail) return;

    const { error } = await supabase.auth.updateUser({ email: newEmail });

    if (error) return alert(error.message);

    alert("Check your email to confirm change 📧");
    setNewEmail("");
  };

  // UPDATE PASSWORD
  const updatePassword = async () => {
    if (!newPassword) return;

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) return alert(error.message);

    alert("Password updated 🔑");
    setNewPassword("");
  };

  // BAN SYSTEM
  const isBanned = (u) =>
  bans.some(
    (b) =>
      b.browser_id === u.browser_id ||
      b.ip_hash === u.ip_hash ||
      b.username === u.username
  );

  const toggleBan = async (u) => {
    if (isBanned(u)) {
      await supabase.from("bans").delete().eq("browser_id", u.browser_id);
    } else {
      await modAction({
        type: "ban",
        browser_id: u.browser_id,
        username: u.username,
        ip_hash: u.ip_hash
      });
    }
    load();
  };

  return (
    <div>
      <h2>Mod Panel</h2>

      {/* ACCOUNT */}
      <div style={{ marginBottom: 20 }}>
        <h3>Account</h3>

        <p><b>Email:</b> {email}</p>

        <button onClick={logout}>🚪 Logout</button>

        <div style={{ marginTop: 10 }}>
          <input
            placeholder="New email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <button onClick={updateEmail}>Update Email</button>
        </div>

        <div style={{ marginTop: 10 }}>
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button onClick={updatePassword}>Update Password</button>
        </div>
      </div>

      {/* MOD NAME */}
      <div style={{ marginBottom: 20 }}>
        <h3>Display Name</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <button onClick={saveName}>Save</button>
      </div>

      {/* USERS */}
      <h3>Users</h3>

      {users.map((u) => (
        <div key={u.browser_id} style={{ borderBottom: "1px solid #ccc", padding: 10 }}>
          <b>{u.username}</b>
          <br />
          <small>{u.browser_id}</small>
          <br />

          <span style={{ color: isBanned(u) ? "red" : "green" }}>
            {isBanned(u) ? "BANNED" : "ACTIVE"}
          </span>

          <br />
          <button onClick={() => toggleBan(u)}>
            {isBanned(u) ? "Unban" : "Ban"}
          </button>
        </div>
      ))}
    </div>
  );
}
// ==============================
// MAIN
// ==============================
export default function App() {
  const [user, setUser] = useState(null);
  const [modName, setModName] = useState(localStorage.getItem("mod_name") || "Mod");

  useEffect(() => {
  supabase.auth.getUser().then(({ data }) => setUser(data.user));

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (_event, session) => {
      setUser(session?.user || null);
    }
  );

  return () => {
    subscription.unsubscribe();
  };
}, []);
  return (
    <Router>
      <RealtimeStyles />
      <nav>
  <Link to="/">Home</Link> |{" "}
  <Link to="/mod">
    {user ? `👤 ${modName}` : "🔐 Login"}
  </Link>
</nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new" element={<NewPost />} />
        <Route path="/post/:id" element={<PostPage user={user} />} />
       <Route
  path="/mod"
  element={user ? <ModPanel setModName={setModName} /> : <Auth setUser={setUser} />}
/>
      </Routes>
    </Router>
  );
}
