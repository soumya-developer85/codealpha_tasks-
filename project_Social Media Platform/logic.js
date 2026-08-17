"use strict";

/* ================================================================
   1. STORAGE LAYER — everything persisted through localStorage
   ================================================================ */
const STORE_KEYS = {
  USERS: "pulse_users",
  POSTS: "pulse_posts",
  SESSION: "pulse_session",
  NOTIFS: "pulse_notifications",
  MESSAGES: "pulse_messages",
};

const Store = {
  getUsers(){ return JSON.parse(localStorage.getItem(STORE_KEYS.USERS) || "{}"); },
  saveUsers(users){ localStorage.setItem(STORE_KEYS.USERS, JSON.stringify(users)); },

  getPosts(){ return JSON.parse(localStorage.getItem(STORE_KEYS.POSTS) || "[]"); },
  savePosts(posts){ localStorage.setItem(STORE_KEYS.POSTS, JSON.stringify(posts)); },

  getSession(){ return localStorage.getItem(STORE_KEYS.SESSION); },
  setSession(username){ localStorage.setItem(STORE_KEYS.SESSION, username); },
  clearSession(){ localStorage.removeItem(STORE_KEYS.SESSION); },

  getNotifs(){ return JSON.parse(localStorage.getItem(STORE_KEYS.NOTIFS) || "{}"); },
  saveNotifs(n){ localStorage.setItem(STORE_KEYS.NOTIFS, JSON.stringify(n)); },

  getMessages(){ return JSON.parse(localStorage.getItem(STORE_KEYS.MESSAGES) || "{}"); },
  saveMessages(m){ localStorage.setItem(STORE_KEYS.MESSAGES, JSON.stringify(m)); },
};

/* Seed a little demo content the very first time the app runs,
   so the feed / people list isn't empty for a first-time visitor. */
function seedDemoDataIfEmpty(){
  const users = Store.getUsers();
  if (Object.keys(users).length > 0) return;

  const demoUsers = {
    "ada": mkUser("ada", "Ada Lovelace", "Building things with logic and curiosity. #math"),
    "grace": mkUser("grace", "Grace Hopper", "Compilers, coffee, and clean code. #dev"),
  };
  Store.saveUsers(demoUsers);

  const demoPosts = [
    { id: uid(), author:"ada", content:"First post on Pulse! Excited to be here. #hello", ts: Date.now()-1000*60*60*5, likes:[], comments:[
      { id: uid(), author:"grace", content:"Welcome aboard!", ts: Date.now()-1000*60*60*4 }
    ], edited:false },
    { id: uid(), author:"grace", content:"Anyone else obsessed with tidy commit messages? #dev #git", ts: Date.now()-1000*60*30, likes:["ada"], comments:[], edited:false },
  ];
  Store.savePosts(demoPosts);
}

function mkUser(username, displayName, bio){
  return {
    username, displayName, bio,
    followers: [], following: [], bookmarks: [],
    theme: "light", accent: "#5B3DF5", avatarEmoji: "",
    lastRead: {}, pinnedPostId: null,
  };
}

/* ================================================================
   2. UTILITIES
   ================================================================ */
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function hashCode(str){
  let hash = 0;
  for (let i=0; i<str.length; i++){
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  return Math.abs(hash);
}

function initials(name){
  return name.trim().slice(0,2).toUpperCase();
}

function displayNameFor(username){
  const users = Store.getUsers();
  const u = users[username];
  return (u && u.displayName) ? u.displayName : username;
}

/* Signature avatar: a rounded square tile with a two-tone gradient
   deterministically derived from the username's hash — or a chosen emoji. */
function avatarStyle(username){
  const h = hashCode(username);
  const hue1 = h % 360;
  const hue2 = (hue1 + 46) % 360;
  return `background: linear-gradient(135deg, hsl(${hue1} 78% 56%), hsl(${hue2} 78% 46%));`;
}

function renderAvatarEl(username, size, idAttr){
  const users = Store.getUsers();
  const u = users[username];
  const idPart = idAttr ? `id="${idAttr}" ` : "";
  if (u && u.avatarEmoji){
    return `<div ${idPart}class="avatar sz-${size} emoji" style="${avatarStyle(username)}">${escapeHtml(u.avatarEmoji)}</div>`;
  }
  return `<div ${idPart}class="avatar sz-${size}" style="${avatarStyle(username)}">${escapeHtml(initials(displayNameFor(username)))}</div>`;
}

function timeAgo(ts){
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff/1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec/60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min/60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr/24);
  if (day < 7) return `${day}d`;
  return new Date(ts).toLocaleDateString();
}

/* Escapes content, then turns #hashtag tokens into clickable spans. */
function renderContentWithTags(text){
  const escaped = escapeHtml(text);
  return escaped.replace(/(^|[\s])#([a-zA-Z0-9_]{2,30})/g, (m, pre, tag) => {
    return `${pre}<button type="button" class="hashtag" data-tag="${tag.toLowerCase()}">#${tag}</button>`;
  });
}

