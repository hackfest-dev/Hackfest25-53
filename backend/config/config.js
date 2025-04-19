require('dotenv').config();

module.exports = {
  // Server configuration
  port: process.env.PORT || 3000,
  
  // API Keys
  apiKeys: {
    elevenLabs: process.env.ELEVEN_LABS_API_KEY || 'sk_077ac0cdba28d0ae3ede52c2b8671f8ba8a9a6f99f41d2e8',
    youtube: process.env.YOUTUBE_API_KEY || 'AIzaSyBMAQdSNhNnTiGT7Jqq65S14AgV4wmZDKM',
    groq: process.env.GROQ_API_KEY || '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'
  },
  
  // WhatsApp configuration
  whatsapp: {
    authFolder: process.env.WHATSAPP_AUTH_FOLDER || 'auth_info_baileys'
  },
  
  // Screenshot configuration
  screenshot: {
    tmpDir: process.env.SCREENSHOT_TMP_DIR || 'tmp',
    retention: process.env.SCREENSHOT_RETENTION || 3600000 // 1 hour in milliseconds
  }
};
