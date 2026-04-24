const express = require('express');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { signToken } = require('../middleware/auth');
const db = require('../config/database');
const smsService = require('../services/sms/sms-service');

const router = express.Router();

var devCodes = {};

router.post('/wx-login', function (req, res) {
  var code = req.body.code;
  if (!code) { res.status(400).json({ error: '缺少微信登录 code。' }); return; }

  var openid = 'wx_' + code.substring(0, 16) + '_' + Date.now();
  var now = new Date().toISOString();

  db.get('SELECT * FROM users WHERE openid = ?', [openid]).then(function (existingUser) {
    if (existingUser) {
      return updateUserAndRespond(existingUser, now, res);
    }
    return createNewWxUser(openid, now, res);
  }).catch(function (err) {
    console.error('wx-login error', err);
    res.status(500).json({ error: '登录失败，请重试。' });
  });
});

router.post('/send-sms', function (req, res) {
  var phoneNumber = req.body.phoneNumber;
  var purpose = req.body.purpose || 'login';
  if (!phoneNumber || !/^1\d{10}$/.test(phoneNumber)) {
    res.status(400).json({ error: '请输入正确的手机号。' }); return;
  }

  var now = new Date().toISOString();
  var code = smsService.generateCode();
  var expiresAt = new Date(Date.now() + smsService.getExpireSeconds() * 1000).toISOString();

  db.run(
    'INSERT INTO sms_codes (id, phone_number, code, purpose, expires_at, ip_address, created_at) VALUES (?,?,?,?,?,?,?)',
    [uuidv4(), phoneNumber, code, purpose, expiresAt, req.ip, now]
  ).then(function () {
    if (!smsService.isConfigured()) {
      devCodes[phoneNumber] = code;
    }
    return smsService.sendSms(phoneNumber, code);
  }).then(function () {
    var response = { success: true, expiresInSeconds: smsService.getExpireSeconds() };
    if (!smsService.isConfigured() || (process.env.SMS_DEV_MODE === 'true')) {
      response.devCode = code;
    }
    res.json(response);
  }).catch(function (err) {
    console.error('send-sms error', err);
    res.status(500).json({ error: '验证码发送失败。' });
  });
});

router.post('/sms-login', function (req, res) {
  var phoneNumber = req.body.phoneNumber;
  var code = req.body.code;
  if (!phoneNumber || !code) { res.status(400).json({ error: '手机号和验证码不能为空。' }); return; }

  var now = new Date().toISOString();
  db.get(
    "SELECT * FROM sms_codes WHERE phone_number = ? AND code = ? AND purpose = 'login' AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1",
    [phoneNumber, code, now]
  ).then(function (smsRecord) {
    if (!smsRecord) { res.status(400).json({ error: '验证码无效或已过期。' }); return null; }

    return db.run('UPDATE sms_codes SET consumed_at = ? WHERE id = ?', [now, smsRecord.id]).then(function () {
      return db.get('SELECT * FROM users WHERE phone_number = ?', [phoneNumber]);
    }).then(function (existingUser) {
      if (existingUser) {
        return updateUserAndRespond(existingUser, now, res);
      }
      return createNewPhoneUser(phoneNumber, now, res);
    });
  }).catch(function (err) {
    console.error('sms-login error', err);
    res.status(500).json({ error: '登录失败，请重试。' });
  });
});

router.post('/bind-phone', function (req, res) {
  var auth = req.auth;
  if (!auth || !auth.userId) { res.status(401).json({ error: '未登录。' }); return; }

  var phoneNumber = req.body.phoneNumber;
  var code = req.body.code;
  if (!phoneNumber || !code) { res.status(400).json({ error: '手机号和验证码不能为空。' }); return; }

  var now = new Date().toISOString();
  db.get(
    "SELECT * FROM sms_codes WHERE phone_number = ? AND code = ? AND purpose = 'bind_phone' AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1",
    [phoneNumber, code, now]
  ).then(function (smsRecord) {
    if (!smsRecord) { res.status(400).json({ error: '验证码无效或已过期。' }); return null; }

    return db.run('UPDATE sms_codes SET consumed_at = ? WHERE id = ?', [now, smsRecord.id]).then(function () {
      return db.get('SELECT * FROM users WHERE phone_number = ? AND id != ?', [phoneNumber, auth.userId]);
    }).then(function (conflict) {
      if (conflict) { res.status(409).json({ error: '该手机号已被其他账号绑定。' }); return null; }
      return db.run('UPDATE users SET phone_number = ?, phone_verified = 1, updated_at = ? WHERE id = ?', [phoneNumber, now, auth.userId]);
    }).then(function () {
      if (res.headersSent) return;
      return respondWithUser(auth.userId, res);
    });
  }).catch(function (err) {
    if (res.headersSent) return;
    console.error('bind-phone error', err);
    res.status(500).json({ error: '绑定失败。' });
  });
});

router.use(function (req, res, next) {
  var authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) { res.status(401).json({ error: '未登录。' }); return; }
  try {
    var jwt = require('jsonwebtoken');
    req.auth = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET || 'lyc-dev-secret-change-in-production');
    next();
  } catch (_) {
    res.status(401).json({ error: '登录态已失效。' });
  }
});

