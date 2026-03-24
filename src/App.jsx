import { Component, useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

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
  if (!id) return "#dbe4ee";

  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }

  let hue = Math.abs(hash) % 360;

  // Keep the moderator purple exclusive to mods.
  if (hue >= 250 && hue <= 320) {
    hue = (hue + 90) % 360;
  }

  return `hsl(${hue}, 72%, 68%)`;
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
        min-height: 34px;
        padding: 0 13px;
        border-radius: 999px;
        background: #1f2937;
        color: #f8fafc;
        text-decoration: none;
        font-size: 13px;
        font-weight: 700;
        border: 1px solid #374151;
      }

      .app-chip.primary {
        background: #c084fc;
        border-color: #d8b4fe;
        color: #14081d;
      }

      .home-shell {
        display: block;
        width: min(1280px, 100%);
        margin: 0 auto;
        padding: 0 20px 32px;
        box-sizing: border-box;
      }

      .boards-tabs-shell {
        position: sticky;
        top: 73px;
        z-index: 15;
        margin: 0 0 16px;
        padding-top: 0;
        border-bottom: 1px solid rgba(48, 55, 68, 0.9);
        background: #16171d;
      }

      .boards-tabs-shell::before {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        top: -16px;
        height: 16px;
        background: #16171d;
        pointer-events: none;
      }

      .boards-tabs {
        display: flex;
        align-items: flex-end;
        gap: 6px;
        overflow-x: auto;
        overflow-y: hidden;
        padding: 0 2px 0;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
        touch-action: pan-x;
        overscroll-behavior-x: contain;
      }

      .boards-tabs::-webkit-scrollbar {
        display: none;
      }

      .boards-tab {
        position: relative;
        z-index: 1;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex: 0 0 auto;
        min-height: 40px;
        padding: 0 14px;
        border: 1px solid #303744;
        border-bottom: 0;
        border-radius: 16px 16px 0 0;
        background: linear-gradient(180deg, #212937 0%, #181f29 100%);
        color: #a8b6c8;
        text-decoration: none;
        font-size: 13px;
        font-weight: 700;
        line-height: 1;
        margin-bottom: -1px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
        transition: color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
      }

      .boards-tab:hover {
        color: #dbe4ee;
      }

      .boards-tab.active {
        z-index: 2;
        background: #16171d;
        color: #f8fafc;
        min-height: 44px;
        box-shadow:
          0 -1px 0 rgba(255, 255, 255, 0.04),
          0 6px 18px rgba(0, 0, 0, 0.1);
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

      .feed-post-card {
        padding: 18px 20px 17px;
      }

      .feed-post-title {
        margin: 0 0 10px;
        color: #f8fafc;
        font-size: 22px;
        line-height: 1.22;
        letter-spacing: -0.01em;
        text-decoration: none;
        text-align: left;
      }

      .feed-post-header {
        margin-bottom: 0;
        color: #94a3b8;
        font-size: 14px;
        text-align: left;
      }

      .feed-post-board-row {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 24px;
        margin-bottom: 0;
      }

      .feed-post-board-group {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
      }

      .feed-post-time {
        margin-left: auto;
        color: #8fa0b6;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.1;
        white-space: nowrap;
      }

      .feed-post-author-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
      }

      .feed-post-author {
        min-width: 0;
        font-weight: 700;
        font-size: 14px;
        line-height: 1.2;
      }

      .feed-post-statuses {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      }

      .feed-post-status {
        font-weight: 700;
        white-space: nowrap;
      }

      .feed-post-link {
        display: block;
        text-align: left;
        width: 100%;
        max-width: 100%;
      }

      .feed-post-main {
        margin-top: 10px;
        padding: 12px 0 14px;
        border-top: 1px solid rgba(148, 163, 184, 0.12);
        border-bottom: 1px solid rgba(148, 163, 184, 0.12);
      }

      .feed-post-content {
        margin: 0;
        color: #d4dde7;
        font-size: 15px;
        line-height: 1.52;
        text-align: left;
        overflow-wrap: anywhere;
      }

      .feed-post-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        margin-top: 13px;
        width: 100%;
      }

      .feed-post-vote-group,
      .feed-post-action-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 30px;
        padding: 0 8px;
        border-radius: 999px;
        border: 1px solid #323b48;
        background: #1d242d;
        color: #e5edf6;
        text-decoration: none;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.02em;
      }

      .feed-post-vote-group {
        padding: 0 5px;
      }

      .feed-post-action-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: #e2e8f0;
        font-size: 12px;
        cursor: pointer;
      }

      .feed-post-action-button.active {
        background: rgba(148, 163, 184, 0.16);
        color: #f8fafc;
      }

      .feed-post-action-button.active.downvote {
        color: #f87171;
      }

      .feed-post-vote-score {
        min-width: 16px;
        line-height: 1;
        text-align: center;
      }

      .feed-post-action-pill {
        cursor: pointer;
      }

      .comments-shell {
        margin-top: 18px;
      }

      .comments-panel {
        padding: 18px 20px;
      }

      .comments-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }

      .comments-panel-title {
        color: #f8fafc;
        font-size: 18px;
        font-weight: 800;
        letter-spacing: -0.01em;
      }

      .comments-panel-controls {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        color: #8fa0b6;
        font-size: 12px;
        font-weight: 700;
      }

      .comments-sort {
        min-height: 32px;
        padding: 0 12px;
        border-radius: 999px;
        border: 1px solid #374151;
        background: #20262f;
        color: #dbe4ee;
        font-size: 12px;
        font-weight: 700;
      }

      .comments-list {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .comment-flat {
        display: flex;
        align-items: flex-start;
        gap: 10px;
      }

      .comment-flat.pending .comment-card {
        animation: commentLift 0.22s ease-out forwards, composerPulse 1s ease-in-out infinite;
      }

      .comment-avatar {
        width: 30px;
        height: 30px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 800;
        color: #0f1117;
        flex-shrink: 0;
        user-select: none;
      }

      .comment-card {
        flex: 1 1 auto;
        min-width: 0;
        padding-top: 3px;
      }

      .comment-card-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
        flex-wrap: nowrap;
        overflow: hidden;
      }

      .comment-header-actions {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
      }

      .comment-header-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 24px;
        padding: 0 9px;
        border-radius: 999px;
        border: 1px solid rgba(148, 163, 184, 0.2);
        background: transparent;
        color: #60a5fa;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.15s;
      }

      .comment-header-btn:hover {
        background: rgba(96, 165, 250, 0.08);
      }

      .comment-card-author {
        font-size: 13px;
        font-weight: 800;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .comment-card-time {
        font-size: 12px;
        color: #8fa0b6;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .comment-card-op {
        font-size: 11px;
        font-weight: 700;
        color: #60a5fa;
        background: rgba(96, 165, 250, 0.1);
        border-radius: 4px;
        padding: 1px 5px;
      }

      .comment-quote {
        border-left: 3px solid rgba(148, 163, 184, 0.35);
        border-radius: 0 8px 8px 0;
        background: rgba(148, 163, 184, 0.07);
        padding: 8px 12px;
        margin-bottom: 10px;
        overflow: hidden;
      }

      .comment-quote-author {
        display: block;
        font-size: 12px;
        font-weight: 700;
        color: #94a3b8;
        margin-bottom: 3px;
      }

      .comment-quote-body {
        margin: 0;
        font-size: 13px;
        line-height: 1.45;
        color: #8fa0b6;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }

      .comment-card-actions {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        margin-top: 10px;
      }

      .comment-action {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 28px;
        padding: 0 8px;
        border: none;
        border-radius: 999px;
        background: transparent;
        color: #8fa0b6;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
      }

      .comment-action:hover {
        background: rgba(148, 163, 184, 0.1);
        color: #f8fafc;
      }

      .comment-body {
        color: #d4dde7;
        font-size: 15px;
        line-height: 1.5;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

.comment-replies-list {
        margin-top: 12px;
        padding-left: 12px;
        border-left: 2px solid rgba(148, 163, 184, 0.15);
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .comment-composer {
        margin-bottom: 20px;
        padding-bottom: 20px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.12);
      }

      .comment-composer-textarea {
        width: 100%;
        box-sizing: border-box;
        background: #0f1117;
        border: 1px solid #2e303a;
        border-radius: 14px;
        color: #f8fafc;
        font-size: 15px;
        font-family: inherit;
        padding: 14px;
        resize: none;
        min-height: 80px;
      }

      .comment-composer-textarea::placeholder {
        color: #8fa0b6;
      }

      .comment-composer-textarea:focus {
        outline: none;
        border-color: #4b5563;
      }

      .comment-composer-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 10px;
      }

      .comment-composer-cancel {
        height: 36px;
        padding: 0 16px;
        border-radius: 999px;
        border: none;
        background: #2e303a;
        color: #dbe4ee;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
      }

      .comment-composer-submit {
        height: 36px;
        padding: 0 18px;
        border-radius: 999px;
        border: none;
        background: #c084fc;
        color: #14081d;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
      }

      .inline-reply-box {
        margin-top: 12px;
        padding: 12px;
        border-radius: 14px;
        background: #0f1117;
        border: 1px solid #2e303a;
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

      @keyframes commentLift {
        0% {
          opacity: 0;
          transform: translateY(18px);
          box-shadow: 0 0 0 0 rgba(192, 132, 252, 0);
        }
        100% {
          opacity: 1;
          transform: translateY(0);
          box-shadow: 0 0 0 1px rgba(192, 132, 252, 0.45), 0 0 24px rgba(192, 132, 252, 0.22);
        }
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
          min-height: 30px;
          padding: 0 10px;
          font-size: 12px;
        }

        .home-shell {
          padding: 0 14px 24px;
        }

        .boards-tabs-shell {
          top: 62px;
          margin-bottom: 12px;
          padding-top: 0;
        }

        .boards-tabs-shell::before {
          top: -12px;
          height: 12px;
        }

        .boards-tabs {
          gap: 4px;
          overflow-y: hidden;
          padding: 0 1px 0;
          scroll-snap-type: x proximity;
        }

        .boards-tab {
          min-height: 32px;
          padding: 0 11px;
          border-radius: 12px 12px 0 0;
          font-size: 12px;
          scroll-snap-align: start;
        }

        .boards-tab.active {
          min-height: 36px;
        }

        .feed-hero {
          margin-bottom: 14px;
        }

        .feed-hero-title {
          font-size: 34px;
        }

        .feed-post-board-row {
          flex-wrap: nowrap;
          align-items: center;
        }

        .feed-post-author-row {
          flex-wrap: wrap;
        }

        .feed-post-board-group {
          min-width: 0;
        }

        .feed-post-statuses {
          gap: 6px;
        }

        .feed-post-time {
          margin-left: auto;
          align-self: center;
          font-size: 11px;
          line-height: 1.1;
        }

        .feed-post-card {
          padding: 14px 14px 13px;
        }

        .feed-post-header {
          margin-bottom: 0;
        }

        .feed-post-board-row {
          min-height: 22px;
          gap: 10px;
        }

        .feed-post-author {
          font-size: 13px;
        }

        .feed-post-main {
          margin-top: 8px;
          padding: 10px 0 12px;
        }

        .feed-post-title {
          font-size: 18px;
          margin-bottom: 8px;
          line-height: 1.24;
        }

        .feed-post-content {
          font-size: 14px;
          line-height: 1.5;
        }

        .feed-post-actions {
          gap: 5px;
          margin-top: 11px;
        }

        .feed-post-vote-group,
        .feed-post-action-pill {
          min-height: 28px;
          padding: 0 7px;
          font-size: 10px;
        }

        .feed-post-action-button {
          width: 18px;
          height: 18px;
          font-size: 11px;
        }

        .comments-panel {
          padding: 14px;
        }

        .comments-panel-header {
          align-items: flex-start;
          flex-direction: column;
          margin-bottom: 12px;
        }

        .comment-card-header {
          align-items: center;
        }

        .comment-card-actions {
          width: 100%;
          margin-top: 8px;
          gap: 8px;
        }

        .comment-children {
          margin-top: 10px;
          padding-left: 12px;
        }
      }
    `}</style>
  );
}

const BOARDS = [
  { name: "News", slug: "news", icon: "📰" },
  { name: "Sports", slug: "sports", icon: "🏈" },
  { name: "Random", slug: "random", icon: "🎲" },
  { name: "Announcements", slug: "announcements", icon: "📢" },
  { name: "Feedback", slug: "feedback", icon: "💬" },
  { name: "Jail", slug: "jail", icon: "🚔" }
];

function getBoardBySlug(slug) {
  return BOARDS.find((board) => board.slug === slug) || null;
}

function getBoardNameFromPost(post) {
  const boardValue = post?.board || post?.category || post?.community_id || "";
  const normalizedValue = String(boardValue).trim().toLowerCase();

  if (!normalizedValue) return "";

  const matchedBoard = BOARDS.find(
    (board) => board.slug === normalizedValue || board.name.toLowerCase() === normalizedValue
  );

  return matchedBoard?.name || String(boardValue).trim();
}

function filterPostsForBoard(posts, boardName) {
  if (!boardName) return posts;
  return posts.filter((post) => getBoardNameFromPost(post) === boardName);
}

const BOARD_TAGS_STORAGE_KEY = "board_tags_by_post_id";
const PENDING_BOARD_TAGS_STORAGE_KEY = "pending_board_tags";
const POST_REACTIONS_STORAGE_KEY = "post_reactions_by_browser";
const WORKER_URL = "https://daboysforumip.coldbrainarchive.workers.dev";
const STANDARD_REACTIONS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎",
  "🤔", "😮", "😢", "😭", "😡", "👏", "🙌", "🙏",
  "👍", "👎", "❤️", "🔥", "🎉", "💯", "👀", "🤝"
];

function readStorageJson(key, fallback) {
  if (typeof window === "undefined") return fallback;

  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorageJson(key, value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function getStoredBoardTagsByPostId() {
  return readStorageJson(BOARD_TAGS_STORAGE_KEY, {});
}

function setStoredBoardTagsByPostId(tags) {
  writeStorageJson(BOARD_TAGS_STORAGE_KEY, tags);
}

function getPendingBoardTags() {
  return readStorageJson(PENDING_BOARD_TAGS_STORAGE_KEY, []);
}

function setPendingBoardTags(tags) {
  writeStorageJson(PENDING_BOARD_TAGS_STORAGE_KEY, tags);
}

function queuePendingBoardTag({ title, content, browserId, boardName }) {
  const pendingTags = getPendingBoardTags();
  pendingTags.push({
    title,
    content,
    browser_id: browserId,
    boardName,
    createdAt: Date.now()
  });
  setPendingBoardTags(pendingTags.slice(-30));
}

function rememberBoardTagForPost(postId, boardName) {
  if (!postId || !boardName) return;
  const storedTagsByPostId = getStoredBoardTagsByPostId();
  setStoredBoardTagsByPostId({
    ...storedTagsByPostId,
    [postId]: boardName
  });
}

async function syncBoardTagToPostRecord({ title, content, browserId, board }) {
  const recentCutoff = new Date(Date.now() - 1000 * 60 * 10).toISOString();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase
      .from("posts")
      .select("id, title, content, browser_id, community_id, created_at")
      .eq("browser_id", browserId)
      .gte("created_at", recentCutoff)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error) {
      const matchedPost = (data || []).find((post) => (
        post.title === title &&
        post.content === content
      ));

      if (matchedPost) {
        rememberBoardTagForPost(matchedPost.id, board.name);

        if (matchedPost.community_id !== board.slug) {
          const { error: updateError } = await supabase
            .from("posts")
            .update({ community_id: board.slug })
            .eq("id", matchedPost.id);

          if (!updateError) {
            return matchedPost.id;
          }
        } else {
          return matchedPost.id;
        }
      }
    }

    await new Promise((resolve) => window.setTimeout(resolve, 450));
  }

  return null;
}

function hydratePostsWithBoardTags(posts) {
  const storedTagsByPostId = getStoredBoardTagsByPostId();
  const pendingTags = getPendingBoardTags();
  const nextStoredTagsByPostId = { ...storedTagsByPostId };
  const remainingPendingTags = [];
  let didChangeStoredTags = false;

  const hydratedPosts = posts.map((post) => {
    const existingBoard = getBoardNameFromPost(post);
    if (existingBoard) {
      if (post.id && storedTagsByPostId[post.id] !== existingBoard) {
        nextStoredTagsByPostId[post.id] = existingBoard;
        didChangeStoredTags = true;
      }

      return post;
    }

    const storedBoard = post.id ? storedTagsByPostId[post.id] : "";
    if (storedBoard) {
      return { ...post, board: storedBoard };
    }

    const matchedPendingTagIndex = pendingTags.findIndex((tag) => (
      tag.browser_id === post.browser_id &&
      tag.title === post.title &&
      tag.content === post.content
    ));

    if (matchedPendingTagIndex >= 0) {
      const matchedPendingTag = pendingTags[matchedPendingTagIndex];

      if (post.id) {
        nextStoredTagsByPostId[post.id] = matchedPendingTag.boardName;
        didChangeStoredTags = true;
      }

      pendingTags.splice(matchedPendingTagIndex, 1);

      return { ...post, board: matchedPendingTag.boardName };
    }

    return post;
  });

  pendingTags.forEach((tag) => {
    if (Date.now() - tag.createdAt < 1000 * 60 * 60 * 24) {
      remainingPendingTags.push(tag);
    }
  });

  if (didChangeStoredTags) {
    setStoredBoardTagsByPostId(nextStoredTagsByPostId);
  }

  if (remainingPendingTags.length !== getPendingBoardTags().length) {
    setPendingBoardTags(remainingPendingTags);
  }

  return hydratedPosts;
}

function hydratePostWithBoardTag(post) {
  if (!post) return post;
  const [hydratedPost] = hydratePostsWithBoardTags([post]);
  return hydratedPost;
}


function getStoredPostReactions() {
  return readStorageJson(POST_REACTIONS_STORAGE_KEY, {});
}

function setStoredPostReactions(reactions) {
  writeStorageJson(POST_REACTIONS_STORAGE_KEY, reactions);
}

function getReactionStateForPost(postId) {
  const reactionsByPost = getStoredPostReactions();
  const postReactions = reactionsByPost[postId] || {};
  const counts = {};

  Object.values(postReactions).forEach((emoji) => {
    counts[emoji] = (counts[emoji] || 0) + 1;
  });

  return {
    counts,
    selectedReaction: postReactions[getBrowserId()] || ""
  };
}

function toggleReactionForPost(postId, emoji) {
  const browserId = getBrowserId();
  const reactionsByPost = getStoredPostReactions();
  const postReactions = {
    ...(reactionsByPost[postId] || {})
  };

  if (postReactions[browserId] === emoji) {
    delete postReactions[browserId];
  } else {
    postReactions[browserId] = emoji;
  }

  setStoredPostReactions({
    ...reactionsByPost,
    [postId]: postReactions
  });
}

async function voteOnPost(postId, value) {
  const res = await fetch(`${WORKER_URL}/vote-post`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ post_id: postId, browser_id: getBrowserId(), value })
  });
  return res.json();
}

async function fetchVotesForPosts(postIds) {
  if (!postIds.length) return {};
  const browserId = getBrowserId();
  const { data } = await supabase
    .from("post_votes")
    .select("post_id, value, browser_id")
    .in("post_id", postIds);

  const result = {};
  for (const postId of postIds) {
    const rows = (data || []).filter((r) => r.post_id === postId);
    result[postId] = {
      score: rows.reduce((s, r) => s + (r.value || 0), 0),
      myVote: rows.find((r) => r.browser_id === browserId)?.value || 0
    };
  }
  return result;
}

function BoardBadge({ boardName }) {
  const matchedBoard = BOARDS.find((board) => board.name === boardName);

  if (!matchedBoard) return null;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 8px",
        borderRadius: 999,
        background: "#20262f",
        color: "#dbe4ee",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.03em",
        textTransform: "uppercase"
      }}
    >
      <span>{matchedBoard.icon}</span>
      <span>{matchedBoard.name}</span>
    </span>
  );
}

function PostCard({ post, commentCount = 0, score = 0, myVote = 0, onVote }) {
  const [shareLabel, setShareLabel] = useState("Share");
  const isMod = isModPost(post);
  const boardName = getBoardNameFromPost(post);

  async function handleShare(event) {
    event.preventDefault();
    event.stopPropagation();

    const shareUrl = `${window.location.origin}/post/${post.id}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: post.title,
          text: post.title,
          url: shareUrl
        });
        setShareLabel("Shared");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareLabel("Copied");
      } else {
        setShareLabel("Link ready");
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        setShareLabel("Share failed");
      }
      return;
    }

    window.setTimeout(() => {
      setShareLabel("Share");
    }, 1800);
  }

  const boardSlug = BOARDS.find((b) => b.name === boardName)?.slug;

  return (
    <div className="content-card feed-post-card" style={{ marginBottom: 16 }}>
      <div className="feed-post-header">
        {boardName && (
          <div className="feed-post-board-row">
            <span className="feed-post-board-group">
              {boardSlug ? (
                <Link
                  to={`/board/${boardSlug}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{ textDecoration: "none" }}
                >
                  <BoardBadge boardName={boardName} />
                </Link>
              ) : (
                <BoardBadge boardName={boardName} />
              )}
              {(post.pinned || post.locked) && (
                <span className="feed-post-statuses">
                  {post.pinned && (
                    <span className="feed-post-status" style={{ color: "#f8fafc" }}>
                      📌
                    </span>
                  )}
                  {post.locked && (
                    <span className="feed-post-status" style={{ color: "#f87171" }}>
                      🔒
                    </span>
                  )}
                </span>
              )}
            </span>
            <span className="feed-post-time">
              {timeAgo(post.last_activity || post.created_at)}
            </span>
          </div>
        )}
      </div>

      <Link
        to={`/post/${post.id}`}
        className="feed-post-link"
        style={{ textDecoration: "none", display: "block" }}
      >
        <div className="feed-post-main">
          <div className="feed-post-author-row">
            <span
              className="feed-post-author"
              style={{ color: isMod ? "#c084fc" : getUserColor(post.browser_id) }}
            >
              {isMod && "👤 "}
              {post.username || `Anon #${shortId(post.browser_id)}`}
            </span>
          </div>

          <h3 className="feed-post-title">
            {post.title}
          </h3>

          <p className="feed-post-content">{post.content}</p>
        </div>
      </Link>

      <div className="feed-post-actions">
        <div className="feed-post-vote-group">
          <button
            type="button"
            aria-label="Thumbs up"
            className={`feed-post-action-button${myVote === 1 ? " active" : ""}`}
            onClick={(event) => {
              event.preventDefault();
              onVote?.(post.id, myVote === 1 ? 0 : 1);
            }}
          >
            <span aria-hidden="true">👍</span>
          </button>
          <span className="feed-post-vote-score">
            {score}
          </span>
          <button
            type="button"
            aria-label="Thumbs down"
            className={`feed-post-action-button${myVote === -1 ? " active downvote" : ""}`}
            onClick={(event) => {
              event.preventDefault();
              onVote?.(post.id, myVote === -1 ? 0 : -1);
            }}
          >
            <span aria-hidden="true">👎</span>
          </button>
        </div>

        <Link
          to={`/post/${post.id}`}
          className="feed-post-action-pill"
        >
          <span>💬</span>
          <span>{commentCount}</span>
        </Link>

        <button
          type="button"
          className="feed-post-action-pill"
          onClick={handleShare}
        >
          <span>↗</span>
          <span>{shareLabel}</span>
        </button>
      </div>
    </div>
  );
}

function BoardsTabs({ activeBoard = "", showHappening = false, highlightHappening = false }) {
  const navRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const activeTab = nav.querySelector(".boards-tab.active");
    if (!activeTab) return;

    activeTab.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "center"
    });
  }, [location.pathname, activeBoard, highlightHappening]);

  return (
    <div className="boards-tabs-shell">
      <nav ref={navRef} className="boards-tabs" aria-label="Boards">
        {showHappening && (
          <Link
            to="/"
            className={`boards-tab${highlightHappening ? " active" : ""}`}
          >
            <span>✨</span>
            <span>Feed</span>
          </Link>
        )}

        {BOARDS.map((board) => (
          <Link
            key={board.name}
            to={`/board/${board.slug}`}
            className={`boards-tab${board.name === activeBoard ? " active" : ""}`}
          >
            <span>{board.icon}</span>
            <span>{board.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function CommentCard({ comment, postBrowserId, canDelete = false, onDelete, onReply, allComments = [], threadReplies = [] }) {
  const isModUser = isModPost(comment);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [repliesExpanded, setRepliesExpanded] = useState(false);
  const isPending = comment.isPending === true;
  const displayName =
    isPending && !isModUser && !comment.username
      ? "Anonymous"
      : (comment.username || `Anon #${shortId(comment.browser_id)}`);

  const avatarColor = isModUser ? "#c084fc" : getUserColor(comment.browser_id);
  const avatarLetter = isModUser ? "👤" : (displayName[0]?.toUpperCase() || "?");

  const parentComment = comment.parent_comment_id
    ? allComments.find((c) => c.id === comment.parent_comment_id)
    : null;
  const parentName = parentComment
    ? (parentComment.username || `Anon #${shortId(parentComment.browser_id)}`)
    : null;
  // Only show quote when replying to a reply (not for direct replies to a top-level comment)
  const showQuote = parentComment && !!parentComment.parent_comment_id;

  return (
    <div className={`comment-flat${isPending ? " pending" : ""}`}>
      <div className="comment-avatar" style={{ background: avatarColor }}>
        {avatarLetter}
      </div>

      <div className="comment-card">
        <div className="comment-card-header">
          <span className="comment-card-author" style={{ color: avatarColor }}>
            {displayName}
          </span>
          {comment.browser_id === postBrowserId && (
            <span className="comment-card-op">OP</span>
          )}
          <span className="comment-card-time">· {timeAgo(comment.created_at)}</span>
          <div className="comment-header-actions">
            {threadReplies.length > 0 && (
              <button
                type="button"
                className="comment-header-btn"
                onClick={() => setRepliesExpanded((v) => !v)}
              >
                {repliesExpanded ? "▲" : "▼"} {threadReplies.length} {threadReplies.length === 1 ? "Reply" : "Replies"}
              </button>
            )}
            {onReply && (
              <button
                type="button"
                className="comment-header-btn"
                onClick={() => setIsReplying((v) => !v)}
              >
                Reply
              </button>
            )}
            {canDelete && (
              <button type="button" className="comment-header-btn" onClick={onDelete}>
                🗑
              </button>
            )}
          </div>
        </div>

        {showQuote && (
          <div className="comment-quote">
            <span className="comment-quote-author">{parentName}:</span>
            <p className="comment-quote-body">{parentComment.content}</p>
          </div>
        )}

        <div className="comment-body">{comment.content}</div>

        {isReplying && (
          <div className="inline-reply-box">
            <textarea
              className="comment-composer-textarea"
              placeholder={`Reply to ${displayName}...`}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              disabled={isSendingReply}
              rows={3}
              autoFocus
            />
            <div className="comment-composer-actions">
              <button
                type="button"
                className="comment-composer-cancel"
                onClick={() => { setIsReplying(false); setReplyText(""); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="comment-composer-submit"
                disabled={isSendingReply}
                onClick={async () => {
                  if (!replyText.trim()) return;
                  setIsSendingReply(true);
                  await onReply(replyText, comment.id);
                  setIsSendingReply(false);
                  setIsReplying(false);
                  setReplyText("");
                }}
              >
                Comment
              </button>
            </div>
          </div>
        )}

        {repliesExpanded && threadReplies.length > 0 && (
          <div className="comment-replies-list">
            {threadReplies.map((r) => (
              <CommentCard
                key={r.id}
                comment={r}
                postBrowserId={postBrowserId}
                canDelete={canDelete}
                onDelete={onDelete ? () => onDelete(r.id) : undefined}
                onReply={onReply}
                allComments={allComments}
                threadReplies={[]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
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
    <div
      style={{
        maxWidth: 520,
        margin: "32px auto",
        padding: 24,
        border: "1px solid #2e303a",
        borderRadius: 18,
        background: "linear-gradient(180deg, #1b1d24 0%, #14161c 100%)",
        boxShadow: "0 18px 50px rgba(0, 0, 0, 0.35)",
        textAlign: "left"
      }}
    >
      <h2 style={{ marginBottom: 16 }}>Login</h2>

      <div style={{ display: "grid", gap: 12 }}>
        <input
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
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
        <input
          type="password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
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
        <button
          onClick={signIn}
          style={{
            width: "100%",
            padding: "14px 18px",
            borderRadius: 14,
            border: "none",
            background: "#c084fc",
            color: "#14081d",
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer",
            boxShadow: "0 14px 30px rgba(192, 132, 252, 0.28)"
          }}
        >
          Login
        </button>
      </div>
    </div>
  );
}

// ==============================
// HOME
// ==============================
function Home() {
  const [posts, setPosts] = useState([]);
  const [commentCounts, setCommentCounts] = useState({});
  const [voteData, setVoteData] = useState({});
  const scrollRestoredRef = useRef(false);
  const scrollKey = "scroll:/";

  useEffect(() => {
    const onScroll = () => sessionStorage.setItem(scrollKey, String(window.scrollY));
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (scrollRestoredRef.current || posts.length === 0) return;
    scrollRestoredRef.current = true;
    const saved = sessionStorage.getItem(scrollKey);
    if (saved) window.scrollTo(0, parseInt(saved, 10));
  }, [posts]);

  const fetchPosts = useCallback(async () => {
    const [{ data: postsData }, { data: commentsData }] = await Promise.all([
      supabase
        .from("posts")
        .select("*")
        .eq("deleted", false)
        .order("pinned", { ascending: false })
        .order("last_activity", { ascending: false }),
      supabase
        .from("comments")
        .select("post_id")
        .eq("deleted", false)
    ]);

    const counts = {};
    (commentsData || []).forEach((comment) => {
      counts[comment.post_id] = (counts[comment.post_id] || 0) + 1;
    });

    setCommentCounts(counts);
    const hydratedPosts = hydratePostsWithBoardTags(postsData || []);
    setPosts(hydratedPosts);

    const votes = await fetchVotesForPosts(hydratedPosts.map((p) => p.id));
    setVoteData(votes);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchPosts();
    }, 0);
    const i = window.setInterval(() => {
      void fetchPosts();
    }, 4000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(i);
    };
  }, [fetchPosts]);

  return (
    <div className="home-shell">
      <BoardsTabs showHappening highlightHappening />

      <main className="home-feed">
        {posts.map((p) => {
          return (
            <PostCard
              key={p.id}
              post={p}
              commentCount={commentCounts[p.id] || 0}
              score={voteData[p.id]?.score ?? 0}
              myVote={voteData[p.id]?.myVote ?? 0}
              onVote={async (postId, value) => {
                const result = await voteOnPost(postId, value);
                if (result.success) {
                  setVoteData((prev) => ({ ...prev, [postId]: { score: result.score, myVote: result.myVote } }));
                }
              }}
            />
          );
        })}
      </main>
    </div>
  );
}

function BoardPage() {
  const { slug } = useParams();
  const [posts, setPosts] = useState([]);
  const [commentCounts, setCommentCounts] = useState({});
  const [voteData, setVoteData] = useState({});
  const board = getBoardBySlug(slug);
  const scrollRestoredRef = useRef(false);
  const scrollKey = `scroll:/board/${slug}`;

  useEffect(() => {
    scrollRestoredRef.current = false;
  }, [slug]);

  useEffect(() => {
    const onScroll = () => sessionStorage.setItem(scrollKey, String(window.scrollY));
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [scrollKey]);

  useEffect(() => {
    if (scrollRestoredRef.current || posts.length === 0) return;
    scrollRestoredRef.current = true;
    const saved = sessionStorage.getItem(scrollKey);
    if (saved) window.scrollTo(0, parseInt(saved, 10));
  }, [posts, scrollKey]);

  const fetchPosts = useCallback(async () => {
    const [{ data: postsData }, { data: commentsData }] = await Promise.all([
      supabase
        .from("posts")
        .select("*")
        .eq("deleted", false)
        .order("pinned", { ascending: false })
        .order("last_activity", { ascending: false }),
      supabase
        .from("comments")
        .select("post_id")
        .eq("deleted", false)
    ]);

    const counts = {};
    (commentsData || []).forEach((comment) => {
      counts[comment.post_id] = (counts[comment.post_id] || 0) + 1;
    });

    setCommentCounts(counts);
    const hydratedPosts = hydratePostsWithBoardTags(postsData || []);
    setPosts(hydratedPosts);

    const votes = await fetchVotesForPosts(hydratedPosts.map((p) => p.id));
    setVoteData(votes);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchPosts();
    }, 0);
    const i = window.setInterval(() => {
      void fetchPosts();
    }, 4000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(i);
    };
  }, [fetchPosts, slug]);

  if (!board) {
    return (
      <div className="home-shell">
        <BoardsTabs showHappening />
        <main className="home-feed">
          <div className="content-card">
            <h2 style={{ marginTop: 0 }}>Board not found</h2>
            <p style={{ color: "#cbd5e1" }}>That board doesn’t exist.</p>
          </div>
        </main>
      </div>
    );
  }

  const filteredPosts = filterPostsForBoard(posts, board.name);

  return (
    <div className="home-shell">
      <BoardsTabs activeBoard={board.name} showHappening />

      <main className="home-feed">
        {filteredPosts.length === 0 && (
          <div className="content-card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>No threads yet</h3>
            <p style={{ color: "#cbd5e1", marginBottom: 0 }}>
              This board is empty for now. Start the first thread.
            </p>
          </div>
        )}

        {filteredPosts.map((p) => {
          return (
            <PostCard
              key={p.id}
              post={p}
              commentCount={commentCounts[p.id] || 0}
              score={voteData[p.id]?.score ?? 0}
              myVote={voteData[p.id]?.myVote ?? 0}
              onVote={async (postId, value) => {
                const result = await voteOnPost(postId, value);
                if (result.success) {
                  setVoteData((prev) => ({ ...prev, [postId]: { score: result.score, myVote: result.myVote } }));
                }
              }}
            />
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
  const [searchParams] = useSearchParams();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const requestedBoard = getBoardBySlug(searchParams.get("board"));
  const [selectedBoardSlug, setSelectedBoardSlug] = useState(requestedBoard?.slug || BOARDS[0].slug);

  const createPost = async () => {
    try {
      if (!title.trim() || !content.trim()) return alert("Fill all fields");
      if (isSending) return;

      setIsSending(true);

      const { data } = await supabase.auth.getUser();
      const modMetadata = buildModMetadata(data.user);
      const authHeaders = await getOptionalAuthHeader();
      const selectedBoard = getBoardBySlug(selectedBoardSlug) || BOARDS[0];
      const browserId = getBrowserId();

      const res = await fetch("https://daboysforumip.coldbrainarchive.workers.dev/create-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders
        },
        body: JSON.stringify({
          title,
          content,
          board: selectedBoard.name,
          category: selectedBoard.name,
          community_id: selectedBoard.slug,
          browser_id: browserId,
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

      queuePendingBoardTag({
        title,
        content,
        browserId,
        boardName: selectedBoard.name
      });
      void syncBoardTagToPostRecord({
        title,
        content,
        browserId,
        board: selectedBoard
      });

      setTitle("");
      setContent("");
      setTimeout(() => {
        navigate(`/board/${selectedBoard.slug}`);
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
            Board
          </span>
          <select
            value={selectedBoardSlug}
            onChange={(e) => setSelectedBoardSlug(e.target.value)}
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
          >
            {BOARDS.map((board) => (
              <option key={board.slug} value={board.slug}>
                {board.icon} {board.name}
              </option>
            ))}
          </select>
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

        <button
          onClick={createPost}
          disabled={isSending}
          style={{
            width: "100%",
            padding: "14px 18px",
            borderRadius: 14,
            border: "none",
            background: isSending ? "#3b1f52" : "#c084fc",
            color: "#14081d",
            fontWeight: 700,
            fontSize: 15,
            cursor: isSending ? "default" : "pointer",
            boxShadow: isSending ? "none" : "0 14px 30px rgba(192, 132, 252, 0.28)"
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
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [isSendingComment, setIsSendingComment] = useState(false);
  const [pendingComments, setPendingComments] = useState([]);
  const [commentSort, setCommentSort] = useState("newest");
  const [voteData, setVoteData] = useState({ score: 0, myVote: 0 });
  const [shareLabel, setShareLabel] = useState("Share");

  const isMod = !!user;

  const load = useCallback(async () => {
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

    setPost(hydratePostWithBoardTag(p));
    setComments(c || []);
    if (p?.id) {
      const votes = await fetchVotesForPosts([p.id]);
      setVoteData(votes[p.id] || { score: 0, myVote: 0 });
    }
    setPendingComments((current) => {
      const nextPending = current.filter((pending) => {
        const matchedComment = (c || []).find(
          (comment) =>
            comment.content === pending.content &&
            comment.browser_id === pending.browser_id &&
            comment.parent_comment_id === pending.parent_comment_id &&
            Math.abs(new Date(comment.created_at).getTime() - new Date(pending.created_at).getTime()) < 10000
        );

        return !matchedComment;
      });

      return nextPending;
    });
  }, [id]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    const i = window.setInterval(() => {
      void load();
    }, 2000);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(i);
    };
  }, [load]);

  const submitComment = async (content, parentCommentId = null) => {
    if (!content.trim() || post?.locked) return;
    if (isSendingComment) return;

    const pendingId = crypto.randomUUID();

    try {
      const browserId = getBrowserId();
      const { data } = await supabase.auth.getUser();
      const modMetadata = buildModMetadata(data.user);
      const authHeaders = await getOptionalAuthHeader();
      setIsSendingComment(true);
      setPendingComments((current) => [
        ...current,
        {
          id: pendingId,
          content,
          created_at: new Date().toISOString(),
          browser_id: browserId,
          parent_comment_id: parentCommentId,
          username: modMetadata.username,
          is_mod: modMetadata.is_mod,
          isPending: true
        }
      ]);

      const res = await fetch(
        "https://daboysforumip.coldbrainarchive.workers.dev/add-comment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders
          },
          body: JSON.stringify({
            content,
            post_id: id,
            parent_comment_id: parentCommentId,
            browser_id: browserId,
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
        throw new Error(result.error);
      }

      setIsSendingComment(false);
      load();
    } catch (err) {
      setPendingComments((current) => current.filter((comment) => comment.id !== pendingId));
      setIsSendingComment(false);
      console.error(err);
    }
  };

  if (!post) return <div>Loading...</div>;

  const activeBoard = getBoardNameFromPost(post);
  const postIsMod = isModPost(post);
  const postAuthorLabel = post.username || `Anon #${shortId(post.browser_id)}`;
  const allComments = [...comments, ...pendingComments];
  const flatComments = [...allComments].sort((a, b) => {
    const tA = new Date(a.created_at).getTime();
    const tB = new Date(b.created_at).getTime();
    return commentSort === "oldest" ? tA - tB : tB - tA;
  });
  const topLevelComments = flatComments.filter((c) => !c.parent_comment_id);
  function getThreadReplies(rootId) {
    const result = [];
    const queue = [rootId];
    while (queue.length > 0) {
      const parentId = queue.shift();
      const direct = allComments.filter((c) => c.parent_comment_id === parentId);
      result.push(...direct);
      direct.forEach((r) => queue.push(r.id));
    }
    return result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  return (
    <div className="home-shell">
      <BoardsTabs activeBoard={activeBoard} showHappening />

      <main className="home-feed" style={{ textAlign: "left" }}>
        <div className="content-card feed-post-card" style={{ marginBottom: 16 }}>
          <div className="feed-post-header">
            <div className="feed-post-board-row">
              <span className="feed-post-board-group">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "5px 10px",
                    borderRadius: 999,
                    border: "none",
                    background: "#20262f",
                    color: "#dbe4ee",
                    fontSize: 14,
                    cursor: "pointer",
                    lineHeight: 1
                  }}
                >
                  ←
                </button>
                {activeBoard && (() => {
                  const boardSlug = BOARDS.find((b) => b.name === activeBoard)?.slug;
                  return boardSlug ? (
                    <Link to={`/board/${boardSlug}`} style={{ textDecoration: "none" }}>
                      <BoardBadge boardName={activeBoard} />
                    </Link>
                  ) : (
                    <BoardBadge boardName={activeBoard} />
                  );
                })()}
                {(post.pinned || post.locked) && (
                  <span className="feed-post-statuses">
                    {post.pinned && (
                      <span className="feed-post-status" style={{ color: "#f8fafc" }}>
                        📌
                      </span>
                    )}
                    {post.locked && (
                      <span className="feed-post-status" style={{ color: "#f87171" }}>
                        🔒
                      </span>
                    )}
                  </span>
                )}
              </span>
              <span className="feed-post-time">
                {timeAgo(post.last_activity || post.created_at)}
              </span>
            </div>
          </div>

          <div className="feed-post-main">
            <div className="feed-post-author-row">
              <span
                className="feed-post-author"
                style={{ color: postIsMod ? "#c084fc" : getUserColor(post.browser_id) }}
              >
                {postIsMod && "👤 "}
                {postAuthorLabel}
                <span style={{ color: "#8fa0b6", fontWeight: 500 }}> - Posted {timeAgo(post.created_at)}</span>
              </span>
            </div>

            <h2 className="feed-post-title" style={{ fontSize: 32, marginBottom: 12 }}>
              {post.title}
            </h2>
            <p className="feed-post-content">{post.content}</p>
          </div>

          <div className="feed-post-actions" style={{ marginTop: 14 }}>
            <div className="feed-post-vote-group">
              <button
                type="button"
                className={`feed-post-action-button${voteData.myVote === 1 ? " active" : ""}`}
                onClick={async (event) => {
                  event.preventDefault();
                  const result = await voteOnPost(post.id, voteData.myVote === 1 ? 0 : 1);
                  if (result.success) setVoteData({ score: result.score, myVote: result.myVote });
                }}
              >
                👍
              </button>
              <span className="feed-post-vote-score">
                {voteData.score}
              </span>
              <button
                type="button"
                className={`feed-post-action-button${voteData.myVote === -1 ? " active downvote" : ""}`}
                onClick={async (event) => {
                  event.preventDefault();
                  const result = await voteOnPost(post.id, voteData.myVote === -1 ? 0 : -1);
                  if (result.success) setVoteData({ score: result.score, myVote: result.myVote });
                }}
              >
                👎
              </button>
            </div>

            <span className="feed-post-action-pill">
              💬 {comments.length + pendingComments.length}
            </span>

            <button
              type="button"
              className="feed-post-action-pill"
              onClick={async (event) => {
                event.preventDefault();
                const shareUrl = `${window.location.origin}/post/${post.id}`;
                try {
                  if (navigator.share) {
                    await navigator.share({ title: post.title, text: post.title, url: shareUrl });
                    setShareLabel("Shared");
                  } else if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(shareUrl);
                    setShareLabel("Copied");
                  } else {
                    setShareLabel("Link ready");
                  }
                } catch (error) {
                  if (error?.name !== "AbortError") setShareLabel("Share failed");
                  return;
                }
                window.setTimeout(() => setShareLabel("Share"), 1800);
              }}
            >
              <span>↗</span>
              <span>{shareLabel}</span>
            </button>
          </div>

          {/* 🔥 MOD CONTROLS (POST) */}
          {isMod && (
            <div style={{ marginTop: 14, marginBottom: 10 }}>
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
        </div>

        <section className="comments-shell">
          <div className="content-card comments-panel">
            <div className="comments-panel-header">
              <div className="comments-panel-title">
                {comments.length + pendingComments.length} Comments
              </div>

              <div className="comments-panel-controls">
                <span>Sort</span>
                <select
                  className="comments-sort"
                  value={commentSort}
                  onChange={(e) => setCommentSort(e.target.value)}
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
            </div>

            {!post.locked && (
              <div className="comment-composer">
                <textarea
                  className="comment-composer-textarea"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Join the conversation..."
                  disabled={isSendingComment}
                  rows={3}
                />
                <div className="comment-composer-actions">
                  <button
                    type="button"
                    className="comment-composer-cancel"
                    onClick={() => setText("")}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="comment-composer-submit"
                    disabled={isSendingComment}
                    onClick={async () => {
                      const content = text;
                      setText("");
                      await submitComment(content);
                    }}
                  >
                    Comment
                  </button>
                </div>
              </div>
            )}

            <div className="comments-list">
              {topLevelComments.map((c) => (
                <CommentCard
                  key={c.id}
                  comment={c}
                  postBrowserId={post.browser_id}
                  canDelete={isMod}
                  onDelete={() => modAction({ type: "delete_comment", comment_id: c.id })}
                  onReply={(content, parentId) => submitComment(content, parentId)}
                  allComments={allComments}
                  threadReplies={getThreadReplies(c.id)}
                />
              ))}
            </div>
          </div>
        </section>
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
  const load = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

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
    <div
      style={{
        maxWidth: 900,
        margin: "32px auto",
        padding: 24,
        border: "1px solid #2e303a",
        borderRadius: 18,
        background: "linear-gradient(180deg, #1b1d24 0%, #14161c 100%)",
        boxShadow: "0 18px 50px rgba(0, 0, 0, 0.35)",
        textAlign: "left"
      }}
    >
      <h2 style={{ marginBottom: 18 }}>Mod Panel</h2>

      <div style={{ display: "grid", gap: 16, marginBottom: 24 }}>
        <div
          style={{
            padding: 18,
            border: "1px solid #2e303a",
            borderRadius: 16,
            background: "#161a20"
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 12, color: "#f8fafc" }}>Account</h3>
          <p style={{ marginBottom: 12 }}><b>Email:</b> {email}</p>

          <button
            onClick={logout}
            style={{
              padding: "12px 16px",
              borderRadius: 14,
              border: "none",
              background: "#1f2937",
              color: "#f8fafc",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            🚪 Logout
          </button>

          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <input
              placeholder="New email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
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
            <button
              onClick={updateEmail}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 14,
                border: "none",
                background: "#c084fc",
                color: "#14081d",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Update Email
            </button>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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
            <button
              onClick={updatePassword}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 14,
                border: "none",
                background: "#c084fc",
                color: "#14081d",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Update Password
            </button>
          </div>
        </div>

        <div
          style={{
            padding: 18,
            border: "1px solid #2e303a",
            borderRadius: 16,
            background: "#161a20"
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 12, color: "#f8fafc" }}>Display Name</h3>
          <div style={{ display: "grid", gap: 10 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
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
            <button
              onClick={saveName}
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: 14,
                border: "none",
                background: "#c084fc",
                color: "#14081d",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>

      <h3 style={{ marginBottom: 14, color: "#f8fafc" }}>Users</h3>

      <div style={{ display: "grid", gap: 12 }}>
        {users.map((u) => (
          <div
            key={u.browser_id}
            style={{
              padding: 16,
              border: "1px solid #2e303a",
              borderRadius: 16,
              background: "#161a20"
            }}
          >
            <div style={{ marginBottom: 6 }}>
              <b style={{ color: "#f8fafc" }}>{u.username}</b>
            </div>

            <small style={{ color: "#94a3b8" }}>{u.browser_id}</small>

            <div style={{ marginTop: 10, marginBottom: 10 }}>
              <span style={{ color: isBanned(u) ? "#f87171" : "#4ade80", fontWeight: 700 }}>
                {isBanned(u) ? "BANNED" : "ACTIVE"}
              </span>
            </div>

            <button
              onClick={() => toggleBan(u)}
              style={{
                padding: "12px 16px",
                borderRadius: 14,
                border: "none",
                background: isBanned(u) ? "#1f2937" : "#c084fc",
                color: isBanned(u) ? "#f8fafc" : "#14081d",
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              {isBanned(u) ? "Unban" : "Ban"}
            </button>
          </div>
        ))}
      </div>
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
          <Route path="/board/:slug" element={<BoardPage />} />
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
