import {themes as prismThemes} from 'prism-react-renderer';

const config = {
  title: 'LINC Dashboard',
  staticDirectories: ['static'],
  tagline: 'A summary of all LINC-related data. It is intended for the LINC project investigators. Data is indexed daily.',
  favicon: 'img/linc.logo.color+white.notext+square.png',

  url: 'https://dashboard.lincbrain.org',
  baseUrl: '/',
  organizationName: 'lincbrain',
  projectName: 'linc-dashboard',
  trailingSlash: false,

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        theme: {
          customCss: './src/css/custom.css',
        },
        docs: false,
        gtag: {
          trackingID: 'G-9SBR1QJDN3',
          anonymizeIP: true,
        },
      },
    ],
  ],

  themeConfig:
    ({
      navbar: {
        logo: {
          alt: 'Logo',
          src: 'img/linc.logo.color+black.alpha.notext.png',
        },
        items: [
          {to: '/summary', label: 'Summary', position: 'right'},
          {to: '/files', label: 'All Files', position: 'right'},
          {to: 'https://lincbrain.org', label: 'lincbrain.org ↗', position: 'right'},
          {to: 'https://connects.mgh.harvard.edu/', label: 'Homepage ↗', position: 'right'},
        ],
      },
      footer: {
        style: 'light',
        links: [
          {
            items: [
              {
                label: 'GitHub',
                href: 'https://github.com/lincbrain/linc-dashboard',
              },
            ],
          },
          {
            items: [
              {
                html: `<div style="text-align: right;">© ${new Date().getFullYear()} LINC</div>`,
              },
            ],
          },
        ],
      },
      colorMode: {
          defaultMode: 'light',
          disableSwitch: true,
        },
      prism: {
        theme: prismThemes.github,
      },
    }),
};

export default config;
