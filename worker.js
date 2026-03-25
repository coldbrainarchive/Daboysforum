export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(ip));
    const ip_hash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const body = request.method !== "GET"
      ? await request.json().catch(() => ({}))
      : {};

    const now = new Date().toISOString();

    function json(data, status = 200) {
      return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    function generateUsername(hash) {
      const birds = [
        "Robin", "Crane", "Finch", "Wren", "Heron", "Swift", "Quail",
        "Snipe", "Egret", "Ibis", "Stork", "Grouse", "Dunlin", "Snowy",
        "Raven", "Falcon", "Condor", "Petrel", "Puffin", "Curlew",
        "Plover", "Godwit", "Avocet", "Hoopoe", "Kestrel", "Magpie",
        "Osprey", "Turaco", "Wheatear", "Redshank", "Kingfisher",
        "Nightjar", "Starling", "Sparrow", "Warbler", "Lapwing",
        "Moorhen", "Bittern", "Gannet", "Linnet", "Siskin", "Dipper",
        "Skylark", "Jackdaw", "Nuthatch", "Treecreeper", "Bullfinch",
        "Crossbill", "Redstart", "Fieldfare", "Tit", "Boobie"
      ];
      const bird = birds[parseInt(hash.slice(0, 2), 16) % birds.length];
      return `${bird}-${hash.slice(0, 4)}`;
    }

    // Verify bearer token → returns full Supabase auth user (includes user_metadata) or null
    async function getAuthUser() {
      const authHeader = request.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return null;
      const token = authHeader.slice(7);
      const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return null;
      return await res.json();
    }

    // ── Resolve user tier ───────────────────────────────────────────────────
    // anonymous : no auth token
    // member    : valid token, user_metadata.role = "user"
    // mod       : valid token, user_metadata.role = "mod"
    // ────────────────────────────────────────────────────────────────────────
    const authUser = await getAuthUser();
    const userRole = authUser?.user_metadata?.role || null;
    const isModerator = userRole === "mod";
    const isMember = !!authUser && !isModerator;

    let username;
    if (isModerator) {
      username = (typeof body.username === "string" && body.username.trim()) || "Mod";
    } else if (isMember) {
      username = authUser.user_metadata?.username || generateUsername(ip_hash);
    } else {
      username = generateUsername(ip_hash);
    }

    // ── Shared helpers ──────────────────────────────────────────────────────
    async function isBanned() {
      const res = await fetch(
        `${env.SUPABASE_URL}/rest/v1/bans?or=(ip_hash.eq.${ip_hash},username.eq.${encodeURIComponent(username)},browser_id.eq.${body.browser_id})`,
        { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
      );
      const data = await res.json();
      return Array.isArray(data) && data.length > 0;
    }

    async function insert(table, data) {
      const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          Prefer: "return=representation"
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json().catch(() => null);
      return Array.isArray(result) ? result[0] : result;
    }

    async function patch(table, query, data) {
      const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?${query}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          apikey: env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
    }

    async function bumpPost(post_id) {
      await patch("posts", `id=eq.${post_id}`, { last_activity: now });
    }

    async function getPostVoteSummary(postId, browserId) {
      const res = await fetch(
        `${env.SUPABASE_URL}/rest/v1/post_votes?post_id=eq.${postId}&select=value,browser_id`,
        { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
      );
      if (!res.ok) throw new Error(await res.text());
      const votes = await res.json();
      const score = (votes || []).reduce((sum, v) => sum + (v.value || 0), 0);
      const myVote = (votes || []).find((v) => v.browser_id === browserId)?.value || 0;
      return { score, myVote };
    }

    // ── Routes ──────────────────────────────────────────────────────────────

    if (url.pathname === "/create-post") {
      try {
        if (!body.title || !body.content || !body.board) return json({ error: "Missing fields" }, 400);
        if (await isBanned()) return json({ error: "Banned" }, 403);

        const createdPost = await insert("posts", {
          title: body.title,
          content: body.content,
          username,
          ip_hash,
          browser_id: body.browser_id,
          last_activity: now,
          is_mod: isModerator,
          mod_user_id: isModerator ? (authUser.id ?? null) : null,
          board: body.board
        });
        return json({ success: true, post: createdPost || null });
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    if (url.pathname === "/add-comment") {
      try {
        if (!body.content || !body.post_id) return json({ error: "Missing fields" }, 400);
        if (await isBanned()) return json({ error: "Banned" }, 403);

        const parentCommentId = typeof body.parent_comment_id === "string" && body.parent_comment_id.trim()
          ? body.parent_comment_id.trim() : null;

        await insert("comments", {
          content: body.content,
          post_id: body.post_id,
          parent_comment_id: parentCommentId,
          username,
          ip_hash,
          browser_id: body.browser_id,
          is_mod: isModerator,
          mod_user_id: isModerator ? (authUser.id ?? null) : null
        });
        await bumpPost(body.post_id);
        return json({ success: true });
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    if (url.pathname === "/vote-post") {
      try {
        if (!body.post_id || !body.browser_id || ![1, -1, 0].includes(body.value))
          return json({ error: "Missing or invalid fields" }, 400);
        if (await isBanned()) return json({ error: "Banned" }, 403);

        const existingRes = await fetch(
          `${env.SUPABASE_URL}/rest/v1/post_votes?post_id=eq.${body.post_id}&browser_id=eq.${body.browser_id}&select=id,value`,
          { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
        );
        if (!existingRes.ok) throw new Error(await existingRes.text());
        const existing = (await existingRes.json())[0] || null;

        if (body.value === 0) {
          if (existing?.id) {
            const del = await fetch(`${env.SUPABASE_URL}/rest/v1/post_votes?id=eq.${existing.id}`, {
              method: "DELETE",
              headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` }
            });
            if (!del.ok) throw new Error(await del.text());
          }
          return json({ success: true, ...(await getPostVoteSummary(body.post_id, body.browser_id)) });
        }

        if (existing?.id) {
          await patch("post_votes", `id=eq.${existing.id}`, { value: body.value, username, ip_hash, is_mod: isModerator, mod_user_id: isModerator ? authUser.id : null });
        } else {
          await insert("post_votes", { post_id: body.post_id, browser_id: body.browser_id, username, ip_hash, value: body.value, is_mod: isModerator, mod_user_id: isModerator ? authUser.id : null });
        }
        return json({ success: true, ...(await getPostVoteSummary(body.post_id, body.browser_id)) });
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    if (url.pathname === "/get-members") {
      if (!isModerator) return json({ error: "Unauthorized" }, 401);
      const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=200`, {
        headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` }
      });
      if (!res.ok) return json({ error: "Failed to fetch members" }, 500);
      const data = await res.json();
      return json({ members: data.users || [] });
    }

    if (url.pathname === "/update-member") {
      if (!isModerator) return json({ error: "Unauthorized" }, 401);
      const { user_id, role } = body;
      if (!user_id || !role) return json({ error: "Missing fields" }, 400);
      const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${user_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
        body: JSON.stringify({ user_metadata: { role } })
      });
      if (!res.ok) return json({ error: "Failed to update member" }, 500);
      return json({ success: true });
    }

    if (url.pathname === "/delete-member") {
      if (!isModerator) return json({ error: "Unauthorized" }, 401);
      const { user_id } = body;
      if (!user_id) return json({ error: "Missing fields" }, 400);
      const res = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${user_id}`, {
        method: "DELETE",
        headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` }
      });
      if (!res.ok) return json({ error: "Failed to delete member" }, 500);
      return json({ success: true });
    }

    if (url.pathname === "/mod-action") {
      try {
        if (!isModerator) return json({ error: "Unauthorized" }, 401);
        if (!body.type) return json({ error: "Missing type" }, 400);
        if (body.type === "ban") await insert("bans", { username: body.username, browser_id: body.browser_id, ip_hash: body.ip_hash || ip_hash });
        if (body.type === "delete_post") await patch("posts", `id=eq.${body.post_id}`, { deleted: true });
        if (body.type === "delete_comment") await patch("comments", `id=eq.${body.comment_id}`, { deleted: true });
        return json({ success: true });
      } catch (err) {
        return json({ error: err.message }, 500);
      }
    }

    if (url.pathname === "/debug-auth") {
      return json({ isModerator, isMember, username, userId: authUser?.id ?? null });
    }

    return new Response("OK", { headers: corsHeaders });
  }
};
