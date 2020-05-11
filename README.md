# heritage
ES 2020 Tiny Package Manager for the Web.

## Use

1. Install Heritage
```bash
yarn add -D @eliaspourquoi/heritage
```

3. Manage Dependencies, like Yarn, NPM or Snowpack...
```bash
# Add Dependencies
./node_modules/.bin/heritage add react three

# Remove Dependencies
./node_modules/.bin/heritage remove react@16.13.1

# Install Dependencies
./node_modules/.bin/heritage       
```

4. Add the generated `import-map.json` to your `index.html`
```html
<script type="importmap" src="web_modules/import-map.json"></script>
```

That's all.

## Information

Heritage use `package.json` to register required packages under the `webDependencies` field.
The `lock` file is the generated `import-map.json` used to manage imports by the browser. 
It uses the Pika CDN for the moment, but it is planned to let you configure which reegistry you would like to fetch your package.