function extractTags(text){
  const matches = text.match(/#([a-zA-Z0-9_]{2,30})/g) || [];
  return matches.map(t => t.slice(1).toLowerCase());
}

/* ================================================================
   3. APP STATE
   ================================================================ */
const state = {
  currentUser: null,
  view: "feed",          // 'feed' | 'search' | 'messages' | 'bookmarks' | 'profile' | 'people' | 'settings'
  profileTarget: null,
  sort: "latest",        // 'latest' | 'top'
  searchQuery: "",
  openPostMenu: null,    // postId whose ⋯ menu is open
  msgView: "list",       // 'list' | 'chat'
  msgPeer: null,         // username of the open conversation
};

const ACCENT_SWATCHES = [
  { name: "Violet", hex: "#5B3DF5" },
  { name: "Mint",   hex: "#0FAE7E" },
  { name: "Coral",  hex: "#FF6B4A" },
  { name: "Blue",   hex: "#2E7DFF" },
  { name: "Rose",   hex: "#E8437B" },
  { name: "Amber",  hex: "#D68B00" },
];
const EMOJI_OPTIONS = ["", "😀","🚀","🐙","🦊","🌵","🎧","☕","🌊","🔥","🌙"];

/* ================================================================
   4. AUTH FLOW
   ================================================================ */
const authForm = document.getElementById("auth-form");
const authUsernameInput = document.getElementById("auth-username");
const authDisplayInput = document.getElementById("auth-display");
const authBioInput = document.getElementById("auth-bio");
const authError = document.getElementById("auth-error");

authForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = authUsernameInput.value.trim().toLowerCase().replace(/\s+/g, "_");

  if (!username){
    showAuthError("Please enter a username.");
    return;
  }
  if (!/^[a-z0-9_]{2,20}$/.test(username)){
    showAuthError("Use 2–20 letters, numbers, or underscores only.");
    return;
  }

  const users = Store.getUsers();

  if (!users[username]){
    users[username] = mkUser(
      username,
      authDisplayInput.value.trim() || username,
      authBioInput.value.trim() || "New to Pulse 👋"
    );
    Store.saveUsers(users);
  }

  Store.setSession(username);
  authError.classList.add("hidden");
  authForm.reset();
  enterApp(username);
});

function showAuthError(msg){
  authError.textContent = msg;
  authError.classList.remove("hidden");
}

function logout(){
  Store.clearSession();
  state.currentUser = null;
  document.getElementById("screen-app").classList.add("hidden");
  document.getElementById("screen-auth").classList.remove("hidden");
  applyTheme("light", "#5B3DF5");
}

document.getElementById("logout-btn").addEventListener("click", logout);

/* ================================================================
   5. THEME / ACCENT — applied globally, saved per-account
   ================================================================ */
function applyTheme(theme, accentHex){
  document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");
  if (accentHex){
    document.documentElement.style.setProperty("--accent", accentHex);
    // a soft tint derived from the accent for highlighted backgrounds
    document.documentElement.style.setProperty("--accent-soft", accentHex + "22");
  }
}

/* ================================================================
   6. NAVIGATION — hides/shows the top-level screens & inner views
   ================================================================ */
function enterApp(username){
  state.currentUser = username;
  document.getElementById("screen-auth").classList.add("hidden");
  document.getElementById("screen-app").classList.remove("hidden");

  const users = Store.getUsers();
  const u = users[username] || mkUser(username, username, "New to Pulse 👋");
  // Defensive defaults for accounts created before a given feature existed
  u.bookmarks = u.bookmarks || [];
  u.displayName = u.displayName || username;
  u.theme = u.theme || "light";
  u.accent = u.accent || "#5B3DF5";
  u.lastRead = u.lastRead || {};
  u.pinnedPostId = u.pinnedPostId || null;
  users[username] = u;
  Store.saveUsers(users);

  applyTheme(u.theme, u.accent);

  document.getElementById("sidebar-username").textContent = u.displayName;
  document.getElementById("sidebar-handle").textContent = "@" + username;
  document.getElementById("sidebar-avatar").outerHTML = renderAvatarEl(username, 32, "sidebar-avatar");
  document.getElementById("composer-avatar").outerHTML = renderAvatarEl(username, 40, "composer-avatar");

  updateNotifBadge();
  updateMessagesBadge();
  navigate("feed");
}

function navigate(view, param){
  state.view = view;
  closeNotifPanel();
  state.openPostMenu = null;

  if (view === "profile") state.profileTarget = param || state.currentUser;
  if (view === "search" && typeof param === "string") state.searchQuery = param;
  if (view === "messages"){
    if (param){ state.msgView = "chat"; state.msgPeer = param; }
    else { state.msgView = "list"; state.msgPeer = null; }
  }

  ["feed","search","messages","bookmarks","profile","people","settings"].forEach(v=>{
    document.getElementById("view-" + v).classList.toggle("hidden", v !== view);
  });

  document.querySelectorAll(".nav-item[data-nav]").forEach(btn=>{
    btn.classList.toggle("active", btn.dataset.nav === view);
  });

  if (view === "feed") renderFeed();
  if (view === "search") renderSearch();
  if (view === "messages") renderMessagesView();
  if (view === "bookmarks") renderBookmarks();
  if (view === "profile") renderProfile(state.profileTarget);
  if (view === "people") renderPeople();
  if (view === "settings") renderSettings();

  updateMessagesBadge();
}

document.querySelectorAll(".nav-item[data-nav]").forEach(btn=>{
  btn.addEventListener("click", () => navigate(btn.dataset.nav));
});

/* ================================================================
   7. NOTIFICATIONS
   ================================================================ */
function addNotification(toUser, note){
  if (toUser === state.currentUser) return; // don't notify yourself
  const all = Store.getNotifs();
  if (!all[toUser]) all[toUser] = [];
  all[toUser].unshift({ id: uid(), ts: Date.now(), read:false, ...note });
  all[toUser] = all[toUser].slice(0, 50);
  Store.saveNotifs(all);
  if (toUser === state.currentUser) updateNotifBadge();
}

function updateNotifBadge(){
  const all = Store.getNotifs();
  const mine = all[state.currentUser] || [];
  const unread = mine.filter(n => !n.read).length;
  const bell = document.getElementById("notif-bell");
  let badge = bell.parentElement.querySelector(".nav-badge-bell");
  if (unread > 0){
    bell.textContent = "🔔";
    bell.style.position = "relative";
    if (!badge){
      badge = document.createElement("span");
      badge.className = "nav-badge nav-badge-bell";
      badge.style.position = "absolute";
      badge.style.top = "-4px";
      badge.style.right = "-4px";
      bell.appendChild(badge);
    }
    badge.textContent = unread > 9 ? "9+" : String(unread);
  } else if (badge){
    badge.remove();
  }
}

function notifText(n){
  const who = `<strong>${escapeHtml(displayNameFor(n.from))}</strong>`;
  if (n.type === "like") return `${who} liked your post`;
  if (n.type === "comment") return `${who} commented on your post`;
  if (n.type === "follow") return `${who} started following you`;
  if (n.type === "message") return `${who} sent you a message`;
  return `${who} did something`;
}

