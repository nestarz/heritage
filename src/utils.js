import readline from "readline";

export class Mutex {
  mutex = Promise.resolve();
  lock() {
    let begin = () => {};
    this.mutex = this.mutex.then(() => {
      return new Promise(begin);
    });
    return new Promise((res) => {
      begin = res;
    });
  }
  async dispatch(fn) {
    const unlock = await this.lock();
    try {
      return await Promise.resolve(fn());
    } finally {
      unlock();
    }
  }
}

export function deepMerge(...sources) {
  let acc = {};
  for (const source of sources) {
    if (source instanceof Array) {
      if (!(acc instanceof Array)) {
        acc = [];
      }
      acc = [...acc, ...source];
    } else if (source instanceof Object) {
      for (let [key, value] of Object.entries(source)) {
        if (value instanceof Object && key in acc) {
          value = deepMerge(acc[key], value);
        }
        acc = { ...acc, [key]: value };
      }
    }
  }
  return acc;
}

export async function findAsync(arr, asyncCallback) {
  for (const iterator of arr) {
    const result = await asyncCallback(iterator);
    if (result) return iterator;
  }
}

const hideSource = (pkg) => ({
  ...pkg,
  pkgSource: !!pkg.pkgSource,
  pkgChildPkgs: pkg.pkgChildPkgs
    ? pkg.pkgChildPkgs.map(hideSource)
    : pkg.pkgChildPkgs,
});

export const asyncMap = (value) => ({
  value: Promise.resolve(value),
  thenMap: (morphism) =>
    asyncMap(
      Promise.resolve(value).then((items) => Promise.all(items.map(morphism)))
    ),
  thenFlatMap: (morphism) =>
    asyncMap(
      Promise.resolve(value)
        .then((items) => Promise.all(items.flat().map(morphism)))
        .then((items) => items.flat())
    ),
  thenFilter: (callback) =>
    asyncMap(Promise.resolve(value).then((items) => items.filter(callback))),
  log: (callback) =>
    asyncMap(
      Promise.resolve(value).then((items) =>
        items.map((value) => {
          (callback ?? console.log)(hideSource({ ...value }));
          return value;
        })
      )
    ),
});

export const userInput = async (choices) => {
  const ui = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("Select a version [Yn]:");
  return new Promise((resolve) => {
    for (const choice of choices) {
      ui.question(`> ${choice}`, (input) => {
        if (!input.includes("n")) {
          ui.close();
          resolve(input);
        }
      });
    }
  });
};

export const mem = (fn) => {
  let cache = {};
  let key;
  return (...args) => {
    key = JSON.stringify(args);
    return cache[key] || (cache[key] = fn.call(null, ...args));
  };
};
