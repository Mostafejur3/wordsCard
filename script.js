// Global variables
let allWords = [];
let currentDisplayWords = [];
let bookmarks = new Set(JSON.parse(localStorage.getItem('hsk_bookmarks') || '[]'));
let selectedSections = new Set();
let selectedTypes = new Set(['all']);
let currentRange = { start: null, end: null };
let currentSort = 'none';
let isBookmarkedView = false;
let searchQuery = '';
let currentFilteredPool = [];

// DOM Elements
const cardsGrid = document.getElementById('cardsGrid');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
const showBookmarkedBtn = document.getElementById('showBookmarkedBtn');
const resetAllBtn = document.getElementById('resetAllBtn');
const statsDiv = document.getElementById('stats');
const themeToggle = document.getElementById('themeToggle');
const sortSelect = document.getElementById('sortSelect');
const rangeStart = document.getElementById('rangeStart');
const rangeEnd = document.getElementById('rangeEnd');
const applyRangeBtn = document.getElementById('applyRangeBtn');
const clearRangeBtn = document.getElementById('clearRangeBtn');
const randomizeBtn = document.getElementById('randomizeBtn');
const confirmModal = document.getElementById('confirmModal');
const toast = document.getElementById('toast');
const viewSelect = document.getElementById('viewSelect');

// View management
function setView(viewValue) {
    document.body.setAttribute('data-view', viewValue);
    localStorage.setItem('viewPreference', viewValue);
}

if (viewSelect) {
    const savedView = localStorage.getItem('viewPreference') || '1';
    viewSelect.value = savedView;
    setView(savedView);
    
    viewSelect.addEventListener('change', (e) => {
        setView(e.target.value);
    });
}

// Toast function
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 1500);
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast(`📋 Copied: ${text}`);
    } catch (err) {
        console.error('Copy failed:', err);
    }
}

// Helper function to categorize word type into main types
function getMainType(type) {
    const mainTypes = ['noun', 'verb', 'adjective', 'adverb'];
    if (mainTypes.includes(type)) return type;
    return 'other';
}

// Smart search
function smartSearch(words, query) {
    if (!query.trim()) return words.map(w => ({ word: w, score: 100 }));
    const lowerQuery = query.toLowerCase().trim();
    const scored = words.map(word => {
        let maxScore = 0;
        if (word.chinese === lowerQuery) maxScore = 100;
        else if (word.chinese.startsWith(lowerQuery)) maxScore = 95;
        else if (word.chinese.includes(lowerQuery)) maxScore = 70;
        
        const pinyinLower = word.pinyin.toLowerCase();
        const pinyinParts = pinyinLower.split(' ');
        let pinyinMatch = false;
        for (let part of pinyinParts) {
            if (part.startsWith(lowerQuery)) { pinyinMatch = true; break; }
        }
        if (pinyinLower.startsWith(lowerQuery)) pinyinMatch = true;
        if (pinyinMatch) maxScore = Math.max(maxScore, 90);
        
        const cleanPinyin = word.pinyin.replace(/[0-9]/g, '');
        const cleanPinyinLower = cleanPinyin.toLowerCase();
        const cleanParts = cleanPinyinLower.split(' ');
        let cleanMatch = false;
        for (let part of cleanParts) {
            if (part.startsWith(lowerQuery)) { cleanMatch = true; break; }
        }
        if (cleanPinyinLower.startsWith(lowerQuery)) cleanMatch = true;
        if (cleanMatch) maxScore = Math.max(maxScore, 85);
        
        const meaningLower = word.meaning.toLowerCase();
        const meaningWords = meaningLower.split(' ');
        if (meaningLower === lowerQuery) maxScore = 100;
        else if (meaningLower.startsWith(lowerQuery)) maxScore = 85;
        else {
            for (let w of meaningWords) {
                if (w === lowerQuery) { maxScore = Math.max(maxScore, 90); break; }
                if (w.startsWith(lowerQuery)) { maxScore = Math.max(maxScore, 80); break; }
            }
        }
        if (getMainType(word.type).startsWith(lowerQuery)) maxScore = Math.max(maxScore, 75);
        return { word, score: maxScore };
    });
    const filtered = scored.filter(item => item.score > 0);
    filtered.sort((a, b) => b.score - a.score);
    return filtered;
}

