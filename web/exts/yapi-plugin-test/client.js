function hander(routers) {
  routers.test = {
    name: 'test',
    component: ()=> 'hello world.'
  };
}

export default function() {
  this.bindHook('sub_setting_nav', hander);
}
