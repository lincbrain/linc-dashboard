const PRODUCTION_URL = 'https://dashboard.lincbrain.org';

// Previews set these, e.g. SITE_URL=https://kabilar.github.io BASE_URL=/linc-dashboard/
const url = process.env.SITE_URL || PRODUCTION_URL;
const baseUrl = process.env.BASE_URL || '/';
const isProduction = url === PRODUCTION_URL;

// Rebuilt after every data refresh and code change
const builtAt = new Date();
const builtOn = builtAt.toLocaleDateString('en-US', {dateStyle: 'medium', timeZone: 'UTC'});

const config = {
  title: 'LINC Dashboard',
  tagline: "An overview of the LINC project's data on lincbrain.org and dandiarchive.org, for its investigators.",
  favicon: 'img/linc.logo.color+white.notext+square.png',

  url,
  baseUrl,
  organizationName: 'lincbrain',
  projectName: 'linc-dashboard',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  presets: [
    [
      'classic',
      {
        theme: {
          customCss: './src/css/custom.css',
        },
        docs: false,
        blog: false,
        // Production only
        gtag: isProduction
          ? {
              trackingID: 'G-9SBR1QJDN3',
              anonymizeIP: true,
            }
          : undefined,
      },
    ],
  ],

  themeConfig: {
    announcementBar: isProduction
      ? undefined
      : {
          id: 'preview',
          content: `This is a preview. The live dashboard is at <a href="${PRODUCTION_URL}">dashboard.lincbrain.org</a>.`,
          isCloseable: false,
        },
    navbar: {
      logo: {
        alt: 'Logo',
        src: 'img/linc.logo.color+black.alpha.notext.png',
      },
      items: [
        // Active on the home page only
        {to: '/', label: 'Overview', position: 'right', activeBaseRegex: `^${baseUrl}$`},
        {to: '/datasets', label: 'Datasets', position: 'right'},
        {to: '/files', label: 'Files', position: 'right'},
        {to: 'https://gallery.lincbrain.org', label: 'LINC Gallery ↗', position: 'right'},
        {to: 'https://connects.mgh.harvard.edu/', label: 'Project homepage ↗', position: 'right'},
      ],
    },
    footer: {
      style: 'light',
      links: [
        {
          label: 'GitHub',
          href: 'https://github.com/lincbrain/linc-dashboard',
        },
      ],
      copyright: `Updated daily, last on <time datetime="${builtAt.toISOString()}">${builtOn}</time>`,
    },
    colorMode: {
      respectPrefersColorScheme: true,
    },
  },
};

export default config;
