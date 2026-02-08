// ABOUTME: Internationalization module with English and Mandarin translations.
// ABOUTME: Auto-detects system language and provides getStrings() for page data binding.

const strings = {
  en: {
    // Navigation
    nav_home: 'Home',
    nav_events: 'Events',
    nav_profile: 'Profile',
    nav_register: 'Register',
    nav_matches: 'My Matches',
    nav_stats: 'Stats',
    nav_players: 'Players',
    nav_admin: 'Admin',
    nav_settings: 'Settings',

    // Common
    common_loading: 'Loading...',
    common_save: 'Save',
    common_cancel: 'Cancel',
    common_submit: 'Submit',
    common_search: 'Search',
    common_select: 'Select',
    common_unknown: 'Unknown',
    common_unnamed: 'Unnamed',
    common_none: 'None',
    common_all: 'All',
    common_yes: 'Yes',
    common_no: 'No',

    // Error messages
    error_missing_fields: 'Please fill in all required fields',
    error_missing_event_fields: 'Please fill in the event details',
    error_missing_winner: 'Please select a winner',
    error_permission_denied: 'Permission denied',
    error_player_not_found: 'Player not found',
    error_event_not_found: 'Event not found',

    // Gender
    gender_male: 'Male',
    gender_female: 'Female',

    // Players page
    players_title: 'All Players',
    players_no_players: 'No players registered yet',
    players_filter_gender: 'Gender',
    players_sort_by: 'Sort by',
    players_sort_name: 'Name',

    // Match types
    match_mens_singles: "Men's Singles",
    match_womens_singles: "Women's Singles",
    match_mens_doubles: "Men's Doubles",
    match_womens_doubles: "Women's Doubles",
    match_mixed_doubles: "Mixed Doubles",

    // Event page
    event_title: 'Event Details',
    event_date: 'Date',
    event_location: 'Location',
    event_status: 'Status',
    event_time_slots: 'Time Slots',
    event_signed_players: 'Signed Up Players',
    event_no_players: 'No players signed up yet',
    event_signup_title: 'Sign Up',
    event_availability: 'Availability slots (comma-separated)',
    event_preferred_types: 'Preferred match types',
    event_signup_status: 'Current signup status',
    event_not_signed: 'not signed',
    event_submit_signup: 'Submit Signup',
    event_signup_success: 'Signed up',
    event_signup_failed: 'Signup failed',
    event_profile_incomplete: 'Please complete your profile (name, gender, NTRP) before signing up',
    event_no_profile: 'Please create your profile before signing up',
    event_withdraw: 'Withdraw',

    // Profile page
    profile_title: 'My Profile',
    profile_name: 'Name',
    profile_gender: 'Gender',
    profile_ntrp: 'NTRP Rating',
    profile_save: 'Save Profile',
    profile_language: 'Language',
    profile_switch_lang: 'Switch Language',

    // Settings page
    settings_title: 'Settings',

    // Matches page
    matches_title: 'My Matches',
    matches_no_matches: 'No matches found',
    matches_vs: 'vs',
    matches_pending: 'Pending',
    matches_completed: 'Completed',

    // Stats page
    stats_title: 'Statistics',
    stats_wins: 'Wins',
    stats_losses: 'Losses',
    stats_points: 'Points',
    stats_win_rate: 'Win Rate',
    stats_matches_played: 'Matches Played',

    // Admin page
    admin_title: 'Admin Panel',
    admin_create_season: 'Create Season',
    admin_seasons: 'Seasons',
    admin_season_name: 'Name',
    admin_start_date: 'Start Date',
    admin_end_date: 'End Date',
    admin_status: 'Status',
    admin_set_active: 'Set Active',
    admin_points_win: 'Points Win',
    admin_points_loss: 'Points Loss',
    admin_create_event: 'Create Event',
    admin_event_title: 'Title',
    admin_time_slots: 'Time slots (comma-separated)',
    admin_match_types: 'Match Types',
    admin_manage_events: 'Manage Events',
    admin_generate_matchups: 'Generate Matchups',
    admin_approve_matchups: 'Approve Matchups',
    admin_regenerate_matchups: 'Regenerate Matchups',
    admin_enter_result: 'Enter Result',
    admin_mode: 'Mode',
    admin_from_matchmaking: 'From Matchmaking',
    admin_adhoc_match: 'Ad-hoc Match',
    admin_select_event: 'Select Event',
    admin_select_match: 'Select Match',
    admin_no_pending_matches: 'No pending matches for this event',
    admin_match_type: 'Match Type',
    admin_team_a: 'Team A',
    admin_team_b: 'Team B',
    admin_set_scores: 'Set Scores',
    admin_add_set: '+ Add Set',
    admin_remove_set: '- Remove Set',
    admin_winner: 'Winner',
    admin_team_a_wins: 'Team A Wins',
    admin_team_b_wins: 'Team B Wins',
    admin_save_result: 'Save Result',
    admin_select_winner: 'Select a winner',
    admin_select_match_first: 'Select a match',
    admin_select_players: 'Select players for both teams',
    admin_result_saved: 'Result saved',
    admin_upsert_player: 'Add Player',
    admin_player_id: 'Player ID',
    admin_csv_export: 'CSV Export',
    admin_csv_import: 'CSV Import',
    admin_collection: 'Collection',
    admin_export: 'Export CSV',
    admin_import: 'Import CSV',
    admin_players: 'Players',
    admin_adjust_points: 'Adjust Season Points',
    admin_delta_points: 'Points to Add/Subtract',
    admin_reason: 'Reason',
    admin_apply_adjustment: 'Apply Adjustment',
    admin_signup: 'Admin Signup',
    admin_signup_desc: 'Sign up a player for an event',
    admin_signup_player: 'Sign Up Player',
    admin_select_player: 'Select player...',
    admin_select_event_first: 'Select event first',
    admin_view_matchups: 'View Matchups',
    admin_set_as_active: 'Set as Active Season',
    admin_set_active_hint: 'If checked, this becomes the active season and deactivates the previous one',
    admin_deactivate: 'Deactivate',
    admin_season_status_active: 'Active',
    admin_season_status_closed: 'Closed',
    admin_season_status_inactive: 'Inactive',
    admin_season_current: 'Current',
    admin_tap_to_view: 'Tap to view match results',
    admin_player_id_hint: 'Player ID (leave blank to add new)',
    admin_active_toggle: 'Active (true/false)',
    admin_notes: 'Notes',
    admin_save_player: 'Save Player',
    admin_delete_player: 'Delete Player',
    admin_confirm_delete_player: 'Are you sure you want to delete this player?',
    admin_complete_event: 'Complete Event',
    admin_reopen_event: 'Reopen Event',
    admin_need_players: 'Need at least 2 players signed up',

    // Season page
    season_points: 'Points',

    // Index page
    index_welcome: 'Welcome to Tennis League',
    index_upcoming_events: 'Upcoming Events',
    index_no_events: 'No upcoming events',
    index_view_event: 'View Event'
  },

  zh: {
    // Navigation
    nav_home: '首页',
    nav_events: '活动',
    nav_profile: '个人',
    nav_register: '注册',
    nav_matches: '我的比赛',
    nav_stats: '统计',
    nav_players: '球员',
    nav_admin: '管理',
    nav_settings: '设置',

    // Common
    common_loading: '加载中...',
    common_save: '保存',
    common_cancel: '取消',
    common_submit: '提交',
    common_search: '搜索',
    common_select: '选择',
    common_unknown: '未知',
    common_unnamed: '未命名',
    common_none: '无',
    common_all: '全部',
    common_yes: '是',
    common_no: '否',

    // Error messages
    error_missing_fields: '请填写所有必填项',
    error_missing_event_fields: '请填写活动详情',
    error_missing_winner: '请选择获胜方',
    error_permission_denied: '权限不足',
    error_player_not_found: '未找到球员',
    error_event_not_found: '未找到活动',

    // Gender
    gender_male: '男',
    gender_female: '女',

    // Players page
    players_title: '所有球员',
    players_no_players: '暂无注册球员',
    players_filter_gender: '性别',
    players_sort_by: '排序',
    players_sort_name: '姓名',

    // Match types
    match_mens_singles: '男子单打',
    match_womens_singles: '女子单打',
    match_mens_doubles: '男子双打',
    match_womens_doubles: '女子双打',
    match_mixed_doubles: '混合双打',

    // Event page
    event_title: '活动详情',
    event_date: '日期',
    event_location: '地点',
    event_status: '状态',
    event_time_slots: '时间段',
    event_signed_players: '已报名球员',
    event_no_players: '暂无球员报名',
    event_signup_title: '报名',
    event_availability: '可用时间段（逗号分隔）',
    event_preferred_types: '偏好的比赛类型',
    event_signup_status: '当前报名状态',
    event_not_signed: '未报名',
    event_submit_signup: '提交报名',
    event_signup_success: '报名成功',
    event_signup_failed: '报名失败',
    event_profile_incomplete: '报名前请先完善个人资料（姓名、性别、NTRP等级）',
    event_no_profile: '报名前请先创建个人资料',
    event_withdraw: '取消报名',

    // Profile page
    profile_title: '我的资料',
    profile_name: '姓名',
    profile_gender: '性别',
    profile_ntrp: 'NTRP等级',
    profile_save: '保存资料',
    profile_language: '语言',
    profile_switch_lang: '切换语言',

    // Settings page
    settings_title: '设置',

    // Matches page
    matches_title: '我的比赛',
    matches_no_matches: '暂无比赛记录',
    matches_vs: '对',
    matches_pending: '待进行',
    matches_completed: '已完成',

    // Stats page
    stats_title: '统计数据',
    stats_wins: '胜场',
    stats_losses: '负场',
    stats_points: '积分',
    stats_win_rate: '胜率',
    stats_matches_played: '比赛场次',

    // Admin page
    admin_title: '管理后台',
    admin_create_season: '创建赛季',
    admin_seasons: '赛季列表',
    admin_season_name: '名称',
    admin_start_date: '开始日期',
    admin_end_date: '结束日期',
    admin_status: '状态',
    admin_set_active: '设为当前',
    admin_points_win: '胜场积分',
    admin_points_loss: '负场积分',
    admin_create_event: '创建活动',
    admin_event_title: '标题',
    admin_time_slots: '时间段（逗号分隔）',
    admin_match_types: '比赛类型',
    admin_manage_events: '管理活动',
    admin_generate_matchups: '生成对阵',
    admin_approve_matchups: '确认对阵',
    admin_regenerate_matchups: '重新生成对阵',
    admin_enter_result: '录入结果',
    admin_mode: '模式',
    admin_from_matchmaking: '从对阵选择',
    admin_adhoc_match: '自定义比赛',
    admin_select_event: '选择活动',
    admin_select_match: '选择比赛',
    admin_no_pending_matches: '该活动暂无待处理的比赛',
    admin_match_type: '比赛类型',
    admin_team_a: 'A队',
    admin_team_b: 'B队',
    admin_set_scores: '各盘比分',
    admin_add_set: '+ 添加一盘',
    admin_remove_set: '- 移除一盘',
    admin_winner: '胜方',
    admin_team_a_wins: 'A队获胜',
    admin_team_b_wins: 'B队获胜',
    admin_save_result: '保存结果',
    admin_select_winner: '请选择胜方',
    admin_select_match_first: '请选择比赛',
    admin_select_players: '请为双方选择球员',
    admin_result_saved: '结果已保存',
    admin_upsert_player: '添加球员',
    admin_player_id: '球员ID',
    admin_csv_export: 'CSV导出',
    admin_csv_import: 'CSV导入',
    admin_collection: '数据集',
    admin_export: '导出CSV',
    admin_import: '导入CSV',
    admin_players: '球员列表',
    admin_adjust_points: '调整赛季积分',
    admin_delta_points: '增减积分',
    admin_reason: '原因',
    admin_apply_adjustment: '应用调整',
    admin_signup: '管理员报名',
    admin_signup_desc: '为球员报名活动',
    admin_signup_player: '报名球员',
    admin_select_player: '选择球员...',
    admin_select_event_first: '请先选择活动',
    admin_view_matchups: '查看对阵',
    admin_set_as_active: '设为当前赛季',
    admin_set_active_hint: '勾选后将设为当前赛季，并取消上一个赛季的激活状态',
    admin_deactivate: '取消激活',
    admin_season_status_active: '进行中',
    admin_season_status_closed: '已结束',
    admin_season_status_inactive: '未激活',
    admin_season_current: '当前',
    admin_tap_to_view: '点击查看比赛结果',
    admin_player_id_hint: '球员ID（留空则新增）',
    admin_active_toggle: '是否激活',
    admin_notes: '备注',
    admin_save_player: '保存球员',
    admin_delete_player: '删除球员',
    admin_confirm_delete_player: '确定要删除这个球员吗？',
    admin_complete_event: '结束活动',
    admin_reopen_event: '重新开放',
    admin_need_players: '至少需要2名球员报名',

    // Season page
    season_points: '积分',

    // Index page
    index_welcome: '欢迎来到网球联赛',
    index_upcoming_events: '即将举行的活动',
    index_no_events: '暂无即将举行的活动',
    index_view_event: '查看活动'
  }
};

