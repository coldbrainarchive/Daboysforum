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

function getUsername() {
  let name = localStorage.getItem("username");
  if (!name) {
    name = prompt("Pick a username:") || "Anonymous";
    localStorage.setItem("username", name);
  }
  return name;
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

      {posts.map((p) => (
        <div key={p.id} style={{ borderBottom: "1px solid #ccc", padding: 10 }}>
          {p.pinned && <b>📌 PINNED</b>}
          {p.locked && <b style={{ color: "red" }}> 🔒</b>}

          <Link to={`/post/${p.id}`}>
            <h3>{p.title}</h3>
          </Link>

          <p>{p.content}</p>

          <small>
            {p.username || `Anon #${shortId(p.browser_id)}`} •{" "}
            {timeAgo(p.last_activity || p.created_at)}
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
    if (!title.trim() || !content.trim()) return alert("Fill all fields");

    const res = await fetch("https://daboysforumip.coldbrainarchive.workers.dev/create-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        content,
        browser_id: getBrowserId(),
        username: getUsername()
      })
    });

    const data = await res.json();
    if (!res.ok) return alert(data.error);

    setTitle("");
    setContent("");
    alert("Posted!");
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
// POST PAGE
// ==============================
function PostPage() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");

  const load = async () => {
    const { data: p } = await supabase.from("posts").select("*").eq("id", id).single();
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
  }, []);

  const addComment = async () => {
    if (!text.trim() || post.locked) return;

    const res = await fetch("https://daboysforumip.coldbrainarchive.workers.dev/add-comment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: text,
        post_id: id,
        browser_id: getBrowserId(),
        username: getUsername()
      })
    });

    const data = await res.json();
    if (!res.ok) return alert(data.error);

    setText("");
    load();
  };

  if (!post) return <div>Loading...</div>;

  return (
    <div>
      <h2>{post.title}</h2>
      <p>{post.content}</p>

      {post.locked && <b style={{ color: "red" }}>🔒 Locked</b>}

      {comments.map((c) => (
        <div key={c.id} style={{ borderLeft: "4px solid #ccc", marginBottom: 10, padding: 5 }}>
          <b>
            {c.username || `Anon #${shortId(c.browser_id)}`}
            {c.browser_id === post.browser_id && " (OP)"}
          </b>
          <small> {timeAgo(c.created_at)}</small>
          <p>{c.content}</p>
        </div>
      ))}

      {!post.locked && (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} />
          <button onClick={addComment}>Send</button>
        </>
      )}
    </div>
  );
}

// ==============================
// MOD PANEL
// ==============================
function ModPanel() {
  const [posts, setPosts] = useState([]);

  const load = async () => {
    const { data } = await supabase.from("posts").select("*");
    setPosts(data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const ban = async (browser_id) => {
    await supabase.from("bans").insert({ browser_id });
    alert("Banned");
  };

  const del = async (id) => {
    await supabase.from("posts").update({ deleted: true }).eq("id", id);
    load();
  };

  const lock = async (p) => {
    await supabase.from("posts").update({ locked: !p.locked }).eq("id", p.id);
    load();
  };

  const pin = async (p) => {
    await supabase.from("posts").update({ pinned: !p.pinned }).eq("id", p.id);
    load();
  };

  return (
    <div>
      <h2>Mod Panel</h2>

      {posts.map((p) => (
        <div key={p.id}>
          <p>{p.title}</p>

          <button onClick={() => ban(p.browser_id)}>Ban</button>
          <button onClick={() => pin(p)}>{p.pinned ? "Unpin" : "Pin"}</button>
          <button onClick={() => lock(p)}>{p.locked ? "Unlock" : "Lock"}</button>
          <button onClick={() => del(p.id)}>Delete</button>
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  return (
    <Router>
      <nav>
        <Link to="/">Home</Link> | <Link to="/mod">Mod</Link>
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