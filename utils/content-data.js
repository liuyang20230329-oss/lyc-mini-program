// File overview: utils\content-data.js
var DEFAULT_BASE = 'http://192.168.31.181:8123';
var LOCAL_AUDIO_BASE_URL = DEFAULT_BASE;

// Static category metadata used to build the landing and discover pages.
var CATEGORY_LIST = [
  { id: 'english', name: '英语跟读', subtitle: '从单词到整句，跟着声音大胆开口。', badge: '今日推荐', icon: '/assets/animals/english-parrot.svg', heroTitle: '今天和晨光老师说英语', heroText: '用短句子、慢节奏和跟读提示，帮助孩子自然开口。', tone: 'sky', stats: '2 节演示 + 8 个本地童谣' },
  { id: 'songs', name: '儿歌乐园', subtitle: '边唱边学，记忆会像跳舞一样轻松。', badge: '轻松学', icon: '/assets/animals/songs-chick.svg', heroTitle: '跟着节奏唱一唱', heroText: '把洗手、颜色、数字这些日常知识装进旋律里。', tone: 'sun', stats: '12 首陪伴儿歌' },
  { id: 'poems', name: '诗词花园', subtitle: '把经典古诗变成孩子听得懂、记得住的小花园。', badge: '国风', icon: '/assets/animals/poems-rabbit.svg', heroTitle: '在月光和春风里读诗', heroText: '每一首诗都分句展示，还会附上温柔的小解释。', tone: 'moon', stats: '2 节演示 + 4 个本地诗词素材' },
  { id: 'stories', name: '探索故事馆', subtitle: '去认识发明家、历史人物和有趣的科学故事。', badge: '新奇', icon: '/assets/animals/stories-fox.svg', heroTitle: '乘着时光列车听故事', heroText: '科技、历史和生活常识，都能在这里变成有画面的故事。', tone: 'mint', stats: '18 个科普故事' }
];

