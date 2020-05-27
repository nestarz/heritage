import acorn from "acorn";

const isNode = (node) => node && typeof node.type === "string";

const getChilds = (node) =>
  Object.keys(node)
    .filter((key) => node[key] && key !== "parent")
    .flatMap((key) => node[key])
    .filter(isNode);

export function* walk({ node, parent } = {}) {
  for (const child of getChilds(node)) {
    yield* walk({ node: child, parent: node });
  }
  yield { node, parent };
}

export const walker = (source, parser = acorn, options) =>
  walk({
    node: parser.parse(source, {
      sourceType: "module",
      ecmaVersion: 11,
      ...options,
    }),
  });

export const extractImportSource = (node) => {
  const sources = {
    ImportDeclaration: (node) =>
      node.importKind !== "type" && node?.source?.value,
    ExportNamedDeclaration: (node) => node?.source?.value,
    ExportAllDeclaration: (node) => node?.source?.value,
    CallExpression: (node) =>
      node.callee.type === "Import" &&
      node.arguments.length &&
      node.arguments[0].value,
  };

  const getDependencyFn = sources[node.type];
  return getDependencyFn ? getDependencyFn(node) : null;
};

export const asyncUpdateDependencies = async (body, updateFn) => {
  const nodes = walker(body);
  return (
    await Array.from(nodes).reduce(async (chunksPromise, { node }) => {
      const chunks = await chunksPromise;
      const dependency = extractImportSource(node);
      if (dependency) {
        chunks[node.start] = chunks
          .slice(node.start, node.end)
          .join("")
          .replace(dependency, await updateFn(dependency));
        for (let i = node.start + 1; i < node.end; i++) {
          chunks[i] = "";
        }
      }

      return chunks;
    }, Promise.resolve(body.split("")))
  ).join("");
};

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

export async function detective(source) {
  const ast = acorn.parse(source, { sourceType: "module", ecmaVersion: 11 });
  const nodes = walk({ node: ast });

  return Array.from(nodes)
    .map(({ node }) => {
      const getDependencyFn = getDependencyLibrary[node.type];
      return getDependencyFn && getDependencyFn(node);
    })
    .filter((dependency) => dependency);
}

export default walker;
