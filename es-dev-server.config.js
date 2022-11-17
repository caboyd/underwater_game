module.exports = {
    port: 8080,
    watch: true,
    compress: false,
    nodeResolve: {
        browser: true,
        //modulesOnly: true,

        extensions: ['.mjs', '.js', '.frag', '.vert', '.json'],
        customResolveOptions: {
            //Tries to resolve from examples folder unless this is set
            // basedir: process.cwd(),
            extensions: ['.mjs', '.js', '.frag', '.vert', '.json'],
            // preserveSymlinks: true
        },
    },
    preserveSymlinks: true,
    appIndex: 'docs/index.html',
    plugins: [],
    moduleDirs: ['node_modules', 'web-modules'],
};
