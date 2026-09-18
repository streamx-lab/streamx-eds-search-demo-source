/* eslint-disable no-underscore-dangle */
import decorateResultsPanel from '../../scripts/search/eds/search-results-panel.js';
import { getHitUrl } from '../../scripts/search/streamx-search-results-panel.js';

function html(
  strings,
  ...values
) {
  const template = document.createElement('template');

  template.innerHTML = strings.reduce((acc, str, i) => {
    const val = values[i];
    if (
      val instanceof HTMLElement
        || val instanceof Array
        || val instanceof NodeList
    ) {
      return `${acc}${str}<template data-html-id="value-${i}"></template>`;
    }

    return acc + str + (val ?? '');
  }, '');

  template.content.querySelectorAll('[data-html-id]').forEach((el) => {
    const { htmlId } = el.dataset;
    if (!htmlId) return;

    const idString = htmlId.split('-')[1];
    if (!idString) return;

    const numberFromID = parseInt(idString, 10);
    const targetValue = values[numberFromID];

    if (targetValue instanceof Array) {
      el.replaceWith(...targetValue);
      return;
    }

    if (targetValue instanceof NodeList) {
      el.replaceWith(...Array.from(targetValue));
      return;
    }

    if (targetValue instanceof HTMLElement) {
      el.replaceWith(targetValue);
      return;
    }

    // eslint-disable-next-line no-console
    console.error('Case not handled for', el);
  });

  const { children } = template.content;

  return children.length === 1 ? children[0] : children;
}

function sanitizeSuggestionContent(content) {
  const raw = Array.isArray(content) ? content.join(' ') : content;

  return (raw ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const suggestionItem = (item) => {
  const { title } = item._source.payload ?? {};
  const content = item.highlight?.['payload.content'];

  return html`
        <a href="${getHitUrl(item)}" class="stx-suggestion__item custom-suggestion-item-render">
          <span class="custom-suggestion-item-render__title">${title ?? ''}</span>
          <span class="custom-suggestion-item-render__content">${sanitizeSuggestionContent(content)}</span>
        </a>
      `;
};

export const renderers = {
  'item-page/eds': (item) => {
    const { title, fields } = item._source.payload;
    const { author, date, description } = fields ?? {};
    const href = item._id.replace(/^\//, '');

    return html`
        <article class="custom-result-item-render">
          <div class="custom-result-item-render__header">
            <a class="custom-result-item-render__title" href="${href}">${title}</a>
          </div>
          <p class="custom-result-item-render__excerpt">${description}</p>
          <div class="custom-result-item-render__meta">
            ${author ? `<span>${author}</span>` : ''}
            ${date ? `<span>${date}</span>` : ''}
          </div>
        </article>
      `;
  },
  suggestionItem,
};

const callbacks = {
  suggestionItemSubmitValue: (item) => {
    const suggestionElement = item.closest('.custom-suggestion-item-render') ?? item;

    return suggestionElement.querySelector('.custom-suggestion-item-render__title')?.textContent ?? '';
  },
};

export default function decorate(block) {
  decorateResultsPanel(block, renderers, callbacks);
}