function renderNotifPanel(){
  const all = Store.getNotifs();
  const mine = all[state.currentUser] || [];
  const panel = document.getElementById("notif-panel");

  if (mine.length === 0){
    panel.innerHTML = `<h3>Notifications</h3><div class="notif-empty">You're all caught up.</div>`;
    return;
  }

  panel.innerHTML = `<h3>Notifications</h3>` + mine.map(n => {
    const jumpAttr = n.type === "message" ? `data-goto-chat="${escapeHtml(n.from)}"`
                    : n.type === "follow" ? `data-goto-profile="${escapeHtml(n.from)}"`
                    : "";
    return `
    <div class="notif-item ${n.read ? "" : "unread"}" ${jumpAttr} ${jumpAttr ? 'style="cursor:pointer;"' : ""}>
      ${renderAvatarEl(n.from, 32)}
      <div>
        <div class="ntext">${notifText(n)}</div>
        <div class="ntime">${timeAgo(n.ts)}</div>
      </div>
    </div>`;
  }).join("");

  // mark all as read once opened
  mine.forEach(n => n.read = true);
  all[state.currentUser] = mine;
  Store.saveNotifs(all);
}

function closeNotifPanel(){
  document.getElementById("notif-panel").classList.add("hidden");
}

document.getElementById("notif-bell").addEventListener("click", (e) => {
  e.stopPropagation();
  const panel = document.getElementById("notif-panel");
  const willOpen = panel.classList.contains("hidden");
  closeNotifPanel();
  if (willOpen){
    renderNotifPanel();
    panel.classList.remove("hidden");
    updateNotifBadge();
  }
});

document.addEventListener("click", (e) => {
  const wrap = document.getElementById("notif-wrap");
  if (wrap && !wrap.contains(e.target)) closeNotifPanel();
});

/* ================================================================
   8. FEED — create posts, list posts, like, comment, sort
   ================================================================ */
const composerInput = document.getElementById("composer-input");
const composerCount = document.getElementById("composer-count");
const composerImageToggle = document.getElementById("composer-image-toggle");
const composerImageRow = document.getElementById("composer-image-row");
const composerImageInput = document.getElementById("composer-image-input");
const feedList = document.getElementById("feed-list");

composerInput.addEventListener("input", () => {
  const len = composerInput.value.length;
  composerCount.textContent = len;
  composerCount.classList.toggle("warn", len > 260);
});

composerImageToggle.addEventListener("click", () => {
  composerImageRow.classList.toggle("hidden");
  if (!composerImageRow.classList.contains("hidden")) composerImageInput.focus();
});

document.getElementById("composer-post").addEventListener("click", () => {
  const content = composerInput.value.trim();
  const imageUrlRaw = composerImageInput.value.trim();
  const imageUrl = /^https?:\/\/.+/i.test(imageUrlRaw) ? imageUrlRaw : null;

  if (!content && !imageUrl) return; // require at least text or an image

  const posts = Store.getPosts();
  posts.unshift({
    id: uid(),
    author: state.currentUser,
    content,
    image: imageUrl,
    ts: Date.now(),
    likes: [],
    comments: [],
    edited: false,
  });
  Store.savePosts(posts);

  composerInput.value = "";
  composerCount.textContent = "0";
  composerCount.classList.remove("warn");
  composerImageInput.value = "";
  composerImageRow.classList.add("hidden");
  renderFeed();
});

/* Images are user-supplied URLs, so failures are handled gracefully.
   'error' doesn't bubble, but it does propagate during the capture phase,
   so one delegated listener here covers every post image on the page. */
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img.tagName === "IMG" && img.classList.contains("post-image")){
    const wrap = img.closest(".post-image-wrap");
    if (wrap) wrap.innerHTML = `<div class="img-broken">⚠️ Image couldn't be loaded</div>`;
  }
}, true);

document.querySelectorAll(".sort-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    state.sort = tab.dataset.sort;
    document.querySelectorAll(".sort-tab").forEach(t => t.classList.toggle("active", t === tab));
    renderFeed();
  });
});

function sortedPosts(posts){
  const copy = posts.slice();
  if (state.sort === "top"){
    return copy.sort((a,b) => (b.likes.length - a.likes.length) || (b.ts - a.ts));
  }
  return copy.sort((a,b) => b.ts - a.ts);
}

function renderFeed(){
  const posts = sortedPosts(Store.getPosts());

  if (posts.length === 0){
    feedList.innerHTML = `<div class="empty-state"><strong>No posts yet</strong>Be the first to share something.</div>`;
    return;
  }
  feedList.innerHTML = posts.map(post => renderPostCard(post)).join("");
}

