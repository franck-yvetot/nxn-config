const crypto = require('crypto')   
const {objectSce,stringSce,arraySce} = require("@nxn/ext");
// const querystring = require("querystring");
// const configSce = require('./config.service');
const { parse, eval } = require('expression-eval');

const pipes = {
    id : formatId,
    base64 : b64,
    decode64 : decodeB64,
    md5:md5,
    json:JSON.parse,
    stringify:JSON.stringify,

    dateString:dateString,
    timestamp:timestamp,
    date: d => new Date(d),
    now: d => new Date(),

    url_encode:encodeURIComponent,

    trim: v => v.trim(),
    lower: v => v.lower(),
    upper: v => v.upper(),
    no_accents : stringSce.removeAccents,

    env:env,
    argv: i => argv(i)
};

class MapSce
{
    constructor() {
        this.init();
    }

    init() {
        // set pipe functions
        this.pipes = pipes;
    }

    // add a custom pipe filter
    addFilter(k,f) {
        this.pipes[k] = f;
    }

    not_found(pattern,path) {
        throw new Error("Variable not found : "+pattern+' at '+path);
    }

    mapPattern(pattern,obj)
    {
        let aPipes = pattern.split('|'); // supports yyy.xxx|id|lower|base64
        let patt = aPipes.shift(); 
        let attribs = patt.split('.'); // supports yyy.xxx
        
        // walk the object tree
        let obj2 = obj;
        attribs.forEach(k=> 
            obj2 && 
                (k in obj2) ? 
                (obj2=obj2[k])
                    : not_found(patt,k)
        );

        // now pipe the value to filters
        aPipes.forEach(pipe => {
            if(this.pipes[pipe])
                obj2 = this.pipes[pipe](obj2);
            else
                throw new Error("invalid ammping pattern, unknown pipe "+pipe);
        });
        
        return obj2;
    }

    evalExpression(expr,obj) {
        const ast = parse(expr); 
        const value = eval(ast, obj); 
        return value;
    }

    mapString(pattern,obj, regVar=null,regExpr=null)
    {
        // process ${{ expression }}
        regExpr = regExpr || /\$\{\{([^\}]+)\}\}/gi;
        let rep =pattern.replace(regExpr,
            (match,p1) => { 
                return this.evalExpression(p1,obj);
            });

        // process ${VARIABLES}
        regVar = regVar || /\$\{([a-z 0-9_|]+)\}/gi;
        rep =rep.replace(regVar,
            (match,p1) => { 
                return this.mapPattern(p1,obj);
            });

