# heritage
ES 2020 Package Manager for the Web

## Use

1. Install
```
yarn add -D @eliaspourquoi/heritage
```

2. (Will change) Manually add your dependencies in your package.json

```
"webDependencies": {
  "three": "0.115.0",
  "react": "16.13.1"
},
```

3. Install Dependencies
```
./node_modules/.bin/heritage
```

4. Add the generated `import-map.json` to your `index.html`
```html
<script type="importmap" src="web_modules/import-map.json"></script>
```

That's all.
