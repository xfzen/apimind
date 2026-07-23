import WikiPage from './wikiPage/index';
// const WikiPage = require('./wikiPage/index')

export default function() {
  this.bindHook('sub_nav', function(app) {
    app.wiki = {
      name: 'Wiki',
      path: '/project/:id/wiki',
      component: WikiPage
    };
  });
}
