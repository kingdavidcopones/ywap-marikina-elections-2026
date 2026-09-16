import {defineTheme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral';

export const ywapTheme = defineTheme({
  name: 'ywap-marikina',
  extends: neutralTheme,
  tokens: {
    '--color-accent': '#3573B8',
    '--color-accent-muted': '#3573B829',
    '--color-text-accent': '#255E9D',
    '--color-icon-accent': '#3573B8',
    '--color-background-body': '#FEFFFF',
    '--color-background-blue': '#3573B81F',
    '--color-border-blue': '#3573B8',
    '--color-background-yellow': '#F8C21729',
    '--color-border-yellow': '#F8C217',
    '--color-background-orange': '#EF5F291F',
    '--color-border-orange': '#EF5F29',
    '--color-background-cyan': '#57B5E126',
    '--color-border-cyan': '#57B5E1',
    '--font-family-body': '"Figtree Variable", Figtree, Arial, sans-serif',
    '--font-family-heading': '"Figtree Variable", Figtree, Arial, sans-serif',
  },
});
