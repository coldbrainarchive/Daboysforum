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

// ==============================
// AUTH HEADER
// ==============================
async function getAuthHeader() {
  const { data } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${data.session?.access_token}`
  };
}

// ==============================
// MOD ACTION
// ==============================
async function modAction(action) {
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
        browser_id: getBrowserId()
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
function PostPage({ user }) {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");

  const isMod = !!user;

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

    await fetch("https://daboysforumip.coldbrainarchive.workers.dev/add-comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: text,
        post_id: id,
        browser_id: getBrowserId()
      })
    });

    setText("");
    load();
  };

  if (!post) return <div>Loading...</div>;

  return (
    <div>
      <h2>{post.title}</h2>
      <p>{post.content}</p>

      {post.locked && <b style={{ color: "red" }}>🔒 Locked</b>}

      {isMod && (
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => modAction({ type: "toggle_pin", post_id: id, value: !post.pinned })}>Pin</button>
          <button onClick={() => modAction({ type: "toggle_lock", post_id: id, value: !post.locked })}>Lock</button>
          <button onClick={() => modAction({ type: "delete_post", post_id: id })}>Delete</button>
          <button onClick={() => modAction({ type: "ban", browser_id: post.browser_id })}>Ban</button>
        </div>
      )}

      {comments.map((c) => (
        <div key={c.id} style={{ borderLeft: "4px solid #ccc", marginBottom: 10, padding: 5 }}>
          <b>
            {c.username || `Anon #${shortId(c.browser_id)}`}
            {c.browser_id === post.browser_id && " (OP)"}
          </b>
          <small> {timeAgo(c.created_at)}</small>
          <p>{c.content}</p>

          {isMod && (
            <button onClick={() => modAction({ type: "delete_comment", comment_id: c.id })}>
              Delete
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ==============================
// MOD PANEL (FIXED 🔥)
// ==============================
function ModPanel({ setModName }) {
  const [name, setName] = useState(localStorage.getItem("mod_name") || "");

  const save = () => {
    localStorage.setItem("mod_name", name);
    setModName(name); // 🔥 CRITICAL FIX
    alert("Saved!");
  };

  return (
    <div>
      <h2>Mod Panel</h2>

      <p>Current name: <b>{name || "Mod"}</b></p>

      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={save}>Save</button>
    </div>
  );
}

// ==============================
// MAIN (FIXED 🔥)
// ==============================
export default function App() {
  const [user, setUser] = useState(null);
  const [modName, setModName] = useState(localStorage.getItem("mod_name") || "Mod");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  return (
    <Router>
      <nav>
        <Link to="/">Home</Link> | <Link to="/mod">Mod ({modName})</Link>
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

