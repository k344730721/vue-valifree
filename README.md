/**
 * vue 校验库
 * 
 * 优点：不同于流行ui库做法：校验需写在特定组件内；此校验库基于指令，可写在任何元素上（原生标签/组件）；
 *       例如 <div v-validate:[argument].required.maxLen="['提示语',{ maxLen: 500 }]"></div>
 * 
 * 使用方法： 
 * 
 * 1.初始化：
 * webpack中： import("XXX/validate.js")
 * 浏览器中： <script src="XXX/validate.js">
 * // import { Validator } from "XXX/validate.js"; 晚点在改成标准模块
 * 
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
 *          maxLen, //最长长度
 *          minLen, //最小长度（大于等于）
 *          filter, // 为true时才校验该项
 *          dataFrom, // 该项所在的数据对象
 *        }
 * 
 * 
 * 例子：<div v-validate:[argument].required.maxLen="['提示语',{ maxLen: 500 }]"></div>
    argument:绑定值(支持点语法即 a.b.c)； modifier:校验规则； value: String|Array   ["ErrText",{maxLen,step,filter,dataFrom} ]

 *  argument 解释：
    一般情况下，会直接拿argument字符串，根据vue实例的vm.$data[argument]来自动获取dataFrom；
    但是在slot里，会有作用域插槽写法（如 scope.XXX); 这时无法自动获取，也就是说，slot情况下如果需要返回数据，需要自己传入dataFrom；
    若不传，则返回结果内，没该条数据

    
 * 原理：
 * 利用了vue的directive的解析后的AST，并没用到directive的钩子，所以全局注册了个空的指令 directives:{ validate:{} },
 */