// Load JSON
async function loadData() {
    try {
        const response = await fetch('words.json');
        if (!response.ok) throw new Error('JSON not found');
        allWords = await response.json();
        console.log('Total words loaded:', allWords.length);
        setDefaultSelections();
        renderAllCards();
    } catch (err) {
        console.error('Error loading JSON:', err);
        cardsGrid.innerHTML = '<div class="loading">❌ Failed to load words. Please make sure words.json exists.</div>';
    }
}

function setDefaultSelections() {
    selectedSections.add('hsk4');
    const hsk4Btn = document.querySelector('.section-btn[data-section="hsk4"]');
    if (hsk4Btn) hsk4Btn.classList.add('active');
    selectedTypes.clear();
    selectedTypes.add('all');
    const allTypeBtn = document.querySelector('.all-type-btn');
    if (allTypeBtn) allTypeBtn.classList.add('active');
}

function selectAllSections() {
    const sectionBtns = document.querySelectorAll('.section-btn:not(.all-section-btn)');
    sectionBtns.forEach(btn => {
        const section = btn.dataset.section;
        if (!selectedSections.has(section)) {
            selectedSections.add(section);
            btn.classList.add('active');
        }
    });
    const allSectionBtn = document.querySelector('.all-section-btn');
    if (allSectionBtn) allSectionBtn.classList.add('active');
}

function clearAllSections() {
    const sectionBtns = document.querySelectorAll('.section-btn:not(.all-section-btn)');
    sectionBtns.forEach(btn => {
        const section = btn.dataset.section;
        if (selectedSections.has(section)) {
            selectedSections.delete(section);
            btn.classList.remove('active');
        }
    });
    const allSectionBtn = document.querySelector('.all-section-btn');
    if (allSectionBtn) allSectionBtn.classList.remove('active');
}

function selectAllTypes() {
    selectedTypes.clear();
    selectedTypes.add('all');
    const typeBtns = document.querySelectorAll('.type-btn:not(.all-type-btn)');
    typeBtns.forEach(btn => btn.classList.remove('active'));
    const allTypeBtn = document.querySelector('.all-type-btn');
    if (allTypeBtn) allTypeBtn.classList.add('active');
}

function getWordSection(word) {
    if (word.hskLevel === 1 || word.hskLevel === 2) return 'hsk12';
    if (word.hskLevel === 3) return 'hsk3';
    if (word.hskLevel === 4) return 'hsk4';
    return 'hsk4';
}

function updateFilteredPool() {
    let filtered = [...allWords];
    if (!isBookmarkedView) {
        if (selectedSections.size > 0) {
            filtered = filterBySections(filtered, selectedSections);
        }
        if (!selectedTypes.has('all') && selectedTypes.size > 0) {
            filtered = filterByTypes(filtered, selectedTypes);
        }
        if (currentRange.start || currentRange.end) {
            filtered = filterByRange(filtered, currentRange.start, currentRange.end);
        }
    }
    currentFilteredPool = filtered;
    return filtered;
}

function filterBySections(words, sections) {
    if (sections.size === 0) return words;
    return words.filter(word => sections.has(getWordSection(word)));
}

function filterByTypes(words, types) {
    if (types.size === 0 || types.has('all')) return words;
    return words.filter(word => {
        const mainType = getMainType(word.type);
        return types.has(mainType);
    });
}

function filterByRange(words, start, end) {
    if (!start && !end) return words;
    return words.filter((word) => {
        const index = allWords.findIndex(w => w.chinese === word.chinese) + 1;
        if (start && end) return index >= start && index <= end;
        if (start) return index >= start;
        if (end) return index <= end;
        return true;
    });
}

function sortWords(words, sortType) {
    if (sortType === 'none') return words;
    const sorted = [...words];
    switch(sortType) {
        case 'az': sorted.sort((a, b) => a.chinese.localeCompare(b.chinese, 'zh')); break;
        case 'za': sorted.sort((a, b) => b.chinese.localeCompare(a.chinese, 'zh')); break;
        case 'meaning': sorted.sort((a, b) => a.meaning.localeCompare(b.meaning)); break;
    }
    return sorted;
}

function randomizeDisplay() {
    if (currentFilteredPool.length === 0) return;
    const shuffled = [...currentFilteredPool];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    currentDisplayWords = shuffled;
    renderCards(currentDisplayWords);
}

