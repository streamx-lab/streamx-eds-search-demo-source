import { t as createResultsPanel } from "../search-results-panel-DLJ5VIsj.js";
import { a as readPanelOptions, i as readInputOptions, n as loadCssFile, o as replaceElWithError, s as resolveStylesheetHref, t as getEDSConfig } from "../eds-helper-BTxFq5sA.js";
//#region src/exports/eds/decorate-results-panel.ts
function decorate(block, renderers, callbacks) {
	loadCssFile(resolveStylesheetHref(import.meta.url));
	const config = getEDSConfig(block);
	block.innerHTML = "";
	if (!config.searchApiUrl) {
		replaceElWithError(block, "The <em>Results panel</em> block requires <i>searchApiUrl</i>");
		return;
	}
	const inputOptions = readInputOptions(config);
	const inputConfig = {
		searchApiUrl: config.searchApiUrl,
		...inputOptions,
		renderers,
		...callbacks
	};
	const resultsRenderers = Object.fromEntries(Object.entries(renderers || {}).filter(([, renderer]) => renderer !== void 0));
	const resultPanel = createResultsPanel(inputConfig, {
		...readPanelOptions(config),
		queryParam: inputOptions.queryParam,
		renderers: resultsRenderers
	});
	block.append(resultPanel);
}
//#endregion
export { decorate as default };

//# sourceMappingURL=search-results-panel.js.map