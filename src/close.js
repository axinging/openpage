const robot = require('robotjs');

// 模拟按下 Alt + F4
function simulateAltF4() {
  // 按下 Alt 键
  robot.keyToggle('alt', 'down');
  
  // 按下 F4 键
  robot.keyToggle('f4', 'down');
  robot.keyToggle('f4', 'up');
  
  // 释放 Alt 键
  robot.keyToggle('alt', 'up');
}

// 使用
simulateAltF4();