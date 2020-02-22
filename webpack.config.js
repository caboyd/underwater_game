const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ImageminPlugin = require('imagemin-webpack-plugin').default;
const HtmlWebpackExternalsPlugin = require('html-webpack-externals-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = buildConfig = (env, argv) => {
	return {
		entry: {
			'index': './src/index.ts',
		},
		output: {
			path: path.resolve(__dirname, 'dist'),
			filename: '[name].js',
			//setting this breaks relative paths
			publicPath: '/',
		},
		optimization: {
			minimize: true,
			splitChunks: {
				cacheGroups: {
					commons: {
						name: 'iwo',
						chunks: 'initial',
						minChunks: 2,
					}
				}
			},
			minimizer: [new TerserPlugin({
				test: /\.min\.js$/
			})]
		},
		plugins: [
			new HtmlWebpackExternalsPlugin({
				externals: [
					{
						module: 'gl-matrix',
						entry: 'gl-matrix-min.js',
						global: 'glMatrix',
					}
				],

			}),
			new ImageminPlugin({
				test: /\.(jpe?g|png|gif|svg)$/i,
				jpegtran: {
					progressive: true
				},
				optipng: {
					optimizationLevel: 3
				}
			}),
			new HtmlWebpackPlugin({
				title: "Underwater game",
				filename: 'index.html',
					template: 'src/index.html'
				}
			),
		],
		resolve: resolve_rules,
		module: module_rules,
		devtool: "source-map",
	};
};

const resolve_rules = {
	modules: [
		path.resolve(__dirname),
		'src',
		'ts-pbr-renderer',
		'node_modules'
	],
	// Add `.ts` and `.tsx` as a resolvable extension.
	extensions: ['.webpack.js', '.web.js', '.ts', '.tsx', '.js', '.vert', '.frag'],
};

const module_rules = {
	rules: [
		// all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
		{
			test: /\.tsx?$/,
			loader: 'ts-loader'
		},
		{
			test: /\.(glsl|vs|fs|frag|vert)$/,
			loader: 'raw-loader',
		},
		{
			test: /\.(glsl|vs|fs|frag|vert)$/,
			loader: 'string-replace-loader',
			options: {
				multiple: [

					{search: '\\r', replace: '', flags: 'g'},
					{search: '[ \\t]*\\/\\/.*\\n', replace: '', flags: 'g'}, // remove //
					{search: '[ \\t]*\\/\\*[\\s\\S]*?\\*\\/', replace: '', flags: 'g'}, // remove /* */
					{search: '\\n{2,}', replace: '\n', flags: 'g'}, // # \n+ to \n
					{search: '\\s\\s+', replace: ' ', flags: 'g'}, // reduce multi spaces to singles
				]
			}
		},
		{
			test: /\.(txt|obj|mtl)$/,
			loader: 'raw-loader'
		},
		{
			test: /\.(gif|jpeg|jpg|png|svg|hdr)$/,
			use: [
				{
					loader: 'file-loader',
					options: {
						name: '[path][name].[ext]',
						esModule:false,
					},
				},
			],
		}
	]
};



