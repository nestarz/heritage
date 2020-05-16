import { promises as fs } from "fs";
import path from "path";

import { mem, userInput, findAsync, Mutex } from "./utils.js";
import { asyncUpdateDependencies } from "./walker.js";

import pikaRegistry from "./registries/pika.js";
import unpkgRegistry from "./registries/unpkg.js";
import resolver from "./resolver.js";

export const getPkgOutputDir = (pkg) => ({
  ...pkg,
});

export const getPkgRegistry = async ({
  pkgName,
  pkgTarget,
  pkgVersion,
  ...pkg
}) => ({
  ...pkg,
  pkgName,
  pkgTarget,
  pkgVersion,
  pkgRegistry: Object.fromEntries(
    Object.entries(
      await findAsync([pikaRegistry, unpkgRegistry], (registry) =>
        registry.exists(pkgName, pkgTarget, pkgVersion)
      )
    ).map(([key, value]) => [
      key,
      typeof value === "function" ? mem(value) : value,
    ])
  ),
});

export const getPkgResolvedVersion = async ({
  pkgName,
  pkgTarget,
  pkgVersion,
  pkgRegistry,
  ...pkg
}) => {
  return {
    ...pkg,
    pkgName,
    pkgTarget,
    pkgVersion,
    pkgRegistry,
    pkgVersion: await pkgRegistry.version(pkgName, pkgTarget, pkgVersion),
  };
};

export const getPkgImportName = ({ pkgName, pkgTarget, ...pkg }) => {
  return {
    ...pkg,
    pkgName,
    pkgTarget,
    pkgImportName:
      pkgTarget && path.parse(pkgTarget).name != pkgName
        ? path.join(pkgName, pkgTarget)
        : pkgName,
  };
};

export const getPkgLocalStorageInfo = async ({
  pkgName,
  pkgTarget,
  pkgVersion,
  ...pkg
}) => {
  const pkgOutputDir = path.join(path.resolve(), "web_modules");
  const pkgDir = path.join(pkgOutputDir, pkgName, pkgVersion, "/");
  const pkgPath = path.join(
    pkgDir,
    `${pkgTarget ? path.parse(pkgTarget).name : path.parse(pkgName).name}.js`
  );
  return {
    ...pkg,
    pkgOutputDir,
    pkgName,
    pkgTarget,
    pkgVersion,
    pkgImportMapPath: path.join(pkgOutputDir, "import-map.json"),
    pkgDir,
    pkgPath,
    pkgRelativeDir: path.join("/", path.relative(path.resolve(), pkgDir), "/"),
    pkgRelativePath: path.join("/", path.relative(path.resolve(), pkgPath)),
  };
};

export const getPkgEntrypoint = async ({
  pkgName,
  pkgTarget,
  pkgVersion,
  pkgRegistry,
  ...pkg
}) => ({
  ...pkg,
  pkgName,
  pkgTarget,
  pkgVersion,
  pkgRegistry,
  pkgEntrypoint: await pkgRegistry.entrypoint(pkgName, pkgTarget, pkgVersion),
});

export const getPkgChildDependenciesEntrypoints = async ({
  pkgRegistry,
  pkgEntrypoint,
  ...pkg
}) => ({
  ...pkg,
  pkgRegistry,
  pkgEntrypoint,
  pkgChildDependenciesEntrypoints: await resolver(pkgRegistry.source)(
    pkgEntrypoint
  ),
});

export const getPkgChildPkgs = async ({
  pkgRegistry,
  pkgChildDependenciesEntrypoints,
  ...pkg
}) => {
  const pkgParent = { pkgRegistry, pkgChildDependenciesEntrypoints, ...pkg };
  return [
    pkgParent,
    ...(
      await Promise.all(
        Object.entries(pkgChildDependenciesEntrypoints).map(
          async ([pkgEntrypoint, childEntrypoints]) => [
            {
              pkgParent,
              pkgRegistry,
              pkgEntrypoint,
              ...(await pkgRegistry.resolveImport(pkgEntrypoint)),
            },
            ...(await Promise.all(
              childEntrypoints.map(async (pkgEntrypoint) => ({
                pkgParent,
                pkgRegistry,
                pkgEntrypoint,
                ...(await pkgRegistry.resolveImport(pkgEntrypoint)),
              }))
            )),
          ]
        )
      )
    ).flat(),
  ];
};

export const getSourceFiles = async ({
  pkgRegistry,
  pkgEntrypoint,
  ...pkg
}) => ({
  ...pkg,
  pkgRegistry,
  pkgSource: await pkgRegistry.source(pkgEntrypoint),
});

const syncIO = new Mutex();
export const saveSourceFiles = async ({
  pkgSource,
  pkgDir,
  pkgPath,
  ...pkg
}) => ({
  ...pkg,
  pkgSource,
  pkgDir,
  pkgPath,
  pkgSourceSaved: syncIO.dispatch(() =>
    fs
      .access(pkgDir)
      .catch(() => fs.mkdir(pkgDir, { recursive: true }))
      .then(async () => fs.writeFile(pkgPath, pkgSource))
      .catch((err) => console.log(err))
      .then(() => true)
  ),
});

export const updateSourceDependencies = async ({
  pkgSource,
  pkgRegistry,
  ...pkg
}) => ({
  ...pkg,
  pkgSource: await asyncUpdateDependencies(
    pkgSource,
    async (dependency) =>
      getPkgImportName(await pkgRegistry.resolveImport(dependency))
        .pkgImportName
  ),
});

export const getPkgLocalVersion = async ({ pkgName, pkgTarget, ...pkg }) => ({
  ...pkg,
  pkgName,
  pkgTarget,
  pkgVersion: await fs
    .readdir(path.join(path.resolve(), "web_modules", pkgName))
    .then(() =>
      fs.readdir(path.join(path.resolve(), "web_modules", pkgName), {
        withFileTypes: true,
      })
    )
    .catch(() => [])
    .then((files) =>
      files.filter((dirent) => dirent.isDirectory()).map(({ name }) => name)
    )
    .then(async (directories) =>
      directories.length === 0
        ? null
        : directories.length === 1
        ? directories[0]
        : await userInput(directories)
    ),
});

const rmEmptyParentDirectories = (directory, max = path.resolve()) =>
  fs.readdir(directory).then(async ({ length }) => {
    if (length === 0) {
      await fs.rmdir(directory);
      const toRemove = path.join(max, path.relative(max, directory), "..");
      const removed = await rmEmptyParentDirectories(toRemove);
      return [...removed, directory];
    }
    return [];
  });
  
export const removePkgFiles = async ({ pkgPath, pkgDir, ...pkg }) => ({
  ...pkg,
  pkgPath,
  pkgDir,
  pkgFilesRemoved: await syncIO.dispatch(() =>
    fs.unlink(pkgPath).then(() => rmEmptyParentDirectories(pkgDir)).catch(() => [])
  ),
});
