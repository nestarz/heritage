#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";

import acorn from "acorn";
import fetch from "node-fetch";

const isNode = (node) => typeof node.type === "string";

const getChilds = (node) =>
  Object.keys(node)
    .filter((key) => node[key] && key !== "parent")
    .flatMap((key) => node[key])
    .filter(isNode);

function* walk({ node, parent } = {}) {
  for (const child of getChilds(node)) {
    yield* walk({ node: child, parent: node });
  }
  yield { node, parent };
}

const getDependencyLibrary = {
  ImportDeclaration: (node) =>
    node.importKind !== "type" && node?.source?.value,
  ExportNamedDeclaration: (node) => node?.source?.value,
  ExportAllDeclaration: (node) => node?.source?.value,
  CallExpression: (node) =>
    node.callee.type === "Import" &&
    node.arguments.length &&
    node.arguments[0].value,
};

async function detective(source) {
  const ast = acorn.parse(source, { sourceType: "module", ecmaVersion: 11 });
  const nodes = walk({ node: ast });

  return Array.from(nodes)
    .map(({ node }) => {
      const getDependencyFn = getDependencyLibrary[node.type];
      return getDependencyFn && getDependencyFn(node);
    })
    .filter((dependency) => dependency);
}

function resolver(getPkg) {
  const findImports = async (entrypoint) => {
    const { getSource } = await getPkg(entrypoint);
    const source = await getSource();
    return await detective(source);
  };
  return async function resolve(dependency, res = {}) {
    if (!(dependency in res)) {
      const childs = await findImports(dependency, Object.keys(res));
      res[dependency] = childs;
      await Promise.all(childs.map((dependency) => resolve(dependency, res)));
    }
    return res;
  };
}

function pkgInfo(directory, { pkgName, pkgVersion, ...pkg }) {
  const pkgDir = path.join(directory, pkgName, pkgVersion, "/");
  const pkgPath = path.join(pkgDir, `${pkgName.split("/").slice(-1)}.js`);
  return {
    ...pkg,
    pkgName,
    pkgVersion,
    pkgDir,
    pkgPath,
    pkgRelativeDir: path.join("/", path.relative(path.resolve(), pkgDir), "/"),
    pkgRelativePath: path.join("/", path.relative(path.resolve(), pkgPath)),
  };
}

async function download(getPkg, outputDir, dependency) {
  const { pkgName, pkgVersion, getSource } = await getPkg(dependency);
  const { pkgDir, pkgPath } = pkgInfo(outputDir, { pkgName, pkgVersion });

  const source = await getSource();
  const ast = acorn.parse(source, { sourceType: "module", ecmaVersion: 11 });
  const nodes = walk({ node: ast });

  const newSource = (
    await Array.from(nodes).reduce(async (chunksPromise, { node }) => {
      const chunks = await chunksPromise;
      const getDependencyFn = getDependencyLibrary[node.type];
      const dependency = getDependencyFn && getDependencyFn(node);
      if (dependency) {
        const { pkgName } = await getPkg(dependency);

        chunks[node.start] = chunks
          .slice(node.start, node.end)
          .join("")
          .replace(dependency, pkgName);
        for (let i = node.start + 1; i < node.end; i++) {
          chunks[i] = "";
        }
      }

      return chunks;
    }, Promise.resolve(source.split("")))
  ).join("");

  await fs.mkdir(pkgDir, { recursive: true });
  fs.writeFile(pkgPath, newSource);
}

async function getScope(getPkg, outputDir, [parentDependency, dependencies]) {
  const { pkgName, pkgVersion } = await getPkg(parentDependency);
  const { pkgRelativeDir } = pkgInfo(outputDir, { pkgName, pkgVersion });

  return {
    [pkgRelativeDir]: await dependencies.reduce(async (scopeP, dependency) => {
      const { pkgName, pkgVersion } = await getPkg(dependency);
      const { pkgRelativePath } = pkgInfo(outputDir, { pkgName, pkgVersion });
      (await scopeP)[pkgName] = pkgRelativePath;
      return scopeP;
    }, Promise.resolve({})),
  };
}