function renderPostCard(post){
  const liked = post.likes.includes(state.currentUser);
  const users = Store.getUsers();
  const me = users[state.currentUser] || { bookmarks: [] };
  const bookmarked = (me.bookmarks || []).includes(post.id);
  const isOwn = post.author === state.currentUser;
  const menuOpen = state.openPostMenu === post.id;

  return `
  <article class="post" data-post-id="${post.id}">
    <div class="post-head">
      ${renderAvatarEl(post.author, 40)}
      <div class="meta">
        <div class="name-row">
          <button class="author-link" data-goto-profile="${escapeHtml(post.author)}">${escapeHtml(displayNameFor(post.author))}</button>
          <span class="uname-sub">@${escapeHtml(post.author)}</span>
          <span class="time">· ${timeAgo(post.ts)}</span>
          ${post.edited ? `<span class="edited-tag">edited</span>` : ""}
          ${(users[post.author] && users[post.author].pinnedPostId === post.id) ? `<span class="edited-tag" style="color:var(--accent);">· 📌 pinned</span>` : ""}
        </div>
      </div>
      ${isOwn ? `
        <div class="post-menu-wrap">
          <button class="post-menu-btn" data-post-menu-toggle="${post.id}">⋯</button>
          <div class="post-menu ${menuOpen ? "" : "hidden"}" data-post-menu="${post.id}">
            <button data-pin-post="${post.id}">${(users[state.currentUser] && users[state.currentUser].pinnedPostId === post.id) ? "📌 Unpin post" : "📌 Pin to profile"}</button>
            <button data-edit-post="${post.id}">✏️ Edit post</button>
            <button class="danger" data-delete-post="${post.id}">🗑️ Delete post</button>
          </div>
        </div>
      ` : ""}
    </div>

    ${post.content ? `<div class="post-body" data-post-body="${post.id}">${renderContentWithTags(post.content)}</div>` : `<div class="post-body" data-post-body="${post.id}"></div>`}
    ${post.image ? `
      <div class="post-image-wrap">
        <img src="${escapeHtml(post.image)}" alt="Post image" class="post-image" loading="lazy">
      </div>` : ""}

    <div class="post-actions">
      <button class="pill-btn like ${liked ? "active" : ""}" data-like="${post.id}">
        ${liked ? "💚" : "🤍"} <span>${post.likes.length}</span>
      </button>
      <button class="pill-btn" data-toggle-comments="${post.id}">
        💬 <span>${post.comments.length}</span>
      </button>
      <button class="pill-btn bookmark ${bookmarked ? "active" : ""}" data-bookmark="${post.id}">
        ${bookmarked ? "🔖" : "📑"} <span>${bookmarked ? "Saved" : "Save"}</span>
      </button>
    </div>

    <div class="comments hidden" id="comments-${post.id}">
      ${post.comments.map(c => `
        <div class="comment" data-comment-id="${c.id}">
          ${renderAvatarEl(c.author, 32)}
          <div class="comment-bubble">
            <span class="cname">${escapeHtml(displayNameFor(c.author))}</span>
            <span class="ctext">${escapeHtml(c.content)}</span>
            ${c.edited ? `<span class="edited-tag"> · edited</span>` : ""}
          </div>
          ${c.author === state.currentUser ? `
            <div class="comment-btns">
              <button class="comment-edit-btn" title="Edit comment" data-edit-comment="${post.id}:${c.id}">✏️</button>
              <button class="comment-del" title="Delete comment" data-delete-comment="${post.id}:${c.id}">×</button>
            </div>` : ""}
        </div>
      `).join("")}
      <form class="comment-form" data-comment-form="${post.id}">
        <input type="text" placeholder="Write a comment..." maxlength="200" required>
        <button type="submit" class="btn btn-ghost btn-sm">Reply</button>
      </form>
    </div>
  </article>`;
}

/* Re-render whichever list is currently visible after a post mutation */
function refreshCurrentPostList(){
  if (state.view === "feed") renderFeed();
  else if (state.view === "profile") renderProfile(state.profileTarget);
  else if (state.view === "bookmarks") renderBookmarks();
  else if (state.view === "search") renderSearch();
}

/* ---------------- event delegation: clicks ---------------- */
document.addEventListener("click", (e) => {

  const likeBtn = e.target.closest("[data-like]");
  if (likeBtn){ toggleLike(likeBtn.dataset.like); return; }

  const bmBtn = e.target.closest("[data-bookmark]");
  if (bmBtn){ toggleBookmark(bmBtn.dataset.bookmark); return; }

  const toggleBtn = e.target.closest("[data-toggle-comments]");
  if (toggleBtn){
    document.getElementById("comments-" + toggleBtn.dataset.toggleComments).classList.toggle("hidden");
    return;
  }

  const gotoBtn = e.target.closest("[data-goto-profile]");
  if (gotoBtn){ navigate("profile", gotoBtn.dataset.gotoProfile); return; }

  const chatBtn = e.target.closest("[data-goto-chat]");
  if (chatBtn){ navigate("messages", chatBtn.dataset.gotoChat); return; }

  const backToListBtn = e.target.closest("[data-nav-messages-list]");
  if (backToListBtn){ navigate("messages"); return; }

  const tagBtn = e.target.closest("[data-tag]");
  if (tagBtn){ navigate("search", "#" + tagBtn.dataset.tag); return; }

  const followBtn = e.target.closest("[data-follow]");
  if (followBtn){ toggleFollow(followBtn.dataset.follow); return; }

  const menuToggle = e.target.closest("[data-post-menu-toggle]");
  if (menuToggle){
    const id = menuToggle.dataset.postMenuToggle;
    state.openPostMenu = (state.openPostMenu === id) ? null : id;
    refreshCurrentPostList();
    return;
  }

  const editBtn = e.target.closest("[data-edit-post]");
  if (editBtn){ startEditPost(editBtn.dataset.editPost); return; }

  const delPostBtn = e.target.closest("[data-delete-post]");
  if (delPostBtn){ deletePost(delPostBtn.dataset.deletePost); return; }

  const delCommentBtn = e.target.closest("[data-delete-comment]");
  if (delCommentBtn){
    const [postId, commentId] = delCommentBtn.dataset.deleteComment.split(":");
    deleteComment(postId, commentId);
    return;
  }

  const editCommentBtn = e.target.closest("[data-edit-comment]");
  if (editCommentBtn){
    const [postId, commentId] = editCommentBtn.dataset.editComment.split(":");
    startEditComment(postId, commentId);
    return;
  }

  const saveCommentBtn = e.target.closest("[data-save-comment]");
  if (saveCommentBtn){
    const [postId, commentId] = saveCommentBtn.dataset.saveComment.split(":");
    saveEditedComment(postId, commentId);
    return;
  }

  const cancelCommentBtn = e.target.closest("[data-cancel-comment-edit]");
  if (cancelCommentBtn){
    const postId = cancelCommentBtn.dataset.cancelCommentEdit;
    refreshCurrentPostList();
    const box = document.getElementById("comments-" + postId);
    if (box) box.classList.remove("hidden");
    return;
  }

  const pinBtn = e.target.closest("[data-pin-post]");
  if (pinBtn){ togglePin(pinBtn.dataset.pinPost); return; }

  // click-away closes any open post ⋯ menu
  if (!e.target.closest(".post-menu-wrap") && state.openPostMenu){
    state.openPostMenu = null;
    refreshCurrentPostList();
  }
});

