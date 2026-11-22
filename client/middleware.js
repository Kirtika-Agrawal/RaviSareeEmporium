// The home page is a real file (index.html), and Vercel serves files before
// applying vercel.json rewrites, so the chat-app bot rule there never fires
// for "/". Middleware runs first. Keep this list in step with vercel.json.
const LINK_PREVIEW_BOTS = /WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|Slackbot|LinkedInBot|Discordbot|Pinterestbot|SkypeUriPreview|Viber/;

export const config = { matcher: '/' };

export default function middleware(request) {
  const url = new URL(request.url);
  if (url.searchParams.has('app') || !LINK_PREVIEW_BOTS.test(request.headers.get('user-agent') || '')) {
    return undefined;
  }
  const preview = new URL('/api/link-preview', url);
  const category = url.searchParams.get('category');
  if (category) preview.searchParams.set('category', category);
  return new Response(null, { headers: { 'x-middleware-rewrite': preview.toString() } });
}
