/**
 * 设备信息探测模块
 * 
 * 安全地获取浏览器/设备信息，仅使用不需要用户显式授权的 API。
 * 用于生成个性化的 Meta 演出文案。
 * 
 * ⚠️ 绝对不使用 Geolocation API
 */

/**
 * 获取电池信息
 * @returns {Promise<{level: number, charging: boolean}|null>}
 */
async function getBatteryInfo() {
  try {
    if (navigator.getBattery) {
      const battery = await navigator.getBattery();
      return {
        level: Math.round(battery.level * 100),
        charging: battery.charging,
      };
    }
  } catch (e) {
    // 部分浏览器不支持
  }
  return null;
}

/**
 * 获取屏幕信息
 */
function getScreenInfo() {
  return {
    width: screen.width,
    height: screen.height,
    pixelRatio: window.devicePixelRatio || 1,
    colorDepth: screen.colorDepth,
  };
}

/**
 * 获取硬件并发数
 */
function getHardwareConcurrency() {
  return navigator.hardwareConcurrency || null;
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
  return {
    hour: now.getHours(),
    isLateNight: now.getHours() >= 22 || now.getHours() < 5,
    isWeekend: now.getDay() === 0 || now.getDay() === 6,
    timestamp: now.toISOString(),
  };
}

/**
 * 收集所有设备信息
 * @returns {Promise<object>}
 */
async function collectDeviceInfo() {
  const battery = await getBatteryInfo();
  const screen = getScreenInfo();
  const concurrency = getHardwareConcurrency();
  const ua = getUserAgentInfo();
  const lang = getLanguageInfo();
  const time = getTimeInfo();

  return {
    battery,
    screen,
    hardwareConcurrency: concurrency,
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
    if (deviceInfo.battery.charging) {
      hints.push('你在充电……是打算待久一点吗？');
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

  // 屏幕提示
  if (deviceInfo.screen) {
    const { width, height } = deviceInfo.screen;
    if (deviceInfo.userAgent && deviceInfo.userAgent.deviceType === 'mobile') {
      hints.push(`${width}×${height} 的屏幕……你现在躺在床上看手机对吧。`);
    }
  }

  return hints;
}

export {
  getBatteryInfo,
  getScreenInfo,
  getHardwareConcurrency,
  getUserAgentInfo,
  getLanguageInfo,
  getTimeInfo,
  collectDeviceInfo,
  generateDeviceHints,
};
