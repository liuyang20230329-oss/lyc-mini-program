var https = require('https');
var crypto = require('crypto');

var ACCESS_KEY_ID = process.env.ALIYUN_SMS_ACCESS_KEY_ID || '';
var ACCESS_KEY_SECRET = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET || '';
var SIGN_NAME = process.env.ALIYUN_SMS_SIGN_NAME || 'LYC小宇宙学堂';
var TEMPLATE_CODE = process.env.ALIYUN_SMS_TEMPLATE_CODE || '';
var SMS_EXPIRE_SECONDS = 300;
var DEV_MODE = (process.env.SMS_DEV_MODE || 'true') === 'true';

function isConfigured() {
  return DEV_MODE || (ACCESS_KEY_ID.length > 0 && ACCESS_KEY_SECRET.length > 0 && TEMPLATE_CODE.length > 0);
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function sendSms(phoneNumber, code) {
  if (DEV_MODE) {
    console.log('[SMS DEV] phone=' + phoneNumber + ' code=' + code);
    return Promise.resolve({ success: true, code: code, dev: true });
  }
  return sendAliyunSms(phoneNumber, code);
}

function sendAliyunSms(phoneNumber, code) {
  var params = {
    PhoneNumbers: phoneNumber,
    SignName: SIGN_NAME,
    TemplateCode: TEMPLATE_CODE,
    TemplateParam: JSON.stringify({ code: code }),
  };

  var sorted = Object.keys(params).sort();
  var queryString = sorted.map(function (k) { return percentEncode(k) + '=' + percentEncode(params[k]); }).join('&');
  var stringToSign = 'GET&%2F&' + percentEncode(queryString);
  var signature = crypto.createHmac('sha1', ACCESS_KEY_SECRET + '&').update(stringToSign).digest('base64');

  var fullUrl = 'https://dysmsapi.aliyuncs.com/?Signature=' + percentEncode(signature) + '&' + queryString;

  return new Promise(function (resolve, reject) {
    https.get(fullUrl, function (res) {
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        var body = Buffer.concat(chunks).toString('utf-8');
        try {
          var result = JSON.parse(body);
          if (result.Code === 'OK') {
            resolve({ success: true });
          } else {
            reject(new Error(result.Message || 'SMS 发送失败'));
          }
        } catch (_) {
          reject(new Error('SMS 响应解析失败'));
        }
      });
    }).on('error', reject);
  });
}

function percentEncode(str) {
  return encodeURIComponent(str).replace(/\+/g, '%20').replace(/\*/g, '%2A').replace(/%7E/g, '~');
}

function getExpireSeconds() {
  return SMS_EXPIRE_SECONDS;
}

module.exports = {
  isConfigured: isConfigured,
  generateCode: generateCode,
  sendSms: sendSms,
  getExpireSeconds: getExpireSeconds,
};
