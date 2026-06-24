// Application State
let allUpdates = []; // Flat list of all updates parsed from entries
let selectedUpdateId = null;
let currentTemplateStyle = 'detailed'; // Choose: detailed, punchy, hype

// DOM Elements
const feedContainer = document.getElementById('feed-container');
const btnRefresh = document.getElementById('btn-refresh');
const refreshIcon = btnRefresh.querySelector('.btn-icon i');
const searchInput = document.getElementById('search-input');
const filterBadges = document.querySelectorAll('.filter-badge');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCounter = document.getElementById('char-counter');
const btnTweet = document.getElementById('btn-tweet');
const tweetPreviewText = document.getElementById('tweet-preview-text');
const composerContext = document.getElementById('composer-selection-context');
const contextDetails = composerContext.querySelector('.context-details');
const contextPlaceholder = composerContext.querySelector('.context-placeholder');
const contextTypeBadge = composerContext.querySelector('.context-type-badge');
const contextDate = composerContext.querySelector('.context-date');
const contextTextPreview = composerContext.querySelector('.context-text-preview');
const tagButtons = document.querySelectorAll('.tag-btn');
const toast = document.getElementById('toast');
const themeToggle = document.getElementById('theme-toggle');
const searchClear = document.getElementById('search-clear');
const fetchTime = document.getElementById('fetch-time');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    fetchReleaseNotes();
    setupEventListeners();
});

// Load theme from localStorage
function initTheme() {
    const currentTheme = localStorage.getItem('theme') || 'dark';
    if (currentTheme === 'light') {
        document.body.classList.add('light-theme');
        if (themeToggle) {
            themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
        }
    } else {
        document.body.classList.remove('light-theme');
        if (themeToggle) {
            themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }
    }
}

// Event Listeners setup
function setupEventListeners() {
    // Refresh button
    btnRefresh.addEventListener('click', () => {
        fetchReleaseNotes();
    });

    // Search input
    searchInput.addEventListener('input', () => {
        if (searchInput.value.trim() !== '') {
            searchClear.classList.remove('hidden');
        } else {
            searchClear.classList.add('hidden');
        }
        filterAndRenderFeed();
    });

    // Clear search button
    if (searchClear) {
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchClear.classList.add('hidden');
            filterAndRenderFeed();
            searchInput.focus();
        });
    }

    // Esc key to clear search
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            if (searchClear) searchClear.classList.add('hidden');
            filterAndRenderFeed();
            searchInput.blur();
        }
    });

    // Ctrl + Enter inside tweet textarea to publish
    tweetTextarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            btnTweet.click();
        }
    });

    // Filter badges
    filterBadges.forEach(badge => {
        badge.addEventListener('click', (e) => {
            filterBadges.forEach(b => b.classList.remove('active'));
            badge.classList.add('active');
            filterAndRenderFeed();
        });
    });

    // Tweet textarea typing
    tweetTextarea.addEventListener('input', updateTweetPreview);

    // Hashtag quick-add buttons
    tagButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const hashtag = btn.dataset.tag;
            const currentText = tweetTextarea.value;
            
            // Add hashtag with spacing
            if (currentText.trim() === '') {
                tweetTextarea.value = hashtag;
            } else if (currentText.endsWith(' ') || currentText.endsWith('\n')) {
                tweetTextarea.value += hashtag;
            } else {
                tweetTextarea.value += ' ' + hashtag;
            }
            
            updateTweetPreview();
            tweetTextarea.focus();
        });
    });

    // Share button
    btnTweet.addEventListener('click', () => {
        const text = tweetTextarea.value.trim();
        if (text) {
            const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
            window.open(twitterUrl, '_blank', 'width=550,height=420');
            showToast('Opening Twitter/X compose window...');
        }
    });

    // Export CSV button
    const btnExport = document.getElementById('btn-export');
    if (btnExport) {
        btnExport.addEventListener('click', exportFilteredToCSV);
    }

    // Theme toggle button
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const isLight = document.body.classList.toggle('light-theme');
            if (isLight) {
                localStorage.setItem('theme', 'light');
                themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
                showToast('Switched to Light Mode');
            } else {
                localStorage.setItem('theme', 'dark');
                themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
                showToast('Switched to Dark Mode');
            }
        });
    }

    // Tweet templates
    const templateBadges = document.querySelectorAll('.template-badge');
    templateBadges.forEach(badge => {
        badge.addEventListener('click', () => {
            templateBadges.forEach(b => b.classList.remove('active'));
            badge.classList.add('active');
            currentTemplateStyle = badge.dataset.style;
            if (selectedUpdateId) {
                selectUpdateForTweet(selectedUpdateId);
            }
        });
    });
}

