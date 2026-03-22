import { Component, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams } from "react-router-dom";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || "Unknown error"
    };
  }

  componentDidCatch(error, info) {
    console.error("App render failed", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "#16171d",
            color: "#f8fafc"
          }}
        >
          <div
            style={{
              width: "min(640px, 100%)",
              padding: 24,
              borderRadius: 18,
              border: "1px solid #2e303a",
              background: "linear-gradient(180deg, #1b1d24 0%, #14161c 100%)",
              boxShadow: "0 18px 50px rgba(0, 0, 0, 0.35)"
            }}
          >
            <h2 style={{ marginBottom: 12 }}>Something went wrong loading the forum</h2>
            <p style={{ color: "#cbd5e1" }}>{this.state.message}</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
      .accent-purple {
        color: #c084fc;
      }

      .app-topbar {
        position: sticky;
        top: 0;
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 20px;
        border-bottom: 1px solid #2e303a;
        background: rgba(11, 15, 18, 0.92);
        backdrop-filter: blur(14px);
      }

      .app-brand {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        color: #f8fafc;
        font-size: 28px;
        font-weight: 800;
        letter-spacing: -0.03em;
        text-decoration: none;
      }

      .app-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .app-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 10px 16px;
        border-radius: 999px;
        background: #1f2937;
        color: #f8fafc;
        text-decoration: none;
        font-weight: 700;
        border: 1px solid #374151;
      }

      .app-chip.primary {
        background: #c084fc;
        border-color: #d8b4fe;
        color: #14081d;
      }

      .home-shell {
        display: grid;
        grid-template-columns: 240px minmax(0, 1fr);
        gap: 24px;
        width: min(1280px, 100%);
        margin: 0 auto;
        padding: 24px 20px 32px;
        box-sizing: border-box;
      }

      .home-sidebar {
        position: sticky;
        top: 86px;
        align-self: start;
        padding: 18px;
        border: 1px solid #2e303a;
        border-radius: 18px;
        background: linear-gradient(180deg, #161a20 0%, #101318 100%);
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.24);
      }

      .board-link {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border-radius: 14px;
        color: #dbe4ee;
        text-decoration: none;
        font-weight: 600;
      }

      .board-link.active,
      .board-link:hover {
        background: #252b34;
      }

      .board-bubble {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border-radius: 14px;
        background: #252b34;
        color: #f8fafc;
        font-weight: 700;
      }

      .home-feed {
        min-width: 0;
      }

      .feed-hero {
        margin-bottom: 18px;
        padding: 18px 20px;
        border: 1px solid #2e303a;
        border-radius: 18px;
        background: linear-gradient(180deg, #161a20 0%, #101318 100%);
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.24);
      }

      .feed-hero-copy {
        min-width: 0;
      }

      .feed-hero-title {
        color: #f8fafc;
        font-family: var(--heading);
        font-size: 38px;
        font-weight: 800;
        letter-spacing: -0.04em;
        line-height: 0.96;
      }

      .content-card {
        padding: 20px;
        border: 1px solid #2e303a;
        border-radius: 18px;
        background: linear-gradient(180deg, #1b1d24 0%, #14161c 100%);
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.2);
      }

      .feed-post-title {
        margin: 0 0 10px;
        color: #f8fafc;
        font-size: 24px;
        line-height: 1.2;
        text-decoration: none;
      }

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

      @media (max-width: 900px) {
        .app-topbar {
          padding: 12px 14px;
        }

        .app-brand {
          font-size: 22px;
        }

        .app-actions {
          gap: 8px;
        }

        .app-chip {
          padding: 9px 12px;
          font-size: 14px;
        }

        .home-shell {
          grid-template-columns: 1fr;
          padding: 16px 14px 24px;
        }

        .home-sidebar {
          position: static;
        }

        .feed-hero {
          margin-bottom: 14px;
        }

        .feed-hero-title {
          font-size: 34px;
        }
      }
    `}</style>
  );
}

const BOARDS = [
  { name: "News", icon: "📰" },
  { name: "Sports", icon: "🏈" },
  { name: "Random", icon: "🎲" },
  { name: "Jail", icon: "🚔" }
];

function BoardsSidebar({ activeBoard = "", showHappening = false }) {
  return (
    <aside className="home-sidebar">
      <div
        style={{
          marginBottom: 12,
          color: "#94a3b8",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase"
        }}
      >
        Boards
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        {showHappening && (
          <div className="board-bubble">
            <span>👻</span>
            <span>Happening now</span>
          </div>
        )}

        {BOARDS.map((board) => (
          <a
            key={board.name}
            href="#"
            className={`board-link${board.name === activeBoard ? " active" : ""}`}
            onClick={(event) => event.preventDefault()}
          >
            <span>{board.icon}</span>
            <span>{board.name}</span>
          </a>
        ))}
      </div>
    </aside>
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
    <div className="home-shell">
      <BoardsSidebar showHappening />

      <main className="home-feed">
        <div className="feed-hero">
          <div className="feed-hero-title">👻 Happening now</div>
        </div>

        {posts.map((p) => {
          const isMod = isModPost(p);

          return (
            <div key={p.id} className="content-card" style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 10,
                  color: "#94a3b8",
                  fontSize: 14
                }}
              >
                <span style={{ color: isMod ? "#c084fc" : getUserColor(p.browser_id), fontWeight: 700 }}>
                  {isMod && "👤 "}
                  {p.username || `Anon #${shortId(p.browser_id)}`}
                </span>
                <span>•</span>
                <span>{timeAgo(p.last_activity || p.created_at)}</span>
              </div>

              <div style={{ marginBottom: 10, color: "#f8fafc" }}>
                {p.pinned && <b>📌 PINNED</b>}
                {p.locked && <b style={{ color: "#f87171" }}> 🔒</b>}
              </div>

              <Link to={`/post/${p.id}`} className="feed-post-title">
                <h3 className="feed-post-title">
                  {p.title}
                </h3>
              </Link>

              <p style={{ marginBottom: 12, color: "#cbd5e1" }}>{p.content}</p>
            </div>
          );
        })}
      </main>
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
        border: "1px solid #2e303a",
        borderRadius: 18,
        background: "linear-gradient(180deg, #1b1d24 0%, #14161c 100%)",
        boxShadow: "0 18px 50px rgba(0, 0, 0, 0.35)",
        textAlign: "left"
      }}
    >
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ marginBottom: 0 }}>New Post</h2>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              color: "#cbd5e1"
            }}
          >
            Title
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give the thread a title"
            disabled={isSending}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px solid #3f4756",
              fontSize: 16,
              background: "#0f1117",
              color: "#f8fafc"
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              color: "#cbd5e1"
            }}
          >
            Body
          </span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What’s going on?"
            disabled={isSending}
            rows={8}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "16px",
              borderRadius: 14,
              border: "1px solid #3f4756",
              fontSize: 16,
              resize: "vertical",
              background: "#0f1117",
              color: "#f8fafc",
              minHeight: 220
            }}
          />
        </label>

        <div
          style={{
            padding: "14px 16px",
            borderRadius: 14,
            background: "#1f2028",
            color: "#f8fafc",
            border: "1px solid #323745",
            animation: isSending ? "composerPulse 1s ease-in-out infinite" : "none"
          }}
        >
          <b>{isSending ? "Sending post..." : "Ready to post"}</b>
          <div style={{ marginTop: 4, fontSize: 14, color: "#9ca3af" }}>
            {isSending ? "Pushing your thread live now." : "Your title and body will go up together."}
          </div>
        </div>

        <button
          onClick={createPost}
          disabled={isSending}
          style={{
            width: "100%",
            padding: "14px 18px",
            borderRadius: 14,
            border: "none",
            background: isSending ? "#0f172a" : "#2563eb",
            color: "#fff",
            fontWeight: 700,
            fontSize: 15,
            cursor: isSending ? "default" : "pointer",
            boxShadow: isSending ? "none" : "0 14px 30px rgba(37, 99, 235, 0.28)"
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
    <div className="home-shell">
      <BoardsSidebar activeBoard="News" />

      <main className="home-feed" style={{ textAlign: "left" }}>
        <div className="feed-hero">
          <Link to="/" className="feed-hero-title">
            Happening now
          </Link>
        </div>

        <div className="content-card" style={{ marginBottom: 16 }}>
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
                borderLeft: "4px solid #c084fc",
                marginBottom: 10,
                padding: 10,
                background: "#23182f",
                borderRadius: 10,
                animation: "livePop 0.25s ease-out, composerPulse 1s ease-in-out infinite"
              }}
            >
              <b style={{ color: "#c084fc" }}>You</b>
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
            <div style={{ marginTop: 16, maxWidth: 560 }}>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write a comment..."
                disabled={isSendingComment}
                rows={4}
                style={{
                  width: "100%",
                  maxWidth: 560,
                  boxSizing: "border-box",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #cbd5e1",
                  resize: "vertical",
                  fontSize: 16
                }}
              />
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={addComment}
                  disabled={isSendingComment}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: 14,
                    border: "none",
                    background: isSendingComment ? "#3b1f52" : "#c084fc",
                    color: "#14081d",
                    fontWeight: 700,
                    fontSize: 15,
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
      </main>
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
    <ErrorBoundary>
      <Router>
        <RealtimeStyles />
        <nav className="app-topbar">
          <Link to="/" className="app-brand">👻 daboysforum</Link>

          <div className="app-actions">
            <Link to="/new" className="app-chip">New Post</Link>
            <Link to="/mod" className="app-chip primary">
              {user ? `👤 ${modName}` : "Log In"}
            </Link>
          </div>
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
    </ErrorBoundary>
  );
}
