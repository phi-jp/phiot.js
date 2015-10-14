
;(function() {

  var phiot = {};

  phiot.init = function() {
    var self = this;
    this.templates = {};

    var scripts = Array.prototype.slice.call(document.scripts);
    scripts = scripts.filter(function(script) {
      return script.type === 'phiot/template';
    });

    scripts.forEach(function(script) {
      var html = script.innerHTML;
      var dom = document.createElement('div');

      html = html.replace(/src=/g, 'phiot-src=');
      dom.innerHTML = html;

      var tags = Array.prototype.slice.call(dom.children);

      tags.forEach(function(tag) {
        self.templates[tag.localName] = new Template(tag);
      });
    });
  };

  phiot.mount = function(query) {
    if (!document._tag) {
      new Tag(document);
    }

    var tag = document._tag;
    tag.mount(query);
  };

  /*
   *
   */
  var Tag = function(domElement) {
    this.domElement = domElement;
    domElement._tag = this;
  };
  Tag.prototype.mount = function(query) {
    var self = this;
    var elements = this.domElement.querySelectorAll(query);
    elements = Array.prototype.slice.call(elements);

    var tags = [];
    elements.forEach(function(element) {
      var tag = new Tag(element);
      var template = phiot.templates[query];

      if (template) {
        tag.bind(template);
      }

      tags.push(tag);
    });

    return tags;
  };
  Tag.prototype.bind = function(template) {
    template.func.call(this);

    this._template = template;
    var content = template.content + '<style>' + template.style + '</style>';
    this.domElement.innerHTML = content;

    this.update();

    this.onmount && this.onmount();
  };

  Tag.prototype.update = function() {
    // supported each
    var eachElements = this.domElement.querySelectorAll('[_each]');
    eachElements = Array.prototype.slice.call(eachElements);
    eachElements.forEach(function(elm) {
      var i = elm.getAttribute('_each');
      if (i == 0) {
        var origin = elm.__origin;
        elm.parentNode.insertBefore(origin, elm);
      }
      elm.remove();
    });

    var elements = this.domElement.querySelectorAll('*');
    elements = Array.prototype.slice.call(elements);
    elements.unshift(this.domElement);

    elements.forEach(function(element) {
      // attribute
      var attributes = Array.prototype.slice.call(element.attributes);
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
      var childNodes = Array.prototype.slice.call(element.childNodes);
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

    'each': function(tag, key, value, element) {
      var result = eval(value);
      var parent = element.parentNode;
      var template = new Template(element.outerHTML);

      result.forEach(function(data, i) {
        var cloned = element.cloneNode(true);

        parent.insertBefore(cloned, element);
        // parent.appendChild(cloned);

        var tag = new Tag(cloned);
        for (var key in data) {
          var value = data[key];
          tag[key] = value;
        }
        tag.bind(template);

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
    }
    else {
      this.content = tag;
      this.style = '';
      this.script = '';
    }

    this.func = new Function(this.script);
  };

  window.phiot = phiot;

})();


