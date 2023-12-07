import { getMetadata } from '../../scripts/aem.js';

/*
 * Fragment Block
 * Include content on a page as a fragment.
 * https://www.aem.live/developer/block-collection/fragment
 */

const serviceBaseURL = 'https://txw6tavv82.execute-api.us-east-1.amazonaws.com/helix-services/fragment-ingestor/1.5.1';
const baseAEM = 'https://publish-p125807-e1234337.adobeaemcloud.com';

function isFloat(value) {
  return typeof value === 'number' && Number.isFinite(value) && value % 1 !== 0;
}

function isString(value) {
  return typeof value === 'string';
}

function toShon(fields) {
  const mapped = {};
  fields.forEach(f => {
    const { name, values } = f;
    let finalValue;
    if (f.type === 'content-reference') {
      finalValue = `<img src='${baseAEM}${values[0]}'>`;
    } else {
      finalValue = values ? values[0]:null;
    }
    mapped[name] = finalValue;
  }) 
  return mapped;
}

function replaceAny(template, mapping) {
  // Use a regular expression to find all occurrences of <property> in the template
  const regex = /(&lt;[a-zA-Z0-9_]*&gt;)/g;

  // Use the `replace` method with a callback function to replace the placeholders
  const replacedTemplate = template.replace(regex, (match, property) => {
    // Check if the property exists in the object, and use it as a replacement if found
    const placeholder = property.substring(4, property.length - 4);
    if (mapping.hasOwnProperty(placeholder)) {
      const value = mapping[placeholder];
      if (isFloat(value)) {
        return value.toFixed(2);
      } if (isString(value)) {
        return value.replace(/\n/g, '<br>');
      }
      return value;
    }
    // If the property doesn't exist in the object, leave the placeholder as is
    return match;
  });

  return replacedTemplate;
}

/**
 * Load fragments.
 * @param {string} path The path to the fragment
 * @returns {HTMLElement} The root element of the fragment
 */
export async function loadFragments(query, cursor) {
  if (query && query.filter) {
    const queryURI = encodeURI(JSON.stringify(query));
    const opts = {
      headers: {
        'Franklin-Tenant': window.localStorage.getItem('franklin-tenant'),
        'Franklin-Mode': window.localStorage.getItem('franklin-preview'),
        'x-edge-authorization': window.localStorage.getItem('franklin-auth'),
      },
    };
    const cursorParam = cursor ? `cursor=${cursor}` : '';
    const resp = await fetch(`${serviceBaseURL}/fragments/search?query=${queryURI}&${cursorParam}`, opts);
    if (resp.ok) {
      const result = await resp.json();
      return result.items;
    }
  }
  return null;
}

export default async function decorate(block) {
  const fragmentsMeta = getMetadata('fragments');
  const query = {
    filter: {
      path: '/content/dam/wknd-shared',
      modelIds: ['L2NvbmYvd2tuZC1zaGFyZWQvc2V0dGluZ3MvZGFtL2NmbS9tb2RlbHMvYWR2ZW50dXJl'],
    },
  };
  const cardsContainer = document.createElement('div');
  cardsContainer.classList.add('cards');

  const cursorStack = [];

  const previous = document.createElement('div');
  previous.classList.add('prev');
  previous.innerText = '<-';
  previous.onclick = () => {
    cursorStack.pop();
    const prevCursor = cursorStack.length > 0 ? cursorStack[cursorStack.length - 1] : null;
    loadFragments(query, prevCursor).then((fragments) => updateContent(fragments));
  }
  const next = document.createElement('div');
  next.classList.add('next');
  next.innerText = '->';
  next.onclick = () => {
    const nextCursor = cursorStack[cursorStack.length - 1];
    loadFragments(query, nextCursor).then((fragments) => updateContent(fragments));
  }

  const nav = document.createElement('div');
  nav.classList.add('nav');
  nav.append(previous, next);

  const template = block.innerHTML;
  function updateContent(fragments) {
    const cards = [];
    if (fragments) {
      fragments.forEach( (f, count) => {
        const div = document.createElement('div');
        div.innerHTML = replaceAny(template, toShon(f.fields));
        div.classList.add('card');
        if (count % 4 === 0) {
          div.classList.add('break');
        }
        cards.push(div);
      });
    }
    if (cursorStack.length > 0) {
      previous.style.display = "block";
    } else {
      previous.style.display = "none";
    }
    if (fragments.length === 10) {
      cursorStack.push(fragments[fragments.length - 1].id);
      next.style.display = "block";
    } else {
      next.style.display = "none";
    }
    cardsContainer.innerText = '';
    cardsContainer.append(...cards); 
  }
  updateContent(await loadFragments(query));
  block.innerText = '';
  block.append(nav);
  block.append(cardsContainer);
}