router.get('/profile', function (req, res) {
  respondWithUser(req.auth.userId, res);
});

router.put('/profile', function (req, res) {
  var userId = req.auth.userId;
  var body = req.body;
  var now = new Date().toISOString();
  var fields = [];
  var params = [];
  var allowed = ['nickname', 'avatar_url', 'gender'];
  allowed.forEach(function (col) {
    var camel = col.replace(/_([a-z])/g, function (_, c) { return c.toUpperCase(); });
    if (body[camel] !== undefined) { fields.push(col + ' = ?'); params.push(body[camel]); }
  });
  if (fields.length === 0) { respondWithUser(userId, res); return; }
  fields.push('updated_at = ?');
  params.push(now);
  params.push(userId);
  db.run('UPDATE users SET ' + fields.join(', ') + ' WHERE id = ?', params).then(function () {
    return respondWithUser(userId, res);
  }).catch(function (err) {
    res.status(500).json({ error: '更新失败。' });
  });
});

router.post('/child', function (req, res) {
  var userId = req.auth.userId;
  var body = req.body;
  var now = new Date().toISOString();
  var id = uuidv4();
  db.run(
    'INSERT INTO child_profiles (id, user_id, nickname, birth_year, birth_month, gender, avatar_url, is_primary, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [id, userId, body.nickname || '', body.birthYear || null, body.birthMonth || null, body.gender || 'undisclosed', body.avatarUrl || '', 1, now, now]
  ).then(function () {
    return db.run('UPDATE users SET profile_completed = 1, updated_at = ? WHERE id = ?', [now, userId]);
  }).then(function () {
    return respondWithUser(userId, res);
  }).catch(function (err) {
    res.status(500).json({ error: '保存失败。' });
  });
});

router.put('/child/:childId', function (req, res) {
  var body = req.body;
  var now = new Date().toISOString();
  var fields = [];
  var params = [];
  var allowed = ['nickname', 'birth_year', 'birth_month', 'gender', 'avatar_url', 'preferences'];
  allowed.forEach(function (col) {
    var camel = col.replace(/_([a-z])/g, function (_, c) { return c.toUpperCase(); });
    if (body[camel] !== undefined) { fields.push(col + ' = ?'); params.push(body[camel]); }
  });
  if (fields.length === 0) { respondWithUser(req.auth.userId, res); return; }
  fields.push('updated_at = ?');
  params.push(now);
  params.push(req.params.childId);
  db.run('UPDATE child_profiles SET ' + fields.join(', ') + ' WHERE id = ? AND user_id = ?', params.concat([req.auth.userId])).then(function () {
    return respondWithUser(req.auth.userId, res);
  });
});

router.post('/logout', function (req, res) {
  res.json({ success: true });
});

function createNewWxUser(openid, now, res) {
  var id = uuidv4();
  return db.run(
    'INSERT INTO users (id, openid, nickname, role, status, created_at, updated_at, last_login_at) VALUES (?,?,?,?,?,?,?,?)',
    [id, openid, '微信用户', 'parent', 'active', now, now, now]
  ).then(function () {
    return respondWithToken(id, openid, res);
  });
}

function createNewPhoneUser(phoneNumber, now, res) {
  var id = uuidv4();
  return db.run(
    'INSERT INTO users (id, phone_number, nickname, role, phone_verified, status, created_at, updated_at, last_login_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [id, phoneNumber, '用户' + phoneNumber.slice(-4), 'parent', 1, 'active', now, now, now]
  ).then(function () {
    return respondWithToken(id, null, res);
  });
}

function updateUserAndRespond(user, now, res) {
  return db.run('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?', [now, now, user.id]).then(function () {
    return respondWithToken(user.id, user.openid, res);
  });
}

function respondWithToken(userId, openid, res) {
  var token = signToken({ userId: userId, openid: openid || '' });
  return respondWithUser(userId, res, token);
}

function respondWithUser(userId, res, token) {
  return db.get('SELECT * FROM users WHERE id = ?', [userId]).then(function (user) {
    if (!user) { res.status(404).json({ error: '用户不存在。' }); return; }
    return db.all('SELECT * FROM child_profiles WHERE user_id = ?', [userId]).then(function (children) {
      var result = {
        user: {
          id: user.id,
          openid: user.openid,
          phoneNumber: user.phone_number,
          nickname: user.nickname,
          avatarUrl: user.avatar_url,
          gender: user.gender,
          role: user.role,
          phoneVerified: !!user.phone_verified,
          profileCompleted: !!user.profile_completed,
          status: user.status,
          lastLoginAt: user.last_login_at,
          createdAt: user.created_at,
        },
        children: children.map(function (c) {
          return {
            id: c.id,
            nickname: c.nickname,
            birthYear: c.birth_year,
            birthMonth: c.birth_month,
            gender: c.gender,
            avatarUrl: c.avatar_url,
            isPrimary: !!c.is_primary,
          };
        }),
      };
      if (token) { result.token = token; }
      res.json(result);
    });
  });
}

module.exports = router;