function getSelectionSummary() {
    const sections = selectedSections.size ? Array.from(selectedSections).map(s => {
        if (s === 'hsk12') return 'HSK1-2';
        if (s === 'hsk3') return 'HSK3';
        if (s === 'hsk4') return 'HSK4';
        return s;
    }).join(' + ') : 'All HSK';
    let types = 'All Types';
    if (!selectedTypes.has('all') && selectedTypes.size > 0) {
        types = Array.from(selectedTypes).join(', ');
    }
    let summary = `${sections} / ${types}`;
    if (currentRange.start || currentRange.end) {
        const range = `${currentRange.start || '1'} - ${currentRange.end || '1450'}`;
        summary += ` (Range: ${range})`;
    }
    if (isBookmarkedView) summary = `⭐ Bookmarked / ${summary}`;
    return summary;
}

function renderAllCards() {
    const pool = updateFilteredPool();
    let results = [...pool];
    const isSearching = searchInput.value.trim().length > 0;
    let searchScore = 0;
    if (isSearching) {
        const scored = smartSearch(results, searchInput.value);
        results = scored.map(item => item.word);
        searchScore = scored[0]?.score || 0;
    }
    if (!isSearching && currentSort !== 'none') {
        results = sortWords(results, currentSort);
    }
    currentDisplayWords = results;
    const summary = getSelectionSummary();
    if (isSearching) {
        statsDiv.innerHTML = `🔍 Found ${results.length} words for "${searchInput.value}" (Best match: ${Math.round(searchScore)}% similar) | ${summary}`;
    } else {
        statsDiv.innerHTML = `📚 ${results.length} of ${allWords.length} words | ${summary}`;
    }
    renderCards(currentDisplayWords);
}

function renderCards(wordsToRender) {
    if (!wordsToRender || !wordsToRender.length) {
        cardsGrid.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><h3>No words found</h3><p>Try a different search!</p></div>';
        return;
    }
    cardsGrid.innerHTML = '';
    wordsToRender.forEach((word) => {
        const card = document.createElement('div');
        card.className = 'word-card';
        card.dataset.id = word.chinese;
        const isBookmarked = bookmarks.has(word.chinese);
        const charLength = word.chinese.length;
        let lengthClass = '';
        if (charLength === 3) lengthClass = 'data-length="3"';
        else if (charLength >= 4) lengthClass = 'data-length="4"';
        
        let typeDisplay = getMainType(word.type);
        if (typeDisplay === 'adjective') typeDisplay = 'adj';
        if (typeDisplay === 'adverb') typeDisplay = 'adv';
        
        card.innerHTML = `
            <button class="bookmark-btn ${isBookmarked ? 'active' : ''}">
                <i class="${isBookmarked ? 'fas' : 'far'} fa-bookmark"></i>
            </button>
            <div class="word-chinese" ${lengthClass}>${word.chinese}</div>
            <div class="word-hover-content">
                <div class="word-pinyin">${word.pinyin}</div>
                <div class="word-meaning">${word.meaning}</div>
            </div>
            <div class="word-type-tag">${typeDisplay}</div>
        `;
        const bookmarkBtn = card.querySelector('.bookmark-btn');
        bookmarkBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleBookmark(word.chinese, bookmarkBtn);
        });
        card.addEventListener('click', () => {
            copyToClipboard(word.chinese);
        });
        cardsGrid.appendChild(card);
    });
}

function toggleBookmark(wordId, btnElement) {
    if (bookmarks.has(wordId)) {
        bookmarks.delete(wordId);
        btnElement.classList.remove('active');
        btnElement.innerHTML = '<i class="far fa-bookmark"></i>';
    } else {
        bookmarks.add(wordId);
        btnElement.classList.add('active');
        btnElement.innerHTML = '<i class="fas fa-bookmark"></i>';
    }
    localStorage.setItem('hsk_bookmarks', JSON.stringify([...bookmarks]));
    if (isBookmarkedView) renderAllCards();
}

// Theme
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });
}

// ALL Section button
const allSectionBtn = document.querySelector('.all-section-btn');
if (allSectionBtn) {
    allSectionBtn.addEventListener('click', () => {
        if (selectedSections.size === 3) clearAllSections();
        else selectAllSections();
        isBookmarkedView = false;
        if (showBookmarkedBtn) showBookmarkedBtn.classList.remove('active');
        renderAllCards();
    });
}

// ALL Type button
const allTypeBtn = document.querySelector('.all-type-btn');
if (allTypeBtn) {
    allTypeBtn.addEventListener('click', () => {
        selectAllTypes();
        isBookmarkedView = false;
        if (showBookmarkedBtn) showBookmarkedBtn.classList.remove('active');
        renderAllCards();
    });
}

