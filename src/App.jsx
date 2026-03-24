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
function getUserColor(id, username) {
  // Prefer username so color is consistent across devices.
  // For old records with no username, use first 8 chars of browser_id
  // so at least the same device is always the same color.
  const seed = username || (id ? id.slice(0, 8) : null);
  if (!seed) return "#dbe4ee";

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
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
  const isMod = !!user && localStorage.getItem("user_role") === "mod";
  if (!isMod) {
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

      .feed-post-seemore {
        display: inline-block;
        margin-top: 6px;
        background: none;
        border: none;
        padding: 0;
        color: #c084fc;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
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

      .chat-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px 10px;
        border-bottom: 1px solid rgba(148, 163, 184, 0.1);
      }

      .chat-window {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 6px;
        position: relative;
        padding: 14px 12px;
        scroll-behavior: smooth;
      }

      .chat-msg {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        max-width: 100%;
      }

      .chat-avatar {
        width: 28px;
        height: 28px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 800;
        color: #0f1117;
        flex-shrink: 0;
      }

      .chat-msg-body {
        display: flex;
        flex-direction: column;
        gap: 3px;
        max-width: 80%;
      }

      .chat-msg-meta {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        font-weight: 700;
        padding: 0 4px;
      }

      .chat-msg-time {
        font-size: 11px;
        color: #8fa0b6;
        font-weight: 400;
      }

      .chat-bubble {
        background: #1e2530;
        color: #dbe4ee;
        border-radius: 4px 18px 18px 18px;
        padding: 9px 13px;
        font-size: 14px;
        line-height: 1.45;
        cursor: pointer;
        word-break: break-word;
        transition: opacity 0.15s;
      }

      .chat-bubble:hover {
        opacity: 0.85;
      }

      .chat-bubble.highlight {
        background: #2e3a50;
        transition: background 0.3s ease;
      }

      .chat-bubble.pending {
        opacity: 0.55;
      }

      .chat-quote-bar {
        border-left: 3px solid rgba(192,132,252,0.5);
        padding: 4px 8px;
        margin-bottom: 6px;
        border-radius: 0 6px 6px 0;
        background: rgba(148,163,184,0.07);
      }

      .chat-quote-name {
        display: block;
        font-size: 11px;
        font-weight: 700;
        color: #c084fc;
        margin-bottom: 2px;
      }

      .chat-quote-text {
        margin: 0;
        font-size: 12px;
        color: #8fa0b6;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }

      .chat-bubble-text {
        display: block;
        white-space: pre-wrap;
      }

      .chat-msg-footer {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 4px;
      }

      .chat-delete-btn {
        background: none;
        border: none;
        color: #8fa0b6;
        font-size: 11px;
        cursor: pointer;
        padding: 0;
        opacity: 0.6;
      }

      .chat-delete-btn:hover {
        opacity: 1;
      }

      .chat-compose {
        border-top: 1px solid rgba(148, 163, 184, 0.1);
        padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
        display: flex;
        flex-direction: column;
        gap: 6px;
        background: #1b1d24;
        position: sticky;
        bottom: 0;
        z-index: 10;
      }

      .chat-reply-preview {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        background: rgba(148, 163, 184, 0.07);
        border-radius: 10px;
        border-left: 3px solid #c084fc;
      }

      .chat-reply-preview-inner {
        flex: 1;
        min-width: 0;
      }

      .chat-reply-preview-name {
        display: block;
        font-size: 11px;
        font-weight: 700;
        color: #c084fc;
        margin-bottom: 2px;
      }

      .chat-reply-preview-text {
        margin: 0;
        font-size: 12px;
        color: #8fa0b6;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .chat-reply-dismiss {
        background: none;
        border: none;
        color: #8fa0b6;
        font-size: 14px;
        cursor: pointer;
        flex-shrink: 0;
        padding: 0 2px;
      }

      .chat-input-row {
        display: flex;
        align-items: flex-end;
        gap: 8px;
      }

      .chat-input {
        flex: 1;
        background: #0f1117;
        border: 1px solid #2e303a;
        border-radius: 20px;
        color: #f8fafc;
        font-size: 16px;
        font-family: inherit;
        padding: 9px 14px;
        resize: none;
        max-height: 120px;
        overflow-y: auto;
        line-height: 1.4;
      }

      .chat-input::placeholder {
        color: #8fa0b6;
      }

      .chat-input:focus {
        outline: none;
        border-color: #4b5563;
      }

      .chat-send-btn {
        width: 36px;
        height: 36px;
        border-radius: 999px;
        border: none;
        background: #7c3aed;
        color: #fff;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s;
      }

      .chat-send-btn:disabled {
        background: #2e303a;
        color: #8fa0b6;
        cursor: default;
      }

      .comment-flat {
        display: flex;
        align-items: flex-start;
        gap: 10px;
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
        padding-top: 1px;
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

      .comment-footer-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
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
        color: #c084fc;
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
        color: #c084fc;
      }

      .chat-action-sheet {
        display: flex;
        gap: 6px;
        margin-bottom: 5px;
      }

      .chat-action-btn {
        height: 26px;
        padding: 0 10px;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,0.2);
        background: transparent;
        color: #94a3b8;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      .chat-action-btn:hover {
        background: rgba(148,163,184,0.08);
      }

      .chat-reactions {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 5px;
      }

      .chat-reaction-pill {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        height: 24px;
        padding: 0 8px;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,0.2);
        background: rgba(148,163,184,0.07);
        font-size: 13px;
        cursor: pointer;
        color: #dbe4ee;
        transition: background 0.12s;
      }

      .chat-reaction-pill.mine {
        border-color: #7c3aed;
        background: rgba(124,58,237,0.15);
      }

      .chat-reaction-pill:hover {
        background: rgba(148,163,184,0.14);
      }

      .chat-reaction-count {
        font-size: 11px;
        font-weight: 700;
        color: #94a3b8;
      }

      .chat-emoji-picker-row {
        margin-top: 5px;
      }

      .chat-emoji-picker-input {
        height: 30px;
        padding: 0 12px;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,0.25);
        background: #0f1117;
        color: #f8fafc;
        font-size: 16px;
        outline: none;
        width: 140px;
      }

      .chat-emoji-picker-input::placeholder {
        color: #8fa0b6;
        font-size: 12px;
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
        border-radius: 10px;
        color: #f8fafc;
        font-size: 13px;
        font-family: inherit;
        padding: 10px 12px;
        resize: none;
        min-height: 60px;
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
        gap: 6px;
        margin-top: 8px;
      }

      .comment-composer-cancel {
        height: 28px;
        padding: 0 12px;
        border-radius: 999px;
        border: none;
        background: #2e303a;
        color: #dbe4ee;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
      }

      .comment-composer-submit {
        height: 28px;
        padding: 0 14px;
        border-radius: 999px;
        border: none;
        background: #c084fc;
        color: #14081d;
        font-size: 12px;
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
  { name: "Cage", slug: "cage", icon: "🪹" }
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

function countValidComments(commentsData) {
  const all = commentsData || [];
  const validIds = new Set();
  all.filter((c) => !c.parent_comment_id).forEach((c) => validIds.add(c.id));
  let changed = true;
  while (changed) {
    changed = false;
    all.forEach((c) => {
      if (!validIds.has(c.id) && c.parent_comment_id && validIds.has(c.parent_comment_id)) {
        validIds.add(c.id);
        changed = true;
      }
    });
  }
  const counts = {};
  all.filter((c) => validIds.has(c.id)).forEach((c) => {
    counts[c.post_id] = (counts[c.post_id] || 0) + 1;
  });
  return counts;
}

async function voteOnPost(postId, value) {
  const res = await fetch(`${WORKER_URL}/vote-post`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ post_id: postId, browser_id: getBrowserId(), value })
  });
  return res.json();
}

