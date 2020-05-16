import path from "path";
import fetch from "node-fetch";
import { mem } from "../utils.js";

const pikaFetch = mem((url, base = "https://cdn.pika.dev/") => {
  const pikaPkgInfo = (url) => {
    const [_, name, version] = /\/-\/(.*)@v(.*)-(.*)\/(.*)/.exec(url);
    const [target] = url.split("/").slice(-1);
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
        ...pikaPkgInfo(new URL(response.url).pathname),
      };
    });
});

const entrypoint = (name, target, version) =>
  version
    ? path.join(`${name}@v${version}`, target ?? "")
    : path.join(name, target ?? "");

export default {
  name: "pika",
  entrypoint,
  resolveImport: (importValue) =>
    pikaFetch(importValue).then(({ name, target, version }) => ({
      pkgName: name,
      pkgTarget: target,
      pkgVersion: version,
    })),
  exists: (name, target, version) =>
    pikaFetch(entrypoint(name, target, version))
      .then(({ source }) => {
        const firstLine = source.split("\n")[0];
        const error =
          firstLine.includes("Not Found") || firstLine.includes("Error:");
        return !error;
      })
      .catch(() => false),
  version: (name, target, version) =>
    pikaFetch(entrypoint(name, target, version)).then(({ version }) => version),
  source: (entrypoint) => pikaFetch(entrypoint).then(({ source }) => source),
};