// Lesson fixtures drive the current prototype until cloud content is enabled.
var LESSON_LIST = [
  { id: 'english-morning-sun', categoryId: 'english', title: 'Good Morning, Sun', subtitle: '晨间问候启蒙', summary: '跟着小太阳一起学会 4 句最常用的晨安英语。', duration: '约 5 分钟', ageRange: '4-6 岁', difficulty: '启蒙', reward: 18, coverLabel: '晨光跟读', mentor: '晨光老师', focusPoints: ['认识 morning 和 sun', '练习问候语语调', '模仿完整句子'], segments: [{ cue: '跟读 01', text: 'Good morning, sun.', translation: '早安，小太阳。', tip: '先跟着节奏读，再把 morning 的尾音拉长一点。' }, { cue: '跟读 02', text: 'Good morning, my friends.', translation: '早安，我的朋友们。', tip: '读 friends 时嘴角微笑，会更像打招呼。' }, { cue: '跟读 03', text: 'Let us smile and start the day.', translation: '让我们带着微笑开始新的一天。', tip: '一句话有点长，可以先分成 smile 和 start the day 两段。' }, { cue: '跟读 04', text: 'I am ready to learn and play.', translation: '我准备好学习和玩耍啦。', tip: '把 ready 读得轻快一点，像真的准备出发。' }] },
  { id: 'english-animal-parade', categoryId: 'english', title: 'Animal Parade', subtitle: '动物英语开口秀', summary: '和小动物排队出场，边看边读 elephant、rabbit、bird。', duration: '约 6 分钟', ageRange: '5-7 岁', difficulty: '基础', reward: 22, coverLabel: '动物派对', mentor: '乐乐老师', focusPoints: ['动物词汇记忆', '形容动作的短句', '模仿自信语气'], segments: [{ cue: '跟读 01', text: 'The rabbit hops so fast.', translation: '小兔子跳得真快。', tip: 'hops 读短一些，像兔子轻轻跳一下。' }, { cue: '跟读 02', text: 'The bird sings in the tree.', translation: '小鸟在树上唱歌。', tip: 'sings 和 tree 都要读得轻轻的，像在听鸟叫。' }, { cue: '跟读 03', text: 'The elephant walks with me.', translation: '大象和我一起散步。', tip: 'elephant 分成 e-le-phant，更好模仿。' }, { cue: '跟读 04', text: 'We wave hello in the parade.', translation: '我们在游行里挥手说你好。', tip: 'wave hello 可以边做动作边读，更容易记住。' }] },
  { id: 'english-rhyme-baa-baa-black-sheep', categoryId: 'english', title: 'Baa Baa Black Sheep', subtitle: '本地英语童谣', summary: '适合做英语磨耳朵和节奏跟读。', duration: '本地 MP3', ageRange: '3-8 岁', difficulty: '跟读素材', reward: 12, coverLabel: '英语童谣', mentor: 'Storynory', audioUrl: '/english/baa-baa-black-sheep.mp3', focusPoints: ['英语童谣磨耳朵', '模仿节奏和发音'], segments: [{ cue: '本地素材', text: 'Baa Baa Black Sheep', translation: '这首英语童谣已经归类到英语跟读中。', tip: '下一步可以继续补歌词字幕和跟读评分。' }] },
  { id: 'english-rhyme-five-little-monkeys', categoryId: 'english', title: 'Five Little Monkeys', subtitle: '本地英语童谣', summary: '适合做英语节奏启蒙。', duration: '本地 MP3', ageRange: '3-8 岁', difficulty: '跟读素材', reward: 12, coverLabel: '英语童谣', mentor: 'Storynory', audioUrl: '/english/five-little-monkeys.mp3', focusPoints: ['数字与节奏启蒙'], segments: [{ cue: '本地素材', text: 'Five Little Monkeys', translation: '这首英语童谣已经归类到英语跟读中。', tip: '可以继续补逐句歌词。' }] },
  { id: 'poem-spring-dawn', categoryId: 'poems', title: '春晓', subtitle: '唐诗启蒙', summary: '用孩子听得懂的方式感受春天清晨的声音和风景。', duration: '约 6 分钟', ageRange: '5-8 岁', difficulty: '启蒙', reward: 20, coverLabel: '古诗晨读', mentor: '清和老师', focusPoints: ['分句朗读古诗', '理解春天画面', '感受押韵节奏'], segments: [{ cue: '诗句 01', text: '春眠不觉晓，', translation: '春天的夜晚睡得香，不知不觉天就亮了。', tip: '这一句读得轻轻的，像刚刚睡醒。' }, { cue: '诗句 02', text: '处处闻啼鸟。', translation: '到处都能听见小鸟在唱歌。', tip: '闻啼鸟时可以停顿一下，让孩子想象鸟叫声。' }, { cue: '诗句 03', text: '夜来风雨声，', translation: '夜里好像听见了风声和雨声。', tip: '这一句可以压低声音，像在回想昨夜。' }, { cue: '诗句 04', text: '花落知多少。', translation: '不知道有多少花瓣被吹落了呢。', tip: '结尾拉长一点，像在慢慢看着花瓣飘下。' }] },
  { id: 'poem-quiet-night', categoryId: 'poems', title: '静夜思', subtitle: '月光里的思念', summary: '陪孩子在安静的夜里读一首最经典的月夜古诗。', duration: '约 5 分钟', ageRange: '5-8 岁', difficulty: '启蒙', reward: 19, coverLabel: '月光诗会', mentor: '清和老师', focusPoints: ['感受诗词情绪', '学习停顿节奏', '理解思乡意象'], segments: [{ cue: '诗句 01', text: '床前明月光，', translation: '床前洒着明亮的月光。', tip: '明月光三个字要读得亮一点。' }, { cue: '诗句 02', text: '疑是地上霜。', translation: '看起来像地上铺了一层白白的霜。', tip: '疑是可以稍微放慢，让孩子理解"好像"的感觉。' }, { cue: '诗句 03', text: '举头望明月，', translation: '抬起头来看天上的月亮。', tip: '读举头时可以真的抬头，动作会帮助记忆。' }, { cue: '诗句 04', text: '低头思故乡。', translation: '低下头来想念远方的家乡。', tip: '结尾语气柔和一点，更能读出思念。' }] }
];

// Curated home page shelves are composed from lesson ids.
var HOME_PLAYLISTS = {
  todayIds: ['english-rhyme-twinkle-twinkle-little-star', 'english-rhyme-baa-baa-black-sheep', 'poem-yue-xia-du-zhuo'],
  bedtimeIds: ['english-rhyme-twinkle-twinkle-little-star-song', 'poem-tangshi-300-vol-1']
};

// Demo growth data powers the history page before real telemetry is wired in.
var GROWTH_PANEL = {
  totalStars: 128, streakDays: 6, totalMinutes: 96,
  weekProgress: [{ day: '一', value: 3 }, { day: '二', value: 4 }, { day: '三', value: 2 }, { day: '四', value: 5 }, { day: '五', value: 4 }, { day: '六', value: 6 }, { day: '日', value: 3 }],
  missions: [{ id: 'mission-english', title: '完成 1 节英语跟读', detail: '今天只要跟读 4 句英语，就能得到小星星。', reward: '+10 星星', done: false }, { id: 'mission-poem', title: '背诵 1 首古诗', detail: '把《春晓》完整听完，再尝试自己读一遍。', reward: '+12 星星', done: true }, { id: 'mission-story', title: '听完 1 个探索故事', detail: '睡前来听一段科技或历史小故事。', reward: '+15 星星', done: false }],
  badges: [{ id: 'badge-reader', name: '晨读小达人', description: '连续 5 天完成晨间学习。', unlocked: true }, { id: 'badge-singer', name: '节奏小歌手', description: '完成 3 首儿歌跟唱。', unlocked: true }, { id: 'badge-explorer', name: '故事探索员', description: '完成 5 次故事馆学习。', unlocked: false }]
};

