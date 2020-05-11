# heritage
Tiny Package Manager for the Web based on the [https://github.com/WICG/import-maps](import-maps) spec.

## Use

1. Install Heritage
```bash
yarn add -D @eliaspourquoi/heritage
```

2. Manage Dependencies, feels like Yarn...
```bash
# Add Dependencies
heritage add react three

# Remove Dependencies
heritage remove react@16.13.1

# Install Dependencies
heritage       
```

3. Add the generated `import-map.json` to your `index.html`.
```html
<script type="importmap" src="web_modules/import-map.json"></script>
```

4. Optional. For now you may need to polyfill the [https://github.com/WICG/import-maps](import-maps) spec.
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

Heritage use `package.json` to register required packages under the `webDependencies` field.
The `lock` file is the generated `import-map.json` used to manage imports by the browser. 
It uses the Pika CDN for the moment, but it is planned to let you configure which registry you would like to fetch your package.

To have the command `heritage` available you need to have `yarn bin`or `npm bin` in your `PATH` like so:
```
export PATH=$(yarn bin):$PATH
```
Otherwise you need to use this command `./node_modules/.bin/heritage` from the root of your package.