let currentLang = null;

function init() {
  if (currentLang) return currentLang;
  const saved = wx.getStorageSync('app_language');
  if (saved) {
    currentLang = saved;
    return saved;
  }
  try {
    const info = wx.getSystemInfoSync();
    currentLang = (info.language || '').startsWith('en') ? 'en' : 'zh';
  } catch (e) {
    currentLang = 'zh';
  }
  return currentLang;
}

function getLang() {
  return currentLang || init();
}

function setLang(lang) {
  if (lang !== 'en' && lang !== 'zh') {
    lang = 'zh';
  }
  currentLang = lang;
  wx.setStorageSync('app_language', lang);
  return lang;
}

function getStrings() {
  const lang = getLang();
  return strings[lang] || strings.zh;
}

function t(key) {
  const strs = getStrings();
  return strs[key] || key;
}

const errorCodeMap = {
  'MISSING_FIELDS': 'error_missing_fields',
  'PERMISSION_DENIED': 'error_permission_denied',
  'PLAYER_NOT_FOUND': 'error_player_not_found',
  'EVENT_NOT_FOUND': 'error_event_not_found'
};

function translateError(errorMessage, context) {
  const strs = getStrings();
  if (context === 'event' && errorMessage === 'MISSING_FIELDS') {
    return strs.error_missing_event_fields || errorMessage;
  }
  if (context === 'winner' && errorMessage === 'MISSING_FIELDS') {
    return strs.error_missing_winner || errorMessage;
  }
  const i18nKey = errorCodeMap[errorMessage];
  if (i18nKey && strs[i18nKey]) {
    return strs[i18nKey];
  }
  return errorMessage;
}

module.exports = {
  init,
  getLang,
  setLang,
  getStrings,
  t,
  translateError,
  strings
};
