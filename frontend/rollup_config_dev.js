import resolve from '@rollup/plugin-node-resolve'; // locate and bundle dependencies in node_modules (mandatory)
import commonjs from '@rollup/plugin-commonjs';

export default {
	input: 'src/viewer.js',
	output: [
		{
			format: 'umd',
			name: 'ChemViewer',
			file: 'build/bundle.js'
		}
	],
	plugins: [ resolve(), commonjs() ]
};
