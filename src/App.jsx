import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { BrowserRouter as Router, Routes, Route, Link, useParams } from "react-router-dom";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ==============================
// HELPERS
// ==============================
function timeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function shortId(hash) {
  return hash?.slice(0, 6) || "??????";
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
      <input placeholder="email" onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="password" type="password" onChange={(e) => setPassword(e.target.value)} />
      <button onClick={signIn}>Login</button>
    </div>
  );
}

// ==============================
// HOME (BUMP SYSTEM + PINNED)
// ==============================
function Home() {
  const [posts, setPosts] = useState([]);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from("posts")
      .select("*")
      .order("pinned", { ascending: false }) // pinned first
      .order("last_activity", { ascending: false }); // then bump

    setPosts(data || []);
  };

  useEffect(() => {
    fetchPosts();
    const interval = setInterval(fetchPosts, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h1>Daboysforum 👻</h1>
      <Link to="/new">Create Post</Link>

      {posts.map((p) => (
        <div key={p.id} style={{ borderBottom: "1px solid #ccc", padding: "10px" }}>
          {p.pinned && <b>📌 PINNED</b>}
          <Link to={`/post/${p.id}`}>
            <h3>{p.title}</h3>
          </Link>
          <p>{p.content}</p>
          <small>
            Anonymous #{shortId(p.ip_hash)} • active {timeAgo(p.last_activity || p.created_at)}
          </small>
        </div>
      ))}
    </div>
  );
}

// ==============================
// CREATE POST
// ==============================
function NewPost() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const createPost = async () => {
    if (!title.trim() || !content.trim()) {
      alert("Fill in both fields");
      return;
    }

    try {
      const res = await fetch("https://daboysforumip.coldbrainarchive.workers.dev/create-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title, content })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to post");
        return;
      }

      setTitle("");
      setContent("");
      alert("Posted!");
    } catch (err) {
      alert("Error posting");
      console.error(err);
    }
  };

  return (
    <div>
      <h2>New Post</h2>
      <input value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} />
      <button onClick={createPost}>Post</button>
    </div>
  );
}

// ==============================
// POST PAGE (LOCK + LIMIT)
// ==============================
function PostPage() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");

  const MAX_COMMENTS = 200;
  const LOCK_AFTER_HOURS = 24;

  const isLocked = () => {
    if (!post) return false;
    const ageHours = (new Date() - new Date(post.created_at)) / (1000 * 60 * 60);
    return ageHours > LOCK_AFTER_HOURS || comments.length >= MAX_COMMENTS;
  };

  const load = async () => {
    const { data: post } = await supabase.from("posts").select("*").eq("id", id).single();
    const { data: comments } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", id)
      .order("created_at", { ascending: true });

    setPost(post);
    setComments(comments || []);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, []);

  const addComment = async () => {
    if (!text.trim()) return;

    if (isLocked()) {
      alert("Thread is locked");
      return;
    }

    try {
      const res = await fetch("https://daboysforumip.coldbrainarchive.workers.dev/add-comment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: text,
          post_id: id
        })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to comment");
        return;
      }

      setText("");
      load();
    } catch (err) {
      console.error(err);
      alert("Error posting comment");
    }
  };

  if (!post) return <div>Loading...</div>;

  return (
    <div>
      <h2>{post.title}</h2>
      <p>{post.content}</p>

      {isLocked() && <b style={{ color: "red" }}>🔒 Thread Locked</b>}

      <div style={{ marginTop: "20px" }}>
        {comments.map((c) => (
          <div
            key={c.id}
            style={{
              marginBottom: "10px",
              padding: "5px",
              borderLeft: `4px solid #${shortId(c.ip_hash)}`
            }}
          >
            <b>Anonymous #{shortId(c.ip_hash)}</b>{" "}
            <small>{timeAgo(c.created_at)}</small>
            <p>{c.content}</p>
          </div>
        ))}
      </div>

      {!isLocked() && (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a reply..."
          />
          <button onClick={addComment}>Send</button>
        </>
      )}
    </div>
  );
}

// ==============================
// MOD PANEL (PIN + BAN)
// ==============================
function ModPanel() {
  const [posts, setPosts] = useState([]);

  const loadPosts = async () => {
    const { data } = await supabase.from("posts").select("*");
    setPosts(data || []);
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const banUser = async (ip_hash) => {
    await supabase.from("bans").insert({ ip_hash });
    alert("User banned");
  };

  const togglePin = async (post) => {
    await supabase
      .from("posts")
      .update({ pinned: !post.pinned })
      .eq("id", post.id);

    loadPosts();
  };

  return (
    <div>
      <h2>Moderator Panel</h2>

      {posts.map((p) => (
        <div key={p.id}>
          <p>{p.title}</p>
          <button onClick={() => banUser(p.ip_hash)}>Ban user</button>
          <button onClick={() => togglePin(p)}>
            {p.pinned ? "Unpin" : "Pin"}
          </button>
        </div>
      ))}
    </div>
  );
}

// ==============================
// MAIN APP
// ==============================
export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  return (
    <Router>
      <nav>
        <Link to="/">Home</Link> | <Link to="/mod">Mod Panel</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new" element={<NewPost />} />
        <Route path="/post/:id" element={<PostPage />} />
        <Route path="/mod" element={user ? <ModPanel /> : <Auth setUser={setUser} />} />
      </Routes>
    </Router>
  );
}