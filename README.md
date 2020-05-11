# heritage
ES 2020 Tiny Package Manager for the Web

## Use

1. Install Heritage
```bash
yarn add -D @eliaspourquoi/heritage
```

3. Add/Remove/Install Dependencies
```bash
./node_modules/.bin/heritage add react
./node_modules/.bin/heritage remove react
./node_modules/.bin/heritage install
```

4. Add the generated `import-map.json` to your `index.html`
```html
<script type="importmap" src="web_modules/import-map.json"></script>
```

That's all.

## Information

Heritage use `package.json` to register required packages under the `webDependencies` field.
The `lock` file is the generated `import-map.json` used to manage imports by the browser. 
