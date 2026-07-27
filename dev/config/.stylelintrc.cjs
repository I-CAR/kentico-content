module.exports = {
  customSyntax: "postcss-scss",
  rules: {
    "color-no-invalid-hex": true,
    "comment-no-empty": true,
    "declaration-block-no-duplicate-properties": [
      true,
      {
        ignore: [
          "consecutive-duplicates-with-different-values",
        ],
      },
    ],
    "font-family-no-duplicate-names": true,
    "no-duplicate-selectors": true,
    "property-no-unknown": true,
  },
};
