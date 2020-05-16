import path from "path";
import { promises as fs } from "fs";
import { Mutex, deepMerge } from "./utils.js";

export const getImportMap = ({
  pkgImportName,
  pkgRelativePath,
  pkgRelativeDir,
  pkgParent,
  ...pkg
}) => ({
  ...pkg,
  pkgImportName,
  pkgRelativePath,
  pkgRelativeDir,
  pkgParent,
  pkgImportMap: {
    imports: pkgParent ? {} : { [pkgImportName]: pkgRelativePath },
    scopes: pkgParent
      ? {
          [pkgParent.pkgRelativeDir]: {
            [pkgImportName]: pkgRelativePath,
          },
        }
      : {},
  },
});

const syncIO = new Mutex();
export const saveImportMap = async ({
  pkgImportMap,
  pkgOutputDir,
  pkgImportMapPath,
  ...pkg
}) => ({
  ...pkg,
  pkgImportMap,
  pkgOutputDir,
  pkgImportMapPath,
  pkgImportMapSaved: await syncIO
    .dispatch(() =>
      fs
        .access(pkgOutputDir)
        .catch(() => fs.mkdir(pkgOutputDir))
        .then(() =>
          fs
            .readFile(pkgImportMapPath, "utf-8")
            .then(JSON.parse)
            .catch(() => ({}))
        )
        .then((importMapJson) =>
          fs.writeFile(
            pkgImportMapPath,
            JSON.stringify(deepMerge(importMapJson, pkgImportMap))
          )
        )
    )
    .catch((err) => ({ ok: false, err }))
    .then(() => ({ ok: true, err: null })),
});

export const getImportMapDependencies = async ({
  pkgName,
  pkgTarget,
  pkgVersion,
  pkgImportMapPath,
  pkgRelativeDir,
  ...pkg
}) => {
  return [
    ...(await fs
      .readFile(pkgImportMapPath, "utf-8")
      .then(JSON.parse)
      .catch(() => ({}))
      .then(({ scopes, imports }) =>
        Object.entries(scopes[pkgRelativeDir] || {})
          .filter(
            ([dependency]) =>
              !Object.entries(scopes)
                .filter(([relativeDir]) => pkgRelativeDir !== relativeDir)
                .some(([_, deps]) =>
                  Object.keys(deps)
                    .filter((importName) =>
                      Object.keys(scopes[pkgRelativeDir]).includes(importName)
                    )
                    .includes(dependency)
                )
          )
          .filter(([pkgImportName]) =>
            !Object.keys(imports).includes(pkgImportName)
          )
          .map(([pkgImportName, pkgRelativePath]) => ({
            pkgImportName,
            pkgImportMapPath,
            pkgRelativePath,
            pkgRelativeDir: path.parse(pkgRelativePath).dir,
            pkgPath: path.join(path.resolve(), pkgRelativePath),
            pkgDir: path.join(path.resolve(), path.parse(pkgRelativePath).dir),
          }))
      )),
    {
      ...pkg,
      pkgName,
      pkgTarget,
      pkgVersion,
      pkgImportMapPath,
      pkgRelativeDir,
    },
  ];
};

export const removeImportMapDependencies = async ({
  pkgImportMapPath,
  pkgRelativePath,
  pkgRelativeDir,
  pkgImportName,
  ...pkg
}) => ({
  ...pkg,
  pkgImportMapPath,
  pkgRelativePath,
  pkgRelativeDir,
  pkgImportName,
  pkgRemovedImportMapDependencies: await syncIO.dispatch(() =>
    fs
      .readFile(pkgImportMapPath, "utf-8")
      .then(JSON.parse)
      .catch(() => ({}))
      .then(({ imports: { [pkgImportName]: _, ...imports }, scopes }) => ({
        imports,
        scopes: Object.fromEntries(
          Object.entries(scopes).filter(
            ([relativeDir, _]) =>
              console.log(relativeDir, pkgRelativeDir) ||
              relativeDir !== pkgRelativeDir
          )
        ),
      }))
      .then((importMapJson) =>
        fs
          .writeFile(pkgImportMapPath, JSON.stringify(importMapJson))
          .then(() => importMapJson)
      )
  ),
});
