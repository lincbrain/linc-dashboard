import {themes as prismThemes} from 'prism-react-renderer';

const config = {
  title: 'LINC Dashboard',
  staticDirectories: ['static'],
  tagline: 'Displayed is a summary of all data on lincbrain.org.  This dashboard is intended for the LINC project investigators.  Data is indexed daily.',
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
          src: 'img/linc.logo.color+white.notext.png',
        },
        items: [
          {to: '/summary', label: 'Summary', position: 'right'},
          {to: '/files', label: 'All Files', position: 'right'},
          {to: '/bids', label: 'BIDS Compliance', position: 'right'},
          {to: 'https://lincbrain.org', label: 'lincbrain.org', position: 'right'},
          {to: 'https://connects.mgh.harvard.edu/', label: 'Project Homepage', position: 'right'},
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