// Section filter toggles
document.querySelectorAll('.section-btn:not(.all-section-btn)').forEach(btn => {
    btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        if (selectedSections.has(section)) {
            selectedSections.delete(section);
            btn.classList.remove('active');
        } else {
            selectedSections.add(section);
            btn.classList.add('active');
        }
        if (selectedSections.size === 3) allSectionBtn?.classList.add('active');
        else allSectionBtn?.classList.remove('active');
        isBookmarkedView = false;
        if (showBookmarkedBtn) showBookmarkedBtn.classList.remove('active');
        renderAllCards();
    });
});

// Type filter toggles
document.querySelectorAll('.type-btn:not(.all-type-btn)').forEach(btn => {
    btn.addEventListener('click', () => {
        if (selectedTypes.has('all')) {
            selectedTypes.delete('all');
            allTypeBtn?.classList.remove('active');
        }
        const type = btn.dataset.type;
        if (selectedTypes.has(type)) {
            selectedTypes.delete(type);
            btn.classList.remove('active');
        } else {
            selectedTypes.add(type);
            btn.classList.add('active');
        }
        if (selectedTypes.size === 0) selectAllTypes();
        isBookmarkedView = false;
        if (showBookmarkedBtn) showBookmarkedBtn.classList.remove('active');
        renderAllCards();
    });
});

// Range
if (applyRangeBtn) {
    applyRangeBtn.addEventListener('click', () => {
        const start = parseInt(rangeStart.value);
        const end = parseInt(rangeEnd.value);
        if ((start > 0 && start <= 1450) || (end > 0 && end <= 1450)) {
            currentRange = { start: start > 0 ? start : null, end: end > 0 ? end : null };
            isBookmarkedView = false;
            if (showBookmarkedBtn) showBookmarkedBtn.classList.remove('active');
            renderAllCards();
        }
    });
}

if (clearRangeBtn) {
    clearRangeBtn.addEventListener('click', () => {
        rangeStart.value = '';
        rangeEnd.value = '';
        currentRange = { start: null, end: null };
        renderAllCards();
    });
}

// Randomize
if (randomizeBtn) {
    randomizeBtn.addEventListener('click', () => {
        if (currentFilteredPool.length > 0) randomizeDisplay();
    });
}

// Sort
if (sortSelect) {
    sortSelect.addEventListener('change', () => {
        currentSort = sortSelect.value;
        renderAllCards();
    });
}

// Search
if (searchInput) {
    searchInput.addEventListener('input', () => {
        isBookmarkedView = false;
        if (showBookmarkedBtn) showBookmarkedBtn.classList.remove('active');
        renderAllCards();
    });
}

if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        renderAllCards();
    });
}

// Bookmarked view
if (showBookmarkedBtn) {
    showBookmarkedBtn.addEventListener('click', () => {
        if (isBookmarkedView) {
            isBookmarkedView = false;
            showBookmarkedBtn.classList.remove('active');
            renderAllCards();
        } else {
            isBookmarkedView = true;
            showBookmarkedBtn.classList.add('active');
            updateFilteredPool();
            renderAllCards();
        }
    });
}

// Reset with confirmation
if (resetAllBtn) {
    resetAllBtn.addEventListener('click', () => {
        if (confirmModal) confirmModal.style.display = 'flex';
    });
}

const confirmYes = document.getElementById('confirmYes');
const confirmNo = document.getElementById('confirmNo');

if (confirmYes) {
    confirmYes.addEventListener('click', () => {
        searchInput.value = '';
        selectedSections.clear();
        selectedTypes.clear();
        currentRange = { start: null, end: null };
        currentSort = 'none';
        isBookmarkedView = false;
        bookmarks.clear();
        localStorage.removeItem('hsk_bookmarks');
        if (sortSelect) sortSelect.value = 'none';
        if (rangeStart) rangeStart.value = '';
        if (rangeEnd) rangeEnd.value = '';
        document.querySelectorAll('.section-btn, .type-btn').forEach(b => b.classList.remove('active'));
        setDefaultSelections();
        if (showBookmarkedBtn) showBookmarkedBtn.classList.remove('active');
        if (confirmModal) confirmModal.style.display = 'none';
        renderAllCards();
    });
}

if (confirmNo) {
    confirmNo.addEventListener('click', () => {
        if (confirmModal) confirmModal.style.display = 'none';
    });
}

if (confirmModal) {
    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) confirmModal.style.display = 'none';
    });
}

// Initialize
initTheme();
loadData();