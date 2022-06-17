const ELEMENT_RE = /[\w-]+/g;
const ID_RE = /#[\w-]+/g;
const CLASS_RE = /\.[\w-]+/g;
const ATTR_RE = /\[[^\]]+\]/g;
const PSEUDO_CLASSES_RE = /\:(?!not)[\w-]+(\(.*\))?/g;
const PSEUDO_ELEMENTS_RE =
  /\:\:?(after|before|first-letter|first-line|selection)/g;

// convert an array-like object to array
function toArray(list: any) {
  return [].slice.call(list);
}

// handles extraction of `cssRules` as an `Array` from a stylesheet or something that behaves the same
function getSheetRules(stylesheet: CSSStyleSheet) {
  var sheet_media = stylesheet.media && stylesheet.media.mediaText;
  // if this sheet is disabled skip it
  if (stylesheet.disabled) return [];
  // if this sheet's media is specified and doesn't match the viewport then skip it
  if (
    sheet_media &&
    sheet_media.length &&
    !window.matchMedia(sheet_media).matches
  )
    return [];
  // get the style rules of this sheet
  try {
    return toArray(stylesheet.cssRules);
  } catch {
    return [];
  }
}

function _find(string: string, re: RegExp) {
  var matches = string.match(re);
  return matches ? matches.length : 0;
}

// calculates the specificity of a given `selector`
function calculateScore(selector: string) {
  var score = [0, 0, 0],
    parts = selector.split(" "),
    part,
    match;
  //TODO: clean the ':not' part since the last ELEMENT_RE will pick it up
  while (((part = parts.shift()), typeof part == "string")) {
    // find all pseudo-elements
    match = _find(part, PSEUDO_ELEMENTS_RE);
    score[2] += match;
    // and remove them
    match && (part = part.replace(PSEUDO_ELEMENTS_RE, ""));
    // find all pseudo-classes
    match = _find(part, PSEUDO_CLASSES_RE);
    score[1] += match;
    // and remove them
    match && (part = part.replace(PSEUDO_CLASSES_RE, ""));
    // find all attributes
    match = _find(part, ATTR_RE);
    score[1] += match;
    // and remove them
    match && (part = part.replace(ATTR_RE, ""));
    // find all IDs
    match = _find(part, ID_RE);
    score[0] += match;
    // and remove them
    match && (part = part.replace(ID_RE, ""));
    // find all classes
    match = _find(part, CLASS_RE);
    score[1] += match;
    // and remove them
    match && (part = part.replace(CLASS_RE, ""));
    // find all elements
    score[2] += _find(part, ELEMENT_RE);
  }
  return parseInt(score.join(""), 10);
}

// returns the heights possible specificity score an element can get from a give rule's selectorText
function getSpecificityScore(element: HTMLElement, selectorText: string) {
  var selectors = selectorText.split(","),
    selector,
    score,
    result = 0;

  while ((selector = selectors.shift())) {
    if (element.matches(selector)) {
      score = calculateScore(selector);
      result = score > result ? score : result;
    }
  }

  return result;
}

function sortBySpecificity(element: HTMLElement, rules: CSSStyleRule[]) {
  // comparing function that sorts CSSStyleRules according to specificity of their `selectorText`
  function compareSpecificity(a: CSSStyleRule, b: CSSStyleRule) {
    let aScore = getSpecificityScore(element, a.selectorText);
    let bScore = getSpecificityScore(element, b.selectorText);

    // If the styles come from app.css, they take a lower priority
    if (aScore === bScore) {
      if (a.parentStyleSheet.href) aScore -= 1;
      if (b.parentStyleSheet.href) bScore -= 1;
    }

    return aScore - bScore;
  }

  return rules.sort(compareSpecificity);
}

export function getMatchedCSSRules(element: HTMLElement): CSSStyleRule[] {
  let styleSheets = toArray(window.document.styleSheets);
  let sheet;
  let rules;
  let rule;
  let result: CSSStyleRule[] = [];

  // assuming the browser hands us stylesheets in order of appearance
  // we iterate them from the beginning to follow proper cascade order
  while ((sheet = styleSheets.shift())) {
    // get the style rules of this sheet
    rules = getSheetRules(sheet);
    // loop the rules in order of appearance
    while ((rule = rules.shift())) {
      // if this is an @import rule
      if (rule.styleSheet) {
        // insert the imported stylesheet's rules at the beginning of this stylesheet's rules
        rules = getSheetRules(rule.styleSheet).concat(rules);
        // and skip this rule
        continue;
      }
      // if there's no stylesheet attribute BUT there IS a media attribute it's a media rule
      else if (rule.media) {
        // insert the contained rules of this media rule to the beginning of this stylesheet's rules
        rules = getSheetRules(rule).concat(rules);
        // and skip it
        continue;
      }

      // check if this element matches this rule's selector
      if (rule.selectorText && element.matches(rule.selectorText)) {
        // push the rule to the results set
        result.push(rule);
      }
    }
  }
  // sort according to specificity
  return sortBySpecificity(element, result);
}
