'use strict';
const cloud=require('wx-server-sdk');
const {createCloudbaseHandler,createCloudbaseStore}=require('./server/wechat-cloudbase.cjs');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
const handler=createCloudbaseHandler({store:createCloudbaseStore(cloud.database({throwOnNotFound:false})),core:require('node:path').join(__dirname,'core')});
exports.main=async event=>handler(event,cloud.getWXContext());
