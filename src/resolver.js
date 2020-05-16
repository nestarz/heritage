import path from "path";

import { detective } from "./walker.js";

export default function resolver(getSource) {
  const findImports = async (dependency) => {
    const pkgSource = await getSource(dependency);
    return (await detective(pkgSource)).map((childDependency) =>
      childDependency.startsWith(".")
        ? path.join(dependency, "..", childDependency)
        : childDependency
    );
  };
  return async function resolve(start, dependency, res = {}) {
    if (!(dependency in res) || start) {
      const childs = await findImports(start || dependency);
      if (dependency) res[dependency] = childs;
      await Promise.all(
        childs.map((dependency) => resolve(null, dependency, res))
      );
    }
    return res;
  };
}
