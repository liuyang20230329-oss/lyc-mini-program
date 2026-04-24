const fs = require('fs');
const path = require('path');
var initSqlJs = require('sql.js/dist/sql-asm.js');

const schemaSql = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subtitle TEXT,
  badge TEXT,
  icon TEXT,
  hero_title TEXT,
  hero_text TEXT,
  tone TEXT,
  sort_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  summary TEXT,
  duration_text TEXT,
  age_range TEXT,
  difficulty TEXT,
  reward INTEGER DEFAULT 0,
  cover_label TEXT,
  mentor TEXT,
  cover_url TEXT,
  audio_url TEXT,
  video_url TEXT,
  audio_storage_key TEXT,
  video_storage_key TEXT,
  audio_size INTEGER DEFAULT 0,
  video_size INTEGER DEFAULT 0,
  total_duration_ms INTEGER DEFAULT 0,
  full_text TEXT,
  asr_status TEXT DEFAULT 'none',
  segment_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  storage_mode TEXT DEFAULT 'local',
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS course_segments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  segment_index INTEGER NOT NULL,
  title TEXT,
  cue TEXT,
  text TEXT,
  translation TEXT,
  tip TEXT,
  start_time_ms INTEGER DEFAULT 0,
  end_time_ms INTEGER DEFAULT 0,
  audio_url TEXT,
  duration_ms INTEGER DEFAULT 0,
  focus_points TEXT,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS media_files (
  id TEXT PRIMARY KEY,
  course_id TEXT,
  storage_key TEXT NOT NULL,
  original_name TEXT,
  mimetype TEXT,
  size INTEGER DEFAULT 0,
  file_type TEXT DEFAULT 'audio',
  storage_mode TEXT DEFAULT 'local',
  upload_type TEXT DEFAULT 'single',
  status TEXT DEFAULT 'ready',
  duration_ms INTEGER,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS upload_sessions (
  id TEXT PRIMARY KEY,
  course_id TEXT,
  storage_key TEXT NOT NULL,
  upload_id TEXT NOT NULL,
  original_name TEXT,
  mimetype TEXT,
  total_size INTEGER DEFAULT 0,
  total_chunks INTEGER NOT NULL,
  received_chunks INTEGER DEFAULT 0,
  file_type TEXT DEFAULT 'audio',
  status TEXT DEFAULT 'uploading',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_progress (
  id TEXT PRIMARY KEY,
  user_openid TEXT NOT NULL,
  course_id TEXT NOT NULL,
  current_segment_index INTEGER DEFAULT 0,
  last_position_ms INTEGER DEFAULT 0,
  play_count INTEGER DEFAULT 0,
  completed_segments TEXT DEFAULT '[]',
  total_play_ms INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_openid, course_id)
);

CREATE TABLE IF NOT EXISTS user_favorites (
  id TEXT PRIMARY KEY,
  user_openid TEXT NOT NULL,
  course_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_openid, course_id)
);

CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category_id, status);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status, sort_order);
CREATE INDEX IF NOT EXISTS idx_segments_course ON course_segments(course_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_media_storage_key ON media_files(storage_key);
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_progress(user_openid);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_openid);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  openid TEXT UNIQUE,
  unionid TEXT,
  phone_number TEXT,
  nickname TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  gender TEXT DEFAULT 'undisclosed',
  role TEXT DEFAULT 'parent',
  phone_verified INTEGER DEFAULT 0,
  profile_completed INTEGER DEFAULT 0,
  last_login_at TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sms_codes (
  id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS child_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  nickname TEXT DEFAULT '',
  birth_year INTEGER,
  birth_month INTEGER,
  gender TEXT DEFAULT 'undisclosed',
  avatar_url TEXT DEFAULT '',
  preferences TEXT DEFAULT '{}',
  is_primary INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wx_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  openid TEXT NOT NULL,
  session_key TEXT,
  access_token TEXT,
  device_info TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_openid ON users(openid);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_phone ON sms_codes(phone_number, purpose);
CREATE INDEX IF NOT EXISTS idx_child_profile_user ON child_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_wx_sessions_user ON wx_sessions(user_id);

CREATE TABLE IF NOT EXISTS tts_cache (
  id TEXT PRIMARY KEY,
  text_hash TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  course_id TEXT,
  segment_index INTEGER DEFAULT 0,
  audio_url TEXT,
  storage_key TEXT,
  duration_ms INTEGER DEFAULT 0,
  status TEXT DEFAULT 'ready',
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tts_cache_hash ON tts_cache(text_hash);

CREATE TABLE IF NOT EXISTS tts_voice_config (
  id TEXT PRIMARY KEY,
  voice_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  desc TEXT DEFAULT '',
  gender TEXT DEFAULT 'female',
  age_group TEXT DEFAULT 'child',
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

class LyCDatabase {
  constructor() {
    this.dbPath = this._resolvePath();
    this.db = null;
    this._saveTimer = null;
    this.ready = this._initialize();
  }

  _resolvePath() {
    const envPath = process.env.DB_PATH;
    if (envPath && envPath.trim().length > 0) {
      return path.isAbsolute(envPath) ? envPath : path.resolve(__dirname, '..', envPath);
    }
    return path.join(__dirname, '..', 'data', 'lyc-media.db');
  }

  async _initialize() {
    var dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    var SQL = await initSqlJs({
      locateFile: function (file) {
        return path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file.replace('.wasm', '-debug.wasm'));
      }
    });

    if (fs.existsSync(this.dbPath)) {
      var buf = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buf);
    } else {
      this.db = new SQL.Database();
    }

    this.db.run('PRAGMA foreign_keys = ON;');
    this.db.run('PRAGMA journal_mode = WAL;');
    this.db.exec(schemaSql);

    this._startAutoSave();
  }

  _startAutoSave() {
    var self = this;
    this._saveTimer = setInterval(function () {
      self._saveToFile();
    }, 5000);
  }

  _saveToFile() {
    if (!this.db) return;
    try {
      var data = this.db.export();
      var buf = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buf);
    } catch (_) {}
  }

  async run(sql, params) {
    params = params || [];
    try {
      this.db.run(sql, params);
      return { lastID: 0, changes: this.db.getRowsModified() };
    } catch (err) {
      throw err;
    }
  }

  async get(sql, params) {
    params = params || [];
    try {
      var stmt = this.db.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        var row = stmt.getAsObject();
        stmt.free();
        return row;
      }
      stmt.free();
      return null;
    } catch (err) {
      throw err;
    }
  }

  async all(sql, params) {
    params = params || [];
    var results = [];
    try {
      var stmt = this.db.prepare(sql);
      stmt.bind(params);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (err) {
      throw err;
    }
  }

  async exec(sql) {
    this.db.exec(sql);
  }
}

module.exports = new LyCDatabase();
