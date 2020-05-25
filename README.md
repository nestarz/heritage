# heritage
Tiny Package Manager for the Web based on the [WICG/import-maps](https://github.com/WICG/import-maps) spec. No lock-in.

- Depends only on **two** packages, `acorn` for AST parsing and  `node-fetch` to request packages.
- Customize to any registry, CDN or filesystems... It's up to you
- Default to Pika and Unpkg registries
- Only retrive ES6 browser compatible assets and modules
- TypeScript definition resolution can be achieve using yarn/npm
- Easy-to-use

## Use

1. Install Heritage
```bash
yarn add -D @eliaspourquoi/heritage
```

2. Manage Dependencies, feels like Yarn...
```bash
# Add Dependencies
heritage add three three/examples/jsm/loaders/GLTFLoader.js vue@3.0.0-beta.10 react react-dom es-module-shims

# Remove Dependencies
heritage remove vue

# Install Dependencies
heritage       
```

3. Add the generated `import-map.json` to your `index.html`.
```html
<script type="importmap" src="web_modules/import-map.json"></script>
```

4. Optional. For now you may need to polyfill the [WICG/import-maps](https://github.com/WICG/import-maps) spec.
Here a working example:
```bash
heritage add es-module-shims
```
```html
<script defer src="web_modules/es-module-shims/0.4.6/es-module-shims.js"></script>
<script type="importmap-shim" src="web_modules/import-map.json"></script>
<script type="module-shim">
  import React from "react"; // If you have installed react for example...
</script>
```

That's all.

## Information

Heritage use `package.json` to register required packages under the `webDependencies` field, exactly like Snowpack.
The `lock` file is the generated `import-map.json` used to manage imports by the browser. Default use of the the Pika CDN and fallback to Unpkg if target not found.

To have the command `heritage` available you need to have `yarn bin`or `npm bin` in your `PATH` like so:
```
export PATH=$(yarn bin):$PATH
```
Otherwise you need to use this command `./node_modules/.bin/heritage` from the root of your package.


## Custom Registry
Place a `heritage.config.js` at the root of your project using this API: 

```js
module.exports = [{
  registryName<String>,
  entrypoint<Function>: (name: String, target: String, version: String) => String,
  resolveImport<Function>: (importValue: String) => <Object {
    pkgName<String>,
    pkgTarget<String>,
    pkgVersion<String>,
  }>,
  exists<Function>: (name: String, target: String, version: String) => <Boolean>,
  version<Function>: (name: String, target: String, version: String) => <String>,
  source<Function>: (entrypoint: String) => <String>,
 },
 ...
];
```
You can see the Pika Registry Resolver here https://github.com/nestarz/heritage/blob/master/src/registries/pika.js
