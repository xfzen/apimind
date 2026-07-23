/* eslint-disable */
const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const AssetsPlugin = require('assets-webpack-plugin');
const pkg = require('./package.json');

const isProd = process.env.NODE_ENV === 'production';

const vendorsLib = [
  'react',
  'react-dom',
  'redux',
  'redux-promise',
  'react-router',
  'react-router-dom',
  'prop-types',
  'react-dnd-html5-backend',
  'react-dnd',
  'reactabular-table',
  'reactabular-dnd',
  'table-resolver'
];
const vendorsLib2 = ['brace', 'json5', 'url', 'axios'];
const vendorsLib3 = ['mockjs', 'moment', 'recharts'];

function assetsProcessOutput(assets) {
  // Map runtime chunk to legacy 'manifest'
  const out = {};
  const runtimeKey = Object.keys(assets).find(k => /^runtime/.test(k));
  if (runtimeKey) out.manifest = assets[runtimeKey];
  if (assets['index']) out['index.js'] = assets['index'];
  if (assets['lib']) out['lib'] = assets['lib'];
  if (assets['lib2']) out['lib2'] = assets['lib2'];
  if (assets['lib3']) out['lib3'] = assets['lib3'];
  return 'window.WEBPACK_ASSETS = ' + JSON.stringify(out);
}

module.exports = {
  mode: isProd ? 'production' : 'development',
  devtool: isProd ? 'source-map' : 'cheap-module-source-map',
  entry: {
    index: path.resolve(__dirname, 'client/index.jsx')
  },
  output: {
    path: path.resolve(__dirname, 'static/prd'),
    publicPath: '/prd/',
    filename: '[name]@[contenthash].js',
    chunkFilename: '[name]@[contenthash].js'
  },
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
    alias: {
      client: path.resolve(__dirname, 'client'),
      common: path.resolve(__dirname, 'common'),
      exts: path.resolve(__dirname, 'exts'),
      'axios$': path.resolve(__dirname, 'client/utils/request.js')
    }
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      },
      {
        test: /\.less$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'less-loader']
      },
      {
        test: /\.(sass|scss)$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader']
      },
      {
        test: /\.(gif|jpg|jpeg|png|woff|woff2|eot|ttf|svg)$/,
        type: 'asset',
        parser: { dataUrlCondition: { maxSize: 8192 } },
        generator: { filename: '[path][name][ext]?[contenthash:8]' }
      }
    ]
  },
  optimization: {
    runtimeChunk: 'single',
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        lib: {
          name: 'lib',
          test: (m) => m.resource && vendorsLib.some(v => m.resource.includes(path.sep + v + path.sep)),
          priority: 30,
          enforce: true
        },
        lib2: {
          name: 'lib2',
          test: (m) => m.resource && vendorsLib2.some(v => m.resource.includes(path.sep + v + path.sep)),
          priority: 20,
          enforce: true
        },
        lib3: {
          name: 'lib3',
          test: (m) => m.resource && vendorsLib3.some(v => m.resource.includes(path.sep + v + path.sep)),
          priority: 10,
          enforce: true
        }
      }
    }
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV || (isProd ? 'production' : 'development')),
        version: JSON.stringify(pkg.version),
        API_BASE: JSON.stringify(process.env.YAPI_API_BASE || '')
      }
    }),
    new MiniCssExtractPlugin({ filename: '[name]@[contenthash].css' }),
    new AssetsPlugin({ filename: 'static/prd/assets.js', processOutput: assetsProcessOutput }),
    new CompressionPlugin({
      filename: '[path][base].gz',
      algorithm: 'gzip',
      test: /\.(js|css)$/,
      threshold: 10240,
      minRatio: 0.8
    })
  ]
};
