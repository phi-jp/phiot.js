
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

    var elements = this.domElement.querySelectorAll('*');
    elements = toArray(elements);
    elements.unshift(this.domElement);

    elements.forEach(function(element) {
      // attribute
      var attributes = toArray(element.attributes);
      attributes.forEach(function(attr) {
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
    }, this);

    this.onupdate && this.onupdate();
  };

  var attrfuncs = {
    '*': function(tag, key, value, element) {
      // event
      if (/^on/.test(key)) {
        element[key] = new Function('e', value+'(e)').bind(this);
      }
      // other
      else {
        key = key.replace('phiot-', '');

        value = eval(value);
        element.setAttribute(key, value);
      }
    },

    'show': function(tag, key, value, element) {
      var isShow = eval(value);

      if (isShow) {
        element.style.display = '';
      }
      else {
        element.style.display = 'none';
      }

      element.setAttribute('show', '{' + value + '}');
    },

    'each': function(tag, key, value, element) {
      var result = eval(value);
      var parent = element.parentNode;
      var template = phiot.templates[element.localName] || (new Template(element.outerHTML));

      result.forEach(function(data, i) {
        var cloned = element.cloneNode(true);

        parent.insertBefore(cloned, element);
        // parent.appendChild(cloned);

        var tag = new Tag(cloned);
        for (var key in data) {
          var value = data[key];
          tag[key] = value;
        }
        tag.bind(template, data);

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
      var content = tag.querySelector('phiot-content')
      var style = tag.querySelector('phiot-style');
      var script = tag.querySelector('phiot-script');

      this.content = content && content.innerHTML;
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


