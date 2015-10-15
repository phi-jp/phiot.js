
;(function() {

  var phiot = {};

  var toArray = function(arr) {
    return Array.prototype.slice.call(arr);
  };

  var unescapeHTML = function(str) {
    return str
      .replace(/(&lt;)/g, '<')
      .replace(/(&gt;)/g, '>')
      .replace(/(&quot;)/g, '"')
      .replace(/(&#39;)/g, "'")
      .replace(/(&amp;)/g, '&');
  };

  var globalEval = function(code, opts, self) {
    // var func = new Function(opts, 'return (' + code + ');').bind(self);
    // return func();

    // var element = document.createElement('script');
    // element.text = code;
    // document.body.appendChild(element);
    // document.body.removeChild(element);
  };
  window.globalEval = globalEval;

  phiot.init = function() {
    var self = this;
    this.templates = {};

    var scripts = toArray(document.scripts);
    scripts = scripts.filter(function(script) {
      return script.type === 'phiot/template';
    });

    scripts.forEach(function(script) {
      var html = script.innerHTML;
      var dom = document.createElement('div');

      // replace attribute only
      // html = html.replace(/src=/g, 'phiot-src=');
      html = html.replace(/<.*(src)=.*>/g, function(a, b, c) {
        return a.replace('src', 'phiot-src');
      });
      dom.innerHTML = html;

      var tags = toArray(dom.children);

      tags.forEach(function(tag) {
        self.templates[tag.localName] = new Template(tag);
      });
    });
  };

  phiot.mount = function(query, opts) {
    if (!document._tag) {
      new Tag(document);
    }

    var tag = document._tag;
    tag.mount(query, opts);
  };

  /*
   *
   */
  var Tag = function(domElement) {
    this.domElement = domElement;
    domElement._tag = this;
  };
  Tag.prototype.mount = function(query, opts) {
    var self = this;
    var elements = this.domElement.querySelectorAll(query);
    elements = toArray(elements);

    var tags = [];
    elements.forEach(function(element) {
      var tag = new Tag(element);
      var template = phiot.templates[query];

      if (template) {
        tag.bind(template, opts);
      }

      tags.push(tag);
    });

    return tags;
  };
  Tag.prototype.bind = function(template, opts) {
    opts = opts || {};
    eval(template.script, opts, this);
    // template.func.call(this);

    this._template = template;
    var content = template.content;
    if (template.style) {
      content += '<style scoped>' + template.style + '</style>';
    }
    this.domElement.innerHTML = content;

    this.update();

    this.onmount && this.onmount();
  };

  Tag.prototype.update = function() {
    // supported each
    var eachElements = this.domElement.querySelectorAll('[_each]');
    eachElements = toArray(eachElements);
    eachElements.forEach(function(elm) {
      var i = elm.getAttribute('_each');
      if (i == 0) {
        var origin = elm.__origin;
        elm.parentNode.insertBefore(origin, elm);
      }
      elm.remove();
    });

    var update = function(element) {
      // attribute
      if (!element.__tempAttribute) {
        element.__tempAttribute = toArray(element.attributes);
      }
      var attributes = element.__tempAttribute;
      var hasEach = attributes.some(function(attr) {
        return attr.name === 'each';
      });
      attributes.forEach(function(attr) {
        // each をもつ場合は each 以外の属性は無視
        if (hasEach && attr.name !== 'each') return ;

        var result = attr.textContent.match(/^{(.*)}$/);
        if (result) {
          var code = result[1];
          element.removeAttribute(attr.name);

          var func = attrfuncs[attr.name] || attrfuncs['*'];
          func.call(this, this, attr.name, code, element);
        }
      }, this);

      // when each
      if (!element.parentNode) return ;

      // content
      var childNodes = toArray(element.childNodes);
      var texts = childNodes.filter(function(node) {
        return node.nodeType === 3;
      });
      texts.forEach(function(textNode) {
        if (!textNode.__temp) {
          textNode.__temp = textNode.textContent;
        }
        textNode.textContent = textNode.__temp.replace(/{(.*)}/mg, function(a, b) {
          return eval(b);
        }.bind(this));
      }, this);

      // 再帰処理
      var children = toArray(element.children);
      children.forEach(function(child) {
        update(child);
      }, this);
    }.bind(this);

    update(this.domElement);

    this.onupdate && this.onupdate();
  };

  var attrfuncs = {
    '*': function(tag, key, value, element) {
      var v = eval(value);

      // event
      if (typeof v === 'function') {
        var func = function(e) {
          v.call(this, e);
          this.update();
        }.bind(this);
        element[key] = func;
      }
      // other
      else {
        key = key.replace('phiot-', '');

        element.setAttribute(key, v);
      }
    },

    'show': function(tag, key, value, element) {
      var isShow = eval(value);
      element.style.display = (isShow) ? '' : 'none';
      element.setAttribute('show', '{' + value + '}');
    },

    'checked': function(tag, key, value, element) {
      var is = eval(value);

      if (is) {
        element.setAttribute(key, '');
      }
      else {
        element.removeAttribute(key);
      }
    },

    'class': function(tag, key, value, element) {

    },

    'each': function(tag, key, value, element) {
      var result = eval(value);
      var parentNode = element.parentNode;
      var template = phiot.templates[element.localName] || (new Template(element.innerHTML));

      result.forEach(function(data, i) {
        var cloned = element.cloneNode(true);

        parentNode.insertBefore(cloned, element);
        // parentNode.appendChild(cloned);

        var childTag = new Tag(cloned);
        childTag.parent = tag;
        for (var key in data) {
          var value = data[key];
          childTag[key] = value;
        }
        childTag.item = data;
        childTag.bind(template, data);

        // save replace position
        cloned.setAttribute('_each', i);
        if (i==0) {
          cloned.__origin = element;
        }
      });

      element.remove();
      element.setAttribute('each', '{' + value + '}');
    },
  };

  /*
   *
   */
  var Template = function(tag) {
    if (typeof tag === 'object') {
      var content = tag.querySelector('phiot-content') || tag.querySelector('content');
      var style = tag.querySelector('phiot-style') || tag.querySelector('style');
      var script = tag.querySelector('phiot-script') || tag.querySelector('script');

      if (content) {
        this.content = content.innerHTML;
        var type = content.getAttribute('type');
        if (type === 'jade') {
          var result = this.content.match(/^([\s]*).*\n/);
          var indent = result[1].replace('\n', '');
          this.content = this.content.replace(new RegExp('^' + indent, 'gm'), '');
          this.content = jade.render(this.content, {pretty: true, doctype: 'html'})
        }
      }

      this.style = style && style.innerHTML;
      this.script = script && script.innerHTML;

      this.script = unescapeHTML(this.script);
    }
    else {
      this.content = tag;
      this.style = '';
      this.script = '';
    }

    // this.func = new Function(this.script);
  };

  window.phiot = phiot;

})();