async function fetchReactions(commentIds) {
  if (!commentIds.length) return {};
  const { data } = await supabase
    .from("comment_reactions")
    .select("comment_id, browser_id, emoji")
    .in("comment_id", commentIds);
  const result = {};
  (data || []).forEach(({ comment_id, browser_id, emoji }) => {
    if (!result[comment_id]) result[comment_id] = {};
    if (!result[comment_id][emoji]) result[comment_id][emoji] = [];
    result[comment_id][emoji].push(browser_id);
  });
  return result;
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
        height: 26,
        padding: "0 8px",
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

const POST_PREVIEW_LIMIT = 280;

function PostCard({ post, commentCount = 0, score = 0, myVote = 0, onVote }) {
  const [shareLabel, setShareLabel] = useState("Share");
  const [expanded, setExpanded] = useState(false);
  const isMod = isModPost(post);
  const boardName = getBoardNameFromPost(post);
  const isLong = (post.content || "").length > POST_PREVIEW_LIMIT;

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
              style={{ color: isMod ? "#c084fc" : getUserColor(post.browser_id, post.username) }}
            >
              {isMod && "👤 "}
              {post.username || `Anon #${shortId(post.browser_id)}`}
            </span>
          </div>

          <h3 className="feed-post-title">
            {post.title}
          </h3>

          <p className="feed-post-content">
            {isLong && !expanded ? `${post.content.slice(0, POST_PREVIEW_LIMIT)}…` : post.content}
          </p>
          {isLong && (
            <button
              type="button"
              className="feed-post-seemore"
              onClick={(e) => { e.preventDefault(); setExpanded((v) => !v); }}
            >
              {expanded ? "See less" : "See more"}
            </button>
          )}
        </div>
      </Link>

      <div className="feed-post-actions">
        <button
          type="button"
          className="feed-post-action-pill"
          style={myVote === 1 ? { borderColor: "#c084fc", background: "rgba(192,132,252,0.15)" } : {}}
          onClick={(event) => {
            event.preventDefault();
            onVote?.(post.id, myVote === 1 ? 0 : 1);
          }}
        >
          <span>👍</span>
          <span>{score}</span>
        </button>

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
  const [quoteExpanded, setQuoteExpanded] = useState(false);
  const isPending = comment.isPending === true;
  const displayName =
    isPending && !isModUser && !comment.username
      ? "Anonymous"
      : (comment.username || `Anon #${shortId(comment.browser_id)}`);

  const avatarColor = isModUser ? "#c084fc" : getUserColor(comment.browser_id, comment.username);
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
    <div className="comment-flat">
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
        </div>

        {showQuote && (
          <div className="comment-quote" onClick={() => setQuoteExpanded((v) => !v)} style={{ cursor: "pointer" }}>
            <span className="comment-quote-author">{parentName}:</span>
            <p className="comment-quote-body" style={quoteExpanded ? { display: "block", WebkitLineClamp: "unset" } : {}}>{parentComment.content}</p>
            {!quoteExpanded && parentComment.content.length > 120 && (
              <span style={{ fontSize: 11, color: "#c084fc", fontWeight: 700 }}>Show more</span>
            )}
          </div>
        )}

        <div className="comment-body">{comment.content}</div>

        <div className="comment-footer-actions">
          {onReply && (
            <button
              type="button"
              className="comment-header-btn"
              onClick={() => {
                setIsReplying((v) => !v);
                setRepliesExpanded(true);
              }}
            >
              Reply
            </button>
          )}
          {threadReplies.length > 0 && (
            <button
              type="button"
              className="comment-header-btn"
              onClick={() => setRepliesExpanded((v) => !v)}
            >
              {repliesExpanded ? "▲" : "▼"} {threadReplies.length} {threadReplies.length === 1 ? "Reply" : "Replies"}
            </button>
          )}
          {canDelete && (
            <button type="button" className="comment-header-btn" onClick={onDelete}>
              🗑
            </button>
          )}
        </div>

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

function ChatMessage({ comment, postBrowserId, canDelete, onDelete, onReply, onReact, reactions = {}, allComments = [], onFindParent }) {
  const isModUser = isModPost(comment);
  const isPending = comment.isPending === true;
  const displayName = isPending && !isModUser && !comment.username
    ? "Anonymous"
    : (comment.username || `Anon #${shortId(comment.browser_id)}`);
  const avatarColor = isModUser ? "#c084fc" : getUserColor(comment.browser_id, comment.username);
  const avatarLetter = isModUser ? "👤" : (displayName[0]?.toUpperCase() || "?");
  const isOP = comment.browser_id === postBrowserId;
  const [showActions, setShowActions] = useState(false);
  const [isPickingEmoji, setIsPickingEmoji] = useState(false);
  const emojiInputRef = useRef(null);
  const myId = getBrowserId();

  const parentComment = comment.parent_comment_id
    ? allComments.find((c) => c.id === comment.parent_comment_id)
    : null;
  const parentName = parentComment
    ? (parentComment.username || `Anon #${shortId(parentComment.browser_id)}`)
    : null;

  const commentReactions = reactions[comment.id] || {};
  const reactionEntries = Object.entries(commentReactions);

  function handleReactClick() {
    setShowActions(false);
    setIsPickingEmoji(true);
    setTimeout(() => {
      if (emojiInputRef.current) {
        emojiInputRef.current.value = "";
        emojiInputRef.current.focus();
      }
    }, 0);
  }

  function handleEmojiInput(e) {
    const val = e.target.value;
    const chars = [...val];
    const emoji = chars.find((c) => /\p{Emoji}/u.test(c) && c !== "\u200d");
    if (emoji) {
      onReact && onReact(comment.id, emoji);
      e.target.value = "";
      setIsPickingEmoji(false);
    }
  }

  return (
    <div className="chat-msg" data-comment-id={comment.id}>
      <div className="chat-avatar" style={{ background: avatarColor }}>
        {avatarLetter}
      </div>
      <div className="chat-msg-body">
        <div className="chat-msg-meta">
          <span style={{ color: avatarColor }}>{displayName}</span>
          {isOP && <span className="comment-card-op">OP</span>}
          <span className="chat-msg-time">· {timeAgo(comment.created_at)}</span>
        </div>
        {showActions && (
          <div className="chat-action-sheet">
            <button
              type="button"
              className="chat-action-btn"
              onClick={() => { setShowActions(false); onReply && onReply(comment); }}
            >
              ↩ Reply
            </button>
            <button
              type="button"
              className="chat-action-btn"
              onClick={handleReactClick}
            >
              😊 React
            </button>
            {comment.parent_comment_id && (
              <button
                type="button"
                className="chat-action-btn"
                onClick={() => { setShowActions(false); onFindParent && onFindParent(comment.parent_comment_id); }}
              >
                🔍 Find
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                className="chat-action-btn"
                onClick={(e) => { e.stopPropagation(); setShowActions(false); onDelete(); }}
              >
                🗑 Delete
              </button>
            )}
          </div>
        )}

        <div
          className={`chat-bubble${isPending ? " pending" : ""}`}
          onClick={() => !isPending && setShowActions((v) => !v)}
        >
          {parentComment && (
            <div className="chat-quote-bar">
              <span className="chat-quote-name">{parentName}</span>
              <p className="chat-quote-text">{parentComment.content}</p>
            </div>
          )}
          <span className="chat-bubble-text">{comment.content}</span>
        </div>

        {reactionEntries.length > 0 && (
          <div className="chat-reactions">
            {reactionEntries.map(([emoji, voters]) => (
              <button
                key={emoji}
                type="button"
                className={`chat-reaction-pill${voters.includes(myId) ? " mine" : ""}`}
                onClick={() => onReact && onReact(comment.id, emoji)}
              >
                {emoji}
                <span className="chat-reaction-count">{voters.length}</span>
              </button>
            ))}
          </div>
        )}

        {isPickingEmoji && (
          <div className="chat-emoji-picker-row">
            <input
              ref={emojiInputRef}
              className="chat-emoji-picker-input"
              type="text"
              inputMode="text"
              placeholder="Pick an emoji..."
              onChange={handleEmojiInput}
              onBlur={() => setIsPickingEmoji(false)}
            />
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
    const onScroll = () => {
      if (scrollRestoredRef.current) sessionStorage.setItem(scrollKey, String(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (scrollRestoredRef.current || posts.length === 0) return;
    scrollRestoredRef.current = true;
    const saved = sessionStorage.getItem(scrollKey);
    if (saved) requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, parseInt(saved, 10))));
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
        .select("id, post_id, parent_comment_id")
        .eq("deleted", false)
    ]);

    setCommentCounts(countValidComments(commentsData));
    const hydratedPosts = hydratePostsWithBoardTags(
      (postsData || []).filter((p) => {
        const b = getBoardNameFromPost(p);
        return b !== "Cage" && b !== "Jail";
      })
    );
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
    const onScroll = () => {
      if (scrollRestoredRef.current) sessionStorage.setItem(scrollKey, String(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [scrollKey]);

  useEffect(() => {
    if (scrollRestoredRef.current || posts.length === 0) return;
    scrollRestoredRef.current = true;
    const saved = sessionStorage.getItem(scrollKey);
    if (saved) requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, parseInt(saved, 10))));
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
        .select("id, post_id, parent_comment_id")
        .eq("deleted", false)
    ]);

    setCommentCounts(countValidComments(commentsData));
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
function NewPost({ user, userRole }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [previewName, setPreviewName] = useState(null);
  const [isUserJailed, setIsUserJailed] = useState(false);
  const requestedBoard = getBoardBySlug(searchParams.get("board"));
  const [selectedBoardSlug, setSelectedBoardSlug] = useState(requestedBoard?.slug || BOARDS[0].slug);

  useEffect(() => {
    if (user) return;
    const browserId = getBrowserId();
    (async () => {
      const [{ data: jailRow }, { data: postRow }] = await Promise.all([
        supabase.from("jailed").select("browser_id").eq("browser_id", browserId).maybeSingle(),
        supabase.from("posts").select("username").eq("browser_id", browserId).eq("is_mod", false).not("username", "is", null).limit(1).maybeSingle()
      ]);
      if (jailRow) {
        setIsUserJailed(true);
        setSelectedBoardSlug("cage");
      }
      if (postRow?.username) { setPreviewName(postRow.username); return; }
      const { data: commentRow } = await supabase
        .from("comments")
        .select("username")
        .eq("browser_id", browserId)
        .eq("is_mod", false)
        .not("username", "is", null)
        .limit(1)
        .maybeSingle();
      if (commentRow?.username) setPreviewName(commentRow.username);
    })();
  }, [user]);

  const createPost = async () => {
    try {
      if (!title.trim() || !content.trim()) return alert("Fill all fields");
      if (isSending) return;
      if (isUserJailed && selectedBoardSlug !== "cage") {
        return alert("🪹 You are caged — you can only post in the Cage board");
      }

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
    <div className="home-shell">
      <BoardsTabs activeBoard={getBoardBySlug(selectedBoardSlug)?.name || ""} />
      <main className="home-feed" style={{ textAlign: "left" }}>
        <div className="content-card feed-post-card" style={{ marginBottom: 16 }}>

          <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid #2e303a" }}>
            <select
              value={selectedBoardSlug}
              onChange={(e) => setSelectedBoardSlug(e.target.value)}
              disabled={isSending || isUserJailed}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                border: "1px solid #3f4756",
                fontSize: 13,
                fontWeight: 700,
                background: "#0f1117",
                color: isUserJailed ? "#fbbf24" : "#f8fafc",
                cursor: isUserJailed ? "not-allowed" : "pointer",
                opacity: isUserJailed ? 0.8 : 1
              }}
            >
              {BOARDS.map((board) => (
                <option key={board.slug} value={board.slug}>
                  {board.icon} {board.name}
                </option>
              ))}
            </select>
            {isUserJailed && (
              <span style={{ color: "#fbbf24", fontSize: 12, fontWeight: 700, marginLeft: 8 }}>🪹 Caged — posts go to Cage only</span>
            )}
          </div>

          <div className="feed-post-author-row" style={{ marginBottom: 8 }}>
            {(() => {
              const browserId = getBrowserId();
              const isMod = !!user && userRole === "mod";
              const name = isMod ? getModName() : (previewName || `Anon #${shortId(browserId)}`);
              const color = isMod ? "#c084fc" : getUserColor(browserId, previewName);
              return (
                <span className="feed-post-author" style={{ color }}>
                  {isMod && "👤 "}{name}
                </span>
              );
            })()}
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give the thread a title"
              disabled={isSending}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "0",
                border: "none",
                fontSize: 20,
                fontWeight: 700,
                background: "transparent",
                color: "#f8fafc",
                outline: "none",
                paddingBottom: 10
              }}
            />

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What’s going on?"
              disabled={isSending}
              rows={6}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "0",
                border: "none",
                fontSize: 15,
                resize: "vertical",
                background: "transparent",
                color: "#dbe4ee",
                outline: "none",
                minHeight: 120,
                fontFamily: "inherit",
                lineHeight: 1.6
              }}
            />
          </div>

          <div style={{ borderTop: "1px solid #2e303a", marginTop: 14 }}>
            <div className="feed-post-actions" style={{ marginTop: 14 }}>
              <button
                onClick={createPost}
                disabled={isSending}
                className="feed-post-action-pill"
                style={{
                  background: isSending ? "#3b1f52" : "#c084fc",
                  color: "#14081d",
                  borderColor: "#c084fc",
                  fontWeight: 700,
                  opacity: isSending ? 0.7 : 1,
                  cursor: isSending ? "default" : "pointer"
                }}
              >
                {isSending ? "Sending..." : "Post"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ==============================
// POST PAGE (WITH MOD CONTROLS 🔥)
// ==============================
function PostPage({ user, userRole }) {
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
  const [commentSort] = useState("oldest");
  const [scrollToBottom, setScrollToBottom] = useState(true);
  const [replyTarget, setReplyTarget] = useState(null);
  const [reactions, setReactions] = useState({});
  const chatWindowRef = useRef(null);
  const isAtBottomRef = useRef(true);

  async function handleReact(commentId, emoji) {
    const myId = getBrowserId();
    const hasReacted = (reactions[commentId]?.[emoji] || []).includes(myId);
    // Optimistic update
    setReactions((prev) => {
      const commentReactions = { ...(prev[commentId] || {}) };
      const voters = commentReactions[emoji] ? [...commentReactions[emoji]] : [];
      if (hasReacted) {
        const updated = voters.filter((v) => v !== myId);
        if (updated.length === 0) delete commentReactions[emoji];
        else commentReactions[emoji] = updated;
      } else {
        commentReactions[emoji] = [...voters, myId];
      }
      return { ...prev, [commentId]: commentReactions };
    });
    // Persist
    if (hasReacted) {
      await supabase.from("comment_reactions").delete()
        .eq("comment_id", commentId).eq("browser_id", myId).eq("emoji", emoji);
    } else {
      await supabase.from("comment_reactions").insert({ comment_id: commentId, browser_id: myId, emoji });
    }
  }
  const [voteData, setVoteData] = useState({ score: 0, myVote: 0 });
  const [shareLabel, setShareLabel] = useState("Share");

  const isMod = !!user && userRole === "mod";
  const [isCaged, setIsCaged] = useState(false);

  useEffect(() => {
    if (isMod) return;
    const browserId = getBrowserId();
    supabase.from("jailed").select("browser_id").eq("browser_id", browserId).maybeSingle()
      .then(({ data }) => { if (data) setIsCaged(true); });
  }, [isMod]);

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
    const all = c || [];
    const validIds = new Set();
    // Two passes: first collect top-level, then replies whose parent is valid
    all.filter((comment) => !comment.parent_comment_id).forEach((comment) => validIds.add(comment.id));
    let changed = true;
    while (changed) {
      changed = false;
      all.forEach((comment) => {
        if (!validIds.has(comment.id) && comment.parent_comment_id && validIds.has(comment.parent_comment_id)) {
          validIds.add(comment.id);
          changed = true;
        }
      });
    }
    const filtered = all.filter((comment) => validIds.has(comment.id));
    setComments(filtered);
    setPendingComments([]);
    const commentIds = filtered.map((c) => c.id);
    const [votes, reactionData] = await Promise.all([
      p?.id ? fetchVotesForPosts([p.id]) : Promise.resolve({}),
      fetchReactions(commentIds)
    ]);
    if (p?.id) setVoteData(votes[p.id] || { score: 0, myVote: 0 });
    setReactions(reactionData);
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

  useEffect(() => {
    const el = chatWindowRef.current;
    if (!el) return;
    if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [comments.length, pendingComments.length]);

  const submitComment = async (content, parentCommentId = null) => {
    if (!content.trim() || post?.locked) return;
    if (isSendingComment) return;
    if (isCaged && getBoardNameFromPost(post) !== "Cage") {
      alert("🪹 You are caged — you can only post in the Cage board");
      return;
    }

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
      await load();
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
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    border: "none",
                    background: "#20262f",
                    color: "#dbe4ee",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    flexShrink: 0
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
                style={{ color: postIsMod ? "#c084fc" : getUserColor(post.browser_id, post.username) }}
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
            <button
              type="button"
              className="feed-post-action-pill"
              style={voteData.myVote === 1 ? { borderColor: "#c084fc", background: "rgba(192,132,252,0.15)" } : {}}
              onClick={async (event) => {
                event.preventDefault();
                const result = await voteOnPost(post.id, voteData.myVote === 1 ? 0 : 1);
                if (result.success) setVoteData({ score: result.score, myVote: result.myVote });
              }}
            >
              <span>👍</span>
              <span>{voteData.score}</span>
            </button>

            <button
              type="button"
              className="feed-post-action-pill"
              onClick={() => {
                const shell = document.querySelector(".comments-shell");
                if (shell) shell.scrollIntoView({ behavior: "smooth" });
                setTimeout(() => {
                  const el = chatWindowRef.current;
                  if (el) el.scrollTop = el.scrollHeight;
                }, 350);
              }}
            >
              <span>💬</span><span>{comments.length}</span>
            </button>

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
          <div className="content-card comments-panel" style={{ padding: 0, overflow: "clip", display: "flex", flexDirection: "column", height: "min(600px, 80dvh)" }}>
            <div className="chat-panel-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    border: "none",
                    background: "#20262f",
                    color: "#dbe4ee",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    flexShrink: 0
                  }}
                >
                  ←
                </button>
                <span className="comments-panel-title">{comments.length} Chats</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  className="feed-post-action-pill"
                  onClick={() => {
                    const el = chatWindowRef.current;
                    if (el) el.scrollTo({ top: scrollToBottom ? el.scrollHeight : 0, behavior: "smooth" });
                    setScrollToBottom(v => !v);
                  }}
                >
                  {scrollToBottom ? "Newest" : "Oldest"}
                </button>
                <button
                  type="button"
                  className="feed-post-action-pill"
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                >
                  🗒️
                </button>
              </div>
            </div>

            <div
              className="chat-window"
              ref={chatWindowRef}
              onScroll={() => {
                const el = chatWindowRef.current;
                if (!el) return;
                isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
              }}
            >
              {flatComments.map((c) => (
                <ChatMessage
                  key={c.id}
                  comment={c}
                  postBrowserId={post.browser_id}
                  canDelete={isMod}
                  onDelete={async () => { await modAction({ type: "delete_comment", comment_id: c.id }); await load(); }}
                  onReply={(msg) => setReplyTarget(msg)}
                  onReact={handleReact}
                  reactions={reactions}
                  allComments={allComments}
                  onFindParent={(parentId) => {
                    const win = chatWindowRef.current;
                    const el = win?.querySelector(`[data-comment-id="${parentId}"]`);
                    if (win && el) {
                      const target = el.offsetTop - (win.clientHeight / 2) + (el.offsetHeight / 2);
                      win.scrollTo({ top: target, behavior: "smooth" });
                      const bubble = el.querySelector(".chat-bubble");
                      if (bubble) {
                        setTimeout(() => {
                          bubble.classList.add("highlight");
                          setTimeout(() => bubble.classList.remove("highlight"), 1000);
                        }, 500);
                      }
                    }
                  }}
                />
              ))}
            </div>

            {!post.locked && (
              <div className="chat-compose">
                {replyTarget && (
                  <div className="chat-reply-preview">
                    <div className="chat-reply-preview-inner">
                      <span className="chat-reply-preview-name">
                        {replyTarget.username || `Anon #${shortId(replyTarget.browser_id)}`}
                      </span>
                      <p className="chat-reply-preview-text">{replyTarget.content}</p>
                    </div>
                    <button
                      type="button"
                      className="chat-reply-dismiss"
                      onClick={() => setReplyTarget(null)}
                    >
                      ✕
                    </button>
                  </div>
                )}
                <div className="chat-input-row">
                  <textarea
                    className="chat-input"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Message..."
                    disabled={isSendingComment}
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (!text.trim()) return;
                        const content = text;
                        const parentId = replyTarget?.id || null;
                        setText("");
                        setReplyTarget(null);
                        isAtBottomRef.current = true;
                        submitComment(content, parentId);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="chat-send-btn"
                    disabled={isSendingComment || !text.trim()}
                    onClick={() => {
                      if (!text.trim()) return;
                      const content = text;
                      const parentId = replyTarget?.id || null;
                      setText("");
                      setReplyTarget(null);
                      isAtBottomRef.current = true;
                      submitComment(content, parentId);
                    }}
                  >
                    ↑
                  </button>
                </div>
              </div>
            )}
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
  const [jailed, setJailed] = useState([]);
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("joined_desc");

  // LOAD DATA
  const load = useCallback(async () => {
    const { data: posts } = await supabase.from("posts").select("*");
    const { data: comments } = await supabase.from("comments").select("*");
    const { data: bans } = await supabase.from("bans").select("*");
    const { data: jailedData } = await supabase.from("jailed").select("*");
    const { data: userData } = await supabase.auth.getUser();

    setBans(bans || []);
    setJailed(jailedData || []);
    setEmail(userData?.user?.email || "");

    const all = [...(posts || []), ...(comments || [])];
    const map = {};

    all.forEach((u) => {
      if (!u.browser_id || !u.username) return;

      const existing = map[u.browser_id];
      const entryDate = u.created_at ? new Date(u.created_at) : null;
      const earliestDate = existing?.joined_at
        ? (entryDate && entryDate < existing.joined_at ? entryDate : existing.joined_at)
        : entryDate;

      map[u.browser_id] = {
        browser_id: u.browser_id,
        username: u.username,
        ip_hash: u.ip_hash,
        joined_at: earliestDate
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

  // JAIL SYSTEM
  const isJailed = (u) => jailed.some((j) => j.browser_id === u.browser_id);

  const toggleJail = async (u) => {
    if (isJailed(u)) {
      await supabase.from("jailed").delete().eq("browser_id", u.browser_id);
    } else {
      await supabase.from("jailed").insert({
        browser_id: u.browser_id,
        username: u.username,
        ip_hash: u.ip_hash
      });
    }
    load();
  };

  // DELETE USERNAME (gives them a fresh name next post)
  const deleteUsername = async (u) => {
    if (!confirm(`Clear "${u.username}"'s name? They'll get a new one next time they post.`)) return;
    await Promise.all([
      supabase.from("posts").update({ username: null }).eq("browser_id", u.browser_id),
      supabase.from("comments").update({ username: null }).eq("browser_id", u.browser_id)
    ]);
    load();
  };

  const filteredUsers = search.trim()
    ? users.filter((u) => u.username.toLowerCase().includes(search.toLowerCase()))
    : users;

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (sortBy === "joined_desc") return (b.joined_at || 0) - (a.joined_at || 0);
    if (sortBy === "joined_asc") return (a.joined_at || 0) - (b.joined_at || 0);
    if (sortBy === "name") return a.username.localeCompare(b.username);
    if (sortBy === "banned") {
      const aBanned = isBanned(a) ? 1 : 0;
      const bBanned = isBanned(b) ? 1 : 0;
      return bBanned - aBanned;
    }
    return 0;
  });

  return (
    <div style={{ width: "min(1280px, 100%)", margin: "0 auto", padding: "24px 20px 40px", boxSizing: "border-box", textAlign: "left" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 4px", color: "#f8fafc", fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>Mod Panel</h2>
        <p style={{ color: "#94a3b8", fontSize: 14 }}>{email}</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
        {/* Account */}
        <div className="content-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h3 style={{ margin: 0, color: "#f8fafc", fontSize: 16, fontWeight: 700 }}>Account</h3>

          <button
            onClick={logout}
            style={{ padding: "10px 16px", borderRadius: 12, border: "1px solid #374151", background: "#1f2937", color: "#f8fafc", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
          >
            🚪 Logout
          </button>

          <div style={{ display: "grid", gap: 8 }}>
            <input
              placeholder="New email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", borderRadius: 10, border: "1px solid #3f4756", fontSize: 14, background: "#0f1117", color: "#f8fafc" }}
            />
            <button
              onClick={updateEmail}
              style={{ width: "100%", padding: "10px 16px", borderRadius: 12, border: "none", background: "#c084fc", color: "#14081d", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
            >
              Update Email
            </button>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", borderRadius: 10, border: "1px solid #3f4756", fontSize: 14, background: "#0f1117", color: "#f8fafc" }}
            />
            <button
              onClick={updatePassword}
              style={{ width: "100%", padding: "10px 16px", borderRadius: 12, border: "none", background: "#c084fc", color: "#14081d", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
            >
              Update Password
            </button>
          </div>
        </div>

        {/* Display Name */}
        <div className="content-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h3 style={{ margin: 0, color: "#f8fafc", fontSize: 16, fontWeight: 700 }}>Display Name</h3>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", borderRadius: 10, border: "1px solid #3f4756", fontSize: 14, background: "#0f1117", color: "#f8fafc" }}
          />
          <button
            onClick={saveName}
            style={{ width: "100%", padding: "10px 16px", borderRadius: 12, border: "none", background: "#c084fc", color: "#14081d", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
          >
            Save
          </button>
        </div>
      </div>

      {/* Users */}
      <div className="content-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #2e303a", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, color: "#f8fafc", fontSize: 16, fontWeight: 700, marginRight: "auto" }}>
            Users <span style={{ color: "#64748b", fontWeight: 500, fontSize: 13 }}>{sortedUsers.length}</span>
          </h3>
          <input
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: 10, border: "1px solid #3f4756", background: "#0f1117", color: "#f8fafc", fontSize: 13, width: 180 }}
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: 10, border: "1px solid #374151", background: "#1f2937", color: "#dbe4ee", fontSize: 13, cursor: "pointer" }}
          >
            <option value="joined_desc">Newest first</option>
            <option value="joined_asc">Oldest first</option>
            <option value="name">Name A–Z</option>
            <option value="banned">Banned first</option>
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {sortedUsers.map((u, i) => {
            const banned = isBanned(u);
            const jailedUser = isJailed(u);
            const rowBg = banned
              ? "rgba(248, 113, 113, 0.04)"
              : jailedUser
              ? "rgba(251, 191, 36, 0.04)"
              : "transparent";
            return (
              <div
                key={u.browser_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 20px",
                  borderBottom: i < sortedUsers.length - 1 ? "1px solid #2e303a" : "none",
                  background: rowBg
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: getUserColor(u.browser_id, u.username),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#0f1117",
                    flexShrink: 0
                  }}
                >
                  {u.username[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ color: "#f8fafc", fontWeight: 700, fontSize: 14 }}>{u.username}</span>
                    {banned && <span style={{ fontSize: 11, fontWeight: 700, color: "#f87171", background: "rgba(248,113,113,0.12)", padding: "1px 7px", borderRadius: 999 }}>BANNED</span>}
                    {jailedUser && !banned && <span style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", background: "rgba(251,191,36,0.12)", padding: "1px 7px", borderRadius: 999 }}>CAGED</span>}
                    {u.joined_at && (
                      <span style={{ color: "#64748b", fontSize: 12 }}>· joined {timeAgo(u.joined_at)}</span>
                    )}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 12, fontFamily: "var(--mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.browser_id}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => deleteUsername(u)}
                    title="Clear name — gives them a fresh bird name next post"
                    style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid #374151", background: "#1f2937", color: "#94a3b8", fontWeight: 700, cursor: "pointer", fontSize: 12 }}
                  >
                    🗑 Clear
                  </button>
                  <button
                    onClick={() => toggleJail(u)}
                    style={{ padding: "7px 12px", borderRadius: 10, border: "none", background: jailedUser ? "#78350f" : "#451a03", color: jailedUser ? "#fde68a" : "#fbbf24", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                  >
                    {jailedUser ? "Uncage" : "🪹 Cage"}
                  </button>
                  <button
                    onClick={() => toggleBan(u)}
                    style={{ padding: "7px 12px", borderRadius: 10, border: "none", background: banned ? "#1f2937" : "#c084fc", color: banned ? "#f8fafc" : "#14081d", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                  >
                    {banned ? "Unban" : "Ban"}
                  </button>
                </div>
              </div>
            );
          })}
          {sortedUsers.length === 0 && (
            <div style={{ padding: "32px 20px", color: "#64748b", fontSize: 14, textAlign: "center" }}>No named users yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
// ==============================
// ACTIVITY PANEL
// ==============================
function ActivityPanel({ user, userRole, modName, onClose, onLogin, onLogout, browseUsername }) {
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [notifs, setNotifs] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const browserId = getBrowserId();

    (async () => {
      const [{ data: myPosts }, { data: myComments }] = await Promise.all([
        supabase.from("posts").select("id, title").eq("browser_id", browserId).eq("is_mod", false).eq("deleted", false),
        supabase.from("comments").select("id, content, post_id").eq("browser_id", browserId).eq("is_mod", false).eq("deleted", false)
      ]);

      const postIds = (myPosts || []).map((p) => p.id);
      const postTitleMap = Object.fromEntries((myPosts || []).map((p) => [p.id, p.title]));
      const commentIds = (myComments || []).map((c) => c.id);
      const commentPostMap = Object.fromEntries((myComments || []).map((c) => [c.id, c.post_id]));

      const results = [];

      const [postCommentsRes, repliesRes, reactionsRes, votesRes] = await Promise.all([
        postIds.length
          ? supabase.from("comments").select("id, content, username, browser_id, post_id, created_at").in("post_id", postIds).neq("browser_id", browserId).eq("deleted", false).order("created_at", { ascending: false }).limit(60)
          : Promise.resolve({ data: [] }),
        commentIds.length
          ? supabase.from("comments").select("id, content, username, browser_id, post_id, created_at").in("parent_comment_id", commentIds).neq("browser_id", browserId).eq("deleted", false).order("created_at", { ascending: false }).limit(60)
          : Promise.resolve({ data: [] }),
        commentIds.length
          ? supabase.from("comment_reactions").select("comment_id, emoji, browser_id").in("comment_id", commentIds)
          : Promise.resolve({ data: [] }),
        postIds.length
          ? supabase.from("post_votes").select("post_id, value, browser_id").in("post_id", postIds).neq("browser_id", browserId)
          : Promise.resolve({ data: [] })
      ]);

      // Comments on my posts
      (postCommentsRes.data || []).forEach((c) => {
        results.push({
          id: `c-${c.id}`, type: "comment", icon: "💬",
          text: `${c.username || "Someone"} commented on your post`,
          subtext: `"${(postTitleMap[c.post_id] || "").slice(0, 50)}"`,
          preview: c.content?.slice(0, 80),
          time: c.created_at, postId: c.post_id
        });
      });

      // Replies to my comments
      (repliesRes.data || []).forEach((r) => {
        results.push({
          id: `r-${r.id}`, type: "reply", icon: "↩️",
          text: `${r.username || "Someone"} replied to your comment`,
          preview: r.content?.slice(0, 80),
          time: r.created_at, postId: r.post_id
        });
      });

      // Reactions grouped by comment
      const reactionGroups = {};
      (reactionsRes.data || []).filter((r) => r.browser_id !== browserId).forEach((r) => {
        if (!reactionGroups[r.comment_id]) reactionGroups[r.comment_id] = {};
        if (!reactionGroups[r.comment_id][r.emoji]) reactionGroups[r.comment_id][r.emoji] = 0;
        reactionGroups[r.comment_id][r.emoji]++;
      });
      Object.entries(reactionGroups).forEach(([commentId, emojiCounts]) => {
        const emojiStr = Object.entries(emojiCounts).map(([e, n]) => `${e}${n > 1 ? ` ×${n}` : ""}`).join("  ");
        results.push({
          id: `rx-${commentId}`, type: "reaction", icon: Object.keys(emojiCounts)[0],
          text: `${emojiStr} on your comment`,
          time: null, postId: commentPostMap[commentId]
        });
      });

      // Votes grouped by post
      const voteGroups = {};
      (votesRes.data || []).forEach((v) => {
        if (!voteGroups[v.post_id]) voteGroups[v.post_id] = { up: 0, down: 0 };
        if (v.value > 0) voteGroups[v.post_id].up++;
        else if (v.value < 0) voteGroups[v.post_id].down++;
      });
      Object.entries(voteGroups).forEach(([postId, counts]) => {
        const parts = [];
        if (counts.up) parts.push(`👍 ${counts.up}`);
        if (counts.down) parts.push(`👎 ${counts.down}`);
        results.push({
          id: `v-${postId}`, type: "vote", icon: counts.up >= counts.down ? "👍" : "👎",
          text: `${parts.join("  ")} on your post`,
          subtext: `"${(postTitleMap[postId] || "").slice(0, 50)}"`,
          time: null, postId
        });
      });

      results.sort((a, b) => {
        if (a.time && b.time) return new Date(b.time) - new Date(a.time);
        if (a.time) return -1;
        if (b.time) return 1;
        return 0;
      });

      setNotifs(results);
      setLoading(false);
    })();
  }, []);

  const [confirmed, setConfirmed] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) return;
    setAuthLoading(true);
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      setAuthLoading(false);
      if (error) { alert(error.message); return; }
      // session is null when email confirmation is required
      if (!data.session) {
        setConfirmed(true);
      } else {
        // confirmation disabled — log straight in
        await supabase.from("profiles").insert({ id: data.user.id, email, role: "user" });
        onLogin(data.user, "user");
        onClose();
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      setAuthLoading(false);
      if (error) { alert(error.message); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
      onLogin(data.user, profile?.role || "user");
      onClose();
    }
  };

  const TABS = [
    { id: "all",      label: "All" },
    { id: "comment",  label: "💬 Comments" },
    { id: "reply",    label: "↩️ Replies" },
    { id: "reaction", label: "😍 Reactions" },
    { id: "vote",     label: "👍 Votes" }
  ];

  const filtered = tab === "all" ? notifs : notifs.filter((n) => n.type === tab);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 50, backdropFilter: "blur(3px)" }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(420px, 100vw)", background: "linear-gradient(180deg, #1b1d24 0%, #14161c 100%)", borderLeft: "1px solid #2e303a", zIndex: 51, display: "flex", flexDirection: "column", boxShadow: "-20px 0 60px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #2e303a", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: userRole === "mod" ? "#c084fc" : user ? getUserColor(user.id, user.email) : browseUsername ? getUserColor(getBrowserId(), browseUsername) : "#c084fc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "#14081d", flexShrink: 0 }}>
            {userRole === "mod" ? (modName[0]?.toUpperCase() || "M") : user ? (user.email?.[0]?.toUpperCase() || "U") : browseUsername ? browseUsername[0].toUpperCase() : "P"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#f8fafc", fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {userRole === "mod" ? modName : user ? user.email : browseUsername || "New User"}
            </div>
            <div style={{ color: "#64748b", fontSize: 12 }}>
              {user && userRole === "mod" ? "Moderator" : user ? "Member" : browseUsername ? "Anonymous member" : "No posts yet"}
            </div>
          </div>
          {user && userRole === "mod" && (
            <Link to="/mod" onClick={onClose} style={{ padding: "6px 12px", borderRadius: 10, background: "#c084fc", color: "#14081d", fontWeight: 700, fontSize: 12, textDecoration: "none", flexShrink: 0 }}>
              Mod Panel
            </Link>
          )}
          {user && (
            <button onClick={() => { onLogout(); onClose(); }} style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #374151", background: "transparent", color: "#94a3b8", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>
              Log out
            </button>
          )}
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "#1f2937", color: "#94a3b8", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #2e303a", overflowX: "auto", scrollbarWidth: "none", flexShrink: 0 }}>
          {TABS.map((t) => {
            const count = t.id === "all" ? notifs.length : notifs.filter((n) => n.type === t.id).length;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{ padding: "10px 13px", border: "none", borderBottom: tab === t.id ? "2px solid #c084fc" : "2px solid transparent", marginBottom: -1, background: "transparent", color: tab === t.id ? "#f8fafc" : "#64748b", fontWeight: tab === t.id ? 700 : 500, fontSize: 12, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", gap: 5 }}
              >
                {t.label}
                {count > 0 && (
                  <span style={{ background: tab === t.id ? "#c084fc" : "#1f2937", color: tab === t.id ? "#14081d" : "#94a3b8", borderRadius: 999, fontSize: 10, fontWeight: 800, padding: "1px 5px" }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Notification list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 32, color: "#64748b", textAlign: "center", fontSize: 14 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "48px 20px", color: "#64748b", textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🐦</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Nothing here yet</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Activity shows up once you start posting</div>
            </div>
          ) : (
            filtered.map((n) => (
              <Link
                key={n.id}
                to={n.postId ? `/post/${n.postId}` : "#"}
                onClick={onClose}
                style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 18px", textDecoration: "none", borderBottom: "1px solid #1a1c23", transition: "background 0.12s" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#1f2028"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1f2937", border: "1px solid #2e303a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                  {n.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{n.text}</div>
                  {n.subtext && <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 1 }}>{n.subtext}</div>}
                  {n.preview && <div style={{ color: "#64748b", fontSize: 12, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.preview}</div>}
                  {n.time && <div style={{ color: "#475569", fontSize: 11, marginTop: 5 }}>{timeAgo(n.time)}</div>}
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Auth section */}
        {!user && (
          <div style={{ padding: "14px 18px", borderTop: "1px solid #2e303a", background: "#0d0f14", flexShrink: 0 }}>
            {confirmed ? (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📧</div>
                <div style={{ color: "#f8fafc", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Check your email</div>
                <div style={{ color: "#64748b", fontSize: 12, marginBottom: 12 }}>We sent a confirmation link to <b style={{ color: "#94a3b8" }}>{email}</b></div>
                <button onClick={() => { setConfirmed(false); setIsSignUp(false); }} style={{ padding: "8px 16px", borderRadius: 10, border: "1px solid #374151", background: "transparent", color: "#94a3b8", fontSize: 12, cursor: "pointer" }}>
                  Back to login
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {isSignUp ? "Create account" : "Login"}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <input
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid #3f4756", background: "#16171d", color: "#f8fafc", fontSize: 13, width: "100%", boxSizing: "border-box" }}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAuth()}
                    style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid #3f4756", background: "#16171d", color: "#f8fafc", fontSize: 13, width: "100%", boxSizing: "border-box" }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleAuth} disabled={authLoading} style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "none", background: "#c084fc", color: "#14081d", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                      {authLoading ? "…" : isSignUp ? "Sign Up" : "Log In"}
                    </button>
                    <button onClick={() => setIsSignUp((s) => !s)} style={{ padding: "9px 12px", borderRadius: 10, border: "1px solid #374151", background: "transparent", color: "#94a3b8", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
                      {isSignUp ? "Log In instead" : "Sign Up"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ==============================
// MAIN
// ==============================
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

export default function App() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(localStorage.getItem("user_role") || null);
  const [modName, setModName] = useState(localStorage.getItem("mod_name") || "Mod");
  const [browseUsername, setBrowseUsername] = useState(null);
  const [showActivity, setShowActivity] = useState(false);

  const applyRole = (role) => {
    if (role) localStorage.setItem("user_role", role);
    else localStorage.removeItem("user_role");
    setUserRole(role);
  };

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user;
      setUser(u);
      if (u) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", u.id).maybeSingle();
        applyRole(profile?.role || "user");
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user || null;
      setUser(u);
      if (u) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", u.id).maybeSingle();
        if (!profile) {
          await supabase.from("profiles").insert({ id: u.id, email: u.email, role: "user" });
          applyRole("user");
        } else {
          applyRole(profile.role);
        }
      } else {
        applyRole(null);
      }
    });
    return () => { subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const browserId = getBrowserId();
    (async () => {
      const { data: postRow } = await supabase
        .from("posts").select("username").eq("browser_id", browserId)
        .eq("is_mod", false).not("username", "is", null).limit(1).maybeSingle();
      if (postRow?.username) { setBrowseUsername(postRow.username); return; }
      const { data: commentRow } = await supabase
        .from("comments").select("username").eq("browser_id", browserId)
        .eq("is_mod", false).not("username", "is", null).limit(1).maybeSingle();
      if (commentRow?.username) setBrowseUsername(commentRow.username);
    })();
  }, []);
  return (
    <ErrorBoundary>
      <Router>
        <RealtimeStyles />
        <nav className="app-topbar">
          <Link to="/" className="app-brand">postchats 💬</Link>

          <div className="app-actions">
            <Link to="/new" className="app-chip">New Post</Link>
            <button
              onClick={() => setShowActivity(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: userRole === "mod"
                  ? "#c084fc"
                  : user
                  ? getUserColor(user.id, user.email)
                  : browseUsername
                  ? getUserColor(getBrowserId(), browseUsername)
                  : "#c084fc",
                color: "#14081d",
                fontWeight: 800,
                fontSize: 15,
                flexShrink: 0,
                border: userRole === "mod" ? "2px solid #d8b4fe" : "2px solid transparent",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                cursor: "pointer"
              }}
            >
              {userRole === "mod"
                ? (modName[0]?.toUpperCase() || "M")
                : user
                ? (user.email?.[0]?.toUpperCase() || "U")
                : browseUsername
                ? browseUsername[0].toUpperCase()
                : "P"}
            </button>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/board/:slug" element={<BoardPage />} />
          <Route path="/new" element={<NewPost user={user} userRole={userRole} />} />
          <Route path="/post/:id" element={<PostPage user={user} userRole={userRole} />} />
          <Route path="/mod" element={userRole === "mod" ? <ModPanel setModName={setModName} /> : <Auth setUser={setUser} />} />
        </Routes>

        {showActivity && (
          <ActivityPanel
            user={user}
            userRole={userRole}
            modName={modName}
            onClose={() => setShowActivity(false)}
            onLogin={(u, role) => { setUser(u); applyRole(role); }}
            onLogout={() => { supabase.auth.signOut(); applyRole(null); }}
            browseUsername={browseUsername}
          />
        )}
      </Router>
    </ErrorBoundary>
  );
}
