document.addEventListener('DOMContentLoaded', () => {
    // State management
    let allNotes = [];
    let filteredNotes = [];
    let selectedNoteId = null; // format: 'dateIndex-itemIndex'
    let currentFilter = 'all';
    let searchQuery = '';

    // DOM Elements
    const btnRefresh = document.getElementById('btn-refresh');
    const searchInput = document.getElementById('search-input');
    const filterContainer = document.getElementById('filter-container');
    const feedContainer = document.getElementById('feed-container');
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const btnRetry = document.getElementById('btn-retry');
    const emptyState = document.getElementById('empty-state');
    const btnClearFilters = document.getElementById('btn-clear-filters');
    const feedStatus = document.getElementById('feed-status');

    // Tweet Composer Elements
    const tweetComposerDrawer = document.getElementById('tweet-composer-drawer');
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    const composerBackdrop = document.getElementById('composer-backdrop');
    const previewBadge = document.getElementById('preview-badge');
    const previewDate = document.getElementById('preview-date');
    const previewText = document.getElementById('preview-text');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCounter = document.getElementById('char-counter');
    const btnCopyTweet = document.getElementById('btn-copy-tweet');
    const btnShareTweet = document.getElementById('btn-share-tweet');
    
    // Toast Element
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    // Initialize application
    init();

    function init() {
        fetchNotes();
        setupEventListeners();
    }

    // Event Handlers Setup
    function setupEventListeners() {
        btnRefresh.addEventListener('click', fetchNotes);
        btnRetry.addEventListener('click', fetchNotes);
        btnClearFilters.addEventListener('click', clearFilters);
        
        // Search filter
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            renderNotes();
        });

        // Category chip filters
        filterContainer.addEventListener('click', (e) => {
            const chip = e.target.closest('.chip');
            if (!chip) return;

            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            currentFilter = chip.dataset.filter;
            
            // Sync with stats panel active state
            document.querySelectorAll('.stat-card').forEach(card => {
                if (card.dataset.stat === currentFilter) {
                    card.classList.add('active');
                } else {
                    card.classList.remove('active');
                }
            });

            renderNotes();
        });

        // Stats cards filters
        document.querySelectorAll('.stat-card').forEach(card => {
            card.addEventListener('click', () => {
                const statType = card.dataset.stat;
                
                // Toggle filter or set active
                let newFilter = statType;
                if (currentFilter === statType) {
                    // Clicking same stat card toggles it back to 'all'
                    newFilter = 'all';
                }

                currentFilter = newFilter;
                
                // Update Chips UI
                document.querySelectorAll('.chip').forEach(chip => {
                    if (chip.dataset.filter === newFilter) {
                        chip.classList.add('active');
                    } else {
                        chip.classList.remove('active');
                    }
                });

                // Update Stats UI
                document.querySelectorAll('.stat-card').forEach(c => {
                    if (c.dataset.stat === newFilter) {
                        c.classList.add('active');
                    } else {
                        c.classList.remove('active');
                    }
                });

                renderNotes();
            });
        });

        // Drawer Close
        btnCloseDrawer.addEventListener('click', closeComposer);
        composerBackdrop.addEventListener('click', closeComposer);

        // Character counter
        tweetTextarea.addEventListener('input', updateCharCount);

        // Share & Copy events
        btnCopyTweet.addEventListener('click', copyTweetDraft);
        btnShareTweet.addEventListener('click', shareOnTwitter);
    }

    // Fetch from Backend API
    function fetchNotes() {
        setLoadingState(true);
        feedStatus.textContent = 'Fetching release notes...';

        fetch('/api/notes')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server returned status code ${response.status}`);
                }
                return response.json();
            })
            .then(res => {
                if (res.status === 'success') {
                    allNotes = res.data;
                    feedStatus.textContent = 'Up to date';
                    calculateStats();
                    renderNotes();
                    setLoadingState(false);
                } else {
                    throw new Error(res.message || 'Unknown server error');
                }
            })
            .catch(error => {
                console.error('Error fetching release notes:', error);
                showError(error.message);
                setLoadingState(false);
            });
    }

    // UI Loading State Control
    function setLoadingState(isLoading) {
        if (isLoading) {
            btnRefresh.classList.add('loading');
            btnRefresh.disabled = true;
            loadingState.classList.remove('hidden');
            feedContainer.classList.add('hidden');
            errorState.classList.add('hidden');
            emptyState.classList.add('hidden');
        } else {
            btnRefresh.classList.remove('loading');
            btnRefresh.disabled = false;
            loadingState.classList.add('hidden');
        }
    }

    // Error UI Control
    function showError(message) {
        errorMessage.textContent = message || 'Something went wrong while fetching the release notes. Please try again.';
        errorState.classList.remove('hidden');
        feedContainer.classList.add('hidden');
        emptyState.classList.add('hidden');
        loadingState.classList.add('hidden');
        feedStatus.textContent = 'Sync failed';
    }

    // Calculate Category Statistics
    function calculateStats() {
        const stats = {
            Feature: 0,
            Announcement: 0,
            Change: 0,
            Issue: 0,
            Breaking: 0
        };

        allNotes.forEach(entry => {
            entry.items.forEach(item => {
                if (stats[item.type] !== undefined) {
                    stats[item.type]++;
                }
            });
        });

        // Update Stats DOM
        Object.keys(stats).forEach(type => {
            const countElem = document.getElementById(`stat-count-${type.toLowerCase()}`);
            if (countElem) {
                countElem.textContent = stats[type];
            }
        });
    }

    // Clear Search and Filter values
    function clearFilters() {
        searchInput.value = '';
        searchQuery = '';
        currentFilter = 'all';
        
        // Reset chips
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        document.querySelector('.chip[data-filter="all"]').classList.add('active');

        // Reset stats panel
        document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
        
        renderNotes();
    }

    // Render Feed Layout
    function renderNotes() {
        feedContainer.innerHTML = '';
        let matchCount = 0;

        allNotes.forEach((entry, entryIdx) => {
            // Filter items inside each date
            const matchedItems = entry.items.filter((item, itemIdx) => {
                // Filter 1: Category
                if (currentFilter !== 'all' && item.type !== currentFilter) {
                    return false;
                }

                // Filter 2: Search term
                if (searchQuery) {
                    const inType = item.type.toLowerCase().includes(searchQuery);
                    const inText = item.text.toLowerCase().includes(searchQuery);
                    const inDate = entry.date.toLowerCase().includes(searchQuery);
                    if (!inType && !inText && !inDate) {
                        return false;
                    }
                }

                return true;
            });

            if (matchedItems.length > 0) {
                matchCount += matchedItems.length;

                // Create date timeline block
                const timelineGroup = document.createElement('div');
                timelineGroup.className = 'timeline-group';

                const dateHeader = document.createElement('div');
                dateHeader.className = 'timeline-date-header';
                dateHeader.innerHTML = `<h2>${entry.date}</h2>`;
                timelineGroup.appendChild(dateHeader);

                const cardsContainer = document.createElement('div');
                cardsContainer.className = 'timeline-cards';

                matchedItems.forEach(item => {
                    // Original index tracking
                    const originalItemIdx = entry.items.indexOf(item);
                    const uniqueId = `${entryIdx}-${originalItemIdx}`;

                    // Card Element
                    const card = document.createElement('div');
                    card.className = `note-card ${selectedNoteId === uniqueId ? 'selected' : ''}`;
                    card.style.setProperty('--type-color', `var(--color-${item.type.toLowerCase()})`);
                    card.dataset.id = uniqueId;

                    // Parse Icon
                    const badgeClass = `badge-${item.type.toLowerCase()}`;
                    const iconSvg = getBadgeIcon(item.type);

                    card.innerHTML = `
                        <div class="card-header">
                            <div class="card-meta">
                                <span class="badge ${badgeClass}">
                                    ${iconSvg}
                                    ${item.type}
                                </span>
                            </div>
                            <div class="card-selection-indicator">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                        </div>
                        <div class="card-content">
                            ${item.html}
                        </div>
                        <div class="card-actions">
                            <button class="btn-card-action tweet-action" data-action="tweet">
                                <svg viewBox="0 0 24 24" fill="currentColor" class="icon">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                </svg>
                                <span>Tweet This</span>
                            </button>
                        </div>
                    `;

                    // Card Selection Event (excluding link clicks)
                    card.addEventListener('click', (e) => {
                        // If user clicks a link inside content, open link and don't toggle card selection
                        if (e.target.tagName === 'A' || e.target.closest('a')) {
                            return;
                        }

                        // Check if tweet action button was clicked
                        const isTweetBtn = e.target.closest('[data-action="tweet"]');

                        toggleCardSelection(uniqueId, entry, item, isTweetBtn);
                    });

                    cardsContainer.appendChild(card);
                });

                timelineGroup.appendChild(cardsContainer);
                feedContainer.appendChild(timelineGroup);
            }
        });

        // Handle states based on matches
        if (matchCount === 0) {
            emptyState.classList.remove('hidden');
            feedContainer.classList.add('hidden');
        } else {
            emptyState.classList.add('hidden');
            feedContainer.classList.remove('hidden');
        }
    }

    // Toggle card selection
    function toggleCardSelection(id, entry, item, forceOpenComposer = false) {
        const previousSelectedId = selectedNoteId;
        
        if (selectedNoteId === id && !forceOpenComposer) {
            // Deselect card
            selectedNoteId = null;
            closeComposer();
        } else {
            // Select new card
            selectedNoteId = id;
            openComposer(entry, item);
        }

        // Visual update on DOM
        document.querySelectorAll('.note-card').forEach(card => {
            if (card.dataset.id === selectedNoteId) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
    }

    // Open Tweet Composer Drawer
    function openComposer(entry, item) {
        // Set Badge styling in Preview
        previewBadge.className = `preview-badge`;
        previewBadge.textContent = item.type;
        previewBadge.style.color = `var(--color-${item.type.toLowerCase()})`;
        previewBadge.style.borderColor = `var(--color-${item.type.toLowerCase()})`;
        
        previewDate.textContent = entry.date;
        previewText.textContent = item.text;

        // Generate draft Tweet content
        const tweetText = generateTweetDraft(entry, item);
        tweetTextarea.value = tweetText;
        updateCharCount();

        // Slide drawer in
        tweetComposerDrawer.classList.add('open');
    }

    // Close Composer Drawer
    function closeComposer() {
        tweetComposerDrawer.classList.remove('open');
        
        // Clear selected card highlights if drawer closed manually
        selectedNoteId = null;
        document.querySelectorAll('.note-card').forEach(card => {
            card.classList.remove('selected');
        });
    }

    // Auto-generate Tweet content adhering to character limits
    function generateTweetDraft(entry, item) {
        const prefix = `📢 BigQuery [${item.type}] (${entry.date}): `;
        const url = entry.url || 'https://cloud.google.com/bigquery/docs/release-notes';
        const suffix = `\n\nLearn more: ${url}\n#BigQuery #GoogleCloud`;
        
        // Character Math
        // Max limit is 280.
        const maxTextLen = 280 - prefix.length - suffix.length - 4; // 4 char buffer
        
        let cleanedText = item.text;
        if (cleanedText.length > maxTextLen) {
            cleanedText = cleanedText.substring(0, maxTextLen - 3) + '...';
        }

        return `${prefix}${cleanedText}${suffix}`;
    }

    // Update Character Counter UI
    function updateCharCount() {
        const len = tweetTextarea.value.length;
        charCounter.textContent = `${len} / 280`;

        // Warning thresholds
        if (len > 280) {
            charCounter.className = 'char-counter error';
            btnShareTweet.disabled = true;
            btnShareTweet.style.opacity = 0.5;
            btnShareTweet.style.pointerEvents = 'none';
        } else if (len >= 250) {
            charCounter.className = 'char-counter warning';
            btnShareTweet.disabled = false;
            btnShareTweet.style.opacity = 1;
            btnShareTweet.style.pointerEvents = 'auto';
        } else {
            charCounter.className = 'char-counter';
            btnShareTweet.disabled = false;
            btnShareTweet.style.opacity = 1;
            btnShareTweet.style.pointerEvents = 'auto';
        }
    }

    // Copy draft tweet to clipboard
    function copyTweetDraft() {
        navigator.clipboard.writeText(tweetTextarea.value)
            .then(() => {
                showToast('Draft copied to clipboard!');
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
                showToast('Failed to copy to clipboard.');
            });
    }

    // Share tweet on Twitter/X Web Intent
    function shareOnTwitter() {
        const text = tweetTextarea.value;
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, '_blank', 'noopener,noreferrer,width=550,height=420');
    }

    // Show Notification Toast
    function showToast(message) {
        toastMessage.textContent = message;
        toast.classList.remove('hidden');
        // Simple force layout reflow to trigger transition
        toast.offsetHeight;
        toast.classList.remove('toast-hidden'); // Wait, we use .hidden
        
        // Set styling for fade-in
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(10px)';
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 300);
        }, 2500);
    }

    // Helper: Return SVG icon based on category type
    function getBadgeIcon(type) {
        switch(type) {
            case 'Feature':
                return `<svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>`;
            case 'Announcement':
                return `<svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                        </svg>`;
            case 'Change':
                return `<svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <polyline points="1 20 1 14 7 14"></polyline>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                        </svg>`;
            case 'Issue':
                return `<svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>`;
            case 'Breaking':
                return `<svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                        </svg>`;
            default:
                return `<svg class="badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>`;
        }
    }
});
