// Application State
let allUpdates = []; // Flat list of all updates parsed from entries
let selectedUpdateId = null;

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

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes();
    setupEventListeners();
});

// Event Listeners setup
function setupEventListeners() {
    // Refresh button
    btnRefresh.addEventListener('click', () => {
        fetchReleaseNotes();
    });

    // Search input
    searchInput.addEventListener('input', filterAndRenderFeed);

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
    
    dates.forEach(date => {
        html += `
            <div class="date-group">
                <div class="date-header">${date}</div>
        `;
        
        groups[date].forEach(update => {
            const colors = getTypeColor(update.type);
            const isSelected = selectedUpdateId === update.id;
            
            html += `
                <div class="update-card glass-card" style="--type-color: ${colors.hex}; --type-color-rgb: ${colors.rgb}" id="card-${update.id}">
                    <div class="card-top">
                        <div class="badge-wrapper">
                            <span class="type-badge">${update.type}</span>
                        </div>
                        <span class="card-date">${update.date}</span>
                    </div>
                    <div class="update-content">
                        ${update.rawHtml}
                    </div>
                    <div class="card-actions">
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
    
    // Auto Draft Tweet body
    // 280 characters limit:
    // "BigQuery [Type]: [Text snippet...] #BigQuery #GoogleCloud [Link]"
    const prefix = `BigQuery ${update.type}: `;
    const link = `\nRelease details: ${update.link}`;
    const tags = ` #BigQuery #GoogleCloud`;
    
    // Calculate remaining chars for text snippet
    const maxSnippetLen = 280 - prefix.length - link.length - tags.length - 5; // safety buffer
    let snippet = update.plainText;
    if (snippet.length > maxSnippetLen) {
        snippet = snippet.substring(0, maxSnippetLen).trim() + '...';
    }
    
    tweetTextarea.value = `${prefix}${snippet}${tags}${link}`;
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
