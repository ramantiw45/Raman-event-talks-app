# BigQuery Release Notes Explorer & Tweeter

A sleek, glassmorphic web application built with **Python Flask** and **Vanilla CSS, HTML, and JS** to fetch, browse, filter, and share Google Cloud BigQuery release updates directly to Twitter/X.

## 🚀 Features

- **Automated RSS parsing**: Fetches and parses the official BigQuery release notes XML feed in real-time.
- **Granular update selection**: Separates daily updates (by `<h3>` tags) into distinct cards so you can select and share specific updates instead of a whole day's entries.
- **Glassmorphic UI**: Beautiful dark theme with colored glow accents, interactive badges, transitions, and loading skeletons.
- **Client-Side Search & Filter**: Fast search and type filters (`Feature`, `Change`, `Deprecated`, and `Other`).
- **Interactive Tweet Composer**: Automatically drafts your update tweet with safety character counts, hashtag recommendations, and a live Twitter visual card preview.
- **One-click Sharing**: Directly drafts on Twitter/X via Twitter Web Intent.

---

## 📁 File Structure

```
cli-project/
├── app.py              # Flask server and feed parser
├── templates/
│   └── index.html      # HTML shell and UI layout
├── static/
│   ├── css/
│   │   └── style.css   # Theme, styles, animations & glassmorphism FX
│   └── js/
│       └── app.js      # Client controller: DOM manipulation, parsing, filtering
├── .gitignore          # Excludes environment and cache files
└── README.md           # This project guide
```

---

## 🛠️ Setup & Running

### Prerequisites
- Python 3.8 or above installed.

### 1. Clone & Navigate
Navigate to the directory containing the project:
```bash
cd cli-project
```

### 2. Install Dependencies
Install Flask and requests dependencies via pip:
```bash
pip install flask requests
```

### 3. Start the Application
Run the Flask server:
```bash
python app.py
```

Open your browser and navigate to **`http://127.0.0.1:5000`**.

---

## 💡 How It Works

1. **API Requests**: Clicking **Refresh Feed** makes a fetch request to `/api/release-notes` on the Flask server.
2. **Server Parsing**: The backend fetches the Atom feed and uses Python's standard `xml.etree.ElementTree` to parse the structure.
3. **Client Sorting**: The browser parses raw HTML strings from the server, dividing entries by `<h3>` headings using a `DOMParser` to extract separate updates.
4. **Draft Composition**: Selecting an update automatically drafts a status template configured to safely fit Twitter's **280 character limit**:
   ```
   BigQuery [Type]: [Snippet Text...] #BigQuery #GoogleCloud Release details: [Link]
   ```
5. **Publishing**: Clicking **Share on X** triggers a secure popup containing Twitter's Web Intent helper (`https://twitter.com/intent/tweet?text=...`) to finalize and publish the post on your account.
