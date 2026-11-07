/**
 * Debounce Hook - Vanilla JS Implementation
 * Returns a debounced version of a value
 */

export function useDebounce(value, delay = 300) {
  let timeoutId = null;
  let debouncedValue = value;

  const subscribers = new Set();

  const notify = () => {
    subscribers.forEach(cb => cb(debouncedValue));
  };

  const setValue = (newValue) => {
    value = newValue;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      debouncedValue = value;
      notify();
    }, delay);
  };

  const getValue = () => debouncedValue;

  const subscribe = (callback) => {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  };

  const destroy = () => {
    clearTimeout(timeoutId);
    subscribers.clear();
  };

  return {
    getValue,
    setValue,
    subscribe,
    destroy,
  };
}

/**
 * Debounced callback hook
 * Returns a debounced version of a callback function
 */
export function useDebouncedCallback(callback, delay = 300) {
  let timeoutId = null;
  let lastArgs = null;

  const debouncedFn = (...args) => {
    lastArgs = args;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      callback(...lastArgs);
      lastArgs = null;
    }, delay);
  };

  debouncedFn.cancel = () => {
    clearTimeout(timeoutId);
    lastArgs = null;
  };

  debouncedFn.flush = () => {
    if (lastArgs) {
      clearTimeout(timeoutId);
      callback(...lastArgs);
      lastArgs = null;
    }
  };

  debouncedFn.pending = () => lastArgs !== null;

  return debouncedFn;
}

/**
 * Throttle hook
 * Returns a throttled version of a callback
 */
export function useThrottledCallback(callback, limit = 300) {
  let inThrottle = false;
  let lastArgs = null;

  const throttledFn = (...args) => {
    if (!inThrottle) {
      callback(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          callback(...lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };

  throttledFn.cancel = () => {
    lastArgs = null;
  };

  return throttledFn;
}