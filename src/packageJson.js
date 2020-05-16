import { promises as fs } from "fs";
import path from "path";
import { Mutex } from "./utils.js";

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
  );

export const addToWebDependencies = ({ pkgName, pkgTarget, pkgVersion }) =>
  modifyWebDependencies((webDependencies) => ({
    ...webDependencies,
    [`${pkgName}${pkgTarget ? `/${pkgTarget}` : ""}`]: pkgVersion,
  }));

export const removeFromWebDependencies = ({ pkgName, pkgTarget }) =>
  modifyWebDependencies(
    ({
      [`${pkgName}${pkgTarget ? `/${pkgTarget}` : ""}`]: _,
      ...webDependencies
    }) => webDependencies
  );

export function getWebDependenciesPkgs() {
  syncIO.dispatch(() =>
    fs
      .readFile(packageJsonPath, "utf-8")
      .then((string) => JSON.parse(string))
      .then(({ webDependencies }) => {
        if (!webDependencies) {
          console.warn("webDependencies is missing in package.json.");
          return;
        }
        return Object.entries(webDependencies).map(
          ([pkgNameTarget, pkgVersion]) => ({
            ...splitNameTarget(pkgNameTarget),
            pkgVersion,
          })
        );
      })
  );
}
