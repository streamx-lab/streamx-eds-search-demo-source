import { loadCSS, sampleRUM } from './aem.js';

async function loadInlineSearch() {
  const navSearchMount = document.querySelector('.nav-search-mount');

  if (!navSearchMount) {
    // eslint-disable-next-line no-console
    console.error('nav search mount point is not defined!');
    return;
  }

  // Authored config from the nav's `search-config` block (stashed by header.js).
  let authored = {};
  try {
    authored = JSON.parse(navSearchMount.dataset.searchConfig || '{}');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Could not parse authored nav search config', error);
  }

  // The endpoint comes from the authored `search-config` block; without it the
  // nav search cannot work, so bail out loudly rather than guess a URL.
  if (!authored.searchApiUrl) {
    // eslint-disable-next-line no-console
    console.error('Nav search is missing "searchApiUrl". Author it in the nav\'s "search-config" block.');
    return;
  }

  // The inline search does not load its own stylesheet (the panel blocks do).
  loadCSS(`${window.hlx.codeBasePath}/scripts/search/streamx-search.css`);
  const { createSearchInput } = await import('./search/streamx-search-inline.js');

  const queryParam = authored.queryParam || 'query';
  const streamxSearchInput = createSearchInput({
    searchApiUrl: authored.searchApiUrl,
    searchPageUrl: authored.searchPageUrl
      ? (query) => `${authored.searchPageUrl}?${queryParam}=${encodeURIComponent(query)}`
      : undefined,
    minSearchLength: Number(authored.minSearchLength) || 2,
    queryParam,
    initialQuery: authored.initialQuery || undefined,
    namespace: authored.namespace || undefined,
    showSearchButton: false,
    labels: {
      inputPlaceholder: authored.inputPlaceholder || undefined,
      inputLabel: authored.inputLabel || undefined,
      clearButtonAria: authored.clearButtonAria || undefined,
      searchButtonAria: authored.searchButtonAria || undefined,
    },
    suggestionsAsLinks: true,
  }, navSearchMount);

  const searchInputEl = streamxSearchInput.querySelector('input');
  searchInputEl.classList.add('nav-search-input');

  const navSearch = streamxSearchInput.closest('.nav-search');
  const navSearchToggle = navSearch?.querySelector('.nav-search-toggle');
  if (navSearch && navSearchToggle) {
    navSearchToggle.addEventListener('click', () => {
      if (navSearch.classList.contains('expanded')) streamxSearchInput.showInitialSuggestions?.();
    });
    // This init is delayed, so the search may already be open by the time we mount.
    if (navSearch.classList.contains('expanded')) {
      searchInputEl.focus();
      streamxSearchInput.showInitialSuggestions?.();
    }
  }
}

// Core Web Vitals RUM collection
sampleRUM('cwv');

loadInlineSearch();
