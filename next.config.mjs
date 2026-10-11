const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'wsrv.nl' },
      { protocol: 'https', hostname: '**.wsrv.nl' },
      { protocol: 'https', hostname: 'xn--d1ah4a.com' },
      { protocol: 'https', hostname: '**.xn--d1ah4a.com' },
    ],
  },
};

export default nextConfig;