/* ---------------- event delegation: comment submit ---------------- */
document.addEventListener("submit", (e) => {
  const msgForm = e.target.closest("[data-message-form]");
  if (msgForm){
    e.preventDefault();
    const input = msgForm.querySelector("input");
    const text = input.value.trim();
    if (!text) return;
    const peer = msgForm.dataset.messageForm;
    sendMessage(peer, text);
    input.value = "";
    renderChat(peer);
    return;
  }

  const form = e.target.closest("[data-comment-form]");
  if (!form) return;
  e.preventDefault();
  const input = form.querySelector("input");
  const text = input.value.trim();
  if (!text) return;

  const postId = form.dataset.commentForm;
  const posts = Store.getPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return;

  post.comments.push({ id: uid(), author: state.currentUser, content: text, ts: Date.now() });
  Store.savePosts(posts);
  addNotification(post.author, { type:"comment", from: state.currentUser, postId });

  refreshCurrentPostList();
  const box = document.getElementById("comments-" + postId);
  if (box) box.classList.remove("hidden");
});

function toggleLike(postId){
  const posts = Store.getPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return;

  const idx = post.likes.indexOf(state.currentUser);
  const wasLiked = idx !== -1;
  if (!wasLiked) post.likes.push(state.currentUser);
  else post.likes.splice(idx, 1);
  Store.savePosts(posts);

  if (!wasLiked) addNotification(post.author, { type:"like", from: state.currentUser, postId });

  refreshCurrentPostList();

  requestAnimationFrame(() => {
    const fresh = document.querySelector(`[data-like="${postId}"]`);
    if (fresh && !wasLiked){
      fresh.classList.add("pulse");
      setTimeout(()=> fresh.classList.remove("pulse"), 350);
    }
  });
}

function toggleBookmark(postId){
  const users = Store.getUsers();
  const me = users[state.currentUser];
  if (!me) return;
  me.bookmarks = me.bookmarks || [];
  const idx = me.bookmarks.indexOf(postId);
  if (idx === -1) me.bookmarks.push(postId);
  else me.bookmarks.splice(idx, 1);
  Store.saveUsers(users);
  refreshCurrentPostList();
}

function startEditPost(postId){
  const posts = Store.getPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return;

  const bodyEl = document.querySelector(`[data-post-body="${postId}"]`);
  if (!bodyEl) return;

  state.openPostMenu = null;
  bodyEl.outerHTML = `
    <div class="post-edit-box" data-post-body="${postId}">
      <textarea maxlength="280" id="edit-input-${postId}">${escapeHtml(post.content)}</textarea>
      <div class="post-edit-actions">
        <button class="btn btn-accent btn-sm" data-save-edit="${postId}">Save</button>
        <button class="btn btn-ghost btn-sm" data-cancel-edit="${postId}">Cancel</button>
      </div>
    </div>`;
}

document.addEventListener("click", (e) => {
  const saveBtn = e.target.closest("[data-save-edit]");
  if (saveBtn){
    const postId = saveBtn.dataset.saveEdit;
    const textarea = document.getElementById("edit-input-" + postId);
    const newContent = textarea.value.trim();
    if (!newContent) return;

    const posts = Store.getPosts();
    const post = posts.find(p => p.id === postId);
    if (post){
      post.content = newContent;
      post.edited = true;
      Store.savePosts(posts);
    }
    refreshCurrentPostList();
    return;
  }
  const cancelBtn = e.target.closest("[data-cancel-edit]");
  if (cancelBtn){ refreshCurrentPostList(); return; }
});

function togglePin(postId){
  const users = Store.getUsers();
  const me = users[state.currentUser];
  if (!me) return;
  const post = Store.getPosts().find(p => p.id === postId);
  if (!post || post.author !== state.currentUser) return;

  me.pinnedPostId = (me.pinnedPostId === postId) ? null : postId;
  Store.saveUsers(users);
  state.openPostMenu = null;
  refreshCurrentPostList();
}

function deletePost(postId){
  if (!confirm("Delete this post? This can't be undone.")) return;
  let posts = Store.getPosts();
  posts = posts.filter(p => p.id !== postId);
  Store.savePosts(posts);

  // also remove it from everyone's bookmarks and unpin it if pinned
  const users = Store.getUsers();
  Object.values(users).forEach(u => {
    if (u.bookmarks) u.bookmarks = u.bookmarks.filter(id => id !== postId);
    if (u.pinnedPostId === postId) u.pinnedPostId = null;
  });
  Store.saveUsers(users);

  state.openPostMenu = null;
  refreshCurrentPostList();
}

function deleteComment(postId, commentId){
  const posts = Store.getPosts();
  const post = posts.find(p => p.id === postId);
  if (!post) return;
  post.comments = post.comments.filter(c => c.id !== commentId);
  Store.savePosts(posts);
  refreshCurrentPostList();
}

function startEditComment(postId, commentId){
  const posts = Store.getPosts();
  const post = posts.find(p => p.id === postId);
  const comment = post && post.comments.find(c => c.id === commentId);
  if (!comment) return;

  const row = document.querySelector(`.comment[data-comment-id="${commentId}"]`);
  if (!row) return;
  const bubble = row.querySelector(".comment-bubble");
  bubble.innerHTML = `
    <input type="text" class="comment-edit-input" id="edit-comment-${commentId}" value="${escapeHtml(comment.content)}" maxlength="200">
    <div class="comment-edit-actions">
      <button class="btn btn-accent btn-sm" data-save-comment="${postId}:${commentId}">Save</button>
      <button class="btn btn-ghost btn-sm" data-cancel-comment-edit="${postId}">Cancel</button>
    </div>`;
  document.getElementById(`edit-comment-${commentId}`).focus();
}

function saveEditedComment(postId, commentId){
  const input = document.getElementById("edit-comment-" + commentId);
  const newText = input ? input.value.trim() : "";
  if (!newText) return;

  const posts = Store.getPosts();
  const post = posts.find(p => p.id === postId);
  const comment = post && post.comments.find(c => c.id === commentId);
  if (comment){
    comment.content = newText;
    comment.edited = true;
    Store.savePosts(posts);
  }
  refreshCurrentPostList();
  const box = document.getElementById("comments-" + postId);
  if (box) box.classList.remove("hidden");
}

