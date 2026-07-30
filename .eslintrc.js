module.exports = {
    "extends": ["google", "plugin:@typescript-eslint/recommended"],
    "parser": "@typescript-eslint/parser",
    "plugins": ["@typescript-eslint"],
    "parserOptions": {
        "ecmaVersion": 2018
        },
    "env": {
        "es6": true
        },
    rules: {
        "no-console": "off",
        "@typescript-eslint/indent": ["error", 2],
        "linebreak-style": ["error","windows"],
    }
};