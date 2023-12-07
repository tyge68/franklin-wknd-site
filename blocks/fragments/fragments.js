import { getMetadata } from '../../scripts/aem.js';

/*
 * Fragment Block
 * Include content on a page as a fragment.
 * https://www.aem.live/developer/block-collection/fragment
 */

const serviceBaseURL = 'https://txw6tavv82.execute-api.us-east-1.amazonaws.com/helix-services/fragment-ingestor/1.5.1';
const baseAEM = 'https://publish-p91957-e809713.adobeaemcloud.com';
const DEFAULT_LIMIT = 10;

function isFloat(value) {
  return typeof value === 'number' && Number.isFinite(value) && value % 1 !== 0;
}

function isString(value) {
  return typeof value === 'string';
}
function toDefinitionMap(definitions) {
  const map = {};
  definitions.data.forEach(r => {
    const { name, type, multiple } = r;
    map[name] = {
      name,
      type,
      multiple: multiple === 'true',
    }
  });
  return map;
}

function toMap(field, definitionsMap) {
  const mapped = {};
  for (const [key, value] of Object.entries(field)){
    let finalValue;
    const type = definitionsMap[key]?.type;
    if (type === 'content-reference') {
      finalValue = `<img src='${baseAEM}${value}'>`;
    } else {
      finalValue = value;
    }
    mapped[key] = finalValue;
  };
  return mapped;
}

function hasMore(fragments) {
  const nextOffset = fragments.limit + fragments.offset;
  return nextOffset < fragments.total;
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
export async function loadFragments(query, offset) {
  const queryURI = query ? `&query=${encodeURI(JSON.stringify(query))}` : "";
  const opts = {
    headers: {
      'Franklin-Tenant': window.localStorage.getItem('franklin-tenant'),
      'Franklin-Mode': window.localStorage.getItem('franklin-preview'),
      'x-edge-authorization': window.localStorage.getItem('franklin-auth'),
    },
  };
  const params = offset ? `&offset=${offset}` : '';
  const resp = await fetch(`${serviceBaseURL}/shon/27485d254823d8cfe0d971c28490886a766642678d4ccd1ca93d502501d74582/l2nvbmyvd2tuzc1zagfyzwqvc2v0dgluz3mvzgftl2nmbs9tb2rlbhmvywr2zw50dxjl.json?limit=${DEFAULT_LIMIT}${params}${queryURI}`, opts);
  if (resp.ok) {
    return resp.json();
  }
  return null;
}

function parseOptions(options) {
  const opts = {};
  const ops = options.split(',');
  ops.forEach((op) => {
    const [key, value] = op.trim().split('=');
    opts[key.trim()] = decodeURI(value);
  });
  return opts;
}

export default async function decorate(block) {
  const fragmentsMeta = getMetadata('fragments');
  let query;
  const cardsContainer = document.createElement('div');
  cardsContainer.classList.add('cards');

  let currentOffset = 0;

  const previous = document.createElement('div');
  previous.classList.add('prev');
  previous.innerText = '<-';
  previous.onclick = () => {
    currentOffset = currentOffset - DEFAULT_LIMIT;
    loadFragments(query, currentOffset).then((fragments) => updateContent(fragments));
  }
  const next = document.createElement('div');
  next.classList.add('next');
  next.innerText = '->';
  next.onclick = () => {
    currentOffset = currentOffset + DEFAULT_LIMIT;
    loadFragments(query, currentOffset).then((fragments) => updateContent(fragments));
  }

  const nav = document.createElement('div');
  nav.classList.add('nav');
  nav.append(previous, next);
  const queryfield = document.createElement('textarea');
  const queryapply = document.createElement('button');
  queryapply.innerText = "Apply";
  queryapply.onclick = () => {
   currentOffset = 0;
   try {
    query = JSON.parse(queryfield.value);
    loadFragments(query, currentOffset).then((fragments) => updateContent(fragments));
   } catch(err) {
    console.error(err);
   }
  }
  const querybox = document.createElement('div');
  querybox.classList.add('querybox');
  querybox.append(queryfield);
  querybox.append(queryapply);

  const options = parseOptions(block.children[0].children[0].innerHTML);
  const template = block.children[1].innerHTML;
  function updateContent(results) {
    const cards = [];
    const { fragments, definitions } = results;
    if (fragments) {
      const definitionsMap = toDefinitionMap(definitions);
      fragments.data.forEach( (field, count) => {
        const div = document.createElement('div');
        div.innerHTML = replaceAny(template, toMap(field, definitionsMap));
        div.classList.add('card');
        if (count % 4 === 0) {
          div.classList.add('break');
        }
        cards.push(div);
      });
    }
    if (currentOffset > 0) {
      previous.style.display = "block";
    } else {
      previous.style.display = "none";
    }
    if (hasMore(fragments)) {
      next.style.display = "block";
    } else {
      next.style.display = "none";
    }
    cardsContainer.innerText = '';
    cardsContainer.append(...cards); 
  }
  try {
    updateContent(await loadFragments(query));
  } catch (err) {
    console.error(err);
  }
  block.innerText = '';
  block.append(nav);
  block.append(cardsContainer);
  block.append(querybox);
}
