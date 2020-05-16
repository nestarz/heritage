const clist = async () => [await 1, await 2, 3]
const addOne = async x => await x + 1;
asyncMap(Promise.resolve(clist())).thenMap(addOne).thenMap(addOne).thenMap(addOne).value.then(console.log);

const clist = async () => [await 1, await 2, [100, 3]];
const addOne = async (x) => (await x) + 1;
asyncMap(Promise.resolve(clist()))
  .thenFlatMap(addOne)
  .thenFlatMap(addOne)
  .thenFlatMap(addOne)
  .value.then(console.log);
