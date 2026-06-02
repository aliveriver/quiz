/**
 * 设备信息探测模块
 * 
 * 安全地获取浏览器/设备信息，仅使用不需要用户显式授权的 API。
 * 用于生成个性化的 Meta 演出文案。
 * 
 * ⚠️ 不采集地理位置
 */

/**
 * 获取电池信息
 * @returns {Promise<{level: number}|null>}
 */
async function getBatteryInfo() {
  try {
    if (navigator.getBattery) {
      const battery = await navigator.getBattery();
      return {
        level: Math.round(battery.level * 100),
      };
    }
  } catch (e) {
    // 部分浏览器不支持
  }
  return null;
}

/**
 * 获取用户代理信息
 */
function getUserAgentInfo() {
  const ua = navigator.userAgent;

  // 简单解析设备类型
  let deviceType = 'desktop';
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/Tablet|iPad/i.test(ua)) {
    deviceType = 'tablet';
  }

  // 简单解析浏览器
  let browser = 'unknown';
  if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) browser = 'Chrome';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Edge/i.test(ua)) browser = 'Edge';

  return {
    raw: ua,
    deviceType,
    browser,
  };
}

/**
 * 获取语言信息
 */
function getLanguageInfo() {
  return {
    language: navigator.language,
    languages: navigator.languages ? [...navigator.languages] : [navigator.language],
  };
}

/**
 * 获取当前时间信息
 */
function getTimeInfo() {
  const now = new Date();
  const weekdayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const month = now.getMonth() + 1;
  const date = now.getDate();
  const hour = now.getHours();
  const minute = now.getMinutes();
  let dayPeriod = '白天';

  if (hour >= 5 && hour < 8) dayPeriod = '清晨';
  else if (hour >= 8 && hour < 12) dayPeriod = '上午';
  else if (hour >= 12 && hour < 14) dayPeriod = '中午';
  else if (hour >= 14 && hour < 18) dayPeriod = '下午';
  else if (hour >= 18 && hour < 22) dayPeriod = '夜晚';
  else dayPeriod = '深夜';

  return {
    year: now.getFullYear(),
    month,
    date,
    hour,
    minute,
    weekday: now.getDay(),
    weekdayName: weekdayNames[now.getDay()],
    dayPeriod,
    isLateNight: hour >= 22 || hour < 5,
    isEarlyMorning: hour >= 5 && hour < 8,
    isMorning: hour >= 8 && hour < 12,
    isAfternoon: hour >= 14 && hour < 18,
    isNight: hour >= 18 || hour < 5,
    isWeekend: now.getDay() === 0 || now.getDay() === 6,
    localDate: now.toLocaleDateString('zh-CN'),
    localTime: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    readable: `${month}月${date}日${weekdayNames[now.getDay()]}${dayPeriod}${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    timeZoneOffsetMinutes: now.getTimezoneOffset(),
    timestamp: now.toISOString(),
  };
}

/**
 * 收集所有设备信息
 * @returns {Promise<object>}
 */
async function collectDeviceInfo() {
  const battery = await getBatteryInfo();
  const ua = getUserAgentInfo();
  const lang = getLanguageInfo();
  const time = getTimeInfo();

  return {
    battery,
    userAgent: ua,
    language: lang,
    time,
  };
}

/**
 * 根据设备信息生成穿透力文案片段
 * 这些片段可以被 LLM 或本地逻辑使用
 */
function generateDeviceHints(deviceInfo) {
  const hints = [];

  // 电量提示
  if (deviceInfo.battery) {
    const level = deviceInfo.battery.level;
    if (level <= 15) {
      hints.push(`你的手机只剩 ${level}% 的电了……如果关机了，我们是不是就断开了？`);
    } else if (level <= 30) {
      hints.push(`${level}% 的电量……你还愿意把它花在这里吗？`);
    }
  }

  // 深夜提示
  if (deviceInfo.time && deviceInfo.time.isLateNight) {
    const hour = deviceInfo.time.hour;
    if (hour >= 1 && hour < 4) {
      hints.push(`凌晨 ${hour} 点了……你还没睡。`);
    } else if (hour >= 22) {
      hints.push('这么晚了……你是一个人吗？');
    }
  }

  return hints;
}

export {
  getBatteryInfo,
  getUserAgentInfo,
  getLanguageInfo,
  getTimeInfo,
  collectDeviceInfo,
  generateDeviceHints,
};
