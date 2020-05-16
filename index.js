#!/usr/bin/env node
import {
  getPkgRegistry,
  getPkgEntrypoint,
  getPkgChildPkgs,
  getPkgChildDependenciesEntrypoints,
  getPkgLocalStorageInfo,
  getPkgResolvedVersion,
  getPkgImportName,
  getSourceFiles,
  updateSourceDependencies,
  saveSourceFiles,
  removePkgFiles,
  getPkgLocalVersion,
} from "./src/package.js";

import {
  addToWebDependencies,
  removeFromWebDependencies,
  getWebDependenciesPkgs,
} from "./src/package-json.js";

import {
  getImportMap,
  saveImportMap,
  getImportMapDependencies,
  removeImportMapDependencies,
} from "./src/import-map.js";

import { formatPkgCommand } from "./src/format.js";
import { asyncMap } from "./src/utils.js";

const install = (pkgs) =>
  asyncMap(pkgs)
    .thenMap(getPkgRegistry)
    .thenMap(getPkgEntrypoint)
    .thenMap(getPkgResolvedVersion)
    .log(({ pkgName, pkgTarget, pkgVersion, pkgRegistry: { name } }) =>
      console.log(
        `Installing ${pkgName}@${pkgVersion}${
          pkgTarget ? `/${pkgTarget}` : ""
        } from ${name} registry.`
      )
    )
    .thenMap(getPkgChildDependenciesEntrypoints)
    .thenMap(getPkgLocalStorageInfo)
    .thenFlatMap(getPkgChildPkgs)
    .thenMap(getPkgImportName)
    .thenMap(getPkgLocalStorageInfo)
    .thenMap(getImportMap)
    .thenMap(getSourceFiles)
    .thenMap(updateSourceDependencies)
    .thenMap(saveImportMap)
    .thenMap(saveSourceFiles);

function cli(command, ...pkgs) {
  const actions = {
    [undefined]: () => install(getWebDependenciesPkgs()),
    install: () => install(getWebDependenciesPkgs()),
    remove: (pkgs) =>
      asyncMap(pkgs)
        .thenMap(getPkgLocalVersion)
        .thenFilter(({ pkgName, pkgVersion }) => {
          if (pkgVersion) return true;
          else {
            console.log(`[${pkgName}] no matched version`);
            return false;
          }
        })
        .thenMap(getPkgLocalStorageInfo)
        .thenMap(getPkgImportName)
        .thenFlatMap(getImportMapDependencies)
        .thenMap(removeImportMapDependencies)
        .thenMap(removePkgFiles)
        .log(({ pkgFilesRemoved }) =>
          pkgFilesRemoved.map((file) => console.log(`Removed ${file}`))
        )
        .thenMap(removeFromWebDependencies),
    add: (pkgs) =>
      install(pkgs)
        .thenFilter(({ pkgParent }) => !pkgParent)
        .thenMap(addToWebDependencies),
  };

  if (command in actions) actions[command](pkgs?.map(formatPkgCommand));
  else console.error("Error in command. Supported: ", Object.keys(actions));
}

console.log(`Heritage Package Manager`);
cli(...process.argv.slice(2));