/* ================================================================
   9. DIRECT MESSAGES — 1-on-1 private conversations
   ================================================================ */
function convKey(a, b){ return [a, b].sort().join("|"); }

function getConversation(peer){
  const all = Store.getMessages();
  return all[convKey(state.currentUser, peer)] || [];
}

function sendMessage(peer, text){
  const all = Store.getMessages();
  const key = convKey(state.currentUser, peer);
  if (!all[key]) all[key] = [];
  all[key].push({ id: uid(), from: state.currentUser, text, ts: Date.now() });
  Store.saveMessages(all);
  addNotification(peer, { type: "message", from: state.currentUser });
}

function renderMessagesView(){
  if (state.msgView === "chat" && state.msgPeer) renderChat(state.msgPeer);
  else renderMessagesList();
}

function renderMessagesList(){
  const users = Store.getUsers();
  const me = users[state.currentUser];
  const all = Store.getMessages();

  // Anyone you follow, plus anyone you already have a thread with
  const partners = new Set(me.following || []);
  Object.keys(all).forEach(key => {
    const [a, b] = key.split("|");
    if (a === state.currentUser) partners.add(b);
    if (b === state.currentUser) partners.add(a);
  });
  partners.delete(state.currentUser);

  const body = document.getElementById("messages-body");
  if (partners.size === 0){
    body.innerHTML = `<div class="empty-state"><strong>No conversations yet</strong>Follow someone from the People tab, then say hello.</div>`;
    return;
  }

  const rows = Array.from(partners).map(peer => {
    const conv = all[convKey(state.currentUser, peer)] || [];
    const last = conv[conv.length - 1];
    const unread = conv.filter(m => m.from === peer && m.ts > ((me.lastRead || {})[peer] || 0)).length;
    return { peer, last, unread, sortTs: last ? last.ts : 0 };
  }).sort((a, b) => b.sortTs - a.sortTs);

  body.innerHTML = rows.map(r => `
    <div class="contact-row" data-goto-chat="${escapeHtml(r.peer)}">
      ${renderAvatarEl(r.peer, 40)}
      <div class="who">
        <div class="cname-row"><strong>${escapeHtml(displayNameFor(r.peer))}</strong>${r.unread ? `<span class="msg-dot"></span>` : ""}</div>
        <div class="sub">${r.last ? escapeHtml(r.last.text) : "Say hello 👋"}</div>
      </div>
      <div class="mtime">${r.last ? timeAgo(r.last.ts) : ""}</div>
    </div>
  `).join("");
}

function renderChat(peer){
  const users = Store.getUsers();
  const me = users[state.currentUser];
  if (!users[peer]){
    document.getElementById("messages-body").innerHTML =
      `<div class="empty-state"><strong>User not found</strong>This account no longer exists.</div>`;
    return;
  }

  me.lastRead = me.lastRead || {};
  me.lastRead[peer] = Date.now();
  Store.saveUsers(users);
  updateMessagesBadge();

  const conv = getConversation(peer);
  const body = document.getElementById("messages-body");
  body.innerHTML = `
    <div class="chat-header">
      <button class="btn-icon" data-nav-messages-list title="Back">←</button>
      ${renderAvatarEl(peer, 40)}
      <div>
        <strong>${escapeHtml(displayNameFor(peer))}</strong>
        <div class="uname-sub">@${escapeHtml(peer)}</div>
      </div>
    </div>
    <div class="msg-thread" id="msg-thread">
      ${conv.length === 0
        ? `<div class="empty-state"><strong>Say hello</strong>Start the conversation with ${escapeHtml(displayNameFor(peer))}.</div>`
        : conv.map(m => `
            <div class="msg-row ${m.from === state.currentUser ? "mine" : "theirs"}">
              <div class="msg-bubble">${escapeHtml(m.text)}</div>
              <div class="msg-time">${timeAgo(m.ts)}</div>
            </div>
          `).join("")}
    </div>
    <form class="msg-input-row" data-message-form="${escapeHtml(peer)}" style="display:flex; gap:9px;">
      <input type="text" placeholder="Message @${escapeHtml(peer)}..." maxlength="500" required
             style="flex:1; border:1px solid var(--border); border-radius:999px; padding:9px 15px; font-size:13.5px; font-family:inherit; background:var(--surface-2); color:var(--ink);">
      <button type="submit" class="btn btn-accent btn-sm">Send</button>
    </form>
  `;
  const thread = document.getElementById("msg-thread");
  thread.scrollTop = thread.scrollHeight;
}

function updateMessagesBadge(){
  const users = Store.getUsers();
  const me = users[state.currentUser];
  if (!me) return;
  const all = Store.getMessages();
  let unread = 0;
  Object.keys(all).forEach(key => {
    const [a, b] = key.split("|");
    if (a !== state.currentUser && b !== state.currentUser) return;
    const peer = a === state.currentUser ? b : a;
    const lastRead = (me.lastRead || {})[peer] || 0;
    unread += all[key].filter(m => m.from === peer && m.ts > lastRead).length;
  });

  const navBtn = document.querySelector('.nav-item[data-nav="messages"]');
  if (!navBtn) return;
  let badge = navBtn.querySelector(".nav-badge");
  if (unread > 0){
    if (!badge){ badge = document.createElement("span"); badge.className = "nav-badge"; navBtn.appendChild(badge); }
    badge.textContent = unread > 9 ? "9+" : String(unread);
  } else if (badge){
    badge.remove();
  }
}

/* ================================================================
   10. SEARCH — people, posts, and hashtags
   ================================================================ */
function renderTrendingTags(){
  const counts = {};
  Store.getPosts().forEach(p => extractTags(p.content).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
  const top = Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 6);

  if (top.length === 0){
    return `<div class="empty-state" style="padding:24px 20px; margin-bottom:16px;">No hashtags yet — be the first to use one in a post.</div>`;
  }
  return `<div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px;">
    ${top.map(([tag, count]) => `
      <button type="button" class="pill-btn" data-tag="${escapeHtml(tag)}" style="cursor:pointer;">
        #${escapeHtml(tag)} <span style="color:var(--faint); font-weight:400;">· ${count}</span>
      </button>
    `).join("")}
  </div>`;
}

