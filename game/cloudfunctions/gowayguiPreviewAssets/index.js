'use strict';
const cloud=require('wx-server-sdk');
const {createAssetHandler}=require('./handler.cjs');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
const handler=createAssetHandler({manifest:require('./asset-manifest.json'),sign:options=>cloud.getTempFileURL(options)});
exports.main=async event=>handler(event,cloud.getWXContext());