// Fetch release notes from backend Flask API
async function fetchReleaseNotes() {
    toggleRefreshLoading(true);
    showSkeletonLoaders();
    
    try {
        const response = await fetch('/api/release-notes');
        if (!response.ok) throw new Error('Failed to fetch release notes feed');
        const data = await response.json();
        
        // Parse raw feed entries into flat updates
        allUpdates = parseFeedEntries(data.entries);
        
        filterAndRenderFeed();
        showToast('Successfully updated feed!');

        // Update fetch timestamp label
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (fetchTime) {
            fetchTime.innerText = `Updated: ${timeStr}`;
        }
    } catch (error) {
        console.error(error);
        showToast(error.message, true);
        feedContainer.innerHTML = `
            <div class="glass-card" style="padding: 2rem; text-align: center; color: var(--text-secondary);">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; color: var(--color-deprecated); margin-bottom: 1rem;"></i>
                <p>Failed to load release notes. Please check feed connection and try again.</p>
            </div>
        `;
    } finally {
        toggleRefreshLoading(false);
    }
}

// Parse entries to separate individual updates
function parseFeedEntries(entries) {
    const parsed = [];
    const parser = new DOMParser();

    entries.forEach((entry, entryIndex) => {
        const dateStr = entry.title; // e.g. "June 23, 2026"
        const doc = parser.parseFromString(entry.content, 'text/html');
        
        // Find all headings to divide content.
        // Google feeds usually use <h3> tags to separate features, changes, etc.
        const headings = doc.querySelectorAll('h3');
        
        if (headings.length === 0) {
            // If no h3 found, treat entire content as one "Other" update
            const plainText = doc.body.textContent || "";
            parsed.push({
                id: `${entryIndex}-single`,
                date: dateStr,
                type: 'Other',
                rawHtml: entry.content,
                plainText: plainText.trim(),
                link: entry.link
            });
        } else {
            headings.forEach((heading, headingIndex) => {
                const typeText = heading.textContent.trim();
                
                // Get all siblings until the next h3 heading
                let sibling = heading.nextElementSibling;
                let subHtml = '';
                let plainText = '';
                
                while (sibling && sibling.tagName !== 'H3') {
                    subHtml += sibling.outerHTML;
                    plainText += sibling.textContent + ' ';
                    sibling = sibling.nextElementSibling;
                }
                
                parsed.push({
                    id: `${entryIndex}-${headingIndex}`,
                    date: dateStr,
                    type: typeText,
                    rawHtml: subHtml,
                    plainText: plainText.trim(),
                    link: entry.link
                });
            });
        }
    });
    
    return parsed;
}

// Filter and Render the Updates Feed
function filterAndRenderFeed() {
    const searchQuery = searchInput.value.toLowerCase().trim();
    const activeBadge = document.querySelector('.filter-badge.active');
    const filterType = activeBadge ? activeBadge.dataset.type : 'all';
    
    const filtered = allUpdates.filter(update => {
        // Search filter
        const matchesSearch = searchQuery === '' || 
            update.plainText.toLowerCase().includes(searchQuery) ||
            update.type.toLowerCase().includes(searchQuery) ||
            update.date.toLowerCase().includes(searchQuery);
            
        // Type filter
        let matchesType = true;
        if (filterType !== 'all') {
            const uType = update.type.toLowerCase();
            if (filterType === 'other') {
                matchesType = !['feature', 'change', 'deprecated'].includes(uType);
            } else {
                matchesType = uType === filterType;
            }
        }
        
        return matchesSearch && matchesType;
    });

    renderFeed(filtered);
}

// Helper to determine color variables for update types
function getTypeColor(type) {
    const typeLower = type.toLowerCase();
    if (typeLower === 'feature') return { hex: 'var(--color-feature)', rgb: '16, 185, 129' };
    if (typeLower === 'change') return { hex: 'var(--color-change)', rgb: '245, 158, 11' };
    if (typeLower === 'deprecated') return { hex: 'var(--color-deprecated)', rgb: '239, 68, 110' };
    return { hex: 'var(--color-other)', rgb: '139, 92, 246' };
}

