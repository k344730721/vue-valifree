/*!
 * vue-valifree.js v0.0.1
 * Aekley 344730721@qq.com
 * Released under the MIT License.
 */
(function (global, factory) {
  typeof exports === "object" && typeof module !== "undefined"
    ? (module.exports = factory())
    : typeof define === "function" && define.amd
    ? define(factory)
    : ((global = global || self), (global.Validator = factory()));
})(this, function () {
  /**
 * vue 校验库
 * 
 * 优点：不同于流行ui库做法：校验需写在特定组件内；此校验库基于指令，可写在任何元素上（原生标签/组件）；
 *       例如 <div v-validate:[argument].required.maxlen="['提示语',{ maxlen: 500 }]"></div>
 * 
 * 使用方法： 
 * 
 * 1.初始化：
 * import { Validator } from "@/utils/validate.js";
 * const validator = new Validator({options});
 * 2.校验
 * validator.valid(this, options, domEle, data)  
 * // this: 当前vue实例;  domEle: 若存在则仅校验该domEle下的元素； data：若存在仅校验这一个data数据对象
 * 返回值为一个promise， .then(res)  // res为: [通过校验的数据对象数组]
 * 
 * options部分属性valid这里可以总配置，也可以每一项单独配置（优先级更高）
 * 全局 options:{
 *          step,//遇到错误就会停止检测
 *          hideErr,//是否取消自动提示错误
 *          // 校验规则过滤，仅能写一个，exclude权级更高
 *          ruleFilter:{
 *              include:[], // 仅校验
 *              exclude:[], // 除此之外
 *          }
 *        }
 * 单项: options:{
 *          maxlen, //最长长度
 *          minlen, //最小长度（大于等于）
 *          filter, // 为true时才校验该项
 *          datafrom, // 该项所在的数据对象
 *        }
 * 
 * 
 * 例子：<div v-validate:[argument].required.maxlen="['提示语',{ maxlen: 500 }]"></div>
    argument:绑定值(支持点语法即 a.b.c)； modifier:校验规则； value: String|Array   ["ErrText",{maxlen,step,filter,datafrom} ]

 *  argument 解释：
    一般情况下，会直接拿argument字符串，根据vue实例的vm.$data[argument]来自动获取dataFrom；
    但是在slot里，会有作用域插槽写法（如 scope.XXX); 这时无法自动获取，也就是说，slot情况下如果需要返回数据，需要自己传入dataFrom；
    若不传，则返回结果内，没该条数据

    
 * 原理：
 * 利用了vue的directive的解析后的AST，并没用到directive的钩子，所以全局注册了个空的指令 directives:{ validate:{} },
 */

  // export const getReqMap = cached(_getReqMap, "_getReqMap")
  // import { Message } from "element-ui";

  let _Vue;
  if (typeof module !== "undefined") {
    _Vue = require("vue").default;
  } else {
    _Vue = Vue;
  }
  _Vue.directive("validate", {});

  return class Validator {
    //全局配置
    _options = {
      errorPop: null //错误提示方法 默认alert
    };

    valiTypes = {
      required: [], // [{key:"",note:"",elm:null}]
      maxlen: [],
      minlen: [],
      isTrue: [],
      noNewline: []
    };
    passedDatas = new Set();
    constructor(options) {
      injectClass();
      this._options.errorPop = options && options.errorPop;
    }
    //如果传入el，则在该el下面校验
    valid(vm, options = {}, el, data) {
      let vnode = vm._vnode;
      const vmData = vm.$data;
      if (el) {
        vnode = getVnodeByElm(el, vnode);
      }
      const validNeedVnodes = [];
      this.passedDatas = new Set();
      //清空上次保存的验证类型数组
      clearValiTypes(this.valiTypes);
      //遍历得到需要验证的节点
      getValiNeedVnodes(vnode, validNeedVnodes);
      //标准化格式/过滤
      handerValiTypes(validNeedVnodes, this.valiTypes, vmData);
      //只校验data所对应的数据
      data && filterValiTypes(data, this.valiTypes);
      // 过滤校验规则
      filterValiRules(this.valiTypes, options.ruleFilter);
      //校验规则
      //非空 最长长度 是真值
      return new Promise(resolve => {
        async function v() {
          //按校验规则顺序    （按元素顺序没写）
          await valid_noDef.call(this, this.valiTypes.required, null, options);
          await valid_maxLen.call(this, this.valiTypes.maxlen, null, options);
          await valid_minLen.call(this, this.valiTypes.minlen, null, options);
          await isTrue.call(this, this.valiTypes.isTrue, null, options);
          await noNewline.call(this, this.valiTypes.noNewline, null, options);
          this.passedDatas = Array.from(this.passedDatas).filter(i => {
            const result = i._validateRes_;
            delete i._validateRes_;
            return result;
          });
          resolve(this.passedDatas);
        }
        v.call(this);
      });
    }
  };

  /**
   * 基础校验格式
   */
  function balidFn_Wrap(isValiFail, errorMsg, map, options) {
    return new Promise((resolve, reject) => {
      for (let item of map) {
        if (item.options.datafrom) {
          this.passedDatas.add(item.options.datafrom);
        }
        if (isValiFail(item)) {
          if (!options.hideErr) {
            showErrorPop.call(this, errorMsg(item));
            const inputDom = findInputInDom(item.elm);
            if (inputDom) {
              inputDom.focus();
            } else {
              flashNoteWrong(item.elm);
              item.elm.scrollIntoView && item.elm.scrollIntoView();
            }
          }
          //未通过
          item.options.datafrom &&
            (item.options.datafrom._validateRes_ = false);
          if (options.step) {
            return;
          }
        } else {
          //通过校验的数据对象
          if (
            item.options.datafrom &&
            item.options.datafrom._validateRes_ === undefined
          ) {
            item.options.datafrom._validateRes_ = true;
          }
        }
      }
      resolve(true);
    });
  }

  /**
   * 校验非空；
   */
  function valid_noDef(map, data, options) {
    const ruleVali = function (item) {
      return (item.data && isNoDef(item.data[key])) || isNoDef(item.value);
    };

    const errorMsg = function (item) {
      return `${item.note} 未填写`;
    };
    return balidFn_Wrap.call(this, ruleVali, errorMsg, map, options);
  }
  /**
   * 最长长度；
   */
  function valid_maxLen(map, data, options) {
    const ruleVali = function (item) {
      let finVal = (data && data[item.key]) || item.value;
      return (finVal && finVal.length) > item.options.maxlen;
    };
    const errorMsg = function (item) {
      return `${item.note} 不能超过${item.options.maxlen}个字数！`;
    };
    return balidFn_Wrap.call(this, ruleVali, errorMsg, map, options);
  }
  /**
   * 最小长度；
   */
  function valid_minLen(map, data, options) {
    const ruleVali = function (item) {
      let finVal = (data && data[item.key]) || item.value;
      return (finVal && finVal.length) < item.options.minlen;
    };
    const errorMsg = function (item) {
      return `${item.note} 不能少于${item.options.minlen}个字数！`;
    };
    return balidFn_Wrap.call(this, ruleVali, errorMsg, map, options);
  }
  /**
   * 值为true
   */
  function isTrue(map, data, options) {
    const ruleVali = function (item) {
      let finVal = (data && data[item.key]) || item.value;
      return finVal === true && finVal === "true";
    };
    const errorMsg = function (item) {
      return `${item.note}`;
    };
    return balidFn_Wrap.call(this, ruleVali, errorMsg, map, options);
  }
  /**
   * 没有换行
   */
  function noNewline(map, data, options) {
    const ruleVali = function (item) {
      let finVal = (data && data[item.key]) || item.value;
      return finVal.match(/[\r\n]/);
    };
    const errorMsg = function (item) {
      return `${item.note}不允许换行！`;
    };
    return balidFn_Wrap.call(this, ruleVali, errorMsg, map, options);
  }

  //------------------------------------------//

  // 过滤校验规则
  function filterValiRules(valiTypes, ruleFilter) {
    if (ruleFilter) {
      if (ruleFilter.exclude && ruleFilter.exclude.length > 0) {
        for (const name of ruleFilter.exclude) {
          valiTypes[name].length = 0;
        }
      } else if (ruleFilter.include && ruleFilter.include.length > 0) {
        for (const name in valiTypes) {
          if (!ruleFilter.include.includes(name)) {
            valiTypes[name].length = 0;
          }
        }
      }
    }
  }
  //清空上次保存的验证类型数组
  function clearValiTypes(data) {
    for (let i in data) {
      data[i].length = 0;
    }
  }

  //标准化格式
  function handerValiTypes(validNeedVnodes, valiTypes, vmData) {
    for (let item of validNeedVnodes) {
      const modifiers = item.valiDate.modifiers;
      for (let ruleName in modifiers) {
        const genedArgs = genArgs(item.valiDate.value);
        //过滤筛选
        if (processFilter(genedArgs, ruleName)) {
          //根据argument获取dataFrom;
          processDataFrom(item.valiDate, genedArgs.options, vmData);
          valiTypes[ruleName].push({
            value: item.valiDate.arg,
            note: genedArgs.note,
            elm: item.elm,
            options: genedArgs.options
          });
        }
      }
    }
  }

  //过滤
  function processFilter(genedArgs, ruleName) {
    //当filter是bool型，决定整个对象要不要校验
    if (typeof genedArgs.options.filter == "boolean") {
      return !!genedArgs.options.filter;
    } else if (isObj(genedArgs.options.filter)) {
      //存在filter,是个对象；即针对个别规则过滤
      return genedArgs.options.filter.hasOwnProperty(ruleName)
        ? !!genedArgs.options.filter[ruleName]
        : true;
    } else {
      return !genedArgs.options.filter;
    }
  }

  function genArgs(value) {
    const res = {
      note: "",
      options: {}
    };
    if (typeof value == "string") {
      res.note = value || "";
    } else if (isArray(value)) {
      res.note = value[0] || "";
      res.options = value[1] || {};
    }
    return res;
  }
  //根据argument获取dataFrom;
  function processDataFrom(direInfo, options, vmData) {
    let arguString,
      arguArray,
      finalObj = vmData;
    if (!options.datafrom) {
      arguString = direInfo.rawName.match(/\[(.+)\]/);
      if (arguString) {
        arguArray = arguString[1].split(".");
      }
      //因为要取最终值所在的对象，去掉最后一个路径（即最终值）
      if (arguArray.length > 1) {
        arguArray.pop();
      }
      for (let path of arguArray) {
        //如果取不到值，说明该arg应该是slot赋值写法（如 scope.XXX）；在VmData里是取不到值的
        if (!(finalObj = finalObj[path])) {
          return;
        }
      }
      options.datafrom = finalObj;
    }
  }
  //遍历得到需要验证的节点
  function getValiNeedVnodes(vnode, result) {
    if (vnode.data && vnode.data.directives) {
      const valiDate = getValiDate("validate", vnode);
      if (valiDate) {
        result.push({
          vnode,
          valiDate,
          elm: vnode.elm
        });
      }
    }
    // 如果遇到组件，并不会有children，应该进入组件Vnode找children
    while (vnode.componentInstance) {
      vnode = vnode.componentInstance._vnode;
    }
    if (vnode.children) {
      for (let node of vnode.children) {
        // if (node.data && node.data.directives) {
        //     const valiDate = getValiDate("validate", node);
        //     debugger
        //     if (valiDate) {
        //         result.push({
        //             node,
        //             valiDate,
        //             elm: node.elm
        //         })
        //     }
        // }
        getValiNeedVnodes(node, result);
      }
    }
  }
  // 从vnode的directives里找到某个字段;
  function getValiDate(name, vnode) {
    for (let directive of vnode.data.directives) {
      if (directive.name == name) {
        return directive;
      }
    }
  }
  //查找domEL对应的Vnode节点
  function getVnodeByElm(elm, vnode) {
    //非dom元素， 当组件处理
    if (!elm.nodeType) {
      return elm._vnode;
    }
    if (vnode.children) {
      for (let node of vnode.children) {
        if (node.componentInstance) {
          node = node.componentInstance._vnode;
        }
        if (node.elm == elm) {
          return node;
        } else {
          let result = getVnodeByElm(elm, node);
          if (result) {
            return result;
          }
        }
      }
    }
  }
  //返回某dom元素下的input/textarea节点
  function findInputInDom(dom) {
    if (dom.nodeName == "INPUT" || dom.nodeName == "TEXTAREA") {
      return dom;
    } else {
      const res = dom.querySelector("input");
      return (
        (res && res.type == "text" && res) || dom.querySelector("textarea")
      );
    }
  }

  function genKeyName(text) {
    return text.replace(/[\:\：]+/, "");
  }
  //
  function genVal(text) {
    const expression = text.split(".");
    return expression[expression.length - 1];
  }

  // 错误高亮样式
  function injectClass() {
    let styleDom = document.createElement("style");
    styleDom.innerHTML =
      "._flashNoteWrong{border-color: red;box-shadow: 0 0 2px 1px red;border-radius: 4px;}";
    document.body.appendChild(styleDom);
  }
  // 错误高亮方式
  function flashNoteWrong(elm) {
    if (!elm) {
      return;
    }
    elm.classList.add("_flashNoteWrong");
    elm.addEventListener("click", function () {
      elm.classList.remove("_flashNoteWrong");
    });
  }
  //过滤数据
  function filterValiTypes(data, valiTypes) {
    for (let [ruleName, rules] of Object.entries(valiTypes)) {
      //rules：对应规则数据组
      const filtered = [];
      for (let itemI = 0; itemI < rules.length; itemI++) {
        if (rules[itemI].options.datafrom === data) {
          filtered.push(rules[itemI]);
        }
      }
      valiTypes[ruleName] = filtered;
    }
  }

  //错误提示
  function showErrorPop(text) {
    if (this._options.errorPop) {
      _options.errorPop(text);
    } else {
      alert(text);
    }
  }
  function isObj(data) {
    return Object.prototype.toString.call(data) === "[object Object]";
  }

  function isNoDef(val) {
    if (typeof val === "object" && val !== null) {
      return !Object.keys(val).length;
    } else {
      return val === "" || val === undefined || val === null;
    }
  }

  //根据key缓存函数执行结果
  function cached(fn, key) {
    const cache = Object.create(null);

    return function cachedFn() {
      const hit = cache[key];
      return hit || (cache[key] = fn.call(null, ...arguments));
    };
  }

  function isArray(data) {
    return Array.isArray(data);
  }
});
