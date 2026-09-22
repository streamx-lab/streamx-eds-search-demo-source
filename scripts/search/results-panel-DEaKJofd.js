import { a as DEFAULT_SORT_PARAM, c as randomUUID, d as fetchSearchResults, f as html, g as withNamespaceParam, i as DEFAULT_QUERY_PARAM, m as onUrlChange, o as config, p as normalizeLabels, u as dispatchUrlChangeEvent } from "./common-Dw3aqM5V.js";
//#region src/components/results-panel/panel-state.ts
var panelStates = /* @__PURE__ */ new WeakMap();
//#endregion
//#region src/components/results-panel/components/facets/utils/facet-param-name.ts
var DEFAULT_FACETS_PARAM = "stx-facets";
/**
* URL param the panel persists its facet selection under. Suffixed with the
* panel's `stateKey` (the tab id inside search tabs) so sibling panels keep
* separate selections in one URL.
*/
var facetsParamName = (results) => results.stateKey ? `${DEFAULT_FACETS_PARAM}-${results.stateKey}` : DEFAULT_FACETS_PARAM;
//#endregion
//#region src/components/results-panel/components/facets/utils/get-bucket-child-agg.ts
/**
* Finds a bucket's nested sub-aggregation, i.e. the property that is not one of
* the bucket's own fields and carries its own `buckets` array.
*
* Guards against the degenerate shapes the backend returns when the requested
* facet depth exceeds what the index actually nests (`parentField` is the
* field the bucket itself belongs to):
* - a bucket nesting its own field again (`category_level1` inside
*   `category_level1`, holding a copy of the bucket) would render the node as
*   its own child;
* - an empty child aggregation would render an expander that opens onto
*   nothing.
* Both count as "no children".
*/
var getBucketChildAgg = (bucket, parentField) => {
	for (const key of Object.keys(bucket)) {
		if (key === "key" || key === "key_as_string" || key === "doc_count") continue;
		const value = bucket[key];
		if (value && Array.isArray(value.buckets) && key !== parentField && value.buckets.length > 0) return {
			field: key,
			buckets: value.buckets
		};
	}
	return null;
};
/** Turns sort field name into a heading, e.g. `publication_date` → `Publication Date`. */
var humanizeSortFieldLabel = (field) => field.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) || field;
var writeSortOptionToUrl = (sortParam, sortOption) => {
	const url = new URL(window.location.href);
	url.searchParams.delete(sortParam);
	if (sortOption) url.searchParams.set(sortParam, sortOption);
	window.history.pushState({}, "", url);
	dispatchUrlChangeEvent();
};
/**
* We cannot easily pass full labels to EDS blocks (as we are passing just field names)
* so we need to estbalish typical direction labels manually
*/
function getSortDirectionLabels(sortFieldName) {
	if (sortFieldName.includes("date")) return {
		descLabel: "(Newest)",
		ascLabel: "(Oldest)"
	};
	return {
		ascLabel: "(Ascending)",
		descLabel: "(Descending)"
	};
}
var createSortOptions = (sortParam, label, sortFields, defaultSortOptionLabel) => {
	if (!sortFields?.length) return null;
	const selectId = randomUUID();
	const sortOptionElements = [];
	sortFields.forEach((field) => {
		const fieldLabel = humanizeSortFieldLabel(field);
		const { ascLabel, descLabel } = getSortDirectionLabels(field);
		sortOptionElements.push(html`
        <option value="${field}${"__"}asc">
          ${fieldLabel} ${ascLabel}
        </option>
      `);
		sortOptionElements.push(html`
        <option value="${field}${"__"}desc">
          ${fieldLabel} ${descLabel}
        </option>
      `);
	});
	const sortOptionsEl = html`
    <div class="stx-results-panel__sort-options-container">
      <label for="${selectId}">${label}</label>
      <select class="stx-results-panel__sort-options" id="${selectId}">
        <option value="">${defaultSortOptionLabel}</option>
        ${sortOptionElements}
      </select>
    </div>
  `;
	const sortOptionsSelect = sortOptionsEl.querySelector(".stx-results-panel__sort-options");
	sortOptionsSelect.addEventListener("change", (e) => {
		const target = e.target;
		writeSortOptionToUrl(sortParam, target.value);
	});
	return {
		element: sortOptionsEl,
		selectElement: sortOptionsSelect
	};
};
function updateSelectedSortOption(resultsPanel, selectedSortOption) {
	const sortOptionsSelect = resultsPanel.querySelector(".stx-results-panel__sort-options");
	sortOptionsSelect.value = selectedSortOption;
}
//#endregion
//#region src/search-request.ts
/**
* The facet field naming convention.
*
* A facet is configured by its **root** name alone (`category`, `tags`, ...).
* The surrounding names are fixed by the index layout: each nesting level is
* aggregated on `<root>_level<n>`, and selections are filtered against
* `<root>_hierarchy`, which stores the full ancestor paths.
*/
var DEFAULT_FACET_FIELDS = ["category"];
var FACET_LEVEL_SUFFIX = "_level";
var FACET_HIERARCHY_SUFFIX = "_hierarchy";
/**
* Maps an aggregation field back to the field its selections filter against,
* so every facet tree filters on its own hierarchy instead of a shared one.
*
* @example
* facetFilterFieldFor("tags_level0") // "tags_hierarchy"
* facetFilterFieldFor("category_level2") // "category_hierarchy"
*/
var facetFilterFieldFor = (treeField) => {
	return `${treeField.replace(new RegExp(`${FACET_LEVEL_SUFFIX}\\d+$`), "")}${FACET_HIERARCHY_SUFFIX}`;
};
/**
* Builds the facet aggregations requested for a query: one tree per configured
* root, each nesting `depth` levels from `<root>_level0`.
*
* A missing or invalid depth falls back to a single flat level.
*
* @example
* buildFacetFields({ fields: ["category"] })
* // { fields: [{ name: "category_level0", size: 20, last: true }] }
*
* @example
* buildFacetFields({ fields: ["category"], depth: 2 })
* // { fields: [{ name: "category_level0", size: 20,
* //             children: [{ name: "category_level1", size: 20, last: true }],
* //             last: true }] }
*
* @example
* buildFacetFields({ fields: ["category", "tags"] })
* // { fields: [{ name: "category_level0", ... }, { name: "tags_level0", ... }] }
*/
var buildFacetFields = ({ depth, fields = DEFAULT_FACET_FIELDS, fieldSize = 20 } = {}) => {
	const levels = Math.max(1, Math.trunc(Number(depth)) || 1);
	const roots = fields.length > 0 ? fields : DEFAULT_FACET_FIELDS;
	const buildLevel = (root, index, isLast) => {
		const field = {
			name: `${root}${FACET_LEVEL_SUFFIX}${index}`,
			size: fieldSize
		};
		if (index < levels - 1) field.children = [buildLevel(root, index + 1, true)];
		if (isLast) field.last = true;
		return field;
	};
	return { fields: roots.map((root, idx) => buildLevel(root, 0, idx === roots.length - 1)) };
};
/**
* Joins a facet ancestor path.
*
* @example
* joinFacetPath("Electronics", "Tablet") // "Electronics>Tablet"
* joinFacetPath("", "Electronics") // "Electronics"
*/
var joinFacetPath = (parentPath, key, separator = ">") => parentPath ? `${parentPath}${separator}${key}` : key;
function extractSortInfo(sortBy) {
	const [sortFieldName, sortDirection] = sortBy.split("__");
	const sortField = `${sortFieldName}_sort_order`;
	if (sortDirection !== "asc" && sortDirection !== "desc") {
		console.warn("Invalid sort direction, fallbacks to desc");
		return {
			sortField,
			sortDirection: "desc"
		};
	}
	return {
		sortField,
		sortDirection
	};
}
/**
* Builds the POST body for the search endpoint.
*
* Selected filters become `params.filter_query.fields`: one entry per facet
* tree - values within a tree are OR-ed, separate trees are AND-ed - with
* `last: true` on the final entry. Each entry filters against that tree's own
* `<root>_hierarchy` field, so two trees that share a value stay distinct.
*
* Values are full hierarchical paths (`"Electronics>Tablet"`), so a nested
* selection never needs its ancestors sent alongside it. Sending two branches
* of one tree as separate entries would AND them and match nothing, which is
* why grouping is per tree rather than per aggregation level.
*/
var buildSearchRequestBody = ({ requestId, from = 0, size = 20, query = "", filters, facetDepthLevel, facetFields, facetFieldSize, namespace, sortBy } = {}) => {
	const body = { params: {
		from,
		size,
		facets: buildFacetFields({
			depth: facetDepthLevel,
			fields: facetFields,
			fieldSize: facetFieldSize
		})
	} };
	if (requestId) body.id = requestId;
	if (query) body.params.query = query;
	if (namespace) body.params.namespace = namespace;
	if (sortBy) {
		const { sortField, sortDirection } = extractSortInfo(sortBy);
		body.params[sortField] = sortDirection;
	}
	const filterGroups = filters ? Object.entries(filters).filter(([, values]) => values.length > 0) : [];
	if (filterGroups.length > 0) body.params.filter_query = { fields: filterGroups.map(([treeField, values], index) => {
		const entry = {
			name: facetFilterFieldFor(treeField),
			values
		};
		if (index === filterGroups.length - 1) entry.last = true;
		return entry;
	}) };
	return body;
};
//#endregion
//#region src/components/results-panel/components/facets/config/facet-selectors.ts
var FACET_NODE_SELECTOR = ".stx-results-panel__facet-node";
var FACET_CHILDREN_SELECTOR = ".stx-results-panel__facet-children";
var FACET_OWN_INPUT_SELECTOR = ":scope > .stx-results-panel__facet-row .stx-results-panel__facet-option input";
var getFacetNodeInput = (node) => node.querySelector(FACET_OWN_INPUT_SELECTOR);
/**
* Finds the checkbox of a node's direct parent, or `null` for a top-level node
* (whose container is the values list rather than a children list).
*/
var findParentFacetInput = (input) => {
	const container = input.closest(FACET_NODE_SELECTOR)?.parentElement;
	if (!container?.classList.contains("stx-results-panel__facet-children")) return null;
	const parentNode = container.closest(FACET_NODE_SELECTOR);
	return parentNode ? getFacetNodeInput(parentNode) : null;
};
/** The checkboxes one level below `node`, skipping deeper descendants. */
var getChildFacetInputs = (node) => {
	const childrenPanel = node.querySelector(`:scope > ${FACET_CHILDREN_SELECTOR}`);
	if (!childrenPanel) return [];
	return [...childrenPanel.querySelectorAll(`:scope > ${FACET_NODE_SELECTOR}`)].map(getFacetNodeInput).filter((input) => input !== null);
};
//#endregion
//#region src/components/results-panel/components/facets/utils/facet-node-counter.ts
var FacetNodeCounter = class {
	counter = 0;
	getCounter() {
		const currentCount = this.counter;
		this.counter++;
		return currentCount;
	}
};
var facetNodeCounter = new FacetNodeCounter();
//#endregion
//#region src/components/results-panel/components/facets/components/facet-node-list.ts
var createFacetNode = (field, bucket, context, siblingsHaveChildren, parentPath) => {
	const key = String(bucket.key);
	const path = joinFacetPath(parentPath, key, context.pathSeparator);
	const child = getBucketChildAgg(bucket, field);
	const childrenId = `stx-facet-children-${facetNodeCounter.getCounter()}`;
	const childrenPanel = child ? html`
        <div
          id="${childrenId}"
          class="stx-results-panel__facet-children"
          hidden
        >
          ${createFacetNodeList(child.field, child.buckets, context, path)}
        </div>
      ` : "";
	let expander = "";
	if (child) {
		expander = html`
      <button
        type="button"
        class="stx-results-panel__facet-subtoggle"
        aria-expanded="false"
        aria-controls="${childrenId}"
      >
        <span
          class="stx-results-panel__facet-chevron"
          aria-hidden="true"
        ></span>
      </button>
    `;
		expander.setAttribute("aria-label", `Toggle ${key} subcategories`);
	} else if (siblingsHaveChildren) expander = html`
      <span
        class="stx-results-panel__facet-subtoggle-spacer"
        aria-hidden="true"
      ></span>
    `;
	const node = html`
    <div class="stx-results-panel__facet-node">
      <div class="stx-results-panel__facet-row">
        ${expander}
        <label class="stx-results-panel__facet-option">
          <input type="checkbox" />
          <span class="stx-results-panel__facet-label"></span>
          <span class="stx-results-panel__facet-count"></span>
        </label>
      </div>
      ${childrenPanel}
    </div>
  `;
	const input = node.querySelector(FACET_OWN_INPUT_SELECTOR);
	input.name = context.treeField;
	input.dataset.facetId = context.treeField;
	input.value = path;
	const labelEl = node.querySelector(".stx-results-panel__facet-label");
	const countEl = node.querySelector(".stx-results-panel__facet-count");
	if (labelEl) labelEl.textContent = key;
	if (countEl) countEl.textContent = String(bucket.doc_count);
	return node;
};
var createFacetNodeList = (field, buckets, context, parentPath = "") => {
	const siblingsHaveChildren = buckets.some((bucket) => getBucketChildAgg(bucket, field));
	return buckets.map((bucket) => createFacetNode(field, bucket, context, siblingsHaveChildren, parentPath));
};
//#endregion
//#region src/components/results-panel/components/facets/components/facet-group.ts
/** Turns an aggregation field name into a heading, e.g. `category_level0` → `Category`. */
var humanizeFacetName = (field) => field.replace(/_level\d+$/, "").replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) || field;
var createFacetGroup = (field, aggregation, panelState, pathSeparator) => {
	const buckets = aggregation?.buckets || [];
	if (buckets.length === 0) return null;
	const valuesId = `stx-facet-values-${facetNodeCounter.getCounter()}`;
	const context = {
		panelState,
		pathSeparator,
		treeField: field
	};
	return html`
    <div class="stx-results-panel__facet">
      <button
        type="button"
        class="stx-results-panel__facet-toggle"
        aria-expanded="false"
        aria-controls="${valuesId}"
        id="facet-toggle-${field}"
      >
        <span class="stx-results-panel__facet-name"
          >${humanizeFacetName(field)}</span
        >
        <span
          class="stx-results-panel__facet-chevron"
          aria-hidden="true"
        ></span>
      </button>
      <div id="${valuesId}" class="stx-results-panel__facet-values" hidden>
        ${createFacetNodeList(field, buckets, context)}
      </div>
    </div>
  `;
};
//#endregion
//#region src/components/results-panel/components/facets/utils/facet-selection.ts
var addSelection = (panelState, treeField, path) => {
	const values = panelState.selectedFilters.get(treeField) ?? /* @__PURE__ */ new Set();
	values.add(path);
	panelState.selectedFilters.set(treeField, values);
};
var removeSelection = (panelState, treeField, path) => {
	const values = panelState.selectedFilters.get(treeField);
	values?.delete(path);
	if (values?.size === 0) panelState.selectedFilters.delete(treeField);
};
/**
* Drops every selection nested under `path`. Selecting a branch supersedes
* anything selected beneath it, since the branch already matches those docs.
*/
var clearDescendantSelections = (panelState, treeField, path, separator) => {
	const values = panelState.selectedFilters.get(treeField);
	if (!values) return;
	const prefix = `${path}${separator}`;
	[...values].forEach((value) => {
		if (value.startsWith(prefix)) values.delete(value);
	});
	if (values.size === 0) panelState.selectedFilters.delete(treeField);
};
var hasSelectedDescendant = (values, path, separator) => {
	if (!values) return false;
	const prefix = `${path}${separator}`;
	return [...values].some((value) => value.startsWith(prefix));
};
//#endregion
//#region src/components/results-panel/components/facets/utils/refresh-facet-states.ts
/**
* Derives every checkbox's visual state from the selected set instead of
* propagating it on click, so it stays correct across ticks, unticks and
* re-renders: a node is `checked` when its own path is selected, and
* `indeterminate` when only a path below it is. The indeterminate state is
* purely visual - it never contributes a value to the request payload.
*/
var refreshFacetStates = (facetsContainer, panelState, separator) => {
	facetsContainer.querySelectorAll(".stx-results-panel__facet-option input").forEach((element) => {
		if (!(element instanceof HTMLInputElement)) return;
		const treeField = element.dataset.facetId;
		const values = treeField ? panelState.selectedFilters.get(treeField) : void 0;
		const isChecked = values?.has(element.value) ?? false;
		element.checked = isChecked;
		element.indeterminate = !isChecked && hasSelectedDescendant(values, element.value, separator);
	});
};
//#endregion
//#region src/components/results-panel/components/facets/utils/collapse-facet-subtree.ts
/** Hides a node's whole subtree - used once a branch is selected as a whole. */
var collapseFacetSubtree = (node) => {
	node.querySelectorAll(FACET_CHILDREN_SELECTOR).forEach((panel) => {
		if (panel instanceof HTMLElement) panel.hidden = true;
	});
	node.querySelectorAll(".stx-results-panel__facet-subtoggle").forEach((toggle) => {
		toggle.setAttribute("aria-expanded", "false");
	});
};
//#endregion
//#region src/components/results-panel/components/facets/utils/roll-up-completed-parents.ts
/**
* Once every child of a parent is selected, the children are replaced by the
* parent itself: `(A OR B OR C)` becomes `(parent)`, which matches the same
* documents while keeping the payload small. Applied upwards, so a fully
* selected branch rolls up to its highest complete ancestor.
*/
var rollUpCompletedParents = (input, panelState, treeField, separator) => {
	let parentInput = findParentFacetInput(input);
	while (parentInput) {
		const parentNode = parentInput.closest(FACET_NODE_SELECTOR);
		if (!parentNode) return;
		const siblings = getChildFacetInputs(parentNode);
		const values = panelState.selectedFilters.get(treeField);
		if (!(siblings.length > 0 && siblings.every((sibling) => values?.has(sibling.value)))) return;
		clearDescendantSelections(panelState, treeField, parentInput.value, separator);
		addSelection(panelState, treeField, parentInput.value);
		collapseFacetSubtree(parentNode);
		parentInput = findParentFacetInput(parentInput);
	}
};
//#endregion
//#region src/components/results-panel/utils/serialize-filters.ts
var serializeFilters = (selectedFilters) => Object.fromEntries([...selectedFilters.entries()].map(([field, values]) => [field, [...values]]));
//#endregion
//#region src/components/results-panel/components/facets/utils/write-factets-to-url.ts
/**
* Mirrors the current facet selection into the URL via `replaceState` (no
* history entry per click), removing the param entirely when nothing is
* selected so a shared link stays clean.
*/
var writeFacetsToUrl = (paramName, selectedFilters) => {
	const url = new URL(window.location.href);
	const serialized = serializeFilters(selectedFilters);
	if (Object.keys(serialized).length > 0) url.searchParams.set(paramName, JSON.stringify(serialized));
	else url.searchParams.delete(paramName);
	window.history.replaceState({}, "", url);
};
//#endregion
//#region src/components/results-panel/components/facets/utils/getValuesPanelFromFacetGroupToggle.ts
function getValuesPanelFromFacetGroupToggle(facetGroupToggle, facetsContainer) {
	const targetId = facetGroupToggle.getAttribute("aria-controls");
	return targetId ? facetsContainer.querySelector(`#${CSS.escape(targetId)}`) : facetGroupToggle.nextElementSibling;
}
//#endregion
//#region src/components/results-panel/components/facets/utils/init-facets.ts
var initFacets = (facetsContainer, panelState, resultsPanel, results) => {
	facetsContainer.querySelectorAll(".stx-results-panel__facet-toggle, .stx-results-panel__facet-subtoggle").forEach((toggle) => {
		const valuesPanel = getValuesPanelFromFacetGroupToggle(toggle, facetsContainer);
		if (!(valuesPanel instanceof HTMLElement)) return;
		toggle.addEventListener("click", () => {
			const isExpanded = toggle.getAttribute("aria-expanded") === "true";
			toggle.setAttribute("aria-expanded", String(!isExpanded));
			valuesPanel.hidden = isExpanded;
		});
	});
	const separator = results.facetPathSeparator;
	facetsContainer.querySelectorAll(".stx-results-panel__facet-option input").forEach((input) => {
		input.addEventListener("change", (event) => {
			const checkbox = event.currentTarget;
			if (!(checkbox instanceof HTMLInputElement)) return;
			const treeField = checkbox.dataset.facetId;
			const path = checkbox.value;
			if (!treeField) return;
			if (checkbox.checked) {
				clearDescendantSelections(panelState, treeField, path, separator);
				addSelection(panelState, treeField, path);
				const node = checkbox.closest(FACET_NODE_SELECTOR);
				if (node) collapseFacetSubtree(node);
				rollUpCompletedParents(checkbox, panelState, treeField, separator);
			} else removeSelection(panelState, treeField, path);
			refreshFacetStates(facetsContainer, panelState, separator);
			writeFacetsToUrl(facetsParamName(results), panelState.selectedFilters);
			buildResultsForPage(resultsPanel, results, 1);
		});
	});
};
//#endregion
//#region src/components/results-panel/components/facets/facets.ts
/**
* Builds the facets sidebar, or `null` when the response carries no usable
* aggregations - a `GET` panel has none, and an empty `<aside>` would still
* claim its 220px column.
*/
var createFacets = (data, panelState, resultsPanel, results) => {
	const aggregations = data?.aggregations || {};
	const groups = Object.entries(aggregations).map(([field, fieldAgg]) => createFacetGroup(field, fieldAgg, panelState, results.facetPathSeparator)).filter((group) => group !== null);
	if (groups.length === 0) {
		panelState.facetsElement = null;
		return null;
	}
	const facetsContainer = html`
    <aside class="stx-results-panel__facets-container">${groups}</aside>
  `;
	initFacets(facetsContainer, panelState, resultsPanel, results);
	refreshFacetStates(facetsContainer, panelState, results.facetPathSeparator);
	panelState.facetsElement = facetsContainer;
	return facetsContainer;
};
var updateFacets = (resultsPanel, data, results, panelState) => {
	const oldFacets = resultsPanel.querySelector(".stx-results-panel__facets-container");
	const newFacets = createFacets(data, panelState, resultsPanel, results);
	preserveFacetGroupsExpandedState(newFacets, oldFacets);
	if (oldFacets && newFacets) oldFacets.replaceWith(newFacets);
	else if (oldFacets) oldFacets.remove();
	else if (newFacets) resultsPanel.prepend(newFacets);
};
function preserveFacetGroupsExpandedState(newFacetsContainer, oldFacetsContainer) {
	if (!newFacetsContainer || !oldFacetsContainer) return;
	newFacetsContainer.querySelectorAll(".stx-results-panel__facet-toggle").forEach((element) => {
		const isExpanded = oldFacetsContainer.querySelector(`button.stx-results-panel__facet-toggle#${element.id}`)?.getAttribute("aria-expanded") === "true";
		element.setAttribute("aria-expanded", `${isExpanded}`);
		const valuesPanel = getValuesPanelFromFacetGroupToggle(element, newFacetsContainer);
		if (!(valuesPanel instanceof HTMLElement)) return;
		valuesPanel.hidden = !isExpanded;
	});
}
//#endregion
//#region src/components/results-panel/components/renderers.ts
var renderDefaultLoader = () => {
	return html`
    <span>
      <svg
        class="stx-results-panel__loader"
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-dasharray="48 16"
        ></circle>
      </svg>
    </span>
  `;
};
/**
* Debug diagnostic shown when a registered renderer throws. Whether it is
* rendered at all is decided by the caller (`debugMode`); this only builds the
* markup.
*/
var renderNoItem = (item) => html`
    <div class="stx-results-panel__no-item-renderer">
      No custom renderer for type: ${item._source.type}
    </div>
  `;
