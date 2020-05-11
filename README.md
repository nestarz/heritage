# heritage
ES 2020 Tiny Package Manager for the Web.

## Use

1. Install Heritage
```bash
yarn add -D @eliaspourquoi/heritage
```

3. Manage Dependencies, like Yarn and NPM...
```bash
# Add Dependencies
./node_modules/.bin/heritage add react three

# Remove Dependencies
./node_modules/.bin/heritage remove react@16.13.1

# Install Dependencies
./node_modules/.bin/heritage       
```

4. Add the generated `import-map.json` to your `index.html`.
```html
<script type="importmap" src="web_modules/import-map.json"></script>
```

5. Optional. For now you may need to polyfill the [https://github.com/WICG/import-maps](import-maps) spec.
Here a working example:
```bash
./node_modules/.bin/heritage add es-module-shims
```
```html
<script defer src="web_modules/es-module-shims/0.4.6/es-module-shims.js"></script>
<script type="importmap-shim" src="web_modules/import-map.json"></script>
<script type="module-shim">
  import React from "react";
</script>
```

That's all.

## Information

Heritage use `package.json` to register required packages under the `webDependencies` field.
The `lock` file is the generated `import-map.json` used to manage imports by the browser. 
It uses the Pika CDN for the moment, but it is planned to let you configure which reegistry you would like to fetch your package.
