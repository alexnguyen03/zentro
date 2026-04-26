module.exports = {
  bumpFiles: [
    {
      filename: "package.json",
      type: "json"
    },
    {
      filename: "frontend/package.json",
      type: "json"
    },
    {
      filename: "wails.json",
      updater: require("./scripts/wails-version-updater.cjs")
    }
  ],
  packageFiles: [
    {
      filename: "package.json",
      type: "json"
    }
  ]
};