async function installOne(outputDir, { pkgName, pkgVersion, getPkg }) {
  const resolve = resolver(getPkg);

  const entrypoint = `./${pkgName}@v${pkgVersion}/`;
  const dependencies = await resolve([entrypoint]);
  Object.keys(dependencies).forEach((dependency) =>
    download(getPkg, outputDir, dependency)
  );

  const _getScope = (...args) => getScope(getPkg, outputDir, ...args);
  const scopes = await Promise.all(Object.entries(dependencies).map(_getScope));
  const updatedPkg = await getPkg(entrypoint);
  const { pkgRelativePath } = pkgInfo(outputDir, updatedPkg);
  console.log("Install", updatedPkg.pkgName, updatedPkg.pkgVersion);
  return {
    imports: { [pkgName]: pkgRelativePath },
    scopes: Object.assign({}, ...scopes),
  };
}

async function installAll(outputDir, dependencies) {
  await fs.rmdir(outputDir, { recursive: true });
  await fs.mkdir(outputDir);
  Promise.all(
    dependencies.map((dependency) => installOne(outputDir, dependency))
  )
    .then((importMaps) => {
      fs.writeFile(
        path.join(outputDir, "import-map.json"),
        JSON.stringify(
          importMaps.reduce(
            (importMap, { imports, scopes }) => ({
              imports: { ...importMap.imports, ...imports },
              scopes: { ...importMap.scopes, ...scopes },
            }),
            {}
          )
        )
      );
      console.log("Success.");
    })
    .catch(console.error);
}

const getPikaPkg = (entrypoint, base = "https://cdn.pika.dev/") => {
  const pikaPkgInfo = (url) => {
    const [_, pkgName, pkgVersion] = /\/-\/(.*)@v(.*)-(.*)\/(.*)/.exec(url);
    return { pkgVersion, pkgName };
  };

  return fetch(new URL(entrypoint, base))
    .then((response) => {
      const importurl = response.headers.get("x-import-url");
      return importurl ? fetch(new URL(importurl, base)) : response;
    })
    .then((response) => {
      return {
        getSource: () => response.text(),
        ...pikaPkgInfo(new URL(response.url).pathname),
      };
    })
    .catch((err) => {
      console.error(err);
      throw Error(`Pika Package Malformed ${base}${entrypoint}`);
    });
};

const packageJsonPath = path.join(path.resolve(), "package.json");
const install = () =>
  fs
    .readFile(packageJsonPath, "utf-8")
    .then((string) => JSON.parse(string))
    .then(({ webDependencies }) => {
      !webDependencies
        ? console.warn("webDependencies is missing in package.json.")
        : installAll(
            path.join(path.resolve(), "web_modules"),
            Object.entries(webDependencies).map(([pkgName, pkgVersion]) => ({
              pkgName,
              pkgVersion,
              base: "https://cdn.pika.dev/",
              getPkg: getPikaPkg,
            }))
          );
    })
    .catch(console.error);

const modifyPackageJsonWebDependencies = (callback) =>
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
    );

const add = (packages) =>
  modifyPackageJsonWebDependencies((webDependencies) =>
    Object.assign(webDependencies ?? {}, ...packages)
  );

function omit(keys, object) {
  if (!keys.length) return object;
  const { [keys.pop()]: omitted, ...rest } = object;
  return omit(keys, rest);
}

const remove = (packages) =>
  modifyPackageJsonWebDependencies((webDependencies) =>
    omit(
      packages.map(({ pkgName }) => pkgName),
      webDependencies
    )
  );

const [command, ...packages] = process.argv.slice(2);

const actions = {
  [undefined]: install,
  install,
  remove: (packages) => remove(packages).then(install),
  add: (packages) => {
    Promise.all(
      packages.map(async ({ pkgName, pkgVersion }) => {
        const entrypoint = `./${pkgName}/`;
        return {
          [pkgName]: pkgVersion ?? (await getPikaPkg(entrypoint)).pkgVersion,
        };
      })
    )
      .then(add)
      .then(install)
      .catch(console.error);
  },
};

const formatCommandPkg = (pkg) => {
  const [_, pkgName, pkgVersion] =
    !pkg.includes("@") || (pkg.startsWith("@") && pkg.match(/@/g).length === 1)
      ? [null, pkg, null]
      : /(.*)@(.*)/.exec(pkg);
  return { pkgName, pkgVersion };
};

if (command in actions) {
  const action = actions[command];
  action(packages?.map(formatCommandPkg));
} else {
  console.error("Error in command. Supported: ", Object.keys(actions));
}