// Render list of updates
function renderFeed(updates) {
    if (updates.length === 0) {
        feedContainer.innerHTML = `
            <div class="glass-card" style="padding: 3rem; text-align: center; color: var(--text-secondary);">
                <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p>No release updates matches your search or filters.</p>
            </div>
        `;
        return;
    }

    // Group updates by date
    const groups = {};
    updates.forEach(u => {
        if (!groups[u.date]) {
            groups[u.date] = [];
        }
        groups[u.date].push(u);
    });

    let html = '';
    
    // Sort dates or process in order of receipt (since RSS feeds are ordered chronologically descending already)
    const dates = Object.keys(groups);
    const searchQuery = searchInput.value.toLowerCase().trim();
    
    dates.forEach(date => {
        html += `
            <div class="date-group">
                <div class="date-header">${date}</div>
        `;
        
        groups[date].forEach(update => {
            const colors = getTypeColor(update.type);
            const isSelected = selectedUpdateId === update.id;
            
            // Highlight text if query is active
            const displayHtml = highlightHTML(update.rawHtml, searchQuery);
            
            html += `
                <div class="update-card glass-card" style="--type-color: ${colors.hex}; --type-color-rgb: ${colors.rgb}" id="card-${update.id}">
                    <div class="card-top">
                        <div class="badge-wrapper">
                            <span class="type-badge">${update.type}</span>
                        </div>
                        <span class="card-date">${update.date}</span>
                    </div>
                    <div class="update-content">
                        ${displayHtml}
                    </div>
                    <div class="card-actions" style="gap: 0.5rem;">
                        <button class="btn btn-secondary" onclick="copyUpdateText('${update.id}', this)" title="Copy description to clipboard" style="padding: 0.4rem 0.75rem; font-size: 0.85rem;">
                            <i class="fa-solid fa-copy"></i> Copy
                        </button>
                        <button class="btn btn-select-update ${isSelected ? 'selected' : ''}" onclick="selectUpdateForTweet('${update.id}')">
                            <i class="fa-solid ${isSelected ? 'fa-check' : 'fa-plus'}"></i> 
                            ${isSelected ? 'Selected' : 'Select to Tweet'}
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
    });
    
    feedContainer.innerHTML = html;
}

// Select an update to compose a tweet
window.selectUpdateForTweet = function(id) {
    const update = allUpdates.find(u => u.id === id);
    if (!update) return;
    
    // Toggle/Set active select
    selectedUpdateId = id;
    
    // Toggle class on buttons
    document.querySelectorAll('.btn-select-update').forEach(btn => {
        btn.classList.remove('selected');
        btn.innerHTML = `<i class="fa-solid fa-plus"></i> Select to Tweet`;
    });
    
    const cardEl = document.getElementById(`card-${id}`);
    if (cardEl) {
        const selectBtn = cardEl.querySelector('.btn-select-update');
        if (selectBtn) {
            selectBtn.classList.add('selected');
            selectBtn.innerHTML = `<i class="fa-solid fa-check"></i> Selected`;
        }
    }
    
    // Update Context composer UI
    contextPlaceholder.classList.add('hidden');
    contextDetails.classList.remove('hidden');
    composerContext.classList.remove('empty');
    
    contextTypeBadge.innerText = update.type;
    // Set custom text color for type badge
    const colors = getTypeColor(update.type);
    contextTypeBadge.style.color = colors.hex;
    contextDate.innerText = update.date;
    contextTextPreview.innerText = update.plainText;
    
    // Auto Draft Tweet body depending on currentTemplateStyle
    let tweetDraft = '';
    
    if (currentTemplateStyle === 'punchy') {
        const prefix = `⚡ New BigQuery ${update.type}! `;
        const link = `\nDetails: ${update.link}`;
        const tags = ` #GCP`;
        
        // Take the first sentence
        const firstSentence = update.plainText.split(/[.!?]/)[0] + '.';
        const maxSnippetLen = 280 - prefix.length - link.length - tags.length - 5;
        let snippet = firstSentence;
        if (snippet.length > maxSnippetLen) {
            snippet = snippet.substring(0, maxSnippetLen).trim() + '...';
        }
        tweetDraft = `${prefix}${snippet}${tags}${link}`;
    } else if (currentTemplateStyle === 'hype') {
        const prefix = `🚀 BIGQUERY UPDATE: `;
        const link = `\n👉 Read more: ${update.link}`;
        const tags = ` #BigQuery #GoogleCloud #DataEngineering`;
        
        const maxSnippetLen = 280 - prefix.length - link.length - tags.length - 5;
        let snippet = update.plainText;
        if (snippet.length > maxSnippetLen) {
            snippet = snippet.substring(0, maxSnippetLen).trim() + '...';
        }
        tweetDraft = `${prefix}${snippet}${tags}${link}`;
    } else {
        // Detailed (default)
        const prefix = `BigQuery ${update.type}: `;
        const link = `\nRelease details: ${update.link}`;
        const tags = ` #BigQuery #GoogleCloud`;
        
        const maxSnippetLen = 280 - prefix.length - link.length - tags.length - 5;
        let snippet = update.plainText;
        if (snippet.length > maxSnippetLen) {
            snippet = snippet.substring(0, maxSnippetLen).trim() + '...';
        }
        tweetDraft = `${prefix}${snippet}${tags}${link}`;
    }
    
    tweetTextarea.value = tweetDraft;
    updateTweetPreview();
    
    // Scroll composer into view on mobile
    if (window.innerWidth <= 1024) {
        document.querySelector('.sidebar-section').scrollIntoView({ behavior: 'smooth' });
    }
};

// Update Tweet character counter and X live preview
function updateTweetPreview() {
    const text = tweetTextarea.value;
    const count = text.length;
    
    // Handle counter display
    charCounter.innerText = `${count} / 280`;
    charCounter.classList.remove('warning', 'danger');
    
    if (count > 250 && count <= 280) {
        charCounter.classList.add('warning');
    } else if (count > 280) {
        charCounter.classList.add('danger');
    }
    
    // Handle preview box
    if (text.trim() === '') {
        tweetPreviewText.innerText = "Your tweet text will appear here...";
        tweetPreviewText.classList.add('empty-preview');
        btnTweet.disabled = true;
    } else {
        tweetPreviewText.innerText = text;
        tweetPreviewText.classList.remove('empty-preview');
        btnTweet.disabled = count > 280;
    }
}

// Toggle Refresh button animation
function toggleRefreshLoading(isLoading) {
    if (isLoading) {
        btnRefresh.disabled = true;
        refreshIcon.classList.add('spinning');
    } else {
        btnRefresh.disabled = false;
        refreshIcon.classList.remove('spinning');
    }
}

// Skeleton loaders
function showSkeletonLoaders() {
    feedContainer.innerHTML = `
        <div class="skeleton-card glass-card"></div>
        <div class="skeleton-card glass-card"></div>
        <div class="skeleton-card glass-card"></div>
    `;
}

// Toast Notifications
function showToast(message, isError = false) {
    toast.innerText = message;
    toast.classList.remove('hidden', 'error');
    if (isError) toast.classList.add('error');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

// Copy specific update details to clipboard
window.copyUpdateText = function(id, buttonEl) {
    const update = allUpdates.find(u => u.id === id);
    if (!update) return;
    
    const textToCopy = `[${update.date}] BigQuery ${update.type}:\n${update.plainText}\n\nRelease details: ${update.link}`;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        showToast('Copied to clipboard!');
        const originalHtml = buttonEl.innerHTML;
        buttonEl.innerHTML = `<i class="fa-solid fa-check" style="color: var(--color-feature)"></i> Copied`;
        setTimeout(() => {
            buttonEl.innerHTML = originalHtml;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        showToast('Failed to copy to clipboard', true);
    });
};

// Export currently filtered list to CSV
function exportFilteredToCSV() {
    const searchQuery = searchInput.value.toLowerCase().trim();
    const activeBadge = document.querySelector('.filter-badge.active');
    const filterType = activeBadge ? activeBadge.dataset.type : 'all';
    
    const filtered = allUpdates.filter(update => {
        const matchesSearch = searchQuery === '' || 
            update.plainText.toLowerCase().includes(searchQuery) ||
            update.type.toLowerCase().includes(searchQuery) ||
            update.date.toLowerCase().includes(searchQuery);
            
        let matchesType = true;
        if (filterType !== 'all') {
            const uType = update.type.toLowerCase();
            if (filterType === 'other') {
                matchesType = !['feature', 'change', 'deprecated'].includes(uType);
            } else {
                matchesType = uType === filterType;
            }
        }
        return matchesSearch && matchesType;
    });

    if (filtered.length === 0) {
        showToast('No updates to export', true);
        return;
    }

    const headers = ['Date', 'Type', 'Link', 'Description'];
    const csvRows = [headers.join(',')];

    filtered.forEach(update => {
        const cleanDesc = update.plainText
            .replace(/"/g, '""') // Escape double quotes
            .replace(/\n/g, ' ')  // Replace newlines with spaces
            .trim();
        
        const row = [
            `"${update.date}"`,
            `"${update.type}"`,
            `"${update.link}"`,
            `"${cleanDesc}"`
        ];
        csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bigquery_release_notes_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('CSV export downloaded!');
}

// Highlight matching search words in HTML content
function highlightHTML(html, query) {
    if (!query) return html;
    
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    const walk = document.createTreeWalker(temp, NodeFilter.SHOW_TEXT, null, false);
    let node;
    const nodesToReplace = [];
    
    while (node = walk.nextNode()) {
        const text = node.nodeValue;
        const index = text.toLowerCase().indexOf(query.toLowerCase());
        if (index >= 0) {
            nodesToReplace.push(node);
        }
    }
    
    nodesToReplace.forEach(node => {
        const parent = node.parentNode;
        const text = node.nodeValue;
        const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
        const newHtml = text.replace(regex, '<span class="highlight">$1</span>');
        const wrapper = document.createElement('span');
        wrapper.innerHTML = newHtml;
        
        while (wrapper.firstChild) {
            parent.insertBefore(wrapper.firstChild, node);
        }
        parent.removeChild(node);
    });
    
    return temp.innerHTML;
}

// Utility regex character escaping
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