const searchInput = document.getElementById("search-input");
searchInput.addEventListener("input", () => {
  state.searchQuery = searchInput.value;
  renderSearchResultsOnly();
});

function renderSearch(){
  searchInput.value = state.searchQuery || "";
  renderSearchResultsOnly();
  if (state.searchQuery) requestAnimationFrame(() => searchInput.focus());
}

function renderSearchResultsOnly(){
  const raw = (state.searchQuery || "").trim();
  const results = document.getElementById("search-results");

  if (!raw){
    results.innerHTML = `<div class="section-label">Trending hashtags</div>` + renderTrendingTags() +
      `<div class="empty-state"><strong>Search Pulse</strong>Look up a username, a word in a post, or a #hashtag.</div>`;
    return;
  }

  const q = raw.toLowerCase().replace(/^#/, "");
  const isTagSearch = raw.trim().startsWith("#");
  const users = Store.getUsers();
  const posts = Store.getPosts();

  const matchedUsers = Object.values(users).filter(u =>
    !isTagSearch && u.username !== state.currentUser &&
    (u.username.toLowerCase().includes(q) || (u.displayName||"").toLowerCase().includes(q))
  );

  const matchedPosts = posts.filter(p => {
    if (isTagSearch) return extractTags(p.content).includes(q);
    return p.content.toLowerCase().includes(q);
  }).sort((a,b)=>b.ts-a.ts);

  let html = "";
  if (matchedUsers.length){
    html += `<div class="section-label">People</div>` + matchedUsers.map(u => renderPersonRow(u)).join("");
  }
  html += `<div class="section-label">Posts</div>`;
  html += matchedPosts.length
    ? matchedPosts.map(p => renderPostCard(p)).join("")
    : `<div class="empty-state"><strong>No matches</strong>Try a different word or username.</div>`;

  results.innerHTML = html;
}

/* ================================================================
   10. BOOKMARKS
   ================================================================ */
function renderBookmarks(){
  const users = Store.getUsers();
  const me = users[state.currentUser] || { bookmarks: [] };
  const ids = me.bookmarks || [];
  const posts = Store.getPosts().filter(p => ids.includes(p.id)).sort((a,b)=>b.ts-a.ts);
  const list = document.getElementById("bookmarks-list");

  if (posts.length === 0){
    list.innerHTML = `<div class="empty-state"><strong>No bookmarks yet</strong>Tap "Save" on any post to keep it here.</div>`;
    return;
  }
  list.innerHTML = posts.map(p => renderPostCard(p)).join("");
}

/* ================================================================
   11. PROFILE — own profile (editable) & other users' profiles
   ================================================================ */
function renderProfile(username){
  const users = Store.getUsers();
  const user = users[username];
  const isOwn = username === state.currentUser;

  document.getElementById("profile-topbar-title").textContent = isOwn ? "My Profile" : `@${username}`;

  if (!user){
    document.getElementById("profile-content").innerHTML =
      `<div class="empty-state"><strong>User not found</strong>This account no longer exists.</div>`;
    return;
  }

  const isFollowing = user.followers.includes(state.currentUser);
  let userPosts = Store.getPosts().filter(p => p.author === username).sort((a,b)=>b.ts-a.ts);
  if (user.pinnedPostId){
    const pinned = userPosts.find(p => p.id === user.pinnedPostId);
    if (pinned) userPosts = [pinned, ...userPosts.filter(p => p.id !== user.pinnedPostId)];
  }

  document.getElementById("profile-content").innerHTML = `
    <div class="profile-card">
      <div class="profile-top">
        ${renderAvatarEl(username, 64)}
        ${isOwn ? "" : `
          <div class="profile-actions">
            <button class="btn ${isFollowing ? "btn-ghost" : "btn-accent"} btn-sm" data-follow="${escapeHtml(username)}">
              ${isFollowing ? "Following ✓" : "Follow"}
            </button>
            <button class="btn btn-ghost btn-sm" data-goto-chat="${escapeHtml(username)}">✉️ Message</button>
          </div>
        `}
      </div>
      <div class="profile-name">
        <h1>${escapeHtml(user.displayName || username)}</h1>
        <div class="uname">@${escapeHtml(username)}</div>
      </div>

      ${isOwn ? `
        <div class="profile-bio">
          <textarea id="bio-editor" maxlength="120">${escapeHtml(user.bio)}</textarea>
          <div style="margin-top:8px;">
            <button class="btn btn-primary btn-sm" id="save-bio-btn" style="width:auto;">Save bio</button>
          </div>
        </div>
      ` : `
        <div class="profile-bio">${escapeHtml(user.bio)}</div>
      `}

      <div class="profile-stats">
        <div><strong>${user.followers.length}</strong>Followers</div>
        <div><strong>${user.following.length}</strong>Following</div>
        <div><strong>${userPosts.length}</strong>Posts</div>
      </div>
    </div>

    <div id="profile-posts">
      ${userPosts.length === 0
        ? `<div class="empty-state"><strong>No posts yet</strong>${isOwn ? "Share your first post from the Feed tab." : "This user hasn't posted anything yet."}</div>`
        : userPosts.map(p => renderPostCard(p)).join("")}
    </div>
  `;

  if (isOwn){
    document.getElementById("save-bio-btn").addEventListener("click", () => {
      const newBio = document.getElementById("bio-editor").value.trim();
      const usersNow = Store.getUsers();
      usersNow[username].bio = newBio || "New to Pulse 👋";
      Store.saveUsers(usersNow);
      renderProfile(username);
    });
  }
}

function toggleFollow(targetUsername){
  if (targetUsername === state.currentUser) return;
  const users = Store.getUsers();
  const me = users[state.currentUser];
  const target = users[targetUsername];
  if (!me || !target) return;

  const followingIdx = me.following.indexOf(targetUsername);
  if (followingIdx === -1){
    me.following.push(targetUsername);
    target.followers.push(state.currentUser);
    Store.saveUsers(users);
    addNotification(targetUsername, { type:"follow", from: state.currentUser });
  } else {
    me.following.splice(followingIdx, 1);
    const followerIdx = target.followers.indexOf(state.currentUser);
    if (followerIdx !== -1) target.followers.splice(followerIdx, 1);
    Store.saveUsers(users);
  }

  if (state.view === "profile") renderProfile(state.profileTarget);
  if (state.view === "people") renderPeople();
  if (state.view === "search") renderSearchResultsOnly();
}

/* ================================================================
   12. PEOPLE — discover & follow other users
   ================================================================ */
function renderPersonRow(u){
  const isFollowing = u.followers.includes(state.currentUser);
  return `
    <div class="person-row">
      ${renderAvatarEl(u.username, 40)}
      <div class="who">
        <button class="author-link" data-goto-profile="${escapeHtml(u.username)}">${escapeHtml(u.displayName || u.username)}</button>
        <div class="sub">${escapeHtml(u.bio)} · ${u.followers.length} followers</div>
      </div>
      <button class="btn ${isFollowing ? "btn-ghost" : "btn-accent"} btn-sm" data-follow="${escapeHtml(u.username)}">
        ${isFollowing ? "Following ✓" : "Follow"}
      </button>
    </div>`;
}

function renderPeople(){
  const users = Store.getUsers();
  const others = Object.values(users).filter(u => u.username !== state.currentUser);
  const list = document.getElementById("people-list");

  if (others.length === 0){
    list.innerHTML = `<div class="empty-state"><strong>You're the only one here</strong>Invite friends to sign up and connect.</div>`;
    return;
  }
  list.innerHTML = others.map(u => renderPersonRow(u)).join("");
}

/* ================================================================
   13. SETTINGS — theme, accent color, display name, avatar emoji
   ================================================================ */
function renderSettings(){
  const users = Store.getUsers();
  const me = users[state.currentUser];
  const isDark = me.theme === "dark";

  document.getElementById("settings-content").innerHTML = `
    <div class="settings-card">
      <h3>Appearance</h3>
      <p class="desc">Switch between light and dark, and pick an accent colour for buttons, links, and highlights.</p>

      <div class="toggle-row" style="margin-bottom:18px;">
        <div>
          <strong style="font-size:14px;">Dark mode</strong>
          <div class="desc" style="margin:2px 0 0;">Easier on the eyes at night.</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="theme-toggle" ${isDark ? "checked" : ""}>
          <span class="track"></span>
        </label>
      </div>

      <strong style="font-size:14px; display:block; margin-bottom:8px;">Accent colour</strong>
      <div class="swatch-row">
        ${ACCENT_SWATCHES.map(s => `
          <button class="swatch ${me.accent === s.hex ? "selected" : ""}" style="background:${s.hex}" data-accent="${s.hex}" title="${s.name}"></button>
        `).join("")}
      </div>
    </div>

    <div class="settings-card">
      <h3>Profile details</h3>
      <p class="desc">How your name and avatar appear across Pulse.</p>

      <div class="field">
        <label for="settings-display">Display name</label>
        <input type="text" id="settings-display" maxlength="40" value="${escapeHtml(me.displayName || me.username)}">
      </div>

      <strong style="font-size:14px; display:block; margin:14px 0 4px;">Avatar</strong>
      <div class="desc" style="margin-bottom:0;">Pick an emoji, or leave blank to use your initials on a gradient tile.</div>
      <div class="emoji-picker-row">
        ${EMOJI_OPTIONS.map(em => `
          <button class="emoji-opt ${((me.avatarEmoji||"") === em) ? "selected" : ""}" data-emoji="${em}">
            ${em ? em : "🚫"}
          </button>
        `).join("")}
      </div>

      <div style="margin-top:16px;">
        <button class="btn btn-primary" id="settings-save" style="width:auto;">Save changes</button>
      </div>
    </div>
  `;

  document.getElementById("theme-toggle").addEventListener("change", (e) => {
    const usersNow = Store.getUsers();
    usersNow[state.currentUser].theme = e.target.checked ? "dark" : "light";
    Store.saveUsers(usersNow);
    applyTheme(usersNow[state.currentUser].theme, usersNow[state.currentUser].accent);
  });

  document.querySelectorAll(".swatch").forEach(sw => {
    sw.addEventListener("click", () => {
      const usersNow = Store.getUsers();
      usersNow[state.currentUser].accent = sw.dataset.accent;
      Store.saveUsers(usersNow);
      applyTheme(usersNow[state.currentUser].theme, sw.dataset.accent);
      renderSettings();
    });
  });

  document.querySelectorAll(".emoji-opt").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".emoji-opt").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      btn.dataset.picked = "1";
    });
  });

  document.getElementById("settings-save").addEventListener("click", () => {
    const usersNow = Store.getUsers();
    const meNow = usersNow[state.currentUser];
    meNow.displayName = document.getElementById("settings-display").value.trim() || state.currentUser;

    const pickedEmoji = document.querySelector(".emoji-opt.selected");
    if (pickedEmoji) meNow.avatarEmoji = pickedEmoji.dataset.emoji;

    Store.saveUsers(usersNow);

    // refresh anything on screen that shows identity
    document.getElementById("sidebar-username").textContent = meNow.displayName;
    document.getElementById("sidebar-avatar").outerHTML = renderAvatarEl(state.currentUser, 32, "sidebar-avatar");
    document.getElementById("composer-avatar").outerHTML = renderAvatarEl(state.currentUser, 40, "composer-avatar");
    renderSettings();
  });
}

/* ================================================================
   14. INIT — restore session on page load
   ================================================================ */
(function init(){
  seedDemoDataIfEmpty();
  const session = Store.getSession();
  if (session){
    const users = Store.getUsers();
    if (users[session]){
      enterApp(session);
      return;
    }
    Store.clearSession();
  }
  applyTheme("light", "#5B3DF5");
  document.getElementById("auth-username").focus();
})();