import { promises as fs } from "fs";
import path from "path";
import { Mutex } from "./utils.js";
import { splitNameTarget, mergeNameTarget } from "./format.js";

const packageJsonPath = path.join(path.resolve(), "package.json");

const syncIO = new Mutex();
const modifyWebDependencies = (callback) =>
  syncIO.dispatch(() =>
    fs
      .readFile(path.join(path.resolve(), "package.json"), "utf-8")
      .then((string) => JSON.parse(string))
      .then((packageJson) =>
        Object.assign(packageJson, {
          webDependencies: callback(packageJson?.webDependencies ?? {}),
        })
      )
      .then((packageJson) =>
        fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))
      )
      .then(() => true)
  );

export const addToWebDependencies = async ({
  pkgName,
  pkgTarget,
  pkgVersion,
  ...pkg
}) => ({
  ...pkg,
  pkgName,
  pkgTarget,
  pkgVersion,
  pkgAddedToPackageJsonWebDependencies: await modifyWebDependencies(
    (webDependencies) => ({
      ...webDependencies,
      [mergeNameTarget(pkgName, pkgTarget)]: pkgVersion,
    })
  ),
});

export const removeFromWebDependencies = async ({
  pkgName,
  pkgTarget,
  ...pkg
}) => ({
  ...pkg,
  pkgName,
  pkgTarget,
  pkgRemovedFromPackageJsonWebDependencies: await modifyWebDependencies(
    ({ [mergeNameTarget(pkgName, pkgTarget)]: _, ...webDependencies }) =>
      webDependencies
  ),
});

export const getWebDependenciesPkgs = async () =>
  syncIO.dispatch(() =>
    fs
      .readFile(packageJsonPath, "utf-8")
      .then((string) => JSON.parse(string))
      .then(({ webDependencies }) => {
        if (!webDependencies) {
          console.warn("webDependencies is missing in package.json.");
          return [];
        }
        return Object.entries(webDependencies).map(
          ([pkgNameTarget, pkgVersion]) => ({
            ...splitNameTarget(pkgNameTarget),
            pkgVersion,
          })
        );
      })
  );
