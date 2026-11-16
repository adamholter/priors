/**
 * Browser page translation (Chrome's built-in translate, for zh, ko, ru readers) swaps the text nodes React rendered for its
 * own, so React's next update removes or inserts beside a node that is no longer there and the page falls to the error
 * screen: "Failed to execute 'removeChild' on 'Node'" (PostHog, Nov 7-14, 2026: 5 users on /rank, /builder, a profile and a
 * benchmark page). The usual guard (facebook/react#11538): skip the move when the node has already been moved, instead of
 * throwing. Inline in <head>, so it is in place before React hydrates. Each skip fires `priors:dom-guard` for analytics.
 */
export const DOM_GUARD_SCRIPT = `(function(){if(typeof Node!=="function"||!Node.prototype)return;var P=Node.prototype,rc=P.removeChild,ib=P.insertBefore;function hit(){try{window.dispatchEvent(new Event("priors:dom-guard"))}catch(e){}}P.removeChild=function(c){if(c&&c.parentNode!==this){hit();return c}return rc.apply(this,arguments)};P.insertBefore=function(n,r){if(r&&r.parentNode!==this){hit();return n}return ib.apply(this,arguments)}})();`;
