const yaml = require('js-yaml')
const markdownIt = require('markdown-it')

const md = new markdownIt(({
    highlight: function (str, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return `<pre class="hljs"><code>${hljs.highlight(lang, str, true).value}</code></pre>`
            } catch (_) { }
        }

        return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
    },
    linkify: true,
    html: true
})).use(md => {
    md.core.ruler.push('linker', state => {
        const tokens = state.tokens
        const Token = state.Token
        tokens
            .filter(token => token.type === 'heading_open')
            .forEach(token => {
                const id = tokens[tokens.indexOf(token) + 1].children
                    .filter(token => token.type === 'text' || token.type === 'code_inline')
                    .reduce((all, t) => all + t.content, '')
                    .toLowerCase()
                    .replace(/[^\w\d-]/g, '')
                    .replace(' ', '-')
                token.attrSet('id', id)
                const textNode = state.tokens[state.tokens.indexOf(token) + 1]
                textNode.children.unshift(
                    Object.assign(new Token('slug_open', 'a', 1), {
                        attrs: [
                            ['class', 'slug'],
                            ['href', '#' + id]
                        ]
                    }),
                    Object.assign(new Token('html_block', '', 0), { content: '#' }),
                    new Token('slug_close', 'a', -1),
                    Object.assign(new Token('text', '', 0), { content: ' ' })
                )
            })
    })
})

/**
 * 
 * @param {string} x 
 * @param {number} index 
 * @returns {string[]}
 */
const splitAt = (x, index) => [x.slice(0, index), x.slice(index)]

/**
* 
* @param {string} source 
*/
exports.parseMD = async function parseMD(source) {
   const res = {
       info: {},
       html: ''
   }
   if (source.startsWith("---")) {
       const index = source.indexOf("\n...") + 5
       let [yml, src] = splitAt(source, index)
       source = src
       yml = yml.substring(4, yml.length - 5)
       res.info = yaml.load(yml)
   }
   res.html = md.render(source)
   return res
}