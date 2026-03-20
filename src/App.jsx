import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { BrowserRouter as Router, Routes, Route, Link, useParams } from "react-router-dom";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ==============================
// ANON ID HELPER
// ==============================
function getAnonId() {
  let id = localStorage.getItem("anon_id");

  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("anon_id", id);
  }

  return id;
}

// ==============================
// AUTH (MOD LOGIN)
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
// HOME
// ==============================
function Home() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    const { data } = await supabase.from("posts").select("*").order("created_at", { ascending: false });
    setPosts(data || []);
  };

  return (
    <div>
      <h1>Daboysforum 👻</h1>
      <Link to="/new">Create Post</Link>

      {posts.map((p) => (
        <div key={p.id}>
          <Link to={`/post/${p.id}`}>
            <h3>{p.title}</h3>
          </Link>
          <p>Anon ID: {p.anon_id?.slice(0, 6)}</p>
        </div>
      ))}
    </div>
  );
}

// ==============================
// CREATE POST (ANON)
// ==============================
function NewPost() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const createPost = async () => {
    const anon_id = getAnonId();

    const { data: banned } = await supabase
      .from("bans")
      .select("*")
      .eq("anon_id", anon_id);

    if (banned?.length > 0) {
      alert("You are banned");
      return;
    }

    await supabase.from("posts").insert({
      title,
      content,
      anon_id
    });

    alert("Posted!");
  };

  return (
    <div>
      <h2>New Post</h2>
      <input placeholder="Title" onChange={(e) => setTitle(e.target.value)} />
      <textarea onChange={(e) => setContent(e.target.value)} />
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

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const { data: post } = await supabase.from("posts").select("*").eq("id", id).single();
    const { data: comments } = await supabase.from("comments").select("*").eq("post_id", id);

    setPost(post);
    setComments(comments || []);
  };

  const addComment = async () => {
    const anon_id = getAnonId();

    const { data: banned } = await supabase
      .from("bans")
      .select("*")
      .eq("anon_id", anon_id);

    if (banned?.length > 0) {
      alert("You are banned");
      return;
    }

    await supabase.from("comments").insert({
      content: text,
      post_id: id,
      anon_id
    });

    setText("");
    load();
  };

  if (!post) return <div>Loading...</div>;

  return (
    <div>
      <h2>{post.title}</h2>
      <p>{post.content}</p>

      <h3>Comments</h3>
      {comments.map((c) => (
        <p key={c.id}>
          {c.content} (anon: {c.anon_id?.slice(0, 6)})
        </p>
      ))}

      <textarea value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={addComment}>Comment</button>
    </div>
  );
}

// ==============================
// MOD PANEL
// ==============================
function ModPanel() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    const { data } = await supabase.from("posts").select("*");
    setPosts(data || []);
  };

  const banUser = async (anon_id) => {
    await supabase.from("bans").insert({ anon_id });
    alert("User banned");
  };

  return (
    <div>
      <h2>Moderator Panel</h2>

      {posts.map((p) => (
        <div key={p.id}>
          <p>{p.title}</p>
          <button onClick={() => banUser(p.anon_id)}>
            Ban this user
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
        <Route
          path="/mod"
          element={user ? <ModPanel /> : <Auth setUser={setUser} />}
        />
      </Routes>
    </Router>
  );
}