// Parent-facing summaries and recommendations shown on the about page.
var PARENT_PANEL = {
  observations: [{ title: '本周最爱内容', value: '英语跟读', note: '孩子本周重复打开 4 次，最喜欢早安主题。' }, { title: '专注最佳时段', value: '19:00 - 19:30', note: '晚饭后进入学习状态更稳定。' }, { title: '最近进步', value: '敢开口了', note: '跟读时会主动模仿整句。' }],
  schedules: [{ name: '晨间 10 分钟', theme: '上学前', items: ['英语跟读 1 节', '儿歌热身 1 首'] }, { name: '睡前 12 分钟', theme: '入睡前', items: ['古诗 1 首', '故事馆 1 个'] }],
  tips: ['先听再读，让孩子先熟悉声音节奏。', '每次学习控制在 10 到 15 分钟。', '从孩子喜欢的内容开始建立成就感。'],
  todo: ['补充小程序 Logo 和启动页插画', '确认首批正式上线内容清单', '开通云开发环境并接入学习记录']
};

var _cloudCourses = null;
var _cloudCategories = null;
var _apiBaseUrl = '';

// Allow the app bootstrap to point content requests at the active backend.
function setApiBaseUrl(url) {
  _apiBaseUrl = url.replace(/\/+$/, '');
}

function getCategoryById(id) {
  var match = null;
  CATEGORY_LIST.forEach(function (c) { if (c.id === id) match = c; });
  return match;
}

function getLessonById(id) {
  var match = null;
  LESSON_LIST.forEach(function (l) { if (l.id === id) match = l; });
  return match;
}

function getLessonsByCategory(categoryId) {
  return LESSON_LIST.filter(function (l) { return l.categoryId === categoryId; });
}

function getLessonsByIds(ids) {
  return ids.map(getLessonById).filter(Boolean);
}

function getContinueLesson() {
  return getLessonById('english-rhyme-twinkle-little-star') || LESSON_LIST[0];
}

function getRecommendedLessonsFor(lessonId) {
  var current = getLessonById(lessonId);
  if (!current) return [];
  return LESSON_LIST.filter(function (l) { return l.categoryId === current.categoryId && l.id !== lessonId; }).slice(0, 2);
}

// Swap the local fixture list for cloud data when the backend is reachable.
function fetchCloudCourses() {
  if (!_apiBaseUrl) return Promise.resolve(null);
  return new Promise(function (resolve) {
    wx.request({
      url: _apiBaseUrl + '/api/v1/content/courses',
      method: 'GET',
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.items) {
          _cloudCourses = res.data.items;
          resolve(_cloudCourses);
        } else {
          resolve(null);
        }
      },
      fail: function () { resolve(null); }
    });
  });
}

function fetchCloudCourseDetail(courseId) {
  if (!_apiBaseUrl) return Promise.resolve(null);
  return new Promise(function (resolve) {
    wx.request({
      url: _apiBaseUrl + '/api/v1/content/courses/' + courseId,
      method: 'GET',
      success: function (res) {
        if (res.statusCode === 200 && res.data) {
          resolve(res.data);
        } else {
          resolve(null);
        }
      },
      fail: function () { resolve(null); }
    });
  });
}

// Prefer cloud content after it has been loaded, otherwise fall back to fixtures.
function getAllCourses() {
  if (_cloudCourses && _cloudCourses.length > 0) return _cloudCourses;
  return LESSON_LIST;
}

module.exports = {
  LOCAL_AUDIO_BASE_URL: LOCAL_AUDIO_BASE_URL,
  CATEGORY_LIST: CATEGORY_LIST,
  LESSON_LIST: LESSON_LIST,
  HOME_PLAYLISTS: HOME_PLAYLISTS,
  GROWTH_PANEL: GROWTH_PANEL,
  PARENT_PANEL: PARENT_PANEL,
  setApiBaseUrl: setApiBaseUrl,
  getCategoryById: getCategoryById,
  getLessonById: getLessonById,
  getLessonsByCategory: getLessonsByCategory,
  getLessonsByIds: getLessonsByIds,
  getContinueLesson: getContinueLesson,
  getRecommendedLessonsFor: getRecommendedLessonsFor,
  fetchCloudCourses: fetchCloudCourses,
  fetchCloudCourseDetail: fetchCloudCourseDetail,
  getAllCourses: getAllCourses,
};