        return rep;    
    }             

    mapFieldMacros(fname,obj,map,regVar,regExpr) {
        let pattern = map[fname];

        if(!pattern)
            return obj[fname]||null;

        pattern = pattern.trim();

        if(pattern.startsWith)
        {
            let isString = false;
            if(pattern.startsWith('${{') && pattern.endsWith('}}'))
            {
                let pattern2 = pattern.trim().slice(3).slice(0,-2);
                if(pattern2.indexOf('${')==-1)
                {
                    return this.evalExpression(pattern2,obj);
                }
                else
                    // expression and other stuff like viariables
                    isString = true;
            }       
    
            // ${VAR} => copy value as is (with same type etc.)
            if(!isString && pattern.startsWith('${') && pattern.endsWith('}'))
            {
                let pattern2 = pattern.trim().slice(2).slice(0,-1);
                // check if no other ${VAR2} in the pattern
                if(pattern2.indexOf('${')==-1)
                {
                    pattern2 = pattern2 || fname; // supports = or =name
                    return this.mapPattern(pattern2,obj);
                }
                else
                    // includes other variables, so must be a string...
                    isString = true;
            }       
    
            if(pattern.startsWith('$ref(') && pattern.endsWith(')'))
            {
                let inc = pattern.trim().slice(5).slice(0,-1);
                if(inc.indexOf("${") > -1)
                    inc = this.mapString(inc,obj,regVar,regExpr);
                    
                return this.configSce.loadConfig(inc,null,obj);
            }
        }

        // process ${{ expression }}
        regExpr = regExpr || /\$\{\{([^\}]+)\}\}/gi;
        let rep =pattern.replace(regExpr,
            (match,p1) => { 
                return this.evalExpression(p1,obj);
            });

        // process ${VARIABLES}
        regVar = regVar || /\$\{([a-z 0-9_|]+)\}/gi;
        rep =rep.replace(regVar,
            (match,p1) => { 
                return this.mapPattern(p1,obj);
            });

        return rep;    
    }

    mapObj(map,from,reg)
    {
        let to = {};

        /*
        for (let k in map)
        {
            if(k=='$merge')
            {
                let v2 = this.mapObj(map[k],from);               
                this.addIncludes(conf2,v2);
                map = this.merge(map,v2);
            }
        }
        */

        objectSce.forEachSync(map,(v,k) => {
            let v2;

            if(k.startsWith('$for'))
            {
                let to2 = this.loop(map,v,from,reg);
                return to2;
            }
            else if(typeof v =="string")
                v2 = this.mapFieldMacros(k,from,map,reg)
            else if(v instanceof Array)
                v2 = this.mapArray(v,from);
            else  if(typeof v =="object")
                v2 = this.mapObj(v,from);
            else
                // boolean
                v2 = v;

            if(typeof v2 == "undefined")
                return;

            if(k=='$includes')
            {
                this.addIncludes(to,v2);
                //delete map[k];
            }
            else
            {
                let k2 = k;
                if(k.indexOf('${') > -1)
                {
                    k2 = this.mapString(k,from,reg);
                }
                if(to)
                    to[k2] = v2;
                else
                {
                    let i=0;
                }
            }
        });

        return to;
    }

    mapArray(map,from,reg)
    {
        let to = [];

        arraySce.forEachSync(map,(v,k) => {
            let v2;
            if(k.startsWith && k.startsWith('$for'))
            {
                to = this.loop(map,v,from,reg);
                return to;
            }
            if(typeof v =="string")
                v2 = this.mapFieldMacros(k,from,map,reg)
            else if(v instanceof Array)
                v2 = this.mapArray(v,from);
            else  if(typeof v =="object")
                v2 = this.mapObj(v,from);
            else
                // boolean
                v2 = v;

            if(typeof v2 == "undefined")
                return;

            if(k=='$includes')
            {
                this.addIncludes(to,v2);
            }
            else
                to[k] = v2;
        });

        return to;
    }

    loop(map,v,from,reg) {
        if(v instanceof Object)
        {
            let to = {...map}; 
            let varName = v.variable || "iter";
            let content = v.content || {}
            let list = v.list;
            if(list.split)
                list = list.split(',').map(i => i.trim());

            list.forEach(i => {
                let vars = {...from};
                vars[varName] = i;

                let v2;                
                if(content instanceof Object)
                {
                    v2 = this.mapObj(content,vars,reg);
                }                
                else if(content instanceof Array)
                {
                    v2 = this.mapArray(content,vars,reg);
                }
                else                
                    v2 = content;

                this.insertContent(to,v2,vars,reg);

                return to;
            })
        }
    }

    insertContent(map,v2,vars,reg) {
        if(map instanceof Array)
        {
            if(typeof v2 =="string")
                map.push(v2);
            else if(v2 instanceof Array)
            {
                for(let i = 0 ;i<v2.length; i++)
                    map.push(v2[i]);
            }
            else  if(typeof v2 =="object")
            {
                for(let p in v2)
                {
                    map.push(v2[p]);
                }
            }
            else
                // boolean
                map.push(v2)
        }
        else  if(typeof map =="object")
        {
            if(typeof v2 =="string")
            {
                debug.error("invalid format : cant add a string into an object "+v2);
                throw new Error("invalid format : cant add a string into an object "+v2);
            }
            else if(v2 instanceof Array)
            {
                debug.error("invalid format : cant add an array into an object "+v2);
                throw new Error("invalid format : cant add an array into an object "+v2);
            }
            else  if(typeof v2 =="object")
            {                
                for(let p in v2)
                {
                    if(p != "$path")
                    {
                        let p2 = this.mapString(p,vars,reg);

                        if(typeof map[p] == "undefined")
                            map[p2] = v2[p];
                        else
                            // map[p] = this.mergeDeep (map[p], v2[p]);
                            map[p2] = {...map[p], ...v2[p]};
                    }
                }
            }
            else
            {
                debug.error("invalid format : cant include a simple value in an object "+v2);
                throw new Error("invalid format : cant add a string into an object "+v2);
            }
        }        
    }



    mergeDeep (target, source)  {
        if (typeof target == "object" && typeof source == "object") {
            for (const key in source) {
                if (source[key] === null && (target[key] === undefined || target[key] === null)) {
                    target[key] = null;
                } else if (source[key] instanceof Array) {
                    if (!target[key]) target[key] = [];
                    //concatenate arrays
                    target[key] = target[key].concat(source[key]);
                } else if (typeof source[key] == "object") {
                    if (!target[key]) target[key] = {};
                    this.mergeDeep(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        }
        return target;
    }

    addIncludes(map,v2) {
        if(map instanceof Array)
        {
            if(typeof v2 =="string")
                map.push(v2);
            else if(v2 instanceof Array)
            {
                for(let i = 0 ;i<v2.length; i++)
                    map.push(v2[i]);
            }
            else  if(typeof v2 =="object")
            {
                for(let p in v2)
                    map.push(v2[p]);
            }
            else
                // boolean
                map.push(v2)
        }
        else  if(typeof map =="object")
        {
            if(typeof v2 =="string")
            {
                debug.error("invalid format : cant add a string into an object "+v2);
                throw new Error("invalid format : cant add a string into an object "+v2);
            }
            else if(v2 instanceof Array)
            {
                for(let i = 0 ;i<v2.length; i++)
                    this.addIncludes(map,v2[i]);
            }
            else  if(typeof v2 =="object")
            {                
                for(let p in v2)
                {
                    if(p != "$path")
                        if(typeof map[p] == "undefined")
                            map[p] = v2[p];
                        else
                            // map[p] = this.mergeDeep (map[p], v2[p]);
                            map[p] = {...map[p], ...v2[p]};
                    }
            }
            else
            {
                debug.error("invalid format : cant include a simple value in an object "+v2);
                throw new Error("invalid format : cant add a string into an object "+v2);
            }
        }
    }

    mapConfig(config,variables,configSce)
    {
        this.configSce = configSce;
        
        return this.mapObj(config,variables);
    }
}

// private functions
function formatId(itemId) {
    itemId = itemId.replace(/[_\-.\s]/g,"-");
    itemId = stringSce.removeAccents(itemId);
  
    return itemId;
  }

  
function md5(s)
{
    return crypto.createHash('md5').update(s).digest("hex");
}

function b64(s) {
    return Buffer.from(s).toString('base64'); 
}
  
function decodeB64(s) {
// return Buffer.from(s).toString('ascii'); 
return Buffer.from(s, 'base64').toString('ascii');
}
  
function timestamp(date) {
    const d = date || new Date();
    return d.getTime();
}
  
function not_found(pattern,path) {
    throw new Error("Variable not found : "+pattern+' at '+path);
}

  function dateString(date,withSec) {
    const d = date || new Date();
  
    return d.getUTCFullYear() + 
        ("0" + (d.getUTCMonth()+1)).slice(-2) + 
        ("0" + d.getUTCDate()).slice(-2) +
        ("0" + d.getUTCHours()).slice(-2) +
        ("0" + d.getUTCMinutes()).slice(-2) +
        ("0" + d.getUTCSeconds()).slice(-2);     
  }

function urlEncode(s) {
    return 
}  

function env(v) {
    return process.env[v];
}

function argv(v) {
    const i = parseInt(v);
    return process.argv[v];
}

module.exports = new MapSce();
