export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001',
  streamingUrl: process.env.NEXT_PUBLIC_STREAMING_URL || 'ws://localhost:8002',
  visualNounUrl: process.env.NEXT_PUBLIC_VISUAL_NOUN_URL || 'ws://localhost:8003',
};
