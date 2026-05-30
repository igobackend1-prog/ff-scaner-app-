module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
          },
        },
      ],
      // Fix: Replace dynamic imports with variable expressions (e.g. import(OTEL_PKG))
      // that Hermes cannot compile. Caused by @supabase/supabase-js OpenTelemetry support.
      function fixDynamicVariableImports({ types: t }) {
        return {
          visitor: {
            CallExpression(path) {
              if (
                path.node.callee.type === 'Import' &&
                path.node.arguments.length > 0 &&
                path.node.arguments[0].type === 'Identifier'
              ) {
                path.replaceWith(
                  t.callExpression(
                    t.memberExpression(
                      t.identifier('Promise'),
                      t.identifier('resolve')
                    ),
                    [t.objectExpression([])]
                  )
                );
              }
            },
          },
        };
      },
    ],
  };
};
