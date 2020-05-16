import path from "path";
import fetch from "node-fetch";
import mem from "mem";

const unpkgFetch = mem((url, base = "https://unpkg.com/") => {
  const pkgInfo = (url) => {
    const [
      _,
      nameVersion,
      target,
    ] = /\/((?:@[^\/]*\/[^\/]*)|(?:[^@][^\/][^\/]*))\/(.*)/.exec(url);
    const [__, name, version] = /(.*)@(.*)/.exec(nameVersion);
    return { version, name, target };
  };

  return fetch(new URL(url, base))
    .then((response) => {
      const importurl = response.headers.get("x-import-url");
      return importurl ? fetch(new URL(importurl, base)) : response;
    })
    .then(async (response) => {
      return {
        source: await response.text(),
        responseUrl: response.url,
        url: new URL(url, base).href,
        ...pkgInfo(new URL(response.url).pathname),
      };
    });
});

const entrypoint = (name, target, version) =>
  version
    ? path.join(`${name}@${version}`, target ?? "")
    : path.join(name, target ?? "");

export default {
  name: "unpkg",
  entrypoint,
  resolveImport: (importValue) =>
    unpkgFetch(importValue).then(({ name, target, version }) => ({
      pkgName: name,
      pkgTarget: target,
      pkgVersion: version,
    })),
  exists: (name, target, version) =>
    unpkgFetch(entrypoint(name, target, version))
      .then(({ source }) => !source.split("\n")[0].includes("Cannot find"))
      .catch(() => false),
  version: (name, target, version) =>
    unpkgFetch(entrypoint(name, target, version)).then(
      ({ version }) => version
    ),
  source: (entrypoint) => unpkgFetch(entrypoint).then(({ source }) => source),
};
