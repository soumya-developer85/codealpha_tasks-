Pulse — A Tiny, Modern Social Feed ⚡

Pulse is a lightweight, fully-featured social media web application built with vanilla web technologies. It provides a real-time feeling community platform where users can post updates, interact with rich media tags, follow peers, message each other directly, and customize their viewing experience with dark mode and dynamic color accents—all without requiring a backend server.

✨ Features

Authentication & Profiles: Quick session initialization by username, custom display names, bios, and automatically generated dynamic avatar color gradients.

Rich Interactive Feed:

Create posts with character counts and live length warnings.

Hashtag Parsing: Clickable hashtags (#) that instantly filter global search results.

Image Embedding: Automatically transforms direct image links into embedded previews.

Edit & Delete: Full CRUD capabilities for managing your own posts and comments.

Engagement System:

Like and unlike posts with real-time count updates.

Bookmark posts for reading later in dedicated views.

Nested comment threads on posts.

Direct Messaging: 1-on-1 private messaging chat interface with followed users or community members.

Notifications Panel: Real-time bell notifications tracking likes, comments, and new followers.

Search Engine: Comprehensive search querying for users, posts, and tags.

Customization & Themes:

Toggle between Light and Dark mode.

Choose from 5 signature accent color themes (Violet, Mint, Coral, Blue, Rose) stored in local persistence.

🛠️ Tech Stack

HTML5 (Semantic layout and structure)

CSS3 / Custom Properties (Design tokens, responsive flexbox/grid layout, CSS variables for theming)

Vanilla JavaScript (ES6+) (State management, reactive rendering loops, event delegation)

Browser LocalStorage API (Persistence layer for users, posts, messages, and notifications)

🚀 Getting Started

Because Pulse is built entirely with vanilla web standards and stores its data in the browser's localStorage, you don't need Node.js, databases, or complex build tooling to run it.

Prerequisites

Any modern web browser (Google Chrome, Mozilla Firefox, Safari, Microsoft Edge).

Installation & Running Locally

Clone or download this repository to your local machine.

Locate the index.html file in your project directory.

Simply double-click index.html to open it directly in your web browser, or serve it using a local development server (such as Live Server in VS Code):

# Optional: Using Python to spin up a quick local server
python3 -m http.server 8000


Enter any username on the welcome screen to jump in! (Demo accounts like ada and grace are automatically seeded with sample posts if storage is empty).

📱 Responsive Design

Pulse is fully responsive with a layout that adapts dynamically:

Desktop: Sidebar navigation layout with a focused central timeline column.

Mobile: Bottom navigation bar layout optimized for touch interactions and smaller screens.