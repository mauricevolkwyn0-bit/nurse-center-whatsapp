import dotenv from 'dotenv';

dotenv.config();

const config = {
  env: process.env['NODE_ENV'] ?? 'development',
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  apiPrefix: process.env['API_PREFIX'] ?? '/api/v1',
  logLevel: process.env['LOG_LEVEL'] ?? 'info',
  whatsapp: {
    verifyToken:   process.env['WHATSAPP_VERIFY_TOKEN']    ?? '',
    accessToken:   process.env['WHATSAPP_ACCESS_TOKEN']    ?? '',
    phoneNumberId: process.env['WHATSAPP_PHONE_NUMBER_ID'] ?? '',
    apiVersion:    process.env['WHATSAPP_API_VERSION']     ?? 'v20.0',
  },
  supabase: {
    url:        process.env['SUPABASE_URL']         ?? '',
    serviceKey: process.env['SUPABASE_SERVICE_KEY'] ?? '',
  },
  isDevelopment(): boolean {
    return this.env === 'development';
  },
  isProduction(): boolean {
    return this.env === 'production';
  },
};

export default config;
