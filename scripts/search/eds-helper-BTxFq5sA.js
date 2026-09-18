import { f as html } from "./common-Dw3aqM5V.js";
//#region src/eds-helper.ts
/**
* Resolves the library stylesheet from the location of the calling module.
*
* The decorators ship one directory below the stylesheet (`eds/*.js` next to
* `streamx-search.css`), so the same relative hop is correct wherever the
* built files were put - vendored into `scripts/search/`, served from another
* folder, or fetched from a CDN. Hardcoding an absolute path instead tied the
* decorators to one deployment layout and broke silently in every other.
*
* Pass `import.meta.url` from the decorator module.
*/
var resolveStylesheetHref = (moduleUrl) => new URL("../streamx-search.css", moduleUrl).href;
var loadCssFile = (cssFile) => {
	if ([...document.querySelectorAll("link[rel=\"stylesheet\"]")].some((link) => link.href === cssFile)) return;
	const styleEl = document.createElement("link");
	styleEl.setAttribute("href", cssFile);
	styleEl.setAttribute("rel", "stylesheet");
	document.head.append(styleEl);
};
var renderEDSLabelTemplate = (template, values) => {
	if (!template) return "";
	return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
		const value = values[key];
		return value === void 0 ? "" : String(value);
	});
};
var getEDSConfig = (block) => {
	const rows = [...block.querySelectorAll(":scope > div")];
	const config = {};
	rows.forEach((row, index) => {
		try {
			const [keyEl, valueEl] = row.querySelectorAll(":scope > div");
			const key = keyEl?.textContent?.trim();
			const value = valueEl?.textContent?.trim();
			if (key && value !== void 0) config[key] = value;
		} catch (error) {
			console.error(`There are some problems with building EDS config. Row number: ${index + 1}`, error, block);
		}
	});
	return config;
};
var replaceElWithError = (root, error) => {
	const errorEl = html`
    <div
      style="
        color: red;
        padding: 10px;
        border: solid 2px red;
        background: rgba(255, 0, 0, 0.2)
      "
    >
      ${error}
    </div>
  `;
	root.append(errorEl);
};
/**
* Layers two EDS configs: `override` wins key by key, but empty values fall
* through to `base`, so an empty cell in a tab block cannot blank out a
* block-level default.
*/
var mergeEDSConfigs = (base, override) => ({
	...base,
	...Object.fromEntries(Object.entries(override).filter(([, value]) => value))
});
var generatePanelLabels = (config) => {
	const labels = {};
	if (config.paginationInfo) labels.paginationInfo = (currentPage, pageNumber) => renderEDSLabelTemplate(config.paginationInfo, {
		currentPage,
		pageNumber
	});
	if (config.totalResults) labels.totalResults = (totalCount) => renderEDSLabelTemplate(config.totalResults, { totalCount });
	if (config.ariaPaginationGoToPage) labels.ariaPaginationGoToPage = (pageNumber) => renderEDSLabelTemplate(config.ariaPaginationGoToPage, { pageNumber });
	if (config.ariaPaginationNavigation) labels.ariaPaginationNavigation = config.ariaPaginationNavigation;
	if (config.sortBy) labels.sortBy = config.sortBy;
	if (config.defaultSortOption) labels.defaultSortOption = config.defaultSortOption;
	return labels;
};
/**
* Parses the authored `facetFields` row - a comma-separated list of facet roots
* - into the array the panel expects. Blank entries are dropped, and an empty
* row falls back to the component default.
*/
var parseFacetFields = (value) => {
	const roots = (value ?? "").split(",").map((root) => root.trim()).filter(Boolean);
	return roots.length > 0 ? roots : void 0;
};
function parseBooleanField(value) {
	return value?.trim().toLowerCase() === "true";
}
/** Maps authored EDS rows to a results-panel config. Single source of truth. */
var readPanelOptions = (config) => ({
	pageSize: Number(config.pageSize) || 10,
	dataSources: config.dataSources ? [config.dataSources] : [],
	method: "POST",
	requestId: config.requestId || void 0,
	facetDepthLevel: Number(config.facetDepthLevel) || void 0,
	facetFields: parseFacetFields(config.facetFields),
	facetPathSeparator: config.facetPathSeparator || void 0,
	facetFieldSize: Number(config.facetFieldSize) || void 0,
	debugMode: config.debugMode === void 0 ? void 0 : parseBooleanField(config.debugMode),
	namespace: config.namespace || void 0,
	labels: generatePanelLabels(config),
	sortParam: config.sortParam || "sort-by",
	sortFields: parseFacetFields(config.sortFields)
});
/**
* Maps authored EDS rows to a query-input config. Single source of truth, so
* both search blocks expose the same input options.
*
* `searchApiUrl` is deliberately left to the caller: the decorators validate it
* first, and that check is what narrows it to a non-empty string.
*/
var readInputOptions = (config) => {
	const queryParam = config.queryParam || "query";
	const searchPageUrl = config.searchPageUrl;
	return {
		queryParam,
		searchPageUrl: searchPageUrl ? (query) => `${searchPageUrl}?${queryParam}=${encodeURIComponent(query)}` : void 0,
		minSearchLength: Number(config.minSearchLength) || 3,
		initialQuery: config.initialQuery || void 0,
		namespace: config.namespace || void 0,
		submitInPlace: !searchPageUrl,
		labels: {
			inputPlaceholder: config.inputPlaceholder,
			inputLabel: config.inputLabel,
			clearButtonAria: config.clearButtonAria,
			searchButtonAria: config.searchButtonAria
		},
		groupByCategory: config.groupByCategory ? parseBooleanField(config.groupByCategory) : void 0,
		showSearchButton: config.showSearchButton ? parseBooleanField(config.showSearchButton) : void 0,
		suggestionsAsLinks: config.suggestionsAsLinks ? parseBooleanField(config.suggestionsAsLinks) : void 0
	};
};
//#endregion
export { readPanelOptions as a, readInputOptions as i, loadCssFile as n, replaceElWithError as o, mergeEDSConfigs as r, resolveStylesheetHref as s, getEDSConfig as t };

//# sourceMappingURL=eds-helper-BTxFq5sA.js.map