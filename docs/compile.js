var fs = require('fs');
var isImage = require('is-image');
var isRelativeUrl = require('is-relative-url');
var MarkdownIt = require('markdown-it');
var nunjucks = require('nunjucks');
var path = require('path');

// Prepare Markdown compiler
var repositoryUrl = require('../package.json').repository;
var markdownCompiler = MarkdownIt({
  // Make sure relative links will correctly link to repository URLs
  replaceLink: function(url){
    if(isRelativeUrl(url)){
      if(isImage(url)){
        return url.replace(/^docs\//, '');
      }
      return repositoryUrl + '/blob/master/' + url;
    }
    else {
      return url;
    }
  }
}).use(require('markdown-it-replace-link'));

// Compile the README.md and generate index.html
fs.writeFileSync('docs/index.html', nunjucks.render('docs/index.template.html', {
  content: markdownCompiler.render(fs.readFileSync('README.md').toString('utf8'))
}));