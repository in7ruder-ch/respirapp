// /lib/debounce.js
export function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// También como default para tolerar imports por default
export default debounce;
