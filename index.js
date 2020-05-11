#!/usr/bin/env node
import falafel from "falafel-promise";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

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
  const dependencies = [];
  await falafel(source, { sourceType: "module" }, ({ node }) => {
    const getDependencyFn = getDependencyLibrary[node.type];
    const dependency = getDependencyFn && getDependencyFn(node);
    if (dependency) dependencies.push(dependency);
  });
  return dependencies;
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
  const pkgPath = path.join(pkgDir, `${pkgName}.js`);
  return {
    ...pkg,
    pkgName,
    pkgVersion,
    pkgDir,
    pkgPath,
    pkgRelativeDir: path.join("/", path.relative(path.resolve(), pkgDir), '/'),
    pkgRelativePath: path.join("/", path.relative(path.resolve(), pkgPath)),
  };
}

async function download(getPkg, outputDir, dependency) {
  const { pkgName, pkgVersion, getSource } = await getPkg(dependency);
  const { pkgDir, pkgPath } = pkgInfo(outputDir, { pkgName, pkgVersion });

  const source = await getSource();
  const newSource = String(
    await falafel(source, { sourceType: "module" }, async ({ node, source, update }) => {
      const getDependencyFn = getDependencyLibrary[node.type];
      const dependency = getDependencyFn && getDependencyFn(node);
      if (dependency) {
        const { pkgName } = await getPkg(dependency);
        update(source().replace(dependency, pkgName));
      }
    })
  );
  await fs.promises.mkdir(pkgDir, { recursive: true });
  fs.writeFileSync(pkgPath, newSource);
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
  await fs.promises.rmdir(outputDir, { recursive: true });
  await fs.promises.mkdir(outputDir);
  Promise.all(
    dependencies.map((dependency) => installOne(outputDir, dependency))
  )
    .then((importMaps) => {
      fs.writeFileSync(
        path.join(outputDir, "import-map.json"),
        JSON.stringify(
          importMaps.reduce((importMap, { imports, scopes }) => ({
            imports: { ...importMap.imports, ...imports },
            scopes: { ...importMap.scopes, ...scopes },
          }))
        )
      );
      console.log("Success.");
    })
    .catch(console.error);
}

const getPikaPkg = (entrypoint, base = "https://cdn.pika.dev/") => {
  const pikaPkgInfo = (url) => {
    const [part1, part2] = url.split("@v");
    const [pkgVersion, _] = part2.split("-");
    const [pkgName] = part1.split("/").slice(-1);
    return { pkgVersion, pkgName };
  };

  return fetch(new URL(entrypoint, base))
    .then((response) => {
      const importurl = response.headers.get("x-import-url");
      return importurl ? fetch(new URL(importurl, base)) : response;
    })
    .then((response) => ({
      getSource: () => response.text(),
      ...pikaPkgInfo(response.url),
    }))
    .catch((err) => {
      console.error(err);
      throw Error(`Pika Package Malformed ${base}${entrypoint}`);
    });
};

const packageJsonPath = path.join(path.resolve(), "package.json");
const install = () =>
  fs.promises
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

const add = (packages) =>
  fs.promises
    .readFile(path.join(path.resolve(), "package.json"), "utf-8")
    .then((string) => JSON.parse(string))
    .then((packageJson) => {
      packageJson.webDependencies = Object.assign(
        packageJson.webDependencies ?? {},
        ...packages
      );
      packages.forEach((pkg) => console.log("Add", pkg));
      fs.promises.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2)
      );
    });

const remove = (packages) =>
  fs.promises
    .readFile(path.join(path.resolve(), "package.json"), "utf-8")
    .then((string) => JSON.parse(string))
    .then((packageJson) => {
      packages.forEach((pkgName) => {
        if (pkgName in packageJson.webDependencies) {
          delete packageJson.webDependencies[pkgName];
        }
        console.log("Remove", pkgName);
      });

      fs.promises.writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2)
      );
    });

const [command, ...packages] = process.argv.slice(2);

const actions = {
  [undefined]: install,
  install,
  remove: (packages) => remove(packages).then(install),
  add: (packages) => {
    Promise.all(
      packages.map(async (arg) => {
        const [pkgName, pkgVersion] = arg.split("@");
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

if (command in actions) {
  const action = actions[command];
  action(packages);
} else {
  console.error("Error in command. Supported: ", Object.keys(actions));
}
