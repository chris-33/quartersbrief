module.exports = {
    "env": {
        "browser": true,
        "node": true,
        "mocha": true,
        "es2021": true
    },
    "plugins": [
        "mocha",
        "chai-expect"
    ],
    "extends": [
        "eslint:recommended",
        "plugin:mocha/recommended",
        "plugin:chai-expect/recommended"
    ],
    "parserOptions": {
        "ecmaVersion": "latest",
        "sourceType": "module"
    },
    "rules": {
        "no-prototype-builtins": 0,
        "no-var": 1,
        // "prefer-const": 1
    }
}
