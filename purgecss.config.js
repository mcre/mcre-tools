module.exports = {
  content: ['dist/**/*.html'],
  css: ['dist/assets/*.css'],
  safelist: {
    standard: [
      /-(leave|enter|appear)(|-(to|from|active))$/,
      /^(?!(|.*?:)cursor-move).+-move$/,
      /^router-link(|-exact)-active$/,
      /^scale/,
      /^fade/,
      /button/,
      /input/,
      /select/,
      /textarea/
    ],
    greedy: [/data-v-.*/, /^v-/]
  },
  output: 'dist/assets/'
}
