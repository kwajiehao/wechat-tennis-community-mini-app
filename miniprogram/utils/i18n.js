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
    error_ntrp_required: 'NTRP rating is required',
    error_cannot_regenerate: 'Cannot regenerate matchups once event is in progress',
    error_event_not_in_progress: 'Event must be in progress to complete',
    error_event_not_open: 'Cannot withdraw once event is in progress',
    error_event_full: 'Event is full (max 9 players)',
    error_male_limit_reached: 'Male limit reached (max 5 men)',

    // Gender
    gender_male: 'Male',
    gender_female: 'Female',

    // Players page
    players_title: 'All Players',
    players_no_players: 'No players registered yet',
    players_filter_gender: 'Gender',
    players_sort_by: 'Sort by',
    players_sort_name: 'Name',
    players_test_player: 'Test',

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
    event_status_signed: 'signed up',
    event_submit_signup: 'Submit Signup',
    event_signup_success: 'Signed up',
    event_signup_failed: 'Signup failed',
    event_withdraw_failed: 'Withdraw failed',
    event_profile_incomplete: 'Please complete your profile (name, gender, NTRP) before signing up',
    event_no_profile: 'Please create your profile before signing up',
    event_withdraw: 'Withdraw',
    event_matches: 'Matches',
    event_winner: 'Winner',
    event_pending: 'Pending',
    event_completed_notice: 'This event has been completed',
    event_signed_at: 'Signed up',

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
    admin_tap_to_manage: 'Tap to manage',
    admin_player_id_hint: 'Player ID (leave blank to add new)',
    admin_active_toggle: 'Active (true/false)',
    admin_notes: 'Notes',
    admin_save_player: 'Save Player',
    admin_delete_player: 'Delete Player',
    admin_confirm_delete_player: 'Are you sure you want to delete this player?',
    admin_complete_event: 'Complete Event',
    admin_reopen_event: 'Reopen Event',
    admin_need_players: 'Need at least 2 players signed up',
    admin_min_players_hint: 'Minimum 4 players required',
    admin_match_started_hint: 'Matches have started - cannot regenerate',
    event_status_match_started: 'Match Started',
    admin_test_players: 'Test Players',
    admin_test_players_desc: 'Manage test players for matchup testing',
    admin_add_test_player: 'Add Test Player',
    admin_remove_test_player: 'Remove Test Player',
    admin_signup_players: 'Sign Up Players',
    admin_signup_players_desc: 'Sign up players for events',
    admin_select_player_event: 'Select player and event',
    admin_player_signed_up: 'Player signed up',
    admin_add_matchup: '+ Add Matchup',
    admin_no_matchups: 'No matchups yet',
    admin_confirm_delete_matchup: 'Delete this matchup?',
    admin_confirm_remove_player: 'Remove this player from event?',
    admin_matchups_removed_regen: 'Matchups involving this player were removed. Regenerate matchups?',
    admin_confirm_regenerate: 'This will remove existing matchups and create new ones. Continue?',
    admin_add_player: '+ Add Player',
    admin_start_time: 'Start Time',
    admin_end_time: 'End Time',
    admin_set_label: 'Set',
    admin_tiebreak: 'TB',
    admin_tiebreak_score: 'Tiebreak score (loser)',
    admin_waitlist: 'Waitlist',

    // Toast messages
    toast_failed_load_stats: 'Failed to load stats',
    toast_failed_load_season_stats: 'Failed to load season stats',
    toast_failed_load_events: 'Failed to load events',
    toast_failed_load_event: 'Failed to load event',
    toast_failed_load_players: 'Failed to load players',
    toast_failed_load_seasons: 'Failed to load seasons',
    toast_failed_load_matches: 'Failed to load matches',
    toast_failed_load_matchups: 'Failed to load matchups',
    toast_failed_load_leaderboard: 'Failed to load leaderboard',
    toast_signed_up: 'Signed up',
    toast_withdrawn: 'Withdrawn',
    toast_saved: 'Saved',
    toast_deleted: 'Deleted',
    toast_removed: 'Removed',
    toast_season_created: 'Season created',
    toast_event_created: 'Event created',
    toast_event_completed: 'Event completed',
    toast_event_reopened: 'Event reopened',
    toast_adjusted: 'Adjusted',
    toast_generated: 'Generated',
    toast_matchup_added: 'Matchup added',
    toast_approved: 'Approved',
    toast_regenerated: 'Regenerated',
    toast_result_saved: 'Result saved',
    toast_test_player_added: 'Test player added',
    toast_select_winner: 'Select a winner',
    toast_select_match: 'Select a match',
    toast_select_players: 'Select players for both teams',
    toast_activated: 'Activated',
    toast_deactivated: 'Deactivated',
    toast_player_signed_up: 'Player signed up',

    // Season page
    season_title: 'Season',
    season_points: 'Points',
    season_leaderboard: 'Leaderboard',
    season_no_results: 'No match results yet',
    season_all_matches: 'All Matches',
    season_recent_matches: 'Recent Matches',
    season_show_recent: 'Show Recent',
    season_view_all: 'View All',
    season_no_matches: 'No matches recorded for this season yet',

    // Index page
    index_welcome: 'Welcome to Tennis League',
    index_upcoming_events: 'Upcoming Events',
    index_no_events: 'No upcoming events',
    index_view_event: 'View Event',
    index_completed_events: 'My Completed Events',

    // Event scoring
    admin_compute_score: 'Compute Score',
    admin_compute_score_title: 'Compute Final Score',
    admin_compute_score_warning: 'This will calculate the final leaderboard and lock the event. You will not be able to reopen it. Continue?',
    admin_tie_breaker_title: 'Tie Detected',
    admin_tie_breaker_desc: 'These players are tied on wins and game difference. Select the champion:',
    admin_select_champion: 'Select a champion',
    event_leaderboard: 'Leaderboard',
    event_score_locked: 'Score finalized',
    common_confirm: 'Confirm',
    common_remarks: 'Remarks',
    toast_score_computed: 'Score computed',

    // Error messages for scoring
    error_event_locked: 'Event is locked and cannot be reopened',
    error_score_already_computed: 'Score has already been computed',
    error_invalid_champion: 'Invalid champion selection'
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
    error_ntrp_required: 'NTRP等级为必填项',
    error_cannot_regenerate: '活动进行中无法重新生成对阵',
    error_event_not_in_progress: '活动必须处于进行中状态才能完成',
    error_event_not_open: '活动进行中无法取消报名',
    error_event_full: '活动已满（最多9人）',
    error_male_limit_reached: '男性名额已满（最多5人）',

    // Gender
    gender_male: '男',
    gender_female: '女',

    // Players page
    players_title: '所有球员',
    players_no_players: '暂无注册球员',
    players_filter_gender: '性别',
    players_sort_by: '排序',
    players_sort_name: '姓名',
    players_test_player: '测试',

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
    event_status_signed: '已报名',
    event_submit_signup: '提交报名',
    event_signup_success: '报名成功',
    event_signup_failed: '报名失败',
    event_withdraw_failed: '取消报名失败',
    event_profile_incomplete: '报名前请先完善个人资料（姓名、性别、NTRP等级）',
    event_no_profile: '报名前请先创建个人资料',
    event_withdraw: '取消报名',
    event_matches: '比赛',
    event_winner: '胜',
    event_pending: '待定',
    event_completed_notice: '此活动已结束',
    event_signed_at: '报名时间',

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
    admin_tap_to_manage: '点击管理',
    admin_player_id_hint: '球员ID（留空则新增）',
    admin_active_toggle: '是否激活',
    admin_notes: '备注',
    admin_save_player: '保存球员',
    admin_delete_player: '删除球员',
    admin_confirm_delete_player: '确定要删除这个球员吗？',
    admin_complete_event: '结束活动',
    admin_reopen_event: '重新开放',
    admin_need_players: '至少需要2名球员报名',
    admin_min_players_hint: '至少需要4名球员',
    admin_match_started_hint: '比赛已开始 - 无法重新生成',
    event_status_match_started: '比赛中',
    admin_test_players: '测试球员',
    admin_test_players_desc: '管理用于测试对阵的球员',
    admin_add_test_player: '添加测试球员',
    admin_remove_test_player: '删除测试球员',
    admin_signup_players: '球员报名',
    admin_signup_players_desc: '为球员报名活动',
    admin_select_player_event: '请选择球员和活动',
    admin_player_signed_up: '球员已报名',
    admin_add_matchup: '+ 添加对阵',
    admin_no_matchups: '暂无对阵',
    admin_confirm_delete_matchup: '删除此对阵？',
    admin_confirm_remove_player: '将此球员移出活动？',
    admin_matchups_removed_regen: '涉及该球员的对阵已被移除。是否重新生成对阵？',
    admin_confirm_regenerate: '这将移除现有对阵并创建新对阵。继续？',
    admin_add_player: '+ 添加球员',
    admin_start_time: '开始时间',
    admin_end_time: '结束时间',
    admin_set_label: '第',
    admin_tiebreak: '抢七',
    admin_tiebreak_score: '抢七对方得分',
    admin_waitlist: '候补名单',

    // Toast messages
    toast_failed_load_stats: '加载统计失败',
    toast_failed_load_season_stats: '加载赛季统计失败',
    toast_failed_load_events: '加载活动失败',
    toast_failed_load_event: '加载活动失败',
    toast_failed_load_players: '加载球员失败',
    toast_failed_load_seasons: '加载赛季失败',
    toast_failed_load_matches: '加载比赛失败',
    toast_failed_load_matchups: '加载对阵失败',
    toast_failed_load_leaderboard: '加载排行榜失败',
    toast_signed_up: '报名成功',
    toast_withdrawn: '已取消',
    toast_saved: '已保存',
    toast_deleted: '已删除',
    toast_removed: '已移除',
    toast_season_created: '赛季已创建',
    toast_event_created: '活动已创建',
    toast_event_completed: '活动已结束',
    toast_event_reopened: '活动已重新开放',
    toast_adjusted: '已调整',
    toast_generated: '已生成',
    toast_matchup_added: '对阵已添加',
    toast_approved: '已确认',
    toast_regenerated: '已重新生成',
    toast_result_saved: '结果已保存',
    toast_test_player_added: '测试球员已添加',
    toast_select_winner: '请选择获胜方',
    toast_select_match: '请选择比赛',
    toast_select_players: '请为双方选择球员',
    toast_activated: '已激活',
    toast_deactivated: '已停用',
    toast_player_signed_up: '球员已报名',

    // Season page
    season_title: '赛季',
    season_points: '积分',
    season_leaderboard: '排行榜',
    season_no_results: '暂无比赛结果',
    season_all_matches: '所有比赛',
    season_recent_matches: '最近比赛',
    season_show_recent: '显示最近',
    season_view_all: '查看全部',
    season_no_matches: '本赛季暂无比赛记录',

    // Index page
    index_welcome: '欢迎来到网球联赛',
    index_upcoming_events: '即将举行的活动',
    index_no_events: '暂无即将举行的活动',
    index_view_event: '查看活动',
    index_completed_events: '我参与的已结束活动',

    // Event scoring
    admin_compute_score: '计算积分',
    admin_compute_score_title: '计算最终积分',
    admin_compute_score_warning: '这将计算最终排行榜并锁定活动。锁定后将无法重新开放。继续？',
    admin_tie_breaker_title: '检测到平局',
    admin_tie_breaker_desc: '以下球员的胜场和净胜局数相同。请选择冠军：',
    admin_select_champion: '请选择冠军',
    event_leaderboard: '排行榜',
    event_score_locked: '积分已锁定',
    common_confirm: '确认',
    common_remarks: '备注',
    toast_score_computed: '积分已计算',

    // Error messages for scoring
    error_event_locked: '活动已锁定，无法重新开放',
    error_score_already_computed: '积分已经计算过了',
    error_invalid_champion: '冠军选择无效'
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
  'EVENT_NOT_FOUND': 'error_event_not_found',
  'CANNOT_REGENERATE': 'error_cannot_regenerate',
  'EVENT_NOT_IN_PROGRESS': 'error_event_not_in_progress',
  'EVENT_NOT_OPEN': 'error_event_not_open',
  'EVENT_FULL': 'error_event_full',
  'MALE_LIMIT_REACHED': 'error_male_limit_reached',
  'MISSING_PROFILE': 'event_no_profile',
  'PROFILE_INCOMPLETE': 'event_profile_incomplete',
  'EVENT_LOCKED': 'error_event_locked',
  'SCORE_ALREADY_COMPUTED': 'error_score_already_computed',
  'INVALID_CHAMPION': 'error_invalid_champion'
};

function extractErrorCode(errorMessage) {
  if (!errorMessage) return null;
  // Check if it's already a simple error code
  if (errorCodeMap[errorMessage]) {
    return errorMessage;
  }
  // Extract error code from cloud function error format
  // Format: "...errMsg: Error: ERROR_CODE..." or "Error: ERROR_CODE"
  const patterns = [
    /errMsg:\s*Error:\s*(\w+)/,
    /Error:\s*(\w+)/
  ];
  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match && match[1] && errorCodeMap[match[1]]) {
      return match[1];
    }
  }
  return null;
}

function translateError(errorMessage, context) {
  const strs = getStrings();
  if (context === 'event' && errorMessage === 'MISSING_FIELDS') {
    return strs.error_missing_event_fields || errorMessage;
  }
  if (context === 'winner' && errorMessage === 'MISSING_FIELDS') {
    return strs.error_missing_winner || errorMessage;
  }

  // Try to extract error code from wrapped cloud function errors
  const errorCode = extractErrorCode(errorMessage) || errorMessage;
  const i18nKey = errorCodeMap[errorCode];
  if (i18nKey && strs[i18nKey]) {
    return strs[i18nKey];
  }
  return null;
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