/**
* Overlay shown while results refresh in place.
*
* It is absolutely positioned over the results container so the panel keeps its
* dimensions during a request instead of collapsing and reflowing the page.
*/
var renderResultsLoadingOverlay = () => {
	return html`
    <div class="stx-results-panel__loading-overlay" aria-hidden="true">
      ${renderDefaultLoader()}
    </div>
  `;
};
var renderResultsPanelError = () => {
	return html`
    <div class="stx-results-panel__error">
      <span class="stx-results-panel__error-heading">
        Something went wrong.
      </span>
      <span class="stx-results-panel__error-text">
        Please try again later
      </span>
    </div>
  `;
};
//#endregion
//#region src/components/results-panel/components/result-items.ts
var createItems = (data, renderers, debugMode) => {
	const showDebug = debugMode || config.debug;
	/** Result types with no renderer, counted so one summary is logged per render. */
	const unrendered = /* @__PURE__ */ new Map();
	const items = data.hits.hits?.map((item) => {
		const { type } = item._source;
		const rendererName = `item-${type}`;
		let itemContent;
		if (renderers[rendererName]) try {
			itemContent = renderers[rendererName](item);
		} catch (error) {
			console.error(error);
			if (!showDebug) return null;
			itemContent = renderNoItem(item);
		}
		else {
			unrendered.set(rendererName, (unrendered.get(rendererName) ?? 0) + 1);
			if (!showDebug) return null;
			itemContent = html`
          <span class="stx-results-panel__missing-renderer">
            <span>Missing renderer for "item-${item?._source?.type}"</span>
            <span>${JSON.stringify(item)}</span>
          </span>
        `;
		}
		return html`
        <li class="stx-results-panel__results-item">${itemContent}</li>
      `;
	}).filter((item) => item !== null);
	if (unrendered.size > 0) {
		const summary = [...unrendered.entries()].map(([name, count]) => `${name} (x${count})`).join(", ");
		console.warn(`[streamx-search] No renderer registered for: ${summary}.`, showDebug ? "Shown in the list as a diagnostic because debugMode is on." : "Those results were left out of the list. Register an `item-<type>` renderer, or set debugMode to show them.");
	}
	return items;
};
//#endregion
//#region src/components/results-panel/components/pagination.ts
var createPagination = (data, results, currentPage) => {
	const totalNumber = data.hits.total.value;
	const { pageSize } = results;
	const pagesCount = Math.ceil(totalNumber / pageSize);
	const paginationButtonList = [];
	let paginationStartPage = currentPage - 2;
	if (pagesCount <= 1) return "";
	if (currentPage <= 3) paginationStartPage = 1;
	else if (currentPage >= pagesCount - 2) paginationStartPage = pagesCount - 4;
	if (paginationStartPage > 1) paginationButtonList.push(html`<li class="stx-results-panel__pagination-list-item">
        <button data-page-number="1" aria-label="${results.labels.ariaPaginationGoToPage(1)}">1</a>
      </li>`);
	if (paginationStartPage > 2) paginationButtonList.push(html`<li
        class="stx-results-panel__pagination-list-item stx-results-panel__pagination-dots "
        aria-hidden="true"
      >
        ...
      </li>`);
	const paginationEndIndex = pagesCount < 5 ? pagesCount + 1 : paginationStartPage + 5;
	for (let i = paginationStartPage; i < paginationEndIndex; i++) paginationButtonList.push(html`<li class="stx-results-panel__pagination-list-item">
        <button
          data-page-number="${i}"
          class="${currentPage === i ? "stx-is-active" : ""}"
          aria-current="${currentPage === i ? "page" : null}"
          aria-label="${results.labels.ariaPaginationGoToPage(i)}"
        >
          ${i}
        </button>
      </li>`);
	if (paginationStartPage < pagesCount - 5) paginationButtonList.push(html`<li
        class="stx-results-panel__pagination-list-item stx-results-panel__pagination-dots"
        aria-hidden="true"
      >
        ...
      </li>`);
	if (paginationStartPage < pagesCount - 4) paginationButtonList.push(html` <li class="stx-results-panel__pagination-list-item">
        <button
          data-page-number="${pagesCount}"
          aria-label="${results.labels.ariaPaginationGoToPage(pagesCount)}"
        >
          ${pagesCount}
        </button>
      </li>`);
	return html`
    <nav
      aria-label="${results.labels.ariaPaginationNavigation()}"
      class="stx-results-panel__pagination-container"
    >
      <ul class="stx-results-panel__pagination-list">
        ${paginationButtonList}
      </ul>
    </nav>
  `;
};
//#endregion
//#region src/components/results-panel/components/results-header.ts
var createResultsHeader = (data, results, currentPage) => {
	const totalNumber = data.hits?.total.value || 0;
	const pageSize = results.pageSize;
	const pagesNumber = Math.ceil(totalNumber / pageSize);
	const sortOptions = createSortOptions(results.sortParam, results.labels.sortBy(), results.sortFields, results.labels.defaultSortOption());
	return html`
    <div class="stx-results-panel__results-header">
      <span class="stx-results-panel__page-number">
        ${results.labels.paginationInfo(currentPage, pagesNumber)}
      </span>
      <span class="stx-results-panel__total-number">
        ${results.labels.totalResults(totalNumber)}
      </span>
      ${sortOptions?.element}
    </div>
  `;
};
//#endregion
//#region src/components/results-panel/components/results-container.ts
var createResultsContainer = (data, results, currentPage) => {
	const items = createItems(data, results.renderers, results.debugMode);
	const resultsHeader = createResultsHeader(data, results, currentPage);
	const pagination = createPagination(data, results, currentPage);
	return {
		element: html`
      <div class="stx-results-panel__container">
        ${resultsHeader}
        <ul class="stx-results-panel__results-list">
          ${items}
        </ul>
        ${pagination}
      </div>
    `,
		pagination
	};
};
//#endregion
//#region src/components/results-panel/components/live-region.ts
var getLiveRegion = () => {
	const liveRegionEl = document.querySelector(".stx-results-panel__live-region");
	if (liveRegionEl) return liveRegionEl;
	const resultsPanelLiveRegion = html`<div
    class="stx-results-panel__live-region stx-sr-only"
    aria-live="polite"
    aria-atomic="true"
    role="status"
  ></div>`;
	document.body.append(resultsPanelLiveRegion);
	return resultsPanelLiveRegion;
};
var announceResults = (message) => {
	const statusEl = getLiveRegion();
	statusEl.textContent = "";
	requestAnimationFrame(() => {
		statusEl.textContent = message;
	});
};
//#endregion
//#region src/components/results-panel/utils/update-results-list.ts
var showResultsLoading = (resultsContainer) => {
	resultsContainer.classList.add("stx-results-panel__container--loading");
	resultsContainer.setAttribute("aria-busy", "true");
	if (!resultsContainer.querySelector(".stx-results-panel__loading-overlay")) resultsContainer.append(renderResultsLoadingOverlay());
};
var hideResultsLoading = (resultsContainer) => {
	resultsContainer.classList.remove("stx-results-panel__container--loading");
	resultsContainer.removeAttribute("aria-busy");
	resultsContainer.querySelector(".stx-results-panel__loading-overlay")?.remove();
};
var updateResultsMeta = (resultsContainer, data, results, currentPage, resultsPanel) => {
	const totalNumber = data.hits?.total.value || 0;
	const pagesNumber = Math.ceil(totalNumber / results.pageSize);
	const pageNumberEl = resultsContainer.querySelector(".stx-results-panel__page-number");
	const totalNumberEl = resultsContainer.querySelector(".stx-results-panel__total-number");
	if (pageNumberEl) pageNumberEl.textContent = results.labels.paginationInfo(currentPage, pagesNumber);
	if (totalNumberEl) totalNumberEl.textContent = results.labels.totalResults(totalNumber);
	const oldPagination = resultsContainer.querySelector(".stx-results-panel__pagination-container");
	const pagination = createPagination(data, results, currentPage);
	if (oldPagination) if (pagination instanceof HTMLElement) oldPagination.replaceWith(pagination);
	else oldPagination.remove();
	else if (pagination instanceof HTMLElement) resultsContainer.append(pagination);
	bindPagination(pagination, resultsPanel, results);
};
var updateResultsList = (resultsPanel, data, results, currentPage) => {
	const resultsContainer = resultsPanel.querySelector(".stx-results-panel__container");
	if (!(resultsContainer instanceof HTMLElement)) return;
	const listEl = resultsContainer.querySelector(".stx-results-panel__results-list");
	if (!(listEl instanceof HTMLElement)) return;
	const items = (createItems(data, results.renderers, results.debugMode) || []).flatMap((item) => item instanceof HTMLCollection ? Array.from(item) : [item]);
	listEl.replaceChildren(...items);
	updateResultsMeta(resultsContainer, data, results, currentPage, resultsPanel);
	hideResultsLoading(resultsContainer);
	announceResults(results.labels.totalResults(data.hits.total.value));
};
//#endregion
//#region src/components/results-panel/utils/build-results-request-options.ts
var buildResultsRequestOptions = (results, pageNumber, selectedFilters, query, sortBy) => {
	if (results.method !== "POST") return {};
	return {
		method: "POST",
		body: buildSearchRequestBody({
			requestId: results.requestId,
			from: (pageNumber - 1) * results.pageSize,
			size: results.pageSize,
			query,
			filters: serializeFilters(selectedFilters),
			facetDepthLevel: results.facetDepthLevel,
			facetFields: results.facetFields,
			facetFieldSize: results.facetFieldSize,
			namespace: results.namespace,
			sortBy
		})
	};
};
//#endregion
//#region src/components/results-panel/utils/build-search-url.ts
var buildSearchUrl = (results, pageNumber) => {
	const dataUrl = new URL(results.dataSources[0], window.location.href);
	dataUrl.searchParams.set("from", String((pageNumber - 1) * results.pageSize));
	dataUrl.searchParams.set("size", String(results.pageSize));
	return withNamespaceParam(dataUrl.toString(), results.namespace);
};
//#endregion
//#region src/components/results-panel/utils/build-page-results.ts
var restoreFocusForPage = () => {
	let activePage = null;
	if (document.activeElement && document.activeElement.getAttribute("data-page-number")) activePage = document.activeElement.getAttribute("data-page-number");
	return () => {
		if (activePage) {
			const btn = document.querySelector(`[data-page-number="${activePage}"`);
			if (btn instanceof HTMLButtonElement) btn.focus();
		}
	};
};
var getSearchQuery = (queryParam) => new URL(window.location.href).searchParams.get(queryParam) || "";
var getSortOption = (sortParam) => new URL(window.location.href).searchParams.get(sortParam) || "";
var bindPagination = (pagination, resultsPanel, results) => {
	if (!(pagination instanceof HTMLElement)) return;
	pagination.querySelectorAll("button[data-page-number]").forEach((btn) => {
		const pageNumber = parseInt(btn.getAttribute("data-page-number") || "0");
		btn.addEventListener("click", () => {
			buildResultsForPage(resultsPanel, results, pageNumber);
		});
	});
};
var renderFullResults = (resultsPanel, data, results, currentPage, panelState) => {
	const { element: resultsContainer, pagination } = createResultsContainer(data, results, currentPage);
	const facetsContainer = createFacets(data, panelState, resultsPanel, results);
	resultsPanel.innerHTML = "";
	resultsPanel.append(...facetsContainer ? [facetsContainer] : [], resultsContainer);
	panelState.resultsContainer = resultsContainer;
	bindPagination(pagination, resultsPanel, results);
	announceResults(results.labels.totalResults(data.hits.total.value));
};
var buildResultsForPage = (resultsPanel, results, pageNumber, options = {}) => {
	const { resetFilters = false } = options;
	const panelState = panelStates.get(resultsPanel);
	if (!panelState) return;
	const restorePageFocus = restoreFocusForPage();
	if (resetFilters) {
		panelState.selectedFilters.clear();
		writeFacetsToUrl(facetsParamName(results), panelState.selectedFilters);
	}
	panelState.currentPage = pageNumber;
	const resultsContainer = resultsPanel.querySelector(".stx-results-panel__container");
	const hasContent = resultsContainer instanceof HTMLElement;
	if (hasContent) showResultsLoading(resultsContainer);
	else {
		resultsPanel.innerHTML = "";
		resultsPanel.append(results.renderers.loader());
		panelState.facetsElement = null;
	}
	const query = getSearchQuery(results.queryParam);
	const sortBy = getSortOption(results.sortParam);
	const searchUrl = buildSearchUrl(results, pageNumber);
	const requestOptions = buildResultsRequestOptions(results, pageNumber, panelState.selectedFilters, query, sortBy);
	panelState.request?.abort();
	const controller = new AbortController();
	panelState.request = controller;
	fetchSearchResults(searchUrl, query, controller.signal, requestOptions).then((responseData) => {
		if (hasContent) {
			updateResultsList(resultsPanel, responseData, results, pageNumber);
			updateFacets(resultsPanel, responseData, results, panelState);
		} else renderFullResults(resultsPanel, responseData, results, pageNumber, panelState);
		updateSelectedSortOption(resultsPanel, sortBy);
		restorePageFocus();
	}).catch((error) => {
		if (error instanceof DOMException && error.name === "AbortError") return;
		if (hasContent) hideResultsLoading(resultsContainer);
		else {
			resultsPanel.innerHTML = "";
			resultsPanel.append(results.renderers.error(results.labels));
		}
		console.error(error);
	});
};
//#endregion
//#region src/components/results-panel/config/results-panel-config.ts
var defaultConfig = {
	pageSize: 20,
	method: "GET",
	queryParam: DEFAULT_QUERY_PARAM,
	facetDepthLevel: 1,
	facetFields: DEFAULT_FACET_FIELDS,
	facetPathSeparator: ">",
	facetFieldSize: 20,
	debugMode: false,
	renderers: {
		loader: renderDefaultLoader,
		error: renderResultsPanelError
	},
	labels: {
		paginationInfo: (currentPage, pageNumber) => `Page ${currentPage} of ${pageNumber}`,
		totalResults: (totalCount) => `${totalCount} results found`,
		ariaPaginationGoToPage: (pageNumber) => `Go to page ${pageNumber}`,
		ariaPaginationNavigation: "Pagination",
		sortBy: "Sort by:",
		defaultSortOption: "Relevance"
	},
	sortFields: ["date"],
	sortParam: DEFAULT_SORT_PARAM
};
var resolveConfig = (resultsConfig) => {
	const defaultLabels = normalizeLabels(defaultConfig.labels);
	const configLabels = resultsConfig.labels ? normalizeLabels(resultsConfig.labels) : {};
	const overrides = Object.fromEntries(Object.entries(resultsConfig).filter(([, value]) => value !== void 0));
	return {
		...defaultConfig,
		...overrides,
		dataSources: resultsConfig.dataSources,
		renderers: {
			...defaultConfig.renderers,
			...resultsConfig.renderers
		},
		labels: {
			...defaultLabels,
			...Object.fromEntries(Object.entries(configLabels).filter(([, value]) => value !== void 0))
		}
	};
};
//#endregion
//#region src/components/results-panel/components/facets/utils/read-facets-from-url.ts
/** Restores a facet selection from the URL - the deep-link/share entry point. */
var readFacetsFromUrl = (paramName) => {
	const raw = new URLSearchParams(window.location.search).get(paramName);
	const selected = /* @__PURE__ */ new Map();
	if (!raw) return selected;
	try {
		const parsed = JSON.parse(raw);
		Object.entries(parsed).forEach(([field, values]) => {
			if (Array.isArray(values)) {
				const paths = values.filter((value) => typeof value === "string");
				if (paths.length > 0) selected.set(field, new Set(paths));
			}
		});
	} catch (error) {
		console.error("Could not parse facet selection from the URL", error);
	}
	return selected;
};
//#endregion
//#region src/components/results-panel/results-panel.ts
var addOnParamChangeAction = (resultsPanel, results, paramName, keepFilters) => {
	const queryStringParam = results[paramName];
	if (typeof queryStringParam !== "string") {
		console.error(`Invalid query string param type ${typeof queryStringParam}`);
		return;
	}
	let prevQueryStringParam = new URL(window.location.href).searchParams.get(queryStringParam) || "";
	const handleUrlChange = () => {
		const searchQuery = new URLSearchParams(window.location.search).get(queryStringParam) || "";
		if (prevQueryStringParam !== searchQuery) {
			buildResultsForPage(resultsPanel, results, 1, { resetFilters: !keepFilters });
			prevQueryStringParam = searchQuery;
		}
	};
	window.addEventListener("popstate", () => {
		handleUrlChange();
	});
	onUrlChange(() => {
		handleUrlChange();
	});
};
var createResultsPanel = (resultsConfig) => {
	const results = resolveConfig(resultsConfig);
	const resultsPanel = html`
    <div class="stx-results-panel">${results.renderers.loader()}</div>
  `;
	panelStates.set(resultsPanel, {
		currentPage: 1,
		selectedFilters: readFacetsFromUrl(facetsParamName(results)),
		facetsElement: null,
		resultsContainer: null,
		request: null
	});
	try {
		buildResultsForPage(resultsPanel, results, 1);
		addOnParamChangeAction(resultsPanel, results, "queryParam");
		addOnParamChangeAction(resultsPanel, results, "sortParam", true);
		return resultsPanel;
	} catch (error) {
		console.error(error);
		return results.renderers.error(results.labels);
	}
};
//#endregion
export { createResultsPanel as t };

//# sourceMappingURL=results-panel-DEaKJofd.js.map