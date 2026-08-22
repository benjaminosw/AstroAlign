/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: isGitHubPages ? '/AstroAlign' : '',
  trailingSlash: true,
  images: {
    unoptimized: true
  }
};

export default nextConfig;
